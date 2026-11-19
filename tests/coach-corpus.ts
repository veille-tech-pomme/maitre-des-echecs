// Corpus étiqueté à la main pour les détecteurs du coach : positifs ET négatifs.
// Chaque cas : FEN, coup UCI, motifs attendus (doivent être détectés) et interdits (ne doivent pas l'être).
import type { MotifKey } from '../src/coach/motifs';
export interface MoveCase { name: string; fen: string; uci: string; mate?: boolean; expect: MotifKey[]; forbid: MotifKey[] }
export const MOVE_CASES: MoveCase[] = [
  { name: 'fourchette de cavalier roi + tour', fen: 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1', uci: 'd5c7', expect: ['fork', 'check'], forbid: ['sacrifice', 'trappedPiece'] },
  { name: 'cavalier attaque deux pions défendus (pas une fourchette)', fen: '4k3/3p4/2p1p3/8/8/5N2/8/4K3 w - - 0 1', uci: 'f3d4', expect: [], forbid: ['fork'] },
  { name: 'fourchette de pion protégée', fen: '4k3/8/8/2n1b3/8/2PP4/8/4K3 w - - 0 1', uci: 'd3d4', expect: ['fork'], forbid: ['sacrifice'] },
  { name: 'pion « fourchette » mais pris par le fou (pas une fourchette)', fen: '4k3/8/8/2n1b3/8/3P4/8/4K3 w - - 0 1', uci: 'd3d4', expect: [], forbid: ['fork'] },
  { name: 'fourchette de dame roi + tour non protégée', fen: '4k3/8/8/8/8/8/4r3/K2Q4 w - - 0 1', uci: 'd1h5', expect: ['fork', 'check'], forbid: [] },
  { name: 'clouage absolu du cavalier', fen: '4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1', uci: 'f1b5', expect: ['pin'], forbid: ['fork', 'trappedPiece'] },
  { name: 'clouage relatif cavalier devant la dame', fen: '3qk3/8/8/3n4/8/8/8/R3K3 w - - 0 1', uci: 'a1d1', expect: ['pin'], forbid: [] },
  { name: 'tour offerte (rayons X de la tour d8), pas de clouage', fen: '3rk3/8/8/3r4/8/8/8/R3K3 w - - 0 1', uci: 'a1d1', expect: ['sacrifice'], forbid: ['pin'] },
  { name: 'enfilade roi → dame', fen: '8/8/8/8/q3k3/8/8/4K2R w - - 0 1', uci: 'h1h4', expect: ['skewer', 'check'], forbid: [] },
  { name: 'attaque à la découverte sur la tour', fen: 'k6r/8/8/8/3N4/8/1B6/4K3 w - - 0 1', uci: 'd4f5', expect: ['discoveredAttack'], forbid: ['discoveredCheck'] },
  { name: 'échec à la découverte', fen: '4k3/8/8/8/4N3/8/8/K3R3 w - - 0 1', uci: 'e4c5', expect: ['discoveredCheck'], forbid: ['doubleCheck'] },
  { name: 'échec double', fen: '4k3/8/8/8/4N3/8/8/K3R3 w - - 0 1', uci: 'e4d6', expect: ['doubleCheck', 'discoveredCheck'], forbid: [] },
  { name: 'mat du couloir', fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', uci: 'a1a8', mate: true, expect: ['mate', 'backRankMate'], forbid: ['smotheredMate'] },
  { name: 'mat à l’étouffée', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', uci: 'g5f7', mate: true, expect: ['mate', 'smotheredMate'], forbid: ['backRankMate'] },
  { name: 'pièce gratuite', fen: '4k3/8/8/4n3/8/2B5/8/4K3 w - - 0 1', uci: 'c3e5', expect: ['hangingCapture'], forbid: ['sacrifice'] },
  { name: 'échange égal (pas une pièce gratuite)', fen: '4k3/8/3p4/4n3/8/2B5/8/4K3 w - - 0 1', uci: 'c3e5', expect: [], forbid: ['hangingCapture'] },
  { name: 'fou offert à un pion', fen: '4k3/8/8/8/8/2p5/8/2B1K3 w - - 0 1', uci: 'c1d2', expect: ['sacrifice'], forbid: ['fork'] },
  { name: 'développement calme (rien à signaler)', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', uci: 'g8f6', expect: [], forbid: ['fork', 'pin', 'skewer', 'sacrifice', 'hangingCapture', 'discoveredAttack'] },
  { name: 'promotion', fen: '8/4P3/8/8/8/8/k7/4K3 w - - 0 1', uci: 'e7e8q', expect: ['promotion'], forbid: [] },
  { name: 'élimination du défenseur', fen: 'k7/8/5n2/3b4/8/8/8/3R1RK1 w - - 0 1', uci: 'f1f6', expect: ['capturingDefender'], forbid: [] },
  { name: 'cavalier piégé en h8', fen: '7n/8/k3P3/7P/8/8/8/1R4K1 w - - 0 1', uci: 'b1b8', expect: ['trappedPiece'], forbid: ['fork', 'sacrifice'] },
  { name: 'cavalier attaqué mais libre (pas piégé)', fen: '7n/8/k7/8/8/8/8/1R4K1 w - - 0 1', uci: 'b1b8', expect: [], forbid: ['trappedPiece'] },
  { name: 'fourchette de roi', fen: '8/8/8/2r5/8/3Kn3/8/7k w - - 0 1', uci: 'd3d4', expect: ['fork'], forbid: [] },
  { name: 'échec simple sans gain', fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', uci: 'a1a8', expect: ['check'], forbid: ['fork', 'skewer', 'pin'] },
];
export interface StaticCase { name: string; fen: string; check: string }
