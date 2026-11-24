import type { Lesson } from './types';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const OPERA = 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#'.split(' ');
export const IMMORTELLE = 'e4 e5 f4 exf4 Bc4 Qh4+ Kf1 b5 Bxb5 Nf6 Nf3 Qh6 d3 Nh5 Nh4 Qg5 Nf5 c6 g4 Nf6 Rg1 cxb5 h4 Qg6 h5 Qg5 Qf3 Ng8 Bxf4 Qf6 Nc3 Bc5 Nd5 Qxb2 Bd6 Bxg1 e5 Qxa1+ Ke2 Na6 Nxg7+ Kd8 Qf6+ Nxf6 Be7#'.split(' ');
export const TOUJOURS_JEUNE = 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O d3 Qb3 Qf6 e5 Qg6 Re1 Nge7 Ba3 b5 Qxb5 Rb8 Qa4 Bb6 Nbd2 Bb7 Ne4 Qf5 Bxd3 Qh5 Nf6+ gxf6 exf6 Rg8 Rad1 Qxf3 Rxe7+ Nxe7 Qxd7+ Kxd7 Bf5+ Ke8 Bd7+ Kf8 Bxe7#'.split(' ');
export const SIECLE = 'Nf3 Nf6 c4 g6 Nc3 Bg7 d4 O-O Bf4 d5 Qb3 dxc4 Qxc4 c6 e4 Nbd7 Rd1 Nb6 Qc5 Bg4 Bg5 Na4 Qa3 Nxc3 bxc3 Nxe4 Bxe7 Qb6 Bc4 Nxc3 Bc5 Rfe8+ Kf1 Be6 Bxb6 Bxc4+ Kg1 Ne2+ Kf1 Nxd4+ Kg1 Ne2+ Kf1 Nc3+ Kg1 axb6 Qb4 Ra4 Qxb6 Nxd1 h3 Rxa2 Kh2 Nxf2 Re1 Rxe1 Qd8+ Bf8 Nxe1 Bd5 Nf3 Ne4 Qb8 b5 h4 h5 Ne5 Kg7 Kg1 Bc5+ Kf1 Ng3+ Ke1 Bb4+ Kd1 Bb3+ Kc1 Ne2+ Kb1 Nc3+ Kc1 Rc2#'.split(' ');
export const LEGAL = 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#'.split(' ');

