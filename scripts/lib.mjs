// Shared helpers: evaluate the page's card data with the REAL template helpers
// (so we compare what the renderer actually sees), and codegen the data block.
import fs from 'node:fs';

// Evaluate the data region of an index.html (old monolithic OR new shells+generated)
// and return the rendered `sections` array exactly as the dc-runtime would build it.
export function evalSections(html) {
  const a = html.indexOf('const spine = [');
  const b = html.indexOf('const jsonText =');
  if (a < 0 || b < 0) throw new Error('data region markers not found');
  const block = html.slice(a, b);
  // real helpers (same as the template) — note W.dia builds a data-URI via svgURI
  const prelude = `
    const W = {
      proof: (o) => ({ isProof:true,  isFigure:false, isEmpirical:false, cell:'', code:'', source:'', ...o }),
      fig:   (o) => ({ isProof:false, isFigure:true,  isEmpirical:false, cell:'', src:'', alt:'', source:'', flag:'', ...o }),
      emp:   (o) => ({ isProof:false, isFigure:false, isEmpirical:true,  cell:'', headline:'', metrics:[], stats:[], note:'', source:'', ...o, hasStats: !!(o.stats && o.stats.length) }),
    };
    const svgURI = (vb, inner) => 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+vb+'" font-family="ui-monospace, monospace">'+inner+'</svg>');
    W.dia = (o) => W.fig({ cell:o.cell||'supporting_argument', n:o.n, claim:o.claim, alt:o.alt||'', flag:o.flag||'', source:o.source, src: svgURI(o.vb, o.svg) });
    const P = (o) => { const w = o.witnesses || []; return { title:'', repo:'', vis:'', status:'', alsoIn:'', direction:'', tbd:false, note:'', ...o, witnesses:w, hasWitness: w.length>0, pending: (o.pending !== undefined ? o.pending : w.length===0) }; };
    const tbd = (o) => P({ tbd:true, pending:true, witnesses:[], ...o });
  `;
  // strip the block's own re-declarations of these helpers to avoid double-decl, keep spine/SECTION_SHELLS/PROJECTS_BY_SECTION/sections
  let body = block
    .replace(/const W = \{[\s\S]*?\n    \};/, '')
    .replace(/const svgURI =[\s\S]*?;\n/, '')
    .replace(/W\.dia = \(o\)[\s\S]*?\}\);\n/, '')
    .replace(/const P = \(o\) => \{[\s\S]*?\};\n/, '')
    .replace(/const tbd = \(o\)[\s\S]*?;\n/, '');
  const fn = new Function(prelude + '\n' + body + '\n; return sections;');
  return fn();
}

const j = (v) => JSON.stringify(v);

const CTOR = { proof: 'W.proof', figure: 'W.fig', diagram: 'W.dia', empirical: 'W.emp' };
function witnessJS(w) {
  const ctor = CTOR[w.type];
  if (!ctor) throw new Error('unknown witness type ' + w.type);
  // emit EVERY field except the internal `type` marker, generically
  const fields = Object.keys(w).filter(k => k !== 'type').map(k => `${k}:${j(w[k])}`).join(', ');
  return `${ctor}({ ${fields} })`;
}

export function cardJS(c) {
  const fn = c.tbd ? 'tbd' : 'P';
  const head = `title:${j(c.title)}, repo:${j(c.repo)}, vis:${j(c.vis)}, status:${j(c.status)}, alsoIn:${j(c.alsoIn||'')}, direction:${j(c.direction||'')}, note:${j(c.note||'')}`;
  if (!c.witnesses || c.witnesses.length === 0) return `${fn}({ ${head} })`;
  const ws = c.witnesses.map(w => '            ' + witnessJS(w)).join(',\n');
  return `${fn}({ ${head}, witnesses:[\n${ws}\n          ] })`;
}

