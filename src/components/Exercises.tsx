import { useEffect, useRef, useState } from 'preact/hooks';
import { Board } from './Board';
import { pieceDests } from '../lib/stars';
import { Chess, legalDests, turnColor, checkSquare, isPromotion, tryMove, gameOverText } from '../lib/chess';
import { engine, whiteScore } from '../lib/engine';
import { play, playForMove, haptic } from '../lib/sound';

const ROLE: Record<string, string> = { Q: 'Q', R: 'R', B: 'B', N: 'N', K: 'K' };
/** Ramasser les étoiles avec une pièce seule. */
export function StarsExercise({ piece, from, stars, blockers = [], par, onDone, resetSignal }: { piece: string; from: string; stars: string[]; blockers?: string[]; par?: number; onDone: (clean: boolean) => void; resetSignal?: number }) {
  const [pos, setPos] = useState(from); const [left, setLeft] = useState(stars); const [moves, setMoves] = useState(0); const [done, setDone] = useState(false);
  useEffect(() => { setPos(from); setLeft(stars); setMoves(0); setDone(false); }, [from, stars.join(), resetSignal]);
  const fen = boardFen({ [pos]: ROLE[piece], ...Object.fromEntries(blockers.map((b) => [b, 'p'])) });
  const hl = new Map<string, string>(); left.forEach((s) => hl.set(s, 'star'));
  const dests = new Map([[pos, pieceDests(piece, pos, new Set(blockers))]]);
  return (
    <div class="trainer">
      <Board fen={fen + ' w - - 0 1'} turn="white" movable={done ? 'none' : 'white'} dests={dests} highlight={hl} coordinates
        onMove={(f, t) => { setPos(t); const nl = left.filter((s) => s !== t); setMoves((m) => m + 1); if (nl.length < left.length) play('success'); else play('move');
          setLeft(nl); if (!nl.length) { setDone(true); onDone(!par || moves + 1 <= par); } return true; }} />
      <div class={'feedback ' + (done ? 'solved' : 'play')}>{done ? `🎉 Toutes les étoiles en ${moves} coup${moves > 1 ? 's' : ''}${par && moves > par ? ` (record : ${par})` : ' — parfait !'}` : `⭐ Étoiles restantes : ${left.length} · coups : ${moves}${par ? ` / objectif ${par}` : ''}`}</div>
    </div>
  );
}
function boardFen(pieces: Record<string, string>) {
  let out = '';
  for (let r = 8; r >= 1; r--) { let e = 0; for (const f of 'abcdefgh') { const p = pieces[f + r]; if (p) { if (e) out += e; e = 0; out += p; } else e++; } if (e) out += e; if (r > 1) out += '/'; }
  return out;
}
/** Toucher les bonnes cases. */
export function SelectExercise({ fen, squares, onDone, onMistake, orientation }: { fen: string; squares: string[]; onDone: (clean: boolean) => void; onMistake: () => void; orientation?: 'white' | 'black' }) {
  const [sel, setSel] = useState<string[]>([]); const [wrong, setWrong] = useState<string | null>(null); const [done, setDone] = useState(false); const errs = useRef(0);
  useEffect(() => { setSel([]); setDone(false); errs.current = 0; }, [fen, squares.join()]);
  const hl = new Map<string, string>(); sel.forEach((s) => hl.set(s, 'picked')); if (wrong) hl.set(wrong, 'wrong'); if (done) squares.forEach((s) => hl.set(s, 'picked'));
  return (
    <div class="trainer">
      <Board fen={fen} viewOnly={false} movable="none" highlight={hl} orientation={orientation} coordinates
        onSquare={(sq) => {
          if (done) return;
          if (squares.includes(sq)) { if (sel.includes(sq)) return; const n = [...sel, sq]; setSel(n); play('tick'); if (n.length === squares.length) { setDone(true); play('success'); onDone(errs.current === 0); } }
          else { errs.current++; setWrong(sq); play('error'); haptic(30); onMistake(); setTimeout(() => setWrong(null), 500); }
        }} />
      <div class={'feedback ' + (done ? 'solved' : 'play')}>{done ? '🎉 Parfait !' : `👆 Touche les cases (${sel.length}/${squares.length})`}</div>
    </div>
  );
}
export function Quiz({ options, answer, onDone, onMistake, success }: { options: string[]; answer: number; onDone: (clean: boolean) => void; onMistake: () => void; success?: string }) {
  const [picked, setPicked] = useState<number[]>([]); const [done, setDone] = useState(false);
  useEffect(() => { setPicked([]); setDone(false); }, [options.join()]);
  return (
    <div class="quiz">
      {options.map((o, i) => (
        <button class={'quiz-opt ' + (picked.includes(i) ? (i === answer ? 'right' : 'wrong') : '')} disabled={done || picked.includes(i)}
          onClick={() => { const np = [...picked, i]; setPicked(np); if (i === answer) { setDone(true); play('success'); onDone(np.length === 1); } else { play('error'); onMistake(); } }}>
          <span class="quiz-letter">{'ABCD'[i]}</span>{o}
        </button>
      ))}
      {done && success && <p class="quiz-success">✅ {success}</p>}
    </div>
  );
}
/** Jouer une position contre le moteur jusqu'à l'objectif (mat, promotion, nulle). */
export function PlayGoal({ fen, result, maxMoves, onDone, onFail, orientation, resetSignal }: { fen: string; result: 'mate' | 'promote' | 'draw'; maxMoves: number; onDone: (clean: boolean) => void; onFail?: (why: string) => void; orientation?: 'white' | 'black'; resetSignal?: number }) {
  const [ch, setCh] = useState(() => new Chess(fen)); const [last, setLast] = useState<[string, string] | null>(null);
  const [n, setN] = useState(0); const [state, setStateS] = useState<'play' | 'think' | 'won' | 'lost'>('play'); const [msg, setMsg] = useState('');
  const user = useRef(new Chess(fen).turn()); const alive = useRef(true);
  useEffect(() => { alive.current = true; engine.stopAll(); const c = new Chess(fen); user.current = c.turn(); setCh(c); setLast(null); setN(0); setStateS('play'); setMsg(''); engine.newGame(); return () => { alive.current = false; engine.stopAll(); }; }, [fen, resetSignal]);
  const fail = (why: string) => { setStateS('lost'); setMsg(why); play('lose'); onFail?.(why); };
  async function onMove(from: string, to: string, promotion?: string) {
    if (state !== 'play') return false;
    const c = new Chess(ch.fen()); const m = tryMove(c, { from, to, promotion: promotion || (isPromotion(ch, from, to) ? 'q' : undefined) }); if (!m) return false;
    playForMove(m); setCh(c); setLast([m.from, m.to]); const moves = n + 1; setN(moves);
    if (result === 'mate' && c.isCheckmate()) { setStateS('won'); setMsg(`Mat en ${moves} coups !`); play('win'); onDone(moves <= maxMoves * 0.7); return true; }
    if (result === 'promote' && m.promotion) { setStateS('won'); setMsg('Promotion réussie !'); play('win'); onDone(true); return true; }
    if (c.isGameOver()) { if (result === 'draw' && !c.isCheckmate()) { setStateS('won'); setMsg('Nulle obtenue !'); play('win'); onDone(true); } else fail(gameOverText(c) || 'Partie terminée'); return true; }
    if (result !== 'draw' && moves >= maxMoves) { fail(`Limite de ${maxMoves} coups atteinte.`); return true; }
    setStateS('think');
    const r = await engine.analyse(c.fen(), { depth: 16, movetime: 500 });
    if (!alive.current) return true;
    const sc = whiteScore(r.lines[0], c.fen()) * (user.current === 'w' ? 1 : -1);
    const c2 = new Chess(c.fen()); const em = tryMove(c2, r.best);
    if (!em) return true;
    playForMove(em); setCh(c2); setLast([em.from, em.to]);
    if (c2.isGameOver()) { if (result === 'draw' && !c2.isCheckmate()) { setStateS('won'); setMsg('Nulle obtenue !'); play('win'); onDone(true); } else if (c2.isCheckmate()) fail('Tu as été maté.'); else fail((gameOverText(c2) || 'Nulle') + ' — il fallait gagner !'); return true; }
    if (result === 'draw') {
      if (sc < -400 || em.promotion) { fail('La position est perdue. Recommence et applique la méthode !'); return true; }
      if (moves >= maxMoves) { setStateS('won'); setMsg(`Tu as tenu ${maxMoves} coups : nulle assurée !`); play('win'); onDone(true); return true; }
    } else if (sc < 150 && moves > 2) { fail('L’avantage s’est envolé (nulle probable). Recommence !'); return true; }
    setStateS('play'); return true;
  }
  return (
    <div class="trainer">
      <Board fen={ch.fen()} orientation={orientation || (user.current === 'w' ? 'white' : 'black')} turn={turnColor(ch)} movable={state === 'play' ? (user.current === 'w' ? 'white' : 'black') : 'none'}
        dests={legalDests(ch)} lastMove={last} check={!!checkSquare(ch)} onMove={(f, t, pr) => { onMove(f, t, pr); return true; }} promotionCheck={(f, t) => isPromotion(ch, f, t)} />
      <div class={'feedback ' + (state === 'won' ? 'solved' : state === 'lost' ? 'wrong' : 'play')}>
        {state === 'play' && `À toi · coup ${n + 1}${result !== 'draw' ? ` / ${maxMoves}` : ` · tiens ${maxMoves} coups`}`}
        {state === 'think' && '🤖 Le moteur réfléchit…'}
        {state === 'won' && '🎉 ' + msg}
        {state === 'lost' && '❌ ' + msg}
      </div>
    </div>
  );
}
