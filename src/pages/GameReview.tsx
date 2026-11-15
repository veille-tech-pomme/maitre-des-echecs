import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Board } from '../components/Board';
import { MoveTrainer } from '../components/MoveTrainer';
import { EvalBar, Progress, PremiumLock } from '../components/ui';
import { useStore, setState, addXp } from '../lib/store';
import { reviewGame, CLASS_INFO, CLASS_ORDER, type GameReview } from '../lib/review';
import { reviewsLeft, consumeReview, FREE_REVIEWS_PER_DAY } from '../lib/features';
import { usePremium } from '../lib/entitlements';
import { botById } from '../data/bots';
import { formatScore } from '../lib/engine';
import { Chess, sanFr, START_FEN, formatLine } from '../lib/chess';
import { checkBadges } from '../lib/progress';
import { markPlanDone } from '../lib/plan';
import { openingName } from '../data/openings';

const cacheKey = (id: string) => 'rv-' + id;
export function GameReviewPage({ id }: { id: string }) {
  const game = useStore((s) => s.games.find((g) => g.id === id));
  const ent = usePremium();
  const [rv, setRv] = useState<GameReview | null>(() => { try { return JSON.parse(localStorage.getItem(cacheKey(id)) || 'null'); } catch { return null; } });
  const [prog, setProg] = useState(0); const [running, setRunning] = useState(false); const [err, setErr] = useState('');
  const [ply, setPly] = useState(0); const [retry, setRetry] = useState(false); const [retryDone, setRetryDone] = useState(false);
  const sig = useRef({ cancelled: false });
  useEffect(() => () => { sig.current.cancelled = true; }, []);
  if (!game) return <div class="page"><h1>Partie introuvable</h1><a href="#/profile">Mes parties</a></div>;
  const bot = botById(game.botId);
  const run = async () => {
    if (!game.reviewed && reviewsLeft() <= 0) return;
    setRunning(true); setErr('');
    try {
      const r = await reviewGame(START_FEN, game.moves, { depth: ent.premium ? 14 : 12, onProgress: setProg, signal: sig.current });
      try { localStorage.setItem(cacheKey(id), JSON.stringify(r)); } catch {}
      if (!game.reviewed) consumeReview();
      const mine = r.moves.filter((m) => m.color === game.color);
      const tags = [...new Set(mine.filter((m) => ['inaccuracy', 'mistake', 'blunder', 'miss'].includes(m.cls)).flatMap((m) => m.tags))];
      setState((s) => { const g = s.games.find((x) => x.id === id); if (g) { g.reviewed = true; g.accuracy = r.accuracy[game.color]; g.counts = r.counts[game.color]; g.weaknesses = tags; g.phaseAcc = r.phaseAcc[game.color] as any; } markPlanDone(s, 'review:' + id); });
      addXp(15, 'Bilan de partie'); checkBadges();
      setRv(r); setPly(0);
    } catch (e: any) { if (!sig.current.cancelled) setErr(String(e?.message || e)); }
    setRunning(false);
  };
  const left = reviewsLeft();
  if (!rv) return (
    <div class="page center-page">
      <a class="back" href="#/profile">‹ Mes parties</a>
      <h1>🔬 Bilan de la partie</h1>
      <p class="muted">Contre {bot.avatar} {bot.name} · {game.result} · {game.moves.length} demi-coups</p>
      {running ? (<><Progress value={prog} /><p class="muted">Analyse en cours par Stockfish… {Math.round(prog * 100)} %</p></>)
        : game.reviewed || left > 0 ? (<><button class="btn primary big" onClick={run}>Lancer le bilan</button>{!ent.premium && !game.reviewed && <p class="muted small">Bilans gratuits restants aujourd’hui : {left}/{FREE_REVIEWS_PER_DAY}</p>}</>)
        : <PremiumLock title="Tu as utilisé tes 3 bilans gratuits du jour" text="Reviens demain pour 3 nouveaux bilans gratuits, ou passe Premium pour des bilans illimités avec le coach approfondi." />}
      {err && <p class="error">{err}</p>}
    </div>
  );
  const cur = ply > 0 ? rv.moves[ply - 1] : null;
  const fen = cur ? cur.fenAfter : START_FEN;
  const ev = ply === 0 ? (rv.evals[0] || 20) : rv.evals[ply];
  const mine = rv.moves.filter((m) => m.color === game.color);
  const keyMoments = mine.filter((m) => ['blunder', 'mistake', 'miss', 'brilliant', 'great'].includes(m.cls));
  const orient = game.color === 'w' ? 'white' : 'black';
  const op = openingName(game.moves);
  const W = 600, H = 90; const pts = rv.evals.map((e, i) => { const w = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-1500, Math.min(1500, e)))) - 1); return [(i / Math.max(1, rv.evals.length - 1)) * W, H - (w / 100) * H]; });
  return (
    <div class="page review">
      <div class="session-head"><a class="back" href="#/profile">‹</a><h1>Bilan contre {bot.name}</h1><span class="pill">{game.result}</span></div>
      {op && <p class="opening-name">📖 {op}</p>}
      <div class="acc-row">
        <div class="acc"><small>Toi</small><b>{String(rv.accuracy[game.color]).replace('.', ',')}</b><small>précision</small></div>
        <div class="acc"><small>{bot.name}</small><b>{String(rv.accuracy[game.color === 'w' ? 'b' : 'w']).replace('.', ',')}</b><small>précision</small></div>
      </div>
      <svg class="eval-graph" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onClick={(e) => { const r = (e.currentTarget as SVGElement).getBoundingClientRect(); setPly(Math.round(((e.clientX - r.left) / r.width) * (rv.evals.length - 1))); setRetry(false); }} role="img" aria-label="Courbe d’évaluation">
        <rect width={W} height={H} class="eg-bg" />
        <path d={`M0,${H} ` + pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ` L${W},${H} Z`} class="eg-white" />
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} class="eg-mid" />
        {rv.moves.map((m, i) => ['blunder', 'mistake', 'miss', 'brilliant'].includes(m.cls) && <circle cx={pts[i + 1][0]} cy={pts[i + 1][1]} r="4" fill={CLASS_INFO[m.cls].color} />)}
        <line x1={pts[ply]?.[0]} x2={pts[ply]?.[0]} y1="0" y2={H} class="eg-cur" />
      </svg>
      <div class="play-grid">
        <div class="board-col with-eval">
          <EvalBar cp={ev} orientation={orient} label={formatScore(ev)} />
          {retry && cur ? (
            <MoveTrainer key={'retry' + ply} fen={cur.fenBefore} line={[cur.best]} orientation={orient} accept={() => false} onSolved={() => setRetryDone(true)} />
          ) : (
            <Board fen={fen} viewOnly orientation={orient} lastMove={cur ? [cur.uci.slice(0, 2), cur.uci.slice(2, 4)] : null}
              shapes={cur && !['best', 'book', 'brilliant', 'great'].includes(cur.cls) && cur.best !== cur.uci ? [{ orig: cur.best.slice(0, 2) as any, dest: cur.best.slice(2, 4) as any, brush: 'green' }] : []}
              highlight={cur ? new Map([[cur.uci.slice(2, 4), 'cls-' + cur.cls]]) : undefined} />
          )}
          <div class="demo-ctrl">
            <button class="btn icon" onClick={() => { setPly(0); setRetry(false); }} aria-label="Début">⏮</button>
            <button class="btn icon" onClick={() => { setPly(Math.max(0, ply - 1)); setRetry(false); }} aria-label="Précédent">◀</button>
            <button class="btn icon" onClick={() => { setPly(Math.min(rv.moves.length, ply + 1)); setRetry(false); }} aria-label="Suivant">▶</button>
            <button class="btn icon" onClick={() => { setPly(rv.moves.length); setRetry(false); }} aria-label="Fin">⏭</button>
          </div>
        </div>
        <aside class="side card">
          {cur ? (
            <div class={'coach-box cls-' + cur.cls}>
              <div class="coach-head"><span class="cls-badge" style={{ background: CLASS_INFO[cur.cls].color }}>{CLASS_INFO[cur.cls].symbol}</span><b>{Math.floor(cur.ply / 2) + 1}{cur.color === 'w' ? '.' : '…'} {sanFr(cur.san)} — {CLASS_INFO[cur.cls].label}</b></div>
              <p>{cur.coach}</p>
              {cur.best !== cur.uci && !['book'].includes(cur.cls) && <p class="muted small">Meilleur : <b>{sanFr(cur.bestSan)}</b> ({formatLine(cur.bestLine.slice(0, 5), cur.ply)})</p>}
              {ent.premium ? (cur.deep.length > 0 && <details open><summary>🧑‍🏫 Explication approfondie</summary><ul>{cur.deep.map((d) => <li>{d}</li>)}</ul></details>)
                : <a class="deep-teaser" href="#/premium">🔒 Explication approfondie du coach (variantes, menaces, principes) — Premium</a>}
              {cur.color === game.color && ['inaccuracy', 'mistake', 'blunder', 'miss'].includes(cur.cls) && (
                retry ? (retryDone ? <p class="success-box">✅ Bravo, c’était bien {sanFr(cur.bestSan)} !</p> : <button class="btn small ghost" onClick={() => setRetry(false)}>Annuler</button>)
                  : <button class="btn small primary" onClick={() => { setRetry(true); setRetryDone(false); }}>🔁 Retrouver le meilleur coup</button>
              )}
            </div>
          ) : <p class="muted">Clique sur un coup ou sur la courbe pour voir le commentaire du coach.</p>}
          <table class="cls-table">
            <thead><tr><th></th><th>Toi</th><th>{bot.avatar}</th></tr></thead>
            <tbody>{CLASS_ORDER.map((c) => (rv.counts.w[c] || rv.counts.b[c]) ? <tr><td><span class="cls-dot" style={{ background: CLASS_INFO[c].color }}>{CLASS_INFO[c].symbol}</span> {CLASS_INFO[c].label}</td><td>{rv.counts[game.color][c] || 0}</td><td>{rv.counts[game.color === 'w' ? 'b' : 'w'][c] || 0}</td></tr> : null)}</tbody>
          </table>
          {keyMoments.length > 0 && <><h4>Moments clés</h4><div class="key-moments">{keyMoments.map((m) => <button class="km" onClick={() => { setPly(m.ply + 1); setRetry(false); }}><span class="cls-dot" style={{ background: CLASS_INFO[m.cls].color }}>{CLASS_INFO[m.cls].symbol}</span>{Math.floor(m.ply / 2) + 1}. {sanFr(m.san)}</button>)}</div></>}
          <div class="review-moves">
            {rv.moves.map((m, i) => <button class={'mv ' + (ply === i + 1 ? 'cur' : '')} onClick={() => { setPly(i + 1); setRetry(false); }}>{i % 2 === 0 && <span class="num">{i / 2 + 1}.</span>}{sanFr(m.san)}<span class="cls-mini" style={{ color: CLASS_INFO[m.cls].color }}>{['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder'].includes(m.cls) ? CLASS_INFO[m.cls].symbol : ''}</span></button>)}
          </div>
          <a class="btn ghost" href={`#/analysis?pgn=${encodeURIComponent(game.pgn)}`}>Ouvrir dans l’analyse libre</a>
        </aside>
      </div>
    </div>
  );
}
