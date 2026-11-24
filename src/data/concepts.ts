// Graphe des notions (cahier GOAT, pilier 2, F2.1) : la granularité sous les 26 compétences du modèle.
// Chaque notion : famille, compétence du modèle, prérequis, leçons qui l'enseignent, thèmes Lichess, public.
// Les étapes d'exercice reçoivent leurs notions par `conceptsOfStep` (étiquette explicite `concepts` de l'étape,
// sinon leçon/cours → notions) ; tests/concepts.test.ts vérifie que 100 % des étapes d'exercice en ont au moins une.
import type { SkillId } from '../coach/skills';

export type ConceptFamily = 'rules' | 'tactics' | 'mates' | 'openings' | 'endgames' | 'strategy';
export const CONCEPT_FAMILY_LABEL: Record<ConceptFamily, string> = { rules: 'Règles', tactics: 'Tactique', mates: 'Mats', openings: 'Ouvertures', endgames: 'Finales', strategy: 'Stratégie' };
export interface Concept { id: string; label: string; def: string; family: ConceptFamily; skill: SkillId; prereq: string[]; lessons: string[]; puzzleThemes: string[]; audience: 'all' | 'adult' }
const C = (id: string, label: string, family: ConceptFamily, skill: SkillId, def: string, lessons: string[] = [], puzzleThemes: string[] = [], prereq: string[] = []): Concept => ({ id, label, def, family, skill, prereq, lessons, puzzleThemes, audience: 'all' });
export const CONCEPTS: Concept[] = [
  // règles
  C('moves', 'Déplacements des pièces', 'rules', 'vigilance', 'Chaque pièce a sa façon de se déplacer et de prendre.', ['d-echiquier', 'd-tour-fou', 'd-dame-roi', 'd-cavalier', 'd-pion', 'd-notation']),
  C('captures', 'Prises et valeur des pièces', 'rules', 'freePiece', 'Pion 1, cavalier et fou 3, tour 5, dame 9 : on compte avant d’échanger.', ['d-captures'], [], ['moves']),
  C('check', 'L’échec', 'rules', 'vigilance', 'Le roi est attaqué : il faut parer tout de suite (fuir, interposer ou prendre).', ['d-echec'], [], ['moves']),
  C('checkmate', 'L’échec et mat', 'rules', 'mate1', 'Le roi est en échec et ne peut plus l’éviter : la partie est finie.', ['d-mat', 'd-premiere-partie'], ['mateIn1'], ['check']),
  C('stalemate', 'Le pat et les nulles', 'rules', 'technique', 'Pas d’échec mais aucun coup légal : c’est nulle. Attention en finale gagnante.', ['d-pat-nulles'], [], ['check']),
  C('castling', 'Le roque', 'rules', 'kingSafety', 'Roi et tour bougent ensemble pour mettre le roi à l’abri.', ['d-roque'], ['castling'], ['moves']),
  C('en-passant', 'La prise en passant', 'rules', 'vigilance', 'Un pion qui avance de deux cases peut être pris comme s’il n’avait avancé que d’une.', ['d-coups-speciaux'], ['enPassant'], ['moves']),
  C('promotion', 'La promotion', 'rules', 'technique', 'Un pion qui atteint la dernière rangée devient une autre pièce, souvent une dame.', ['d-coups-speciaux'], ['promotion', 'underPromotion', 'advancedPawn'], ['moves']),
  // tactique
  C('hanging', 'Pièces en prise', 'tactics', 'vigilance', 'Une pièce attaquée et mal défendue peut être prise gratuitement.', ['i-materiel'], ['hangingPiece'], ['captures']),
  C('threat', 'Voir la menace', 'tactics', 'vigilance', 'Avant chaque coup, se demander ce que veut l’adversaire.', ['i-calcul'], ['defensiveMove'], ['hanging']),
  C('fork', 'La fourchette', 'tactics', 'fork', 'Une pièce attaque deux cibles à la fois.', ['i-fourchette'], ['fork'], ['hanging']),
  C('pin', 'Le clouage', 'tactics', 'pin', 'Une pièce ne peut pas bouger sans exposer une pièce plus importante derrière elle.', ['i-clouage'], ['pin'], ['hanging']),
  C('skewer', 'L’enfilade et les rayons X', 'tactics', 'skewer', 'On attaque une grosse pièce qui, en fuyant, découvre celle de derrière.', ['i-enfilade'], ['skewer', 'xRayAttack'], ['pin']),
  C('discovered', 'Découverte et échec double', 'tactics', 'discovered', 'Une pièce s’écarte et démasque l’attaque d’une autre.', ['i-decouverte'], ['discoveredAttack', 'discoveredCheck', 'doubleCheck'], ['pin']),
  C('deflection', 'Déviation et attraction', 'tactics', 'sacrifice', 'On force une pièce adverse à quitter (ou à venir sur) une case clé.', [], ['deflection', 'attraction', 'clearance', 'interference'], ['fork']),
  C('removing-defender', 'Éliminer le défenseur', 'tactics', 'sacrifice', 'On prend la pièce qui protège, puis la cible tombe.', [], ['capturingDefender', 'overloading'], ['hanging']),
  C('sacrifice', 'Le sacrifice', 'tactics', 'sacrifice', 'Donner du matériel pour obtenir plus : mat, matériel ou attaque.', [], ['sacrifice'], ['deflection']),
  C('trapped', 'Pièce piégée', 'tactics', 'trapped', 'Une pièce attaquée n’a plus de case sûre.', [], ['trappedPiece'], ['hanging']),
  C('intermezzo', 'Le coup intermédiaire', 'tactics', 'calculation', 'Avant de reprendre, un coup plus fort (souvent un échec).', [], ['intermezzo'], ['threat']),
  C('quiet-move', 'Le coup tranquille', 'tactics', 'quiet', 'Un coup sans échec ni prise qui prépare une menace imparable.', ['e-calcul'], ['quietMove'], ['threat']),
  C('calculation', 'Calcul : coups candidats', 'tactics', 'calculation', 'Lister les coups forçants (échecs, prises, menaces) et les calculer jusqu’au bout.', ['i-calcul', 'e-calcul'], ['mateIn3', 'mateIn4'], ['threat']),
  C('king-attack', 'Attaque du roi', 'tactics', 'attack', 'Amener plus de pièces que l’adversaire près de son roi.', [], ['kingsideAttack', 'queensideAttack', 'exposedKing', 'attackingF2F7'], ['check']),
  // mats
  C('mate-in-1', 'Mat en 1', 'mates', 'mate1', 'Trouver le coup qui mate tout de suite.', ['d-mat'], ['mateIn1'], ['checkmate']),
  C('back-rank', 'Le mat du couloir', 'mates', 'backRank', 'Un roi enfermé derrière ses pions est maté sur sa dernière rangée.', ['i-couloir'], ['backRankMate'], ['mate-in-1']),
  C('mate-patterns', 'Les mats typiques', 'mates', 'mateN', 'Des dessins de mat qui reviennent : étouffé, Anastasia, arabe, Boden…', ['i-mats-typiques'], ['smotheredMate', 'anastasiaMate', 'arabianMate', 'bodenMate', 'hookMate', 'doubleBishopMate', 'dovetailMate'], ['mate-in-1']),
  C('mate-in-2', 'Mats en 2 et plus', 'mates', 'mateN', 'Un coup forçant prépare le mat au coup suivant.', ['i-calcul'], ['mateIn2', 'mateIn3'], ['mate-in-1']),
  C('basic-mates', 'Mats élémentaires', 'mates', 'technique', 'Mater avec dame ou tour contre le roi seul : réduire la boîte.', ['i-mat-dame', 'i-mat-tour'], [], ['checkmate']),
  // ouvertures
  C('opening-principles', 'Principes d’ouverture', 'openings', 'principles', 'Centre, développement, roi à l’abri.', ['i-principes'], [], ['moves']),
  C('open-games', 'Parties ouvertes (1.e4 e5)', 'openings', 'theory', 'Italienne, espagnole, écossaise : jeu rapide autour du centre.', ['a-ouv-ouvertes'], [], ['opening-principles']),
  C('e4-defences', 'Répondre à 1.e4', 'openings', 'theory', 'Sicilienne, française, Caro-Kann : déséquilibrer dès l’ouverture.', ['a-ouv-e4'], [], ['opening-principles']),
  C('closed-games', 'Jeux fermés (1.d4)', 'openings', 'theory', 'Gambit dame, indiennes : la bataille des cases centrales.', ['a-ouv-d4'], [], ['opening-principles']),
  C('opening-traps', 'Pièges d’ouverture', 'openings', 'principles', 'Les pièges classiques à éviter (et à punir).', [], [], ['opening-principles']),
  // finales
  C('opposition', 'L’opposition', 'endgames', 'pawnEnd', 'Rois face à face : celui qui n’a pas le trait cède le passage.', ['a-opposition'], ['pawnEndgame'], ['promotion']),
  C('square-rule', 'La règle du carré', 'endgames', 'pawnEnd', 'Le roi rattrape le pion s’il entre dans son carré.', ['a-carre'], ['pawnEndgame'], ['promotion']),
  C('pawn-endgames', 'Finales de pions', 'endgames', 'pawnEnd', 'Roi actif, pion passé, cases clés.', [], ['pawnEndgame'], ['opposition']),
  C('lucena', 'La position de Lucena', 'endgames', 'rookEnd', 'Construire le pont pour abriter son roi et promouvoir.', ['a-lucena'], ['rookEndgame'], ['opposition']),
  C('philidor', 'La position de Philidor', 'endgames', 'rookEnd', 'Tour sur la 3e rangée, puis tout en bas quand le pion avance : nulle.', ['a-philidor'], ['rookEndgame'], ['opposition']),
  C('rook-endgames', 'Finales de tours', 'endgames', 'rookEnd', 'Tour active, roi coupé, pions passés.', ['e-finales-tours'], ['rookEndgame'], ['lucena', 'philidor']),
  C('minor-endgames', 'Finales de pièces mineures', 'endgames', 'minorEnd', 'Fou contre cavalier, mats difficiles.', [], ['bishopEndgame', 'knightEndgame'], ['pawn-endgames']),
  C('queen-endgames', 'Finales de dames', 'endgames', 'queenEnd', 'Dame contre pion, échecs perpétuels.', [], ['queenEndgame', 'queenRookEndgame'], ['pawn-endgames']),
  C('zugzwang', 'Zugzwang et triangulation', 'endgames', 'quiet', 'Obliger l’adversaire à jouer quand tout coup l’affaiblit.', ['e-finales-complexes'], ['zugzwang'], ['opposition']),
  C('studies', 'Études', 'endgames', 'calculation', 'Positions composées où un seul chemin gagne.', [], [], ['zugzwang']),
  // stratégie
  C('pawn-structure', 'Structures de pions', 'strategy', 'structure', 'Pions isolés, doublés, passés : ils dictent les plans.', ['a-structures'], [], ['opening-principles']),
  C('outposts', 'Avant-postes, bons et mauvais fous', 'strategy', 'activity', 'Une case qu’aucun pion adverse ne peut chasser ; un fou bloqué par ses pions.', ['a-pieces'], [], ['pawn-structure']),
  C('open-files', 'Colonnes ouvertes et 7e rangée', 'strategy', 'activity', 'Les tours veulent les colonnes ouvertes puis la 7e rangée.', ['a-colonnes'], [], ['pawn-structure']),
  C('prophylaxis', 'La prophylaxie', 'strategy', 'defense', 'Empêcher le plan adverse avant qu’il ne commence.', ['e-prophylaxie'], [], ['threat']),
  C('planning', 'Faire un plan', 'strategy', 'structure', 'Choisir un objectif selon la structure, puis y amener ses pièces.', ['e-plans'], [], ['pawn-structure']),
  C('middlegame-structures', 'Structures du milieu de jeu', 'strategy', 'structure', 'Pion isolé, Carlsbad, Maroczy, pions pendants : un plan par structure.', [], [], ['pawn-structure']),
  C('famous-games', 'Parties célèbres', 'strategy', 'activity', 'Les grandes idées des champions, coup par coup.', ['e-opera', 'e-immortelle', 'e-toujours-jeune', 'e-siecle'], [], ['opening-principles']),
];
export const CONCEPT: Record<string, Concept> = Object.fromEntries(CONCEPTS.map((c) => [c.id, c]));
export type ConceptId = string;
const THEME_CONCEPT: Record<string, string> = {};
for (const c of CONCEPTS) for (const t of c.puzzleThemes) THEME_CONCEPT[t] ||= c.id;
/** Thèmes Lichess d'un puzzle → notions. */
export function conceptsForThemes(themes: string[]): ConceptId[] { return [...new Set(themes.map((t) => THEME_CONCEPT[t]).filter(Boolean))]; }
/** Motif du coach (motifs.ts / diagnostic) → notion. */
export const MOTIF_CONCEPT: Record<string, ConceptId> = {
  fork: 'fork', pin: 'pin', skewer: 'skewer', discoveredAttack: 'discovered', discoveredCheck: 'discovered', doubleCheck: 'discovered', hangingCapture: 'hanging', trappedPiece: 'trapped',
  overload: 'removing-defender', capturingDefender: 'removing-defender', sacrifice: 'sacrifice', promotion: 'promotion', check: 'check', mate: 'mate-in-1', backRankMate: 'back-rank', smotheredMate: 'mate-patterns', mateThreat: 'threat',
  hanging: 'hanging', threat: 'threat', material: 'hanging',
};
const LESSON_CONCEPTS: Record<string, ConceptId[]> = {};
for (const c of CONCEPTS) for (const l of c.lessons) (LESSON_CONCEPTS[l] ||= []).push(c.id);
/** Notions d'une leçon (parcours ou cours) d'après son identifiant. */
export function conceptsOfLesson(id: string): ConceptId[] {
  if (LESSON_CONCEPTS[id]) return LESSON_CONCEPTS[id];
  const [pre, rest = ''] = id.split(/-(.*)/s);
  if (pre === 'tactique' || pre === 'finales') { const c = conceptsForThemes([rest]); if (c.length) return c; }
  if (pre === 'tactique') return rest === 'castling' ? ['castling'] : rest === 'enPassant' ? ['en-passant'] : ['calculation'];
  if (pre === 'mats') return id === 'mats-backRankMate' ? ['back-rank'] : id === 'mats-legal' ? ['opening-traps', 'mate-patterns'] : ['mate-patterns'];
  if (pre === 'ouv') return ['opening-principles', /sicil|franc|caro|scandi|pirc|alekh|moderne|najdorf|dragon|alapin|winawer|tarrasch|smith/.test(rest) ? 'e4-defences' : /gambitdame|londres|indienne|nimzo|catalane|slave|grunfeld|benoni|hollandaise|budapest|colle|trompowsky|jobava|anglaise|reti|bird/.test(rest) ? 'closed-games' : 'open-games'];
  if (pre === 'mil') return ['middlegame-structures', 'planning'];
  if (pre === 'strat') return ({ centre: ['opening-principles'], developpement: ['opening-principles'], structure: ['pawn-structure'], avantposte: ['outposts'], colonnes: ['open-files'], 'fous-cavaliers': ['outposts'], prophylaxie: ['prophylaxis'], 'attaque-roi': ['king-attack'], echanges: ['captures', 'planning'], plan: ['planning'] } as Record<string, ConceptId[]>)[rest] || ['planning'];
  if (pre === 'fin') return ['pawn-endgames', 'rook-endgames', 'minor-endgames', 'queen-endgames', 'studies', 'zugzwang'].slice(+rest || 0, (+rest || 0) + 1);
  if (pre === 'partie') return ['famous-games'];
  return [];
}
/** Notions d'une étape d'exercice : étiquette explicite, sinon celles de la leçon. */
export function conceptsOfStep(lessonId: string, step: object): ConceptId[] {
  const c = (step as { concepts?: ConceptId[] }).concepts;
  return c?.length ? c : conceptsOfLesson(lessonId);
}
