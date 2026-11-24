// Temps de réflexion d'un coup (brief P0 §3), fonction pure et testable.
// thinkMs = tMove − tReady − (temps onglet caché) − (temps d'analyse du coach / pause « gaffe ») sur [tReady, tMove].
// Les intervalles qui se chevauchent ne sont retirés qu'une fois.
export type Span = [number, number];
export function computeThinkMs(tReady: number, tMove: number, hiddenSpans: Span[] = [], coachSpans: Span[] = []): number {
  if (!(tMove > tReady)) return 0;
  const cl = [...hiddenSpans, ...coachSpans]
    .map(([a, b]) => [Math.max(a, tReady), Math.min(b, tMove)] as Span).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let removed = 0, curA = -Infinity, curB = -Infinity;
  for (const [a, b] of cl) { if (a > curB) { if (curB > curA) removed += curB - curA; curA = a; curB = b; } else curB = Math.max(curB, b); }
  if (curB > curA) removed += curB - curA;
  return Math.max(0, Math.round(tMove - tReady - removed));
}
