// Adversaires IA avec personnalités (tous gratuits et illimités).
export interface Bot {
  id: string; name: string; elo: number; avatar: string; color: string; style: string; bio: string;
  // paramètres moteur
  depth: number; multipv: number; temp: number; randomPct: number; limitElo?: number; movetime?: number;
  captureBias?: number; checkBias?: number; tradeBias?: number; book?: string[][];
  lines: { hello: string[]; capture: string[]; check: string[]; userBlunder: string[]; win: string[]; lose: string[]; draw: string[] };
}
export const BOTS: Bot[] = [
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
    lines: { hello: ['Initialisation… calcul de 1 000 000 positions par seconde.'], capture: ['Matériel +1.'], check: ['Échec.'], userBlunder: ['Évaluation : gagnant.'], win: ['Victoire calculée au coup 3.'], lose: ['Erreur… impossible… bravo, humain !'], draw: ['Nulle forcée détectée.'] } },
];
export const botById = (id: string) => BOTS.find((b) => b.id === id) || BOTS[0];
