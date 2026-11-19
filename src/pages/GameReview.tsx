// Bilan de partie mené par le coach : résumé, 3 leçons, moments clés à rejouer, puis coup par coup.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Board, type DrawShape } from '../components/Board';
import { MoveTrainer } from '../components/MoveTrainer';
import { EvalBar, Progress, PremiumLock, backOr } from '../components/ui';
import { Icon } from '../components/Icon';
import { useStore, setState, addXp, getState } from '../lib/store';
import { reviewsLeft, consumeReview, FREE_REVIEWS_PER_DAY } from '../lib/features';
import { usePremium } from '../lib/entitlements';
import { botById } from '../data/bots';
import { formatScore } from '../lib/engine';
import { sanFr, START_FEN } from '../lib/chess';
import { checkBadges } from '../lib/progress';
import { markPlanDone } from '../lib/plan';
import { openingName } from '../data/openings';
import { coachReview } from '../coach/client';
import { CLASSES, type MoveClass } from '../coach/classify';
import { ingestReview } from '../coach/curriculum';
import { globalRating } from '../coach/model';
import { SKILL } from '../coach/skills';
import { sanOf } from '../coach/lang';
import type { CoachReview, CoachMove } from '../coach/pipeline';

const cacheKey = (id: string) => 'cr3-' + id;
const BAD: MoveClass[] = ['inaccuracy', 'mistake', 'miss', 'blunder'];
/** Étiquettes héritées (plan du jour) à partir des tags du coach. */
function legacyTags(moves: CoachMove[]): string[] {
  const out = new Set<string>();
  for (const m of moves) for (const t of m.ex?.tags || []) {
    if (!BAD.includes(m.cls)) continue;
    if (t.startsWith('allowed:hanging') || t.startsWith('allowed:threat')) out.add('hanging'); else if (t.startsWith('allowed:')) out.add('tacticAllowed');
    else if (t.startsWith('allowedMate')) out.add('allowedMate'); else if (t.startsWith('missedMate')) out.add('missedMate');
    else if (t.startsWith('missed:')) { const k = t.split(':')[1]; out.add(['fork', 'pin', 'skewer', 'discoveredAttack'].includes(k) ? 'missed:' + k : k === 'hangingCapture' ? 'missed:freePiece' : 'missedTactic'); }
    else if (t.startsWith('opening:')) out.add('opening'); else if (t.startsWith('endgame:')) out.add('endgame');
  }
  return [...out];
}
const moveNo = (m: CoachMove) => `${Math.floor(m.ply / 2) + 1}${m.color === 'w' ? '.' : '…'} ${sanFr(m.san)}`;

