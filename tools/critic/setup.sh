#!/bin/sh
# Idempotent: clones the two reference games into agent-tools/refs/ (gitignored) if missing.
# Usage: sh tools/critic/setup.sh          (from anywhere)
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REFS="$ROOT/agent-tools/refs"
mkdir -p "$REFS" "$ROOT/agent-tools/critic-out"

clone() { # url dir
  if [ -d "$REFS/$2/.git" ]; then
    echo "ok: $REFS/$2 ($(git -C "$REFS/$2" rev-parse --short HEAD))"
  else
    git clone --depth 1 "$1" "$REFS/$2"
  fi
}
clone https://github.com/jgmize/paperclips paperclips
clone https://github.com/doublespeakgames/adarkroom adarkroom

test -f "$REFS/paperclips/docs/index2.html" || { echo "missing paperclips/docs/index2.html" >&2; exit 1; }
test -f "$REFS/adarkroom/index.html" || { echo "missing adarkroom/index.html" >&2; exit 1; }
if [ ! -d "$ROOT/tools/node_modules/playwright-core" ]; then
  (cd "$ROOT/tools" && npm install --no-audit --no-fund)
fi
echo "setup ok"
