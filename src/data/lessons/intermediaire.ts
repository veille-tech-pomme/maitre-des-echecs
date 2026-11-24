import type { Lesson } from './types';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const INTERMEDIAIRE: Lesson[] = [
  { id: 'i-principes', level: 'intermediaire', title: 'Les principes de l’ouverture', icon: '🚀', minutes: 8, summary: 'Centre, développement, roque : bien démarrer chaque partie.',
    steps: [
      { type: 'text', title: 'Les 3 règles d’or', fen: START, shapes: ['d4', 'e4', 'd5', 'e5'], body: '1. **Contrôle le centre** avec tes pions (e4, d4) et tes pièces.\n2. **Développe** tes pièces mineures (cavaliers et fous) vers le centre, **avant** la dame et les tours.\n3. **Roque tôt** pour mettre ton roi à l’abri et relier tes tours.\n\nBonus : ne joue pas deux fois la même pièce sans raison, et ne sors pas ta dame trop tôt.' },
      { type: 'exercise', title: 'Développe !', prompt: 'Après 1.e4 e5, joue un coup qui **développe une pièce** ou **prend le centre**.', fen: START, pre: ['e4', 'e5'], goal: { kind: 'any', accept: ['Nf3', 'Bc4', 'Nc3', 'd4', 'Bb5'] }, hints: ['Le cavalier g1 aime la case f3 : il attaque e5.'] },
      { type: 'exercise', title: 'Le coup anti-principe', prompt: 'Après 1.e4 e5 2.Cf3 Cc6, lequel de ces coups respecte le **moins** les principes ?', fen: START, pre: ['e4', 'e5', 'Nf3', 'Nc6'], goal: { kind: 'quiz', options: ['Fc4 : développe le fou', 'd4 : ouvre le centre', 'h4 : avance un pion du bord'], answer: 2 }, success: 'Oui : h4 ne développe rien et ne contrôle pas le centre.' },
      { type: 'exercise', title: 'À l’abri !', prompt: 'Tes pièces de l’aile roi sont sorties. Mets ton roi en sécurité.', fen: START, pre: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], goal: { kind: 'any', accept: ['O-O'] }, hints: ['Le roque, c’est maintenant !'] },
      { type: 'demo', title: 'Une ouverture modèle', fen: START, moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O'], comments: { 0: 'Centre.', 2: 'Développement + attaque e5.', 4: 'Le fou vise f7.', 6: 'Prépare d4.', 10: 'Roque : roi à l’abri.' }, body: 'Les deux camps suivent les principes : centre, développement, roque.' },
    ] },
  { id: 'i-fourchette', level: 'intermediaire', title: 'La fourchette', icon: '🍴', minutes: 8, summary: 'Attaquer deux pièces à la fois.',
    steps: [
      { type: 'text', title: 'Double attaque', fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', shapes: ['b5c7', 'c7a8', 'c7e8'], body: 'Une **fourchette** est une attaque **simultanée** de deux pièces (ou plus). L’adversaire ne peut en sauver qu’une !\n\nLe **cavalier** est le roi des fourchettes, car ses attaques sont difficiles à voir. Mais toutes les pièces, même les pions, peuvent fourchetter.' },
      { type: 'exercise', title: 'Fourchette royale', prompt: 'Trouve la fourchette du cavalier et gagne la tour.', fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', goal: { kind: 'line', moves: ['Nc7+', 'Kd7', 'Nxa8'] }, hints: ['Cherche une case d’où le cavalier attaque le roi ET la tour.', 'La case c7.'] },
      { type: 'exercise', title: 'Le pion fourchette', prompt: 'Un simple pion peut attaquer deux pièces. Trouve la fourchette !', fen: '4k3/8/8/2n1b3/8/2PP4/8/4K3 w - - 0 1', goal: { kind: 'line', moves: ['d4', 'Nd7', 'dxe5'] }, hints: ['Un pion attaque les deux cases en diagonale devant lui.'] },
      { type: 'exercise', title: 'La dame fourchette', prompt: 'Échec… et la tour tombe.', fen: 'r5k1/6pp/8/8/8/8/6PP/3Q2K1 w - - 0 1', goal: { kind: 'line', moves: ['Qd5+', 'Kh8', 'Qxa8+'] }, hints: ['Trouve une case qui attaque g8 (en diagonale) et a8.'] },
      { type: 'puzzles', title: 'Fourchettes réelles', body: 'Des fourchettes tirées de vraies parties.', themes: ['fork'], count: 5, maxRating: 1300 },
    ] },
  { id: 'i-clouage', level: 'intermediaire', title: 'Le clouage', icon: '📌', minutes: 8, summary: 'Immobiliser une pièce devant une pièce plus précieuse.',
    steps: [
      { type: 'text', title: 'Cloué !', fen: 'rnbqkb1r/ppp2ppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR b KQkq - 2 4', shapes: ['g5d8'], body: 'Une pièce est **clouée** quand elle ne peut pas bouger sans exposer une pièce plus importante derrière elle.\n\n- **Clouage absolu** : derrière, c’est le **roi**. La pièce clouée n’a **pas le droit** de bouger.\n- **Clouage relatif** : derrière, c’est une autre pièce (ici la dame d8). Bouger est permis… mais coûteux.' },
      { type: 'exercise', title: 'Cloue le cavalier', prompt: 'Joue le coup classique qui **cloue** le cavalier f6 contre la dame noire.', fen: 'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 1 4', goal: { kind: 'any', accept: ['Bg5'] }, hints: ['Ton fou c1 peut se placer sur la diagonale f6-d8.'] },
      { type: 'exercise', title: 'Clouage de la dame', prompt: 'Cloue la dame noire contre son roi et gagne-la !', fen: '4k3/8/8/4q3/8/8/3K4/R7 w - - 0 1', goal: { kind: 'line', moves: ['Re1', 'Qxe1+', 'Kxe1'] }, hints: ['La dame et le roi noirs sont sur la même colonne.', 'Ta tour sera protégée par ton roi.'] },
      { type: 'exercise', title: 'Attaque la pièce clouée', prompt: 'Le cavalier e6 est cloué. Attaque-le avec un pion !', fen: '4k3/8/4n3/8/3P4/8/8/4R1K1 w - - 0 1', goal: { kind: 'any', accept: ['d5'] }, success: 'Le cavalier ne peut pas bouger sans exposer le roi : il est perdu. Après 1…Rf7 (le roi sort du clouage), 2.dxe6+ ou 2.Txe6 le ramasse.', hints: ['Une pièce clouée ne peut pas fuir.'] },
      { type: 'puzzles', title: 'Clouages réels', body: 'À toi de jouer !', themes: ['pin'], count: 5, maxRating: 1400 },
    ] },
  { id: 'i-enfilade', level: 'intermediaire', title: 'L’enfilade et les rayons X', icon: '🎯', minutes: 6, summary: 'Le clouage à l’envers : la pièce précieuse est devant.',
    steps: [
      { type: 'text', title: 'L’enfilade', fen: 'q7/8/8/3k4/8/5B2/8/4K3 b - - 0 1', shapes: ['f3d5', 'd5a8'], body: 'Dans une **enfilade**, on attaque une pièce **précieuse** (souvent le roi) ; quand elle s’écarte, on prend la pièce **derrière** elle.' },
      { type: 'exercise', title: 'Enfilade du fou', prompt: 'Donne échec pour gagner la dame cachée derrière le roi.', fen: 'q7/8/8/3k4/8/8/4B3/4K3 w - - 0 1', goal: { kind: 'line', moves: ['Bf3+', 'Kc5', 'Bxa8'] }, hints: ['Le roi d5 et la dame a8 sont sur la même diagonale.'] },
      { type: 'puzzles', title: 'Enfilades réelles', body: 'Repère les pièces alignées.', themes: ['skewer'], count: 4, maxRating: 1500 },
    ] },
  { id: 'i-decouverte', level: 'intermediaire', title: 'Découverte et échec double', icon: '💥', minutes: 8, summary: 'Une pièce bouge, une autre attaque.',
    steps: [
      { type: 'text', title: 'L’attaque à la découverte', fen: '4k3/3q4/8/4N3/8/8/8/4R1K1 w - - 0 1', shapes: ['e1e8', 'e5d7'], body: 'Quand une pièce s’écarte et **démasque** l’attaque d’une pièce à longue portée (tour, fou, dame) derrière elle, c’est une **attaque à la découverte**.\n\nLa pièce qui bouge est libre de créer sa propre menace : deux attaques en un coup !' },
      { type: 'exercise', title: 'Échec à la découverte', prompt: 'Bouge le cavalier pour démasquer un échec… et gagne la dame !', fen: '4k3/3q4/8/4N3/8/8/8/4R1K1 w - - 0 1', goal: { kind: 'any', accept: ['Nxd7+'] }, hints: ['Le cavalier peut prendre quelque chose en partant.'] },
      { type: 'text', title: 'L’échec double', fen: '3qkb2/3p1p2/8/8/4N3/8/8/4R1K1 w - - 0 1', body: 'Si la pièce qui bouge donne **aussi** échec, c’est un **échec double** : deux pièces attaquent le roi en même temps. On ne peut ni bloquer ni prendre les deux : **seul le roi peut bouger**.' },
      { type: 'exercise', title: 'Mat par échec double', prompt: '**Mat en 1** grâce à un échec double.', fen: '3qkb2/3p1p2/8/8/4N3/8/8/4R1K1 w - - 0 1', goal: { kind: 'mate' }, hints: ['Le cavalier doit donner échec lui aussi.'] },
      { type: 'puzzles', title: 'Découvertes réelles', body: 'Attaques à la découverte et échecs doubles.', themes: ['discoveredAttack', 'doubleCheck'], count: 5, maxRating: 1500 },
    ] },
  { id: 'i-materiel', level: 'intermediaire', title: 'Pièces en prise et échanges', icon: '🧮', minutes: 7, summary: 'Compter attaquants et défenseurs pour ne plus rien perdre.',
    steps: [
      { type: 'text', title: 'Compter', fen: '4k3/2p2p2/1n6/3b4/8/8/8/4K3 w - - 0 1', body: 'Avant chaque prise, **compte** : combien de pièces attaquent la case ? Combien la défendent ?\n\nUne pièce **en prise** (attaquée et pas assez défendue) est la cause n°1 des défaites chez les débutants. Prends l’habitude de vérifier **toutes** tes pièces à chaque coup.' },
      { type: 'exercise', title: 'Le maillon faible', prompt: 'Touche la seule pièce noire qui **n’est protégée par rien**.', fen: '4k3/2p2p2/1n6/3b4/8/8/8/4K3 w - - 0 1', goal: { kind: 'select', squares: ['c7'] }, hints: ['Le fou d5 est protégé par le cavalier, le cavalier par le pion c7…'] },
      { type: 'exercise', title: 'Bon échange ?', prompt: 'Tu peux échanger ton fou (3) contre un cavalier (3), ou ta tour (5) contre un fou (3). Quel échange est **défavorable** ?', fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', goal: { kind: 'quiz', options: ['Fou contre cavalier', 'Tour contre fou'], answer: 1 }, success: 'Exact : donner 5 pour 3, c’est perdre « la qualité ».' },
      { type: 'text', title: 'Quand échanger ?', fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', body: '- **En avance** de matériel : échange les **pièces** (pas les pions), la finale sera facile.\n- **En retard** : évite les échanges, garde des chances d’attaque.\n- Échange une **mauvaise** pièce contre une **bonne** pièce adverse.' },
      { type: 'puzzles', title: 'Pièces en prise', body: 'Repère les pièces sans défense.', themes: ['hangingPiece'], count: 5, maxRating: 1300 },
    ] },
  { id: 'i-couloir', level: 'intermediaire', title: 'Le mat du couloir', icon: '🚪', minutes: 7, summary: 'Le roi enfermé derrière ses pions.',
    steps: [
      { type: 'exercise', title: 'La dame descend', prompt: '**Mat en 1**.', fen: '6k1/5ppp/8/8/8/8/5PPP/4Q1K1 w - - 0 1', goal: { kind: 'mate' }, hints: ['La 8e rangée n’est pas défendue.'] },
      { type: 'exercise', title: 'Détourne le défenseur', prompt: 'La tour e8 défend la dernière rangée. **Mat en 2** : élimine-la !', fen: '3qr1k1/5ppp/8/8/8/8/4RPPP/4Q1K1 w - - 0 1', goal: { kind: 'line', moves: ['Rxe8+', 'Qxe8', 'Qxe8#'] }, hints: ['Prends la tour avec échec.', 'Après la reprise, ta dame entre en e8.'] },
      { type: 'exercise', title: 'Se protéger', prompt: 'Quelle est la meilleure façon d’éviter le mat du couloir ?', fen: '6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1', goal: { kind: 'quiz', options: ['Ouvrir une « case de fuite » (par exemple h3 ou g3) au bon moment', 'Ne jamais roquer', 'Mettre tous ses pions en 4e rangée'], answer: 0 } },
      { type: 'puzzles', title: 'Mats du couloir', body: 'Le classique des classiques.', themes: ['backRankMate'], count: 5, maxRating: 1400 },
    ] },
  { id: 'i-mat-dame', level: 'intermediaire', title: 'Mater avec la dame', icon: '👸', minutes: 8, summary: 'Roi + dame contre roi : la technique de la « boîte ».',
    steps: [
      { type: 'text', title: 'La méthode', fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', body: '1. Avec la dame, **enferme** le roi adverse dans une « boîte » de plus en plus petite (joue la dame à un **saut de cavalier** du roi).\n2. Repousse-le jusqu’au **bord**.\n3. Fais venir **ton roi** pour aider.\n4. Mate !\n\n⚠️ Attention au **pat** : laisse toujours au moins une case au roi adverse tant que tu ne donnes pas mat.' },
      { type: 'exercise', title: 'À toi !', prompt: 'Mate le roi noir. Le moteur défend au mieux. Objectif : **25 coups maximum**.', fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', goal: { kind: 'play', result: 'mate', maxMoves: 25 }, hints: ['Commence par Dd4 ou De2 pour couper le roi.', 'Fais monter ton roi.'] },
    ] },
  { id: 'i-mat-tour', level: 'intermediaire', title: 'Mater avec la tour', icon: '🗼', minutes: 10, summary: 'Roi + tour contre roi : l’opposition et la coupure.',
    steps: [
      { type: 'text', title: 'La méthode', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', body: '1. La tour **coupe** le roi adverse sur une rangée ou une colonne.\n2. Ton roi s’approche et se met **en opposition** (face au roi adverse, une case entre eux).\n3. À ce moment, la tour donne **échec** et repousse le roi d’une rangée.\n4. Si le roi adverse refuse l’opposition, fais un **coup d’attente** avec la tour.' },
      { type: 'exercise', title: 'À toi !', prompt: 'Mate avec roi et tour en **40 coups maximum**.', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', goal: { kind: 'play', result: 'mate', maxMoves: 40 }, hints: ['Coupe d’abord le roi avec la tour (Ta4 par exemple).', 'Ton roi doit venir aider : la tour seule ne peut rien.'] },
    ] },
  { id: 'a-opposition', level: 'intermediaire', title: 'L’opposition', icon: '♚', minutes: 10, summary: 'La clé des finales de pions.',
    steps: [
      { type: 'text', title: 'Face à face', fen: '8/8/4k3/8/4K3/4P3/8/8 w - - 0 1', shapes: ['e4', 'e6'], body: 'Deux rois sont en **opposition** quand ils se font face avec **une case entre eux**. Celui qui **n’a pas le trait** « a l’opposition » : l’autre roi doit céder le passage.\n\nSur le diagramme, **si les Blancs ont le trait, c’est nulle** (les Noirs ont l’opposition) ; **si les Noirs ont le trait, les Blancs gagnent**.\n\nEn finale roi + pion contre roi, le camp fort veut placer son roi **devant** son pion et prendre l’opposition.' },
      { type: 'exercise', title: 'Roi devant le pion', prompt: 'Ton roi est déjà devant son pion, sur la 6e rangée : c’est gagnant ! **Va à dame** (20 coups max).', fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', goal: { kind: 'play', result: 'promote', maxMoves: 20 }, hints: ['Kd6 ou Kf6 en gardant le contact.', 'Pousse le pion seulement quand ton roi contrôle la case devant lui.'] },
      { type: 'exercise', title: 'Le temps de réserve', prompt: 'Gagne cette finale : utilise ton pion pour **reprendre l’opposition** au bon moment.', fen: '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1', goal: { kind: 'play', result: 'promote', maxMoves: 30 }, hints: ['Le coup de pion e3 permet de « perdre un temps ».', 'Ton roi doit atteindre une case clé : d5, e5 ou f5 puis la 6e rangée.'] },
    ] },
  { id: 'a-carre', level: 'intermediaire', title: 'La règle du carré', icon: '⬛', minutes: 6, summary: 'Savoir en un coup d’œil si un roi rattrape un pion.',
    steps: [
      { type: 'text', title: 'Le carré du pion', fen: '8/8/8/5k2/P7/8/8/K7 b - - 0 1', shapes: ['a4', 'e4', 'e8', 'a8'], body: 'Trace un **carré** depuis le pion jusqu’à sa case de promotion. Si le roi adverse peut **entrer dans le carré** (en tenant compte du trait), il rattrape le pion. Sinon, le pion va à dame !' },
      { type: 'exercise', title: 'Rattrape-t-il ?', prompt: 'Les Noirs jouent. Le roi noir rattrape-t-il le pion a4 ?', fen: '8/8/8/5k2/P7/8/8/K7 b - - 0 1', goal: { kind: 'quiz', options: ['Oui', 'Non'], answer: 0, verify: 'draw' }, success: 'Oui : en jouant Re5 (ou Re4), il entre dans le carré a4-e4-e8-a8.' },
      { type: 'exercise', title: 'Et maintenant ?', prompt: 'Le roi est une colonne plus loin. Rattrape-t-il le pion ?', fen: '8/8/8/6k1/P7/8/8/K7 b - - 0 1', goal: { kind: 'quiz', options: ['Oui', 'Non'], answer: 1, verify: 'win' }, success: 'Non : même en jouant tout de suite, il reste hors du carré.' },
      { type: 'exercise', title: 'Course !', prompt: 'Va à dame avant le roi noir.', fen: '8/8/8/6k1/P7/8/8/K7 w - - 0 1', goal: { kind: 'play', result: 'promote', maxMoves: 6 }, hints: ['Pousse !'] },
    ] },
  { id: 'i-mats-typiques', level: 'intermediaire', title: 'Les mats typiques', icon: '🧩', minutes: 8, summary: 'Mat à l’étouffée, mat arabe et autres motifs à reconnaître.',
    steps: [
      { type: 'exercise', title: 'Mat à l’étouffée', prompt: 'Le roi est étouffé par ses propres pièces. **Mat en 1** !', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', goal: { kind: 'mate' }, hints: ['Seul le cavalier peut atteindre un roi entouré.'] },
      { type: 'exercise', title: 'Mat arabe', prompt: 'Tour et cavalier coopèrent : **mat en 1**.', fen: '7k/R7/5N2/8/8/8/8/6K1 w - - 0 1', goal: { kind: 'mate' }, hints: ['Le cavalier protège h7.'] },
      { type: 'puzzles', title: 'Motifs de mat', body: 'Étouffée, arabe, Anastasia, crochet…', themes: ['smotheredMate', 'arabianMate', 'anastasiaMate', 'hookMate'], count: 5, maxRating: 1600 },
    ] },
  { id: 'i-calcul', level: 'intermediaire', title: 'Échecs, prises, menaces', icon: '🔍', minutes: 8, summary: 'La méthode pour trouver les combinaisons.',
    steps: [
      { type: 'text', title: 'La méthode ÉPM', fen: '6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1', body: 'À chaque coup, examine **dans cet ordre** :\n1. Tous les **Échecs**\n2. Toutes les **Prises**\n3. Toutes les **Menaces**\n\nLes coups forcés (échecs, prises) limitent les réponses adverses : c’est là que se cachent les combinaisons.' },
      { type: 'exercise', title: 'Mat en 2', prompt: 'Les deux tours travaillent ensemble : **mat en 2**.', fen: '6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1', goal: { kind: 'line', moves: ['Ra7', 'Kf8', 'Rb8#'] }, hints: ['Parfois, le premier coup n’est pas un échec : enferme d’abord le roi.', 'Une tour sur la 7e rangée, l’autre donne mat sur la 8e.'] },
      { type: 'puzzles', title: 'Mats en 2', body: 'Applique la méthode ÉPM.', themes: ['mateIn2'], count: 5, maxRating: 1400 },
    ] },
];