// Lightweight manifest validation (no external deps; mirrors schemas/repo.v1.json essentials).
const INGREDIENTS = new Set(['substrate', 'formalization', 'measurement', 'agents', 'reasoning', 'knowledge']);
const WTYPES = new Set(['proof', 'diagram', 'figure', 'empirical']);
const BANNED = /\b(URT|URS|zetetic|noolog|KK|KU|UK|UU|Pl\/Coh|discovery tetrad)\b/i;
export function validateManifest(m, slug) {
  const errs = [];
  if (m.noumenal !== true) errs.push('noumenal !== true');
  if (m.version !== 1) errs.push('version must be 1');
  if (!Array.isArray(m.cards) || m.cards.length === 0) errs.push('cards must be a non-empty array');
  for (const [i, c] of (m.cards || []).entries()) {
    if (!INGREDIENTS.has(c.ingredient)) errs.push(`card[${i}] bad ingredient ${c.ingredient}`);
    if (!c.title) errs.push(`card[${i}] missing title`);
    if (BANNED.test([c.direction, c.note, c.title].join(' '))) errs.push(`card[${i}] "${c.title}" contains banned in-house vocabulary`);
    for (const [k, w] of (c.witnesses || []).entries())
      if (!WTYPES.has(w.type)) errs.push(`card[${i}].witness[${k}] bad type ${w.type}`);
  }
  return errs;
}

// Map a v2 journal unit -> the dc-runtime card shape (so units render next to v1 cards).
export function unitToCard(u, repoSlug, order) {
  const witnesses = [];
  if (u.proof && (u.proof.code || u.proof.decl)) witnesses.push({
    type: 'proof', cell: u.checks?.accepted ? 'established_result' : 'open_step',
    code: u.proof.code || `theorem ${u.proof.decl} := …`,
    source: `${u.proof.module} ∷ ${u.proof.decl}`, file: u.proof.module, name: u.proof.decl
  });
  const w = u.witness;
  if (w && w.kind && w.kind !== 'none') {
    if (w.kind === 'interval') witnesses.push({ type: 'empirical', cell: 'established_result',
      headline: w.sandbox || 'executed value lands in the certified interval',
      metrics: [], note: `interval [${w.interval?.lo ?? '·'}, ${w.interval?.hi ?? '·'}]${w.interval_decl ? ' via ' + w.interval_decl : ''}`,
      source: w.binding || '' });
    else if (w.kind === 'figure' && w.svg) witnesses.push({ type: 'diagram', cell: 'supporting_argument',
      vb: w.vb, svg: w.svg, claim: u.gloss?.text || '', source: w.binding || '' });
    else if (w.kind === 'empirical') witnesses.push({ type: 'empirical', cell: 'established_result',
      headline: w.headline || '', metrics: w.metrics || [], source: w.binding || '' });
  }
  const open = u.proof?.sorry_free === false;
  return {
    order: 9000 + (order || 0), ingredient: u.ingredient, title: u.title, repo: repoSlug,
    vis: (u.proof?.base?.ffi?.length) ? 'internal' : 'open',
    status: open ? 'open challenge' : (u.tier ? `${u.tier} · ${u.status || 'still-green'}` : 'pending'),
    alsoIn: '', direction: u.gloss?.text || u.statement?.text || '',
    note: u.checks?.accepted ? '' : (open ? 'Open ChallengeCrown — the proof obligation is still live.' : 'Pending CI re-verification.'),
    tbd: open, witnesses,
  };
}

// Build `PROJECTS_BY_SECTION` JS from an ordered list of cards (each has .ingredient).
export function genProjectsBlock(cards, sectionIds) {
  const bySec = Object.fromEntries(sectionIds.map(id => [id, []]));
  for (const c of [...cards].sort((x, y) => x.order - y.order)) {
    (bySec[c.ingredient] ||= []).push(c);
  }
  const parts = sectionIds.map(id => {
    const items = (bySec[id] || []).map(c => '          ' + cardJS(c)).join(',\n');
    return `      ${j(id)}: [\n${items}\n      ]`;
  });
  return `    const PROJECTS_BY_SECTION = {\n${parts.join(',\n')}\n    };`;
}
