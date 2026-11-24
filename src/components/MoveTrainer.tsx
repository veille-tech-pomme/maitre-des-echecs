// Moteur d'exercice « trouver le coup » : puzzles, lignes de leçon, ouvertures.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Board, toShapes } from './Board';
import { Chess, legalDests, turnColor, checkSquare, isPromotion, tryMove, moveToUci, type Move } from '../lib/chess';
import { play, playForMove } from '../lib/sound';
import { Icon } from './Icon';
import type { LessonJudge } from '../coach/client';

export interface TrainerProps {
  fen: string;
  line: string[]; // coups UCI ; si setup=true, line[0] est joué automatiquement par l'adversaire
  setup?: boolean;
  /** accepte un coup alternatif à l'indice idx (ex. autre mat) */
  accept?: (idx: number, played: Move, after: Chess) => boolean;
  orientation?: 'white' | 'black';
  onSolved?: (clean: boolean) => void;
  onMistake?: (idx: number) => void;
  /** coup refusé : indice, coup UCI joué et position avant le coup (explication du coach) */
  onWrong?: (idx: number, uci: string, fenBefore: string) => void;
  onProgress?: (idx: number) => void;
  /** comportement après erreur : 'retry' (on rejoue) */
  hintLevel?: number;
  showSolutionSignal?: number;
  feedback?: boolean;
  extraShapes?: string[];
  resetSignal?: number;
  /** leçons : juge un coup différent de la solution (alternative équivalente acceptée, sinon explication + réfutation) */
  judge?: (fenBefore: string, uci: string, rest: string[]) => Promise<LessonJudge>;
}
export function MoveTrainer(p: TrainerProps) {
  const [ch, setCh] = useState(() => new Chess(p.fen));
  const [idx, setIdx] = useState(0);
  const [last, setLast] = useState<[string, string] | null>(null);
  const [status, setStatus] = useState<'wait' | 'play' | 'wrong' | 'good' | 'solved' | 'checking'>('wait');
  const [line, setLine] = useState<string[]>(p.line); const lineR = useRef(p.line); const setL = (l: string[]) => { lineR.current = l; setLine(l); };
  const [note, setNote] = useState(''); const [why, setWhy] = useState<{ headline: string; why: string; tip?: string } | null>(null);
  const judging = useRef(0);
  const [mistakes, setMistakes] = useState(0);
  const mistakesRef = useRef(0); mistakesRef.current = mistakes;
  const [flash, setFlash] = useState<{ sq: string; cls: string } | null>(null);
  const timers = useRef<any[]>([]); const shown = useRef(false);
  const userColor = useMemo(() => { const c = new Chess(p.fen); return p.setup ? (c.turn() === 'w' ? 'black' : 'white') : turnColor(c); }, [p.fen, p.setup]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  function reset() {
    timers.current.forEach(clearTimeout); timers.current = [];
    shown.current = false; const c = new Chess(p.fen); setCh(c); setIdx(0); setLast(null); setMistakes(0); setFlash(null); setL(p.line); setNote(''); setWhy(null); judging.current++;
    if (p.setup) { setStatus('wait'); later(() => autoMove(c, 0), 600); } else setStatus('play');
  }
  useEffect(() => { reset(); return () => timers.current.forEach(clearTimeout); }, [p.fen, p.line.join(' '), p.resetSignal]);

  function autoMove(c: Chess, i: number) {
    const L = lineR.current; const u = L[i]; if (!u) return;
    const n = new Chess(c.fen()); const m = tryMove(n, u); if (!m) return;
    playForMove(m); setCh(n); setLast([m.from, m.to]); setIdx(i + 1); p.onProgress?.(i + 1);
    if (i + 1 >= L.length) { setStatus('solved'); later(() => play('success'), 150); p.onSolved?.(mistakesRef.current === 0); } else setStatus('play');
  }
  function onMove(from: string, to: string, promotion?: string): boolean {
    if (status !== 'play' && status !== 'wrong') return false;
    const n = new Chess(ch.fen()); const m = tryMove(n, { from, to, promotion: promotion || (isPromotion(ch, from, to) ? 'q' : undefined) });
    if (!m) return false;
    const L = lineR.current; const expected = L[idx];
    // un mat est toujours accepté, à n'importe quel moment de la ligne
    const ok = moveToUci(m) === expected || (expected && moveToUci(m) === expected.slice(0, 4) && !expected[4]) || (p.accept?.(idx, m, n) ?? false) || n.isCheckmate();
    if (!ok && p.judge && expected) {
      // le coach vérifie le coup avec le moteur avant de le refuser
      const before = ch.fen(); const uci = moveToUci(m); const token = ++judging.current;
      playForMove(m); setCh(n); setLast([m.from, m.to]); setStatus('checking'); setWhy(null); setNote('');
      p.judge(before, uci, L.slice(idx)).then((v) => {
        if (token !== judging.current) return;
        if (v.accept) {
          setNote(v.note); setFlash({ sq: m.to, cls: 'right' });
          const nl = [...L.slice(0, idx), uci, ...v.continuation]; setL(nl); const ni = idx + 1; setIdx(ni); p.onProgress?.(ni);
          if (ni >= nl.length || n.isGameOver()) { setStatus('solved'); later(() => play('success'), 150); p.onSolved?.(mistakesRef.current === 0); }
          else { setStatus('good'); later(() => { setFlash(null); autoMove(n, ni); }, 700); }
          return;
        }
        play('error'); setMistakes((x) => x + 1); p.onMistake?.(idx); p.onWrong?.(idx, uci, before);
        setWhy({ headline: v.headline, why: v.why, tip: v.tip }); setFlash({ sq: m.to, cls: 'wrong' }); setStatus('wait');
        // la réfutation jouée sur l'échiquier, puis retour à la position
        const r = v.refutation[0]; const c2 = new Chess(n.fen()); const rm = r ? tryMove(c2, r) : null;
        if (rm) later(() => { if (token !== judging.current) return; playForMove(rm); setCh(c2); setLast([rm.from, rm.to]); }, 500);
        later(() => { if (token !== judging.current) return; setCh(new Chess(before)); setLast(null); setFlash(null); setStatus('wrong'); }, rm ? 2300 : 900);
      }).catch(() => { if (token !== judging.current) return; play('error'); setMistakes((x) => x + 1); p.onMistake?.(idx); setCh(new Chess(before)); setLast(null); setStatus('wrong'); });
      return true;
    }
    if (!ok) {
      play('error'); setMistakes((x) => x + 1); p.onMistake?.(idx); p.onWrong?.(idx, moveToUci(m), ch.fen());
      setFlash({ sq: to, cls: 'wrong' }); setStatus('wrong'); setWhy(null);
      setCh(new Chess(ch.fen()));
      later(() => setFlash(null), 600);
      return false;
    }
    playForMove(m); setCh(n); setLast([m.from, m.to]); setFlash({ sq: to, cls: 'right' });
    const ni = idx + 1; setIdx(ni); p.onProgress?.(ni); setWhy(null);
    if (n.isCheckmate() && moveToUci(m) !== expected && !shown.current) setNote('Mat ! Ce n’est pas la solution prévue, mais un mat est un mat.');
    if (ni >= L.length || n.isGameOver()) {
      setStatus('solved'); later(() => play('success'), 150); p.onSolved?.(mistakes === 0);
    } else { setStatus('good'); later(() => { setFlash(null); autoMove(n, ni); }, 450); }
    return true;
  }
  // Solution animée
  useEffect(() => {
    if (!p.showSolutionSignal) return;
    timers.current.forEach(clearTimeout); timers.current = []; shown.current = true; judging.current++; setWhy(null); setNote('');
    let c = new Chess(ch.fen()); let i = idx; setStatus('wait');
    const step = () => {
      if (i >= lineR.current.length) { setStatus('solved'); return; }
      const m = tryMove(c, lineR.current[i]); if (!m) return; playForMove(m);
      setCh(new Chess(c.fen())); setLast([m.from, m.to]); i++; setIdx(i);
      later(step, 700);
    };
    later(step, 200);
  }, [p.showSolutionSignal]);

  const shapes = useMemo(() => {
    const exp = line[idx]; const out = toShapes(p.extraShapes || []);
    if (exp && status !== 'solved' && (p.hintLevel || 0) >= 1) out.push({ orig: exp.slice(0, 2) as any, brush: 'yellow' });
    if (exp && status !== 'solved' && (p.hintLevel || 0) >= 2) out.push({ orig: exp.slice(0, 2) as any, dest: exp.slice(2, 4) as any, brush: 'yellow' });
    return out;
  }, [idx, p.hintLevel, status, p.extraShapes?.join(), line.join()]);
  const hl = new Map<string, string>(); if (flash) hl.set(flash.sq, flash.cls);
  return (
    <div class="trainer">
      <Board fen={ch.fen()} orientation={p.orientation || userColor} turn={turnColor(ch)} movable={status === 'play' || status === 'wrong' ? userColor : 'none'}
        dests={legalDests(ch)} lastMove={last} check={!!checkSquare(ch)} onMove={onMove} shapes={shapes} highlight={hl}
        promotionCheck={(f, t) => isPromotion(ch, f, t)} />
      {p.feedback !== false && (
        <div class={'feedback ' + status} aria-live="polite">
          {status === 'wait' && !why && <span><span class="thinking" aria-hidden="true" />L’adversaire joue</span>}
          {status === 'play' && <span><span class={'turn-dot ' + (userColor === 'white' ? 'w' : 'b')} />{userColor === 'white' ? 'Les Blancs jouent. À toi.' : 'Les Noirs jouent. À toi.'}</span>}
          {status === 'checking' && <span><span class="thinking" aria-hidden="true" />Le coach vérifie ton coup…</span>}
          {(status === 'wrong' || status === 'wait') && why && <div class="fb-why"><b><Icon name="xCircle" size={18} />{why.headline}</b><p>{why.why}</p>{status === 'wrong' && <p class="muted small">{why.tip ? why.tip + ' ' : ''}Réessaie.</p>}</div>}
          {status === 'wrong' && !why && <span><Icon name="xCircle" size={20} />Pas tout à fait. Réessaie.</span>}
          {status === 'good' && <span><Icon name="checkCircle" size={20} />{note || 'Bien vu. Continue.'}</span>}
          {status === 'solved' && (shown.current ? <span><Icon name="eye" size={20} />Voici la solution.</span> : <span><Icon name="sparkles" size={20} />{note || 'Bravo, c’est résolu.'}</span>)}
        </div>
      )}
    </div>
  );
}
