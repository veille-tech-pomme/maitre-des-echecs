import { useEffect, useRef, useState } from 'preact/hooks';
import { MoveTrainer } from '../components/MoveTrainer';
import { LineChart, Ring } from '../components/ui';
import { useStore, getState, setState, today } from '../lib/store';
import { loadPuzzles, pickRated, dailyPuzzle, rushSequence, byId, type Puzzle } from '../lib/puzzles';
import { recordPuzzle } from '../lib/progress';
import { MAIN_THEMES, themeName } from '../data/themes';
import { isDue } from '../lib/srs';
import { markPlanDone } from '../lib/plan';
import { play } from '../lib/sound';
import { Chess } from '../lib/chess';

function usePuzzles() { const [all, setAll] = useState<Puzzle[] | null>(null); useEffect(() => { loadPuzzles().then(setAll); }, []); return all; }

export function PuzzlesHub() {
  const s = useStore((x) => x);
  const due = Object.values(s.srs).filter((x) => x.kind === 'puzzle' && isDue(x)).length;
  const hist = s.puzzle.history.map((h) => h.r);
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
          <a class="mode" href="#/review"><span>🔁</span><b>Révisions</b><small>{due ? `${due} à revoir` : 'À jour'}</small></a>
        </div>
      </div>
      <h2>Par thème</h2>
      <div class="theme-grid">
        {MAIN_THEMES.map((t) => { const st = s.themes[t]; const n = st ? st.ok + st.ko : 0; return (
          <a class="theme" href={`#/puzzles/theme/${t}`}><b>{themeName(t)}</b>{n > 0 ? <Ring value={st!.ok / n} size={34} label={<small>{Math.round((st!.ok / n) * 100)}</small>} /> : <small class="muted">—</small>}</a>
        ); })}
      </div>
      <p class="muted small">Puzzles issus de la base ouverte Lichess (domaine public), vérifiés automatiquement avec Stockfish.</p>
    </div>
  );
}

export function PuzzleSession({ mode, theme }: { mode: 'rated' | 'theme' | 'daily' | 'review'; theme?: string }) {
  const all = usePuzzles();
  const [p, setP] = useState<Puzzle | null>(null);
  const [failed, setFailed] = useState(false); const [solved, setSolved] = useState(false); const [delta, setDelta] = useState<number | null>(null);
  const [hint, setHint] = useState(0); const [sol, setSol] = useState(0); const recorded = useRef(false); const [count, setCount] = useState(0);
  const s = useStore((x) => x);
  const next = (list = all) => {
    if (!list) return; recorded.current = false; setFailed(false); setSolved(false); setDelta(null); setHint(0); setSol(0);
    const st = getState();
    if (mode === 'daily') setP(dailyPuzzle(list));
    else if (mode === 'review') { const due = Object.values(st.srs).filter((x) => x.kind === 'puzzle' && isDue(x)).sort((a, b) => a.due - b.due); setP(due[0] ? byId(list, due[0].id.slice(2)) || null : null); }
    else setP(pickRated(list, st.puzzle.rating, st.puzzle.seen, theme));
  };
  useEffect(() => { if (all) next(all); }, [all, theme, mode]);
  if (!all) return <div class="page"><div class="loading">Chargement…</div></div>;
  if (!p) return <div class="page"><a class="back" href="#/puzzles">‹ Puzzles</a><div class="empty"><div class="empty-icon">✅</div><h3>Rien à réviser pour l’instant</h3><p>Les puzzles ratés reviennent ici au bon moment (répétition espacée).</p><a class="btn primary" href="#/puzzles/rated">Puzzles classés</a></div></div>;
  const record = (ok: boolean) => { if (recorded.current) return; recorded.current = true; const d = recordPuzzle(p, ok, mode === 'review' ? 'review' : mode); setDelta(mode === 'review' ? null : d); setCount((c) => c + 1); if (count + 1 >= 5) setState((st) => markPlanDone(st, theme ? 'weak:' + theme : 'puzzles')); if (mode === 'review') setState((st) => markPlanDone(st, 'srs')); };
  const userWhite = new Chess(p.f).turn() === 'b';
  const title = mode === 'daily' ? 'Puzzle du jour' : mode === 'review' ? 'Révision' : mode === 'theme' ? themeName(theme!) : 'Puzzles classés';
  return (
    <div class="page puzzle-session">
      <div class="session-head"><a class="back" href="#/puzzles">‹</a><h1>{title}</h1><span class="pill">{mode === 'review' ? `${Object.values(s.srs).filter((x) => x.kind === 'puzzle' && isDue(x)).length} restants` : `★ ${s.puzzle.rating}`}</span></div>
      <div class="play-grid">
        <MoveTrainer key={p.i + sol} fen={p.f} line={p.m.split(' ')} setup hintLevel={hint} showSolutionSignal={sol}
          onMistake={() => { if (!failed) { setFailed(true); record(false); } }}
          onSolved={(clean) => { setSolved(true); if (!failed) record(true); }} />
        <aside class="side card">
          <p class="muted small">{userWhite ? '⚪ Tu joues les Blancs' : '⚫ Tu joues les Noirs'} · difficulté {mode === 'daily' || solved || failed ? p.r : '?'}</p>
          {delta != null && <p class={'delta ' + (delta >= 0 ? 'up' : 'down')}>{delta >= 0 ? '+' : ''}{delta} → {s.puzzle.rating}</p>}
          {(solved || failed) && <p class="muted small">Thèmes : {p.t.filter((t) => t !== 'endgame' && t !== 'middlegame' && t !== 'opening').map(themeName).join(', ')}</p>}
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
  const all = usePuzzles(); const s = useStore((x) => x);
  const [cfg, setCfg] = useState<null | { mode: '3' | '5' | 'survie' }>(null);
  const [seq, setSeq] = useState<Puzzle[]>([]); const [k, setK] = useState(0); const [score, setScore] = useState(0); const [strikes, setStrikes] = useState(0);
  const [left, setLeft] = useState(0); const [over, setOver] = useState(false); const [results, setResults] = useState<boolean[]>([]);
  const start = (mode: '3' | '5' | 'survie') => { if (!all) return; setSeq(rushSequence(all)); setK(0); setScore(0); setStrikes(0); setResults([]); setOver(false); setLeft(mode === '3' ? 180 : mode === '5' ? 300 : 0); setCfg({ mode }); };
  useEffect(() => { if (!cfg || cfg.mode === 'survie' || over) return; const t = setInterval(() => setLeft((l) => { if (l <= 1) { clearInterval(t); finish(); return 0; } if (l <= 11) play('tick'); return l - 1; }), 1000); return () => clearInterval(t); }, [cfg, over]);
  const finish = () => { setOver(true); play('win'); setState((st) => { st.rush.runs++; if (cfg?.mode === '3') st.rush.best3 = Math.max(st.rush.best3, scoreRef.current); else if (cfg?.mode === '5') st.rush.best5 = Math.max(st.rush.best5, scoreRef.current); else st.rush.survival = Math.max(st.rush.survival, scoreRef.current); }); };
  const scoreRef = useRef(0); scoreRef.current = score;
  if (!all) return <div class="page"><div class="loading">Chargement…</div></div>;
  if (!cfg) return (
    <div class="page">
      <a class="back" href="#/puzzles">‹ Puzzles</a><h1>⏱️ Contre la montre</h1>
      <p class="muted">Résous un maximum de puzzles de plus en plus difficiles. 3 erreurs et c’est fini !</p>
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
