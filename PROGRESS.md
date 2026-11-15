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

# PHASE 2 (15/11 15:30) — contenu niveau Chess.com + passage PROPRIÉTAIRE
Ordre de travail (cocher au fur et à mesure) :
(15:28 : décision finale = rester GPL-3 avec Stockfish + chessground ; rien de propriétaire n'avait été modifié.)
- [ ] P1 Stockfish multi-thread si crossOriginIsolated (sinon lite single) ; en-têtes COOP/COEP pour preview/serveur
- [ ] P2 Perf : chargement initial léger, packs lazy, 60 fps échiquier, métriques Lighthouse (tools/lighthouse)
- [ ] B1 Puzzles ~50k + packs (chunks gz, IndexedDB), filtres thème/Elo/ouverture, Puzzle Battle, parcours
- [ ] B2 Leçons 150+ en cours (mats nommés, tactiques, ouvertures, milieu de jeu, finales, parties célèbres)
- [ ] B3 Bots 40+ (avatars SVG générés)
- [ ] B4 Explorateur ouvertures Lichess (CC0) + 40+ lignes commentées
- [ ] B5 Finales 80+ (tablebase Lichess vérifiées)
- [ ] B6 Entraînements : coordonnées, vision, mémoire, mats vs ordi, devine le coup
- [ ] C Tests, build, e2e, captures, zip, docs

### Avancement phase 2 (mise à jour)
- [x] B1 packs construits : cœur 50 734 (validés SF prof. 12, 257 rejetés), pack+ partiel (validation en cours) ; routes custom/battle/paths + CSS
- [x] B3 bots : 47 bots (200→3200), avatars SVG générés, groupes, styles, répertoires
- [x] B4 ouvertures : 39 ouvertures / 58 lignes commentées ; explorateur 3 865 lignes nommées FR (eco.json lazy)
- [x] B1 pack+ : validation terminée — 275 430 valides, 606 rejetés (SF prof. 12) ; total 330 198 puzzles (4 034 base + 50 734 cœur + 275 430 pack+)
- [x] B2 leçons : 133 leçons de cours (mats 22, tactique 28, ouvertures 39, stratégie 10, finales 12, parties célèbres 22) + 43 du parcours = 176
- [x] B5 finales : 90 exercices (12 + 78 nouveaux vérifiés tablebase Lichess / Stockfish ; 2 brouillons rejetés)
- [x] B6 entraînement : coordonnées, nomme la case, vision du cavalier, « Rejoue la position », mats contre l’ordinateur, « Devine le coup » (90 parties de champions)
- [x] Tests : 1 183 OK (vitest) ; build OK — commit « phase 2 contenu »
- [ ] P1 vérif multi-thread sous COOP/COEP, P2 Lighthouse, e2e + captures, cap sync, zip, docs
