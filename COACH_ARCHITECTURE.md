# Coach — architecture (v1)

> Objectif : faire du coach le **cœur** de Maître des Échecs. Il comprend *pourquoi* un coup est bon ou
> mauvais, il sait ce que tu maîtrises et ce qui te manque, et il choisit la prochaine activité qui
> te fera le plus progresser. Tout tourne **sur l’appareil, hors ligne**, sans clé d’API.
> Contraintes : GPL-3, Stockfish WASM, premier chargement ≈ 160 Kio (le code du coach est chargé à
> la demande), calculs lourds dans des Web Workers, 60 i/s, textes en français, système de design de DESIGN.md.

## 0. Vue d’ensemble

```
            ┌───────────── thread principal (UI Preact) ─────────────┐
 partie ──▶ │ orchestrateur  src/coach/client.ts                     │
 puzzle ──▶ │   ├─ moteur  (Worker Stockfish 18 lite, multi-PV)      │
 leçon  ──▶ │   └─ coach   (Worker src/coach/worker.ts)              │
            │        pipeline → classification → explications (NLG)  │
            │                                                        │
            │ modèle du joueur  src/coach/model.ts  (Glicko-2 × 26)  │
            │ curriculum        src/coach/curriculum.ts              │
            └────────────────────────────────────────────────────────┘
                      ▲ état persistant : localStorage `echecs-app-v1`.coach
```

| Couche | Fichier | Rôle |
|---|---|---|
| Géométrie | `coach/geometry.ts` | carte d’attaques 64 cases, rayons, x-ray, SEE (échange statique) |
| Motifs | `coach/motifs.ts` | ≈ 30 détecteurs symboliques (tactique, structure, roi, finales) |
| Probabilité | `coach/winprob.ts` | score attendu E(cp, Elo), mats, pertes ΔE |
| Classification | `coach/classify.ts` | brillant → gaffe, occasion manquée, calibré par Elo ; moments critiques |
| Explication | `coach/explain.ts` | raisonnement *ancré sur la ligne du moteur* + génération de texte FR |
| Pipeline | `coach/pipeline.ts` | analyse d’une partie / d’un coup / d’une erreur de puzzle |
| Modèle | `coach/model.ts` | Glicko-2 par compétence, preuves, faiblesses récurrentes |
| Curriculum | `coach/curriculum.ts` | gain d’apprentissage attendu, ZPD, répétition espacée de *tes* erreurs |
| Diagnostic | `coach/diagnostic.ts` | test adaptatif d’entrée (CAT) |
| Langage | `coach/language.ts` | interface pour une couche LLM future (désactivée) |

## 1. Pipeline d’analyse

1. **Moteur.** Pour chaque position de la partie : Stockfish en multi-PV 3 (profondeur 12 gratuit, 14 Premium ;
   budget en nœuds sur mobile). On garde le meilleur coup, la 2e ligne (« coup unique ») et la PV complète.
   Après le coup joué, la PV de l’adversaire est la **réfutation**.
2. **Phase.** Ouverture : la position est dans le livre (39 ouvertures / 3 865 lignes ECO) ou dans la base de
   maîtres (110 902 positions) → coup « théorie », avec le pourcentage des maîtres s’il est connu. Finale :
   matériel non-pion ≤ 13 par camp, ou ≤ 7 pièces au total → module finales ; si en ligne, la base de finales
   Lichess (gratuite, sans clé, ≤ 7 pièces) peut confirmer gain/nulle/perte ; hors ligne, on s’en tient à Stockfish.
3. **Score attendu.** Les centipions ne sont pas des points de partie. On utilise
   `E(cp, R) = 1 / (1 + exp(−k(R)·cp))`, avec `k(R) = 0,00368 × (0,55 + 0,45·clamp((R−600)/1800, 0, 1))`.
   Pente Lichess à 2400 ; plus douce pour les débutants (un pion d’avance vaut ≈ 56 % de score attendu à 800 Elo, ≈ 59 % à 2400 ; trois pions ≈ 66 % contre 75 %).
   Mat en n pour le camp au trait : `E = 1 − 0,02·min(n, 10)·(1 − s(R))`, où s(R) ∈ [0, 1] est le niveau normalisé
   (un mat en 6 n’est pas « gagné » pour un débutant).
