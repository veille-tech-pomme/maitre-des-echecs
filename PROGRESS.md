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
- [x] E2E : 28 vérifications × 2 (Chromium bureau + iPhone 14 Pro WebKit), 0 erreur console
- [x] P1 : sous COOP/COEP (vite dev/preview) crossOriginIsolated=true → stockfish-18-lite multi-thread chargé ; 4 threads ≈ 4,0–4,5 M nœuds/s contre ≈ 0,9 M en mono (×4,4) ; repli mono sans isolation (Capacitor, GitHub Pages) — tools/perf-engine.mjs
- [x] P2 : Lighthouse 12 — mobile : perf 90, accessibilité 87, bonnes pratiques 100, FCP 1,7 s, LCP 2,5 s, TBT 300 ms, CLS 0 ; bureau : perf 100, FCP 0,4 s, LCP 0,6 s, TBT 10 ms ; 159 Kio transférés au premier chargement. Échiquier : 59 fps (p95 17 ms) en émulation iPhone avec CPU ×4 pendant l’analyse — tools/perf-fps.mjs
- [x] Docs : comparaison Chess.com mise à jour dans PUBLICATION_IOS.md
- [x] C : cap sync iOS, zip /workspace/echecs-app/echecs-app.zip (38 Mo, 364 fichiers, sans node_modules/.git/dist/données brutes ; `npm ci && npm run build` régénère dist), commits locaux uniquement (aucun déploiement public)
**Phase 2 terminée.**

