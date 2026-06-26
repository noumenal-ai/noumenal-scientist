// One-time refactor: replace the monolithic `const sections = [ ... ];` with
// hand-authored SECTION_SHELLS + a GEN-sentinel PROJECTS_BY_SECTION block +
// a reconstruction. Idempotent: refuses if sentinels already present.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');
const idx = path.join(SITE, 'index.html');
let html = fs.readFileSync(idx, 'utf8');

if (html.includes('<<<GEN-PROJECTS')) { console.log('already refactored; skipping'); process.exit(0); }

const shells = JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'section-shells.json'), 'utf8'));

const si = html.indexOf('const sections = ');
const arrStart = html.indexOf('[', si);
const after = html.slice(arrStart);
const cm = after.match(/\n    \];/);
const arrEnd = arrStart + cm.index + cm[0].lastIndexOf(']') + 1; // through closing ]
const fullStart = si;
const fullEnd = arrEnd + (html[arrEnd] === ';' ? 1 : 0); // include trailing ;

const shellsJS = JSON.stringify(shells, null, 6).replace(/\n/g, '\n    ');
const replacement =
`const SECTION_SHELLS = ${shellsJS};

    // <<<GEN-PROJECTS — produced by scripts/aggregate.mjs; do not edit by hand
    const PROJECTS_BY_SECTION = {};
    // GEN-PROJECTS>>>

    const sections = SECTION_SHELLS.map(s => ({ ...s, projects: (PROJECTS_BY_SECTION[s.id] || []) }));`;

html = html.slice(0, fullStart) + replacement + html.slice(fullEnd);
fs.writeFileSync(idx, html);
console.log('refactor done: SECTION_SHELLS + GEN sentinels + reconstruction in place');
