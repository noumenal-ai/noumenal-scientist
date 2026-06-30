// stage.mjs — assemble/validate a journal unit (schema unit.v2). Used by the
// staging skill (local honest draft) and by CI (authoritative re-verify).
// Derives tier + accepted from the checks; never trusts a declared tier.
import fs from 'node:fs';

const WHITELIST = new Set(['propext', 'Classical.choice', 'Quot.sound']);
const BANNED = /\b(URT|URS|zetetic|noolog|KK|KU|UK|UU|discovery tetrad)\b/i;

// Tier is a FUNCTION of what is actually true, never a claim.
export function deriveTier(u) {
  const proofOK = u.proof && u.proof.sorry_free === true;
  if (!proofOK) return null; // open ChallengeCrown, not a tier
  const w = u.witness || { kind: 'none' };
  if (w.kind === 'none') return 'T0';
  if (w.kind === 'interval') {
    // T2 only if the interval-membership theorem is named AND the check passed
    const inInterval = u.checks && u.checks.witness === 'pass' && w.interval_decl;
    return inInterval ? 'T2' : 'T1';
  }
  return 'T1'; // figure/empirical witness that runs
}

export function deriveAccepted(u) {
  const c = u.checks || {};
  const proof = c.proof === 'pass';
  const faith = c.faithfulness === 'pass';
  const tier = u.tier || deriveTier(u);
  const witness = tier === 'T0' ? true : c.witness === 'pass';
  return proof && faith && witness;
}

export function validateUnit(u) {
  const e = [];
  if (!u.id) e.push('missing id');
  if (!u.title) e.push('missing title');
  if (!['substrate', 'formalization', 'measurement', 'agents', 'reasoning', 'knowledge'].includes(u.ingredient))
    e.push(`bad ingredient ${u.ingredient}`);
  if (!u.statement?.text || !u.statement?.decl) e.push('statement needs text + decl');
  if (!u.proof?.module || !u.proof?.decl) e.push('proof needs module + decl');
  if (u.proof && !Array.isArray(u.proof.axiom_manifest)) e.push('proof.axiom_manifest must be a list (from #print_axioms)');
  if (!u.proof?.base) e.push('proof.base (named trust base) required');
  if (!u.gloss?.text) e.push('gloss.text required (author drafts; no gloss, no DOI)');
  // substrate exception: the two legs must not be cross-linked through a shared substrate field
  if (u.substrate || u.shared_closure) e.push('substrate exception: no unit-level substrate / shared_closure; proof.closure and witness.closure are independent');
  // honesty: a tier present must equal the derived tier
  const dt = deriveTier(u);
  if (u.tier && dt && u.tier !== dt) e.push(`declared tier ${u.tier} != derived ${dt} (tier is derived, not declared)`);
  // jargon scrub on public prose
  if (BANNED.test([u.title, u.statement?.text, u.gloss?.text].join(' '))) e.push('in-house jargon in public prose');
  // base honesty: flag any axiom outside the kernel-clean whitelist (named, not hidden)
  const extra = (u.proof?.axiom_manifest || []).filter(a => !WHITELIST.has(a));
  return { errors: e, extra_axioms: extra, derived_tier: dt, accepted: deriveAccepted(u) };
}

// CLI: `node stage.mjs build <draft.json> <out.json>`  |  `node stage.mjs check <noumenal.json>`
const [, , cmd, a, b] = process.argv;
if (cmd === 'build') {
  const draft = JSON.parse(fs.readFileSync(a, 'utf8'));
  const units = (draft.units || [draft]).map(u => {
    u.tier = deriveTier(u);
    u.checks = { ...(u.checks || {}), accepted: deriveAccepted(u) };
    return u;
  });
  const man = { noumenal: true, version: 2, repo: draft.repo, units };
  for (const u of units) { const v = validateUnit(u); if (v.errors.length) console.error(`unit ${u.id}: ${v.errors.join('; ')}`); }
  fs.writeFileSync(b || 'noumenal.json', JSON.stringify(man, null, 2));
  console.log(`wrote ${b || 'noumenal.json'}: ${units.length} unit(s); tiers ${units.map(u => u.tier || 'open').join(', ')}`);
} else if (cmd === 'check') {
  const man = JSON.parse(fs.readFileSync(a, 'utf8'));
  let bad = 0;
  for (const u of man.units || []) {
    const v = validateUnit(u);
    const tag = v.accepted ? `ACCEPTED ${u.tier}` : (u.proof?.sorry_free === false ? 'OPEN ChallengeCrown' : 'PENDING');
    console.log(`  ${u.id}: ${tag}${v.extra_axioms.length ? '  [base also uses: ' + v.extra_axioms.join(', ') + ']' : ''}`);
    if (v.errors.length) { bad++; console.log('     ! ' + v.errors.join('\n     ! ')); }
  }
  process.exit(bad ? 1 : 0);
}
