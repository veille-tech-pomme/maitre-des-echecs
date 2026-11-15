import type { Lesson } from './types';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const AVANCE: Lesson[] = [
  { id: 'a-structures', level: 'avance', title: 'Les structures de pions', icon: '🧱', minutes: 10, summary: 'Pions passés, isolés, doublés, arriérés : l’ossature de la position.',
    steps: [
      { type: 'text', title: '« Les pions sont l’âme des échecs »', fen: '4k3/pp3ppp/8/3P4/8/8/PP3PPP/4K3 w - - 0 1', body: 'Cette phrase de **Philidor** (1749) reste vraie : la structure de pions décide des plans.\n\n- **Pion passé** : aucun pion adverse ne peut l’arrêter sur sa colonne ou les colonnes voisines. Une force !\n- **Pion isolé** : aucun pion ami sur les colonnes voisines. Difficile à défendre.\n- **Pions doublés** : deux pions sur la même colonne. Souvent faibles.\n- **Pion arriéré** : resté en arrière, il ne peut plus être soutenu par un pion.' },
      { type: 'exercise', title: 'Le pion passé', prompt: 'Touche le **pion passé** blanc.', fen: '4k3/pp3ppp/8/3P4/8/8/PP3PPP/4K3 w - - 0 1', goal: { kind: 'select', squares: ['d5'] }, hints: ['Regarde quelles colonnes n’ont pas de pions noirs.'] },
      { type: 'exercise', title: 'Le pion isolé', prompt: 'Touche le **pion isolé** blanc.', fen: '4k3/pp3ppp/4p3/8/3P4/8/PP3PPP/4K3 w - - 0 1', goal: { kind: 'select', squares: ['d4'] }, hints: ['Il n’a pas de voisin sur les colonnes c et e.'] },
      { type: 'exercise', title: 'Les pions doublés', prompt: 'Touche les **deux pions doublés** blancs.', fen: '4k3/pp3ppp/8/8/8/2P5/P1P2PPP/4K3 w - - 0 1', goal: { kind: 'select', squares: ['c2', 'c3'] } },
      { type: 'exercise', title: 'Pousser le passé', prompt: 'En finale, le roi devient une pièce d’attaque. Pousser d6 tout de suite serait prématuré (le roi noir l’arrête). Joue le coup logique.', fen: '4k3/pp3ppp/8/3P4/8/8/PP3PPP/4K3 w - - 0 1', goal: { kind: 'any', accept: ['Kd2', 'Ke2'] }, hints: ['Rapproche ton roi pour escorter le pion.'], success: 'Exact : « les pions passés doivent être poussés »… mais escortés par le roi !' },
    ] },
  { id: 'a-pieces', level: 'avance', title: 'Avant-postes, bons et mauvais fous', icon: '🐴', minutes: 10, summary: 'Placer ses pièces sur les meilleures cases.',
    steps: [
      { type: 'text', title: 'L’avant-poste', fen: '6k1/pp3ppp/3p4/4p3/4P3/2N5/PPP2PPP/6K1 w - - 0 1', shapes: ['d5', 'c3d5'], body: 'Un **avant-poste** est une case dans le camp adverse qui **ne peut plus être attaquée par un pion** adverse. Un cavalier y est souvent plus fort qu’une tour !\n\nIci, la case **d5** est un trou : les pions noirs c et e ne pourront jamais la contrôler.' },
      { type: 'exercise', title: 'Occupe l’avant-poste', prompt: 'Installe ton cavalier sur l’avant-poste.', fen: '6k1/pp3ppp/3p4/4p3/4P3/2N5/PPP2PPP/6K1 w - - 0 1', goal: { kind: 'any', accept: ['Nd5'] }, hints: ['La case d5 est idéale.'] },
      { type: 'text', title: 'Bon fou, mauvais fou', fen: '4k3/pp3ppp/4p3/3pP3/3P4/8/PP1B1PPP/4K3 w - - 0 1', body: 'Un fou est **mauvais** quand ses propres pions sont **sur sa couleur** : ils le bloquent. Ici, le fou blanc d2 (cases foncées) est gêné par les pions d4 et e5, également sur des cases foncées.\n\nRègle : place tes pions sur la couleur **opposée** à celle de ton fou, ou échange ton mauvais fou.' },
      { type: 'exercise', title: 'Mauvais fou ?', prompt: 'Dans la défense française (pions noirs e6-d5), quel fou noir est souvent « mauvais » ?', fen: 'rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3', goal: { kind: 'quiz', options: ['Le fou c8 (cases claires)', 'Le fou f8 (cases foncées)'], answer: 0 }, success: 'Oui : les pions e6 et d5 sont sur cases claires, comme le fou c8.' },
    ] },
  { id: 'a-colonnes', level: 'avance', title: 'Colonnes ouvertes et 7e rangée', icon: '🛣️', minutes: 8, summary: 'Activer ses tours.',
    steps: [
      { type: 'text', title: 'Les tours aiment l’espace', fen: 'r5k1/pp3ppp/2p5/8/8/2P5/PP3PPP/R4RK1 w - - 0 1', shapes: ['d1d8', 'e1e8'], body: 'Une **colonne ouverte** n’a plus aucun pion. C’est l’autoroute des tours !\n\n1. Occupe la colonne ouverte.\n2. Pénètre sur la **7e rangée** (la 2e pour les Noirs) : la tour y attaque les pions et enferme le roi.\n3. Deux tours sur la 7e (« les cochons ») sont souvent décisives.' },
      { type: 'exercise', title: 'Prends la colonne', prompt: 'Place une tour sur une **colonne ouverte**.', fen: 'r5k1/pp3ppp/2p5/8/8/2P5/PP3PPP/R4RK1 w - - 0 1', goal: { kind: 'any', accept: ['Rad1', 'Rfd1', 'Rae1', 'Rfe1'] }, hints: ['Les colonnes d et e n’ont plus de pions.'] },
      { type: 'exercise', title: 'La 7e rangée', prompt: 'Envahis la **7e rangée** avec ta tour.', fen: '6k1/pp3pp1/7p/8/8/8/PP3PPP/3R2K1 w - - 0 1', goal: { kind: 'any', accept: ['Rd7'] }, hints: ['De d7, la tour attaque b7 et f7.'] },
    ] },
  { id: 'a-opposition', level: 'avance', title: 'L’opposition', icon: '♚', minutes: 10, summary: 'La clé des finales de pions.',
    steps: [
      { type: 'text', title: 'Face à face', fen: '8/8/4k3/8/4K3/4P3/8/8 w - - 0 1', shapes: ['e4', 'e6'], body: 'Deux rois sont en **opposition** quand ils se font face avec **une case entre eux**. Celui qui **n’a pas le trait** « a l’opposition » : l’autre roi doit céder le passage.\n\nSur le diagramme, **si les Blancs ont le trait, c’est nulle** (les Noirs ont l’opposition) ; **si les Noirs ont le trait, les Blancs gagnent**.\n\nEn finale roi + pion contre roi, le camp fort veut placer son roi **devant** son pion et prendre l’opposition.' },
      { type: 'exercise', title: 'Roi devant le pion', prompt: 'Ton roi est déjà devant son pion, sur la 6e rangée : c’est gagnant ! **Va à dame** (20 coups max).', fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', goal: { kind: 'play', result: 'promote', maxMoves: 20 }, hints: ['Kd6 ou Kf6 en gardant le contact.', 'Pousse le pion seulement quand ton roi contrôle la case devant lui.'] },
      { type: 'exercise', title: 'Le temps de réserve', prompt: 'Gagne cette finale : utilise ton pion pour **reprendre l’opposition** au bon moment.', fen: '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1', goal: { kind: 'play', result: 'promote', maxMoves: 30 }, hints: ['Le coup de pion e3 permet de « perdre un temps ».', 'Ton roi doit atteindre une case clé : d5, e5 ou f5 puis la 6e rangée.'] },
    ] },
  { id: 'a-carre', level: 'avance', title: 'La règle du carré', icon: '⬛', minutes: 6, summary: 'Savoir en un coup d’œil si un roi rattrape un pion.',
    steps: [
      { type: 'text', title: 'Le carré du pion', fen: '8/8/8/5k2/P7/8/8/K7 b - - 0 1', shapes: ['a4', 'e4', 'e8', 'a8'], body: 'Trace un **carré** depuis le pion jusqu’à sa case de promotion. Si le roi adverse peut **entrer dans le carré** (en tenant compte du trait), il rattrape le pion. Sinon, le pion va à dame !' },
      { type: 'exercise', title: 'Rattrape-t-il ?', prompt: 'Les Noirs jouent. Le roi noir rattrape-t-il le pion a4 ?', fen: '8/8/8/5k2/P7/8/8/K7 b - - 0 1', goal: { kind: 'quiz', options: ['Oui', 'Non'], answer: 0, verify: 'draw' }, success: 'Oui : en jouant Re5 (ou Re4), il entre dans le carré a4-e4-e8-a8.' },
      { type: 'exercise', title: 'Et maintenant ?', prompt: 'Le roi est une colonne plus loin. Rattrape-t-il le pion ?', fen: '8/8/8/6k1/P7/8/8/K7 b - - 0 1', goal: { kind: 'quiz', options: ['Oui', 'Non'], answer: 1, verify: 'win' }, success: 'Non : même en jouant tout de suite, il reste hors du carré.' },
      { type: 'exercise', title: 'Course !', prompt: 'Va à dame avant le roi noir.', fen: '8/8/8/6k1/P7/8/8/K7 w - - 0 1', goal: { kind: 'play', result: 'promote', maxMoves: 6 }, hints: ['Pousse !'] },
    ] },
  { id: 'a-lucena', level: 'avance', title: 'La position de Lucena', icon: '🌉', minutes: 10, summary: 'Gagner la finale tour + pion : « construire un pont ».',
    steps: [
      { type: 'text', title: 'Construire un pont', fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1', body: 'La **position de Lucena** (1497 !) est la finale gagnante la plus importante.\n\nLe roi blanc est devant son pion en b8, le roi noir est **coupé** par la tour c1. La méthode :\n1. Donne un échec pour éloigner le roi noir (Td1+).\n2. Ramène la tour sur la **4e rangée** (Td4).\n3. Sors le roi : quand les échecs latéraux arrivent, la tour vient **s’interposer** (le « pont »).' },
      { type: 'exercise', title: 'À toi de construire !', prompt: 'Gagne la position de Lucena : **va à dame** (30 coups max). Le moteur défend.', fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1', goal: { kind: 'play', result: 'promote', maxMoves: 30 }, hints: ['Commence par Td1+.', 'Puis Td4 pour préparer le pont.'] },
    ] },
  { id: 'a-philidor', level: 'avance', title: 'La position de Philidor', icon: '🛡️', minutes: 10, summary: 'Annuler la finale tour + pion : la défense de la 3e rangée.',
    steps: [
      { type: 'text', title: 'La défense parfaite', fen: '4k3/R7/1r6/3KP3/8/8/8/8 b - - 0 1', shapes: ['b6', 'a6h6'], body: 'Tu défends (Noirs). La méthode **Philidor** :\n1. Garde ta tour sur ta **3e rangée** (ici la 6e) pour empêcher le roi blanc d’avancer.\n2. Dès que le pion avance sur cette rangée (e6), le roi blanc n’a plus d’abri : ta tour file **tout en bas** et donne des **échecs par derrière**.' },
      { type: 'exercise', title: 'Tiens la nulle', prompt: 'Défends-toi pendant **12 coups** sans perdre. Le moteur attaque.', fen: '4k3/R7/1r6/3KP3/8/8/8/8 b - - 0 1', orientation: 'black', goal: { kind: 'play', result: 'draw', maxMoves: 12 }, hints: ['Reste sur la 6e rangée tant que le pion est en e5.', 'Si e6, joue Tb1 et donne des échecs par derrière.'] },
    ] },
  { id: 'a-ouv-ouvertes', level: 'avance', title: 'Les parties ouvertes (1.e4 e5)', icon: '📖', minutes: 12, summary: 'Italienne et Espagnole : les idées et les premiers coups.',
    steps: [
      { type: 'demo', title: 'La partie italienne', fen: START, moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb4+'], comments: { 4: 'Le fou vise f7.', 6: 'c3 prépare d4.', 8: 'Le grand centre !', 11: 'Les Noirs gênent avec un échec.' }, body: 'Le **Giuoco Piano** : développement rapide et lutte pour le centre.' },
      { type: 'exercise', title: 'Joue l’Italienne', prompt: 'Joue les coups blancs de l’Italienne (Giuoco Piano) jusqu’à **d4**.', fen: START, goal: { kind: 'line', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4'] }, hints: ['e4, Cf3, Fc4, c3, d4.'] },
      { type: 'demo', title: 'La partie espagnole', fen: START, moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O'], comments: { 4: 'Le fou attaque le défenseur de e5.', 5: 'a6 : la défense Morphy.', 8: 'Roque d’abord.', 14: 'c3 prépare d4.' }, body: 'La **Ruy Lopez**, ouverture préférée de nombreux champions du monde.' },
      { type: 'exercise', title: 'Joue l’Espagnole', prompt: 'Joue les coups blancs de l’Espagnole fermée jusqu’à **c3**.', fen: START, goal: { kind: 'line', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3'] }, hints: ['Fb5, Fa4, roque, Te1, Fb3, c3.'] },
    ] },
  { id: 'a-ouv-e4', level: 'avance', title: 'Répondre à 1.e4', icon: '🛡️', minutes: 12, summary: 'Sicilienne, Française, Caro-Kann : trois philosophies.',
    steps: [
      { type: 'text', title: 'Trois défenses', fen: START, pre: ['e4'], body: '- **Sicilienne (1…c5)** : combative et déséquilibrée.\n- **Française (1…e6)** : solide, on attaque la chaîne de pions blanche.\n- **Caro-Kann (1…c6)** : très solide, le fou c8 sort avant …e6.' },
      { type: 'exercise', title: 'La Najdorf', prompt: 'Avec les Noirs, joue la **Sicilienne Najdorf** jusqu’à …a6.', fen: START, pre: ['e4'], orientation: 'black', goal: { kind: 'line', moves: ['c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'] }, hints: ['…c5, …d6, …cxd4, …Cf6, …a6.'] },
      { type: 'exercise', title: 'La Française', prompt: 'Joue la **Française, variante d’avance** jusqu’à …Db6.', fen: START, pre: ['e4'], orientation: 'black', goal: { kind: 'line', moves: ['e6', 'd4', 'd5', 'e5', 'c5', 'c3', 'Nc6', 'Nf3', 'Qb6'] }, hints: ['…e6, …d5, puis attaque la base de la chaîne avec …c5.'] },
      { type: 'exercise', title: 'La Caro-Kann', prompt: 'Joue la **Caro-Kann classique** jusqu’à …Fg6.', fen: START, pre: ['e4'], orientation: 'black', goal: { kind: 'line', moves: ['c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5', 'Ng3', 'Bg6'] }, hints: ['…c6, …d5, …dxe4, …Ff5 : le fou sort avant …e6.'] },
    ] },
  { id: 'a-ouv-d4', level: 'avance', title: 'Les jeux fermés (1.d4)', icon: '♕', minutes: 10, summary: 'Gambit Dame, Londres et défenses indiennes.',
    steps: [
      { type: 'demo', title: 'Le Gambit Dame refusé', fen: START, moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'O-O', 'Nf3'], comments: { 2: 'On « offre » le pion c4.', 3: 'Les Noirs maintiennent d5.', 6: 'Fg5 cloue le cavalier défenseur de d5.' }, body: 'Le **Gambit Dame** est la base du jeu positionnel.' },
      { type: 'exercise', title: 'Le Gambit Dame', prompt: 'Joue les coups blancs du **Gambit Dame refusé** jusqu’à Cf3.', fen: START, goal: { kind: 'line', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'O-O', 'Nf3'] }, hints: ['d4, c4, Cc3, Fg5, e3, Cf3.'] },
      { type: 'exercise', title: 'Le système de Londres', prompt: 'Joue la mise en place du **système de Londres**.', fen: START, goal: { kind: 'line', moves: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'c5', 'c3', 'Nc6', 'Nbd2'] }, hints: ['Le fou f4 sort AVANT e3.', 'Pyramide c3-d4-e3, puis Cbd2.'] },
      { type: 'exercise', title: 'L’Est-indienne', prompt: 'Avec les Noirs, joue l’**Est-indienne** jusqu’au roque.', fen: START, pre: ['d4'], orientation: 'black', goal: { kind: 'line', moves: ['Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O'] }, hints: ['…Cf6, …g6, …Fg7, …d6, …O-O.'] },
    ] },
];
