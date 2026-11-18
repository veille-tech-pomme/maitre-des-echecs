# Système de design — Maître des Échecs

Objectif : une app iOS native dans l’esprit, sobre et premium. Sombre d’abord, une seule couleur de marque (l’or « Maître »), la typographie système d’Apple et un échiquier maison.

## 1. Couleurs (jetons CSS, `src/styles.css`)
| Jeton | Sombre (défaut) | Clair | Usage |
|---|---|---|---|
| `--bg` | `#0B0C10` encre | `#F2F2F7` | fond d’app |
| `--surface` | `#16181E` | `#FFFFFF` | cartes, listes groupées |
| `--surface-2` | `#1F222A` | `#F2F2F7` | contrôles remplis, champs, rangée pressée |
| `--surface-3` | `#2A2E38` | `#E5E5EA` | pistes de progression, segment |
| `--sep` | `rgba(255,255,255,.08)` | `rgba(60,60,67,.12)` | séparateurs 0,5 pt |
| `--text` | `#F5F5F7` | `#0B0C10` | texte principal |
| `--text-2` | `rgba(235,235,245,.66)` | `rgba(60,60,67,.74)` | secondaire (≥ 4,5:1) |
| `--text-3` | `rgba(235,235,245,.40)` | `rgba(60,60,67,.46)` | tertiaire, désactivé |
| `--gold` | `#F2B544` | `#F2B544` | marque : boutons principaux, sélection, anneaux |
| `--on-gold` | `#1C1404` | `#1C1404` | texte sur or (12:1) |
| `--tint` | `#F2B544` | `#8A5D00` | liens, icônes actives (contraste AA sur fond) |
| `--green` | `#30D158` | `#248A3D` | bon coup, réussite |
| `--red` | `#FF453A` | `#D70015` | erreur, gaffe |
| `--blue` / `--orange` / `--purple` / `--teal` | couleurs système iOS | variantes claires | tuiles d’icônes, catégories |

Échiquier par défaut **« Maître »** : cases claires `#E9E2D0` (ivoire), foncées `#8A9FA8` (ardoise). Dernier coup en or translucide, sélection or, points de destination discrets. Les autres thèmes (vert, bois, bleu…) restent dans Réglages.

## 2. Typographie
Pile : `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif`. Chiffres tabulaires pour les scores, Elo et horloges.

| Style | Taille / interligne | Graisse |
|---|---|---|
| Large Title | 34 / 41 | 700, −0,4 px |
| Title 1 | 28 / 34 | 700 |
| Title 2 | 22 / 28 | 700 |
| Title 3 | 20 / 25 | 600 |
| Headline | 17 / 22 | 600 |
| Body | 17 / 24 | 400 |
| Callout | 16 / 21 | 400 |
| Subhead | 15 / 20 | 400 |
| Footnote | 13 / 18 | 400 |
| Caption | 12 / 16 | 500 |

## 3. Espacement, rayons, élévation
- Grille de 4 pt : `--s1` 4, `--s2` 8, `--s3` 12, `--s4` 16, `--s5` 20, `--s6` 24, `--s8` 32, `--s10` 40. Marge d’écran 16 pt (20 pt ≥ 390 pt).
- Rayons : contrôles 12, rangées et cartes 16, cartes héro 24, pastilles 999.
- Élévation : en sombre, la profondeur vient de la surface (pas d’ombres) ; en clair, ombre douce `0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06)`. Feuilles et menus : `0 24px 60px rgba(0,0,0,.45)`.
- Cibles tactiles ≥ 44 × 44 pt partout.

## 4. Mouvement
- Durées : 120 ms (pression), 220 ms (transition d’état), 320 ms (feuille, écran). Courbe : `cubic-bezier(.2,.8,.2,1)` ; ressort pour les célébrations `cubic-bezier(.34,1.56,.64,1)`.
- Pression : `scale(.97)` sur les boutons et les rangées.
- Changement d’écran : fondu + translation de 8 px. Les feuilles montent du bas.
- Retour de coup : case verte et pulsation pour un bon coup, secousse rouge et vibration (`navigator.vibrate`, si dispo) pour une erreur, confettis or à la réussite.
- Tout est désactivé avec « Réduire les animations » ou `prefers-reduced-motion`.

## 5. Composants
- **Barre d’onglets** (verre dépoli, 5 onglets : Aujourd’hui, Apprendre, Puzzles, Jouer, Moi). Icônes vectorielles, l’onglet actif est rempli et en or. Masquée sur les écrans de jeu.
- **En-tête à grand titre** (`.lt`) sur les écrans racine ; **barre de navigation compacte** (`.navbar` : retour ‹, titre centré, action à droite) sur les écrans de détail et de jeu.
- **Boutons** : `primary` (or plein, 50 pt), `secondary` (surface remplie, texte), `plain` (texte teinté), `danger`. Tailles `small` (34 pt) et `icon` (44 pt, rond).
- **Listes groupées** (`.list` + `.item`) : tuile d’icône colorée 30 pt, titre, sous-titre, accessoire (chevron, valeur, interrupteur). C’est le composant de base de la navigation.
- **Cartes** (`.card`), **carte héro** (`.hero-card`, dégradé de marque, une seule action).
- **Contrôle segmenté** (`.seg`), **puces de filtre** défilantes (`.chips`), **pastilles** (`.pill`).
- **Feuille** (`Modal` → feuille du bas sur mobile, dialogue centré sur bureau), **toasts** (pastille en haut), **anneau de progression** (`Ring`), **barre de progression** (`Progress`).
- **Barre d’actions** (`.actionbar`) collée en bas des écrans de jeu, dans la zone du pouce, au-dessus de l’indicateur d’accueil.
- **Icônes** : sous-ensemble Lucide (ISC) généré dans `src/components/icons.gen.ts` (`node tools/build-icons.mjs`), composant `<Icon name="…">`. Aucun emoji dans l’interface.

## 6. Mise en page
- Mobile : une colonne, échiquier bord à bord (marges 0 sur les écrans de jeu), panneau sous l’échiquier, actions en bas.
- ≥ 760 pt : écrans de jeu en deux colonnes (échiquier à gauche, jusqu’à la hauteur de l’écran ; panneau collant à droite).
- ≥ 1024 pt : barre latérale de 248 pt avec les mêmes 5 destinations ; contenu limité à 1080 pt.

## 7. Rédaction
Tutoiement, phrases courtes, verbes d’action sur les boutons (« Continuer », « Jouer », « Essayer 7 jours gratuits »), pas de jargon sans explication, pas de pictos dans les titres.
