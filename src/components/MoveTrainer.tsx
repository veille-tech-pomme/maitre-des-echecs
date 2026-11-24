// Moteur d'exercice « trouver le coup » : leçons, cours, puzzles, ouvertures, fil, finales à coups.
// Pilier 1 (cahier GOAT) : toute réponse fausse reçoit un diagnostic propre au coup (coach/diagnose.ts, chargé à la
// demande) dans une feuille sous l'échiquier — titre, pourquoi, pièce en danger et coup qui punit — avec
// « Montre-moi » (la réfutation au ralenti, une phrase par demi-coup, puis retour exact à la position), « Indice »
// (3 niveaux : où regarder, quelle pièce, quel coup) et « Réessayer ».
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Board, toShapes } from './Board';
import { Chess, legalDests, turnColor, checkSquare, isPromotion, tryMove, moveToUci, type Move } from '../lib/chess';
import { play, playForMove } from '../lib/sound';
import { Icon } from './Icon';
import type { Diagnosis, GoalKind, Hint } from '../coach/diagnose';

type DiagMod = typeof import('../coach/diagnose');
let diagMod: Promise<DiagMod> | null = null;
/** module du diagnostic (+ alternatives précalculées), préchargé dès qu'un exercice s'affiche */
export const loadDiagnose = () => (diagMod ||= import('../coach/diagnose'));
const engineMod = () => import('../lib/engine');
/** budget du moteur pour un diagnostic (mono-thread mobile) */
const NODES = 120_000;

