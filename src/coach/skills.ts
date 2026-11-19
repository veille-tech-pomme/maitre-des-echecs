// Catalogue des compétences suivies par le modèle du joueur, et correspondances (thèmes Lichess, leçons, motifs).
export type SkillId =
  | 'fork' | 'pin' | 'skewer' | 'discovered' | 'mate1' | 'mateN' | 'backRank' | 'sacrifice' | 'freePiece' | 'trapped'
  | 'defense' | 'quiet' | 'calculation' | 'attack' | 'vigilance' | 'principles' | 'theory'
  | 'pawnEnd' | 'rookEnd' | 'minorEnd' | 'queenEnd' | 'technique' | 'kingSafety' | 'structure' | 'activity' | 'conversion' | 'resilience';
export type Family = 'tactics' | 'vision' | 'calc' | 'opening' | 'endgame' | 'strategy';
export interface SkillDef { id: SkillId; label: string; family: Family; theme?: string; lesson?: string; importance: [number, number, number] }
// importance [débutant, intermédiaire, avancé]
export const SKILLS: SkillDef[] = [
  { id: 'vigilance', label: 'Vigilance (pièces en prise)', family: 'vision', theme: 'hangingPiece', lesson: 'i-materiel', importance: [1, 0.9, 0.7] },
  { id: 'freePiece', label: 'Prendre le matériel offert', family: 'vision', theme: 'hangingPiece', lesson: 'i-materiel', importance: [1, 0.7, 0.4] },
  { id: 'mate1', label: 'Mat en 1', family: 'tactics', theme: 'mateIn1', lesson: 'd-mat', importance: [1, 0.6, 0.3] },
  { id: 'mateN', label: 'Mats en 2 et plus', family: 'tactics', theme: 'mateIn2', lesson: 'i-calcul', importance: [0.6, 0.9, 0.8] },
  { id: 'backRank', label: 'Mat du couloir', family: 'tactics', theme: 'backRankMate', lesson: 'i-couloir', importance: [0.8, 0.8, 0.5] },
  { id: 'fork', label: 'Fourchettes', family: 'tactics', theme: 'fork', lesson: 'i-fourchette', importance: [0.9, 1, 0.7] },
  { id: 'pin', label: 'Clouages', family: 'tactics', theme: 'pin', lesson: 'i-clouage', importance: [0.7, 1, 0.7] },
  { id: 'skewer', label: 'Enfilades', family: 'tactics', theme: 'skewer', lesson: 'i-enfilade', importance: [0.5, 0.8, 0.6] },
  { id: 'discovered', label: 'Attaques à la découverte', family: 'tactics', theme: 'discoveredAttack', lesson: 'i-decouverte', importance: [0.4, 0.9, 0.8] },
  { id: 'sacrifice', label: 'Sacrifices et déviations', family: 'tactics', theme: 'deflection', lesson: 'i-calcul', importance: [0.2, 0.6, 0.9] },
  { id: 'trapped', label: 'Pièces piégées', family: 'tactics', theme: 'trappedPiece', importance: [0.3, 0.6, 0.6] },
  { id: 'attack', label: 'Attaque du roi', family: 'tactics', theme: 'kingsideAttack', importance: [0.3, 0.7, 0.9] },
  { id: 'defense', label: 'Défense', family: 'calc', theme: 'defensiveMove', lesson: 'e-prophylaxie', importance: [0.4, 0.7, 1] },
  { id: 'quiet', label: 'Coups calmes', family: 'calc', theme: 'quietMove', lesson: 'e-plans', importance: [0.1, 0.5, 0.9] },
  { id: 'calculation', label: 'Calcul (longues variantes)', family: 'calc', theme: 'mateIn3', lesson: 'e-calcul', importance: [0.2, 0.6, 1] },
  { id: 'principles', label: 'Principes d’ouverture', family: 'opening', lesson: 'i-principes', importance: [1, 0.6, 0.3] },
  { id: 'theory', label: 'Connaissance des ouvertures', family: 'opening', importance: [0.2, 0.6, 0.8] },
  { id: 'pawnEnd', label: 'Finales de pions', family: 'endgame', theme: 'pawnEndgame', lesson: 'a-opposition', importance: [0.5, 0.8, 0.9] },
  { id: 'rookEnd', label: 'Finales de tours', family: 'endgame', theme: 'rookEndgame', lesson: 'e-finales-tours', importance: [0.2, 0.6, 1] },
  { id: 'minorEnd', label: 'Finales de pièces mineures', family: 'endgame', theme: 'bishopEndgame', importance: [0.1, 0.4, 0.7] },
  { id: 'queenEnd', label: 'Finales de dames', family: 'endgame', theme: 'queenEndgame', importance: [0.1, 0.3, 0.6] },
  { id: 'technique', label: 'Technique de finale', family: 'endgame', theme: 'endgame', importance: [0.4, 0.7, 0.9] },
  { id: 'conversion', label: 'Gagner une position gagnante', family: 'strategy', importance: [0.6, 0.9, 1] },
  { id: 'resilience', label: 'Défendre une position difficile', family: 'strategy', importance: [0.3, 0.6, 0.9] },
  { id: 'kingSafety', label: 'Sécurité du roi', family: 'strategy', lesson: 'i-couloir', importance: [0.7, 0.8, 0.8] },
  { id: 'structure', label: 'Structure de pions', family: 'strategy', importance: [0.2, 0.6, 0.9] },
  { id: 'activity', label: 'Activité des pièces', family: 'strategy', importance: [0.4, 0.7, 0.9] },
];
export const SKILL = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, SkillDef>;
export const FAMILY_LABEL: Record<Family, string> = { tactics: 'Tactique', vision: 'Vigilance', calc: 'Calcul', opening: 'Ouvertures', endgame: 'Finales', strategy: 'Stratégie' };
export const FAMILIES: Family[] = ['tactics', 'vision', 'calc', 'opening', 'endgame', 'strategy'];
/** Thèmes Lichess → compétences. */
const THEME_SKILL: Record<string, SkillId> = {
  fork: 'fork', pin: 'pin', skewer: 'skewer', discoveredAttack: 'discovered', discoveredCheck: 'discovered', doubleCheck: 'discovered', xRayAttack: 'skewer',
  mateIn1: 'mate1', mateIn2: 'mateN', mateIn3: 'mateN', mateIn4: 'mateN', mateIn5: 'mateN', backRankMate: 'backRank',
  sacrifice: 'sacrifice', attraction: 'sacrifice', deflection: 'sacrifice', clearance: 'sacrifice', interference: 'sacrifice', capturingDefender: 'sacrifice',
  hangingPiece: 'freePiece', trappedPiece: 'trapped', defensiveMove: 'defense', equality: 'defense', quietMove: 'quiet', zugzwang: 'quiet', intermezzo: 'calculation',
  kingsideAttack: 'attack', queensideAttack: 'attack', exposedKing: 'attack', attackingF2F7: 'attack',
  pawnEndgame: 'pawnEnd', rookEndgame: 'rookEnd', bishopEndgame: 'minorEnd', knightEndgame: 'minorEnd', queenEndgame: 'queenEnd', queenRookEndgame: 'queenEnd',
};
export function skillsForPuzzle(themes: string[], plies: number): SkillId[] {
  const s = new Set<SkillId>(); for (const t of themes) { const k = THEME_SKILL[t]; if (k) s.add(k); }
  if (plies >= 7) s.add('calculation');
  if (themes.includes('endgame') && ![...s].some((x) => SKILL[x].family === 'endgame')) s.add('technique');
  return [...s];
}
/** Motif du coach → compétence. */
export const MOTIF_SKILL: Record<string, SkillId> = { fork: 'fork', pin: 'pin', skewer: 'skewer', discoveredAttack: 'discovered', discoveredCheck: 'discovered', doubleCheck: 'discovered', trappedPiece: 'trapped', capturingDefender: 'sacrifice', overload: 'sacrifice', hangingCapture: 'freePiece', promotion: 'technique' };
/** Leçons du parcours → compétences. */
export function skillsForLesson(id: string): SkillId[] {
  const out = SKILLS.filter((s) => s.lesson === id).map((s) => s.id);
  if (/mat/.test(id)) out.push('mate1'); if (/final|opposition|pion/.test(id)) out.push('technique'); if (/ouvert|princip|centre|develop/.test(id)) out.push('principles');
  if (/fourchette/.test(id)) out.push('fork'); if (/clouage/.test(id)) out.push('pin'); if (/enfilade/.test(id)) out.push('skewer'); if (/decouverte/.test(id)) out.push('discovered');
  return [...new Set(out)];
}
