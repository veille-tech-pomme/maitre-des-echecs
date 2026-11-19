// Corpus d'erreurs positionnelles annoté à la main (catégories attendues), chaque erreur confirmée par Stockfish 18
// (perte ≥ 40 cp à profondeur 16, sans perte de matériel immédiate). Les catégories viennent de la lecture humaine
// de la ligne du moteur : ce sont des annotations d'expert, pas un étiquetage automatique.
export type Cat = 'kingSafety' | 'pawnStructure' | 'activity' | 'development' | 'space' | 'threat' | 'prophylaxis';
export interface PosCase { id: string; seq?: string; fen?: string; move: string; expect: Cat[]; note: string }
export const POSITIONAL: PosCase[] = [
  { id: 'k-g4', fen: 'r1b2rk1/ppq2ppp/2nbpn2/3p4/3P4/2PBPN2/PP1N1PPP/R2Q1RK1 w - - 0 10', move: 'g4', expect: ['kingSafety'], note: 'g4 ouvre l’abri du roi roqué' },
  { id: 'k-nd7', fen: 'r1bq1rk1/pp2bppp/2n1pn2/3p2N1/3P4/2PBP3/PPQ2PPP/RN2K2R b KQ - 0 9', move: 'Nd7', expect: ['threat', 'kingSafety'], note: 'Cd7 retire le défenseur de h7 : Fxh7+' },
  { id: 'k-nh5', fen: 'r1bq1rk1/ppp1bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R b KQ - 0 6', move: 'Nh5', expect: ['activity'], note: 'cavalier au bord, hors jeu' },
  { id: 'k-g5', fen: 'r1bq1rk1/pp2bpp1/2n1pn1p/3p4/3P1B2/2PBPN2/PP1N1PPP/R2QK2R b KQ - 0 9', move: 'g5', expect: ['kingSafety'], note: '…g5 affaiblit le roque' },
  { id: 'd-qf6', seq: 'e4 e5 Nf3', move: 'Qf6', expect: ['development'], note: 'dame sortie trop tôt' },
  { id: 'd-qh4', seq: 'e4 e5 Nc3', move: 'Qh4', expect: ['development'], note: 'dame sortie trop tôt, perd du temps' },
  { id: 'd-h6', seq: 'e4 e5 Nf3 Nc6 Bc4', move: 'h6', expect: ['development'], note: 'coup de pion lent, d4 frappe le centre' },
  { id: 'd-a6', seq: 'e4 e5 Nf3 Nc6 Bc4', move: 'a6', expect: ['development', 'space'], note: 'coup lent au lieu de développer' },
  { id: 'd-ng5', seq: 'e4 e5 Nf3 Nc6 Bc4 Bc5 Nc3 Nf6', move: 'Ng5', expect: ['development'], note: 'attaque prématurée, même pièce deux fois' },
  { id: 'p-dxc5', seq: 'd4 d5 Nf3 Nf6 e3 e6 Bd3 c5 c3 Nc6', move: 'dxc5', expect: ['pawnStructure', 'space'], note: 'lâche le centre, …e5 libère les Noirs' },
  { id: 'a-na4', fen: 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQ - 0 7', move: 'Na4', expect: ['activity'], note: 'cavalier au bord' },
  { id: 'a-e5', fen: 'r2q1rk1/pp1bppbp/2np1np1/8/2PNP3/2N1B3/PP2BPPP/R2QK2R b KQ - 0 9', move: 'e5', expect: ['pawnStructure', 'activity'], note: 'Cxc6 : d6 arriéré et trou en d5' },
  { id: 'a-ne1', fen: 'r1bq1rk1/pppn1ppp/3bpn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 0 8', move: 'Ne1', expect: ['activity', 'space'], note: 'cavalier passif ; c5 gagnait de l’espace' },
  { id: 'p-gxf3', seq: 'e4 e5 Nf3 Nc6 Bc4 d6 Nc3 Bg4 h3 Bxf3', move: 'gxf3', expect: ['pawnStructure', 'kingSafety'], note: 'pions doublés et roque affaibli' },
  { id: 'a-f5', seq: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3', move: 'f5', expect: ['pawnStructure', 'activity'], note: 'e6 arriéré, fou c8 enfermé' },
  { id: 'k-h5', seq: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O Re1 d6 c3 Na5 Bb5', move: 'h5', expect: ['kingSafety'], note: 'pion h avancé sans raison devant le roque' },
  { id: 'k-nh2', seq: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Na5 Bc2 c5 d4 Qc7', move: 'Nh2', expect: ['activity', 'space'], note: 'cavalier passif ; d5 gagnait de l’espace' },
  { id: 'k-g4kid', seq: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7 Nd3 f5 Bd2 Nf6 f3 f4', move: 'g4', expect: ['kingSafety'], note: 'g4 affaiblit le roi ; c5 était le plan' },
  { id: 'p-a3', seq: 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8 Nc3 Ke8 h3 h5 Bf4 Be7 Rad1 Be6 Ng5 Rh6 Rfe1 Bb4 g4 hxg4 hxg4 Ne7', move: 'a3', expect: ['pawnStructure'], note: '…Fxc3 bxc3 : pions doublés' },
];

// Jeu « tenu à l'écart » : annoté AVANT d'avoir exécuté l'explicateur dessus (2026-11-19), jamais utilisé pour régler
// les seuils. Seules les positions où Stockfish confirme une perte ≥ 40 cp sont comptées (filtre dans le bench).
export const HELDOUT: PosCase[] = [
  { id: 'h-g4', seq: 'e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6 d3 d6 c3 O-O', move: 'g4', expect: ['kingSafety'], note: 'g4 devant son propre roque' },
  { id: 'h-nh4', seq: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7', move: 'Nh4', expect: ['activity'], note: 'cavalier au bord' },
  { id: 'h-ke2', seq: 'e4 e5', move: 'Ke2', expect: ['kingSafety', 'development'], note: 'roi au centre, bloque le fou' },
  { id: 'h-dxc5', seq: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6', move: 'dxc5', expect: ['space', 'pawnStructure'], note: 'lâche la base de la chaîne' },
  { id: 'h-h3', seq: 'e4 e5 Nf3 Nc6 Bc4 Nf6', move: 'h3', expect: ['development'], note: 'coup lent au lieu de d4/Cg5/d3' },
  { id: 'h-g5ruy', seq: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d6 h3', move: 'g5', expect: ['kingSafety'], note: 'g5 devant son roque' },
  { id: 'h-c4fr', seq: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Bd7 Be2', move: 'c4', expect: ['pawnStructure', 'space'], note: 'relâche la pression sur d4' },
  { id: 'h-a4', seq: 'e4 e5 Nf3 Nc6 Bc4 Bc5', move: 'a4', expect: ['development'], note: 'coup de pion lent' },
  { id: 'h-nh4it', seq: 'e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6 d3 O-O', move: 'Nh4', expect: ['activity'], note: 'cavalier au bord' },
  { id: 'h-qe2', seq: 'e4 e5 Nf3 Nc6', move: 'Qe2', expect: ['development'], note: 'dame tôt, bloque le fou f1' },
  { id: 'h-h5it', seq: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5 O-O d6 c3 O-O Re1 a6 Bb3 Ba7 h3', move: 'h5', expect: ['kingSafety'], note: 'h5 devant son roque' },
];
