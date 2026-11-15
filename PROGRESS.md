# PROGRESS (reprise rapide)
Dernière mise à jour : 15/11/2026 14:55 (Europe/Brussels)

## Fait
- App complète (Vite+Preact+TS, chessground, chess.js, Stockfish 18 lite WASM), toutes les pages + main.tsx + styles.css.
- 43 leçons, 4034 puzzles (Lichess CC0, vérifiés chess.js + Stockfish), 15 ouvertures, 9 bots, 12 finales, 24 badges.
- Freemium (entitlements dev/RevenueCat/Stripe), paywall FR, essai 7 j sur annuel + rappel J-2, zéro pub.
- Tests : vitest 218/218 (lessons, engine-lessons, rules, core). `npm run build` OK.
- E2E : `node tools/e2e.mjs` → desktop Chromium + iPhone 14 Pro WebKit, 0 erreur console. Screenshots dans screenshots/.
  - WebKit marche grâce aux libs extraites dans ~/.local/wklibs, symlinkées dans ~/.cache/ms-playwright/webkit-2388/minibrowser-wpe/lib.
- capacitor.config.ts, server/stripe-checkout.example.mjs (trial_period_days 7).

## Fait aussi (14:55)
- `npx cap add ios` (SPM, Capacitor 8) + icônes/splash (`capacitor-assets`), Info.plist FR, ITSAppUsesNonExemptEncryption=false
- PUBLICATION_IOS.md, codemagic.yaml, README.md, LICENCES.md, LICENSE (GPL-3), public/privacy.html, server/stripe-checkout.example.mjs
- git local (commit a616e49), scripts/deploy-gh-pages.sh (non exécuté : dépôt public = accord explicite requis)
- echecs-app.zip (25 Mo, sans node_modules)
- Tests finaux : vitest 218/218, build OK, e2e 40/40 vérifications, 0 erreur console (Chromium bureau + WebKit iPhone 14 Pro)

## Reste (optionnel)
- Déploiement GitHub Pages après accord : `scripts/deploy-gh-pages.sh maitre-des-echecs`
