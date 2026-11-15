# ♞ Maître des Échecs — apprendre, puis devenir expert

Application d’échecs **100 % en français**, interactive et pédagogique, **installable sur iPhone et Windows** (PWA hors ligne) et **prête pour l’App Store** (Capacitor iOS).

## Contenu
- **Parcours en 4 niveaux** : 43 leçons (Débutant 13, Intermédiaire 11, Avancé 10, Expert 9). Chaque leçon combine explications, démonstrations animées et exercices (coups, mats, quiz, étoiles, sélection de cases, parties contre le moteur), avec indices et déblocage progressif. **+ 133 leçons de cours thématiques** (22 mats célèbres, 28 motifs tactiques, 39 ouvertures, stratégie, finales, 22 parties célèbres commentées coup par coup) : **176 leçons** au total.
- **330 198 puzzles** de la base Lichess (CC0), tous validés par Stockfish : 4 034 intégrés + 50 734 en packs hors ligne (chargés à la demande, cache IndexedDB) + 275 430 dans le pack « plus » téléchargeable. Sélection par thème, Elo et ouverture, duel contre un adversaire fantôme, 31 parcours thématiques. Classement Elo adaptatif, thèmes, puzzle du jour, **contre-la-montre** (3 min, 5 min, survie), **révisions espacées** des puzzles ratés.
- **47 bots à personnalité** (200 → 3200 Elo, avatars SVG générés, styles et répertoires d’ouvertures, bots « styles historiques »), mode **coach** (indice, annulation, alerte gaffe, commentaire de chaque coup).
- **Bilan de partie** façon Chess.com (brillant, très bon, meilleur, excellent, bon, théorie, imprécision, erreur, occasion manquée, gaffe), précision, courbe d’évaluation, moments clés, « rejoue le meilleur coup », **coach qui explique pourquoi** en français.
- **Échiquier d’analyse** : Stockfish 18 (WASM), barre d’évaluation, 3 lignes, coups du livre, import/export PGN/FEN (notation française acceptée).
- **Base de maîtres (gratuite)** : 256 295 parties OTB humaines (moteurs exclus) de joueurs à Elo FIDE ≥ 2200 (Lichess Broadcast, CC0, 2019–2026), 110 902 positions jusqu’à 30 demi-coups (transpositions fusionnées) : nombre de parties, % Blancs/nulle/Noirs, Elo moyen et coups des maîtres par position, 36 435 parties notables à rejouer dans l’analyse (3 par position en gratuit, toutes en Premium). Données en 512 fragments gzip de ≤ 10 Ko chargés à la demande et mis en cache (IndexedDB + service worker) : rien n’est ajouté au premier chargement. Reconstruire : `node tools/extract-broadcasts.mjs && node tools/build-explorer.mts` (après téléchargement des PGN dans `tools/data/bcast/`).
- **Ouvertures** : 39 ouvertures, 58 lignes commentées, explorateur de 3 865 lignes nommées en français (Lichess chess-openings, CC0), entraîneur avec SRS, **répertoire personnel** (Premium).
- **Finales** : 12 exercices (mats élémentaires, opposition, Lucena, Philidor…).
- **Progression** : XP, niveaux, séries, 24 badges, courbe de classement, faiblesses détectées et **plan du jour personnalisé**.
- **Design** : thèmes clair et sombre, 8 échiquiers, 6 jeux de pièces, sons synthétisés hors ligne, haptique, animations, accessibilité (réduction des mouvements, ARIA, clavier).
- **Freemium généreux, zéro pub** : tout est gratuit jusqu’au niveau Avancé. Premium (3,99 €/mois, 29,99 €/an avec 7 jours gratuits, 59,99 € à vie) ajoute le niveau Expert, les bilans illimités et approfondis, le répertoire, les statistiques avancées et les thèmes.

## Commandes
```bash
npm install
npm run dev        # développement
npm test           # (≈ 1 180 tests) tests (règles, leçons, puzzles, moteur, freemium)
npm run build      # build de production → dist/
npm run preview    # sert dist/ sur http://localhost:4173
npm run e2e        # tests headless iPhone (WebKit) + bureau (Chromium) + captures d'écran
npx cap sync ios   # copie dist/ dans le projet iOS
```

## Publication
- **iPhone / App Store** et **paiements** : voir [`PUBLICATION_IOS.md`](PUBLICATION_IOS.md) (Apple Developer, Codemagic, abonnements, RevenueCat, Stripe, confidentialité, règle 3.1.1, licence GPL).
- **PWA (iPhone sans App Store, Windows)** : héberger `dist/` sur n’importe quel hébergement statique HTTPS (GitHub Pages : `scripts/deploy-gh-pages.sh`). Sur iPhone : Safari → Partager → « Sur l’écran d’accueil ». Sur Windows : Edge → « Installer l’application ».

Licence : GPL-3.0-or-later (voir `LICENCES.md`).

- **Finales** : 90 exercices contre le moteur, vérifiés par les tablebases Lichess ou Stockfish.
- **Entraînement** : coordonnées, nomme la case, vision du cavalier, « Rejoue la position », mats contre l’ordinateur, « Devine le coup » sur 90 parties de champions du monde.
