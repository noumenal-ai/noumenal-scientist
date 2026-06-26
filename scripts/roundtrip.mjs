// Round-trip gate: the cards rendered from regenerated data must deep-equal the
// originals. `snap` saves the golden reference (run before refactor); `check`
// compares the current index.html against it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evalSections } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');
const GOLD = path.join(SITE, 'data', '_golden.json');
const mode = process.argv[2];

function stable(o) {
  if (Array.isArray(o)) return o.map(stable);
  if (o && typeof o === 'object') return Object.fromEntries(Object.keys(o).sort().map(k => [k, stable(o[k])]));
  return o;
}
// reduce sections to the comparable projects (what the renderer shows)
function projects(html) {
  return evalSections(html).map(s => ({ id: s.id, projects: (s.projects || []) }));
}

const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');

if (mode === 'snap') {
  fs.mkdirSync(path.dirname(GOLD), { recursive: true });
  fs.writeFileSync(GOLD, JSON.stringify(stable(projects(html)), null, 1));
  const p = projects(html); const n = p.reduce((a, s) => a + s.projects.length, 0);
  console.log(`golden snapshot saved: ${p.length} sections, ${n} cards`);
} else if (mode === 'check') {
  const gold = JSON.parse(fs.readFileSync(GOLD, 'utf8'));
  const now = stable(projects(html));
  const a = JSON.stringify(gold), b = JSON.stringify(now);
  if (a === b) { console.log('ROUND-TRIP OK — regenerated cards are byte-identical to the original render'); process.exit(0); }
  // find first divergence
  const ga = JSON.parse(a), gb = JSON.parse(b);
  for (let i = 0; i < Math.max(ga.length, gb.length); i++) {
    const sa = JSON.stringify(ga[i]), sb = JSON.stringify(gb[i]);
    if (sa !== sb) {
      console.log(`DIVERGENCE in section ${ga[i]?.id || gb[i]?.id} (cards: ${ga[i]?.projects.length} vs ${gb[i]?.projects.length})`);
      const pa = ga[i]?.projects || [], pb = gb[i]?.projects || [];
      for (let k = 0; k < Math.max(pa.length, pb.length); k++) {
        if (JSON.stringify(pa[k]) !== JSON.stringify(pb[k])) {
          console.log(`  card #${k}: ${pa[k]?.title || '∅'}  vs  ${pb[k]?.title || '∅'}`);
          const fa = pa[k] || {}, fb = pb[k] || {};
          for (const key of new Set([...Object.keys(fa), ...Object.keys(fb)]))
            if (JSON.stringify(fa[key]) !== JSON.stringify(fb[key]))
              console.log(`     field ${key}:\n       gold: ${JSON.stringify(fa[key])?.slice(0,120)}\n       now : ${JSON.stringify(fb[key])?.slice(0,120)}`);
          break;
        }
      }
      break;
    }
  }
  process.exit(1);
} else {
  console.log('usage: roundtrip.mjs snap|check');
}
