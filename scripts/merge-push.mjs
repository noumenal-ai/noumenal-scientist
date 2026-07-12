// merge-push.mjs — merge authored card drafts (witnesses referenced by '<file>::<name>')
// into the staged manifests, injecting the VERBATIM verified snippet for every ref.
// Authors cannot fabricate code: an unknown ref is dropped and reported.
//   node scripts/merge-push.mjs <workflow-output.json>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');
const NOUM = path.resolve(SITE, '..');
const INPUTS = path.join(NOUM, '_rebuild', 'push-inputs');
const MAN = path.join(SITE, 'data', 'manifests');

const outFile = process.argv[2];
let results = JSON.parse(fs.readFileSync(outFile, 'utf8'));
if (results.result) results = results.result;

const CORPUS_PREFIX = /^.*Epistemology and Zetesis\/(Projects\/|Noumenal\/)?/;
// repos where local checkout == repo layout (public) -> witnesses get live file/name
const LIVE_REPOS = {
  'Zetetic-Dhruv/transformer-learning-theory': /transformer-learning-theory\//,
  'Zetetic-Dhruv/First-Proof-Benchmark-Results': /First-Proof-Benchmark-Results\//,
  'Zetetic-Dhruv/audit-compression-progress': /verifiable_RSI\/audit-compression-progress\//,
};
const DL_LIBS = ['causality', 'measurements', 'learning-theory', 'rl', 'neural-networks', 'transformers', 'statistics', 'metis', 'index'];

const BANNED = /\b(URT|URS|zetetic|noolog|KK|KU|UK|UU)\b/;
let added = 0, droppedRefs = [], jargonHits = [];

for (const [inputFile, draft] of Object.entries(results)) {
  if (!draft || !draft.cards) continue;
  const input = JSON.parse(fs.readFileSync(path.join(INPUTS, inputFile), 'utf8'));
  const byRef = new Map(input.witnesses.map(w => [`${w.file}::${w.name}`, w]));
  const bySrc = new Map((input.diagrams || []).map(d => [d.src, d]));
  const manFile = path.join(MAN, inputFile);
  const man = fs.existsSync(manFile)
    ? JSON.parse(fs.readFileSync(manFile, 'utf8'))
    : { noumenal: true, version: 1, repo: input.repo, cards: [] };
  let order = 9000 + man.cards.length * 10;

  for (const card of draft.cards) {
    // jargon / em-dash backstop on generated prose
    for (const txt of [card.title, card.direction, card.note || '']) {
      if (BANNED.test(txt) || txt.includes('—')) jargonHits.push(`${inputFile}: "${txt.slice(0, 60)}"`);
    }
    const witnesses = [];
    let argN = 0;
    for (const w of (card.witnesses || [])) {
      const src = byRef.get(w.ref);
      if (!src) { droppedRefs.push(`${inputFile}: ${w.ref}`); continue; }
      argN++;
      const rel = src.file.replace(CORPUS_PREFIX, '');
      const isSorry = /\bsorry\b/.test(src.snippet);
      const witness = {
        type: 'proof',
        cell: isSorry ? 'open_step' : w.cell,
        n: `arg.${argN}`,
        ...(w.caption ? { claim: w.caption } : {}),
        code: src.snippet,                                  // VERBATIM verified snippet
        source: `${rel} ∷ ${src.name}`,
      };
      const liveRe = LIVE_REPOS[input.repo];
      if (liveRe && liveRe.test(src.file)) {
        witness.file = src.file.split(liveRe.source.replace(/\\\//g, '/').replace(/\\/g, ''))[1] || rel.replace(liveRe, '');
        witness.file = src.file.replace(/^.*?(transformer-learning-theory|First-Proof-Benchmark-Results|audit-compression-progress)\//, '');
        witness.name = src.name;
      }
      witnesses.push(witness);
    }
    for (const d of (card.diagrams || [])) {
      const src = bySrc.get(d.src);
      if (!src) { droppedRefs.push(`${inputFile}: diagram ${d.src}`); continue; }
      witnesses.push({ type: 'figure', cell: 'supporting_argument', src: src.src,
        alt: src.depicts, source: src.source, ...(d.caption ? { claim: d.caption } : {}) });
    }
    if (!witnesses.length) continue;
    // design-lab: pick the dominant library for the repo display
    let repoDisplay = input.repo;
    if (input.repo === 'noumenal-ai/design-lab') {
      const libs = witnesses.map(w => DL_LIBS.find(l => (w.source || '').includes(`/${l}/`) || (w.source || '').startsWith(`design-lab/${l}`))).filter(Boolean);
      const top = libs.sort((a, b) => libs.filter(x => x === b).length - libs.filter(x => x === a).length)[0];
      if (top) repoDisplay = `design-lab · ${top}`;
    }
    const hasSorry = witnesses.some(w => w.cell === 'open_step');
    man.cards.push({
      order: order += 10,
      ingredient: input.section,
      title: card.title,
      repo: repoDisplay,
      vis: input.vis,
      status: hasSorry ? 'open' : 'active',
      alsoIn: '', direction: card.direction,
      note: card.note || (hasSorry ? 'One or more proof obligations are still open.' : ''),
      tbd: false,
      witnesses,
    });
    added++;
  }
  fs.writeFileSync(manFile, JSON.stringify(man, null, 2));
}

console.log(`merged ${added} new cards into staged manifests`);
if (droppedRefs.length) { console.log(`DROPPED ${droppedRefs.length} unknown refs (anti-fabrication):`); droppedRefs.forEach(r => console.log('  ' + r)); }
if (jargonHits.length) { console.log(`JARGON/EM-DASH hits (fix required):`); jargonHits.forEach(r => console.log('  ' + r)); process.exit(1); }
