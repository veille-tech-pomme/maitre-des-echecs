// Coup du jour (R4b, plan §2.2) : #/jour (aujourd'hui), #/jour/<n> (lien partagé ou archive), #/jour/archives.
// Une seule tentative notée (le jour même), mesurée : temps (onglet caché exclu), indices, coups justes.
// Ensuite on peut rejouer, sans note. Les archives sont gratuites, sans note et sans série. Rien ne quitte l'appareil.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { MoveTrainer } from '../components/MoveTrainer';
import { NavBar, Item, toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { useStore, getState, setState, today, streakAlive } from '../lib/store';
import { recordPuzzle } from '../lib/progress';
import { log } from '../lib/events';
import { computeThinkMs, type Span } from '../lib/timing';
import { entry, todayNumber, dateOf, starStr, stars, goalText, gridFrom, playerIdx, playerMoves, gridOk, shareText, fmtTime, CELL_EMOJI, type DailyEntry, type DailyResult, type Cell } from '../lib/daily';

const CELL_FR: Record<Cell, string> = { g: 'juste du premier coup', y: 'juste après une erreur ou un indice', r: 'coup montré' };
const dateFr = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export function DailyPage({ arg }: { arg?: string }) {
  if (arg === 'archives') return <DailyArchive />;
  const tn = todayNumber(); const n = arg && /^\d+$/.test(arg) ? +arg : tn;
  return <DailyPuzzle key={n} n={n} tn={tn} />;
}

function Grid({ g, big }: { g: string; big?: boolean }) {
  return <div class={'dj-grid' + (big ? ' big' : '')} role="img" aria-label={[...g].map((c, k) => `coup ${k + 1} : ${CELL_FR[c as Cell]}`).join(', ')}>{[...g].map((c) => <span class={'dj-cell ' + c} />)}</div>;
}

function untilTomorrow() { const now = new Date(); const t = new Date(now); t.setHours(24, 0, 0, 0); const m = Math.max(1, Math.round((t.getTime() - now.getTime()) / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; }

async function shareResult(e: DailyEntry, r: DailyResult) {
  const s = getState(); const text = shareText(e, r, streakAlive(s) ? s.streak.count : 0);
  let via = 'none';
  try {
    if (navigator.share) { await navigator.share({ text }); via = 'share'; }
    else if (navigator.clipboard) { await navigator.clipboard.writeText(text); via = 'clipboard'; toast('Résultat copié : colle-le où tu veux', 'check'); }
  } catch (err: any) {
    if (err?.name === 'AbortError') return;
    try { await navigator.clipboard.writeText(text); via = 'clipboard'; toast('Résultat copié : colle-le où tu veux', 'check'); } catch { /* pas de presse-papiers */ }
  }
  if (via === 'none') { (window as any).prompt?.('Copie ton résultat :', text); via = 'prompt'; }
  log('share', { what: 'jour', n: e.n, via });
}

function DailyPuzzle({ n, tn }: { n: number; tn: number }) {
  const s = useStore((x) => x);
  const [e, setE] = useState<DailyEntry | null | undefined>(undefined);
  const [replay, setReplay] = useState(0); // 0 : tentative (notée si c'est aujourd'hui et pas encore jouée)
  useEffect(() => { if (n > tn) { setE(null); return; } entry(n).then(setE, () => setE(null)); }, [n]);
  const done = s.jour?.[n];
  const future = n > tn;
  if (e === undefined) return <div class="page"><div class="loading" aria-label="Chargement du Coup du jour" /></div>;
  if (!e) return (
    <div class="page"><NavBar back="#/" backLabel="Pour toi" close />
      <div class="empty"><div class="empty-icon"><Icon name="calendar" size={30} /></div>
        <h3>{future ? `Le Coup du jour #${n} n’est pas encore sorti` : 'Coup du jour introuvable'}</h3>
        <p>{future ? `Il sera là le ${dateFr(dateOf(n))}.` : 'Hors ligne, le calendrier n’est peut-être pas encore téléchargé.'}</p>
        <div class="col center-col"><a class="btn primary" href="#/jour">Le Coup du jour d’aujourd’hui</a></div></div></div>
  );
  const isToday = n === tn;
  const rated = isToday && !done && replay === 0;
  if (done && replay === 0) return <DailyResultView e={e} r={done} onReplay={() => setReplay(1)} isToday={isToday} />;
  return <DailyPlay key={replay} e={e} rated={rated} isToday={isToday} tn={tn} onReplay={() => setReplay((x) => x + 1)} />;
}

function DailyPlay({ e, rated, isToday, tn, onReplay }: { e: DailyEntry; rated: boolean; isToday: boolean; tn: number; onReplay: () => void }) {
  const line = useMemo(() => e.moves.split(' '), [e.moves]);
  const np = playerMoves(e.moves);
  const [hint, setHint] = useState(0); const [hints, setHints] = useState(0);
  const [reveal, setReveal] = useState(0); const [, setWn] = useState(0);
  const [idx, setIdx] = useState(0);
  const [res, setRes] = useState<DailyResult | null>(null);
  const marks = useRef<Record<number, Cell>>({}); const wrongs = useRef<Record<number, number>>({});
  const T = useRef({ t0: 0, first: 0, hid: [] as Span[], hAt: 0, wrong: null as null | { idx: number; uci: string } });
  useEffect(() => { const v = () => { const t = T.current; if (document.hidden) t.hAt = performance.now(); else if (t.hAt) { t.hid.push([t.hAt, performance.now()]); t.hAt = 0; } }; document.addEventListener('visibilitychange', v); return () => document.removeEventListener('visibilitychange', v); }, []);
  const mark = (k: number, c: Cell) => { if (c === 'r' || marks.current[k] !== 'r') marks.current[k] = c; };
  const k = playerIdx(idx);
  const showMove = () => { mark(k, 'r'); setHint(0); setReveal((x) => x + 1); };
  const finish = () => {
    if (res) return;
    const t = T.current, now = performance.now();
    const grid = gridFrom(np, marks.current); const ms = computeThinkMs(t.t0 || now, now, t.hid); const ok = gridOk(grid);
    const r: DailyResult = { n: e.n, grid, ms, hints, ok, at: Date.now() };
    setRes(r);
    log('puzzle_try', { pid: e.puzzleId, r: e.rating, th: [e.theme], mode: rated ? 'daily' : 'daily-archive', firstMoveMs: t.first ? computeThinkMs(t.t0, t.first, t.hid) : null, totalMs: ms, wrong: t.wrong ?? undefined, hints, shown: grid.includes('r'), ok });
    if (rated) {
      setState((st) => { (st.jour ||= {})[e.n] = r; st.daily[today()] = true; });
      recordPuzzle({ i: e.puzzleId, f: e.fen, m: e.moves, r: e.rating, t: [e.theme] }, ok, 'daily', { daily: { n: e.n, grid, ms: Math.round(ms), hints, rated: true } });
    } else log('daily_played', { id: e.puzzleId, n: e.n, ok, grid, ms: Math.round(ms), hints, rated: false });
  };
  if (res) return <DailyResultView e={e} r={res} onReplay={onReplay} isToday={isToday} fresh rated={rated} />;
  return (
    <div class="page puzzle-session daily-page" data-jour={e.n} data-rated={rated ? '1' : '0'}>
      <div class="game-top"><a class="nb-btn round" href="#/" aria-label="Fermer"><Icon name="close" size={18} stroke={2.5} /></a><div class="gt-title">Coup du jour #{e.n}</div><span class="pill tnum dj-pill" aria-label={`Difficulté ${stars(e.rating)} sur 5`}>★ {stars(e.rating)}/5</span></div>
      <div class="play-grid">
        <MoveTrainer fen={e.fen} line={line} setup hintLevel={hint} revealSignal={reveal} goal={e.theme.startsWith('mate') ? 'mate' : 'puzzle'}
          onProgress={(i) => { setIdx(i); setHint(0); if (i === 1 && !T.current.t0) T.current.t0 = performance.now(); }}
          onPlayed={() => { if (!T.current.first) T.current.first = performance.now(); }}
          onWrong={(i, uci) => { if (!T.current.wrong) T.current.wrong = { idx: i, uci }; const kk = playerIdx(i); const w = (wrongs.current[kk] = (wrongs.current[kk] || 0) + 1); setWn(w + kk * 10); if (w >= 2) { mark(kk, 'r'); setTimeout(() => setReveal((x) => x + 1), 1200); } else mark(kk, 'y'); }}
          onSolved={finish} />
        <aside class="side">
          <p class="dj-goal"><b>{goalText(e)}</b></p>
          <p class="muted small">{rated ? 'Une seule tentative notée. Prends ton temps : le chrono ne compte que quand l’app est ouverte.' : isToday ? 'Rejouer : sans note.' : `Archive du ${dateFr(e.date)} : sans note et sans série.`}</p>
          {!isToday && !getState().jour?.[tn] && <p class="small"><a href="#/jour">Joue aussi celui d’aujourd’hui (#{tn}), noté →</a></p>}
          <div class="dj-progress" aria-label={`Coup ${Math.min(k + 1, np)} sur ${np}`}>{Array.from({ length: np }, (_, j) => <span class={'dj-cell ' + (j < k ? (marks.current[j] || 'g') : j === k ? 'cur' : '')} />)}</div>
          <div class="actionbar">
            {hint < 3 && <button class="tool" onClick={() => { setHint(hint + 1); setHints((h) => h + 1); mark(k, 'y'); }} aria-label={`Indice ${hint + 1} sur 3`}><Icon name="bulb" size={22} />Indice{hint ? ` ${hint + 1}/3` : ''}</button>}
            {(wrongs.current[k] || hint > 0) && <button class="tool" onClick={showMove}><Icon name="eye" size={22} />Montre le coup</button>}
          </div>
        </aside>
      </div>
    </div>
  );
}

function DailyResultView({ e, r, onReplay, isToday, fresh, rated }: { e: DailyEntry; r: DailyResult; onReplay: () => void; isToday: boolean; fresh?: boolean; rated?: boolean }) {
  const official = isToday && (!fresh || rated);
  const [, tick] = useState(0); useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, []);
  const good = [...r.grid].filter((c) => c === 'g').length;
  return (
    <div class="page center-page daily-result" data-jour={e.n}>
      <NavBar back="#/" backLabel="Pour toi" close />
      <div class="dj-head"><span class="dj-num">Coup du jour #{e.n}</span><span class="dj-stars" aria-label={`Difficulté ${stars(e.rating)} sur 5`}>{starStr(e.rating)}</span></div>
      <h1>{r.ok ? (good === r.grid.length ? 'Parfait.' : 'Trouvé.') : 'Bien essayé.'}</h1>
      <Grid g={r.grid} big />
      <p class="dj-stats tnum"><span><Icon name="clock" size={16} /> {fmtTime(r.ms)}</span><span><Icon name="bulb" size={16} /> {r.hints} indice{r.hints > 1 ? 's' : ''}</span><span>{good}/{r.grid.length} du premier coup</span></p>
      {!official && <p class="muted small">{isToday ? 'Partie rejouée : ton résultat noté ne change pas.' : `Archive du ${dateFr(e.date)} : sans note et sans série.`}</p>}
      <div class="col center-col dj-actions">
        {official && <button class="btn primary lg" onClick={() => shareResult(e, r)}><Icon name="share" size={18} />Partager mon résultat</button>}
        {official && <p class="muted small dj-noshare">La grille ne dévoile aucun coup.</p>}
        <button class="btn plain" onClick={onReplay}>Rejouer (sans note)</button>
        <a class="btn plain" href={`#/analysis?fen=${encodeURIComponent(e.fen)}&moves=${encodeURIComponent(e.moves)}`}>Voir la solution analysée</a>
        <a class="btn plain" href="#/jour/archives">Les jours précédents</a>
        <a class="btn" href="#/">Continuer avec mon coach</a>
      </div>
      {isToday && <p class="muted small dj-next">Prochain Coup du jour dans {untilTomorrow()}.</p>}
      <p class="sr-only">{[...r.grid].map((c) => CELL_EMOJI[c as Cell]).join('')}</p>
    </div>
  );
}

function DailyArchive() {
  const s = useStore((x) => x); const tn = todayNumber();
  const list = Array.from({ length: Math.min(tn, 60) }, (_, i) => tn - i);
  return (
    <div class="page"><NavBar back="#/jour" backLabel="Coup du jour" title="Jours précédents" />
      <p class="muted small" style="margin:0 16px 12px">Gratuit, sans note et sans série. Seul le Coup du jour joué le jour même compte.</p>
      <div class="list dj-archive">
        {list.map((n) => { const r = s.jour?.[n]; return (
          <Item href={`#/jour/${n}`} title={`#${n}${n === tn ? ' · aujourd’hui' : ''}`} sub={dateFr(dateOf(n))} value={r ? <Grid g={r.grid} /> : <span class="muted small">à jouer</span>} />
        ); })}
      </div>
    </div>
  );
}
