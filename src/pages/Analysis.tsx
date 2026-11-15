import { useEffect, useMemo, useState } from 'preact/hooks';
import { Board } from '../components/Board';
import { EvalBar, Modal, toast } from '../components/ui';
import { Chess, legalDests, turnColor, checkSquare, isPromotion, tryMove, sanFr, START_FEN, uciLineToSan, formatLine, type Move } from '../lib/chess';
import { engine, whiteScore, formatScore, type PvLine } from '../lib/engine';
import { playForMove } from '../lib/sound';
import { bookMoves, openingName } from '../data/openings';
import { parseHash } from '../lib/router';

export function Analysis() {
  const q = parseHash().query;
  const [root, setRoot] = useState(START_FEN);
  const [moves, setMoves] = useState<Move[]>([]);
  const [ply, setPly] = useState(0);
  const [orient, setOrient] = useState<'white' | 'black'>('white');
  const [lines, setLines] = useState<PvLine[]>([]);
  const [engineOn, setEngineOn] = useState(true);
  const [io, setIo] = useState<'pgn' | 'fen' | null>(null);
  const [text, setText] = useState('');
  useEffect(() => {
    try {
      if (q.get('pgn')) loadPgn(q.get('pgn')!);
      else if (q.get('fen')) { const f = q.get('fen')!; new Chess(f); setRoot(f); const ms = (q.get('moves') || '').split(' ').filter(Boolean); const c = new Chess(f); const out: Move[] = []; for (const u of ms) { const m = tryMove(c, u); if (m) out.push(m); } setMoves(out); setPly(Math.min(1, out.length)); setOrient(new Chess(f).turn() === 'w' ? 'black' : 'white'); }
    } catch { toast('Position invalide', '⚠️'); }
  }, []);
  const pos = useMemo(() => { const c = new Chess(root); for (const m of moves.slice(0, ply)) tryMove(c, m.san); return c; }, [root, moves, ply]);
  const fen = pos.fen();
  useEffect(() => {
    setLines([]); if (!engineOn || pos.isGameOver()) { engine.stopAll(); return; }
    let live = true; engine.stopAll();
    const t = setTimeout(() => engine.analyse(fen, { depth: 20, multipv: 3, onInfo: (l) => live && setLines(l) }).then((r) => live && r.lines.length && setLines(r.lines)).catch(() => {}), 120);
    return () => { live = false; clearTimeout(t); engine.stopAll(); };
  }, [fen, engineOn]);
  useEffect(() => () => engine.stopAll(), []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.target as HTMLElement).tagName === 'TEXTAREA') return; if (e.key === 'ArrowLeft') setPly((p) => Math.max(0, p - 1)); if (e.key === 'ArrowRight') setPly((p) => Math.min(moves.length, p + 1)); if (e.key === 'f') setOrient((o) => (o === 'white' ? 'black' : 'white')); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [moves.length]);
  function loadPgn(pgn: string) { const c = new Chess(); try { c.loadPgn(pgn); } catch { c.loadPgn(frToEn(pgn)); } const hist = c.history({ verbose: true }); const start = (c.header() as any).FEN || START_FEN; setRoot(start); setMoves(hist); setPly(hist.length); }
  function onMove(from: string, to: string, promotion?: string) {
    const c = new Chess(fen); const m = tryMove(c, { from, to, promotion: promotion || (isPromotion(pos, from, to) ? 'q' : undefined) }); if (!m) return false;
    playForMove(m);
    if (moves[ply] && moves[ply].san === m.san) { setPly(ply + 1); return true; }
    setMoves([...moves.slice(0, ply), m]); setPly(ply + 1); return true;
  }
  const best = lines[0]; const ev = best ? whiteScore(best, fen) : 0;
  const pgnOut = () => { const c = new Chess(root); if (root !== START_FEN) { c.header('SetUp', '1', 'FEN', root); } for (const m of moves) tryMove(c, m.san); return c.pgn(); };
  const copy = async (s: string) => { try { await navigator.clipboard.writeText(s); toast('Copié dans le presse-papiers', '📋'); } catch { setText(s); } };
  const book = bookMoves(fen);
  const op = root === START_FEN ? openingName(moves.slice(0, ply).map((m) => m.san)) : null;
  const startPly = (new Chess(root).turn() === 'b' ? 1 : 0) + (new Chess(root).moveNumber() - 1) * 2;
  return (
    <div class="page analysis">
      <div class="session-head"><h1>Analyse</h1>
        <label class="toggle"><input type="checkbox" checked={engineOn} onChange={(e) => setEngineOn((e.target as HTMLInputElement).checked)} /> Moteur</label></div>
      <div class="play-grid">
        <div class="board-col with-eval">
          {engineOn && <EvalBar cp={pos.isCheckmate() ? (pos.turn() === 'w' ? -10000 : 10000) : ev} orientation={orient} label={pos.isCheckmate() ? '#' : formatScore(ev)} />}
          <Board fen={fen} orientation={orient} turn={turnColor(pos)} movable={turnColor(pos)} dests={legalDests(pos)} check={!!checkSquare(pos)}
            lastMove={ply > 0 ? [moves[ply - 1].from, moves[ply - 1].to] : null} onMove={onMove} promotionCheck={(f, t) => isPromotion(pos, f, t)}
            shapes={engineOn && best ? lines.slice(0, 3).map((l, i) => ({ orig: l.move.slice(0, 2) as any, dest: l.move.slice(2, 4) as any, brush: i === 0 ? 'paleBlue' : 'paleGrey' })) : []} />
          <div class="demo-ctrl">
            <button class="btn icon" onClick={() => setPly(0)} aria-label="Début">⏮</button>
            <button class="btn icon" onClick={() => setPly(Math.max(0, ply - 1))} aria-label="Précédent">◀</button>
            <button class="btn icon" onClick={() => setPly(Math.min(moves.length, ply + 1))} aria-label="Suivant">▶</button>
            <button class="btn icon" onClick={() => setPly(moves.length)} aria-label="Fin">⏭</button>
            <button class="btn icon" onClick={() => setOrient(orient === 'white' ? 'black' : 'white')} aria-label="Retourner l’échiquier">⇅</button>
          </div>
        </div>
        <aside class="side card">
          {op && <p class="opening-name">📖 {op}</p>}
          {engineOn && (
            <div class="pv-lines">
              {lines.length === 0 && !pos.isGameOver() && <p class="muted small">Stockfish 18 réfléchit…</p>}
              {pos.isGameOver() && <p><b>{pos.isCheckmate() ? 'Échec et mat' : 'Partie nulle'}</b></p>}
              {lines.map((l) => (
                <div class="pv"><b class="pv-score">{formatScore(whiteScore(l, fen))}</b><span>{formatLine(uciLineToSan(fen, l.pv, 8), startPly + ply)}</span></div>
              ))}
              {best && <small class="muted">Profondeur {best.depth}</small>}
            </div>
          )}
          {book.length > 0 && <div class="book"><h4>📖 Théorie</h4>{book.map((b) => <button class="chip" title={b.names.join(', ')} onClick={() => { const c = new Chess(fen); const m = tryMove(c, b.san); if (m) onMove(m.from, m.to, m.promotion); }}>{sanFr(b.san)}</button>)}</div>}
          <div class="review-moves">
            {moves.map((m, i) => <button class={'mv ' + (ply === i + 1 ? 'cur' : '')} onClick={() => setPly(i + 1)}>{(startPly + i) % 2 === 0 && <span class="num">{Math.floor((startPly + i) / 2) + 1}.</span>}{sanFr(m.san)}</button>)}
          </div>
          <div class="row wrap">
            <button class="btn small ghost" onClick={() => { setText(''); setIo('pgn'); }}>Importer PGN</button>
            <button class="btn small ghost" onClick={() => { setText(''); setIo('fen'); }}>Importer FEN</button>
            <button class="btn small ghost" onClick={() => copy(pgnOut())}>Copier PGN</button>
            <button class="btn small ghost" onClick={() => copy(fen)}>Copier FEN</button>
            <button class="btn small ghost" onClick={() => { setRoot(START_FEN); setMoves([]); setPly(0); }}>Réinitialiser</button>
          </div>
          <p class="muted small fen-line">{fen}</p>
        </aside>
      </div>
      <Modal open={!!io} onClose={() => setIo(null)} title={io === 'pgn' ? 'Importer une partie (PGN)' : 'Importer une position (FEN)'}>
        <textarea class="io" value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder={io === 'pgn' ? '1. e4 e5 2. Nf3 Nc6 …' : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'} rows={6} />
        <div class="row"><button class="btn primary" onClick={() => {
          try { if (io === 'pgn') loadPgn(text.trim()); else { new Chess(text.trim()); setRoot(text.trim()); setMoves([]); setPly(0); } setIo(null); toast('Chargé !', '✅'); }
          catch (e: any) { toast('Format invalide : ' + (e?.message || ''), '⚠️'); }
        }}>Charger</button><button class="btn ghost" onClick={() => setIo(null)}>Annuler</button></div>
      </Modal>
    </div>
  );
}

/** Accepte aussi la notation française (R, D, T, F, C) dans un PGN collé. */
function frToEn(pgn: string) {
  const map: Record<string, string> = { R: 'K', D: 'Q', T: 'R', F: 'B', C: 'N' };
  return pgn.replace(/\[[^\]]*\]/g, (h) => h).split(/(\[[^\]]*\])/).map((part) => part.startsWith('[') ? part : part.replace(/(^|[\s.])([RDTFC])(?=[a-h1-8x])/g, (_, a, b) => a + map[b]).replace(/=([DTFC])/g, (_, b) => '=' + map[b])).join('');
}