export const EXPERT: Lesson[] = [
  { id: 'e-calcul', level: 'expert', title: 'Le calcul : coups candidats', icon: '🧠', minutes: 12, summary: 'Calculer comme un maître : candidats, coups tranquilles, vérification, visualisation.',
    steps: [
      { type: 'text', title: 'La méthode Kotov', fen: START, body: 'Le grand maître **Alexandre Kotov** recommandait :\n1. Liste **tous les coups candidats** (échecs, prises, menaces, coups d’amélioration).\n2. Calcule **chaque branche une seule fois**, jusqu’à une position calme.\n3. **Évalue** la position finale (matériel, sécurité du roi, activité).\n4. Avant de jouer, fais une **vérification aveugle** : « Quelle est la meilleure réponse adverse ? »' },
      { type: 'text', title: 'Quand rien n’est forcé', fen: 'r4r1k/1bq1bpnp/p2pp3/1p2P1Qn/3N1P2/2NB4/PPP3PP/2KRR3 w - - 1 18', body: 'La plupart des positions n’ont **pas de ligne forcée**. Les coups candidats incluent alors des **coups tranquilles** (une pièce qui se replace avec une menace, une poussée de pion).\n\nAvant de te jeter sur une prise ou un échec, fais toujours deux vérifications :\n1. **Qu’est-ce qui est attaqué chez moi ?**\n2. **Quelle est la meilleure réponse adverse à mon coup ?**' },
      { type: 'exercise', title: 'Trois candidats', prompt: 'Les Blancs jouent. Compare les trois candidats : lequel garde l’avantage ?', fen: 'r4r1k/1bq1bpnp/p2pp3/1p2P1Qn/3N1P2/2NB4/PPP3PP/2KRR3 w - - 1 18', goal: { kind: 'quiz', options: ['Cxe6 : la prise du pion', 'Dh6 : la dame se replace en menaçant', 'Cdxb5 : la prise à l’aile dame'], answer: 1 }, success: 'Dh6 ! (moteur : +3,8). Les deux prises oublient la première vérification : la dame g5 est attaquée par le fou e7. Après Cxe6 ? ou Cdxb5 ?, 18…Fxg5 gagne la dame (moteur : −3,5).' },
      { type: 'exercise', title: 'Le coup tranquille', prompt: 'Les Blancs jouent. Les prises en f4 sont tentantes… mais calcule la réponse noire. Trouve mieux.', fen: 'r3qrk1/1ppbbp1n/p6Q/8/4Pp2/2NB3P/PPP3P1/R4RK1 w - - 0 17', goal: { kind: 'any', accept: ['e5'] }, hints: ['Txf4 ? Fg5 ! et la dame h6 est prise ; Dxf4 ? Fc5+ puis Fd6 chasse la dame.', 'Une poussée de pion ouvre la diagonale du fou d3 vers h7.'], success: 'e5 ! (moteur : +4,4) : la diagonale du fou d3 vers h7 s’ouvre et l’attaque blanche sur le roi devient décisive. Txf4 ? Fg5 ! (Dxg5+ Cxg5) et Dxf4 ? Fc5+ 18.Rh1 Fd6 donnent l’avantage aux Noirs (moteur : −3,6).' },
      { type: 'exercise', title: 'Visualise', prompt: 'Sans toucher aux pièces, joue dans ta tête : **1.e4 e5 2.Fc4 Cc6 3.Dh5 Cf6 ??** Quel coup blanc gagne maintenant ?', fen: START, goal: { kind: 'quiz', options: ['Dxf7#', 'Dxe5+', 'Fxf7+'], answer: 0 }, success: 'Dxf7# : la dame h5 et le fou c4 visent tous deux f7, et le cavalier f6 ne défend pas cette case. C’est le mat du berger, vu sans l’échiquier.' },
      { type: 'puzzles', title: 'Mats en 3', body: 'Calcule toute la variante avant de jouer.', themes: ['mateIn3'], count: 5, minRating: 1500, maxRating: 2100 },
    ] },
  { id: 'e-prophylaxie', level: 'expert', title: 'La prophylaxie', icon: '🔮', minutes: 10, summary: '« Que veut mon adversaire ? » : empêcher ses plans avant qu’ils n’arrivent.',
    steps: [
      { type: 'text', title: 'Penser pour l’adversaire', fen: START, body: 'Le concept de **prophylaxie** a été théorisé par **Aron Nimzowitsch** et perfectionné par **Petrossian** et **Karpov**.\n\nAvant chaque coup, demande-toi : **« Si c’était à mon adversaire de jouer, que ferait-il ? »** Puis empêche ce plan, si c’est possible sans affaiblir ta position.\n\nExemples : h3 pour empêcher …Fg4, a4 pour stopper …b5, ou une tour placée en avance sur la colonne qui va s’ouvrir.' },
      { type: 'exercise', title: 'Le coup préventif', prompt: 'Les Noirs voudraient jouer …Fg4 pour clouer ton cavalier. Quel coup classique l’empêche ?', fen: START, pre: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O'], goal: { kind: 'any', accept: ['h3'] }, hints: ['Un petit coup de pion à l’aile roi.'] },
      { type: 'puzzles', title: 'Coups défensifs', body: 'Trouve le coup qui neutralise la menace.', themes: ['defensiveMove'], count: 5, minRating: 1500, maxRating: 2200 },
    ] },
  { id: 'e-plans', level: 'expert', title: 'Les plans stratégiques', icon: '🗺️', minutes: 12, summary: 'Attaque de minorité, majorité de pions, jeu sur les deux ailes.',
    steps: [
      { type: 'text', title: 'L’attaque de minorité', fen: 'r4rk1/pp3ppp/2p5/3p4/3P4/4P3/PP3PPP/R4RK1 w - - 0 1', shapes: ['b2b4', 'b4b5'], body: 'Dans la structure du **Gambit Dame (variante d’échange)**, les Blancs ont 2 pions (a, b) contre 3 (a, b, c) à l’aile dame. Pourtant, ils **attaquent** avec cette minorité : b4-b5 pour échanger et laisser aux Noirs un **pion c arriéré** ou isolé.' },
      { type: 'exercise', title: 'Lance l’attaque', prompt: 'Lance l’**attaque de minorité**.', fen: 'r4rk1/pp3ppp/2p5/3p4/3P4/4P3/PP3PPP/R4RK1 w - - 0 1', goal: { kind: 'any', accept: ['b4', 'Rab1', 'Rfc1', 'a3'] }, hints: ['Le pion b avance, éventuellement préparé par Tb1 ou a3.'] },
      { type: 'text', title: 'Les deux faiblesses', fen: 'r4rk1/pp3ppp/2p5/3p4/3P4/4P3/PP3PPP/R4RK1 w - - 0 1', body: 'Le **principe des deux faiblesses** : une seule faiblesse adverse se défend souvent. Crée-en **une deuxième** sur l’autre aile pour surcharger la défense. C’est ainsi que gagnaient Capablanca et Karpov.' },
      { type: 'puzzles', title: 'Coups calmes', body: 'Les plus beaux coups ne sont pas toujours des échecs.', themes: ['quietMove'], count: 5, minRating: 1600, maxRating: 2300 },
    ] },
  { id: 'e-finales-tours', level: 'expert', title: 'Finales de tours avancées', icon: '♖', minutes: 12, summary: 'Tour derrière le pion passé, activité, règle de Tarrasch.',
    steps: [
      { type: 'text', title: 'La règle de Tarrasch', fen: '1r4k1/5ppp/8/8/P7/8/5PPP/2R3K1 w - - 0 1', body: '« **Les tours se placent derrière les pions passés** » — les tiens comme ceux de l’adversaire.\n\nDerrière ton pion passé, la tour gagne en activité à chaque pas du pion. Devant, elle perd sa mobilité. Et en finale de tours, **l’activité vaut souvent un pion**.' },
      { type: 'exercise', title: 'Derrière le pion', prompt: 'Place ta tour **derrière** ton pion passé.', fen: '1r4k1/5ppp/8/8/P7/8/5PPP/2R3K1 w - - 0 1', goal: { kind: 'any', accept: ['Ra1'] }, hints: ['Le pion est en a4. Où est la case derrière lui ?'] },
      { type: 'puzzles', title: 'Finales de tours', body: 'Le type de finale le plus fréquent.', themes: ['rookEndgame'], count: 5, minRating: 1500, maxRating: 2200 },
    ] },
  { id: 'e-finales-complexes', level: 'expert', title: 'Zugzwang et triangulation', icon: '⏳', minutes: 10, summary: 'Quand l’obligation de jouer devient une arme.',
    steps: [
      { type: 'text', title: 'Le zugzwang', fen: '8/8/8/4pK2/3kP3/8/8/8 w - - 0 1', shapes: ['f5e5', 'd4e4'], body: 'Le **zugzwang** (« obligation de jouer ») : tout coup **empire** la position, mais on ne peut pas passer son tour.\n\nVoici le **trébuchet**, un zugzwang **mutuel** : chaque roi attaque le pion adverse, et chaque pion est défendu… seulement par la présence de son roi à côté. **Qui a le trait perd** : ici, les Blancs doivent écarter leur roi, …Rxe4 suit et les Noirs gagnent. Avec le trait aux Noirs, c’est l’inverse : Rxe5 et les Blancs gagnent (vérifié avec la base de finales).\n\nEn finale de pions, savoir **donner le trait** à l’adversaire décide souvent du résultat.' },
      { type: 'exercise', title: 'Qui gagne ?', prompt: 'Même position, mais **les Noirs ont le trait**. Quel est le résultat ?', fen: '8/8/8/4pK2/3kP3/8/8/8 b - - 0 1', goal: { kind: 'quiz', options: ['Les Blancs gagnent', 'Nulle', 'Les Noirs gagnent'], answer: 0, verify: 'win' }, success: 'Exact : le roi noir doit lâcher e5, Rxe5 et le pion e4 passe. Qui a le trait perd.' },
      { type: 'text', title: 'La triangulation', fen: '8/1p1k4/8/1PPK4/8/8/8/8 w - - 0 1', shapes: ['d5e5', 'e5d4', 'd4d5'], body: 'Exemple classique (Dvoretsky). Les rois sont face à face : avec le trait, les Blancs aimeraient le **donner** aux Noirs, car Rd7 devrait alors lâcher la garde.\n\nLa **triangulation** : le roi blanc dispose d’un triangle **d5-e5-d4**, le roi noir seulement de deux cases utiles (d7 et c7/c6). 1.Re5 ! Rc6 2.Rd4 Rd7 3.Rd5 : **même position, trait aux Noirs**. Ils doivent céder : 3…Rc8 4.Re6 Rd8 5.Rd6 Rc8 6.Re7 Rb8 7.Rd7 et c6 décide.\n\nPiège : 1.c6+ ? Rc8 et c’est nulle (base de finales).' },
      { type: 'exercise', title: 'À toi : triangule et gagne', prompt: 'Gagne contre le moteur : **amène un pion à dame** sans perdre l’avantage. Le triangle d5-e5-d4 est la clé ; évite 1.c6+ ?.', fen: '8/1p1k4/8/1PPK4/8/8/8/8 w - - 0 1', goal: { kind: 'play', result: 'promote', maxMoves: 25 }, hints: ['1.Re5 ! puis Rd4 et Rd5 : tu reviens au départ avec le trait pour l’adversaire.', 'Après la triangulation, gagne l’opposition et soutiens c6 avec ton roi.'] },
      { type: 'puzzles', title: 'Zugzwang', body: 'Trouve le coup qui met l’adversaire en zugzwang.', themes: ['zugzwang'], count: 5, minRating: 1500, maxRating: 2300 },
    ] },
  { id: 'e-opera', level: 'expert', title: 'Morphy : la partie de l’Opéra (1858)', icon: '🎭', minutes: 12, summary: 'Développement, ouverture des lignes et sacrifice final : la leçon parfaite.',
    steps: [
      { type: 'demo', title: 'Paris, 1858', fen: START, moves: OPERA, comments: {
        3: 'La défense Philidor, passive.', 5: '…Fg4 ? cloue le cavalier, mais le fou va être échangé et les Noirs perdent du temps.',
        8: 'Les Blancs ont déjà une dame active et un temps d’avance.', 12: 'Db3 ! Double attaque sur f7 et b7.', 16: 'Fg5 : tout est développé chez les Blancs.',
        18: 'Cxb5 !! Morphy sacrifie pour ouvrir les lignes vers le roi noir.', 22: 'Grand roque : la tour entre dans la colonne d.', 24: 'Txd7 ! Élimine un défenseur.',
        26: 'Les Blancs ramènent la deuxième tour.', 30: 'Db8+ !! Le sacrifice final.', 32: 'Td8# : un mat d’une pureté légendaire.' },
        body: '**Paul Morphy** contre le duc de Brunswick et le comte Isouard, pendant une représentation à l’Opéra de Paris. Un modèle : développement rapide, ouverture des lignes, roi adverse au centre.' },
      { type: 'exercise', title: 'Trouve le coup de Morphy', prompt: 'Comme Morphy : élimine un défenseur puis ramène tes forces.', fen: START, pre: OPERA.slice(0, 24), goal: { kind: 'line', moves: ['Rxd7', 'Rxd7', 'Rd1'] }, hints: ['Le cavalier d7 est cloué.', 'Txd7 ! puis Td1.'] },
      { type: 'exercise', title: 'Le final', prompt: 'Mat en 2 : le coup le plus célèbre de Morphy !', fen: START, pre: OPERA.slice(0, 30), goal: { kind: 'line', moves: ['Qb8+', 'Nxb8', 'Rd8#'] }, hints: ['La dame se sacrifie pour dévier le cavalier.'] },
    ] },
  { id: 'e-immortelle', level: 'expert', title: 'Anderssen : l’Immortelle (1851)', icon: '🔥', minutes: 12, summary: 'Le romantisme absolu : deux tours, un fou et la dame sacrifiés.',
    steps: [
      { type: 'demo', title: 'Londres, 1851', fen: START, moves: IMMORTELLE, comments: {
        2: 'Le gambit du roi.', 16: 'Cf5 : le cavalier s’installe près du roi noir.', 20: 'Tg1 : les Blancs offrent déjà le fou b5.', 32: 'Cd5 ! Les Blancs ignorent la menace sur la tour a1.',
        34: 'Fd6 !! Offre la tour g1.', 36: 'e5 !! Coupe la dame noire de la défense, en offrant l’autre tour.', 40: 'Cxg7+', 42: 'Df6+ !! La dame aussi !', 44: 'Fe7# : mat avec seulement trois pièces mineures… contre une armée entière.' },
        body: '**Adolf Anderssen** contre **Lionel Kieseritzky**. La partie la plus célèbre de l’ère romantique.' },
      { type: 'exercise', title: 'Le coup immortel', prompt: 'Mat en 2 : sacrifie ta dame !', fen: START, pre: IMMORTELLE.slice(0, 42), goal: { kind: 'line', moves: ['Qf6+', 'Nxf6', 'Be7#'] }, hints: ['La dame dévie le cavalier g8.', 'Puis le fou mate en e7.'] },
    ] },
  { id: 'e-toujours-jeune', level: 'expert', title: 'Anderssen : la Toujours Jeune (1852)', icon: '🌿', minutes: 12, summary: 'Une combinaison finale de 8 coups.',
    steps: [
      { type: 'demo', title: 'Berlin, 1852', fen: START, moves: TOUJOURS_JEUNE, comments: {
        6: 'Le gambit Evans : un pion pour le développement.', 32: 'Cf6+ !! Ouvre la colonne e.', 36: 'Tad1 !! Un coup calme au milieu de la tempête.',
        38: 'Txe7+ ! Le début de la combinaison finale.', 40: 'Dxd7+ !! La dame se sacrifie.', 42: 'Ff5++ : échec double !', 46: 'Fxe7#.' },
        body: '**Anderssen** contre **Dufresne**. Steinitz l’a surnommée « la toujours jeune » (Evergreen).' },
      { type: 'exercise', title: 'La combinaison', prompt: 'Rejoue la combinaison finale d’Anderssen, jusqu’au mat. (Après 20.Txe7+, la meilleure défense était 20…Rd8 ! : pas de mat, mais les Blancs gagnent quand même. Dufresne a pris 20…Cxe7 ?, et là tout est forcé.)', fen: START, pre: TOUJOURS_JEUNE.slice(0, 38), goal: { kind: 'line', moves: TOUJOURS_JEUNE.slice(38) }, hints: ['Commence par prendre en e7 avec échec.', 'Puis la dame se sacrifie en d7.', 'L’échec double Ff5++ est décisif.'] },
    ] },
  { id: 'e-siecle', level: 'expert', title: 'Fischer : la partie du siècle (1956)', icon: '⭐', minutes: 14, summary: 'Bobby Fischer, 13 ans, sacrifie sa dame.',
    steps: [
      { type: 'demo', title: 'New York, 1956', fen: START, moves: SIECLE, comments: {
        21: '…Ca4 !! Un coup incroyable : le cavalier se sacrifie.', 25: '…Cxe4 ! Le centre blanc s’effondre.', 33: '…Fe6 !!! Fischer abandonne sa dame pour une attaque implacable.',
        36: 'Le « moulin » : échecs à la découverte en série.', 45: '…axb6 : Fischer a tour, deux fous et cavalier contre la dame.', 81: '…Tc2# : le jeune Bobby conclut en beauté.' },
        body: '**Donald Byrne** contre **Robert James Fischer**, 13 ans. Le chroniqueur Hans Kmoch l’a baptisée « la partie du siècle ».' },
      { type: 'exercise', title: 'Le sacrifice de dame', prompt: 'Tu es Fischer (Noirs). Trouve le coup **…Fe6 !!** et le moulin qui suit.', fen: START, pre: SIECLE.slice(0, 33), orientation: 'black', goal: { kind: 'line', moves: ['Be6', 'Bxb6', 'Bxc4+'] }, hints: ['Ne sauve pas ta dame !', 'Le fou va en e6 pour attaquer le fou c4 avec échec ensuite.'] },
    ] },
];