4. **Perte.** `ΔE = max(0, E(meilleur) − E(joué))` du point de vue du joueur ; la précision par coup suit la
   courbe Lichess `103,17·e^(−4,354·ΔE) − 3,17` (ΔE en points de 0 à 1 ×100).
5. **Classification** (seuils `τ(R) = τ₁₅₀₀ × (1 + 0,35·clamp((1500−R)/1000, −0,5, 1))`, donc plus indulgente sous 1500) :

| Classe | Condition |
|---|---|
| théorie | position après le coup dans le livre ou jouée ≥ 5 fois par les maîtres (ply < 24) |
| brillant | sacrifice **réel** (SEE < 0 sur la case d’arrivée ou matériel rendu ≥ 2 sur la PV), ΔE ≤ 0,02, E_avant < 0,9, E_après ≥ 0,5 |
| très bon (coup unique) | meilleur coup, et E(1re ligne) − E(2e ligne) ≥ 0,15 |
| meilleur / excellent / bon | ΔE < 0,01 / < 0,03 / < τ_imp |
| imprécision / erreur / gaffe | ΔE ≥ τ_imp = 0,05 / τ_err = 0,10 / τ_gaf = 0,20 (à 1500) |
| occasion manquée | E(meilleur) ≥ 0,80 et E(joué) < 0,60, sans gaffe matérielle immédiate |

6. **Moments critiques.** Score `c = max(ΔE, gap₁₂·[coup unique], |E(t+1) − E(t)|)` ; on retient les 3 meilleurs
   pour le joueur, espacés d’au moins 4 demi-coups. Chacun devient un **exercice « Rejoue »** (position avant le
   coup, solution = 1 à 3 coups de la PV, vérifiés légaux et forcés).

## 2. Moteur d’explication (la partie difficile)

### 2.1 Raisonnement symbolique
`geometry.ts` construit en une passe une carte d’attaques (64 cases × liste d’attaquants triés par valeur),
avec x-ray pour les pièces à longue portée. **SEE** : algorithme d’échange classique (swap list) qui ajoute
les attaquants découverts derrière la pièce qui prend.

Détecteurs (`motifs.ts`). Chacun renvoie `{key, squares, pieces, gain}` et des cases à surligner :

| Famille | Motifs |
|---|---|
| Matériel | pièce en prise (SEE > 0), pièce gratuite, échange perdant, pièce piégée (toutes ses fuites ont un SEE < 0) |
| Tactique | fourchette (≥ 2 cibles rentables : roi, pièce plus chère ou non protégée), clouage absolu/relatif, enfilade, attaque/échec à la découverte, échec double, surcharge (un défenseur unique pour deux cibles), élimination du défenseur, attraction/déviation (sur la PV), coup intermédiaire, rayons X |
| Mat | mat du couloir (roi sur sa 1re rangée, cases de fuite bloquées par ses pions), filet de mat (mat ≤ 5 avec ≤ 1 case de fuite), mat à l’étouffée, menace de mat |
| Roi | bouclier de pions, colonnes ouvertes ou semi-ouvertes devant le roi, attaquants dans la zone du roi, perte du droit de roquer |
| Pions | isolé, doublé, passé (et passé protégé), arriéré, majorité |
| Pièces | avant-poste (case protégée par un pion, inattaquable par les pions adverses), mobilité, fou mauvais, tour sur colonne ouverte ou en 7e |
| Ouverture | développement, centre, dame sortie tôt, même pièce jouée deux fois, cavalier au bord, pion f avancé, roi déplacé sans roquer |
| Finales | opposition (directe, distante), règle du carré, Lucena (pont), Philidor (défense en 3e rangée), roi actif, pion passé éloigné |

### 2.2 Ancrage sur le moteur (règle d’or)
**On n’annonce jamais un motif que la ligne du moteur ne confirme pas.**
* *Coup mauvais.* On rejoue la réfutation (jusqu’à 8 demi-coups) en suivant le matériel. Le motif est cherché
  sur le **coup adverse qui gagne** (1er coup de la PV, ou celui juste avant le gain). On le retient seulement si
  (a) le détecteur se déclenche sur ce coup, et (b) le bilan matériel de la PV au bout de l’horizon gagne au moins
  la valeur de la cible moins 1, ou la PV mène au mat. Sinon, on explique par le matériel seul (« tu perds un
  cavalier après… ») ou par le score.
