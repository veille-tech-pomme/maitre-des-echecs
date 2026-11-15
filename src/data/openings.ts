// Ouvertures principales : lignes de référence commentées (vérifiées par les tests avec chess.js).
import { Chess } from 'chess.js';

export interface OpeningLine { name: string; moves: string; notes?: Record<number, string> }
export interface Opening { id: string; name: string; eco: string; side: 'w' | 'b'; family: 'e4' | 'd4' | 'autre'; summary: string; ideas: string[]; lines: OpeningLine[] }

export const OPENINGS: Opening[] = [
  { id: 'italienne', name: 'Partie italienne', eco: 'C50-C54', side: 'w', family: 'e4',
    summary: 'Le fou va en c4 viser f7, le point faible des Noirs. Ouverture classique, idéale pour apprendre le développement rapide.',
    ideas: ['Développer vite cavaliers et fous', 'Viser f7 avec le fou c4', 'Préparer d4 avec c3', 'Roquer tôt'],
    lines: [
      { name: 'Giuoco Piano (c3 et d4)', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Bd2 Bxd2+ Nbxd2 d5',
        notes: { 0: 'Le pion e prend le centre et libère dame et fou.', 2: 'Le cavalier attaque e5 et se développe vers le centre.', 4: 'Le fou vise f7, défendu seulement par le roi.', 6: 'c3 prépare la poussée d4 pour un grand centre.', 8: 'd4 ! Les Blancs ouvrent le centre.', 15: 'd5 : les Noirs frappent le centre pour ne pas être écrasés.' } },
      { name: 'Giuoco Pianissimo (d3 tranquille)', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7',
        notes: { 8: 'd3 : approche lente et solide, très prisée des champions actuels.', 10: 'Le roque met le roi à l’abri.', 12: 'La tour soutient e4 et prépare d4.', 14: 'Le fou se replie en b3 pour éviter d5 ou b5.' } },
      { name: 'Défense des deux cavaliers', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O Re1 d6 c3',
        notes: { 5: 'Les Noirs contre-attaquent e4 au lieu de copier Fc5.', 6: 'd3 protège e4 calmement.' } },
    ] },
  { id: 'espagnole', name: 'Partie espagnole (Ruy Lopez)', eco: 'C60-C99', side: 'w', family: 'e4',
    summary: 'Le fou b5 attaque le défenseur de e5. Une des ouvertures les plus riches et les plus jouées au plus haut niveau.',
    ideas: ['Pression indirecte sur e5', 'Roque rapide puis c3-d4', 'Manœuvre Cb1-d2-f1-g3', 'Jeu stratégique long'],
    lines: [
      { name: 'Espagnole fermée', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3',
        notes: { 4: 'Le fou attaque le cavalier qui défend e5.', 5: 'a6 pose la question au fou.', 6: 'Le fou garde le clouage indirect.', 8: 'Le roque d’abord : e4 n’est pas vraiment en danger.', 16: 'h3 empêche Fg4 et prépare d4.' } },
      { name: 'Défense berlinoise', moves: 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8',
        notes: { 5: 'Le « mur de Berlin », rendu célèbre par Kramnik contre Kasparov en 2000.', 15: 'Finale sans dames : les Noirs ont perdu le roque mais ont deux fous et une structure solide.' } },
      { name: 'Variante d’échange', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4',
        notes: { 6: 'Les Blancs donnent le fou pour abîmer la structure noire : majorité de pions à l’aile roi.' } },
    ] },
  { id: 'sicilienne', name: 'Défense sicilienne', eco: 'B20-B99', side: 'b', family: 'e4',
    summary: 'La réponse la plus combative à 1.e4 : les Noirs déséquilibrent la position en échangeant un pion c contre le pion d.',
    ideas: ['Échanger c5 contre d4', 'Contre-jeu sur la colonne c', 'Majorité centrale de pions', 'Positions déséquilibrées et tactiques'],
    lines: [
      { name: 'Najdorf (attaque anglaise)', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7',
        notes: { 1: 'c5 contrôle d4 sans symétrie.', 5: 'Le pion c s’échange contre un pion central : les Noirs gardent deux pions centraux.', 9: 'a6, le coup de Najdorf : contrôle b5 et prépare …e5 ou …b5.' } },
      { name: 'Dragon (attaque yougoslave)', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6',
        notes: { 9: 'Le fianchetto : le fou g7 deviendra un monstre sur la grande diagonale.', 12: 'f3 et Dd2 : les Blancs préparent le grand roque et l’attaque h4-h5.' } },
      { name: 'Contre l’Alapin (2.c3)', moves: 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6',
        notes: { 2: 'c3 prépare d4 pour reprendre avec un pion.', 3: 'Cf6 attaque e4 immédiatement.', 11: 'd6 attaque la pointe e5.' } },
    ] },
  { id: 'francaise', name: 'Défense française', eco: 'C00-C19', side: 'b', family: 'e4',
    summary: '1…e6 puis …d5 : une défense solide où les Noirs attaquent la chaîne de pions blanche à sa base.',
    ideas: ['Attaquer la chaîne de pions par …c5 et …f6', 'Le fou c8 est souvent « le mauvais fou »', 'Contre-jeu à l’aile dame'],
    lines: [
      { name: 'Variante d’avance', moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3',
        notes: { 4: 'e5 gagne de l’espace mais crée une chaîne d4-e5.', 5: 'c5 frappe la base de la chaîne.', 9: 'Db6 met la pression sur d4 et b2.' } },
      { name: 'Winawer', moves: 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7',
        notes: { 5: 'Le fou cloue le cavalier : les Noirs menacent e4.', 10: 'Les Blancs ont les deux fous mais des pions doublés.' } },
      { name: 'Variante d’échange', moves: 'e4 e6 d4 d5 exd5 exd5 Nf3 Nf6 Bd3 Bd6 O-O O-O',
        notes: { 4: 'Structure symétrique : le fou c8 noir est libéré.' } },
    ] },
  { id: 'carokann', name: 'Défense Caro-Kann', eco: 'B10-B19', side: 'b', family: 'e4',
    summary: '1…c6 puis …d5 : comme la française, mais le fou c8 peut sortir avant …e6. Très solide.',
    ideas: ['Sortir le fou c8 avant …e6', 'Structure saine', 'Finales favorables'],
    lines: [
      { name: 'Variante classique', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3',
        notes: { 7: 'Le fou sort avant …e6 : c’est tout l’intérêt de la Caro-Kann.', 10: 'h4 menace h5 pour piéger le fou.', 11: 'h6 prépare une case de repli en h7.' } },
      { name: 'Variante d’avance', moves: 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3',
        notes: { 5: 'Le fou sort tout de suite à l’extérieur de la chaîne.', 9: 'c5 : on attaque la base de la chaîne.' } },
    ] },
  { id: 'scandinave', name: 'Défense scandinave', eco: 'B01', side: 'b', family: 'e4',
    summary: '1…d5 : on attaque e4 dès le premier coup. Facile à apprendre, la dame sort tôt mais se replie en a5.',
    ideas: ['Échanger le pion e4 immédiatement', 'Dame en a5 puis développement rapide', 'Structure c6-e6 solide'],
    lines: [{ name: 'Ligne principale …Da5', moves: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 Bf5 Bc4 e6 Bd2 c6',
      notes: { 5: 'La dame se met à l’abri en a5 et cloue un peu le cavalier.', 9: 'Le fou sort avant …e6, comme dans la Caro-Kann.' } }] },
  { id: 'pirc', name: 'Défense Pirc', eco: 'B07-B09', side: 'b', family: 'e4',
    summary: 'Les Noirs laissent les Blancs occuper le centre pour l’attaquer ensuite (hypermodernisme).',
    ideas: ['Fianchetto du fou roi', 'Frapper le centre avec …e5 ou …c5'],
    lines: [{ name: 'Système classique', moves: 'e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O c6' }] },
  { id: 'petrov', name: 'Défense Petrov', eco: 'C42', side: 'b', family: 'e4',
    summary: 'Les Noirs contre-attaquent e4 au lieu de défendre e5. Très solide, pour les joueurs qui aiment la sécurité.',
    ideas: ['Symétrie', 'Attention au piège 3…Cxe4?? 4.De2'],
    lines: [{ name: 'Ligne principale', moves: 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7',
      notes: { 5: 'Il faut d’abord chasser le cavalier avant de prendre en e4 !' } }] },
  { id: 'ecossaise', name: 'Partie écossaise', eco: 'C44-C45', side: 'w', family: 'e4',
    summary: 'Les Blancs ouvrent le centre dès le 3e coup avec d4. Jeu ouvert et dynamique.',
    ideas: ['Ouvrir le centre tôt', 'Cavalier fort en d4'],
    lines: [{ name: 'Variante 4…Fc5', moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7 Bc4' }] },
  { id: 'gambitroi', name: 'Gambit du roi', eco: 'C30-C39', side: 'w', family: 'e4',
    summary: 'L’ouverture romantique : un pion sacrifié pour ouvrir la colonne f et attaquer.',
    ideas: ['Ouvrir la colonne f', 'Développement rapide', 'Attaque sur f7'],
    lines: [{ name: 'Gambit Kieseritzky', moves: 'e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5 Nf6 d4 d6 Nd3 Nxe4 Bxf4' }] },
  { id: 'gambitdame', name: 'Gambit Dame', eco: 'D06-D69', side: 'w', family: 'd4',
    summary: 'Les Blancs offrent le pion c4 pour détourner le pion d5 du centre. Base du jeu positionnel moderne.',
    ideas: ['Pression sur d5', 'Développement harmonieux', 'Attaque de minorité (b4-b5)'],
    lines: [
      { name: 'Gambit Dame refusé', moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1 c6',
        notes: { 2: 'c4 : le « gambit » n’en est pas vraiment un, le pion se récupère facilement.', 3: '…e6 maintient solidement d5.', 6: 'Fg5 cloue le cavalier qui défend d5.' } },
      { name: 'Gambit Dame accepté', moves: 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6',
        notes: { 3: 'Les Noirs prennent, mais ne cherchent pas à garder le pion.', 8: 'Le pion est récupéré, les Blancs ont un beau centre.' } },
      { name: 'Défense slave', moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4',
        notes: { 3: '…c6 défend d5 sans enfermer le fou c8.' } },
    ] },
  { id: 'londres', name: 'Système de Londres', eco: 'D02', side: 'w', family: 'd4',
    summary: 'Un système facile à jouer : d4, Ff4, e3, c3, Cbd2, Fd3. Même plan presque contre tout.',
    ideas: ['Fou en f4 avant e3', 'Structure en pyramide c3-d4-e3', 'Attaque possible avec Ce5 et h4'],
    lines: [{ name: 'Mise en place type', moves: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3',
      notes: { 2: 'Le fou sort AVANT e3 pour ne pas être enfermé.', 12: 'Fg3 : on garde la paire de fous si …Fxf4 n’est pas possible.' } }] },
  { id: 'indienneroi', name: 'Défense est-indienne', eco: 'E60-E99', side: 'b', family: 'd4',
    summary: 'Les Noirs laissent le centre aux Blancs, roquent vite, puis attaquent à l’aile roi avec …f5.',
    ideas: ['Fianchetto g7', 'Rupture …e5 puis …f5', 'Attaque sur le roi blanc'],
    lines: [{ name: 'Variante classique', moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7',
      notes: { 11: '…e5 : la rupture centrale typique.', 15: 'Le cavalier va vers l’aile roi pour soutenir …f5.' } }] },
  { id: 'nimzo', name: 'Défense nimzo-indienne', eco: 'E20-E59', side: 'b', family: 'd4',
    summary: 'Le fou b4 cloue le cavalier c3 pour contrôler e4. Une des défenses les plus respectées.',
    ideas: ['Contrôler e4', 'Donner la paire de fous contre des pions doublés'],
    lines: [{ name: 'Variante Rubinstein (4.e3)', moves: 'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O' }] },
  { id: 'anglaise', name: 'Ouverture anglaise', eco: 'A10-A39', side: 'w', family: 'autre',
    summary: '1.c4 : une sicilienne avec un temps de plus. Jeu flexible et positionnel.',
    ideas: ['Contrôle de d5', 'Fianchetto g2', 'Jeu sur l’aile dame'],
    lines: [{ name: 'Sicilienne inversée', moves: 'c4 e5 Nc3 Nf6 g3 d5 cxd5 Nxd5 Bg2 Nb6 Nf3 Nc6 O-O Be7' }] },
];

const key = (fen: string) => fen.split(' ').slice(0, 2).join(' ');
let book: Set<string> | null = null;
let tree: Map<string, { san: string; names: Set<string> }[]> | null = null;
function build() {
  book = new Set(); tree = new Map();
  for (const o of OPENINGS) for (const l of o.lines) {
    const ch = new Chess();
    for (const s of l.moves.split(' ')) {
      const k = key(ch.fen());
      const arr = tree.get(k) || []; let e = arr.find((x) => x.san === s); if (!e) { e = { san: s, names: new Set() }; arr.push(e); }
      e.names.add(o.name); tree.set(k, arr);
      ch.move(s); book.add(key(ch.fen()));
    }
  }
}
export function isBookFen(fen: string) { if (!book) build(); return book!.has(key(fen)); }
/** Coups de théorie connus depuis une position (explorateur). */
export function bookMoves(fen: string) { if (!tree) build(); return (tree!.get(key(fen)) || []).map((x) => ({ san: x.san, names: [...x.names] })); }
/** Nom de l'ouverture correspondant à une suite de coups SAN. */
export function openingName(sans: string[]): string | null {
  let bestLen = 0; let cands: { o: Opening; l: OpeningLine }[] = [];
  for (const o of OPENINGS) for (const l of o.lines) {
    const ms = l.moves.split(' '); let n = 0;
    while (n < ms.length && n < sans.length && ms[n] === sans[n]) n++;
    if (n > bestLen) { bestLen = n; cands = [{ o, l }]; } else if (n === bestLen && n > 0) cands.push({ o, l });
  }
  if (bestLen < 2 || !cands.length) return null;
  const names = new Set(cands.map((c) => c.o.name));
  if (names.size > 1) return null;
  const c = cands[0];
  return cands.length === 1 && bestLen >= 6 ? `${c.o.name} — ${c.l.name}` : c.o.name;
}
