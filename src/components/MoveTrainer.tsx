// Moteur d'exercice « trouver le coup » : puzzles, lignes de leçon, ouvertures.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Board, toShapes } from './Board';
import { Chess, legalDests, turnColor, checkSquare, isPromotion, tryMove, moveToUci, type Move } from '../lib/chess';
import { play, playForMove } from '../lib/sound';
import { Icon } from './Icon';

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
}
export function MoveTrainer(p: TrainerProps) {
  const [ch, setCh] = useState(() => new Chess(p.fen));
  const [idx, setIdx] = useState(0);
  const [last, setLast] = useState<[string, string] | null>(null);
  const [status, setStatus] = useState<'wait' | 'play' | 'wrong' | 'good' | 'solved'>('wait');
  const [mistakes, setMistakes] = useState(0);
  const mistakesRef = useRef(0); mistakesRef.current = mistakes;
  const [flash, setFlash] = useState<{ sq: string; cls: string } | null>(null);
  const timers = useRef<any[]>([]);
  const userColor = useMemo(() => { const c = new Chess(p.fen); return p.setup ? (c.turn() === 'w' ? 'black' : 'white') : turnColor(c); }, [p.fen, p.setup]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  function reset() {
    timers.current.forEach(clearTimeout); timers.current = [];
    const c = new Chess(p.fen); setCh(c); setIdx(0); setLast(null); setMistakes(0); setFlash(null);
    if (p.setup) { setStatus('wait'); later(() => autoMove(c, 0), 600); } else setStatus('play');
  }
  useEffect(() => { reset(); return () => timers.current.forEach(clearTimeout); }, [p.fen, p.line.join(' '), p.resetSignal]);

  function autoMove(c: Chess, i: number) {
    const u = p.line[i]; if (!u) return;
    const n = new Chess(c.fen()); const m = tryMove(n, u); if (!m) return;
    playForMove(m); setCh(n); setLast([m.from, m.to]); setIdx(i + 1); p.onProgress?.(i + 1);
    if (i + 1 >= p.line.length) { setStatus('solved'); later(() => play('success'), 150); p.onSolved?.(mistakesRef.current === 0); } else setStatus('play');
  }
  function onMove(from: string, to: string, promotion?: string): boolean {
    if (status !== 'play' && status !== 'wrong') return false;
    const n = new Chess(ch.fen()); const m = tryMove(n, { from, to, promotion: promotion || (isPromotion(ch, from, to) ? 'q' : undefined) });
    if (!m) return false;
    const expected = p.line[idx];
    const ok = moveToUci(m) === expected || (expected && moveToUci(m) === expected.slice(0, 4) && !expected[4]) || (p.accept?.(idx, m, n) ?? false) || (n.isCheckmate() && isMateLine(p.line, idx));
    if (!ok) {
      play('error'); setMistakes((x) => x + 1); p.onMistake?.(idx); p.onWrong?.(idx, moveToUci(m), ch.fen());
      setFlash({ sq: to, cls: 'wrong' }); setStatus('wrong');
      setCh(new Chess(ch.fen()));
      later(() => setFlash(null), 600);
      return false;
    }
    playForMove(m); setCh(n); setLast([m.from, m.to]); setFlash({ sq: to, cls: 'right' });
    const ni = idx + 1; setIdx(ni); p.onProgress?.(ni);
    if (ni >= p.line.length || n.isGameOver()) {
      setStatus('solved'); later(() => play('success'), 150); p.onSolved?.(mistakes === 0);
    } else { setStatus('good'); later(() => { setFlash(null); autoMove(n, ni); }, 450); }
    return true;
  }
  // Solution animée
  useEffect(() => {
    if (!p.showSolutionSignal) return;
    timers.current.forEach(clearTimeout); timers.current = [];
    let c = new Chess(ch.fen()); let i = idx; setStatus('wait');
    const step = () => {
      if (i >= p.line.length) { setStatus('solved'); return; }
      const m = tryMove(c, p.line[i]); if (!m) return; playForMove(m);
      setCh(new Chess(c.fen())); setLast([m.from, m.to]); i++; setIdx(i);
      later(step, 700);
    };
    later(step, 200);
  }, [p.showSolutionSignal]);

  const shapes = useMemo(() => {
    const exp = p.line[idx]; const out = toShapes(p.extraShapes || []);
    if (exp && status !== 'solved' && (p.hintLevel || 0) >= 1) out.push({ orig: exp.slice(0, 2) as any, brush: 'yellow' });
    if (exp && status !== 'solved' && (p.hintLevel || 0) >= 2) out.push({ orig: exp.slice(0, 2) as any, dest: exp.slice(2, 4) as any, brush: 'yellow' });
    return out;
  }, [idx, p.hintLevel, status, p.extraShapes?.join()]);
  const hl = new Map<string, string>(); if (flash) hl.set(flash.sq, flash.cls);
  return (
    <div class="trainer">
      <Board fen={ch.fen()} orientation={p.orientation || userColor} turn={turnColor(ch)} movable={status === 'play' || status === 'wrong' ? userColor : 'none'}
        dests={legalDests(ch)} lastMove={last} check={!!checkSquare(ch)} onMove={onMove} shapes={shapes} highlight={hl}
        promotionCheck={(f, t) => isPromotion(ch, f, t)} />
      {p.feedback !== false && (
        <div class={'feedback ' + status} aria-live="polite">
          {status === 'wait' && <span><span class="thinking" aria-hidden="true" />L’adversaire joue</span>}
          {status === 'play' && <span><span class={'turn-dot ' + (userColor === 'white' ? 'w' : 'b')} />{userColor === 'white' ? 'Les Blancs jouent. À toi.' : 'Les Noirs jouent. À toi.'}</span>}
          {status === 'wrong' && <span><Icon name="xCircle" size={20} />Pas tout à fait. Réessaie.</span>}
          {status === 'good' && <span><Icon name="checkCircle" size={20} />Bien vu. Continue.</span>}
          {status === 'solved' && <span><Icon name="sparkles" size={20} />Bravo, c’est résolu.</span>}
        </div>
      )}
    </div>
  );
}
function isMateLine(line: string[], idx: number) { return idx === line.length - 1; }
