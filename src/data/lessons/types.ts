export type Level = 'debutant' | 'intermediaire' | 'avance' | 'expert';
export type Goal =
  | { kind: 'line'; moves: string[]; alts?: Record<number, string[]> } // l'élève joue les indices pairs, l'app répond aux impairs
  | { kind: 'any'; accept: string[] } // un seul coup parmi ceux acceptés
  | { kind: 'mate' } // n'importe quel mat en 1
  | { kind: 'check' } // n'importe quel échec
  | { kind: 'stars'; piece: 'Q' | 'R' | 'B' | 'N' | 'K'; from: string; stars: string[]; blockers?: string[]; par?: number }
  | { kind: 'select'; squares: string[] }
  | { kind: 'quiz'; options: string[]; answer: number; verify?: 'win' | 'draw' | 'loss' }
  | { kind: 'play'; result: 'mate' | 'promote' | 'draw'; maxMoves: number; script?: Record<string, string> };
export type Step =
  | { type: 'text'; title: string; body: string; fen?: string; pre?: string[]; shapes?: string[]; orientation?: 'white' | 'black' }
  | { type: 'demo'; title: string; body: string; fen?: string; pre?: string[]; moves: string[]; comments?: Record<number, string>; orientation?: 'white' | 'black' }
  | { type: 'exercise'; title: string; prompt: string; fen?: string; pre?: string[]; goal: Goal; hints?: string[]; success?: string; shapes?: string[]; orientation?: 'white' | 'black' }
  | { type: 'puzzles'; title: string; body: string; themes: string[]; count: number; maxRating: number; minRating?: number };
export interface Lesson { id: string; level: Level; title: string; icon: string; minutes: number; summary: string; steps: Step[]; course?: string }
export const LEVELS: { id: Level; name: string; desc: string; color: string; icon: string; elo: string }[] = [
  { id: 'debutant', name: 'Débutant', desc: 'Les règles du jeu, de zéro jusqu’à ta première partie.', color: '#2bc48a', icon: '🌱', elo: '0 → 800' },
  { id: 'intermediaire', name: 'Intermédiaire', desc: 'Ouvertures, tactiques et mats de base.', color: '#4dabf7', icon: '⚔️', elo: '800 → 1400' },
  { id: 'avance', name: 'Avancé', desc: 'Stratégie, finales clés et répertoire d’ouvertures.', color: '#9775fa', icon: '🏰', elo: '1400 → 1900' },
  { id: 'expert', name: 'Expert', desc: 'Calcul, prophylaxie, finales complexes et grandes parties.', color: '#ffa94d', icon: '👑', elo: '1900+' },
];
