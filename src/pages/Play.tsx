import { useEffect, useRef, useState } from 'preact/hooks';
import { Board } from '../components/Board';
import { Modal, toast } from '../components/ui';
import { BOTS, botById, type Bot } from '../data/bots';
import { Chess, legalDests, turnColor, checkSquare, isPromotion, tryMove, captured, material, gameOverText, sanFr, type Move } from '../lib/chess';
import { engine, type PvLine } from '../lib/engine';
import { botMove } from '../lib/bot-move';
import { assessMove, CLASS_INFO, type ReviewMove } from '../lib/review';
import { playForMove, play } from '../lib/sound';
import { useStore, setState, addXp, getState } from '../lib/store';
import { recommendedBot, markPlanDone } from '../lib/plan';
import { checkBadges } from '../lib/progress';
import { openingName } from '../data/openings';
import { go } from '../lib/router';

export function BotSelect() {
  const s = useStore((x) => x);
  const rec = recommendedBot(s);
  return (
    <div class="page">
      <h1>Jouer contre l’IA</h1>
      <p class="muted">9 adversaires avec leur personnalité, de la débutante absolue au moteur à pleine puissance. Tous gratuits, sans limite.</p>
      <div class="bot-grid">
        {BOTS.map((b) => {
          const games = s.games.filter((g) => g.botId === b.id); const wins = games.filter((g) => (g.result === '1-0' && g.color === 'w') || (g.result === '0-1' && g.color === 'b')).length;
          return (
            <a class={'bot-card ' + (b.id === rec ? 'rec' : '')} href={`#/play/${b.id}`} style={{ '--c': b.color } as any}>
              {b.id === rec && <span class="pill rec-pill">Recommandé</span>}
              <span class="bot-avatar">{b.avatar}</span>
              <b>{b.name}</b><small class="elo">{b.elo}</small>
              <small class="muted">{b.style}</small>
              {games.length > 0 && <small class="muted">{wins} victoire{wins > 1 ? 's' : ''} / {games.length}</small>}
            </a>
          );
        })}
      </div>
    </div>
  );
}

