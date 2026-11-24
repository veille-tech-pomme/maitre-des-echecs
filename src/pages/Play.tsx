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

/** Cadences (audit Magnus B7 : pendule contre les bots). */
export const TCS = [
  { id: 'none', label: 'Sans pendule', sub: 'Prends ton temps', base: 0, inc: 0 },
  { id: '10+0', label: 'Rapide', sub: '10 min', base: 600, inc: 0 },
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
  const [tcId, setTcId] = useState<string>(settings.playTc || 'none');
  const tc = TCS.find((x) => x.id === tcId) || TCS[0];
  const clock = useRef({ w: 0, b: 0 }); const myStart = useRef(0); const botStart = useRef(0); const [, tick] = useState(0);
  const evalCache = useRef(new Map<string, PvLine[]>());
  const gid = useRef('');
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; engine.stopAll(); }, []);
  useEffect(() => {
    if (!tc.base || setup || over) return;
    const id = setInterval(() => {
      tick((x) => x + 1);
      const me = color; const mine = ch.turn() === me && !thinking && !(coach?.undoable && coach.cls === 'blunder');
      if (mine && clock.current[me] - (Date.now() - myStart.current) <= 0) end(ch, hist, false, me);
    }, 200);
    return () => clearInterval(id);
  });
  const liveClock = (side: 'w' | 'b') => {
    let t = clock.current[side];
    if (!over) { if (side === color && ch.turn() === side && !thinking && !(coach?.undoable && coach.cls === 'blunder')) t -= Date.now() - myStart.current; else if (side !== color && botStart.current) t -= Date.now() - botStart.current; }
    return t;
  };
  const clockEl = (side: 'w' | 'b') => { if (!tc.base) return null; const t = liveClock(side); const active = !over && ch.turn() === side; return <span class={'clock tnum' + (active ? ' on' : '') + (t < 20000 ? ' low' : '')} role="timer" aria-label={`Pendule ${side === color ? 'toi' : bot.name} : ${fmtClock(t)}`}>{fmtClock(t)}</span>; };
  const say = (arr: string[]) => setChat(arr[Math.floor(Math.random() * arr.length)]);

  const start = (c: 'w' | 'b' | 'r') => {
    const col = c === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : c;
    engine.stopAll(); engine.newGame();
    clock.current = { w: tc.base * 1000, b: tc.base * 1000 }; myStart.current = Date.now(); botStart.current = 0;
    setColor(col); const n = new Chess(); setCh(n); setHist([]); setCoach(null); setHint(null); setOver(null); setTakebacks(0); setSetup(false);
    gid.current = 'g' + Date.now().toString(36); say(bot.lines.hello); evalCache.current.clear();
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
    setThinking(true);
    const t0 = Date.now(); botStart.current = t0;
    let u = '';
    try { u = await botMove(bot, c.fen(), h.map((m) => m.san)); } catch (e) { console.warn(e); }
    if (!alive.current) return;
    const wait = Math.max(0, (bot.elo < 1000 ? 700 : 400) - (Date.now() - t0));
    await new Promise((r) => setTimeout(r, wait));
    const n = new Chess(c.fen()); const m = u ? tryMove(n, u) : null;
    if (!m) { const any = n.moves()[0]; if (!any) return end(c, h); tryMove(n, any); }
    const mm = m || n.history({ verbose: true }).slice(-1)[0];
    if (tc.base) { const bc = mm.color; clock.current[bc] -= Date.now() - t0; if (clock.current[bc] <= 0) { botStart.current = 0; setThinking(false); return end(c, h, false, bc); } clock.current[bc] += tc.inc * 1000; }
    botStart.current = 0; myStart.current = Date.now();
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
    if (tc.base) { clock.current[m.color] -= Date.now() - myStart.current; if (clock.current[m.color] <= 0) { end(ch, hist, false, m.color); return false; } clock.current[m.color] += tc.inc * 1000; }
    playForMove(m); const nh = [...hist, m]; setCh(n); setHist(nh); setHint(null); setCoach(null);
    if (coachOn && !n.isGameOver()) {
      setThinking(true);
      const lb = await analyse(before); const la = await analyse(n.fen());
      if (!alive.current) return true;
      const cc = await coachClient(); if (!alive.current) return true;
      const uci = m.from + m.to + (m.promotion || '');
      const rv = cc.assessLive(before, uci, lb, la, cc.currentElo(), nh.length - 1, hist.map((x) => x.san));
      setCoach({ cls: rv.cls, ex: rv.ex, san: m.san, best: lb[0]?.move || uci, undoable: ['mistake', 'blunder', 'miss'].includes(rv.cls) });
      if (rv.cls === 'blunder') { play('error'); setThinking(false); return true; } // attend la décision (reprendre ou continuer)
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
    setCh(n); setHist(hist.slice(0, k)); setCoach(null); setHint(null); setTakebacks((t) => t + 1); setOver(null); myStart.current = Date.now();
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
    else if (flag) { const other = flag === 'w' ? 'b' : 'w'; clock.current[flag] = 0; if (canMate(c, other)) { result = flag === 'w' ? '0-1' : '1-0'; text = 'Temps écoulé'; } else text = 'Nulle — temps écoulé, mais matériel insuffisant pour mater'; }
    else if (c.isCheckmate()) result = c.turn() === 'w' ? '0-1' : '1-0';
    const won = (result === '1-0' && color === 'w') || (result === '0-1' && color === 'b');
    const lost = (result === '1-0' && color === 'b') || (result === '0-1' && color === 'w');
    play(won ? 'win' : lost ? 'lose' : 'notify'); say(won ? bot.lines.lose : lost ? bot.lines.win : bot.lines.draw);
    const pgnCh = new Chess(); for (const m of h) tryMove(pgnCh, m.san);
    pgnCh.header('Event', 'Partie amicale', 'Site', 'Maître des Échecs', 'Date', new Date().toISOString().slice(0, 10).replace(/-/g, '.'), 'White', color === 'w' ? (getState().settings.name || 'Moi') : bot.name, 'Black', color === 'b' ? (getState().settings.name || 'Moi') : bot.name, 'Result', result);
    const rec = { id: gid.current, date: Date.now(), botId: bot.id, color, result, pgn: pgnCh.pgn(), moves: h.map((m) => m.san) };
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
            onMove={(f, t, p) => { onMove(f, t, p); return true; }} promotionCheck={(f, t) => isPromotion(ch, f, t)}
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