export interface TrainerProps {
  fen: string;
  line: string[]; // coups UCI ; si setup=true, line[0] est joué automatiquement par l'adversaire
  setup?: boolean;
  /** accepte un coup alternatif à l'indice idx (ex. autre mat) */
  accept?: (idx: number, played: Move, after: Chess) => boolean;
  orientation?: 'white' | 'black';
  onSolved?: (clean: boolean) => void;
  onMistake?: (idx: number) => void;
  /** coup refusé : indice, coup UCI joué et position avant le coup */
  onWrong?: (idx: number, uci: string, fenBefore: string) => void;
  /** diagnostic final d'un coup refusé (modèle de l'élève, pilier 2) */
  onDiagnosis?: (d: Diagnosis, ctx: { idx: number; uci: string; fenBefore: string; solution: string[]; hintLevel: number }) => void;
  onProgress?: (idx: number) => void;
  /** niveau d'indice imposé par la page (0 à 3) */
  hintLevel?: number;
  /** indices écrits à la main (prioritaires sur les générés, jamais s'ils dévoilent le coup) */
  authoredHints?: string[];
  /** bouton « Indice » intégré (pages sans leur propre bouton) */
  ownHints?: boolean;
  /** niveau d'indice atteint (pour la page : planifier une révision si 3) */
  onHint?: (level: number) => void;
  showSolutionSignal?: number;
  feedback?: boolean;
  extraShapes?: string[];
  resetSignal?: number;
  /** type d'objectif (formulation du diagnostic) */
  goal?: GoalKind;
  /** leçons : un coup aussi bon (même mat ou plus rapide, ≤ 30 cp) est accepté et la ligne continue */
  allowEquivalent?: boolean;
  /** exercice de méthode : un coup équivalent est expliqué mais refusé (audit C3) */
  method?: string;
  /** Débutant : un coup illégal est expliqué (on peut poser la pièce n'importe où) */
  explainIllegal?: boolean;
}
type Status = 'wait' | 'play' | 'wrong' | 'good' | 'solved' | 'checking' | 'showing';
export function MoveTrainer(p: TrainerProps) {
  const [ch, setCh] = useState(() => new Chess(p.fen));
  const [idx, setIdx] = useState(0);
  const [last, setLast] = useState<[string, string] | null>(null);
  const [status, setStatus] = useState<Status>('wait');
  const [line, setLine] = useState<string[]>(p.line); const lineR = useRef(p.line); const setL = (l: string[]) => { lineR.current = l; setLine(l); };
  const [note, setNote] = useState('');
  const [diag, setDiag] = useState<(Diagnosis & { fenBefore: string; played: string }) | null>(null);
  const [narr, setNarr] = useState('');
  const [ownHint, setOwnHint] = useState(0);
  const [hints, setHints] = useState<Hint[]>([]);
  const judging = useRef(0);
  const [mistakes, setMistakes] = useState(0);
  const mistakesRef = useRef(0); mistakesRef.current = mistakes;
  const [flash, setFlash] = useState<{ sq: string; cls: string } | null>(null);
  const timers = useRef<any[]>([]); const shown = useRef(false);
  const userColor = useMemo(() => { const c = new Chess(p.fen); return p.setup ? (c.turn() === 'w' ? 'black' : 'white') : turnColor(c); }, [p.fen, p.setup]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  const hl = Math.min(3, Math.max(p.hintLevel || 0, ownHint));
  useEffect(() => { loadDiagnose(); }, []);

  function reset() {
    timers.current.forEach(clearTimeout); timers.current = [];
    shown.current = false; const c = new Chess(p.fen); setCh(c); setIdx(0); setLast(null); setMistakes(0); setFlash(null); setL(p.line); setNote(''); setDiag(null); setNarr(''); setOwnHint(0); judging.current++;
    if (p.setup) { setStatus('wait'); later(() => autoMove(c, 0), 600); } else setStatus('play');
  }
  useEffect(() => { reset(); return () => timers.current.forEach(clearTimeout); }, [p.fen, p.line.join(' '), p.resetSignal]);
  // indices de la position courante (coup attendu) : 3 niveaux, les écrits à la main d'abord (premier coup seulement)
  useEffect(() => {
    const exp = line[idx]; if (!exp || hl < 1) { setHints([]); return; }
    let live = true; loadDiagnose().then((d) => { if (live) setHints(d.graduatedHints({ fen: ch.fen(), expected: [exp], authored: idx === 0 ? p.authoredHints : undefined, mateGoal: p.goal === 'mate' })); });
    return () => { live = false; };
  }, [hl, idx, line.join(' '), ch.fen()]);
  useEffect(() => { if (hl > 0) p.onHint?.(hl); }, [hl]);

  function autoMove(c: Chess, i: number) {
    const L = lineR.current; const u = L[i]; if (!u) return;
    const n = new Chess(c.fen()); const m = tryMove(n, u); if (!m) return;
    playForMove(m); setCh(n); setLast([m.from, m.to]); setIdx(i + 1); p.onProgress?.(i + 1);
    if (i + 1 >= L.length) { setStatus('solved'); later(() => play('success'), 150); p.onSolved?.(mistakesRef.current === 0); } else setStatus('play');
  }
  function accepted(n: Chess, m: Move, uci: string, noteText: string, continuation: string[]) {
    const L = lineR.current; setNote(noteText); setFlash({ sq: m.to, cls: 'right' }); setDiag(null);
    const nl = [...L.slice(0, idx), uci, ...continuation]; setL(nl); const ni = idx + 1; setIdx(ni); p.onProgress?.(ni);
    if (ni >= nl.length || n.isGameOver()) { setStatus('solved'); later(() => play('success'), 150); p.onSolved?.(mistakesRef.current === 0); }
    else { setStatus('good'); later(() => { setFlash(null); autoMove(n, ni); }, 700); }
  }
  function rejected(before: string, uci: string, d: Diagnosis, token: number) {
    if (token !== judging.current) return;
    setDiag({ ...d, fenBefore: before, played: uci });
    if (d.source !== 'symbolic') p.onDiagnosis?.(d, { idx, uci, fenBefore: before, solution: lineR.current.slice(idx), hintLevel: hl });
  }
  /** diagnostic complet (moteur, budget en nœuds) ; met à jour la feuille quand il arrive */
  async function deep(before: string, uci: string, token: number, keepOnBoard: { n: Chess; m: Move } | null) {
    const [dm, em] = await Promise.all([loadDiagnose(), engineMod()]);
    const L = lineR.current; const ctx = { fen: before, played: uci, expected: L.slice(idx), goal: p.goal || 'puzzle', allowEquivalent: !!p.allowEquivalent && !p.method, engine: em.engine as any, nodes: NODES };
    let d: Diagnosis; try { d = await dm.diagnose(ctx); } catch { d = dm.diagnoseFast(ctx); }
    if (token !== judging.current) return;
    if (d.accept && keepOnBoard) { accepted(keepOnBoard.n, keepOnBoard.m, uci, d.note || 'Bien vu.', d.continuation || []); return; }
    // le moteur rapide le trouve aussi bon, mais la position est précalculée (1,5 M nœuds, 5 meilleurs coups) et il n'y
    // figure pas : on le dit honnêtement, sans « Réessaie » ni faux reproche
    if (d.accept) d = { ...d, accept: false, kind: 'positional', headline: 'Ce coup tient aussi, mais ce n’est pas l’idée ici', why: 'Selon le moteur, ton coup ne perd rien. L’exercice travaille une autre idée : relis la consigne, ou prends un indice.', refutation: [], arrows: [], marks: [], source: 'engine' };
    if (keepOnBoard) { fail(before, uci, keepOnBoard.m.to); }
    rejected(before, uci, d, token);
  }
  function fail(before: string, uci: string, to: string) {
    play('error'); setMistakes((x) => x + 1); p.onMistake?.(idx); p.onWrong?.(idx, uci, before);
    setCh(new Chess(before)); setLast(null); setFlash({ sq: to, cls: 'wrong' }); setStatus('wrong'); later(() => setFlash(null), 700);
  }
  function onMove(from: string, to: string, promotion?: string): boolean {
    if (status !== 'play' && status !== 'wrong') return false;
    const n = new Chess(ch.fen()); const m = tryMove(n, { from, to, promotion: promotion || (isPromotion(ch, from, to) ? 'q' : undefined) });
    if (!m) {
      // Débutant : la règle expliquée (roi en échec, pièce clouée, déplacement impossible), sans moteur
      if (p.explainIllegal) loadDiagnose().then((d) => { const x = d.explainIllegal(ch.fen(), from, to); if (x) { play('error'); setDiag({ ...x, fenBefore: ch.fen(), played: from + to }); setStatus('wrong'); } });
      return false;
    }
    const L = lineR.current; const expected = L[idx]; const before = ch.fen(); const uci = moveToUci(m);
    // un mat est toujours accepté, à n'importe quel moment de la ligne
    const ok = uci === expected || (expected && uci === expected.slice(0, 4) && !expected[4]) || (p.accept?.(idx, m, n) ?? false) || n.isCheckmate();
    if (!ok && expected) {
      const token = ++judging.current; setDiag(null); setNote(''); setNarr('');
      const go = (dm: DiagMod) => {
        if (token !== judging.current) return;
        const ctx = { fen: before, played: uci, expected: L.slice(idx), goal: p.goal || 'puzzle', allowEquivalent: !!p.allowEquivalent && !p.method };
        const fast = dm.diagnoseFast(ctx);
        if (fast.accept) {
          if (p.method) { fail(before, uci, m.to); rejected(before, uci, { ...fast, accept: false, kind: 'positional', headline: 'Pas la méthode', why: `Ce coup ne perd pas tout de suite, mais ${p.method}`, source: 'rules' }, token); return; }
          playForMove(m); setCh(n); setLast([m.from, m.to]); accepted(n, m, uci, fast.note || 'Bien vu.', fast.continuation || []); return;
        }
        // position non précalculée et coup peut-être aussi bon : on vérifie avant de refuser (la pièce reste posée)
        if (p.allowEquivalent && !p.method && !dm.precomputed(before)) { playForMove(m); setCh(n); setLast([m.from, m.to]); setStatus('checking'); deep(before, uci, token, { n, m }); return; }
        fail(before, uci, m.to); rejected(before, uci, fast, token);
        deep(before, uci, token, null);
      };
      if (diagMod) diagMod.then(go); else { setStatus('checking'); loadDiagnose().then(go); }
      return false;
    }
    if (!ok) { fail(before, uci, to); return false; }
    playForMove(m); setCh(n); setLast([m.from, m.to]); setFlash({ sq: to, cls: 'right' }); setDiag(null);
    const ni = idx + 1; setIdx(ni); p.onProgress?.(ni); setOwnHint(0);
    if (n.isCheckmate() && uci !== expected && !shown.current) setNote('Mat ! Ce n’est pas la solution prévue, mais un mat est un mat.');
    if (ni >= L.length || n.isGameOver()) {
      setStatus('solved'); later(() => play('success'), 150); p.onSolved?.(mistakes === 0);
    } else { setStatus('good'); later(() => { setFlash(null); autoMove(n, ni); }, 450); }
    return true;
  }
  /** « Montre-moi » : la réfutation au ralenti avec une phrase par demi-coup, puis retour exact à la position */
  function showMe() {
    if (!diag) return; const seq = [diag.played, ...diag.refutation]; const start = diag.fenBefore;
    const token = ++judging.current; setStatus('showing'); let c = new Chess(start); let i = 0;
    const step = () => {
      if (token !== judging.current) return;
      if (i >= seq.length) { later(() => { if (token !== judging.current) return; setCh(new Chess(start)); setLast(null); setNarr(''); setStatus('wrong'); }, 1300); return; }
      const m = tryMove(c, seq[i]); if (!m) { i = seq.length; step(); return; }
      playForMove(m); setCh(new Chess(c.fen())); setLast([m.from, m.to]); setNarr(diag.narration[i] || ''); i++;
      later(step, 1400);
    };
    step();
  }
  // Solution animée
  useEffect(() => {
    if (!p.showSolutionSignal) return;
    timers.current.forEach(clearTimeout); timers.current = []; shown.current = true; judging.current++; setDiag(null); setNote('');
    let c = new Chess(ch.fen()); let i = idx; setStatus('wait');
    const step = () => {
      if (i >= lineR.current.length) { setStatus('solved'); return; }
      const m = tryMove(c, lineR.current[i]); if (!m) return; playForMove(m);
      setCh(new Chess(c.fen())); setLast([m.from, m.to]); i++; setIdx(i);
      later(step, 700);
    };
    later(step, 200);
  }, [p.showSolutionSignal]);

  const curHint = hl > 0 && status !== 'solved' ? hints[hl - 1] : undefined;
  const shapes = useMemo(() => {
    const out = toShapes(p.extraShapes || []);
    if (curHint) for (const a of curHint.arrows) out.push({ orig: a.orig as any, dest: a.dest as any, brush: 'green' });
    if (diag && status === 'wrong') for (const a of diag.arrows) out.push({ orig: a.orig as any, dest: a.dest as any, brush: a.brush === 'green' ? 'green' : 'red' });
    return out;
  }, [p.extraShapes?.join(), curHint, diag, status]);
  const hlm = new Map<string, string>();
  if (curHint) for (const mk of curHint.marks) hlm.set(mk.sq, 'hint');
  if (diag && status === 'wrong') for (const mk of diag.marks) hlm.set(mk.sq, mk.kind === 'danger' ? 'danger' : 'hint');
  if (flash) hlm.set(flash.sq, flash.cls);
  const canHint = status === 'play' || status === 'wrong';
  return (
    <div class="trainer">
      <Board fen={ch.fen()} orientation={p.orientation || userColor} turn={turnColor(ch)} movable={status === 'play' || status === 'wrong' ? userColor : 'none'}
        dests={legalDests(ch)} free={!!p.explainIllegal} lastMove={last} check={!!checkSquare(ch)} onMove={onMove} shapes={shapes} highlight={hlm}
        promotionCheck={(f, t) => isPromotion(ch, f, t)} />
      {curHint && <div class="hint-box coach-hint" data-level={curHint.level}><Icon name="bulb" size={18} /><div><p class="hint-lv">Indice {curHint.level} / 3</p><p>{curHint.text}</p></div></div>}
      {p.feedback !== false && (
        <div class={'feedback ' + (diag && (status === 'wrong' || status === 'showing') ? 'wrong has-sheet' : status)} aria-live="polite">
          {status === 'wait' && <span><span class="thinking" aria-hidden="true" />L’adversaire joue</span>}
          {status === 'play' && !diag && <span><span class={'turn-dot ' + (userColor === 'white' ? 'w' : 'b')} />{userColor === 'white' ? 'Les Blancs jouent. À toi.' : 'Les Noirs jouent. À toi.'}{p.ownHints && <button class="btn small plain fb-hint" onClick={() => setOwnHint((h) => Math.min(3, h + 1))}><Icon name="bulb" size={16} />Indice</button>}</span>}
          {status === 'checking' && <span><span class="thinking" aria-hidden="true" />Le coach vérifie ton coup…</span>}
          {diag && (status === 'wrong' || status === 'showing' || status === 'play') && (
            <div class="mistake-sheet" data-kind={diag.kind || ''} data-source={diag.source}>
              <b class="ms-head"><Icon name="xCircle" size={18} /><span>{diag.headline}</span></b>
              {status === 'showing' ? <p class="ms-narr">{narr}</p> : diag.why && <p>{diag.why}</p>}
              {status !== 'showing' && (
                <div class="ms-actions">
                  {diag.refutation.length > 0 && <button class="btn small secondary ms-show" onClick={showMe}><Icon name="eye" size={16} />Montre-moi</button>}
                  {canHint && hl < 3 && <button class="btn small secondary ms-hint" onClick={() => setOwnHint(Math.min(3, hl + 1))}><Icon name="bulb" size={16} />Indice</button>}
                  <button class="btn small primary ms-retry" onClick={() => { setDiag(null); setStatus('play'); }}>Réessayer</button>
                </div>
              )}
            </div>
          )}
          {status === 'wrong' && !diag && <span><span class="thinking" aria-hidden="true" />Le coach regarde ton coup…</span>}
          {status === 'good' && <span><Icon name="checkCircle" size={20} />{note || 'Bien vu. Continue.'}</span>}
          {status === 'solved' && (shown.current ? <span><Icon name="eye" size={20} />Voici la solution.</span> : <span><Icon name="sparkles" size={20} />{note || 'Bravo, c’est résolu.'}</span>)}
        </div>
      )}
    </div>
  );
}