interface Coach { review: ReviewMove; undoable: boolean }
export function Game({ botId }: { botId: string }) {
  const bot = botById(botId);
  const settings = useStore((s) => s.settings);
  const [setup, setSetup] = useState(true);
  const [color, setColor] = useState<'w' | 'b'>('w');
  const [coachOn, setCoachOn] = useState(settings.coachInPlay);
  const [ch, setCh] = useState(() => new Chess());
  const [hist, setHist] = useState<Move[]>([]);
  const [thinking, setThinking] = useState(false);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [chat, setChat] = useState<string>('');
  const [over, setOver] = useState<{ text: string; result: string; id: string } | null>(null);
  const [takebacks, setTakebacks] = useState(0);
  const evalCache = useRef(new Map<string, PvLine[]>());
  const gid = useRef('');
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; engine.stopAll(); }, []);
  const say = (arr: string[]) => setChat(arr[Math.floor(Math.random() * arr.length)]);

  const start = (c: 'w' | 'b' | 'r') => {
    const col = c === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : c;
    engine.stopAll(); engine.newGame();
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
    const t0 = Date.now();
    let u = '';
    try { u = await botMove(bot, c.fen(), h.map((m) => m.san)); } catch (e) { console.warn(e); }
    if (!alive.current) return;
    const wait = Math.max(0, (bot.elo < 1000 ? 700 : 400) - (Date.now() - t0));
    await new Promise((r) => setTimeout(r, wait));
    const n = new Chess(c.fen()); const m = u ? tryMove(n, u) : null;
    if (!m) { const any = n.moves()[0]; if (!any) return end(c, h); tryMove(n, any); }
    const mm = m || n.history({ verbose: true }).slice(-1)[0];
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
    playForMove(m); const nh = [...hist, m]; setCh(n); setHist(nh); setHint(null); setCoach(null);
    if (coachOn && !n.isGameOver()) {
      setThinking(true);
      const lb = await analyse(before); const la = await analyse(n.fen());
      if (!alive.current) return true;
      const rv = assessMove(before, m, lb, la, nh.length - 1, hist);
      setCoach({ review: rv, undoable: ['mistake', 'blunder', 'miss'].includes(rv.cls) });
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
    setCh(n); setHist(hist.slice(0, k)); setCoach(null); setHint(null); setTakebacks((t) => t + 1); setOver(null);
  }
  async function getHint() {
    if (thinking) return; setThinking(true);
    const r = await engine.analyse(ch.fen(), { depth: 14 }); setThinking(false);
    if (r.best) { setHint(r.best); const c = new Chess(ch.fen()); const m = tryMove(c, r.best); if (m) toast(`Indice : regarde ${sanFr(m.san).replace(/[+#]/g, '')}`, '💡'); }
  }
  function end(c: Chess, h: Move[], resigned = false) {
    let result: '1-0' | '0-1' | '1/2-1/2' = '1/2-1/2'; let text = gameOverText(c) || '';
    if (resigned) { result = color === 'w' ? '0-1' : '1-0'; text = 'Tu as abandonné'; }
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
      <a class="back" href="#/play">‹ Adversaires</a>
      <div class="bot-hero" style={{ '--c': bot.color } as any}><span class="bot-avatar big">{bot.avatar}</span><div><h1>{bot.name} <small class="elo">{bot.elo}</small></h1><p class="muted">{bot.style}</p><p>{bot.bio}</p></div></div>
      <label class="switch-row"><input type="checkbox" checked={coachOn} onChange={(e) => { setCoachOn((e.target as HTMLInputElement).checked); setState((s) => { s.settings.coachInPlay = (e.target as HTMLInputElement).checked; }); }} /><span><b>Mode coach</b><small class="muted">Le coach évalue chacun de tes coups, t’explique tes erreurs et te propose de reprendre une gaffe.</small></span></label>
      <h3>Tu joues…</h3>
      <div class="row">
        <button class="btn big" onClick={() => start('w')}>⚪ Blancs</button>
        <button class="btn big" onClick={() => start('r')}>🎲 Au hasard</button>
        <button class="btn big" onClick={() => start('b')}>⚫ Noirs</button>
      </div>
    </div>
  );
  const orient = color === 'w' ? 'white' : 'black';
  const cap = captured(ch); const mat = material(ch).diff * (color === 'w' ? 1 : -1);
  const myCaps = color === 'w' ? cap.w : cap.b; const botCaps = color === 'w' ? cap.b : cap.w;
  const sym = (t: string, c: 'w' | 'b') => ({ p: c === 'w' ? '♙' : '♟', n: c === 'w' ? '♘' : '♞', b: c === 'w' ? '♗' : '♝', r: c === 'w' ? '♖' : '♜', q: c === 'w' ? '♕' : '♛' } as any)[t];
  const op = openingName(hist.map((m) => m.san));
  return (
    <div class="page game">
      <div class="play-grid">
        <div class="board-col">
          <div class="player-bar">
            <span class="bot-avatar sm">{bot.avatar}</span><b>{bot.name}</b><small class="elo">{bot.elo}</small>
            <span class="caps">{botCaps.map((t) => sym(t, color))}{mat < 0 && <small> +{-mat}</small>}</span>
            {thinking && <span class="thinking">● ● ●</span>}
          </div>
          {chat && <div class="bubble" key={chat}>{chat}</div>}
          <Board fen={ch.fen()} orientation={orient} turn={turnColor(ch)} movable={thinking || over || (coach?.undoable && coach.review.cls === 'blunder') ? 'none' : orient}
            dests={legalDests(ch)} lastMove={hist.length ? [hist[hist.length - 1].from, hist[hist.length - 1].to] : null} check={!!checkSquare(ch)}
            onMove={(f, t, p) => { onMove(f, t, p); return true; }} promotionCheck={(f, t) => isPromotion(ch, f, t)}
            shapes={hint ? [{ orig: hint.slice(0, 2) as any, dest: hint.slice(2, 4) as any, brush: 'blue' }] : coach && coach.undoable ? [{ orig: coach.review.best.slice(0, 2) as any, dest: coach.review.best.slice(2, 4) as any, brush: 'green' }] : []} />
          <div class="player-bar me">
            <span class="bot-avatar sm">🙂</span><b>{settings.name || 'Toi'}</b>
            <span class="caps">{myCaps.map((t) => sym(t, color === 'w' ? 'b' : 'w'))}{mat > 0 && <small> +{mat}</small>}</span>
          </div>
        </div>
        <aside class="side card">
          {op && <p class="opening-name">📖 {op}</p>}
          {coach && (
            <div class={'coach-box cls-' + coach.review.cls}>
              <div class="coach-head"><span class="cls-badge" style={{ background: CLASS_INFO[coach.review.cls].color }}>{CLASS_INFO[coach.review.cls].symbol}</span><b>{sanFr(coach.review.san)} : {CLASS_INFO[coach.review.cls].label}</b></div>
              <p>{coach.review.coach}</p>
              {coach.undoable && <div class="row"><button class="btn small primary" onClick={takeback}>↶ Reprendre ce coup</button>{coach.review.cls === 'blunder' && <button class="btn small ghost" onClick={continueAfterBlunder}>Continuer quand même</button>}</div>}
            </div>
          )}
          {!coach && coachOn && <p class="muted small">🧑‍🏫 Le coach commentera ton prochain coup.</p>}
          <div class="moves-inline">{hist.map((m, i) => <span class="mv">{i % 2 === 0 ? `${i / 2 + 1}.` : ''}{sanFr(m.san)} </span>)}</div>
          <div class="row wrap">
            <button class="btn ghost" onClick={getHint} disabled={thinking || !!over}>💡 Indice</button>
            <button class="btn ghost" onClick={takeback} disabled={thinking || hist.length === 0}>↶ Annuler</button>
            <button class="btn ghost" onClick={() => { if (confirm('Abandonner la partie ?')) end(ch, hist, true); }} disabled={!!over || hist.length < 2}>🏳️ Abandonner</button>
          </div>
          {takebacks > 0 && <p class="muted small">Coups repris : {takebacks}</p>}
        </aside>
      </div>
      <Modal open={!!over} onClose={() => setOver(null)} title="Partie terminée">
        <p class="big-result">{over?.text}</p>
        <div class="col">
          <button class="btn primary" onClick={() => go(`/game/${over!.id}`)}>🔬 Bilan de la partie</button>
          <button class="btn ghost" onClick={() => { setOver(null); setSetup(true); }}>↻ Nouvelle partie</button>
          <a class="btn ghost" href="#/play">Changer d’adversaire</a>
        </div>
      </Modal>
    </div>
  );
}
