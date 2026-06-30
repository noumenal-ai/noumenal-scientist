#!/usr/bin/env bash
# Install the Noumenal "stage-journal-unit" skill into your Claude Code, standalone
# (no need to clone the journal repo).
#
#   curl -fsSL https://raw.githubusercontent.com/noumenal-ai/noumenal-scientist/main/skills/stage-journal-unit/install.sh | bash
#
set -euo pipefail
RAW="https://raw.githubusercontent.com/noumenal-ai/noumenal-scientist/main/skills/stage-journal-unit"
DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}/stage-journal-unit"
mkdir -p "$DEST/lib"
curl -fsSL "$RAW/SKILL.md"        -o "$DEST/SKILL.md"
curl -fsSL "$RAW/lib/stage.mjs"   -o "$DEST/lib/stage.mjs"
echo "Installed stage-journal-unit -> $DEST"
echo "In your repo, run Claude Code and invoke /stage-journal-unit (or ask to 'stage this for the Noumenal journal')."
