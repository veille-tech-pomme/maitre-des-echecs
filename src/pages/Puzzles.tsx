import { useEffect, useRef, useState } from 'preact/hooks';
import { MoveTrainer } from '../components/MoveTrainer';
import { LineChart, Progress, toast, LargeTitle, NavBar, Item, Stars } from '../components/ui';
import { Icon } from '../components/Icon';
import { useStore, getState, setState, today, addXp } from '../lib/store';
import { loadPuzzles, dailyPuzzle, type Puzzle } from '../lib/puzzles';
import { pickPuzzle, sequence, findPuzzle, totalCount, offlineStatus, downloadTier, loadIndex, plusEnabled, type BankPuzzle } from '../lib/puzzlebank';
import { recordPuzzle } from '../lib/progress';
import { MAIN_THEMES, themeName, THEME_FR } from '../data/themes';
import { familyFr } from '../data/opening-fr';
import { PUZZLE_PATHS, STAGE_SIZE, STAGE_PASS } from '../data/puzzle-paths';
import { BOTS } from '../data/bots';
import { isDue } from '../lib/srs';
import { markPlanDone } from '../lib/plan';
import { play } from '../lib/sound';
import { Chess } from '../lib/chess';
import { expected } from '../lib/rating';
import { BotAvatar } from '../components/BotAvatar';

const fmt = (n: number) => n.toLocaleString('fr-FR');

