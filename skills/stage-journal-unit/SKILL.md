---
name: stage-journal-unit
description: >-
  Stage a result from THIS repo into the Noumenal Verified ML Journal. Use when a contributor
  wants to submit, stage, or publish a Lean result (a theorem + optional executable witness) to
  the journal / the Noumenal site, or asks "how do I add my repo / my theorem to Noumenal", "stage
  this for the journal", "make a noumenal.json", or "submit this unit". Produces a verified
  noumenal.json (schema unit.v2) and opts the repo in. Honesty-enforcing: it derives the tier and
  the trust base from the real artifacts and refuses to stamp an unproven result as accepted.
---

# Stage a journal unit

You are helping a contributor stage a result into the **Verified ML Journal**. The citable atom is
a `(statement, proof, witness)` triple. A unit is **ACCEPTED** only when three independent checks
pass together: **PROOF** (the kernel checks the proof), **FAITHFULNESS** (a human-certified gloss
says the theorem means what the prose claims), and **WITNESS** (the executed value lands inside a
kernel-certified interval). Tier (T0/T1/T2) is **derived from what is actually true**, never
declared. The schema is `unit.v2.json`.

Two rules that govern everything you do here:
- **Never inflate.** You report what the artifacts prove, not what the author hopes. A hidden
  `sorry` is staged as an open ChallengeCrown, not as an accepted unit. The tier you write is the
  tier the checks earn.
- **Name the base.** Every leg is "verified modulo a named base": the Lean kernel, the axioms it
  actually uses (`#print_axioms`), the pinned Mathlib, and any FFI/oracle boundaries. You enumerate
  it; you do not hide it.

**Substrate exception (important).** The proof leg and the witness leg are INDEPENDENT. Each has its
own dependency closure and its own named base. Do **not** force the experiment onto the same
substrate as the theory, and do not write a shared-substrate link between them. A contributor may
bring a theory verified on their Lean and an experiment certified in their own sandbox.

## The sequence

Work through these steps with the contributor. Run real commands; do not guess outputs.

### 1. Discover the unit
Find the candidate in the repo: the Lean module, the headline declaration (the `statement` + its
`proof` term), and any executable witness (an `interval`-membership theorem + the binding that runs
it). If the declaration's body is `sorry`, this is an open **ChallengeCrown** — stage it as such
(`sorry_free: false`, no tier), not as accepted. Ask the contributor which declaration is the unit
if it is ambiguous.

### 2. Run the PROOF check (kernel) and derive the base
- Build the module: `lake build` (or `lake env lean <file>`). It must succeed with no `sorry`.
- Audit axioms on the exact declaration: `#print_axioms <decl>` (via `lake env lean` on a tiny
  script, or read it from the build). Record the axiom list as `proof.axiom_manifest`.
- Record `proof.base`: `kernel` (the Lean version from `lean-toolchain`), `axioms` (the whitelist
  actually used), `mathlib` (the pinned commit/toolchain), and any `ffi` boundaries.
- If the only axioms are `propext`, `Classical.choice`, `Quot.sound` and there is no FFI, this is a
  kernel-clean base. If more are present, list them — named, not hidden.

### 3. Run the WITNESS check (sandbox), if there is one
- If a witness exists: run it and confirm the executed value lands inside the interval the
  `interval_decl` theorem certifies. "Match" means interval-membership, never bit-exact.
- Record `witness.kind` (`interval` for the strong case; `figure`/`empirical` for softer evidence;
  `none` if there is no witness), the `binding`, `interval_decl`, `interval`, `sandbox`, and the
  witness's OWN `base` and `closure` (separate from the proof's).

### 4. Draft the FAITHFULNESS gloss
Write `gloss.text`: one short paragraph, standard vocabulary, saying what the theorem actually
means. Leave `gloss.certified_by: null` — the editor certifies it, the author only drafts. No gloss,
no DOI.

### 5. Derive the tier (do not let the author pick it)
- **T0** = proof check passes (sorry-free, axiom-audited), no witness.
- **T1** = T0 + a witness that runs (`witness.kind != none` and it executed).
- **T2** = T1 + the executed value lands in the certified interval on held-out inputs.
Set `checks` to your local pre-check result; CI re-verifies authoritatively before ACCEPTED.

### 6. Emit `noumenal.json` and self-verify
- Build the manifest with `node skills/stage-journal-unit/lib/stage.mjs` (it assembles the unit,
  derives `tier`/`checks.accepted`, and validates against `schemas/unit.v2.json`).
- Place it at the repo root as `noumenal.json` with `"noumenal": true`, `"version": 2`.
- Show the contributor the unit: its tier, its named base, what is still open. Confirm the prose is
  standard vocabulary (no in-house jargon: URT, URS, KK/KU, "discovery tetrad", etc.).

### 7. Opt in
On the contributor's go-ahead, commit `noumenal.json`. The journal aggregator (cron + manual)
discovers any repo with `noumenal: true`, RE-RUNS the three checks authoritatively, pulls live proof
code for public repos, and renders the unit. CI is the gate; your local run is the honest draft.

## If you are blocked
- No Lean toolchain locally: derive everything you can statically (statement, gloss, base from
  `lean-toolchain` + `lakefile`), set `checks.* : "pending"`, and let CI run the proof/witness. Say
  plainly that the unit is unverified-pending, not accepted.
- The proof has a `sorry`: stage it as an open ChallengeCrown (a bounty), honestly. That is content,
  not a failure to hide.
- The witness does not land in the interval: the unit is T0 (or the interval/claim is wrong). Report
  the gap; do not widen the interval to force a pass.
