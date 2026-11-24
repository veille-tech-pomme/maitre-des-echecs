// Corpus du pilier 1 (CA1.2) : au moins une position POSITIVE (la catégorie attendue doit être trouvée) et une
// NÉGATIVE (la catégorie ne doit pas être annoncée) par MistakeKind. Positions construites à la main, vérifiées
// au moteur dans tests/diagnose.test.ts (Stockfish natif).
import type { MistakeKind, GoalKind } from '../src/coach/diagnose';
export interface Case { kind: MistakeKind; positive: boolean; fen: string; played: string; expected: string[]; goal: GoalKind; note: string }
export const CORPUS: Case[] = [
  // 1. illégal (règles, sans moteur) : roi sur une case attaquée, pièce clouée
  { kind: 'illegal', positive: true, fen: '4k3/8/8/8/8/8/3r4/4K3 w - - 0 1', played: 'e1e2', expected: ['e1d2'], goal: 'any', note: 'le roi irait sur une case contrôlée par la tour' },
  { kind: 'illegal', positive: true, fen: '4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1', played: 'e2d3', expected: ['e1d1'], goal: 'any', note: 'fou cloué par la tour e7' },
  { kind: 'illegal', positive: false, fen: '4k3/8/8/8/8/8/3r4/4K3 w - - 0 1', played: 'e1d2', expected: ['e1d2'], goal: 'any', note: 'Rxd2 est légal' },
  // 2. pat
  { kind: 'stalemate', positive: true, fen: '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', played: 'g1g6', expected: ['g1g7'], goal: 'mate', note: 'Dg6 ?? pat (Dg7# existait)' },
  { kind: 'stalemate', positive: false, fen: '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', played: 'g1h2', expected: ['g1g7'], goal: 'mate', note: 'Dh2+ n’est pas pat' },
  // 3. mat manqué
  { kind: 'missedMate', positive: true, fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', played: 'a1a2', expected: ['a1a8'], goal: 'mate', note: 'Ta8# existait' },
  { kind: 'missedMate', positive: false, fen: '6k1/5pp1/7p/8/8/8/8/R5K1 w - - 0 1', played: 'a1a2', expected: ['a1a8'], goal: 'any', note: 'pas de mat en 1 (case h7)' },
  // 4a. menace de mat ignorée
  { kind: 'ignoredMateThreat', positive: true, fen: '3r2k1/5ppp/8/8/8/8/5PPP/1N4K1 w - - 0 1', played: 'b1a3', expected: ['h2h4'], goal: 'any', note: 'Td1# menaçait déjà' },
  { kind: 'ignoredMateThreat', positive: false, fen: '3r2k1/5ppp/8/8/8/8/5PPP/1N4K1 w - - 0 1', played: 'h2h3', expected: ['h2h4'], goal: 'any', note: 'h3 donne une case au roi' },
  // 4b. échec à la découverte ignoré
  { kind: 'ignoredCheck', positive: true, fen: '4r1k1/8/8/8/4n3/8/P2Q4/4K3 w - - 0 1', played: 'a2a3', expected: ['d2d5'], goal: 'any', note: '…Cxd2+ à la découverte menaçait' },
  { kind: 'ignoredCheck', positive: false, fen: '4r1k1/8/8/8/4n3/8/P2Q4/4K3 w - - 0 1', played: 'd2f4', expected: ['d2d5'], goal: 'any', note: 'la dame quitte d2 : plus de découverte' },
  // 5. pièce en prise
  { kind: 'hanging', positive: true, fen: '4k3/1p6/5p2/8/8/5N2/1P6/4K3 w - - 0 1', played: 'f3g5', expected: ['e1d2'], goal: 'any', note: 'Cg5 ?? fxg5' },
  { kind: 'hanging', positive: false, fen: '4k3/1p6/5p2/8/8/5N2/1P6/4K3 w - - 0 1', played: 'f3h4', expected: ['e1d2'], goal: 'any', note: 'h4 n’est pas attaqué' },
  // 6. échange perdant
  { kind: 'losingTrade', positive: true, fen: '4k3/8/4p3/3p4/8/8/8/3QK3 w - - 0 1', played: 'd1d5', expected: ['e1e2'], goal: 'any', note: 'Dxd5 ?? exd5' },
  { kind: 'losingTrade', positive: false, fen: '4k3/8/8/3p4/8/8/8/3QK3 w - - 0 1', played: 'd1d5', expected: ['d1d5'], goal: 'any', note: 'pion libre' },
  // 7. tactique permise (fourchette)
  { kind: 'allowedTactic', positive: true, fen: 'r3k3/8/8/8/3n4/7Q/8/R5K1 w - - 0 1', played: 'h3c3', expected: ['h3h5'], goal: 'any', note: 'Dc3 ?? Ce2+ fourchette roi-dame' },
  { kind: 'allowedTactic', positive: false, fen: 'r3k3/8/8/8/3n4/7Q/8/R5K1 w - - 0 1', played: 'h3h5', expected: ['h3h5'], goal: 'any', note: 'Dh5+ ne permet rien' },
  // 8a. tactique manquée (fourchette)
  { kind: 'missedTactic', positive: true, fen: 'r3k3/8/8/1N6/8/8/4PP2/4K3 w - - 0 1', played: 'e1d2', expected: ['b5c7'], goal: 'any', note: 'Cc7+ fourchette roi-tour' },
  { kind: 'missedTactic', positive: false, fen: '4k3/8/8/1N6/8/8/4PP2/4K3 w - - 0 1', played: 'e1d2', expected: ['b5c7'], goal: 'any', note: 'rien à fourcheter' },
  // 8b. matériel gratuit manqué
  { kind: 'missedFree', positive: true, fen: '4k3/8/8/8/2n5/8/5PP1/2R1K3 w - - 0 1', played: 'e1e2', expected: ['c1c4'], goal: 'any', note: 'le cavalier c4 est à prendre' },
  { kind: 'missedFree', positive: false, fen: '4k3/8/8/1p6/2n5/8/5PP1/2R1K3 w - - 0 1', played: 'e1e2', expected: ['c1c4'], goal: 'any', note: 'c4 est défendu par b5, rien de gratuit' },
  // 9. objectif manqué (on demande un mat, le coup gagne du matériel)
  { kind: 'wrongGoal', positive: true, fen: '6k1/8/8/1p6/8/8/R7/1R4K1 w - - 0 1', played: 'b1b5', expected: ['a2a7'], goal: 'mate', note: 'Txb5 gagne un pion, mais Ta7 mate en 2' },
  { kind: 'wrongGoal', positive: false, fen: '6k1/8/8/1p6/8/8/R7/1R4K1 w - - 0 1', played: 'b1b5', expected: ['a2a7'], goal: 'any', note: 'objectif non « mat »' },
  { kind: 'wrongGoal', positive: true, fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', played: 'a1a2', expected: ['a1a8'], goal: 'check', note: 'consigne « échec » : Ta2 ne donne pas échec' },
  // 10. positionnel (ouverture)
  { kind: 'positional', positive: true, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', played: 'a2a4', expected: ['e2e4'], goal: 'opening', note: '1.a4 : principe d’ouverture' },
  { kind: 'positional', positive: false, fen: '4k3/1p6/5p2/8/8/5N2/1P6/4K3 w - - 0 1', played: 'f3g5', expected: ['e1d2'], goal: 'any', note: 'faute concrète, pas positionnelle' },
  // 11. mat plus lent
  { kind: 'slower', positive: true, fen: '6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1', played: 'g1f2', expected: ['a2a7'], goal: 'mate', note: 'Rf2 mate plus lentement que Ta7' },
  { kind: 'slower', positive: false, fen: '6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1', played: 'b1b7', expected: ['a2a7'], goal: 'mate', note: 'Tb7 mate aussi vite : accepté' },
];
