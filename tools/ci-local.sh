#!/usr/bin/env bash
# Mêmes étapes que .github/workflows/ci.yml (GitHub Actions), en local. Échoue au premier pas rouge.
# Usage : tools/ci-local.sh [--fresh] [--no-e2e]     STOCKFISH=/chemin/vers/stockfish (Stockfish 17.1 avx2)
set -euo pipefail
cd "$(dirname "$0")/.."
FRESH=""; E2E=1
for a in "$@"; do case "$a" in --fresh) FRESH="--fresh";; --no-e2e) E2E=0;; esac; done
step() { printf '\n▶ %s\n' "$*"; }
step "tsc";              npx tsc --noEmit
step "validate-content"; npx tsx tools/validate-content.mts --jobs=4 $FRESH
step "fichiers générés à jour"; git diff --exit-code -- src/data/accepts.gen.json tools/data/validation-report.json tools/data/validation-cache
step "vitest";           npx vitest run
step "build";            npm run build
if [ "$E2E" = 1 ]; then step "e2e Chromium + WebKit (axe-core inclus)"; node tools/e2e.mjs; fi
printf '\n✔ CI locale verte\n'
