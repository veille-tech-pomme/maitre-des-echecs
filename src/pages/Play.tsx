import { BotAvatar } from '../components/BotAvatar';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Board } from '../components/Board';
import { Modal, toast, LargeTitle, NavBar, Item, AutoNext } from '../components/ui';
import { Icon } from '../components/Icon';
import { BOT_GROUPS, BOTS, botById, type Bot } from '../data/bots';
import { Chess, legalDests, turnColor, checkSquare, isPromotion, tryMove, captured, material, gameOverText, sanFr, type Move } from '../lib/chess';
import { engine, type PvLine } from '../lib/engine';
import { botMove } from '../lib/bot-move';
import { CLASSES, type MoveClass } from '../coach/classify';
import type { Explanation } from '../coach/explain';
import type { Hint } from '../coach/hints';
const coachClient = () => import('../coach/client');
import { playForMove, play } from '../lib/sound';
import { useStore, setState, addXp, getState } from '../lib/store';
import { recommendedBot, markPlanDone } from '../lib/plan';
import { checkBadges } from '../lib/progress';
import { openingName } from '../data/openings';
import { go } from '../lib/router';
import CALIB from '../data/bot-calibration.json';
import { createClock, pgnWithClock, type Clock, type ClockSnap } from '../lib/clock';
import { computeThinkMs, type Span } from '../lib/timing';
import { log, detailAllowed } from '../lib/events';

