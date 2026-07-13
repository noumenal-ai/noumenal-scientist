// Consolidate Dhruv Gupta's 45 cards into 4 (Design Lab + library subcards, TLT + subcards,
// RSI + 3 subcards, World-Model Theory). Harvest witnesses verbatim from existing manifests.
// Remove his other cards. Keep every teammate card untouched.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAN = path.resolve(HERE, '..', 'data', 'manifests');
const rd = f => JSON.parse(fs.readFileSync(path.join(MAN, f), 'utf8'));
const has = f => fs.existsSync(path.join(MAN, f));

// collect all cards from a manifest file (if present)
const cardsOf = f => has(f) ? (rd(f).cards || []) : [];
// harvest witnesses from cards matching pred, dedup by source, cap
function harvest(files, pred, cap = 6) {
  const seen = new Set(), out = [];
  for (const f of files) for (const c of cardsOf(f)) if (pred(c))
    for (const w of (c.witnesses || [])) {
      const k = (w.source || '') + (w.code || w.src || w.headline || '');
      if (seen.has(k)) continue; seen.add(k);
      out.push(w); if (out.length >= cap) return out;
    }
  return out;
}
const DL = 'noumenal-ai__design-lab.json';
const PTL = 'noumenal-ai__proof-and-theorem-library.json';
const TLT = 'Zetetic-Dhruv__transformer-learning-theory.json';
const ACP = 'Zetetic-Dhruv__audit-compression-progress.json';
const WMT = 'noumenal-ai__world-model-theory.json';
const libIs = lib => c => (c.repo || '').includes('· ' + lib) || (c.repo || '').includes('·' + lib);

// ---------- CARD 1 · DESIGN LAB (formalization) ----------
const designLab = {
  order: 100, ingredient: 'formalization', title: 'Design Lab', repo: 'noumenal-ai/design-lab',
  vis: 'internal', author: 'Dhruv Gupta', alsoIn: 'the whole corpus',
  direction: 'The largest formalized machine-learning corpus in the world: six verified Lean 4 libraries over one pinned toolchain, 17,127 indexed declarations measured 2026-06-15, about 3,700 of them in-house, every result carrying a sorry count and an axiom audit against the named base. Each library below is a region of the same connected corpus.',
  note: '',
  witnesses: [
    { type: 'figure', cell: 'supporting_argument', src: 'assets/5498a368_hypergraph_overview.png',
      alt: 'Module dependency hypergraph of the design-lab corpus, a single connected graph across the six libraries.',
      claim: 'The module dependency hypergraph of the corpus: one connected object, not a folder of files.',
      source: 'design-lab · index (project figure)' },
    { type: 'empirical', cell: 'established_result',
      headline: '17,127 indexed declarations across six verified libraries, about 3,700 in-house, measured 2026-06-15. The learning-theory core alone is 354 machine-checked theorems with zero sorry, on the axiom base {propext, Classical.choice, Quot.sound}.',
      metrics: [], stats: [{ v: '17,127', k: 'indexed declarations' }, { v: '~3,700', k: 'in-house' }, { v: '6', k: 'verified libraries' }, { v: '0', k: 'sorry (FLT core)' }],
      note: 'Verified modulo a named base, audited per declaration.', source: 'design-lab · PROVENANCE.md / index' },
  ],
  subcards: [
    { title: 'Learning Theory · FLT', tag: 'Lean 4', witnesses: harvest([DL], libIs('learning-theory'), 6),
      direction: 'The formalized core of statistical learning theory: the five-way fundamental theorem, VC dimension, compression, PAC-Bayes, and the measurability conditions under which learnability is well defined.' },
    { title: 'Measurements · ZPM', tag: 'Lean 4', witnesses: harvest([DL], libIs('measurements'), 6),
      direction: 'The self-measurement library: divergences and independence criteria (Pinsker, MMD, HSIC, mutual information), Choquet capacity, and concentration.' },
    { title: 'Reinforcement Learning · RLTheory', tag: 'Lean 4', witnesses: harvest([DL], libIs('rl'), 6),
      direction: 'Stochastic approximation and value learning: almost-sure convergence of Q-learning and TD under Markovian sampling, on a shared Lyapunov / Robbins-Siegmund backbone.' },
    { title: 'Neural Networks · TorchLean', tag: 'Lean 4', witnesses: harvest([DL], libIs('neural-networks'), 6),
      direction: 'Certified neural-network execution: typed tensors, a verified graph IR, finite-precision semantics, and generalization certificates that bind to the literal executed program.' },
    { title: 'Causality', tag: 'Lean 4', witnesses: harvest([DL], libIs('causality'), 5),
      direction: 'A Lean-audited inheritance graph of Pearl plus post-2009 extensions, every modern result carried as a conjecture with a tracked proof obligation.' },
    { title: 'Statistics · SLT', tag: 'Lean 4', witnesses: harvest([DL], libIs('statistics'), 4),
      direction: 'The statistical-learning-theory library staged alongside the formalized core.' },
    { title: 'Pure Mathematics', tag: 'reusable', witnesses: harvest([PTL], () => true, 6),
      direction: 'The Mathlib-adjacent pure mathematics the libraries force into existence: analytic-set capacitability, the constructive minimax, sharp inequalities, and the reusable proof-and-theorem library.' },
  ],
};

