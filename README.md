# noumenal-scientist

Source of [noumenal-ai.github.io/noumenal-scientist](https://noumenal-ai.github.io/noumenal-scientist/).

The page is the hand-designed version: `index.html` is rendered client-side by
`support.js` (a small React-based runtime that reads the inline `<x-dc>` template and
data). Figures live in `assets/` (and a mirror `current/assets/` so every path in the
design resolves). No build step.

Content is currently static (baked into `index.html`). The data-plumbing layer that
populates project cards from each Noumenal repo's manifest is to be added next.
