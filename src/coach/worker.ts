// Worker du coach : calcul pur (classement, motifs, explications) hors du fil principal.
import { buildReview, type GameInput } from './pipeline';
import { isBookFen } from '../data/openings';

self.onmessage = (e: MessageEvent) => {
  const { id, type, input } = e.data as { id: number; type: 'review'; input: Omit<GameInput, 'book'> };
  try {
    if (type === 'review') { const r = buildReview({ ...input, book: (f) => isBookFen(f) }); (self as any).postMessage({ id, ok: true, r }); }
  } catch (err) { (self as any).postMessage({ id, ok: false, error: String((err as Error)?.stack || err) }); }
};
