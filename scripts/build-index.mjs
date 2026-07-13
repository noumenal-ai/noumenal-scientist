// build-index.mjs — publish the machine-readable research index at /index.json:
// every section, card, and witness on the page, PLUS the complete verified corpus
// (all freshly re-verified theorems, carded or not). This is the agent-facing face
// of the site: one handle, human page or JSON.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evalSections } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');
const NOUM = path.resolve(SITE, '..');
const INPUTS = path.join(NOUM, '_rebuild', 'push-inputs');

const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
const sections = evalSections(html);

const witJSON = (w) => w.isProof ? { type: 'proof', cell: w.cell, claim: w.claim || undefined, code: w.code, source: w.source }
  : w.isEmpirical ? { type: 'empirical', cell: w.cell, headline: w.headline, metrics: w.metrics, source: w.source }
  : { type: 'figure', cell: w.cell, claim: w.claim || undefined, alt: w.alt || undefined, source: w.source };

const CORPUS_PREFIX = /^.*Epistemology and Zetesis\/(Projects\/|Noumenal\/)?/;

// page layer: what a reader sees, machine-readable
const page = sections.map(s => ({
  id: s.id, name: s.name, tagline: s.tagline, def: s.def,
  cards: (s.projects || []).map(p => ({
    title: p.title, repo: p.repo, visibility: p.vis, status: p.status,
    author: p.author || undefined,
    also_in: p.alsoIn || undefined, direction: p.direction || undefined, note: p.note || undefined,
    witnesses: (p.witnesses || []).map(witJSON),
    subcards: (p.subcards && p.subcards.length) ? p.subcards.map(sc => ({
      title: sc.title, direction: sc.direction || undefined, note: sc.note || undefined,
      witnesses: (sc.witnesses || []).map(witJSON),
    })) : undefined,
  })),
}));

// corpus layer: EVERY verified theorem in the kept programme, carded or not
const corpus = { proofs: [], figures: [] };
if (fs.existsSync(INPUTS)) {
  for (const f of fs.readdirSync(INPUTS).filter(f => f.endsWith('.json'))) {
    const inp = JSON.parse(fs.readFileSync(path.join(INPUTS, f), 'utf8'));
    for (const w of inp.witnesses) corpus.proofs.push({
      repo: inp.repo, section: inp.section,
      path: w.file.replace(CORPUS_PREFIX, ''), decl: w.name,
      signature: w.snippet, supports: w.supports,
    });
    for (const d of (inp.diagrams || [])) corpus.figures.push({
      repo: inp.repo, src: d.src, depicts: d.depicts, source: d.source,
    });
  }
}

const index = {
  $schema: 'https://noumenal-ai.github.io/noumenal-scientist/schemas/unit.v2.json',
  site: 'https://noumenal-ai.github.io/noumenal-scientist/',
  description: 'Machine-readable index of the Noumenal research atlas: the rendered page (sections, cards, witnesses) plus the complete verified corpus of the programme. Every proof entry names a real Lean declaration in the cited repository.',
  trust_base: { kernel: 'Lean 4', axioms: ['propext', 'Classical.choice', 'Quot.sound'], note: 'verified modulo a named base; per-declaration axiom audits via #print_axioms' },
  render: { human: 'text/html (this site)', agent: 'application/json (this file)' },
  sections: page,
  corpus,
};
fs.writeFileSync(path.join(SITE, 'index.json'), JSON.stringify(index, null, 1));
const nc = page.reduce((a, s) => a + s.cards.length, 0);
const nw = page.reduce((a, s) => a + s.cards.reduce((x, c) => x + c.witnesses.length, 0), 0);
console.log(`index.json: ${page.length} sections, ${nc} cards, ${nw} card-witnesses; corpus: ${corpus.proofs.length} proofs, ${corpus.figures.length} figures`);