function BankCard() {
  const [st, setSt] = useState<Awaited<ReturnType<typeof offlineStatus>> | null>(null);
  const [cnt, setCnt] = useState<Awaited<ReturnType<typeof totalCount>> | null>(null);
  const [dl, setDl] = useState<string | null>(null);
  const refresh = () => { offlineStatus().then(setSt).catch(() => {}); totalCount().then(setCnt).catch(() => {}); };
  useEffect(refresh, []);
  const get = async (tier: 'core' | 'plus') => {
    try { setDl(tier); await downloadTier(tier, (d, t) => setDl(`${tier} ${d}/${t}`)); toast(tier === 'plus' ? 'Pack supplémentaire installé' : 'Puzzles disponibles hors ligne', 'checkCircle'); } catch { toast('Téléchargement interrompu. Vérifie ta connexion.', 'info'); }
    setDl(null); refresh();
  };
  if (!st || !cnt) return null;
  const mb = (b: number) => (b / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' Mo';
  return (
    <section class="card bank">
      <div class="card-head"><span class="it-icon" style="--c:#8E8E93"><Icon name="download" size={18} /></span><div class="grow"><b>{fmt(cnt.available)} puzzles</b><small class="muted">Base ouverte Lichess, vérifiée par Stockfish. Téléchargés à la demande, gardés hors ligne.</small></div></div>
      <div class="bank-row"><span>Cœur : <b>{fmt(cnt.base + cnt.core)}</b> puzzles</span><Progress value={st.core.have / Math.max(1, st.core.total)} /><small>{st.core.have}/{st.core.total}</small>
        {st.core.have < st.core.total && <button class="btn small secondary" disabled={!!dl} onClick={() => get('core')}>{dl?.startsWith('core') ? dl.slice(5) : `Hors ligne (${mb(st.core.bytes)})`}</button>}</div>
      {cnt.plus > 0 && <div class="bank-row"><span>Pack + : <b>{fmt(cnt.plus)}</b> puzzles</span><Progress value={st.plus.have / Math.max(1, st.plus.total)} /><small>{st.plus.have}/{st.plus.total}</small>
        {(!plusEnabled() || st.plus.have < st.plus.total) && <button class="btn small primary" disabled={!!dl} onClick={() => get('plus')}>{dl?.startsWith('plus') ? dl.slice(5) : `Télécharger (${mb(st.plus.bytes)})`}</button>}</div>}
    </section>
  );
}

export function PuzzlesHub() {
  const s = useStore((x) => x);
  const due = Object.values(s.srs).filter((x) => x.kind === 'puzzle' && isDue(x)).length;
  const hist = s.puzzle.history.map((h) => h.r);
  const b = s.training.battle || { w: 0, l: 0 };
  const pathsDone = PUZZLE_PATHS.reduce((a, p) => a + Object.keys(s.training.paths?.[p.id]?.stars || {}).length, 0);
  const pathsTotal = PUZZLE_PATHS.reduce((a, p) => a + p.stages.length, 0);
  const last = s.puzzle.history.slice(-10); const trend = last.length > 1 ? last[last.length - 1].r - last[0].r : 0;
  const [all, setAll] = useState(false);
  const themes = all ? MAIN_THEMES : MAIN_THEMES.slice(0, 8);
  return (
    <div class="page puzzles">
      <LargeTitle title="Puzzles" />
      <a class="card rating-hero" href="#/puzzles/rated">
        <div class="rh-top"><div><small class="muted">Ton classement</small><div class="rh-num tnum">{s.puzzle.rating}</div>{trend !== 0 && <small class={'delta ' + (trend > 0 ? 'up' : 'down')}><Icon name={trend > 0 ? 'up' : 'down'} size={13} stroke={3} />{Math.abs(trend)} sur 10 puzzles</small>}</div>
          <span class="btn primary"><Icon name="playIcon" size={18} />Résoudre</span></div>
        {hist.length > 1 ? <LineChart points={[800, ...hist].slice(-60)} height={72} color="var(--gold)" /> : <p class="muted small">Ton classement évolue à chaque puzzle : réussis-en un pour voir ta courbe.</p>}
        <div class="rh-stats"><span><b class="tnum">{s.puzzle.solved}</b> réussis</span><span><b class="tnum">{s.puzzle.streak}</b> d’affilée</span><span><b class="tnum">{s.puzzle.bestStreak}</b> record</span></div>
      </a>
      <div class="tiles">
        <a class="tile" href="#/puzzles/daily"><span class="tl-icon" style="--c:#0A84FF"><Icon name="calendar" size={20} /></span>{s.daily[today()] && <span class="tl-badge pill ok"><Icon name="check" size={12} stroke={3} />Fait</span>}<b>Du jour</b><small>Un nouveau défi</small></a>
        <a class="tile" href="#/puzzles/rush"><span class="tl-icon" style="--c:#FF9F0A"><Icon name="timer" size={20} /></span><b>Contre la montre</b><small>Record {Math.max(s.rush.best3, s.rush.best5)}</small></a>
        <a class="tile" href="#/puzzles/battle"><span class="tl-icon" style="--c:#FF453A"><Icon name="swords" size={20} /></span><b>Duel</b><small>{b.w} V · {b.l} D</small></a>
        <a class="tile" href="#/review"><span class="tl-icon" style="--c:#5E5CE6"><Icon name="repeat" size={20} /></span>{due > 0 && <span class="tl-badge badge-n">{due}</span>}<b>Révisions</b><small>{due ? `${due} à revoir` : 'À jour'}</small></a>
      </div>
      <div class="list">
        <Item href="#/puzzles/paths" icon="route" color="#30A46C" title="Parcours thématiques" sub="Mats, motifs et finales, étape par étape" value={<span class="tnum">{pathsDone}/{pathsTotal}</span>} />
        <Item href="#/puzzles/custom" icon="sliders" color="#8E8E93" title="Sur mesure" sub="Choisis thème, niveau et ouverture" />
      </div>
      <div class="section-title"><h2>Par thème</h2>{MAIN_THEMES.length > 8 && <button onClick={() => setAll(!all)} aria-expanded={all}>{all ? 'Moins' : 'Tout voir'}</button>}</div>
      <div class="theme-grid">
        {themes.map((t) => { const st = s.themes[t]; const n = st ? st.ok + st.ko : 0; const pct = n ? Math.round((st!.ok / n) * 100) : null; return (
          <a class="theme" href={`#/puzzles/theme/${t}`}><b>{themeName(t)}</b><small>{pct == null ? 'Pas encore essayé' : `${pct} % de réussite`}</small>{pct != null && <Progress value={pct / 100} color={pct >= 70 ? 'var(--green)' : pct >= 45 ? 'var(--orange)' : 'var(--red)'} />}</a>
        ); })}
      </div>
      <BankCard />
    </div>
  );
}

/** Puzzles « sur mesure » : thème, tranche de classement, ouverture. */
export function PuzzleCustom() {
  const s = useStore((x) => x);
  const [themes, setThemes] = useState<string[]>([]); const [openings, setOpenings] = useState<{ id: string; n: number }[]>([]);
  const [theme, setTheme] = useState(''); const [opening, setOpening] = useState('');
  const [min, setMin] = useState(Math.max(400, s.puzzle.rating - 200)); const [max, setMax] = useState(s.puzzle.rating + 200);
  useEffect(() => { loadIndex().then((idx) => {
    setThemes(idx.themes.filter((t) => !['short', 'long', 'veryLong', 'oneMove'].includes(t)).sort((a, b) => themeName(a).localeCompare(themeName(b), 'fr')));
    const n: Record<string, number> = {}; for (const tier of Object.values(idx.tiers)) for (const b of Object.values(tier.bands)) for (const [k, v] of Object.entries(b.o)) n[k] = (n[k] || 0) + v;
    setOpenings(idx.openings.map((id, i) => ({ id, n: n[i + 1] || 0 })).filter((o) => o.n >= 30).sort((a, b) => familyFr(a.id).localeCompare(familyFr(b.id), 'fr')));
  }); }, []);
  const q = new URLSearchParams({ min: String(min), max: String(max), ...(theme ? { theme } : {}), ...(opening ? { opening } : {}) });
  return (
    <div class="page">
      <NavBar back="#/puzzles" backLabel="Puzzles" /><h1 class="page-title">Sur mesure</h1>
      <div class="card">
        <label>Thème<select value={theme} onChange={(e) => setTheme((e.target as HTMLSelectElement).value)}><option value="">Tous les thèmes</option>{themes.map((t) => <option value={t}>{themeName(t)}</option>)}</select></label>
        <label>Ouverture<select value={opening} onChange={(e) => setOpening((e.target as HTMLSelectElement).value)}><option value="">Toutes les ouvertures</option>{openings.map((o) => <option value={o.id}>{familyFr(o.id)} ({fmt(o.n)})</option>)}</select></label>
        <label>Classement minimum : <b>{min}</b><input type="range" min={400} max={2900} step={50} value={min} onInput={(e) => { const v = +(e.target as HTMLInputElement).value; setMin(v); if (v > max - 100) setMax(v + 100); }} /></label>
        <label>Classement maximum : <b>{max}</b><input type="range" min={500} max={3000} step={50} value={max} onInput={(e) => { const v = +(e.target as HTMLInputElement).value; setMax(v); if (v < min + 100) setMin(v - 100); }} /></label>
        <div class="chips">{[['Débutant', 400, 1000], ['Club', 1000, 1600], ['Fort', 1600, 2100], ['Expert', 2100, 2600], ['Maître', 2500, 3000]].map(([l, a, b]) => <button class="chip" onClick={() => { setMin(a as number); setMax(b as number); }}>{l}</button>)}</div>
        <a class="btn primary lg" href={`#/puzzles/custom/go?${q}`}>C’est parti</a>
        <p class="muted small">Les puzzles sur mesure ne modifient pas ton classement.</p>
      </div>
    </div>
  );
}

type Mode = 'rated' | 'theme' | 'daily' | 'review' | 'custom';
export function PuzzleSession({ mode, theme, query }: { mode: Mode; theme?: string; query?: URLSearchParams }) {
  const [p, setP] = useState<BankPuzzle | Puzzle | null | undefined>(undefined);
  const [failed, setFailed] = useState(false); const [solved, setSolved] = useState(false); const [delta, setDelta] = useState<number | null>(null);
  const [hint, setHint] = useState(0); const [sol, setSol] = useState(0); const recorded = useRef(false); const [count, setCount] = useState(0);
  const [why, setWhy] = useState<{ headline: string; why: string; plan?: string; tip?: string } | null>(null); const whyFor = useRef('');
  const s = useStore((x) => x);
  const custom = mode === 'custom' && query ? { theme: query.get('theme') || undefined, opening: query.get('opening') || undefined, min: +(query.get('min') || 0) || undefined, max: +(query.get('max') || 0) || undefined } : null;
  const next = async () => {
    recorded.current = false; setFailed(false); setSolved(false); setDelta(null); setHint(0); setSol(0); setP(undefined); setWhy(null); whyFor.current = '';
    const st = getState();
    try {
      if (mode === 'daily') setP(dailyPuzzle(await loadPuzzles()));
      else if (mode === 'review') { const due = Object.values(st.srs).filter((x) => x.kind === 'puzzle' && isDue(x)).sort((a, b) => a.due - b.due); setP(due[0] ? await findPuzzle(due[0].id.slice(2)) : null); }
      else if (custom) setP(await pickPuzzle({ rating: ((custom.min || 400) + (custom.max || 3000)) / 2, ...custom, seen: st.puzzle.seen }));
      else setP(await pickPuzzle({ rating: st.puzzle.rating, theme, seen: st.puzzle.seen }));
    } catch { setP(null); }
  };
  useEffect(() => { next(); }, [theme, mode, query?.toString()]);
  if (p === undefined) return <div class="page"><div class="loading" aria-label="Chargement du puzzle" /></div>;
  if (!p) return <div class="page"><NavBar back="#/puzzles" backLabel="Puzzles" close /><div class="empty"><div class="empty-icon"><Icon name={mode === 'review' ? 'checkCircle' : 'search'} size={30} /></div><h3>{mode === 'review' ? 'Rien à réviser pour l’instant' : 'Aucun puzzle trouvé'}</h3><p>{mode === 'review' ? 'Les puzzles ratés reviennent ici au bon moment (répétition espacée).' : 'Élargis la tranche de classement ou change de thème. Hors ligne, seuls les packs déjà téléchargés sont disponibles.'}</p><a class="btn primary" href="#/puzzles/rated">Puzzles classés</a></div></div>;
  const rated = mode === 'rated' || mode === 'theme' || mode === 'daily';
  const record = (ok: boolean) => { if (recorded.current) return; recorded.current = true; const d = recordPuzzle(p, ok, mode === 'custom' ? 'rush' : mode === 'review' ? 'review' : mode); setDelta(rated ? d : null); setCount((c) => c + 1); if (count + 1 >= 5) setState((st) => markPlanDone(st, theme ? 'weak:' + theme : 'puzzles')); if (mode === 'review') setState((st) => markPlanDone(st, 'srs')); };
  const userWhite = new Chess(p.f).turn() === 'b';
  const title = mode === 'daily' ? 'Puzzle du jour' : mode === 'review' ? 'Révision' : mode === 'theme' ? themeName(theme!) : mode === 'custom' ? (custom?.theme ? themeName(custom.theme) : 'Sur mesure') : 'Puzzles classés';
  const op = (p as BankPuzzle).o;
  return (
    <div class="page puzzle-session">
      <div class="game-top"><a class="nb-btn round" href={mode === 'custom' ? '#/puzzles/custom' : '#/puzzles'} aria-label="Fermer"><Icon name="close" size={18} stroke={2.5} /></a><div class="gt-title">{title}</div><span class="pill tnum">{mode === 'review' ? `${Object.values(s.srs).filter((x) => x.kind === 'puzzle' && isDue(x)).length} restants` : mode === 'custom' ? `${custom?.min ?? ''}–${custom?.max ?? ''}` : s.puzzle.rating}</span></div>
      <div class="play-grid">
        <MoveTrainer key={p.i + sol} fen={p.f} line={p.m.split(' ')} setup hintLevel={hint} showSolutionSignal={sol}
          onMistake={() => { if (!failed) { setFailed(true); record(false); } }}
          onWrong={(idx, uci, fb) => { const key = p.i + idx + uci; whyFor.current = key; import('../coach/client').then((cc) => cc.explainPuzzleMiss(fb, uci, p.m.split(' ').slice(idx), cc.currentElo())).then((ex) => { if (whyFor.current === key) setWhy({ headline: ex.headline, why: ex.why, plan: ex.plan, tip: ex.tip }); }).catch(() => {}); }}
          onSolved={() => { setSolved(true); if (!failed) record(true); }} />
        <aside class="side">
          {(mode === 'daily' || mode === 'custom' || solved || failed) && <p class="muted small puzzle-meta">Difficulté {p.r}</p>}
          {delta != null && <p class={'delta big ' + (delta >= 0 ? 'up' : 'down')}><Icon name={delta >= 0 ? 'up' : 'down'} size={18} stroke={3} />{Math.abs(delta)} <span class="muted">· {s.puzzle.rating}</span></p>}
          {(solved || failed) && <p class="muted small">Thèmes : {p.t.filter((t) => THEME_FR[t] && !['endgame', 'middlegame', 'opening', 'short', 'long', 'veryLong', 'oneMove', 'crushing', 'advantage'].includes(t)).map(themeName).join(', ') || '—'}{op ? ` · ${familyFr(op)}` : ''}</p>}
          {why && (
            <div class="coach-box cls-mistake" aria-live="polite">
              <div class="coach-head"><Icon name="brainCircuit" size={18} /><b>Pourquoi ça ne marche pas</b></div>
              <h4>{why.headline}</h4><p>{why.why}</p>
              {solved && why.plan && <p class="cb-line">{why.plan}</p>}
              {!solved && why.tip && <p class="cb-tip"><Icon name="bulb" size={16} />{why.tip}</p>}
            </div>
          )}
          {failed && !solved && <p class="muted small">Ce puzzle reviendra dans tes révisions. Tu peux continuer à chercher.</p>}
          {(solved || failed) && mode !== 'daily' && <button class="btn primary lg next-btn" onClick={() => next()}>Puzzle suivant<Icon name="right" size={18} stroke={2.5} /></button>}
          {mode === 'daily' && solved && <a class="btn primary lg next-btn" href="#/puzzles/rated">Puzzles classés<Icon name="right" size={18} stroke={2.5} /></a>}
          <div class="actionbar">
            {!solved && <button class="tool" onClick={() => { setHint(hint + 1); if (!failed && hint >= 1) { setFailed(true); record(false); } }}><Icon name="bulb" size={22} />Indice{hint ? ` ${hint}` : ''}</button>}
            {!solved && <button class="tool" onClick={() => { if (!failed) { setFailed(true); record(false); } setSol((x) => x + 1); setSolved(true); }}><Icon name="eye" size={22} />Solution</button>}
            {(solved || failed) && <a class="tool" href={`#/analysis?fen=${encodeURIComponent(p.f)}&moves=${encodeURIComponent(p.m)}`}><Icon name="microscope" size={22} />Analyser</a>}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function Rush() {
  const s = useStore((x) => x);
  const [cfg, setCfg] = useState<null | { mode: '3' | '5' | 'survie' }>(null);
  const [seq, setSeq] = useState<BankPuzzle[]>([]); const [k, setK] = useState(0); const [score, setScore] = useState(0); const [strikes, setStrikes] = useState(0);
  const [left, setLeft] = useState(0); const [over, setOver] = useState(false); const [results, setResults] = useState<boolean[]>([]); const [loading, setLoading] = useState(false);
  const start = async (mode: '3' | '5' | 'survie') => { setLoading(true); const q = await sequence(70); setLoading(false); if (!q.length) { toast('Puzzles indisponibles hors ligne', 'info'); return; } setSeq(q); setK(0); setScore(0); setStrikes(0); setResults([]); setOver(false); setLeft(mode === '3' ? 180 : mode === '5' ? 300 : 0); setCfg({ mode }); };
  useEffect(() => { if (!cfg || cfg.mode === 'survie' || over) return; const t = setInterval(() => setLeft((l) => { if (l <= 1) { clearInterval(t); finish(); return 0; } if (l <= 11) play('tick'); return l - 1; }), 1000); return () => clearInterval(t); }, [cfg, over]);
  const finish = () => { setOver(true); play('win'); setState((st) => { st.rush.runs++; if (cfg?.mode === '3') st.rush.best3 = Math.max(st.rush.best3, scoreRef.current); else if (cfg?.mode === '5') st.rush.best5 = Math.max(st.rush.best5, scoreRef.current); else st.rush.survival = Math.max(st.rush.survival, scoreRef.current); }); };
  const scoreRef = useRef(0); scoreRef.current = score;
  if (!cfg) return (
    <div class="page">
      <NavBar back="#/puzzles" backLabel="Puzzles" />
      <div class="feature-head"><span class="fh-icon" style="--c:#FF9F0A"><Icon name="timer" size={30} /></span><h1>Contre la montre</h1><p class="muted">Des puzzles de plus en plus durs. Trois erreurs et c’est fini.</p></div>
      {loading && <div class="loading" aria-label="Préparation" />}
      <div class="list">
        <Item onClick={() => start('3')} icon="bolt" color="#FF9F0A" title="3 minutes" sub="Le format court" value={<span class="tnum">Record {s.rush.best3}</span>} large />
        <Item onClick={() => start('5')} icon="timer" color="#0A84FF" title="5 minutes" sub="Plus de temps pour calculer" value={<span class="tnum">Record {s.rush.best5}</span>} large />
        <Item onClick={() => start('survie')} icon="heart" color="#FF453A" title="Survie" sub="Sans chrono, jusqu’à trois erreurs" value={<span class="tnum">Record {s.rush.survival}</span>} large />
      </div>
    </div>
  );
  const p = seq[k];
  if (over || !p) return (
    <div class="page center-page">
      <div class="celebrate"><Icon name="flag" size={52} stroke={1.8} /></div><h1>{score} puzzle{score > 1 ? 's' : ''}</h1>
      <p class="muted">{score >= Math.max(cfg.mode === '3' ? s.rush.best3 : cfg.mode === '5' ? s.rush.best5 : s.rush.survival, 1) ? 'Nouveau record.' : 'Bien joué.'}</p>
      <div class="rush-dots">{results.map((r) => <span class={r ? 'ok' : 'ko'}><Icon name={r ? 'check' : 'close'} size={12} stroke={3} /></span>)}</div>
      <div class="col center-col"><button class="btn primary lg" onClick={() => start(cfg.mode)}>Rejouer</button><a class="btn plain" href="#/puzzles">Retour aux puzzles</a></div>
    </div>
  );
  const strike = () => { const n = strikes + 1; setStrikes(n); setResults((r) => [...r, false]); recordPuzzle(p, false, 'rush'); if (n >= 3) finish(); else setTimeout(() => setK((x) => x + 1), 700); };
  return (
    <div class="page puzzle-session">
      <div class="game-top rush-top"><a class="nb-btn round" href="#/puzzles/rush" onClick={() => setCfg(null)} aria-label="Arrêter"><Icon name="close" size={18} stroke={2.5} /></a>
        <div class="gt-title"><span class={'timer-big tnum ' + (cfg.mode !== 'survie' && left <= 10 ? 'low' : '')}>{cfg.mode === 'survie' ? 'Survie' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</span></div>
        <span class="strikes" aria-label={`${strikes} erreur${strikes > 1 ? 's' : ''} sur 3`}>{[0, 1, 2].map((i) => <span class={i < strikes ? 'x on' : 'x'}><Icon name="close" size={12} stroke={3.5} /></span>)}</span></div>
      <div class="rush-score"><b class="tnum">{score}</b><small>résolus</small></div>
      <MoveTrainer key={p.i} fen={p.f} line={p.m.split(' ')} setup onMistake={strike} onSolved={() => { setScore((x) => x + 1); setResults((r) => [...r, true]); recordPuzzle(p, true, 'rush'); setTimeout(() => setK((x) => x + 1), 400); }} />
      <div class="rush-dots">{results.slice(-20).map((r) => <span class={r ? 'ok' : 'ko'}><Icon name={r ? 'check' : 'close'} size={12} stroke={3} /></span>)}</div>
    </div>
  );
}

/** Duel de puzzles (style « Puzzle Battle ») contre un adversaire fantôme : mêmes puzzles, 3 minutes, 3 erreurs max. */
export function Battle() {
  const s = useStore((x) => x);
  const [opp, setOpp] = useState<typeof BOTS[number] | null>(null);
  const [seq, setSeq] = useState<BankPuzzle[]>([]); const [k, setK] = useState(0); const [me, setMe] = useState({ score: 0, strikes: 0 });
  const [ghost, setGhost] = useState({ score: 0, strikes: 0, k: 0 }); const [left, setLeft] = useState(180); const [over, setOver] = useState(false);
  const meRef = useRef(me); meRef.current = me; const ghostRef = useRef(ghost); ghostRef.current = ghost; const overRef = useRef(false);
  const start = async (b: typeof BOTS[number]) => {
    const st = Math.max(400, Math.min(s.puzzle.rating, b.elo) - 450);
    const q = await sequence(60, st, 40, 6); if (!q.length) { toast('Puzzles indisponibles hors ligne', 'info'); return; }
    setSeq(q); setK(0); setMe({ score: 0, strikes: 0 }); setGhost({ score: 0, strikes: 0, k: 0 }); setLeft(180); setOver(false); overRef.current = false; setOpp(b);
  };
  const end = () => {
    if (overRef.current) return; overRef.current = true; setOver(true);
    const win = meRef.current.score > ghostRef.current.score, draw = meRef.current.score === ghostRef.current.score;
    play(win ? 'win' : draw ? 'notify' : 'lose');
    setState((st) => { const b = (st.training.battle ||= { w: 0, l: 0, d: 0, best: 0 }); if (win) b.w++; else if (draw) b.d = (b.d || 0) + 1; else b.l++; b.best = Math.max(b.best || 0, meRef.current.score); });
    if (win) addXp(30, 'Duel gagné');
  };
  // chronomètre
  useEffect(() => { if (!opp || over) return; const t = setInterval(() => setLeft((l) => { if (l <= 1) { clearInterval(t); end(); return 0; } if (l <= 6) play('tick'); return l - 1; }), 1000); return () => clearInterval(t); }, [opp, over]);
  // l'adversaire fantôme résout les puzzles à son rythme, selon son Elo
  useEffect(() => {
    if (!opp || over) return; let alive = true;
    const step = () => {
      const g = ghostRef.current; const p = seq[g.k]; if (!p || !alive || overRef.current) return;
      const pOk = Math.min(0.97, Math.max(0.08, expected(opp.elo + 150, p.r)));
      const moves = Math.ceil(p.m.split(' ').length / 2); const think = (2.5 + moves * 2.2) * (1.6 - Math.min(0.9, opp.elo / 3000)) * (0.7 + Math.random() * 0.6);
      setTimeout(() => {
        if (!alive || overRef.current) return;
        const ok = Math.random() < pOk; const n = { score: g.score + (ok ? 1 : 0), strikes: g.strikes + (ok ? 0 : 1), k: g.k + 1 };
        setGhost(n); ghostRef.current = n; if (n.strikes >= 3 && meRef.current.strikes >= 3) end(); else if (n.strikes < 3) step();
      }, think * 1000);
    };
    step(); return () => { alive = false; };
  }, [opp, over, seq]);
  if (!opp) return (
    <div class="page">
      <NavBar back="#/puzzles" backLabel="Puzzles" />
      <div class="feature-head"><span class="fh-icon" style="--c:#FF453A"><Icon name="swords" size={30} /></span><h1>Duel</h1><p class="muted">Les mêmes puzzles que ton adversaire, 3 minutes. Le meilleur score gagne, trois erreurs et tu es éliminé.</p></div>
      <div class="section-label">Choisis ton adversaire</div>
      <div class="bot-grid">{BOTS.filter((b) => b.elo <= 2800).map((b) => <button class="bot-card" style={{ '--c': b.color } as any} onClick={() => start(b)}><BotAvatar bot={b} size={64} /><b>{b.name}</b><span class="elo">{b.elo}</span></button>)}</div>
    </div>
  );
  const p = seq[k]; const meOut = me.strikes >= 3;
  if (over) {
    const win = me.score > ghost.score, draw = me.score === ghost.score;
    return (
      <div class="page center-page">
        <div class="celebrate"><Icon name={win ? 'trophy' : draw ? 'hand' : 'flag'} size={52} stroke={1.8} /></div><h1>{win ? 'Victoire' : draw ? 'Égalité' : 'Défaite'}</h1>
        <div class="battle-score"><div><b>{me.score}</b><small>Toi</small></div><span>—</span><div><b>{ghost.score}</b><small>{opp.name}</small></div></div>
        <div class="col center-col"><button class="btn primary lg" onClick={() => start(opp)}>Revanche</button><button class="btn plain" onClick={() => setOpp(null)}>Changer d’adversaire</button></div>
      </div>
    );
  }
  const mine = (ok: boolean) => {
    const n = { score: me.score + (ok ? 1 : 0), strikes: me.strikes + (ok ? 0 : 1) }; setMe(n); meRef.current = n; recordPuzzle(p, ok, 'rush');
    if (n.strikes >= 3) { if (ghostRef.current.strikes >= 3 || ghostRef.current.score > n.score) end(); } else setTimeout(() => setK((x) => x + 1), ok ? 350 : 700);
  };
  return (
    <div class="page puzzle-session">
      <div class="battle-bar">
        <div class="bb me"><b>Toi</b><span class="bb-score">{me.score}</span><span class="strikes">{[0, 1, 2].map((i) => <span class={i < me.strikes ? 'x on' : 'x'}><Icon name="close" size={10} stroke={3.5} /></span>)}</span></div>
        <span class="pill">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
        <div class="bb opp"><BotAvatar bot={opp} size={28} /><b>{opp.name}</b><span class="bb-score">{ghost.score}</span><span class="strikes">{[0, 1, 2].map((i) => <span class={i < ghost.strikes ? 'x on' : 'x'}><Icon name="close" size={10} stroke={3.5} /></span>)}</span></div>
      </div>
      {meOut ? <div class="empty"><div class="empty-icon"><Icon name="hourglass" size={30} /></div><h3>Tu es éliminé</h3><p>{opp.name} continue. Score à battre : {me.score}</p><button class="btn secondary" onClick={end}>Terminer</button></div>
        : p && <MoveTrainer key={p.i} fen={p.f} line={p.m.split(' ')} setup onMistake={() => mine(false)} onSolved={() => mine(true)} />}
    </div>
  );
}

/** Parcours de puzzles thématiques (mat en 1/2/3, motifs tactiques, finales). */
export function PuzzlePaths() {
  const s = useStore((x) => x);
  const groups = [...new Set(PUZZLE_PATHS.map((p) => p.group))];
  return (
    <div class="page">
      <NavBar back="#/puzzles" backLabel="Puzzles" />
      <h1 class="page-title">Parcours</h1>
      <p class="muted page-sub">{STAGE_SIZE} puzzles par étape, {STAGE_PASS} réussites pour passer à la suivante.</p>
      {groups.map((g) => (
        <section><div class="section-label">{g}</div><div class="list">
          {PUZZLE_PATHS.filter((p) => p.group === g).map((p) => { const pr = s.training.paths?.[p.id]; const done = Object.keys(pr?.stars || {}).length;
            return <Item href={`#/puzzles/paths/${p.id}`} icon={done === p.stages.length ? 'checkCircle' : 'route'} color={done === p.stages.length ? 'var(--green)' : '#30A46C'} title={p.title} sub={p.desc} value={<span class="tnum">{done}/{p.stages.length}</span>} />; })}
        </div></section>
      ))}
    </div>
  );
}
export function PuzzlePath({ id }: { id: string }) {
  const path = PUZZLE_PATHS.find((p) => p.id === id); const s = useStore((x) => x);
  const [stage, setStage] = useState<number | null>(null); const [list, setList] = useState<BankPuzzle[]>([]); const [k, setK] = useState(0); const [res, setRes] = useState<boolean[]>([]);
  if (!path) return <div class="page"><NavBar back="#/puzzles/paths" backLabel="Parcours" /><p>Parcours introuvable.</p></div>;
  const pr = s.training.paths?.[id] || { stars: {} };
  const unlocked = (i: number) => i === 0 || pr.stars[i - 1] != null;
  const begin = async (i: number) => {
    const st = path.stages[i]; const out: BankPuzzle[] = []; const seen = [...getState().puzzle.seen];
    for (let n = 0; n < STAGE_SIZE; n++) {
      const theme = path.themes[n % path.themes.length];
      const p = await pickPuzzle({ rating: st.min + ((st.max - st.min) * n) / STAGE_SIZE, min: st.min, max: st.max, theme, seen: [...seen, ...out.map((x) => x.i)] });
      if (p) out.push(p);
    }
    if (!out.length) { toast('Puzzles indisponibles hors ligne', 'info'); return; }
    setList(out); setK(0); setRes([]); setStage(i);
  };
  if (stage != null) {
    const p = list[k];
    if (!p) {
      const ok = res.filter(Boolean).length; const pass = ok >= Math.min(STAGE_PASS, list.length - 1); const stars = ok >= list.length ? 3 : ok >= list.length - 1 ? 2 : 1;
      if (pass && (pr.stars[stage] ?? 0) < stars) setState((st) => { const t = ((st.training.paths ||= {})[id] ||= { stars: {} }); t.stars[stage] = Math.max(t.stars[stage] || 0, stars); });
      return (
        <div class="page center-page">
          <div class="celebrate"><Icon name={pass ? 'trophy' : 'dumbbell'} size={52} stroke={1.8} /></div><h1>{ok} sur {list.length}</h1>
          {pass && <div class="stars-big"><Stars n={stars} size={30} /></div>}
          <p class="muted">{pass ? `Étape ${stage + 1} validée.` : `Il faut ${STAGE_PASS} réussites pour valider. Réessaie.`}</p>
          <div class="col center-col">{pass && stage + 1 < path.stages.length && <button class="btn primary lg" onClick={() => begin(stage + 1)}>Étape suivante</button>}<button class={'btn ' + (pass ? 'secondary' : 'primary lg')} onClick={() => begin(stage)}>Recommencer</button><button class="btn plain" onClick={() => setStage(null)}>Retour au parcours</button></div>
        </div>
      );
    }
    return (
      <div class="page puzzle-session">
        <div class="game-top"><button class="nb-btn round" onClick={() => setStage(null)} aria-label="Fermer"><Icon name="close" size={18} stroke={2.5} /></button><div class="gt-title">{path.title} · étape {stage + 1}</div><span class="pill tnum">{k + 1}/{list.length}</span></div>
        <MoveTrainer key={p.i} fen={p.f} line={p.m.split(' ')} setup onMistake={() => { if (res.length === k) { setRes((r) => [...r, false]); recordPuzzle(p, false, 'theme'); } }}
          onSolved={() => { if (res.length === k) { setRes((r) => [...r, true]); recordPuzzle(p, true, 'theme'); } setTimeout(() => setK((x) => x + 1), 600); }} />
        {res.length > k && !res[k] && <button class="btn primary lg next-btn" onClick={() => setK((x) => x + 1)}>Puzzle suivant</button>}
        <div class="rush-dots">{res.map((r) => <span class={r ? 'ok' : 'ko'}><Icon name={r ? 'check' : 'close'} size={12} stroke={3} /></span>)}</div>
      </div>
    );
  }
  return (
    <div class="page">
      <NavBar back="#/puzzles/paths" backLabel="Parcours" /><h1 class="page-title">{path.title}</h1><p class="muted page-sub">{path.desc}</p>
      <ol class="path" style="--c:#30A46C">{path.stages.map((st, i) => { const un = unlocked(i); const stars = pr.stars[i]; const cur = un && stars == null;
        return <li class={'node ' + (stars != null ? 'done' : un ? 'open' : 'locked') + (cur ? ' current' : '')}><a href={un ? undefined : undefined} role="button" tabIndex={un ? 0 : -1} aria-disabled={!un ? 'true' : undefined} onClick={() => un && begin(i)} onKeyDown={(e) => { if (un && (e.key === 'Enter' || e.key === ' ')) begin(i); }}>
          <span class="node-icon">{stars != null ? <Icon name="check" size={20} stroke={3} /> : un ? <b class="tnum">{i + 1}</b> : <Icon name="lock" size={17} />}</span><span class="node-text"><b>Étape {i + 1}</b><small>Puzzles {st.min}–{st.max}</small></span><span class="node-meta">{stars != null && <Stars n={stars} size={12} />}</span></a></li>; })}</ol>
    </div>
  );
}
