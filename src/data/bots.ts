// Adversaires IA avec personnalités (tous gratuits et illimités). Avatars générés en SVG (components/BotAvatar).
import type { Persona } from '../components/BotAvatar';
import { OPENINGS } from './openings';
export type BotStyle = 'equilibre' | 'agressif' | 'positionnel' | 'gambit' | 'defensif' | 'finales' | 'chaotique' | 'tactique';
export interface Bot {
  id: string; name: string; elo: number; avatar: string; color: string; style: string; bio: string;
  group?: string; persona?: Persona; styleTag?: BotStyle; openings?: string[];
  // paramètres moteur
  depth: number; multipv: number; temp: number; randomPct: number; limitElo?: number; movetime?: number;
  captureBias?: number; checkBias?: number; tradeBias?: number; book?: string[][];
  lines: { hello: string[]; capture: string[]; check: string[]; userBlunder: string[]; win: string[]; lose: string[]; draw: string[] };
}
type Lines = Bot['lines'];
const STYLE_LINES: Record<BotStyle, Omit<Lines, 'hello'>> = {
  equilibre: { capture: ['Je prends, merci.', 'Un échange équitable ?'], check: ['Échec !'], userBlunder: ['Hum, intéressant…'], win: ['Bonne partie, merci !'], lose: ['Bien joué, tu as mérité la victoire.'], draw: ['Partage des points, bonne partie.'] },
  agressif: { capture: ['Et une de moins !', 'À l’assaut !'], check: ['Échec ! Ton roi tremble ?', 'Je fonce sur ton roi !'], userBlunder: ['Tu baisses la garde !'], win: ['L’attaque paie toujours !'], lose: ['Mon attaque s’est brisée… respect.'], draw: ['Nulle ? Moi qui voulais du sang…'] },
  positionnel: { capture: ['Une petite amélioration de structure.'], check: ['Échec, simplement.'], userBlunder: ['Cette faiblesse sera durable.'], win: ['Les petits avantages s’accumulent.'], lose: ['Ta stratégie était supérieure.'], draw: ['Position équilibrée, nulle logique.'] },
  gambit: { capture: ['Je récupère mon investissement !'], check: ['Échec ! Le pion sacrifié travaille.'], userBlunder: ['Le gambit porte ses fruits !'], win: ['Vive les gambits !'], lose: ['Mon sacrifice était peut-être un peu trop optimiste…'], draw: ['Nulle… mais quelle partie !'] },
  defensif: { capture: ['Je consolide.'], check: ['Échec, pour gagner du temps.'], userBlunder: ['Je savais que ma forteresse tiendrait.'], win: ['La patience est une arme.'], lose: ['Tu as fini par percer mes défenses. Chapeau.'], draw: ['Ma forteresse a tenu !'] },
  finales: { capture: ['Échangeons, j’adore les finales.'], check: ['Échec. Le roi doit être actif en finale.'], userBlunder: ['En finale, chaque temps compte.'], win: ['Les finales, c’est mon jardin.'], lose: ['Tu joues très bien les finales !'], draw: ['Finale nulle, c’est la théorie.'] },
  chaotique: { capture: ['Hop, au hasard… ou pas !'], check: ['Échec ! Je ne sais pas pourquoi, mais c’est drôle.'], userBlunder: ['Le chaos me sourit !'], win: ['Le chaos l’emporte !'], lose: ['Même le chaos a ses limites.'], draw: ['Une nulle ? Quel désordre !'] },
  tactique: { capture: ['Combinaison !', 'Calcul confirmé.'], check: ['Échec ! Tu avais vu la suite ?'], userBlunder: ['J’ai vu une tactique…'], win: ['Les tactiques décident des parties.'], lose: ['Tu as mieux calculé que moi.'], draw: ['Tout s’équilibre dans les variantes.'] },
};
/** Paramètres moteur dérivés de l'Elo visé (Stockfish affaibli). */
function engineFor(elo: number, style: BotStyle) {
  let e: Pick<Bot, 'depth' | 'multipv' | 'temp' | 'randomPct' | 'limitElo' | 'movetime'>;
  // Audit Magnus B7 : réglage interpolé entre des paliers MESURÉS (tournoi tools/calibrate-bots.mts, 1 536 parties,
  // tools/data/bot-calibration-v1.json) au lieu de paliers fixes qui rendaient les bots 1000-1450 bien plus forts qu'affiché.
  if (elo < 1450) {
    const T = [ // [Elo mesuré, profondeur, multipv, température, part d'erreurs humaines]
      [150, 1, 10, 450, 0.5], [300, 1, 10, 380, 0.4], [540, 2, 8, 240, 0.2], [1000, 4, 6, 150, 0.1], [1390, 6, 5, 95, 0.05], [1860, 8, 4, 55, 0.025],
    ];
    let k = 0; while (k < T.length - 2 && elo > T[k + 1][0]) k++;
    const f = Math.max(0, Math.min(1, (elo - T[k][0]) / (T[k + 1][0] - T[k][0]))); const L = (i: number) => T[k][i] + f * (T[k + 1][i] - T[k][i]);
    e = { depth: Math.round(L(1)), multipv: Math.round(L(2)), temp: Math.round(L(3)), randomPct: +L(4).toFixed(3) };
  }
  else if (elo < 3000) e = { depth: 12, multipv: 1, temp: 0, randomPct: 0, limitElo: Math.max(1320, Math.min(3190, elo)), movetime: elo < 2000 ? 600 : elo < 2600 ? 1000 : 1500 };
  else e = { depth: elo >= 3150 ? 22 : 18, multipv: 1, temp: 0, randomPct: 0, movetime: elo >= 3150 ? 3000 : 2000 };
  const bias = { agressif: { checkBias: 45, captureBias: 25 }, gambit: { checkBias: 30, captureBias: 15 }, tactique: { captureBias: 30, checkBias: 20 }, defensif: { tradeBias: 35 }, finales: { tradeBias: 60 }, positionnel: { tradeBias: 15 }, chaotique: { checkBias: 25 }, equilibre: {} }[style];
  return { ...e, ...(e.temp > 0 ? bias : {}), ...(style === 'chaotique' && e.temp > 0 ? { randomPct: e.randomPct + 0.1 } : {}) };
}
function bookFrom(ids: string[] = []): string[][] | undefined {
  const lines = OPENINGS.filter((o) => ids.includes(o.id)).flatMap((o) => o.lines.map((l) => l.moves.split(' ').slice(0, 14)));
  return lines.length ? lines : undefined;
}
function mk(id: string, name: string, elo: number, color: string, group: string, styleTag: BotStyle, style: string, bio: string, hello: string[], persona: Persona, openings: string[] = []): Bot {
  return { id, name, elo, avatar: '', color, group, styleTag, style, bio, persona, openings, book: bookFrom(openings), ...engineFor(elo, styleTag), lines: { hello, ...STYLE_LINES[styleTag] } };
}
const ORIGINAUX: Bot[] = [
{ id: 'paulette', name: 'Paulette', elo: 250, avatar: '🐣', color: '#f5c542', style: 'Débutante joyeuse',
    bio: 'Elle vient d’apprendre comment bougent les pièces. Parfaite pour ta toute première partie !',
    depth: 1, multipv: 10, temp: 400, randomPct: 0.45, captureBias: 120,
    lines: { hello: ['Coucou ! C’est ma première partie, sois gentil·le 😊'], capture: ['Miam, une pièce !', 'Oh, je prends ça !'], check: ['Échec ! C’est bien comme ça qu’on dit ?'], userBlunder: ['Oh, tu m’as laissé une pièce ?'], win: ['J’ai gagné ?! Incroyable !'], lose: ['Bravo ! Tu m’apprendras ce coup ?'], draw: ['Match nul, c’est rigolo !'] } },
  { id: 'leo', name: 'Léo le Lapin', elo: 500, avatar: '🐰', color: '#ff8fab', style: 'Rapide et impulsif',
    bio: 'Léo joue vite, attaque tout ce qui bouge… et oublie parfois de défendre ses pièces.',
    depth: 2, multipv: 8, temp: 260, randomPct: 0.22, captureBias: 80, checkBias: 60,
    lines: { hello: ['Hop hop ! On joue vite ?'], capture: ['Hop, croqué !'], check: ['Échec ! Hop !'], userBlunder: ['Ha ! Trop rapide pour moi ?'], win: ['Plus rapide que toi !'], lose: ['Zut, j’ai couru trop vite…'], draw: ['Égalité, on rejoue ?'] } },
  { id: 'odette', name: 'Mamie Odette', elo: 800, avatar: '👵', color: '#c9a3ff', style: 'Prudente, adore échanger',
    bio: 'Elle joue aux échecs au club du quartier depuis 40 ans. Elle échange les pièces et attend tes erreurs.',
    depth: 4, multipv: 6, temp: 140, randomPct: 0.1, tradeBias: 40,
    book: [['e4', 'e5', 'Nf3', 'Nc6'], ['d4', 'd5']],
    lines: { hello: ['Bonjour mon petit. Prends ton temps, on n’est pas pressés.'], capture: ['On échange, c’est plus simple.'], check: ['Échec, mon petit.'], userBlunder: ['Tss tss, tu as oublié de protéger ta pièce.'], win: ['Il faut encore t’entraîner, mais c’était bien.'], lose: ['Bien joué ! Tu progresses vite.'], draw: ['Nulle, c’est honorable.'] } },
  { id: 'hugo', name: 'Capitaine Hugo', elo: 1100, avatar: '🏴‍☠️', color: '#ff6b5b', style: 'Attaquant, aime les gambits',
    bio: 'À l’abordage ! Hugo sacrifie des pions pour attaquer ton roi. Défends-toi bien.',
    depth: 6, multipv: 5, temp: 90, randomPct: 0.05, checkBias: 50, captureBias: 20,
    book: [['e4', 'e5', 'f4'], ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'], ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']],
    lines: { hello: ['À l’abordage, moussaillon !'], capture: ['Butin récupéré !'], check: ['Échec ! Rends-toi !'], userBlunder: ['Har har, une faille dans ta coque !'], win: ['Le trésor est à moi !'], lose: ['Mille sabords… tu m’as coulé.'], draw: ['Une trêve entre pirates.'] } },
  { id: 'ines', name: 'Professeure Inès', elo: 1400, avatar: '👩‍🏫', color: '#4dabf7', style: 'Classique et pédagogue',
    bio: 'Elle joue selon les principes : centre, développement, roque. Elle punit les coups anti-positionnels.',
    depth: 8, multipv: 4, temp: 55, randomPct: 0.02, limitElo: undefined,
    book: [['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3'], ['d4', 'd5', 'c4', 'e6']],
    lines: { hello: ['Bonjour ! Montre-moi ce que tu as appris.'], capture: ['Prise logique.'], check: ['Échec.'], userBlunder: ['Attention : vérifie toujours les pièces non défendues.'], win: ['Revois ta partie dans le bilan, tu apprendras beaucoup.'], lose: ['Excellent travail, félicitations !'], draw: ['Une nulle bien méritée.'] } },
  { id: 'comte', name: 'Le Comte de Castel', elo: 1700, avatar: '🎩', color: '#868e96', style: 'Positionnel, étouffe ses adversaires',
    bio: 'Élégant et patient, il améliore ses pièces une à une et gagne les finales.',
    depth: 10, multipv: 3, temp: 30, randomPct: 0, limitElo: 1700,
    book: [['d4', 'Nf6', 'c4', 'e6'], ['c4'], ['Nf3', 'd5', 'g3']],
    lines: { hello: ['Enchanté. Jouons une partie… raffinée.'], capture: ['Échange favorable, je crois.'], check: ['Échec, très cher.'], userBlunder: ['Quel dommage, cette faiblesse.'], win: ['La patience est une vertu.'], lose: ['Chapeau bas !'], draw: ['Une nulle élégante.'] } },
  { id: 'morgane', name: 'Morgane la Sorcière', elo: 2000, avatar: '🧙‍♀️', color: '#9775fa', style: 'Tactique et piégeuse',
    bio: 'Ses combinaisons sortent de nulle part. Chaque coup cache un piège.',
    depth: 12, multipv: 1, temp: 0, randomPct: 0, limitElo: 2000, checkBias: 0,
    book: [['e4', 'c5'], ['d4', 'Nf6', 'c4', 'g6']],
    lines: { hello: ['Mmh… je sens que tu vas tomber dans un piège.'], capture: ['Abracadabra !'], check: ['Échec… par magie.'], userBlunder: ['Le sortilège fonctionne !'], win: ['Ensorcelé·e !'], lose: ['Quel contre-sort ! Impressionnant.'], draw: ['Match nul… pour cette fois.'] } },
  { id: 'victor', name: 'GM Victor', elo: 2400, avatar: '🦁', color: '#ffa94d', style: 'Grand maître universel',
    bio: 'Un grand maître redoutable dans toutes les phases du jeu.',
    depth: 14, multipv: 1, temp: 0, randomPct: 0, limitElo: 2400, movetime: 1200,
    lines: { hello: ['Bonne chance. Tu en auras besoin.'], capture: ['Logique.'], check: ['Échec.'], userBlunder: ['Imprécision fatale.'], win: ['Bonne partie. Analyse-la.'], lose: ['Remarquable. Tu as le niveau maître !'], draw: ['Nulle méritée.'] } },
  { id: 'max', name: 'Stockfish Max', elo: 3000, avatar: '🤖', color: '#20c997', style: 'Puissance maximale',
    bio: 'Le moteur à pleine puissance. Pour l’analyse… ou pour souffrir.',
    depth: 18, multipv: 1, temp: 0, randomPct: 0, movetime: 2000,
    lines: { hello: ['Initialisation… calcul de 1 000 000 positions par seconde.'], capture: ['Matériel +1.'], check: ['Échec.'], userBlunder: ['Évaluation : gagnant.'], win: ['Victoire calculée au coup 3.'], lose: ['Erreur… impossible… bravo, humain !'], draw: ['Nulle forcée détectée.'] } }
];
const P: Record<string, Persona> = {
  paulette: { kind: 'human', hair: 3, hairColor: '#d9a441', hat: 'bow', mouth: 'grin', eyes: 'happy' }, leo: { kind: 'rabbit', mouth: 'grin' }, odette: { kind: 'human', hair: 5, hairColor: '#e8e1d6', eyes: 'glasses', mouth: 'smile', skin: '#f1c19d' },
  hugo: { kind: 'human', hat: 'pirate', beard: 'full', hairColor: '#5a3825', mouth: 'grin' }, ines: { kind: 'human', hair: 2, hairColor: '#2b2016', eyes: 'glasses', mouth: 'smile', skin: '#d9a07a' }, comte: { kind: 'human', hat: 'tophat', eyes: 'monocle', beard: 'moustache', hairColor: '#8a8a8a', mouth: 'smirk' },
  morgane: { kind: 'human', hat: 'wizard', hair: 2, hairColor: '#1f2a44', eyes: 'sharp', mouth: 'smirk' }, victor: { kind: 'human', hair: 4, hairColor: '#2b2016', beard: 'goatee', eyes: 'sharp', mouth: 'flat', skin: '#8d5a3b' }, max: { kind: 'robot' },
};
for (const b of ORIGINAUX) { if (b.elo < 1450) { const e = engineFor(b.elo, 'equilibre'); Object.assign(b, { depth: e.depth, multipv: e.multipv, temp: e.temp, randomPct: e.randomPct }); } b.persona = P[b.id]; b.group = b.elo < 700 ? 'Débutants' : b.elo < 1300 ? 'Intermédiaires' : b.elo < 2000 ? 'Club' : b.elo < 2500 ? 'Experts' : 'Maîtres'; }
const NOUVEAUX: Bot[] = [
  mk('bebert', 'Bébert le Chaton', 200, '#ffb86b', 'Débutants', 'chaotique', 'Joue avec les pièces comme avec une pelote', 'Il pousse les pièces au hasard… et parfois, par miracle, il mate !', ['Miaou ? On joue ?'], { kind: 'cat', mouth: 'o' }),
  mk('zoe', 'Zoé', 320, '#7bdff2', 'Débutants', 'equilibre', 'Apprentie appliquée', 'Zoé a 8 ans et vient de recevoir son premier échiquier. Elle s’applique !', ['Bonjour ! J’ai appris le roque hier !'], { kind: 'human', hair: 3, hairColor: '#a0522d', hat: 'flower', mouth: 'grin' }),
  mk('gaston', 'Gaston le Facteur', 420, '#9bc53d', 'Débutants', 'agressif', 'Sort sa dame trop tôt', 'Il adore sortir sa dame au deuxième coup pour « livrer le courrier ».', ['Courrier express : ma dame arrive !'], { kind: 'human', hat: 'cap', beard: 'moustache', hairColor: '#5a3825' }, ['italienne']),
  mk('nina', 'Nina la Renarde', 550, '#f08a4b', 'Débutants', 'tactique', 'Rusée, tend des petits pièges', 'Elle connaît le coup du berger et quelques pièges d’ouverture.', ['Attention à f7 !'], { kind: 'fox', eyes: 'sharp', mouth: 'smirk' }, ['italienne', 'ecossaise']),
  mk('martin', 'Martin le Boulanger', 650, '#e9c46a', 'Débutants', 'defensif', 'Patient et prudent', 'Il se lève à 4 h pour pétrir et joue aux échecs pendant la pause, sans jamais se presser.', ['Une partie, comme une pâte : il faut du temps.'], { kind: 'human', hat: 'beret', hair: 0, hairColor: '#2b2016', mouth: 'smile', skin: '#f1c19d' }, ['londres']),
  mk('lucie', 'Lucie', 750, '#ff99c8', 'Intermédiaires', 'equilibre', 'Collégienne du club', 'Elle participe à son premier championnat scolaire et révise ses ouvertures.', ['Je prépare le championnat, on s’entraîne ?'], { kind: 'human', hair: 2, hairColor: '#2b2016', mouth: 'smile', skin: '#b97a56' }, ['italienne', 'francaise']),
  mk('ourson', 'Gros Ours', 850, '#a47148', 'Intermédiaires', 'defensif', 'Lent mais solide', 'Il bloque le centre et attend. Difficile à faire bouger !', ['Grrr… je ne bougerai pas d’un pouce.'], { kind: 'bear', mouth: 'flat' }, ['carokann', 'londres']),
  mk('ahmed', 'Ahmed le Taxi', 950, '#ffd166', 'Intermédiaires', 'agressif', 'Fonce vers le roi adverse', 'Chauffeur de taxi le jour, attaquant féroce le soir au café.', ['Accroche-toi, on passe en mode attaque !'], { kind: 'human', hat: 'cap', beard: 'moustache', hairColor: '#2b2016', skin: '#b97a56', mouth: 'grin' }, ['italienne', 'sicilienne']),
  mk('chloe', 'Chloé', 1050, '#b8f2e6', 'Intermédiaires', 'positionnel', 'Joue les structures', 'Étudiante en architecture, elle aime les structures de pions bien construites.', ['Une bonne structure, c’est la base.'], { kind: 'human', hair: 1, hairColor: '#d9a441', eyes: 'glasses', mouth: 'smile' }, ['carokann', 'gambitdame']),
  mk('kevin', 'Kévin le Gambiteur', 1150, '#ef476f', 'Intermédiaires', 'gambit', 'Sacrifie des pions dès l’ouverture', 'Pour Kévin, un pion n’est qu’un ticket d’entrée pour l’attaque.', ['Un pion ? Prends-le, je t’en prie…'], { kind: 'human', hat: 'headband', hair: 4, hairColor: '#c0392b', mouth: 'grin' }, ['gambitroi', 'danois', 'evans']),
  mk('sophie', 'Sophie la Pharmacienne', 1250, '#06d6a0', 'Intermédiaires', 'finales', 'Simplifie vers les finales', 'Précise et méthodique : elle échange les pièces et gagne les finales au millimètre.', ['Dosage précis : quelques échanges et une finale.'], { kind: 'human', hair: 2, hairColor: '#5a3825', eyes: 'glasses', mouth: 'flat' }, ['francaise', 'londres']),
  mk('chouette', 'Docteur Chouette', 1350, '#c49a6c', 'Club', 'positionnel', 'Sage stratège', 'Elle réfléchit la nuit entière avant chaque coup. Hou-hou.', ['Hou-hou… réfléchissons ensemble.'], { kind: 'owl' }, ['anglaise', 'reti']),
  mk('raoul', 'Raoul le Rugbyman', 1450, '#118ab2', 'Club', 'agressif', 'Percées au centre', 'Il pousse ses pions au centre comme une mêlée.', ['On pousse tous ensemble !'], { kind: 'human', hat: 'headband', hair: 4, hairColor: '#2b2016', beard: 'full', mouth: 'grin', skin: '#d9a07a' }, ['ecossaise', 'sicilienne']),
  mk('amelie', 'Amélie', 1550, '#cdb4db', 'Club', 'tactique', 'Joueuse de club tacticienne', 'Elle résout 50 puzzles par jour et voit les fourchettes avant tout le monde.', ['Tu aimes les tactiques ? Moi aussi.'], { kind: 'human', hair: 1, hairColor: '#a0522d', mouth: 'smirk' }, ['sicilienne', 'italienne']),
  mk('bernard', 'Bernard le Retraité', 1650, '#adb5bd', 'Club', 'defensif', 'Défense solide, contre-attaque', 'Ancien champion départemental, il connaît toutes les forteresses.', ['À mon âge, on ne se précipite plus.'], { kind: 'human', hair: 5, hairColor: '#e8e1d6', beard: 'moustache', eyes: 'glasses', mouth: 'flat' }, ['carokann', 'petrov']),
  mk('yasmine', 'Yasmine', 1750, '#f4a261', 'Club', 'equilibre', 'Universelle', 'Championne régionale junior, à l’aise dans tous les types de positions.', ['Prête pour une vraie partie ?'], { kind: 'human', hair: 2, hairColor: '#2b2016', mouth: 'smile', skin: '#8d5a3b' }, ['espagnole', 'nimzo']),
  mk('dragonnet', 'Dragonnet', 1850, '#57cc99', 'Club', 'agressif', 'Spécialiste du Dragon', 'Un petit dragon qui crache du feu sur la grande diagonale.', ['Mon fou en g7 crache du feu !'], { kind: 'dragon', eyes: 'sharp', mouth: 'grin' }, ['sicilienne', 'indienneroi']),
  mk('clement', 'Clément l’Ingénieur', 1950, '#577590', 'Club', 'positionnel', 'Précis et logique', 'Il optimise chaque coup comme un algorithme.', ['Optimisons cette position.'], { kind: 'human', hair: 0, hairColor: '#5a3825', eyes: 'glasses', mouth: 'flat' }, ['gambitdame', 'catalane']),
  mk('lea', 'Léa la Pilote', 2050, '#ff595e', 'Experts', 'agressif', 'Rapide, attaques de pions', 'Pilote de rallye : elle lance ses pions à toute vitesse sur ton roque.', ['Attache ta ceinture.'], { kind: 'human', hat: 'helmet', mouth: 'grin', skin: '#d9a07a' }, ['sicilienne', 'indienneroi']),
  mk('ivan', 'Ivan le Méthodique', 2150, '#8ecae6', 'Experts', 'positionnel', 'École classique', 'Formé à l’école des grands entraîneurs : prophylaxie, cases faibles, patience.', ['La prophylaxie, toujours.'], { kind: 'human', hair: 0, hairColor: '#8a8a8a', beard: 'full', mouth: 'flat' }, ['gambitdame', 'espagnole']),
  mk('celeste', 'Céleste la Calculatrice', 2250, '#9d4edd', 'Experts', 'tactique', 'Calcule très loin', 'Elle calcule dix coups à l’avance… dans toutes les variantes.', ['J’ai déjà calculé la suite.'], { kind: 'human', hair: 1, hairColor: '#1f2a44', eyes: 'sharp', mouth: 'smirk' }, ['sicilienne', 'grunfeld']),
  mk('hector', 'Hector le Mur', 2350, '#6c757d', 'Experts', 'defensif', 'Défense inébranlable', 'Le joueur le plus difficile à battre du club : il ne perd presque jamais.', ['Essaie donc de passer.'], { kind: 'human', hat: 'helmet', beard: 'full', hairColor: '#2b2016', mouth: 'flat', skin: '#b97a56' }, ['carokann', 'petrov', 'slave']),
  mk('margot', 'Margot', 2450, '#e76f51', 'Experts', 'finales', 'Technicienne des finales', 'Maître international, elle transforme le moindre avantage en victoire.', ['Un petit avantage me suffit.'], { kind: 'human', hair: 2, hairColor: '#c0392b', mouth: 'smile' }, ['espagnole', 'gambitdame']),
  mk('kenji', 'Kenji', 2550, '#2a9d8f', 'Maîtres', 'equilibre', 'Grand maître universel', 'Un grand maître calme, à l’aise dans toutes les structures.', ['Bonne partie à toi.'], { kind: 'human', hair: 4, hairColor: '#2b2016', eyes: 'glasses', mouth: 'flat' }, ['espagnole', 'nimzo', 'catalane']),
  mk('valkyrie', 'Valkyrie', 2650, '#d00000', 'Maîtres', 'agressif', 'Attaques foudroyantes', 'Elle sacrifie pour attaquer et ne laisse jamais respirer.', ['Prépare-toi au combat.'], { kind: 'human', hat: 'helmet', hair: 2, hairColor: '#d9a441', eyes: 'sharp', mouth: 'smirk' }, ['sicilienne', 'gambitroi']),
  mk('sphinx', 'Le Sphinx', 2750, '#c9a227', 'Maîtres', 'positionnel', 'Énigmatique et profond', 'Ses coups semblent anodins… jusqu’à ce que ta position s’effondre.', ['Résoudras-tu mon énigme ?'], { kind: 'human', hat: 'crown', eyes: 'sharp', mouth: 'flat', skin: '#b97a56', hair: 6 }, ['anglaise', 'catalane']),
  mk('titan', 'Titan', 2900, '#495057', 'Maîtres', 'equilibre', 'Niveau super grand maître', 'Une machine de précision au niveau des meilleurs joueurs du monde.', ['Que la meilleure stratégie gagne.'], { kind: 'robot' }, ['espagnole', 'nimzo']),
  mk('omega', 'Oméga', 3200, '#000000', 'Maîtres', 'equilibre', 'Moteur absolu', 'Stockfish à sa puissance maximale, avec beaucoup de temps de réflexion.', ['Calcul en cours… à toi de jouer.'], { kind: 'robot', eyes: 'sun', mouth: 'flat' }),
  // Bots thématiques « à la manière de » (styles historiques, sans imiter de vraies personnes)
  mk('romantique', 'Le Romantique', 1600, '#b5179e', 'Styles historiques', 'gambit', 'Style XIXᵉ siècle : gambits et sacrifices', 'Il joue comme dans les cafés parisiens de 1850 : gambit du roi, gambit Evans, sacrifices spectaculaires.', ['À l’ancienne : panache avant tout !'], { kind: 'human', hat: 'tophat', beard: 'full', hairColor: '#2b2016', mouth: 'smile' }, ['gambitroi', 'evans', 'danois']),
  mk('classique', 'Le Professeur Classique', 1900, '#4361ee', 'Styles historiques', 'positionnel', 'École classique : centre et développement', 'Fidèle aux principes de l’école classique : centre de pions, développement, colonnes ouvertes.', ['Le centre d’abord, messieurs-dames.'], { kind: 'human', eyes: 'monocle', beard: 'moustache', hairColor: '#8a8a8a', hair: 0 }, ['gambitdame', 'espagnole']),
  mk('hypermoderne', 'L’Hypermoderne', 2000, '#4cc9f0', 'Styles historiques', 'positionnel', 'Contrôle le centre à distance', 'Fianchettos, pression à distance, le centre adverse comme cible : la révolution des années 1920.', ['Ton centre ? Une cible.'], { kind: 'human', hat: 'beret', eyes: 'glasses', mouth: 'smirk' }, ['reti', 'anglaise', 'indienneroi']),
  mk('machine', 'La Machine de Précision', 2200, '#7209b7', 'Styles historiques', 'finales', 'Technique implacable des années 1920-30', 'Simplicité et précision : elle simplifie et gagne la finale sans effort apparent.', ['Simplifions.'], { kind: 'robot', eyes: 'glasses' }, ['gambitdame', 'londres']),
  mk('dynamique', 'Le Dynamique', 2400, '#f72585', 'Styles historiques', 'tactique', 'Initiative et complications', 'L’école dynamique : déséquilibres, initiative et calcul concret, à la manière des grands champions de l’ère moderne.', ['Les complications, c’est mon terrain.'], { kind: 'human', hair: 4, hairColor: '#2b2016', eyes: 'sharp', mouth: 'grin' }, ['sicilienne', 'indienneroi', 'grunfeld']),
  mk('magicien', 'Le Magicien', 2300, '#560bad', 'Styles historiques', 'chaotique', 'Sacrifices déroutants', 'Il plonge dans des positions irrationnelles où seul lui semble voir clair.', ['Abracadabra, ta position disparaît !'], { kind: 'human', hat: 'wizard', beard: 'goatee', hairColor: '#2b2016', eyes: 'sharp', mouth: 'smirk' }, ['gambitroi', 'sicilienne']),
  mk('forteresse', 'La Forteresse', 1800, '#606c38', 'Styles historiques', 'defensif', 'Défense à la manière des grands défenseurs', 'Elle accepte d’être un peu passive pour ne laisser aucune faiblesse.', ['Mes remparts sont solides.'], { kind: 'human', hat: 'helmet', mouth: 'flat', hair: 6 }, ['carokann', 'petrov', 'francaise']),
  // Spécialistes d'entraînement
  mk('roquetout', 'Capitaine Roque', 1000, '#3a86ff', 'Spécialistes', 'equilibre', 'Spécialiste des ouvertures', 'Il connaît par cœur ses lignes de l’italienne et de l’espagnole : idéal pour réviser.', ['Révisons la théorie !'], { kind: 'human', hat: 'pirate', beard: 'moustache', hairColor: '#a0522d' }, ['italienne', 'espagnole', 'ecossaise']),
  mk('pionnier', 'Le Pionnier', 1200, '#80b918', 'Spécialistes', 'finales', 'Adore les finales de pions', 'Il échange tout pour arriver aux finales de pions qu’il adore.', ['Les pions sont l’âme des échecs.'], { kind: 'human', hat: 'cap', hair: 0, hairColor: '#d9a441', mouth: 'smile' }, ['londres']),
  mk('kamikaze', 'Kamikaze', 1300, '#ff0054', 'Spécialistes', 'agressif', 'Attaque à tout prix', 'Il attaque ton roi même quand ce n’est pas une bonne idée : apprends à défendre !', ['Banzaï !'], { kind: 'human', hat: 'headband', eyes: 'sharp', mouth: 'grin' }, ['gambitroi', 'sicilienne']),
];
export const BOTS: Bot[] = [...ORIGINAUX, ...NOUVEAUX].sort((a, b) => a.elo - b.elo);
export const BOT_GROUPS = ['Débutants', 'Intermédiaires', 'Club', 'Experts', 'Maîtres', 'Styles historiques', 'Spécialistes'];

export const botById = (id: string) => BOTS.find((b) => b.id === id) || BOTS[0];
