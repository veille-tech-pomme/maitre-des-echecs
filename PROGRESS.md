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
- [x] M3 : modèle du joueur (Glicko-2), preuves, curriculum, puzzles personnels, diagnostic
  - src/coach/{model,curriculum,diagnostic}.ts ; State.coach + State.coachQ (file d’évènements, pushCoach) ; hooks recordPuzzle / leçons / finales ; SRS kind 'mistake'
  - Bench joueurs simulés (bench/reco-bench.json, 200 joueurs) à 160 puzzles : faiblesse détectée 93 %, top-3 86 %, plan qui la cible 78 %, puzzles dans la zone 60–90 % : 67 %, RMSE 115 ; à 320 puzzles : 98 % / 96 % / 88 % / 76 %, RMSE 89. Test de placement (6 items, a posteriori bayésien) : erreur moyenne ≈ 130.
  - Commande : `npx -y tsx tools/bench/reco-bench.mts 200`
- [x] M4 : UX (carte coach accueil, bilan mené par le coach, aides en partie, feedback puzzle, écran Mes progrès, test de placement)
  - Accueil : carte « Ton coach » (chargée à la demande, squelette) juste sous la leçon en cours ; sur bureau, colonne de droite.
  - Bilan : résumé conscient du résultat (abandon, nulle, mat), 3 leçons reliées à une activité, rejouer les moments clés, ligne de réfutation Premium.
  - Partie : indices gradués (Menaces → Idée → Coup) avec flèches, explication vérifiée du dernier coup.
  - Puzzles : « Pourquoi ça ne marche pas » sans divulguer la solution.
  - #/coach (radar 6 familles, forces, faiblesses avec preuves, objectifs de la semaine), #/coach/test (test bayésien 6 positions), #/review/mistakes (erreurs de partie en répétition espacée).
  - Play et Puzzles chargés à la demande : 1er chargement 155 Kio (174 avant).
  - e2e local : 2 × 32 vérifications, 0 erreur console.
- [x] M5 : benchmark coach, tests, e2e, Lighthouse, captures + critique, déploiement et vérification en ligne
  - [x] bench/coach-bench.json (motifs, explications, recommandations, temps de bilan navigateur + i/s)
  - [x] vitest 1256/1256 ; e2e local 2 × 32, 0 erreur console ; 1er chargement 155 Kio
  - [x] captures screenshots/coach/ (profil de démo : tools/coach-seed.mts + tools/coach-shots.mjs)
  - [x] déployé (87fc46e) ; e2e en ligne 2 × 32, 0 erreur ; Lighthouse en ligne mobile 99/100/100/100, bureau 100 × 4 ; 1er chargement en ligne 145 Kio ; bilan 25 demi-coups 6,4 s à 59 i/s (mono-thread)

# PHASE 6 (19/11) — coach : limites levées (sur l’appareil, sans LLM)
- [x] M6 : thèmes lus sur la ligne entière (src/coach/themes.ts) : clouage, enfilade, rayons X, déviation, attraction, surcharge, élimination du défenseur, pièce piégée, pièce en prise (défense en rayons X), mat du couloir, découvertes
  - Bench 14 434 puzzles (bench/theme-bench.json, `npx -y tsx tools/bench/theme-bench.mts 400`), accord avec l’étiquetage Lichess — avant (détecteur coup par coup) → après :
    clouage rappel 0,31→1,00 / précision 0,47→0,99 ; enfilade 0,92/0,55→1,00/1,00 ; pièce en prise 0,67/0,23→0,90/1,00 ; fourchette 0,65/0,74→1,00/0,98 ;
    découverte 0,84/0,59→0,99/0,98 ; pièce piégée 0,86/0,96→0,99/1,00 ; mat du couloir 1,00/0,48→1,00/1,00 ; déviation —→1,00/0,91 ; attraction —→1,00/1,00 ; rayons X —→1,00/1,00 ; élimination du défenseur 0,68/0,21→0,71/0,63
  - Explications (400 gaffes Lichess, SF d12) : tactique nommée quand le puzzle en contient une 28 %→59 % ; accord du motif annoncé 66 % (41)→70 % (81) ; toujours 0 affirmation non soutenue ; chaque thème doit expliquer la pièce réellement perdue
  - tests/coach-themes.test.ts (surcharge ±, clouage ±, enfilade ±, rayons X défensifs, pièce piégée)