export function GameReviewPage({ id }: { id: string }) {
  const game = useStore((s) => s.games.find((g) => g.id === id));
  const ent = usePremium();
  const [rv, setRv] = useState<CoachReview | null>(() => { try { const r = JSON.parse(localStorage.getItem(cacheKey(id)) || 'null'); return r?.v === 2 ? r : null; } catch { return null; } });
  const [prog, setProg] = useState(0); const [running, setRunning] = useState(false); const [err, setErr] = useState('');
  const [ply, setPly] = useState(0);
  const [retry, setRetry] = useState<number | null>(null); const [retryRes, setRetryRes] = useState<'ok' | 'ko' | null>(null);
  const sig = useRef({ cancelled: false });
  useEffect(() => () => { sig.current.cancelled = true; }, []);
  if (!game) return <div class="page"><h1>Partie introuvable</h1><a href="#/profile">Mes parties</a></div>;
  const bot = botById(game.botId);
  const run = async () => {
    if (!game.reviewed && reviewsLeft() <= 0) return;
    setRunning(true); setErr('');
    try {
      const st = getState(); const elo = st.coach ? globalRating(st.coach) : st.puzzle.rating;
      const r = await coachReview(START_FEN, game.moves, { depth: ent.premium ? 14 : 12, elo, user: game.color, oppElo: bot.elo, gameId: id, result: game.result, onProgress: setProg, signal: sig.current });
      try { localStorage.setItem(cacheKey(id), JSON.stringify(r)); } catch {}
      if (!game.reviewed) consumeReview();
      const mine = r.moves.filter((m) => m.color === game.color);
      const counts: Record<string, number> = r.counts[game.color];
      setState((s) => {
        const g = s.games.find((x) => x.id === id); if (g) { g.reviewed = true; g.accuracy = r.accuracy[game.color]; g.counts = counts; g.weaknesses = legacyTags(mine); g.phaseAcc = r.phaseAcc as any; }
        markPlanDone(s, 'review:' + id); ingestReview(s, r, id);
      });
      addXp(15, 'Bilan de partie'); checkBadges();
      setRv(r); setPly(0);
    } catch (e: any) { if (!sig.current.cancelled) setErr(String(e?.message || e)); }
    setRunning(false);
  };
  const left = reviewsLeft();
  if (!rv) return (
    <div class="page center-page">
      <div class="game-top"><a class="nb-btn round" href="#/play" onClick={backOr} aria-label="Fermer"><Icon name="close" size={18} stroke={2.5} /></a><span /><span /></div>
      <div class="celebrate"><Icon name="brainCircuit" size={52} stroke={1.8} /></div>
      <h1>Bilan avec le coach</h1>
      <p class="muted">Contre {bot.name} · {game.result} · {Math.ceil(game.moves.length / 2)} coups</p>
      {running ? (<div class="review-progress"><Progress value={prog} label="Analyse" /><p class="muted tnum">{prog < 0.95 ? `Stockfish analyse chaque position… ${Math.round(prog * 100)} %` : 'Le coach rédige ton bilan…'}</p></div>)
        : game.reviewed || left > 0 ? (<><div class="center-col"><button class="btn primary lg" onClick={run}>Lancer le bilan</button></div>{!ent.premium && !game.reviewed && <p class="muted small">Bilans gratuits restants aujourd’hui : {left}/{FREE_REVIEWS_PER_DAY}</p>}</>)
        : <PremiumLock title="Tu as utilisé tes 3 bilans gratuits du jour" text="Reviens demain pour 3 nouveaux bilans gratuits, ou passe Premium pour des bilans illimités avec le coach approfondi." />}
      {err && <p class="error">{err}</p>}
    </div>
  );
  const cur = ply > 0 ? rv.moves[ply - 1] : null;
  const fen = cur ? cur.fenAfter : START_FEN;
  const evals = [rv.moves[0] ? 20 : 0, ...rv.moves.map((m) => m.whiteCp)];
  const ev = evals[ply] ?? 0;
  const orient = game.color === 'w' ? 'white' : 'black';
  const op = openingName(game.moves);
  const opp = game.color === 'w' ? 'b' : 'w';
  const W = 600, H = 90; const pts = rv.es.map((e, i) => [(i / Math.max(1, rv.es.length - 1)) * W, H - e * H]);
  const rt = retry != null ? rv.retries[retry] : null;
  const goPly = (p: number) => { setPly(p); setRetry(null); };
  const shapes: DrawShape[] = cur?.ex ? cur.ex.arrows.filter((a) => a.orig !== a.dest).map((a) => ({ orig: a.orig as any, dest: a.dest as any, brush: a.brush })) : cur && !CLASSES[cur.cls].good && cur.best !== cur.uci ? [{ orig: cur.best.slice(0, 2) as any, dest: cur.best.slice(2, 4) as any, brush: 'green' }] : [];
  const hl = new Map<string, string>(); if (cur) { hl.set(cur.uci.slice(2, 4), 'cls-' + cur.cls); for (const mk of cur.ex?.marks || []) if (mk.sq !== cur.uci.slice(2, 4)) hl.set(mk.sq, 'mk-' + mk.kind); }
  const phases: [string, string][] = [['opening', 'Ouverture'], ['middlegame', 'Milieu'], ['endgame', 'Finale']];
  return (
    <div class="page review">
      <div class="game-top"><a class="nb-btn round" href="#/play" onClick={backOr} aria-label="Fermer"><Icon name="close" size={18} stroke={2.5} /></a><div class="gt-title">Bilan contre {bot.name}</div><span class="pill tnum">{game.result}</span></div>
      {op && <p class="opening-name center-text">{op}</p>}
      <section class="coach-summary" aria-labelledby="cs-t">
        <div class="cc-head"><span class="cc-avatar" aria-hidden="true"><Icon name="brainCircuit" size={22} /></span><div class="grow"><div class="cc-eyebrow">L’avis du coach</div><div class="cc-title" id="cs-t">{rv.summary.split(' : ')[0]}</div></div></div>
        <p class="cs-text">{rv.summary.split(' : ').slice(1).join(' : ')}</p>
        <div class="cs-acc">
          <div><small>Toi</small><b>{String(rv.accuracy[game.color]).replace('.', ',')}</b><small>précision</small></div>
          <div><small>{bot.name}</small><b>{String(rv.accuracy[opp]).replace('.', ',')}</b><small>précision</small></div>
        </div>
        {Object.keys(rv.phaseAcc).length > 0 && <div class="cs-phases">{phases.filter(([k]) => rv.phaseAcc[k] != null).map(([k, l]) => <span class="pill">{l} {String(rv.phaseAcc[k]).replace('.', ',')} %</span>)}</div>}
      </section>
      {rv.lessons.length > 0 && <>
        <div class="section-title"><h2>Les leçons de ta partie</h2></div>
        <div class="lessons3">{rv.lessons.map((l, i) => (
          <div class="lesson3"><span class="l3-n">{i + 1}</span><div class="grow"><h4>{l.title}</h4><p>{l.text}</p>
            <div class="row">
              {l.ply != null && <button class="btn small secondary" onClick={() => goPly(l.ply! + 1)}>Voir le coup</button>}
              {l.skill && SKILL[l.skill].theme && <a class="btn small tinted" href={`#/puzzles/theme/${SKILL[l.skill].theme}`}>S’entraîner</a>}
            </div></div></div>
        ))}</div>
      </>}
      {rv.retries.length > 0 && retry == null && (
        <div class="retry-bar"><Icon name="repeat" size={20} /><p>{rv.retries.length} moment{rv.retries.length > 1 ? 's' : ''} clé{rv.retries.length > 1 ? 's' : ''} à rejouer. Ils rejoignent aussi tes révisions.</p><button class="btn small primary" onClick={() => { setRetry(0); setRetryRes(null); setPly(rv.retries[0].ply); }}>Rejouer</button></div>
      )}
      <svg class="eval-graph" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onClick={(e) => { const r = (e.currentTarget as SVGElement).getBoundingClientRect(); goPly(Math.round(((e.clientX - r.left) / r.width) * (rv.es.length - 1))); }} role="img" aria-label="Courbe des chances de gain des Blancs">
        <rect width={W} height={H} class="eg-bg" />
        <path d={`M0,${H} ` + pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ` L${W},${H} Z`} class="eg-white" />
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} class="eg-mid" />
        {rv.critical.map((c) => <circle cx={pts[c.ply + 1]?.[0]} cy={pts[c.ply + 1]?.[1]} r="5" fill={CLASSES[rv.moves[c.ply].cls].color} />)}
        <line x1={pts[ply]?.[0]} x2={pts[ply]?.[0]} y1="0" y2={H} class="eg-cur" />
      </svg>
      <div class="play-grid">
        <div class="board-col with-eval">
          <EvalBar cp={ev} orientation={orient} label={formatScore(ev)} />
          {rt ? (
            <MoveTrainer key={'rt' + retry} fen={rt.fen} line={rt.solution} orientation={orient} onMistake={() => setRetryRes((x) => x || 'ko')} onSolved={() => setRetryRes((x) => (x === 'ko' ? 'ko' : 'ok'))} />
          ) : (
            <Board fen={fen} viewOnly orientation={orient} lastMove={cur ? [cur.uci.slice(0, 2), cur.uci.slice(2, 4)] : null} shapes={shapes} highlight={hl} />
          )}
        </div>
        <aside class="side">
          {rt ? (
            <div class="coach-box cls-mistake">
              <div class="coach-head"><Icon name="repeat" size={18} /><b>Moment clé {retry! + 1}/{rv.retries.length} · {moveNo(rv.moves[rt.ply])}</b></div>
              <p>{rt.prompt}</p>
              {retryRes === 'ok' && <p class="success-box"><Icon name="checkCircle" size={20} />Bravo, c’était bien ça.</p>}
              {retryRes === 'ko' && <p class="muted small">Pas tout à fait : cherche encore, ou passe à la suite.</p>}
              <div class="row">
                {retry! + 1 < rv.retries.length ? <button class="btn small primary" onClick={() => { setRetry(retry! + 1); setRetryRes(null); setPly(rv.retries[retry! + 1].ply); }}>Moment suivant</button>
                  : <button class="btn small primary" onClick={() => goPly(rt.ply + 1)}>Terminer</button>}
                <button class="btn small secondary" onClick={() => goPly(rt.ply + 1)}>Voir l’explication</button>
              </div>
            </div>
          ) : cur ? (
            <div class={'coach-box cls-' + cur.cls}>
              <div class="coach-head"><span class="cls-badge" style={{ background: CLASSES[cur.cls].color }}>{CLASSES[cur.cls].symbol}</span><b>{moveNo(cur)} · {CLASSES[cur.cls].label}</b></div>
              {cur.ex ? <>
                <h4>{cur.ex.headline}</h4>
                <p>{cur.ex.why}</p>
                {cur.ex.plan && <p class="cb-line">{cur.ex.plan}</p>}
                {cur.ex.refutation && (ent.premium ? <p class="cb-line">La suite : {cur.ex.refutation}</p> : null)}
                {cur.ex.tip && <p class="cb-tip"><Icon name="bulb" size={16} />{cur.ex.tip}</p>}
                {!ent.premium && cur.ex.refutation && <a class="deep-teaser" href="#/premium"><Icon name="crown" size={16} />Variantes complètes et analyse plus profonde avec Premium</a>}
              </> : <p>Coup de {bot.name}.{!CLASSES[cur.cls].good ? ` Le moteur préférait ${sanOf(cur.fenBefore, cur.best)}.` : ''}</p>}
              {cur.color === game.color && BAD.includes(cur.cls) && rv.retries.some((r) => r.ply === cur.ply) && (
                <button class="btn small primary" onClick={() => { const i = rv.retries.findIndex((r) => r.ply === cur.ply); setRetry(i); setRetryRes(null); }}><Icon name="repeat" size={16} />Retrouver le meilleur coup</button>
              )}
            </div>
          ) : <p class="muted">Touche un coup, un moment clé ou la courbe pour lire le commentaire du coach.</p>}
          {rv.critical.length > 0 && <><div class="section-label">Moments clés</div><div class="key-moments">{rv.critical.map((c) => { const m = rv.moves[c.ply]; return <button class="km" onClick={() => goPly(c.ply + 1)}><span class="cls-dot" style={{ background: CLASSES[m.cls].color }} />{moveNo(m)}<span class="muted small">{m.ex?.headline || CLASSES[m.cls].label}</span></button>; })}</div></>}
          <table class="cls-table">
            <thead><tr><th></th><th>Toi</th><th>{bot.name.split(' ')[0]}</th></tr></thead>
            <tbody>{(Object.keys(CLASSES) as MoveClass[]).map((c) => (rv.counts.w[c] || rv.counts.b[c]) ? <tr><td><span class="cls-dot" style={{ background: CLASSES[c].color }}>{CLASSES[c].symbol}</span> {CLASSES[c].label}</td><td>{rv.counts[game.color][c] || 0}</td><td>{rv.counts[opp][c] || 0}</td></tr> : null)}</tbody>
          </table>
          <div class="review-moves">
            {rv.moves.map((m, i) => <button class={'mv ' + (ply === i + 1 ? 'cur' : '')} onClick={() => goPly(i + 1)}>{i % 2 === 0 && <span class="num">{i / 2 + 1}.</span>}{sanFr(m.san)}<span class="cls-mini" style={{ color: CLASSES[m.cls].color }}>{['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder'].includes(m.cls) ? CLASSES[m.cls].symbol : ''}</span></button>)}
          </div>
          <a class="btn secondary" href={`#/analysis?pgn=${encodeURIComponent(game.pgn)}`}><Icon name="microscope" size={18} />Ouvrir dans l’analyse</a>
          <div class="actionbar">
            <button class="tool" onClick={() => goPly(0)} aria-label="Début" disabled={ply === 0}><Icon name="first" size={22} /></button>
            <button class="tool" onClick={() => goPly(Math.max(0, ply - 1))} aria-label="Coup précédent" disabled={ply === 0}><Icon name="left" size={26} stroke={2.4} /></button>
            <button class="tool" onClick={() => goPly(Math.min(rv.moves.length, ply + 1))} aria-label="Coup suivant" disabled={ply >= rv.moves.length}><Icon name="right" size={26} stroke={2.4} /></button>
            <button class="tool" onClick={() => goPly(rv.moves.length)} aria-label="Fin" disabled={ply >= rv.moves.length}><Icon name="last" size={22} /></button>
          </div>
        </aside>
      </div>
    </div>
  );
}
