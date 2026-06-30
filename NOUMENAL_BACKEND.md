# Noumenal site — dynamic backend

The page is a hand-authored **shell** (the door, the LeWitt cube, the Phenomena/Noumena
framework, the six section definitions, the dc-runtime template) with **dynamic project
cards** generated from each repo's manifest. Editing a repo's manifest updates its cards on
the next aggregation. The shell is never regenerated.

## How it works

1. **Opt-in per repo.** A repo appears on the site iff it has a root `noumenal.json` with
   `"noumenal": true`. Schema: [`schemas/repo.v1.json`](schemas/repo.v1.json). A manifest is a
   list of `cards`, each placed in one ingredient section, carrying its research `direction`
   and its `witnesses` (proofs, hand-drawn SVG diagrams, figures, empirical results).
2. **Aggregator** (`scripts/aggregate.mjs`, run by the Action on cron + manual):
   - discovers opt-in repos across `noumenal-ai`, `Zetetic-Dhruv`, `ayushmi`;
   - validates each manifest (`scripts/lib.mjs` → `validateManifest`, incl. an in-house-jargon scrub);
   - for **PUBLIC** repos, replaces each proof witness's code with the **live** declaration
     pulled from the real `.lean` (using the witness `file` + `name`), confirming the
     declaration actually exists — a witness can never drift from the theorem;
   - for **PRIVATE** repos, keeps the curated snippet and marks it `private` (card yes, live code no);
   - regenerates `PROJECTS_BY_SECTION` between the `<<<GEN-PROJECTS … GEN-PROJECTS>>>`
     sentinels in `index.html`, commits if changed, Pages redeploys.
3. **Round-trip gate** (`scripts/roundtrip.mjs`): the regenerated cards must deep-equal the
   golden render. Used to prove the refactor was lossless; re-snapshot with `snap` after an
   intended content change.

## Installing the Action (one-time)

The workflow ships at [`ops/aggregate.workflow.yml`](ops/aggregate.workflow.yml) rather than
`.github/workflows/` because the push token here lacks GitHub's `workflow` scope. To activate
it: copy that file to `.github/workflows/aggregate.yml` (via the GitHub web UI → Add file, or
a push from a token with `workflow` scope). It then runs on cron + the manual "Run workflow"
button.

## The one secret to add (for private repos)

The Action falls back to `GITHUB_TOKEN`, which reads only this repo + public repos. To pull
manifests/validate witnesses from the **private** programme repos (design-lab, metis,
shape-of-uncertainty, TRACES, noumenal_agent), add a repo secret:

- **`GH_AGGREGATOR_TOKEN`** — a fine-grained PAT (or GitHub App installation token) with
  `contents: read` on the contributing repos across `noumenal-ai` and `Zetetic-Dhruv`.

Settings → Secrets and variables → Actions → New repository secret. Without it, public repos
still work; private repos simply won't refresh until the token is present.

## Authoring a repo's `noumenal.json`

Minimal example (a public repo, one card, one live-pulled proof):

```json
{
  "noumenal": true,
  "version": 1,
  "repo": "Zetetic-Dhruv/audit-compression-progress",
  "cards": [
    {
      "ingredient": "measurement",
      "order": 6,
      "title": "Compression Progress",
      "repo": "Zetetic-Dhruv/audit-compression-progress",
      "vis": "open",
      "status": "open",
      "direction": "A path-independent progress meter: cumulative compression progress telescopes to the endpoint difference, so relabelling, splitting, or padding cannot move it.",
      "witnesses": [
        { "type": "proof",
          "cell": "established_result",
          "file": "AuditCP/Telescope.lean",
          "name": "cumCP_telescope",
          "code": "theorem cumCP_telescope {ι : Type*}\n    (E : ι → ℝ) (g : ℕ → ι) (T : ℕ) :\n    cumCP E g T = E (g 0) - E (g T)",
          "source": "audit-compression-progress/AuditCP/Telescope.lean ∷ cumCP_telescope" }
      ]
    }
  ]
}
```

For a PUBLIC repo, `file` + `name` make the `code` self-healing (pulled live). For PRIVATE
repos, omit `file`/`name` and the `code` snippet is shown as-is, marked private. SVG diagram
witnesses use `{ "type":"diagram", "vb":"0 0 W H", "svg":"<rect …/>…", "claim":"…", "source":"…" }`.

## Rollout

Current state: every existing card is staged under `data/manifests/*.json` (extracted
losslessly from the original hand-built page). To hand ownership to a repo, copy its staged
manifest to that repo's root as `noumenal.json` (adding `file`/`name` to proof witnesses for
public repos). The aggregator then prefers the repo's published copy over the staged one.

## The Verified ML Journal layer (v2 units)

A `noumenal.json` can be a v1 card list (above) or a v2 **unit** list. A unit is the journal's
citable atom: a `(statement, proof, witness)` triple. It is **ACCEPTED** only when three checks
pass together — **PROOF** (the Lean kernel checks the proof), **FAITHFULNESS** (a human-certified
gloss), **WITNESS** (the executed value lands inside a kernel-certified interval). **Tier** (T0 →
T1 → T2) is *derived*, never declared, and re-derived by CI. Schema:
[`schemas/unit.v2.json`](schemas/unit.v2.json). The aggregator renders v1 cards and v2 units
together; the round-trip gate is unchanged.

**Substrate exception (by design).** The proof leg and the witness leg carry **two independent
dependency closures**, each terminating in its own named trust base. There is no shared-substrate
edge joining experiment to theory: a contributor may bring a theory verified on their Lean and an
experiment certified in their own sandbox. This is what keeps the format open rather than forcing
every repo onto one substrate. The validator rejects any unit-level `substrate`/`shared_closure`.

**How structure is preserved without dictating repo layout.** Structure is enforced by
*verification*, not by file format. (1) The **staging skill** generates the manifest from a repo
in any layout. (2) **CI re-runs the three checks** against the real artifacts; the tier is derived,
so nobody can inflate it. Repo layout is free; the triple + three checks + named base + derived
tier are invariant.

## The staging skill (for contributors)

`skills/stage-journal-unit/` is a Claude Code skill a contributor runs in their own repo to stage a
result into the journal: discover the unit → kernel-check the proof and audit axioms
(`#print_axioms`) → run the witness against its interval → draft the gloss → **derive** the tier →
emit a v2 `noumenal.json` → opt in. It is honesty-enforcing: a hidden `sorry` is staged as an open
ChallengeCrown, never as accepted; the base is named, not hidden.

- Shipped in this repo (clone and invoke `/stage-journal-unit`), AND installable standalone:
  `curl -fsSL https://raw.githubusercontent.com/noumenal-ai/noumenal-scientist/main/skills/stage-journal-unit/install.sh | bash`
- Contributors add [`ops/verify-unit.workflow.yml`](ops/verify-unit.workflow.yml) to their repo's
  `.github/workflows/` for the authoritative CI gate (the journal aggregator re-checks too).
- Validate/derive locally: `node skills/stage-journal-unit/lib/stage.mjs check noumenal.json`.

## Local commands

```
node scripts/aggregate.mjs            # regenerate from staged manifests (offline)
node scripts/aggregate.mjs --live     # + discover opt-in repos and pull live proof code (needs gh auth)
node scripts/roundtrip.mjs check      # verify cards still match the golden snapshot
node scripts/extract-manifests.mjs    # (one-time migration) re-derive staged manifests from a monolithic index.html
```