- [x] M7 : raisons stratégiques (src/coach/strategy.ts) — « la menace d’abord » (menace de mat après la réponse, série d’échecs, matériel perdu plus loin dans la ligne avec sa pointe, pion passé qui file), attribution par termes d’évaluation (sécurité du roi : trous, colonnes ouvertes, attaquants ; structure : isolé/doublé/arriéré/passé, seulement si la faiblesse persiste dans la ligne ; activité : avant-postes, cavalier au bord, mauvais fou, colonnes, cases sûres ; développement ; espace), prophylaxie (la réponse clé empêchée par le meilleur coup), plans de structures types (pion isolé, Carlsbad, chaîne française, chaîne est-indienne, roques opposés)
  - Bench positionnel (tools/bench/positional-bench.mts, corpus annoté à la main tools/bench/positional-corpus.ts, SF d16, fautes tactiques exclues automatiquement) : catégorie juste 25 %→81 % (16 cas de dév.), repli générique 50 %→12,5 % ; jeu tenu à l’écart (annoté avant exécution) 3/4→4/4 — échantillon minuscule, voir limites
  - Explications 400 gaffes : raison spécifique 90 %→94,8 %, tactique nommée 59 %→63 %, toujours 0 affirmation non soutenue ; correctif : la trace de matériel ne s’arrête plus au milieu d’un échange (faux « tu pouvais gagner un fou »)
  - tests/coach-strategy.test.ts
- [x] M8 : faiblesses par a posteriori hiérarchique (Bayes empirique : compétence ~ N(μ famille, 150²), μ famille ~ N(note globale, 90²)), classement par probabilité a posteriori que l’écart dépasse 100 points ; curriculum et radar sur les mêmes a posteriori
  - Joueurs simulés (200, `npx -y tsx tools/bench/reco-bench.mts 200`, bench/reco-bench.json ; avant : bench/reco-bench.before-m8.json) — à 160 puzzles : faiblesse n°1 59 %→66 %, top 3 86,5 %→90 %, détectée 93 %→97,5 %, plan qui la vise 78,5 %→80,5 %, puzzles en zone 60–90 % 67 %→81 %, RMSE des compétences 115→94 ; à 80 puzzles : n°1 46 %→49,5 %, top 3 68 %→75 %
  - Test de placement : a priori = niveau déclaré à l’accueil (σ 300) ou note puzzle établie (σ 200), longueur adaptative 6→8 positions (arrêt si σ < 125) : erreur absolue moyenne 132→94 (dont 116 sans niveau déclaré)
- [x] M9 : bilan rapide sur téléphone — coups de théorie (base d’ouvertures) en recherche minimale, premier passage à profondeur −3 avec résultats progressifs (les coups commentés s’affichent pendant l’analyse), second passage à pleine profondeur seulement sur les positions critiques, cache d’analyses par position (mémoire, LRU 600)
  - Mesure sous ralentissement 4× de tout le navigateur, moteur mono-thread (bench/review-speed.json, tools/tmp/review-throttle.mjs) : premiers coups commentés 7,4–32,6 s→2,5–3,1 s ; bilan complet 80 demi-coups 32,8→23,8 s, 25 demi-coups 26,8→12,6 s, 18 demi-coups 7,6→3,2 s
  - Fidélité (bench/adaptive-bench.json, SF natif) : 99,3 % des classifications et 100 % des explications identiques au bilan complet à profondeur 14 (137 coups)
- [x] Validation v2 et déploiement (19/11) : 1 268 tests verts, e2e local et en ligne sans échec ni erreur console, Lighthouse en ligne mobile 99/100/100/100 et ordinateur 100/100/100/100, premier chargement 156 KiB ; en ligne à 4× : premiers coups commentés en 2,5–3,1 s, partie de 80 demi-coups en 23,8 s

