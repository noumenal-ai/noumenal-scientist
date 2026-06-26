// Extract the current hand-authored card data from index.html into per-repo
// noumenal.json manifests (the migration). Node-evals the `const sections` literal
// with capture-stubs so the raw SVG/vb of every diagram witness is preserved.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');
const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');

// --- slice the array literal: `const sections = [ ... ];` ---
const startMark = 'const sections = ';
const si = html.indexOf(startMark);
if (si < 0) throw new Error('const sections not found');
const arrStart = html.indexOf('[', si);
// matching close: the first `\n    ];` after arrStart
const closeRe = /\n    \];/;
const after = html.slice(arrStart);
const cm = after.match(closeRe);
if (!cm) throw new Error('sections close not found');
const arrayText = after.slice(0, cm.index + cm[0].lastIndexOf(']') + 1); // through the closing ]

// --- capture stubs (keep RAW fields; do NOT build data-URIs) ---
const svgURI = (vb, inner) => ({ __raw: true, vb, svg: inner });
const W = {
  proof: (o) => ({ type: 'proof', cell: '', code: '', source: '', ...o }),
  fig:   (o) => ({ type: 'figure', cell: '', src: '', alt: '', source: '', flag: '', ...o }),
  emp:   (o) => ({ type: 'empirical', cell: '', headline: '', metrics: [], stats: [], note: '', source: '', ...o }),
};
W.dia = (o) => ({ type: 'diagram', n: o.n, cell: o.cell || 'supporting_argument', claim: o.claim, alt: o.alt || '', flag: o.flag || '', source: o.source, vb: o.vb, svg: o.svg });
const P = (o) => ({ kind: 'P', title: '', repo: '', vis: '', status: '', alsoIn: '', direction: '', tbd: false, note: '', witnesses: [], ...o });
const tbd = (o) => P({ kind: 'tbd', tbd: true, witnesses: [], ...o });

let sections;
eval('sections = ' + arrayText + ';'); // helpers in scope

// --- normalize a card's repo string to a real GitHub slug (or null) ---
function repoSlug(repoStr) {
  if (!repoStr || /no published repo/i.test(repoStr)) return null;
  if (/design-lab/i.test(repoStr)) return 'noumenal-ai/design-lab';
  if (/tetrad-audit/i.test(repoStr)) return 'Zetetic-Dhruv/tetrad-audit-code';
  const m = repoStr.match(/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+/);
  return m ? m[0] : null;
}

// --- a manifest is a LIST OF CARDS (a repo may surface as several cards) ---
function captureCard(sec, p, order) {
  return {
    order,
    ingredient: sec.id,
    title: p.title || '',
    repo: p.repo || '',          // ORIGINAL display string (preserved verbatim for the card)
    vis: p.vis || '',
    status: p.status || '',
    alsoIn: p.alsoIn || '',
    direction: p.direction || '',
    note: p.note || '',
    tbd: !!p.tbd,
    // pass through EVERY field the witness carries (proofs may also have n/claim, etc.)
    witnesses: (p.witnesses || []).map(w => ({ ...w })),
  };
}

const byRepo = new Map();
const extras = []; // no-repo cards (planned / central)
let order = 0;
for (const sec of sections) {
  for (const p of (sec.projects || [])) {
    const card = captureCard(sec, p, order++);
    const slug = repoSlug(p.repo);
    if (!slug) { extras.push(card); continue; }
    if (!byRepo.has(slug)) byRepo.set(slug, { noumenal: true, version: 1, repo: slug, cards: [] });
    byRepo.get(slug).cards.push(card);
  }
}

// --- write outputs ---
const outDir = path.join(SITE, 'data', 'manifests');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
for (const [slug, man] of byRepo) {
  const fname = slug.replace('/', '__') + '.json';
  fs.writeFileSync(path.join(outDir, fname), JSON.stringify(man, null, 2));
}
fs.mkdirSync(path.join(SITE, 'data'), { recursive: true });
fs.writeFileSync(path.join(SITE, 'data', 'extra-cards.json'), JSON.stringify(extras, null, 2));

// section shells (hand-authored ingredient definitions) — for the refactor
const shells = sections.map(s => ({ id: s.id, n: s.n, name: s.name, tagline: s.tagline, def: s.def }));
fs.writeFileSync(path.join(SITE, 'data', 'section-shells.json'), JSON.stringify(shells, null, 2));

let cards = 0, wc = 0;
for (const m of byRepo.values()) for (const c of m.cards) { cards++; wc += c.witnesses.length; }
for (const e of extras) wc += e.witnesses.length;
console.log(`repos: ${byRepo.size}, repo-cards: ${cards}, extra (no-repo) cards: ${extras.length}, sections: ${sections.length}`);
console.log(`witnesses captured: ${wc + extras.reduce((a,e)=>a+e.witnesses.length,0)*0}`);
console.log('manifests:', [...byRepo.keys()].join(', '));
