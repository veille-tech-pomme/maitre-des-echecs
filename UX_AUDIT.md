# Audit UX/UI — Maître des Échecs (18/11/2026)

Écrans capturés : 27 routes × iPhone 14 Pro (WebKit), iPhone SE (WebKit), bureau 1366 px (Chromium) → `screenshots/before/`.
Références consultées (modèles d’interaction seulement) : Lichess mobile (5 onglets, écrans de jeu plein écran qui recouvrent la barre d’onglets, listes groupées iOS, « Liquid Glass » en 2026), Chess.com (bouton « Jouer » dominant, cartes Puzzles/Leçons, bilan de partie), Apple HIG (grands titres, listes groupées, barre d’onglets, feuilles, zone du pouce).

## Verdict
L’app est riche en contenu mais ressemble à un tableau de bord web générique : aucune action principale, des emoji à la place d’icônes, des écrans de jeu qui ne sont pas plein écran, et une identité visuelle inexistante (violet par défaut + vert Chess.com + emoji multicolores).

## Problèmes concrets (par gravité)
### Bloquants
1. **Écrans « focus » cassés sur mobile** : leçon, partie, puzzle gardent la barre d’onglets ; le texte de la leçon passe *sous* la barre et le bouton « Continuer » flotte par-dessus le texte (`iphone-04-lecon.png`).
2. **Pas d’action principale à l’accueil** : plan du jour (4 lignes) + carte « continuer » + carte classement + **10 raccourcis** + points faibles + promo. Rien ne dit « fais ça maintenant » (`iphone-01-accueil.png`).
3. **Onglet « Plus » fourre-tout** : 9 tuiles de même poids (Entraînement, Ouvertures, Finales, Analyse, Révisions, Progression, Réglages, Premium, Confidentialité). La barre latérale bureau a 12 entrées.
4. **Échiquier trop petit / contrôles hors écran** : marges de 16 px + carte ; sur iPhone SE il faut défiler pour voir l’indice et le bouton suivant d’un puzzle (`se-06-puzzle.png`).

### Majeurs
5. **Emoji comme système d’icônes** (onglets en niveaux de gris filtrés, listes, boutons ⏮ ◀ ▶) : rendu inégal, aspect amateur, pas de cohérence de trait.
6. **Hiérarchie typographique plate** : même h1 partout, beaucoup de petit texte gris, paragraphes d’intro inutiles (« 47 adversaires avec leur personnalité… »), titres de section en gris.
7. **Murs de puces / boutons** : 8 filtres de bots sur 3 lignes, 5 boutons fantômes dans l’analyse, 6 tuiles égales dans les puzzles.
8. **Cartes dans des cartes**, bordures + ombres en mode sombre (ombres invisibles, bordures bruyantes), rayons incohérents (8/10/12/16).
9. **Choix de couleur en partie** : « Blancs / Au hasard / Noirs » en gros boutons emoji qui passent sur deux lignes.
10. **Profil** : anneau de niveau cassé (texte superposé), heatmap vide sans explication, statistiques « 0 » sans état vide.
11. **Onboarding** : une simple modale par-dessus l’accueil (fermable en touchant le fond), aucun visuel, prénom + 3 boutons sur un seul écran.
12. **Paywall** : long texte, liste de coches, prix sous la ligne de flottaison, essai de 7 jours peu lisible.

### Mineurs
13. Cibles tactiles < 44 pt (puces 32 px, liens « Détails »).
14. Retour d’information des coups : uniquement textuel, pas d’animation ni de vibration ; toasts avec emoji.
15. Dark mode : contraste correct mais tout est gris sur gris, aucune profondeur ; le mode clair est un gris bleuté terne.
16. Textes : quelques tournures lourdes, majuscules incohérentes, pictos dans les titres (« 🎯 Ton plan du jour »).
17. Bureau : contenu étiré sur 1180 px avec des tuiles minuscules, pas de mise en page à deux colonnes pour les écrans de jeu.

## Principes retenus pour la refonte
- **Une action principale par écran**, divulgation progressive.
- **5 onglets** : Aujourd’hui · Apprendre · Puzzles · Jouer · Moi. Tout le reste est rangé dedans (Ouvertures/Finales/Entraînement → Apprendre ; Analyse/Bilans → Jouer ; Révisions → Puzzles ; Réglages/Premium/Confidentialité → Moi).
- **Écrans de jeu plein écran** (sans barre d’onglets), échiquier bord à bord, barre d’actions dans la zone du pouce, zones de sécurité respectées.
- **Système d’icônes vectorielles unique** (trait 2 px, style SF Symbols), plus aucun emoji dans l’interface.
- **Identité** : sombre « encre » + or « Maître », échiquier ardoise/ivoire maison.