# PHASE 7 (19/11) — rétention : le coach devient le fil « Pour toi » (brief retention/brief-retention-maitre-des-echecs.md, priorités 1 à 3)
- [x] R0 : API du coach `nextFeedCards()` (src/coach/feed.ts), sans changement visible
  - Classement = curriculum existant : gain des puzzles ciblés = importance × écart × zone proximale × nouveauté (activities), erreurs dues en répétition espacée (positions de tes parties puis puzzles ratés) en tête, « quelle est la menace ? » (vigilance), « coup du maître » (calcul), mini-étape de la leçon en cours
  - Diversité (pas deux fois le même type d'affilée, sauf puzzles ; pas la même compétence sur 2 cartes), nouveauté (0,5–0,7 par répétition), préchargement pris en compte (`pending`), fin quotidienne DAILY_CARDS = 12
  - Signaux : RawEvent `feed` (réussite/échec des cartes non-puzzle → observation Glicko poids 0,6, réussite lente > 45 s = 0,8 ; passe = observation négative poids 0,2 ; abandon > 10 s = 0,3 ; geste < 2 s ignoré), statistiques par type (passes, abandons, temps) → pénalité apprise `kindFactor` ; les passes n'entrent pas dans les preuves (« X réussites sur tes N derniers puzzles »)
  - Cartes moteur pré-calculées (tools/build-feed-cards.mts, Stockfish natif) : 513 « coups du maître » (90 grandes parties classiques + 423 parties notables de la base explorer, coup unique : écart ≥ 150 cp à profondeur 18, raison : mat / gain / motif / seul coup) ; 608 « quelle est la menace ? » (puzzles Lichess CC0 : coup calme adverse, menace unique au coup nul, 2 leurres légaux)
  - tests/coach-feed.test.ts (14) : variété, fin du jour, préchargement, erreurs en tête, faiblesse prioritaire, passes, abandons, preuves, légalité des 1 121 cartes
- [x] R1 : onglet « Pour toi » (src/pages/Feed.tsx, chargé à la demande) à la place de l'accueil
  - Cartes plein écran : puzzle court / mat en 1 (≤ 2 coups à jouer), quelle est la menace ? (3 choix), trouve le coup du maître, rejoue ta gaffe (SRS), mini-leçon ; réussite → carte suivante seule (450 ms ; 3,8 s pour lire la révélation des cartes maître/menace, bouton « Suivant » pour aller plus vite) ; « Passer » ou balayage vers le haut ; « Pourquoi ? » discret = phrase du coach + preuve ; seule la carte N+1 est préparée ; écran de fin « C'est tout pour aujourd'hui » + « Demain, je te garde … »
  - Onglets : Pour toi / Apprendre / Jouer / Moi (Puzzles supprimé ; Apprendre : leçon en cours, entrée « Puzzles » vers classés, du jour, contre la montre, révisions, parcours, sur mesure) ; Moi : niveau, carte du coach, « Mes progrès » (radar, objectifs)
  - Rien n'est chargé tant que l'accueil est affiché ; packs de puzzles et cartes moteur à la demande (hors ligne via IndexedDB / SW)
  - Mesures locales : vitest 1 282/1 282 ; e2e 2 × 37 (bureau Chromium + iPhone WebKit), 0 erreur console ; 1er chargement 161 KiB ; Lighthouse mobile 97/100/100/100
  - **En ligne (19/11 20:00, heure de Bruxelles)** — https://veille-tech-pomme.github.io/maitre-des-echecs/ (main 703ee32, gh-pages 03d5d42) : e2e en ligne bureau + iPhone 0 échec, 0 erreur console ; 1er chargement 151 KiB ; Lighthouse mobile 100/100/100/100 (FCP 1,1 s, LCP 1,5 s, TBT 0 ms, CLS 0). Note : « Maximum call stack size exceeded » intermittent seulement dans WebKit local (moteur bloqué par « access control checks »), jamais en e2e ni en ligne.
- [x] R2 : accueil en moins de 15 s, diagnostic unique dans le fil
  - Accueil en 2 écrans (src/pages/Onboarding.tsx) : prénom facultatif → premier mat gagnant (mat du berger, Dxf7#) ; indice après une erreur, flèche après deux ; +10 XP immédiat et phrase du coach, puis Pour toi (enchaînement seul en 4,2 s)
  - Plus de niveau déclaré ni de redirection vers #/lesson/d-echiquier ; plus de test de niveau séparé
  - Diagnostic unique (coach/diagnostic.ts + coach/feed.ts) : le mat de l'accueil (item 600, faible) + les 4 premières cartes du fil (« Découverte », une tentative, « Je ne sais pas » = réponse), adaptatives (a posteriori bayésien, départ 900 ± 450, pas de préchargement) ; à la fin : note de départ → m.diag, observations Glicko par compétence (src 'diag'), classement puzzle, ouverture du parcours au niveau mesuré (≥ 1150 intermédiaire, ≥ 1550 avancé) ; carte de résultat « niveau de départ … ± … »
  - Joueur déjà classé (≥ 10 puzzles) ou diagnostic fait : pas de cartes Découverte. #/coach/test = bilan du diagnostic (retour « Mes progrès »), ou renvoi au fil s'il reste à faire
  - Précision (banc simulé, 120 joueurs) : erreur moyenne 166 points pour mat + 4 cartes, contre 119 pour l'ancien test de 6 à 8 positions ; l'incertitude (± ~180) est ensuite resserrée par chaque carte du fil
  - Échiquier : chessground remesure sa position avant chaque toucher et à la fin des animations (cartes qui entrent) ; « Voici la solution » au lieu de « Bravo » quand la solution a été montrée
  - Bizarrerie du clic sur un coup du maître (captures R1) : non reproduite en 96 essais ciblés (48 avant, 48 après le correctif, clic 150 ms ou 1,3 s après l'apparition) ; correctif défensif ci-dessus conservé
  - Mesures locales : vitest 1 286/1 286 ; e2e bureau + iPhone 0 échec, 0 erreur console, premier succès 1,0 s (bureau) et 1,4 s (iPhone) chargement compris ; 1er chargement 152 KiB ; Lighthouse mobile 98/100/100/100
  - **En ligne (19/11 20:45, heure de Bruxelles)** — https://veille-tech-pomme.github.io/maitre-des-echecs/ (main d387c48, gh-pages 6769db0) : e2e en ligne bureau + iPhone 0 échec, 0 erreur console, premier succès 1,4 s / 1,5 s chargement compris ; 1er chargement 148 KiB ; Lighthouse mobile 100/100/100/100 (FCP 1,1 s, LCP 1,5 s, TBT 0 ms, CLS 0)
- [x] R3 : plus de cul-de-sac (chaque écran propose la suite, en un geste ou tout seul)
  - Composant `AutoNext` (components/ui.tsx) : bouton qui se remplit puis part seul (minuteur suspendu quand l'onglet est caché), compte à rebours facultatif, « Rester ici » pour l'arrêter
  - Puzzles classés : réussite → puzzle suivant seul (1,3 s ; 4,5 s après un échec, avec « Rester sur ce puzzle ») ; plus de bouton « Puzzle suivant » ; « Passer » après un échec. Puzzle du jour → puzzles classés seuls (2,2 s). Parcours de puzzles : « Étape suivante » seule (5 s)
  - Leçons : une étape interactive réussie avance seule (≈ 1,3–4 s selon le texte) ; les étapes de lecture gardent « Continuer » ; les puzzles d'entraînement s'enchaînent (0,9 s) ; fin de leçon → leçon suivante seule (6 s, « Ensuite : … »), ou retour à Pour toi si la suite est verrouillée/Premium
  - Leçon verrouillée : plus de toast, une page avec « Commencer « la leçon qui l'ouvre » », « Je connais déjà : ouvrir le niveau » et « Retour à Pour toi » ; leçon Expert sans Premium : suite gratuite proposée
  - Fin de partie : « Revanche » (compte à rebours 8 s, couleurs inversées) et « Voir le bilan » côte à côte, « Pas maintenant », « Changer d'adversaire »
  - Bilan de partie : plus d'écran « Lancer le bilan » bloquant ; l'échiquier et les coups sont là tout de suite, le bilan démarre seul (partie récente, quota ou Premium) ; la bulle du coach apparaît en surimpression sur l'échiquier coup par coup pendant l'analyse, puis saute au premier moment clé ; sur téléphone l'échiquier passe avant l'avis détaillé ; quota épuisé → Revanche / Pour toi / Premium
  - États vides : révisions, erreurs à rejouer, puzzles introuvables → toujours « Retour à Pour toi » + une action utile
  - Correctifs : l'accueil renvoyait vers Pour toi 4 s après un « Continuer » manuel (minuteur non annulé) ; les routes puzzles classés / du jour / révision réutilisaient le même composant (ancien puzzle affiché au changement de mode) ; sauvegarde immédiate à la fermeture de l'onglet (pagehide / visibilitychange) au lieu de perdre les 150 dernières ms
  - e2e : leçon verrouillée, avance seule des étapes et de la leçon, enchaînement des puzzles classés et du jour, Revanche + Voir le bilan côte à côte avec compte à rebours, bilan sans écran bloquant avec surimpression, états vides avec retour au fil ; promotions gérées par l'aide de résolution
  - Mesures locales : vitest 1 286/1 286 ; e2e bureau + iPhone 0 échec, 0 erreur console (puzzle résolu → suivant en 0,3 s ; 4 étapes de leçon enchaînées seules, leçon suivante ouverte seule en 5,5 s) ; 1er chargement 154 KiB ; Lighthouse mobile 98/100/100/100
  - Captures iPhone (WebKit, iPhone 14 Pro, sombre) : screenshots/r3/ (tools/tmp/r3-shots.mjs)
  - **En ligne (19/11 21:58, heure de Bruxelles)** — https://veille-tech-pomme.github.io/maitre-des-echecs/ (main 8813956, gh-pages c57e6cb) : e2e en ligne bureau + iPhone 0 échec, 0 erreur console (puzzle → suivant 0,3 s, leçon suivante seule en 5,5 s, premier succès 1,4 s / 2,1 s) ; 1er chargement 149 KiB ; Lighthouse mobile 100/100/100/100 (FCP 1,1 s, LCP 1,5 s, TBT 50 ms, CLS 0)

# PHASE 8 (24/11) — Audit Magnus (contenu échiquéen) — /workspace/audit-magnus/audit-complet-source.txt
Statut par point (✅ fait · 🟡 partiel · ⬜ à faire). Ordre P0 → P1 → P2. Reprise : relire cette liste, `git log`, puis le point ⬜ suivant.
- P0
  - ✅ A1 Objectif « aller à dame » validé après la réponse du moteur, seulement si la position reste gagnante (Exercises.tsx, lib/goal.ts) ; tests (tests/goal.test.ts, lignes de la base de finales tools/data/promo-lines.json)
  - ✅ A2 Saavedra : défense de l'étude imposée (…Td6+ … …Td4), 6.c8=D ? pat refusé, 6.c8=T !! accepté ; même règle dans la leçon « Théorie : études »
  - ✅ A3 FEN illégale d-mat « Dame et roi » → 7k/8/6K1/8/8/8/Q7/8 w
  - ✅ A4 FEN illégale « Le mat du baiser » → 6k1/Q7/5K2/8/8/8/8/8 w
  - ✅ A5 Test de légalité de TOUTES les FEN (leçons, cours, finales, ouvertures, bots, parcours, fil, accueil, puzzles + packs) : tests/positions.test.ts, lib/legal.ts
  - ✅ A6 Test de contenu multi-PV : coup prévu juste, alternatives aussi bonnes acceptées (tests/content-alternatives.test.ts, 275 coups à trouver, Stockfish 17.1 prof. 16) ; seul problème trouvé : « Attaque la pièce clouée » (1.d5 Rf7 décloue, 2.Txe6 valait mieux que 2.dxe6+) → exercice réduit à 1.d5
- P1
  - ✅ B1 Coups équivalents acceptés en leçon (autre mat à tout moment, ≤ 30 cp) — lib/judge-rule.ts, coach/client.ts judgeLessonMove, MoveTrainer judge ; « Mat en 2 » 1.Tb7 accepté, puis on finit le mat contre la meilleure défense
  - ✅ B2 Explication d'erreur en leçon + réfutation jouée sur l'échiquier (explainPuzzleMiss sans dévoiler la solution ; le coup adverse qui réfute est joué puis la position revient)
  - ✅ B3 Leçons Expert et textes fautifs : zugzwang = trébuchet 8/8/8/4pK2/3kP3/8/8/8 (zugzwang mutuel, quiz « Noirs au trait » vérifié) au lieu d'un pat ; triangulation sur une vraie position (Dvoretsky 8/1p1k4/8/1PPK4/8/8/8/8, exercice joué contre le moteur) ; conseil Lucena (Td1+, Td4, la tour s'interpose en b4) ; conseil Saavedra (ligne de l'étude, 6.c8=T !!) ; sous-promotion : pion h2 ajouté, 1.e8=C+ devient le seul coup gagnant (base de finales), texte honnête ; « Dame : éviter le pat » → 7k/8/8/8/8/8/5Q2/6K1 (mat en 7, Df7 ?? pat)
  - 🟡 B4 Parties célèbres : les 1 275 commentaires mécaniques sur 1 456 supprimés (0 restant) ; 8 à 10 moments clés par partie (211 commentaires, en gras), vérifiés avec Stockfish 17.1 prof. 18 (tools/annotate-famous.py, cache tools/data/famous-analysis.json) : tournants (perte ≥ 1 pion, avec le meilleur coup et sa suite), sacrifices qui tiennent, coups qui punissent, plus quelques notes écrites à la main (Deep Blue, Short–Timman, Levitsky–Marshall) ; gras rendu dans la démo ; test tests/content-quality.test.ts. Reste : relecture par un joueur titré, impossible ici
  - ✅ B5 Cours thématiques : chacune des 236 positions a sa propre explication « Pourquoi ça marche » (ligne en notation française + raisons concrètes avec cases et pièces : fourchette, clouage, enfilade, découverte, déviation, sacrifice/attraction, élimination du défenseur, mat et cases de fuite, bilan matériel), un indice propre à la position (pièce et case du coup clé, échec/prise/coup tranquille) après le rappel du motif, et des commentaires coup par coup dans la démo (tools/explain-examples.py) ; test tests/content-quality.test.ts. « Faire un plan » : voir C2 (position et quiz ajoutés)
  - ✅ B6 Diagnostic : 6 positions au moins, arrêt dès σ < 125, 8 au plus ; départ 600 (mat de l'accueil compté comme item 400 : 1re carte ≈ 840 au lieu de 1 083) ; bouton « Je débute » sur les cartes Découverte → niveau 600 et leçon 1 (d-echiquier)
  - 🟡 B7 Bots : ✅ pendule (sans / 10 min / 5+3 / 3+2, temps compté pendant son propre tour seulement, défaite au temps ou nulle si l’adversaire ne peut pas mater) ; ✅ erreurs humaines au lieu du coup tiré au hasard (lib/bot-move.ts naturalMove : coup naturel — prise, échec, développement, fuite d’une pièce attaquée — sans calcul de la réponse, angles morts selon le niveau) ; ✅ tournoi de calibration (tools/calibrate-bots.mts : 20 bots < 1450 contre leurs voisins et Stockfish 17.1 UCI_Elo 1320, 1 536 parties, maximum de vraisemblance) : avant, écart moyen 228 points (max 630, Sophie 1250 mesurée ≈ 1880) → réglage interpolé entre paliers mesurés → après, écart moyen 54 (max 160) ; Elo mesuré affiché sur la fiche du bot (± et nombre de parties), bots ≥ 1450 : « force réglée par Stockfish (UCI_Elo) ». Reste : modèle d’erreurs appris sur des parties humaines (type Maia, réseau lc0 trop lourd pour la PWA hors ligne) ; échelle Stockfish à 100 ms, pas FIDE ; moteur natif complet, l’app utilise le réseau lite
  - ✅ B8 Bilan : piège de l'éléphant — coach/traps.ts, explications écrites à la main reconnues par position + coup (6.Cxd5 ?? → 6…Cxd5 7.Fxd8 Fb4+ ! 8.Dd2 Fxd2+ 9.Rxd2 Rxd8 ; 7.Fxd8 n'est plus « Bien vu ! »), plus Légal et l'arche de Noé
- P2
  - ✅ C1 Bilan : 2e passage (positions critiques) à profondeur 16 (gratuit) / 18 (Premium) au lieu de 12/14, 1er passage ≤ 11 ; coût mesuré (WASM mono-thread, partie de 53 demi-coups, tools/tmp/depth-cost.mjs) : 5 s → 20 s (16) / 36 s (18), commentaires progressifs dès ~5 s ; corpus de pièges en non-régression : tests/coach-traps.test.ts (éléphant, Légal, arche de Noé)
  - ✅ C2 Curriculum : opposition et carré déplacés en Intermédiaire (ids conservés pour la progression) ; Lucena 6 étapes (pourquoi le pont, démo vérifiée base de finales, quiz du moment du pont, exercice en miroir) et Philidor 5 étapes (démo vérifiée, quiz e6, coup de méthode, tenir avec la méthode) ; nouveau cours « Milieu de jeu : structures et plans » (src/data/lessons/middlegame.ts : pion isolé, Carlsbad, Maroczy, pions pendants avec Fischer–Spassky 1972 ; positions issues de vraies lignes d’ouverture, coups des exercices vérifiés Stockfish prof. 22 multi-PV) ; « Faire un plan » appliqué à une position (Carlsbad) avec quiz ; e-calcul : le piège de Légal appris par cœur remplacé par deux positions non forcées où les prises tentantes échouent (tools/build-calc-quiz.py, Stockfish prof. 20) et un exercice de visualisation
  - ✅ C3 Finales à tenir nulle : méthode Philidor vérifiée à chaque coup (lib/goal.ts philidorMethodIssue : tour sur la 3e rangée tant que le pion n’y est pas, puis tout en bas) dans la finale « Position de Philidor », « Philidor : passer en bas » et la leçon a-philidor ; un coup qui annule mais hors méthode (ex. 1…Tb1, que la base de finales donne nul) est expliqué et refusé ; exercices « any » avec `method` : le coach n’accepte plus un coup équivalent quand c’est la méthode qui est enseignée ; test tests/method.test.ts
  - ✅ C4 Captures `screenshots/*-ERR-*` orphelines supprimées du dépôt (traces d'échecs e2e déjà corrigés en R3)
- Vérifications (24/11, après 9af0078 + e21e749)
  - Audit relu une dernière fois : tous ses points sont dans la liste ci-dessus (A1–A6, B1–B8, C1–C4) ; rien de neuf.
  - Scripts de l’audit relancés sur un export frais (/workspace/audit-magnus/rerun-2026-11-24, logs « avant » conservés dans /workspace/audit-magnus/scripts) :
    - val_lessons : FEN illégales 2 → 0 ; ANY-MISS / MULTI-MATE restants (positionnels, i-calcul Tb7, Lasker–Capablanca, Petrosian–Spassky) = coups à ≤ 30 cp ou mats aussi rapides, acceptés à l’exécution par le juge des leçons (B1) — le script statique ne connaît pas ce juge ; WRONG « attendu X mais SF X » = artefact (même coup) ; PLAY fin-4/fin-5 = éval. de faible profondeur, gain confirmé par la base de finales
    - tb : 89/89 finales cohérentes avec la base de finales avant et après (1 ignorée, > 7 pièces) ; kq-k-coin : mat en 1 → mat en 7
    - val_puzzles : 300 puzzles, 0 erreur (1 signalement « ALT-MAT » : un mat plus lent refusé, comportement voulu)
  - Tests unitaires : 1 402 / 1 402 (21 fichiers ; 1 286 avant l’audit)
  - e2e local bureau Chromium + iPhone 14 Pro WebKit : 88 vérifications, 0 échec, 0 erreur console
  - Premier chargement : 158 KiB ; Lighthouse mobile local : 99 / 100 / 100 / 100 (LCP 2,3 s, TBT 40 ms)
  - val_lessons2 (cours, relancé après le redémarrage de la machine) : seuls restent des PLAY de faible profondeur (fin-0, fin-4, fin-5 : gain confirmé par la base de finales), un WRONG artefact (même coup) et 3 ANY-MISS de parties célèbres à ≤ 23 cp, acceptés à l’exécution par le juge
- En ligne (24/11, 18:56 Bruxelles) : main 1c4bd57, gh-pages 386be6f, bundle index-ZceGoXSS.js identique à dist
  - e2e en ligne bureau + iPhone 14 Pro WebKit : 88 vérifications, 0 échec, 0 erreur console (1er passage : 1 dépassement de délai sur « bilan de partie » iPhone, page correcte à l’écran ; 2e passage vert)
  - Premier chargement en ligne : 153 KiB ; Lighthouse mobile en ligne : 100 / 100 / 100 / 100 (LCP 1,5 s, TBT 10 ms, CLS 0)

# PHASE 9 (24/11) — GOAT phase 1 : MVP « Le coach qui explique » — /workspace/audit-magnus/cahier-des-charges-goat.md
Périmètre (cahier §9) : piliers 8 (CI + validate-content + accepts.gen.json), 1 (diagnostic, réfutation, indices 3 niveaux partout), 2 (notions + FSRS + révision des erreurs de leçon), 7 (séance de 5 minutes seulement).
Statut (✅ fait · 🟡 partiel · ⬜ à faire). Reprise : relire cette liste, `git log`, puis le point ⬜ suivant. Stockfish natif : /tmp/sf (sf 17.1 avx2, /tmp/stockfish ; à retélécharger si la machine a redémarré).
- Q2 Maia-2 (poids) : 🟡 vérifié 24/11 — code MIT (CSSLab/maia2 LICENSE) ; poids = fichiers Google Drive téléchargés par maia2/model.py, sans licence ni fiche de modèle (aucun modèle Maia-2 sur huggingface.co/UofTCSSLab, seulement Maia-3) ; article arXiv 2409.20553 sous licence arXiv non exclusive (article seul). Licence des poids non explicite → NON intégré (et c'est la phase 3 de toute façon). Maia-3 (AGPL) exclu.
- Pilier 8
  - 🟡 P8.1 CI écrite (tools/ci/ci.yml : npm ci, tsc, validate-content, diff des fichiers générés, vitest, build, e2e Chromium+WebKit+axe ; --fresh la nuit) MAIS push de .github/workflows refusé : jeton gh sans portée « workflow » → à déplacer quand la portée sera accordée (`gh auth refresh -h github.com -s workflow`, interactif). En attendant tools/ci-local.sh (mêmes étapes). Protection de branche : impossible sans CI active.
  - ✅ P8.2 tools/validate-content.mts → accepts.gen.json (61 Ko, 15 Ko gz) + cache + rapport ; 1292 positions, 1135 alternatives, 118 finales tablebase, 0 erreur ; tests/content.test.ts (commit a4d696f)
  - 🟡 P8.3 CA8.1 rouge vérifié EN LOCAL (FEN illégale injectée dans d-mat#1 → exit 1, « le camp qui n’a pas le trait est en échec ») ; pas sur GitHub (cf. P8.1). ✅ CA8.3 : --fresh (de zéro, 6 min 54) = octet pour octet identique (accepts, rapport, 1180 entrées de cache). ✅ CA8.4 779/779.
- Pilier 1
  - ✅ P1.1 src/coach/diagnose.ts (MistakeKind, diagnose, graduatedHints, explainIllegal) + corpus tests/diagnose-corpus.ts (36 tests verts, positions vérifiées au moteur ; commit de6955a)
  - 🟡 P1.2 MistakeSheet (Montre-moi / Indice / Réessayer) + indices 3 niveaux branchés : leçons, cours, finales, ouvertures, fil, puzzles (branché ; reste : indice moteur dans PlayGoal, e2e)
  - 🟡 P1.3 Coups illégaux expliqués (Débutant) : explainIllegal + Board free branchés ; à vérifier en e2e
  - ⬜ P1.4 CA1.1 e2e coup faux → headline non générique ; CA1.6 latence 1re phrase iPhone
- Pilier 2
  - 🟡 P2.1 src/data/concepts.ts (49 notions) ; étiquetage par leçon (conceptsOfLesson) ; test 100 % à écrire
  - 🟡 P2.2 src/coach/mastery.ts + modèle v2 + migrateModel faits ; tests CA2.4 à écrire
  - 🟡 P2.3 FSRS (lib/fsrs.ts, chunk séparé 8,7 Ko gz chargé 1,5 s après l'affichage ; repli SM-2) ; tests à écrire
  - 🟡 P2.4 Erreurs de leçon/exercice → cartes « mistake » (lib/learning.ts, évènement brut « mistake ») ; reste : fil entrelacé ; fil entrelacé sans thème annoncé, ≤ 2 cartes de la même notion à la suite
  - ⬜ P2.5 Carte des notions (Mes progrès) ; export inclut les notions ; banc simulé (bench/)
- Pilier 7 (séance)
  - ⬜ P7.1 « Ma séance de 5 minutes » en un geste depuis l'accueil, jauge, fin de séance (progrès + demain) ; e2e temps simulés
- Fin
  - ⬜ Tests complets (unit + e2e bureau + iPhone WebKit), déploiement GitHub Pages, vérification en ligne, captures screenshots/goat1/