// ---------- CARD 2 · TLT (substrate) ----------
const tltSubs = cardsOf(TLT).filter(c => c.witnesses && c.witnesses.length)
  .map(c => ({ title: c.title.replace(/^transformer-learning-theory$/, 'Attention routing · foundations'), tag: 'Lean 4', direction: c.direction || '', note: c.note || '', witnesses: c.witnesses }));
// also the design-lab transformers library, as one subcard
tltSubs.push({ title: 'Transformers · TLT (design-lab)', tag: 'Lean 4', direction: 'The transformer library inside the verified corpus.', witnesses: harvest([DL], libIs('transformers'), 6) });
const tlt = {
  order: 101, ingredient: 'substrate', title: 'TLT · Transformer Design Law', repo: 'Zetetic-Dhruv/transformer-learning-theory',
  vis: 'open', author: 'Dhruv Gupta',
  direction: 'A design law for transformers and neurosymbolic systems, proved in Lean 4 over measurability-theoretic foundations. The theory fixes when attention routing is universal, when a configuration is admissible, and it carries a certificate down to the literal IEEE-binary32 program the hardware runs.',
  note: '', witnesses: [], subcards: tltSubs.filter(s => s.witnesses.length),
};

// ---------- CARD 3 · RSI (reasoning) with three subcards ----------
const compressionWit = harvest([ACP], () => true, 6);
const rsi = {
  order: 102, ingredient: 'reasoning', title: 'RSI · Verified Self-Improvement', repo: 'Zetetic-Dhruv/audit-compression-progress',
  vis: 'open', author: 'Dhruv Gupta',
  direction: 'Recursive self-improvement admitted only under a hard verifier: a sealed audit whose reward the agent provably cannot game. Three papers make the guarantee precise, from the progress signal to its anytime certificate to its counterfactual wrapper.',
  note: '', witnesses: [],
  subcards: [
    { title: 'Compression Progress · Goodhart-resistant sealed audit', tag: 'Mittal & Gupta · Lean 4',
      direction: 'Signed compression progress on a sealed audit telescopes to an endpoint difference, so cumulative reward cannot exceed true audit improvement by more than a finite budget. The first faithful compression-progress target.',
      note: 'Co-authored with Ayush Mittal.', witnesses: compressionWit },
    { title: 'PAC-Bayes Self-Modifying', tag: 'preprint',
      direction: 'A PAC-Bayes bound and an anytime-certificate format for self-improving agents, demonstrated on a continually self-improving language agent: the certificate holds at every stopping time, not just in expectation.',
      note: 'Preprint; witness formalization in progress.', witnesses: [] },
    { title: 'Conformal Counterfactuals', tag: 'preprint',
      direction: 'A conformal world-model wrapper with calibrated coverage on counterfactual rollouts: a formalization spec and Lean 4 development plan, with an Atari-100k and DMControl claim package.',
      note: 'Preprint; not yet started in Lean.', witnesses: [] },
  ],
};

// ---------- CARD 4 · WORLD-MODEL THEORY (knowledge) ----------
const wmtOld = cardsOf(WMT)[0] || {};
const wmt = {
  order: 103, ingredient: 'knowledge', title: 'World-Model Theory', repo: 'noumenal-ai/world-model-theory',
  vis: 'open', author: 'Dhruv Gupta',
  direction: wmtOld.direction || 'A specification theory of world models, machine-checked in Lean 4: declare what a latent is for (a target family, a readout budget, a dynamics law) and the theory determines which distinctions the latent must keep, which transitions descend to it, and which representation is forced. Developed across eight arguments, from the readout characterization to a scoped conclusion for JEPA-class systems.',
  note: wmtOld.note || 'Every claim on the companion site is a theorem in Lean 4: noumenal-ai.github.io/world-model-theory.',
  witnesses: wmtOld.witnesses || [], subcards: [],
};

// ---------- write consolidated manifest, remove Dhruv's others ----------
fs.writeFileSync(path.join(MAN, '_dhruv-core.json'),
  JSON.stringify({ noumenal: true, version: 1, repo: 'noumenal-ai/design-lab', cards: [designLab, tlt, rsi, wmt] }, null, 2));

const REMOVE = [DL, PTL, TLT, ACP, WMT,
  'noumenal-ai__shape-of-uncertainty.json', 'Zetetic-Dhruv__tetrad-audit-code.json',
  'Zetetic-Dhruv__First-Proof-Benchmark-Results.json', 'noumenal-ai__TRACES.json',
  'Zetetic-Dhruv__formal-learning-theory-book.json', 'Zetetic-Dhruv__metis.json',
  'Zetetic-Dhruv__world-model-lab.json', 'noumenal-ai__mathesis-bank.json'];
for (const f of REMOVE) if (has(f)) fs.rmSync(path.join(MAN, f));

// extras: drop Conformal (now an RSI subcard); keep any non-Dhruv extra
const exF = path.resolve(HERE, '..', 'data', 'extra-cards.json');
let extras = JSON.parse(fs.readFileSync(exF, 'utf8')).filter(e => !/Conformal|UMTI|PAC-Bayes/i.test(e.title || ''));
fs.writeFileSync(exF, JSON.stringify(extras, null, 2));

console.log('Design Lab subcards:', designLab.subcards.map(s => `${s.title}(${s.witnesses.length})`).join(', '));
console.log('TLT subcards:', tlt.subcards.map(s => `${s.title}(${s.witnesses.length})`).join(', '));
console.log('RSI subcards:', rsi.subcards.map(s => `${s.title}(${s.witnesses.length})`).join(', '));
console.log('removed', REMOVE.filter(has).length, 'manifests; extras now', extras.length);
