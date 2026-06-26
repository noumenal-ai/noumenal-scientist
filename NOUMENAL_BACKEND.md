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

## Local commands

```
node scripts/aggregate.mjs            # regenerate from staged manifests (offline)
node scripts/aggregate.mjs --live     # + discover opt-in repos and pull live proof code (needs gh auth)
node scripts/roundtrip.mjs check      # verify cards still match the golden snapshot
node scripts/extract-manifests.mjs    # (one-time migration) re-derive staged manifests from a monolithic index.html
```
