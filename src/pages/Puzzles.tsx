import { useEffect, useRef, useState } from 'preact/hooks';
import { MoveTrainer } from '../components/MoveTrainer';
import { LineChart, Ring, Progress, toast } from '../components/ui';
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
    try { setDl(tier); await downloadTier(tier, (d, t) => setDl(`${tier} ${d}/${t}`)); toast(tier === 'plus' ? 'Pack supplémentaire installé' : 'Puzzles disponibles hors ligne', '✅'); } catch { toast('Téléchargement interrompu (connexion ?)', '⚠️'); }
    setDl(null); refresh();
  };
  if (!st || !cnt) return null;
  const mb = (b: number) => (b / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' Mo';
  return (
    <section class="card bank">
      <h2>📦 Banque de puzzles · {fmt(cnt.available)} disponibles</h2>
      <p class="muted small">Base ouverte Lichess (domaine public), chaque solution vérifiée par Stockfish. Les puzzles se téléchargent par tranche de niveau quand tu en as besoin, puis restent sur ton appareil.</p>
      <div class="bank-row"><span>Cœur : <b>{fmt(cnt.base + cnt.core)}</b> puzzles</span><Progress value={st.core.have / Math.max(1, st.core.total)} /><small>{st.core.have}/{st.core.total}</small>
        {st.core.have < st.core.total && <button class="btn small ghost" disabled={!!dl} onClick={() => get('core')}>{dl?.startsWith('core') ? dl.slice(5) : `Hors ligne (${mb(st.core.bytes)})`}</button>}</div>
      {cnt.plus > 0 && <div class="bank-row"><span>Pack + : <b>{fmt(cnt.plus)}</b> puzzles</span><Progress value={st.plus.have / Math.max(1, st.plus.total)} /><small>{st.plus.have}/{st.plus.total}</small>
        {(!plusEnabled() || st.plus.have < st.plus.total) && <button class="btn small primary" disabled={!!dl} onClick={() => get('plus')}>{dl?.startsWith('plus') ? dl.slice(5) : `Télécharger plus de puzzles (${mb(st.plus.bytes)})`}</button>}</div>}
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
  return (
    <div class="page puzzles">
      <h1>Puzzles</h1>
      <div class="grid2">
        <div class="card">
          <small class="muted">Ton classement</small>
          <div class="stat-big">{s.puzzle.rating}</div>
          <LineChart points={hist.length ? [800, ...hist].slice(-60) : []} height={90} />
          <small class="muted">{s.puzzle.solved} réussis · {s.puzzle.failed} ratés · série en cours {s.puzzle.streak}</small>
        </div>
        <div class="mode-grid">
          <a class="mode" href="#/puzzles/rated"><span>🧩</span><b>Classé</b><small>S’adapte à ton niveau</small></a>
          <a class="mode" href="#/puzzles/daily"><span>📅</span><b>Du jour</b><small>{s.daily[today()] ? 'Réussi ✓' : 'Nouveau défi'}</small></a>
          <a class="mode" href="#/puzzles/rush"><span>⏱️</span><b>Contre la montre</b><small>Record {Math.max(s.rush.best3, s.rush.best5)}</small></a>
          <a class="mode" href="#/puzzles/battle"><span>⚔️</span><b>Duel</b><small>{b.w} victoires · {b.l} défaites</small></a>
          <a class="mode" href="#/puzzles/paths"><span>🗺️</span><b>Parcours</b><small>{pathsDone}/{pathsTotal} étapes</small></a>
          <a class="mode" href="#/puzzles/custom"><span>🎛️</span><b>Sur mesure</b><small>Thème, niveau, ouverture</small></a>
          <a class="mode" href="#/review"><span>🔁</span><b>Révisions</b><small>{due ? `${due} à revoir` : 'À jour'}</small></a>
        </div>
      </div>
      <BankCard />
      <h2>Par thème</h2>
      <div class="theme-grid">
        {MAIN_THEMES.map((t) => { const st = s.themes[t]; const n = st ? st.ok + st.ko : 0; return (
          <a class="theme" href={`#/puzzles/theme/${t}`}><b>{themeName(t)}</b>{n > 0 ? <Ring value={st!.ok / n} size={34} label={<small>{Math.round((st!.ok / n) * 100)}</small>} /> : <small class="muted">—</small>}</a>
        ); })}
      </div>
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
      <a class="back" href="#/puzzles">‹ Puzzles</a><h1>🎛️ Puzzles sur mesure</h1>
      <div class="card">
        <label>Thème<select value={theme} onChange={(e) => setTheme((e.target as HTMLSelectElement).value)}><option value="">Tous les thèmes</option>{themes.map((t) => <option value={t}>{themeName(t)}</option>)}</select></label>
        <label>Ouverture<select value={opening} onChange={(e) => setOpening((e.target as HTMLSelectElement).value)}><option value="">Toutes les ouvertures</option>{openings.map((o) => <option value={o.id}>{familyFr(o.id)} ({fmt(o.n)})</option>)}</select></label>
        <label>Classement minimum : <b>{min}</b><input type="range" min={400} max={2900} step={50} value={min} onInput={(e) => { const v = +(e.target as HTMLInputElement).value; setMin(v); if (v > max - 100) setMax(v + 100); }} /></label>
        <label>Classement maximum : <b>{max}</b><input type="range" min={500} max={3000} step={50} value={max} onInput={(e) => { const v = +(e.target as HTMLInputElement).value; setMax(v); if (v < min + 100) setMin(v - 100); }} /></label>
        <div class="chips">{[['Débutant', 400, 1000], ['Club', 1000, 1600], ['Fort', 1600, 2100], ['Expert', 2100, 2600], ['Maître', 2500, 3000]].map(([l, a, b]) => <button class="chip" onClick={() => { setMin(a as number); setMax(b as number); }}>{l}</button>)}</div>
        <a class="btn primary big" href={`#/puzzles/custom/go?${q}`}>C’est parti ›</a>
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
  const s = useStore((x) => x);
  const custom = mode === 'custom' && query ? { theme: query.get('theme') || undefined, opening: query.get('opening') || undefined, min: +(query.get('min') || 0) || undefined, max: +(query.get('max') || 0) || undefined } : null;
  const next = async () => {
    recorded.current = false; setFailed(false); setSolved(false); setDelta(null); setHint(0); setSol(0); setP(undefined);
    const st = getState();
    try {
      if (mode === 'daily') setP(dailyPuzzle(await loadPuzzles()));
      else if (mode === 'review') { const due = Object.values(st.srs).filter((x) => x.kind === 'puzzle' && isDue(x)).sort((a, b) => a.due - b.due); setP(due[0] ? await findPuzzle(due[0].id.slice(2)) : null); }
      else if (custom) setP(await pickPuzzle({ rating: ((custom.min || 400) + (custom.max || 3000)) / 2, ...custom, seen: st.puzzle.seen }));
      else setP(await pickPuzzle({ rating: st.puzzle.rating, theme, seen: st.puzzle.seen }));
    } catch { setP(null); }
  };
  useEffect(() => { next(); }, [theme, mode, query?.toString()]);
  if (p === undefined) return <div class="page"><div class="loading">Chargement du puzzle…</div></div>;
  if (!p) return <div class="page"><a class="back" href="#/puzzles">‹ Puzzles</a><div class="empty"><div class="empty-icon">{mode === 'review' ? '✅' : '🔍'}</div><h3>{mode === 'review' ? 'Rien à réviser pour l’instant' : 'Aucun puzzle trouvé'}</h3><p>{mode === 'review' ? 'Les puzzles ratés reviennent ici au bon moment (répétition espacée).' : 'Élargis la tranche de classement ou change de thème. Hors ligne, seuls les packs déjà téléchargés sont disponibles.'}</p><a class="btn primary" href="#/puzzles/rated">Puzzles classés</a></div></div>;
  const rated = mode === 'rated' || mode === 'theme' || mode === 'daily';
  const record = (ok: boolean) => { if (recorded.current) return; recorded.current = true; const d = recordPuzzle(p, ok, mode === 'custom' ? 'rush' : mode === 'review' ? 'review' : mode); setDelta(rated ? d : null); setCount((c) => c + 1); if (count + 1 >= 5) setState((st) => markPlanDone(st, theme ? 'weak:' + theme : 'puzzles')); if (mode === 'review') setState((st) => markPlanDone(st, 'srs')); };
  const userWhite = new Chess(p.f).turn() === 'b';
  const title = mode === 'daily' ? 'Puzzle du jour' : mode === 'review' ? 'Révision' : mode === 'theme' ? themeName(theme!) : mode === 'custom' ? (custom?.theme ? themeName(custom.theme) : 'Sur mesure') : 'Puzzles classés';
  const op = (p as BankPuzzle).o;
  return (
    <div class="page puzzle-session">
      <div class="session-head"><a class="back" href={mode === 'custom' ? '#/puzzles/custom' : '#/puzzles'}>‹</a><h1>{title}</h1><span class="pill">{mode === 'review' ? `${Object.values(s.srs).filter((x) => x.kind === 'puzzle' && isDue(x)).length} restants` : mode === 'custom' ? `${custom?.min ?? ''}–${custom?.max ?? ''}` : `★ ${s.puzzle.rating}`}</span></div>
      <div class="play-grid">
        <MoveTrainer key={p.i + sol} fen={p.f} line={p.m.split(' ')} setup hintLevel={hint} showSolutionSignal={sol}
          onMistake={() => { if (!failed) { setFailed(true); record(false); } }}
          onSolved={() => { setSolved(true); if (!failed) record(true); }} />
        <aside class="side card">
          <p class="muted small">{userWhite ? '⚪ Tu joues les Blancs' : '⚫ Tu joues les Noirs'} · difficulté {mode === 'daily' || mode === 'custom' || solved || failed ? p.r : '?'}</p>
          {delta != null && <p class={'delta ' + (delta >= 0 ? 'up' : 'down')}>{delta >= 0 ? '+' : ''}{delta} → {s.puzzle.rating}</p>}
          {(solved || failed) && <p class="muted small">Thèmes : {p.t.filter((t) => THEME_FR[t] && !['endgame', 'middlegame', 'opening', 'short', 'long', 'veryLong', 'oneMove', 'crushing', 'advantage'].includes(t)).map(themeName).join(', ') || '—'}{op ? ` · ${familyFr(op)}` : ''}</p>}
          {failed && !solved && <p class="muted small">Raté — ce puzzle reviendra dans tes révisions. Tu peux continuer à chercher.</p>}
          <div class="col">
            {!solved && <button class="btn ghost" onClick={() => { setHint(hint + 1); if (!failed && hint >= 1) { setFailed(true); record(false); } }}>💡 Indice{hint ? ` (${hint})` : ''}</button>}
            {!solved && <button class="btn ghost" onClick={() => { if (!failed) { setFailed(true); record(false); } setSol((x) => x + 1); setSolved(true); }}>👁 Voir la solution</button>}
            {(solved || failed) && mode !== 'daily' && <button class="btn primary" onClick={() => next()}>Puzzle suivant ›</button>}
            {(solved || failed) && <a class="btn ghost" href={`#/analysis?fen=${encodeURIComponent(p.f)}&moves=${encodeURIComponent(p.m)}`}>🔬 Analyser</a>}
            {mode === 'daily' && solved && <a class="btn primary" href="#/puzzles/rated">Continuer avec les puzzles classés ›</a>}
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
  const start = async (mode: '3' | '5' | 'survie') => { setLoading(true); const q = await sequence(70); setLoading(false); if (!q.length) { toast('Puzzles indisponibles hors ligne', '⚠️'); return; } setSeq(q); setK(0); setScore(0); setStrikes(0); setResults([]); setOver(false); setLeft(mode === '3' ? 180 : mode === '5' ? 300 : 0); setCfg({ mode }); };
  useEffect(() => { if (!cfg || cfg.mode === 'survie' || over) return; const t = setInterval(() => setLeft((l) => { if (l <= 1) { clearInterval(t); finish(); return 0; } if (l <= 11) play('tick'); return l - 1; }), 1000); return () => clearInterval(t); }, [cfg, over]);
  const finish = () => { setOver(true); play('win'); setState((st) => { st.rush.runs++; if (cfg?.mode === '3') st.rush.best3 = Math.max(st.rush.best3, scoreRef.current); else if (cfg?.mode === '5') st.rush.best5 = Math.max(st.rush.best5, scoreRef.current); else st.rush.survival = Math.max(st.rush.survival, scoreRef.current); }); };
  const scoreRef = useRef(0); scoreRef.current = score;
  if (!cfg) return (
    <div class="page">
      <a class="back" href="#/puzzles">‹ Puzzles</a><h1>⏱️ Contre la montre</h1>
      <p class="muted">Résous un maximum de puzzles de plus en plus difficiles. 3 erreurs et c’est fini !</p>
      {loading && <div class="loading">Préparation…</div>}
      <div class="mode-grid">
        <button class="mode" onClick={() => start('3')}><span>⚡</span><b>3 minutes</b><small>Record : {s.rush.best3}</small></button>
        <button class="mode" onClick={() => start('5')}><span>⏱️</span><b>5 minutes</b><small>Record : {s.rush.best5}</small></button>
        <button class="mode" onClick={() => start('survie')}><span>❤️</span><b>Survie</b><small>Sans chrono · record {s.rush.survival}</small></button>
      </div>
    </div>
  );
  const p = seq[k];
  if (over || !p) return (
    <div class="page center-page">
      <div class="celebrate">🏁</div><h1>Score : {score}</h1>
      <p class="muted">{score >= Math.max(cfg.mode === '3' ? s.rush.best3 : cfg.mode === '5' ? s.rush.best5 : s.rush.survival, 1) ? '🎉 Nouveau record !' : 'Bien joué !'}</p>
      <div class="rush-dots">{results.map((r) => <span class={r ? 'ok' : 'ko'}>{r ? '✓' : '✕'}</span>)}</div>
      <div class="row center"><button class="btn primary" onClick={() => start(cfg.mode)}>Rejouer</button><a class="btn ghost" href="#/puzzles">Retour</a></div>
    </div>
  );
  const strike = () => { const n = strikes + 1; setStrikes(n); setResults((r) => [...r, false]); recordPuzzle(p, false, 'rush'); if (n >= 3) finish(); else setTimeout(() => setK((x) => x + 1), 700); };
  return (
    <div class="page puzzle-session">
      <div class="session-head"><a class="back" href="#/puzzles/rush" onClick={() => setCfg(null)}>‹</a><h1>Score {score}</h1>
        <span class="pill">{cfg.mode === 'survie' ? 'Survie' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</span>
        <span class="strikes">{[0, 1, 2].map((i) => <span class={i < strikes ? 'x on' : 'x'}>✕</span>)}</span></div>
      <MoveTrainer key={p.i} fen={p.f} line={p.m.split(' ')} setup onMistake={strike} onSolved={() => { setScore((x) => x + 1); setResults((r) => [...r, true]); recordPuzzle(p, true, 'rush'); setTimeout(() => setK((x) => x + 1), 400); }} />
      <div class="rush-dots">{results.slice(-20).map((r) => <span class={r ? 'ok' : 'ko'}>{r ? '✓' : '✕'}</span>)}</div>
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
    const q = await sequence(60, st, 40, 6); if (!q.length) { toast('Puzzles indisponibles hors ligne', '⚠️'); return; }
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
      <a class="back" href="#/puzzles">‹ Puzzles</a><h1>⚔️ Duel de puzzles</h1>
      <p class="muted">Affronte un adversaire sur les <b>mêmes puzzles</b> pendant 3 minutes. Le plus de bonnes réponses gagne. 3 erreurs et tu es éliminé !</p>
      <div class="bot-grid">{BOTS.filter((b) => b.elo <= 2800).map((b) => <button class="bot-card" style={{ '--c': b.color } as any} onClick={() => start(b)}><BotAvatar bot={b} size={64} /><b>{b.name}</b><span class="elo">{b.elo}</span></button>)}</div>
    </div>
  );
  const p = seq[k]; const meOut = me.strikes >= 3;
  if (over) {
    const win = me.score > ghost.score, draw = me.score === ghost.score;
    return (
      <div class="page center-page">
        <div class="celebrate">{win ? '🏆' : draw ? '🤝' : '😤'}</div><h1>{win ? 'Victoire !' : draw ? 'Égalité' : 'Défaite'}</h1>
        <div class="battle-score"><div><b>{me.score}</b><small>Toi</small></div><span>—</span><div><b>{ghost.score}</b><small>{opp.name}</small></div></div>
        <div class="row center"><button class="btn primary" onClick={() => start(opp)}>Revanche</button><button class="btn ghost" onClick={() => setOpp(null)}>Changer d’adversaire</button></div>
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
        <div class="bb me"><b>Toi</b><span class="bb-score">{me.score}</span><span class="strikes">{[0, 1, 2].map((i) => <span class={i < me.strikes ? 'x on' : 'x'}>✕</span>)}</span></div>
        <span class="pill">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
        <div class="bb opp"><BotAvatar bot={opp} size={28} /><b>{opp.name}</b><span class="bb-score">{ghost.score}</span><span class="strikes">{[0, 1, 2].map((i) => <span class={i < ghost.strikes ? 'x on' : 'x'}>✕</span>)}</span></div>
      </div>
      {meOut ? <div class="empty"><div class="empty-icon">⏳</div><h3>Tu es éliminé</h3><p>{opp.name} continue… score à battre : {me.score}</p><button class="btn ghost" onClick={end}>Terminer</button></div>
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
      <a class="back" href="#/puzzles">‹ Puzzles</a><h1>🗺️ Parcours de puzzles</h1>
      <p class="muted">Chaque étape : {STAGE_SIZE} puzzles, {STAGE_PASS} réussites pour débloquer la suivante. 3 étoiles pour un sans-faute !</p>
      {groups.map((g) => (
        <section><h2>{g}</h2><div class="opening-grid">
          {PUZZLE_PATHS.filter((p) => p.group === g).map((p) => { const pr = s.training.paths?.[p.id]; const done = Object.keys(pr?.stars || {}).length; const stars = Object.values(pr?.stars || {}).reduce((a: number, b: any) => a + b, 0) as number;
            return <a class={'opening-card ' + (done === p.stages.length ? 'done' : '')} href={`#/puzzles/paths/${p.id}`}><span class="side-dot">{p.icon}</span><b>{p.title}</b><small class="muted">{p.desc}</small><Progress value={done / p.stages.length} /><small class="muted">{done}/{p.stages.length} étapes · {stars}★</small></a>; })}
        </div></section>
      ))}
    </div>
  );
}
export function PuzzlePath({ id }: { id: string }) {
  const path = PUZZLE_PATHS.find((p) => p.id === id); const s = useStore((x) => x);
  const [stage, setStage] = useState<number | null>(null); const [list, setList] = useState<BankPuzzle[]>([]); const [k, setK] = useState(0); const [res, setRes] = useState<boolean[]>([]);
  if (!path) return <div class="page"><a class="back" href="#/puzzles/paths">‹ Parcours</a><p>Parcours introuvable.</p></div>;
  const pr = s.training.paths?.[id] || { stars: {} };
  const unlocked = (i: number) => i === 0 || pr.stars[i - 1] != null;
  const begin = async (i: number) => {
    const st = path.stages[i]; const out: BankPuzzle[] = []; const seen = [...getState().puzzle.seen];
    for (let n = 0; n < STAGE_SIZE; n++) {
      const theme = path.themes[n % path.themes.length];
      const p = await pickPuzzle({ rating: st.min + ((st.max - st.min) * n) / STAGE_SIZE, min: st.min, max: st.max, theme, seen: [...seen, ...out.map((x) => x.i)] });
      if (p) out.push(p);
    }
    if (!out.length) { toast('Puzzles indisponibles hors ligne', '⚠️'); return; }
    setList(out); setK(0); setRes([]); setStage(i);
  };
  if (stage != null) {
    const p = list[k];
    if (!p) {
      const ok = res.filter(Boolean).length; const pass = ok >= Math.min(STAGE_PASS, list.length - 1); const stars = ok >= list.length ? 3 : ok >= list.length - 1 ? 2 : 1;
      if (pass && (pr.stars[stage] ?? 0) < stars) setState((st) => { const t = ((st.training.paths ||= {})[id] ||= { stars: {} }); t.stars[stage] = Math.max(t.stars[stage] || 0, stars); });
      return (
        <div class="page center-page">
          <div class="celebrate">{pass ? '🌟' : '💪'}</div><h1>{ok}/{list.length}</h1>
          <p>{pass ? `Étape ${stage + 1} validée ${'★'.repeat(stars)}` : `Il faut ${STAGE_PASS} réussites pour valider. Réessaie !`}</p>
          <div class="row center">{pass && stage + 1 < path.stages.length && <button class="btn primary" onClick={() => begin(stage + 1)}>Étape suivante ›</button>}<button class="btn ghost" onClick={() => begin(stage)}>Recommencer</button><button class="btn ghost" onClick={() => setStage(null)}>Retour au parcours</button></div>
        </div>
      );
    }
    return (
      <div class="page puzzle-session">
        <div class="session-head"><button class="btn small ghost" onClick={() => setStage(null)}>‹</button><h1>{path.title} · étape {stage + 1}</h1><span class="pill">{k + 1}/{list.length}</span></div>
        <MoveTrainer key={p.i} fen={p.f} line={p.m.split(' ')} setup onMistake={() => { if (res.length === k) { setRes((r) => [...r, false]); recordPuzzle(p, false, 'theme'); } }}
          onSolved={() => { if (res.length === k) { setRes((r) => [...r, true]); recordPuzzle(p, true, 'theme'); } setTimeout(() => setK((x) => x + 1), 600); }} />
        <div class="row center">{res.length > k && !res[k] && <button class="btn ghost" onClick={() => setK((x) => x + 1)}>Puzzle suivant ›</button>}</div>
        <div class="rush-dots">{res.map((r) => <span class={r ? 'ok' : 'ko'}>{r ? '✓' : '✕'}</span>)}</div>
      </div>
    );
  }
  return (
    <div class="page">
      <a class="back" href="#/puzzles/paths">‹ Parcours</a><h1>{path.icon} {path.title}</h1><p class="muted">{path.desc}</p>
      <div class="path">{path.stages.map((st, i) => { const un = unlocked(i); const stars = pr.stars[i];
        return <button class={'node ' + (stars != null ? 'done' : un ? 'open' : 'locked') + (i % 2 ? ' alt' : '')} style={{ '--c': 'var(--accent)' } as any} onClick={() => un && begin(i)} disabled={!un}>
          <span class="node-icon">{stars != null ? '★'.repeat(stars) : un ? i + 1 : '🔒'}</span><span class="node-text"><b>Étape {i + 1}</b><small class="muted">Puzzles {st.min}–{st.max}</small></span></button>; })}</div>
    </div>
  );
}