* *Coup manqué.* Même procédé sur la PV du meilleur coup.
* *Positionnel* (pas de tactique, ΔE modéré). On compare les traits statiques avant et après le coup (structure,
  roi, développement, activité) **et** après le meilleur coup ; on cite le trait qui différencie les deux et qui
  va dans le sens du score (formulation prudente : « le moteur préfère…, notamment parce que… »).
* *Bon coup.* On nomme le motif réalisé (vérifié de la même façon) ou le principe respecté.

### 2.3 Génération du texte
* Sortie structurée : `{title, verdict, why, refutation, plan, arrows[], highlights[], level}`.
* Trois registres : **débutant** (< 1000 : noms des pièces, phrases courtes, pas de notation enchaînée),
  **intermédiaire** (notation des 2–3 coups clés), **avancé** (≥ 1800 : variantes, scores, nuances).
* Variété : plusieurs gabarits par situation, choix déterministe par hachage de la FEN (la même position garde
  le même texte, deux positions voisines ne se répètent pas).
* Plan : le meilleur coup **et l’idée** (motif du meilleur coup, sinon le trait positionnel qui s’améliore).
* Flèches : rouge = coup adverse qui punit, verte = meilleur coup, surlignage = cible / pièce en prise.

## 3. Modèle du joueur
* **26 compétences** (`SKILLS`) en 6 familles : tactique (fourchette, clouage, enfilade, découverte, mat en 1,
  mats en 2+, couloir, sacrifice/attraction, défense, coup calme), vigilance (pièces en prise, menaces adverses),
  calcul (longueur des solutions), ouvertures (principes, connaissance par ouverture), finales (pions, tours,
  pièces mineures, dames, technique), stratégie (sécurité du roi, structure, activité), conversion, défense.
* **Glicko-2** par compétence (r, RD, σ). Chaque observation est un « match » contre un item de difficulté d :
  puzzle (Elo Lichess, thèmes → compétences), leçon terminée (d selon le niveau), **événement de partie** (le
  pipeline émet par exemple « fourchette disponible, trouvée ou non », d = Elo estimé + 120 × profondeur, ou
  « pièce laissée en prise », d faible car l’erreur est facile à éviter). Le RD augmente avec l’inactivité
  (c = 35 par période de 30 jours, plafond 350).
* **Preuves** : journal circulaire (400 évènements) `{t, skill, ok, src, ref, piece, mat}` → phrases du type
  « tu as perdu 4 pièces sur des fourchettes de cavalier ces 10 dernières parties ».
* **Faiblesse** : `r_global − r_skill > max(100, 0,8·RD)` avec RD < 200, **ou** ≥ 3 occurrences du même schéma dans les
  10 dernières parties. Force : l’inverse. Confiance affichée = 1 − RD/350.

## 4. Curriculum adaptatif
Pour chaque activité candidate a (leçon, puzzles ciblés, révision de *tes* erreurs, partie contre un bot,
finale, ouverture), le **gain d’apprentissage attendu** vaut
`G(a) = importance(skill, niveau) × écart(skill) × préparation(a) × zpd(p_a) × nouveauté(a)`
* écart = σ((r_global − r_skill)/200) + 0,25·RD/350 (exploration des compétences mal connues) ;
* importance : pondération par niveau (débutant : vigilance, mat en 1, fourchettes… ; avancé : finales de tours,
  calcul, prophylaxie) ;
* préparation : la leçon est débloquée, les prérequis sont faits ;
* zpd(p) = exp(−((p − 0,75)/0,15)²) : on vise ≈ 75 % de réussite (zone proximale de développement) ; la difficulté
  des puzzles ciblés est choisie pour que p ≈ 0,75, soit `d = r_skill − 191` ;
* nouveauté : pénalité si la même activité a été proposée et faite aujourd’hui.
**Répétition espacée de tes erreurs** : chaque moment critique perdu devient un puzzle personnel (SM-2 de
`srs.ts`). **Objectifs hebdomadaires** : 3 à 4 objectifs mesurables (bilans, puzzles ciblés, leçons, progrès sur la
compétence-focus). Le plan du jour (`plan.ts`) est désormais alimenté par le curriculum.