/** Cadences (audit Magnus B7 : pendule contre les bots). */
export const TCS = [
  { id: 'none', label: 'Sans pendule', sub: 'Prends ton temps', base: 0, inc: 0 },
  { id: '15+10', label: 'Rapide', sub: '15 min + 10 s', base: 900, inc: 10 },
  { id: '10+5', label: 'Rapide', sub: '10 min + 5 s', base: 600, inc: 5 },
  { id: '5+3', label: 'Blitz', sub: '5 min + 3 s', base: 300, inc: 3 },
  { id: '3+2', label: 'Blitz', sub: '3 min + 2 s', base: 180, inc: 2 },
] as const;
export const fmtClock = (ms: number) => { const t = Math.max(0, ms); if (t < 10000) return (t / 1000).toFixed(1).replace('.', ','); const s = Math.ceil(t / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
/** Matériel suffisant pour mater (pour la règle du temps écoulé : sinon, nulle). */
export function canMate(c: Chess, side: 'w' | 'b') { const ps = c.board().flat().filter((x) => x && x.color === side).map((x) => x!.type).filter((t) => t !== 'k'); return ps.some((t) => t === 'p' || t === 'r' || t === 'q') || ps.length >= 2; }

/** Audit Magnus B7 : force mesurée (tournoi de calibration) ou réglage Stockfish, affichés honnêtement. */
export function calibText(b: Bot): string {
  const m = (CALIB as any).bots?.[b.id] as { elo: number; se: number; games: number } | undefined;
  if (m) return `Elo mesuré : ≈ ${m.elo} (± ${m.se}, ${m.games} parties de calibration contre Stockfish et les bots voisins)`;
  if (b.limitElo) return `Force réglée par Stockfish (UCI_Elo ${b.limitElo})`;
  return `Stockfish à pleine force (${(b.movetime || 0) / 1000} s par coup)`;
}
export function BotSelect() {
  const s = useStore((x) => x);
  const rec = recommendedBot(s); const rb = botById(rec);
  const recent = [...s.games].sort((x, y) => y.date - x.date).slice(0, 3);
  const res = (g: typeof recent[number]) => (g.result === '1/2-1/2' ? 'd' : (g.result === '1-0') === (g.color === 'w') ? 'w' : 'l');
  return (
    <div class="page play">
      <LargeTitle title="Jouer" sub={`${BOTS.length} adversaires, de 200 à 3200 Elo`} />
      <a class="hero-card bot-feature" href={`#/play/${rb.id}`} style={{ '--c': rb.color } as any}>
        <span class="hc-eyebrow">Adversaire recommandé</span>
        <div class="bf-row"><BotAvatar bot={rb} size={72} /><div><h2>{rb.name}</h2><p>{rb.style} · {rb.elo} Elo</p></div></div>
        <span class="btn primary"><Icon name="play" size={18} />Jouer contre {rb.name}</span>
      </a>
      <div class="list">
        <Item href="#/analysis" icon="microscope" color="#64D2FF" title="Analyse" sub="Étudie une position avec Stockfish" />
        {recent.length > 0 && recent.map((g) => { const b = botById(g.botId); const r = res(g); return (
          <a class="item" href={`#/game/${g.id}`}><span class={'res ' + r}>{r === 'w' ? 'V' : r === 'l' ? 'D' : 'N'}</span><span class="it-main"><span class="it-title">contre {b?.name || 'IA'}</span><span class="it-sub">{new Date(g.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {Math.ceil(g.moves.length / 2)} coups · voir le bilan</span></span><Icon name="right" size={18} class="chev" stroke={2.4} /></a>); })}
      </div>
      {BOT_GROUPS.map((g) => { const list = BOTS.filter((b) => b.group === g); if (!list.length) return null; return (
        <section>
          <div class="section-title"><h2>{g}</h2><span class="muted tnum">{list[0].elo}–{list[list.length - 1].elo}</span></div>
          <div class="bot-row bot-grid">
            {list.map((b) => {
              const games = s.games.filter((x) => x.botId === b.id); const wins = games.filter((x) => (x.result === '1-0' && x.color === 'w') || (x.result === '0-1' && x.color === 'b')).length;
              return (
                <a class={'bot-card ' + (b.id === rec ? 'rec' : '')} href={`#/play/${b.id}`} style={{ '--c': b.color } as any}>
                  <BotAvatar bot={b} size={64} />
                  <b>{b.name}</b><small class="elo tnum">{b.elo}<span class="sr-only"> Elo</span></small>
                  <small class="muted">{games.length ? `${wins} sur ${games.length} gagnée${wins > 1 ? 's' : ''}` : b.style}</small>
                </a>
              );
            })}
          </div>
        </section>); })}
    </div>
  );
}

interface Coach { cls: MoveClass; ex: Explanation; san: string; best: string; undoable: boolean }
export function Game({ botId }: { botId: string }) {
  const bot = botById(botId);
  const settings = useStore((s) => s.settings);
  const [setup, setSetup] = useState(true);
  const [color, setColor] = useState<'w' | 'b'>('w');
  const [coachOn, setCoachOn] = useState(settings.coachInPlay);
  const [pick, setPick] = useState<'w' | 'b' | 'r'>('w');
  const [ch, setCh] = useState(() => new Chess());
  const [hist, setHist] = useState<Move[]>([]);
  const [thinking, setThinking] = useState(false);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [hint, setHint] = useState<{ fen: string; hs: Hint[]; lvl: number } | null>(null);
  const [chat, setChat] = useState<string>('');
  const [over, setOver] = useState<{ text: string; result: string; id: string } | null>(null);
  const [takebacks, setTakebacks] = useState(0);
  // brief P0 §4 : « Sans pendule » par défaut ; sous 1000 de niveau, toujours présélectionné
  const [tcId, setTcId] = useState<string>(() => ((getState().puzzle.rating || 800) < 1000 ? 'none' : settings.playTc || 'none'));
  const tc = TCS.find((x) => x.id === tcId) || TCS[0];
  const clk = useRef<Clock | null>(null); const snaps = useRef<ClockSnap[]>([]); const clocks = useRef<number[]>([]); const [, tick] = useState(0);
  /** raisons de pause de la pendule : onglet caché, analyse du coach, pause « gaffe », fin */
  const pauses = useRef(new Set<string>());
  const pauseFor = (r: string) => { pauses.current.add(r); clk.current?.pause(Date.now()); };
  const resumeFor = (r: string) => { pauses.current.delete(r); if (!pauses.current.size) clk.current?.resume(Date.now()); };
  // temps de réflexion (brief P0 §3)
  const tReady = useRef(0); const hidden = useRef<Span[]>([]); const hiddenAt = useRef(0);
  const touch = useRef<{ first: number; lifts: string[]; drag: string }>({ first: 0, lifts: [], drag: '' });
  const ready = () => { tReady.current = performance.now(); hidden.current = []; touch.current = { first: 0, lifts: [], drag: '' }; };
  const onTouch = (sq: string, kind: 'select' | 'dragstart') => {
    if (!tReady.current) return; const tc0 = touch.current; if (!tc0.first) tc0.first = performance.now();
    if (kind === 'dragstart') tc0.drag = sq;
    if (tc0.lifts[tc0.lifts.length - 1] !== sq && tc0.lifts.length < 17) tc0.lifts.push(sq);
  };
  const tenSec = useRef(false); const [srClock, setSrClock] = useState('');
  const evalCache = useRef(new Map<string, PvLine[]>());
  const gid = useRef(''); const myTimes = useRef<number[]>([]);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; engine.stopAll(); }, []);
  useEffect(() => {
    if (!tc.base || setup || over) return;
    let shown = '';
    const id = setInterval(() => {
      const c = clk.current; if (!c) return; const now = Date.now();
      const f = c.flagged(now); if (f === color) { end(ch, hist, false, color); return; } // détection < 100 ms (intervalle 50 ms)
      const mine = c.remaining(color, now);
      if (!tenSec.current && mine < 10000 && c.running() === color) { tenSec.current = true; setSrClock('10 secondes'); if (getState().settings.sound) { play('notify'); navigator.vibrate?.(30); } }
      const v = fmtClock(mine) + '|' + fmtClock(c.remaining(color === 'w' ? 'b' : 'w', now)); if (v !== shown) { shown = v; tick((x) => x + 1); }
    }, 50);
    return () => clearInterval(id);
  });
  // onglet caché : la pendule s'arrête (partie contre un bot) et ce temps ne compte pas dans la réflexion
  useEffect(() => {
    const vis = () => {
      if (document.hidden) { hiddenAt.current = performance.now(); pauseFor('hidden'); }
      else { if (hiddenAt.current) hidden.current.push([hiddenAt.current, performance.now()]); hiddenAt.current = 0; resumeFor('hidden'); }
    };
    document.addEventListener('visibilitychange', vis); return () => document.removeEventListener('visibilitychange', vis);
  }, []);
  // partie quittée sans fin → game_end « abandon »
  const live = useRef({ over: false, plies: 0 });
  useEffect(() => () => { if (gid.current && !live.current.over && live.current.plies > 0) log('game_end', { gid: gid.current, result: '*', how: 'abandon', plies: live.current.plies }); }, []);
  const liveClock = (side: 'w' | 'b') => clk.current ? clk.current.remaining(side, Date.now()) : 0;
  const clockEl = (side: 'w' | 'b') => { if (!tc.base) return null; const t = liveClock(side); const active = !over && ch.turn() === side; return <span class={'clock tnum' + (active ? ' on' : '') + (t < 20000 ? ' low' : '')} role="timer" aria-live="off" aria-label={`Pendule ${side === color ? 'toi' : bot.name} : ${fmtClock(t)}`}>{fmtClock(t)}</span>; };
  const say = (arr: string[]) => setChat(arr[Math.floor(Math.random() * arr.length)]);

  const start = (c: 'w' | 'b' | 'r') => {
    const col = c === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : c;
    engine.stopAll(); engine.newGame();
    pauses.current.clear(); tenSec.current = false; clocks.current = []; snaps.current = []; myTimes.current = []; setSrClock('');
    clk.current = tc.base ? createClock({ base: tc.base * 1000, inc: tc.inc * 1000 }) : null;
    clk.current?.start('w', Date.now()); if (clk.current) snaps.current[0] = clk.current.snapshot(Date.now());
    setColor(col); const n = new Chess(); setCh(n); setHist([]); setCoach(null); setHint(null); setOver(null); setTakebacks(0); setSetup(false);
    gid.current = 'g' + Date.now().toString(36); say(bot.lines.hello); evalCache.current.clear();
    live.current = { over: false, plies: 0 }; if (col === 'w') ready(); else tReady.current = 0;
    log('game_start', { gid: gid.current, bot: bot.id, botElo: bot.elo, color: col, tc: tc.base ? { base: tc.base, inc: tc.inc } : null, coach: coachOn });
    if (col === 'b') setTimeout(() => botTurn(n, []), 500); else if (coachOn) analyseBg(n.fen());
  };
  async function analyse(fen: string): Promise<PvLine[]> {
    const c = evalCache.current.get(fen); if (c) return c;
    const ch2 = new Chess(fen); if (ch2.isGameOver()) return [];
    const r = await engine.analyse(fen, { depth: 11, multipv: 2 }); evalCache.current.set(fen, r.lines); return r.lines;
  }
  const analyseBg = (fen: string) => { analyse(fen).catch(() => {}); };
  async function botTurn(c: Chess, h: Move[]) {
    if (c.isGameOver()) return end(c, h);
    setThinking(true); resumeFor('coach'); resumeFor('blunder');
    const t0 = Date.now(); const botSide = c.turn();
    const hurry = !!clk.current && clk.current.remaining(botSide, t0) < 0.1 * clk.current.base; // < 10 % : calcul raccourci
    let u = '';
    try { u = await botMove(bot, c.fen(), h.map((m) => m.san), undefined, hurry); } catch (e) { console.warn(e); }
    if (!alive.current) return;
    const wait = hurry ? 0 : Math.max(0, (bot.elo < 1000 ? 700 : 400) - (Date.now() - t0));
    await new Promise((r) => setTimeout(r, wait));
    const n = new Chess(c.fen()); const m = u ? tryMove(n, u) : null;
    if (!m) { const any = n.moves()[0]; if (!any) return end(c, h); tryMove(n, any); }
    const mm = m || n.history({ verbose: true }).slice(-1)[0];
    const tb = Date.now();
    if (clk.current) { if (clk.current.flagged(tb) === mm.color) { setThinking(false); return end(c, h, false, mm.color); } clk.current.press(mm.color, tb); clocks.current[h.length] = clk.current.remaining(mm.color, tb); snaps.current[h.length + 1] = clk.current.snapshot(tb); }
    log('move', { gid: gid.current, ply: h.length, uci: mm.from + mm.to + (mm.promotion || ''), side: 'bot', thinkMs: tb - t0, clockMs: clk.current?.remaining(mm.color, tb), oppClockMs: clk.current?.remaining(color, tb), hintLevel: 0 });
    live.current.plies = h.length + 1; ready();
    playForMove(mm); const nh = [...h, mm]; setCh(n); setHist(nh); setThinking(false);
    if (mm.captured && Math.random() < 0.4) say(bot.lines.capture); else if (mm.san.includes('+') && Math.random() < 0.5) say(bot.lines.check);
    if (n.isGameOver()) return end(n, nh);
    if (coachOn) analyseBg(n.fen());
  }
  async function onMove(from: string, to: string, promotion?: string) {
    if (thinking || over || setup) return false;
    const before = ch.fen();
    const n = new Chess(before); const m = tryMove(n, { from, to, promotion: promotion || (isPromotion(ch, from, to) ? 'q' : undefined) });
    if (!m) return false;
    const tm = performance.now(); const tw = Date.now();
    if (clk.current) { if (clk.current.flagged(tw) === m.color) { end(ch, hist, false, m.color); return false; } clk.current.press(m.color, tw); clocks.current[hist.length] = clk.current.remaining(m.color, tw); snaps.current[hist.length + 1] = clk.current.snapshot(tw); }
    const tt = touch.current; const uci0 = m.from + m.to + (m.promotion || '');
    const mv: Record<string, unknown> = { gid: gid.current, ply: hist.length, uci: uci0, side: 'me', thinkMs: computeThinkMs(tReady.current, tm, hidden.current), firstTouchMs: tt.first ? Math.round(tt.first - tReady.current) : undefined,
      lifts: tt.lifts.filter((x, i, a) => !(i === a.length - 1 && x === m.from)).slice(0, 16), input: tt.drag === m.from ? 'drag' : 'click', clockMs: clk.current?.remaining(m.color, tw), oppClockMs: clk.current?.remaining(m.color === 'w' ? 'b' : 'w', tw), hintLevel: hint && hint.fen === before ? hint.lvl : 0 };
    if (detailAllowed()) myTimes.current[hist.length] = Math.round((mv.thinkMs as number) / 100) * 100;
    tReady.current = 0; live.current.plies = hist.length + 1;
    playForMove(m); const nh = [...hist, m]; setCh(n); setHist(nh); setHint(null); setCoach(null);
    if (!coachOn || n.isGameOver()) log('move', mv);
    if (coachOn && !n.isGameOver()) {
      setThinking(true); pauseFor('coach'); // l'analyse du coach ne compte pour personne
      const logMv = (cls?: string) => log('move', cls ? { ...mv, coachCls: cls } : mv);
      const lb = await analyse(before); const la = await analyse(n.fen());
      if (!alive.current) return true;
      const cc = await coachClient(); if (!alive.current) return true;
      const uci = m.from + m.to + (m.promotion || '');
      const rv = cc.assessLive(before, uci, lb, la, cc.currentElo(), nh.length - 1, hist.map((x) => x.san));
      setCoach({ cls: rv.cls, ex: rv.ex, san: m.san, best: lb[0]?.move || uci, undoable: ['mistake', 'blunder', 'miss'].includes(rv.cls) });
      logMv(rv.cls);
      if (rv.cls === 'blunder') { play('error'); setThinking(false); pauseFor('blunder'); return true; } // attend la décision (reprendre ou continuer)
      setThinking(false);
    }
    if (n.isGameOver()) { end(n, nh); return true; }
    botTurn(n, nh);
    return true;
  }
  const continueAfterBlunder = () => { setCoach((c) => (c ? { ...c, undoable: false } : c)); botTurn(ch, hist); };
  function takeback() {
    if (thinking || hist.length === 0) return;
    let k = hist.length;
    const lastMine = hist[k - 1].color === color;
    k -= lastMine ? 1 : 2; if (k < 0) return;
    const n = new Chess(); for (const m of hist.slice(0, k)) tryMove(n, m.san);
    setCh(n); setHist(hist.slice(0, k)); setCoach(null); setHint(null); setTakebacks((t) => t + 1); setOver(null);
    // la pendule revient au temps d'avant les coups annulés
    const now = Date.now(); if (clk.current && snaps.current[k]) { clk.current.restore(snaps.current[k], now); pauses.current.clear(); clk.current.resume(now); }
    clocks.current = clocks.current.slice(0, k); snaps.current = snaps.current.slice(0, k + 1); myTimes.current = myTimes.current.slice(0, k);
    log('takeback', { gid: gid.current, toPly: k }); live.current.plies = k; ready();
  }
  /** Indices gradués : 1. Menaces → 2. Idée → 3. Coup. */
  async function getHint() {
    if (thinking) return; const fen = ch.fen();
    if (hint && hint.fen === fen) { setHint({ ...hint, lvl: Math.min(hint.hs.length, hint.lvl + 1) }); return; }
    setThinking(true);
    try { const cc = await coachClient(); const hs = await cc.coachHints(fen, 12); if (alive.current) setHint({ fen, hs, lvl: 1 }); }
    catch { toast('Indice indisponible', 'info'); }
    setThinking(false);
  }
  function end(c: Chess, h: Move[], resigned = false, flag?: 'w' | 'b') {
    let result: '1-0' | '0-1' | '1/2-1/2' = '1/2-1/2'; let text = gameOverText(c) || '';
    if (resigned) { result = color === 'w' ? '0-1' : '1-0'; text = 'Tu as abandonné'; }
    pauseFor('over'); live.current.over = true;
    let how: string = resigned ? 'resign' : flag ? 'timeout' : c.isCheckmate() ? 'mate' : c.isStalemate() ? 'stalemate' : 'draw';
    if (flag) { const other = flag === 'w' ? 'b' : 'w'; if (canMate(c, other)) { result = flag === 'w' ? '0-1' : '1-0'; text = 'Temps écoulé'; } else { text = 'Nulle — temps écoulé, mais matériel insuffisant pour mater'; how = 'draw'; } }
    if (!resigned && !flag && c.isCheckmate()) result = c.turn() === 'w' ? '0-1' : '1-0';
    const won = (result === '1-0' && color === 'w') || (result === '0-1' && color === 'b');
    const lost = (result === '1-0' && color === 'b') || (result === '0-1' && color === 'w');
    play(won ? 'win' : lost ? 'lose' : 'notify'); say(won ? bot.lines.lose : lost ? bot.lines.win : bot.lines.draw);
    const me0 = getState().settings.name || 'Moi';
    const hd = { Event: 'Partie amicale', Site: 'Maître des Échecs', Date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'), White: color === 'w' ? me0 : bot.name, Black: color === 'b' ? me0 : bot.name, Result: result };
    let pgn: string;
    if (clk.current) pgn = pgnWithClock(h.map((m) => m.san), clocks.current, hd, { base: tc.base * 1000, inc: tc.inc * 1000 }); // [%clk] (format Lichess)
    else { const pgnCh = new Chess(); for (const m of h) tryMove(pgnCh, m.san); for (const [k, v] of Object.entries(hd)) pgnCh.header(k, v); pgn = pgnCh.pgn(); }
    const myClockMs = clk.current ? clk.current.remaining(color, Date.now()) : undefined;
    log('game_end', { gid: gid.current, result, how, plies: h.length, myClockMs });
    const rec: any = { id: gid.current, date: Date.now(), botId: bot.id, color, result, pgn, moves: h.map((m) => m.san) };
    if (tc.base) rec.tc = { base: tc.base, inc: tc.inc };
    if (detailAllowed() && myTimes.current.length) rec.times = myTimes.current.filter((x) => x != null);
    setState((s) => { s.games = [...s.games.filter((g) => g.id !== rec.id), rec].slice(-100); markPlanDone(s, 'play'); });
    addXp(won ? 25 + Math.round(bot.elo / 100) : 10, won ? `Victoire contre ${bot.name}` : 'Partie jouée');
    checkBadges();
    setOver({ text: won ? `Victoire ! ${text}` : lost ? `Défaite. ${text}` : text, result, id: rec.id });
  }
  if (setup) return (
    <div class="page game-setup">
      <NavBar back="#/play" backLabel="Jouer" />
      <div class="bot-hero" style={{ '--c': bot.color } as any}><BotAvatar bot={bot} size={104} /><h1>{bot.name}</h1><p class="bh-style">{bot.style} · {bot.elo} Elo</p><p class="bh-calib muted small">{calibText(bot)}</p><p>{bot.bio}</p></div>
      <div class="section-label">Tu joues</div>
      <div class="color-pick" role="radiogroup" aria-label="Couleur">
        {([['w', 'Blancs'], ['r', 'Hasard'], ['b', 'Noirs']] as const).map(([k, l]) => (
          <button class={'color-opt ' + (pick === k ? 'on' : '')} role="radio" aria-checked={pick === k} onClick={() => setPick(k)}>
            <span class={'kq ' + k}><Icon name={k === 'r' ? 'dice' : 'king'} size={26} /></span>{l}
          </button>
        ))}
      </div>
      <div class="section-label">Cadence</div>
      <div class="color-pick tc-pick" role="radiogroup" aria-label="Cadence">
        {TCS.map((x) => (
          <button class={'color-opt ' + (tcId === x.id ? 'on' : '')} role="radio" aria-checked={tcId === x.id} onClick={() => { setTcId(x.id); setState((s) => { s.settings.playTc = x.id; }); }}>
            <b>{x.label}</b><small class="muted">{x.sub}</small>
          </button>
        ))}
      </div>
      <div class="list">
        <label class="item switch-row"><span class="it-icon" style="--c:#30A46C"><Icon name="message" size={18} /></span><span class="it-main"><span class="it-title">Mode coach</span><span class="it-sub">Il juge chaque coup et te laisse reprendre une gaffe.</span></span><input type="checkbox" class="switch" checked={coachOn} onChange={(e) => { setCoachOn((e.target as HTMLInputElement).checked); setState((s) => { s.settings.coachInPlay = (e.target as HTMLInputElement).checked; }); }} /></label>
      </div>
      <div class="sticky-cta"><button class="btn primary lg" onClick={() => start(pick)}>Commencer la partie</button></div>
    </div>
  );
  const orient = color === 'w' ? 'white' : 'black';
  const cap = captured(ch); const mat = material(ch).diff * (color === 'w' ? 1 : -1);
  const myCaps = color === 'w' ? cap.w : cap.b; const botCaps = color === 'w' ? cap.b : cap.w;
  const ROLE: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' };
  const capsOf = (list: string[], c: 'white' | 'black') => <span class="caps cg-wrap" aria-label={`${list.length} pièce${list.length > 1 ? 's' : ''} prise${list.length > 1 ? 's' : ''}`}>{list.map((t) => <piece class={`${ROLE[t]} ${c}`} />)}</span>;
  const op = openingName(hist.map((m) => m.san));
  const myTurn = !over && !thinking && turnColor(ch) === orient;
  const curHint = hint && hint.fen === ch.fen() ? hint.hs[hint.lvl - 1] : null;
  return (
    <div class="page game">
      <div class="game-top">
        <a class="nb-btn round" href="#/play" aria-label="Quitter la partie" onClick={(e) => { if (hist.length > 1 && !over && !confirm('Quitter la partie en cours ?')) e.preventDefault(); }}><Icon name="close" size={18} stroke={2.5} /></a>
        <div class="gt-title">{op ? <span class="opening-name">{op}</span> : <span class="muted">{bot.name} · {bot.elo}</span>}</div>
        <button class={'nb-btn round ' + (coachOn ? 'on' : '')} aria-pressed={coachOn} aria-label="Mode coach" title="Mode coach" onClick={() => { const v = !coachOn; setCoachOn(v); setState((s) => { s.settings.coachInPlay = v; }); }}><Icon name="message" size={18} /></button>
      </div>
      <div class="play-grid">
        <div class="board-col">
          <div class="player-bar">
            <BotAvatar bot={bot} size={36} /><span class="pb-name"><b>{bot.name}</b><small class="elo tnum">{bot.elo}</small></span>
            {thinking ? <span class="thinking" aria-label="Réfléchit">…</span> : capsOf(botCaps, color === 'w' ? 'white' : 'black')}{!thinking && mat < 0 && <small class="adv">+{-mat}</small>}{clockEl(color === 'w' ? 'b' : 'w')}
          </div>
          {chat && <div class="bubble" key={chat}>{chat}</div>}
          <Board fen={ch.fen()} orientation={orient} turn={turnColor(ch)} movable={thinking || over || (coach?.undoable && coach.cls === 'blunder') ? 'none' : orient}
            dests={legalDests(ch)} lastMove={hist.length ? [hist[hist.length - 1].from, hist[hist.length - 1].to] : null} check={!!checkSquare(ch)}
            onMove={(f, t, p) => { onMove(f, t, p); return true; }} promotionCheck={(f, t) => isPromotion(ch, f, t)} onTouch={onTouch}
            shapes={curHint ? curHint.arrows.map((a) => ({ orig: a.orig as any, dest: a.dest as any, brush: a.brush })) : coach && coach.undoable ? coach.ex.arrows.map((a) => ({ orig: a.orig as any, dest: a.dest as any, brush: a.brush })) : []}
            highlight={curHint ? new Map(curHint.marks.map((mk) => [mk.sq, 'mk-' + mk.kind])) : coach && coach.undoable ? new Map(coach.ex.marks.map((mk) => [mk.sq, 'mk-' + mk.kind])) : undefined} />
          <div class="player-bar me">
            <span class="me-avatar">{(settings.name || 'T').slice(0, 1).toUpperCase()}</span><span class="pb-name"><b>{settings.name || 'Toi'}</b>{myTurn && <small class="your-turn">À toi de jouer</small>}</span>
            {capsOf(myCaps, color === 'w' ? 'black' : 'white')}{mat > 0 && <small class="adv">+{mat}</small>}{clockEl(color)}
          </div>
        </div>
        <aside class="side">
          {curHint && (
            <div class="coach-hint" aria-live="polite">
              <div class="hb-lvl"><Icon name="bulb" size={14} />Indice {hint!.lvl}/{hint!.hs.length} · {curHint.title}<span class="hint-steps" aria-hidden="true">{hint!.hs.map((_, i) => <i class={i < hint!.lvl ? 'on' : ''} />)}</span></div>
              <p>{curHint.text}</p>
            </div>
          )}
          {coach && (
            <div class={'coach-box cls-' + coach.cls}>
              <div class="coach-head"><span class="cls-badge" style={{ background: CLASSES[coach.cls].color }}>{CLASSES[coach.cls].symbol}</span><b>{sanFr(coach.san)} · {CLASSES[coach.cls].label}</b></div>
              {coach.ex.headline && coach.ex.headline !== CLASSES[coach.cls].label && <h4>{coach.ex.headline}</h4>}
              <p>{coach.ex.why}</p>
              {coach.undoable && coach.ex.plan && <p class="cb-line">{coach.ex.plan}</p>}
              {coach.undoable && <div class="row"><button class="btn small primary" onClick={takeback}><Icon name="undo" size={16} />Reprendre ce coup</button>{coach.cls === 'blunder' && <button class="btn small secondary" onClick={continueAfterBlunder}>Continuer quand même</button>}</div>}
            </div>
          )}
          {hist.length > 0 && <div class="moves-inline" aria-label="Coups joués">{hist.map((m, i) => <span class={'mv ' + (i === hist.length - 1 ? 'cur' : '')}>{i % 2 === 0 ? <i>{i / 2 + 1}.</i> : ''}{sanFr(m.san)}</span>)}</div>}
          {takebacks > 0 && <p class="muted small">Coups repris : {takebacks}</p>}
          {tc.base > 0 && <span class="sr-only" aria-live="polite">{srClock}</span>}
          <div class="actionbar">
            <button class="tool" onClick={getHint} disabled={thinking || !!over || !!(curHint && hint!.lvl >= hint!.hs.length)}><Icon name="bulb" size={22} />{curHint ? (hint!.lvl < hint!.hs.length ? 'Indice suivant' : 'Indice') : 'Indice'}</button>
            <button class="tool" onClick={takeback} disabled={thinking || hist.length === 0}><Icon name="undo" size={22} />Annuler</button>
            <button class="tool" onClick={() => { if (confirm('Abandonner la partie ?')) end(ch, hist, true); }} disabled={!!over || hist.length < 2}><Icon name="flag" size={22} />Abandonner</button>
          </div>
        </aside>
      </div>
      <Modal open={!!over} onClose={() => setOver(null)} title="Partie terminée">
        <div class="over">
          <BotAvatar bot={bot} size={64} />
          <p class="big-result">{over?.text}</p>
          {/* pas d'impasse : la revanche part seule (couleurs inversées), le bilan est à un toucher à côté */}
          {over && <AutoNext key={over.id} ms={8000} count stop="Pas maintenant" onGo={() => start(color === 'w' ? 'b' : 'w')}
            extra={<button class="btn secondary lg" onClick={() => go(`/game/${over.id}`)}><Icon name="microscope" size={18} />Voir le bilan</button>}>
            <Icon name="swords" size={18} />Revanche</AutoNext>}
          <a class="btn plain" href="#/play">Changer d’adversaire</a>
        </div>
      </Modal>
    </div>
  );
}
