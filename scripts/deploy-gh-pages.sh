#!/usr/bin/env bash
# Publie dist/ sur GitHub Pages (dépôt PUBLIC — à lancer uniquement avec l'accord du propriétaire).
# Usage : scripts/deploy-gh-pages.sh <nom-du-depot>   (nécessite `gh auth login`)
set -euo pipefail
REPO="${1:-maitre-des-echecs}"
cd "$(dirname "$0")/.."
npm run build
OWNER=$(gh api user -q .login)
gh repo view "$OWNER/$REPO" >/dev/null 2>&1 || gh repo create "$REPO" --public --source=. --remote=origin --description "Maître des Échecs — apprendre les échecs (PWA, GPL-3.0)" --push
git push -u origin HEAD:main
TMP=$(mktemp -d); cp -r dist/. "$TMP"; touch "$TMP/.nojekyll"
( cd "$TMP" && git init -q -b gh-pages && git add -A && git commit -qm "Déploiement $(date -u +%FT%TZ)" && git push -f "https://github.com/$OWNER/$REPO.git" gh-pages )
gh api -X POST "repos/$OWNER/$REPO/pages" -f "source[branch]=gh-pages" -f "source[path]=/" >/dev/null 2>&1 || true
echo "URL : https://$OWNER.github.io/$REPO/"