# PHASE 3 (15/11) — déploiement public + base de parties de maîtres
- [x] Déploiement approuvé (« oui ») : dépôt public https://github.com/veille-tech-pomme/maitre-des-echecs (GPL-3.0), site https://veille-tech-pomme.github.io/maitre-des-echecs/ (branche gh-pages). Aucun secret dans l'historique (seulement des noms de variables d'environnement).
- [x] Vérif en ligne : HTTP 200 sur /, sw.js, manifest (start_url/scope « ./ »), packs, moteur mono-thread (GitHub Pages ne peut pas envoyer COOP/COEP → pas de multi-thread). E2E contre le site en ligne : Chromium bureau en HTTPS direct ; WebKit iPhone via `tools/live-proxy.mjs` (le WebKit du box n'a pas TLS) → toutes les vérifications OK, 0 erreur console, captures `screenshots/live-*`.
- [x] Base de maîtres : `tools/extract-broadcasts.mjs` (82 mois Lichess Broadcast, CC0, Elo FIDE ≥ 2200 des deux côtés, dédoublonnage, parties de moteurs TCEC/CCC exclues) → 256 295 parties ; `tools/build-explorer.mts` (8 workers) → 110 902 positions (≥ 5 parties, ≤ 30 demi-coups, transpositions fusionnées), 36 435 parties notables ; 512 fragments positions (3,7 Mo au total, ≤ 9 Ko chacun) + 365 fragments parties (8,4 Mo) ; hors précache, CacheFirst + IndexedDB.
- [x] UI : composant MasterStats (Explorateur des ouvertures + page Analyse, bascule « Maîtres ») ; parties notables ouvertes dans l'analyse (`#/analysis?game=ID&ply=N`) ; 3 parties notables gratuites, toutes en Premium.
- [x] Moteur : repli automatique mono-thread si le worker multi-thread échoue (vu une fois sous WebKit).
- [x] Tests : 1 192 OK (dont 9 tests base de maîtres) ; e2e local OK (2 × 30 vérifications).
- [x] Redéployé (gh-pages) et vérifié en ligne : fragments explorer/ servis (200, application/gzip), e2e en ligne 2 × 29 vérifications OK, 0 erreur console (Chromium HTTPS direct ; WebKit iPhone via proxy).
- [x] Mesures en ligne : premier chargement 151 Kio (sans SW) ; ouverture de l'explorateur + stats 167 Kio ; coup suivant ≈ 8 Ko de stats (+ parties notables). Lighthouse mobile : perf 96, accessibilité 87, bonnes pratiques 100, SEO 100 ; FCP 1,6 s, LCP 2,0 s, TBT 180 ms, CLS 0 (le poids total 5,5 Mo vient du précache du service worker après chargement).
- [x] Captures : screenshots/live-iphone-32/34/35/36/37/38-*.png (explorateur + stats, partie de maître, analyse)
**Phase 3 terminée.**

# PHASE 4 (18/11) — refonte UX/UI complète (niveau Apple HIG)
- [x] Audit : UX_AUDIT.md (84 captures « avant » dans screenshots/before/, problèmes classés par gravité)
- [x] Système de design : DESIGN.md + src/css/01…09 (jetons, coquille, surfaces, échiquier, jeu, accueil/apprendre, puzzles/jouer, Moi/paywall/onboarding) ; 113 icônes Lucide (ISC) à la place des emoji
- [x] Coquille 5 onglets (Accueil, Apprendre, Puzzles, Jouer, Moi) + mode focus plein écran (barre d'onglets masquée) pour leçon, partie, puzzle, analyse, entraînements, paywall
- [x] Accueil : une seule action principale (« Continuer »/« Commencer »), plan du jour, raccourcis ; grille 2 colonnes sur bureau
- [x] Échiquier pleine largeur sur mobile, coordonnées lisibles, retour visuel (feedback coloré) + haptique centralisée (sound.ts)
- [x] Onboarding 3 écrans (bienvenue, prénom, niveau) ; paywall honnête (essai 7 j avec frise, ce qui reste gratuit, aucune fonction non livrée annoncée)
- [x] Toutes les pages refaites (leçons, puzzles et modes, jouer/configuration/partie, analyse, bilan, ouvertures, finales, entraînement, révisions, Moi, réglages, confidentialité)
- [x] Critique 1 (iPhone 14 Pro, SE, bureau) : onglets SE, titres, leçon sur petit écran, accueil bureau, bulle du bot, barre d'actions fixe, arrondi de l'échiquier
- [x] Critique 2 (sombre + clair) : barres plus opaques, défilements horizontaux alignés, accueil bureau rééquilibré, choix de couleur visible
- [x] Perf/a11y : écrans secondaires chargés à la demande → 165 Kio au premier chargement ; zoom autorisé, ARIA corrigé, robots.txt. Lighthouse mobile local : perf 93–95, accessibilité 100, bonnes pratiques 100, SEO 100
- [x] Tests : vitest 1 192/1 192 (Stockfish natif /tmp/sf requis pour la validation moteur) ; e2e local 2 × 29 vérifications, 0 erreur console
- [x] Captures après : screenshots/after/{iphone,se,desktop}-NN-*.png
- [x] Redéployé (gh-pages, commit 409b864) : https://veille-tech-pomme.github.io/maitre-des-echecs/ — e2e en ligne 2 × 29 vérifications OK, 0 erreur console (HTTPS direct Chromium bureau + WebKit iPhone 14 Pro, et via tools/live-proxy.mjs)
- [x] Mesures en ligne : premier chargement 157 Kio (sans SW) ; Lighthouse mobile perf 98–99, accessibilité 100, bonnes pratiques 100, SEO 100 (FCP 1,7 s, LCP 1,9 s, TBT 0–10 ms, CLS 0) ; bureau 100/100/100/100
**Phase 4 terminée.**

# PHASE 5 (19/11) — coach expert (cœur de l’app) — voir COACH_ARCHITECTURE.md
- [x] M0 : COACH_ARCHITECTURE.md (pipeline, explications ancrées moteur, Glicko-2 × 26 compétences, curriculum ZPD, UX, LLM futur, évaluation)
- [x] M1 : géométrie + SEE (rayons X) + 20 détecteurs (src/coach/geometry.ts, motifs.ts), vérification sur la ligne du moteur (verifyOnLine), corpus étiqueté 25 coups + 23 cas statiques (tests/coach-motifs.test.ts), benchmark Lichess (tools/bench/motif-bench.mts)
- [x] M2 : score attendu, classification calibrée, moments critiques, moteur d’explication FR + pipeline (Worker)
  - src/coach/{winprob,classify,lang,explain,skills,pipeline,hints,language,worker,client}.ts ; tests/coach-pipeline.test.ts (Stockfish natif)
  - Bench explications (bench/explain-bench.json, 400 gaffes Lichess, SF d12) : 0 affirmation non soutenue / 132 pertes matérielles et 139 mats ; motif cohérent avec l’étiquette Lichess 66 % (borne basse) ; raison spécifique 90 %
  - Commande : `npx -y tsx tools/bench/explain-bench.mts 400`
- [ ] M3 : modèle du joueur (Glicko-2), preuves, curriculum, puzzles personnels, diagnostic
- [ ] M4 : UX (carte coach accueil, bilan mené par le coach, aides en partie, feedback puzzle, écran Mes progrès, test de placement)
- [ ] M5 : benchmark coach, tests, e2e, Lighthouse, captures + critique, déploiement et vérification en ligne