## 5. Expérience
* **Accueil** : carte « Ton coach » (focus du jour, pourquoi, preuve, bouton unique).
* **Après chaque partie** : bilan mené par le coach — résumé en une phrase, 3 leçons de la partie, moments clés
  à rejouer, puis coup par coup.
* **Pendant une partie contre un bot** : aide optionnelle à 3 niveaux (Menaces / Idées / Coups) en plus du
  jugement de chaque coup.
* **Puzzles** : quand tu te trompes, le coach explique pourquoi ton coup ne marche pas et quelle idée il fallait voir.
* **Leçons** : à la fin, effet sur les compétences.
* **Bilan conscient du résultat** : abandon, nulle, mat subi ou donné changent le titre et le message (ex. abandon
  dans une position encore jouable → « ne lâche rien »).
* **Erreurs personnelles** (`#/review/mistakes`) : chaque moment clé devient une carte de répétition espacée
  (1re révision 10 min plus tard) ; l’écran indique combien sont programmées et quand revient la prochaine.
* **Puzzles par thème** : la difficulté est choisie par le coach (`themeTarget`, p ≈ 0,75 sur la compétence),
  sinon le classement puzzle.
* **« Mes progrès »** (`#/coach`) : radar des 6 familles, compétences avec confiance, preuves, objectifs de la semaine.
* **Onboarding** : test de placement adaptatif (6 positions, ~2 min, facultatif) ; estimation bayésienne sur grille
  (a priori N(départ, 450²), vraisemblance Elo), chaque item posé à la moyenne a posteriori.

## 6. Couche langage (option future)
`coach/language.ts` définit `CoachLanguage { rephrase(e, ctx); answer(q, ctx) }`. L’implémentation par défaut
est locale (gabarits). Un fournisseur serveur (LLM) pourrait plus tard reformuler ou répondre à des questions,
**en ne recevant que des faits déjà vérifiés** (motifs + lignes du moteur) pour ne pas inventer. Aucune clé ni
service payant n’est requis aujourd’hui ; rien n’est envoyé hors de l’appareil.

## 7. Performance
* Code du coach dans des modules chargés à la demande (`src/coach/*`), absent du premier chargement.
* Analyse symbolique + génération de texte dans `coach/worker.ts` (Web Worker) ; Stockfish dans son propre Worker.
* Partie complète de 40 coups : ≈ 120 recherches multi-PV ; budget mobile ≈ 25–40 s en mono-thread, avec progression.
* Modèle et curriculum : O(compétences × activités), < 2 ms.

## 8. Évaluation
* **Corpus étiqueté** (`tests/coach-corpus.ts`) : positions construites à la main pour chaque détecteur
  (positifs **et** négatifs) → précision / rappel par motif.
* **Corpus Lichess** (puzzles CC0 étiquetés par thème) : rappel des motifs sur la solution, précision mesurée
  contre les étiquettes (borne basse : les étiquettes Lichess sont incomplètes).
* **Exactitude des explications** : dans chaque puzzle Lichess, le coup de l’adversaire *est* une gaffe connue.
  On l’explique avec Stockfish et on vérifie : motif annoncé compatible avec les thèmes, matériel annoncé =
  matériel de la PV, mat annoncé = mat du moteur, aucune affirmation non soutenue.
* **Recommandations** : joueurs simulés (compétences latentes connues, réussite = logistique(latent − d)) ;
  on mesure l’erreur d’estimation (RMSE), la détection de la faiblesse principale (top-1 / top-3) et la part de
  puzzles proposés dans la zone 60–90 % de réussite.
* **Navigateur** (`tools/tmp/review-time.mjs`) : durée du bilan et images/s du fil principal pendant l’analyse.
* Résultats : `bench/coach-bench.json` et section PROGRESS.md.

## 9. Limites assumées
* Les explications positionnelles restent plus sommaires que les explications tactiques (pas de réseau entraîné
  pour « comprendre » les plans), d’où la formulation prudente.
* Hors ligne, pas de base de finales parfaite : Stockfish seul au-delà des schémas reconnus.
* Sur mobile mono-thread (GitHub Pages sans COOP/COEP), le bilan d’une partie prend plusieurs dizaines de secondes.
