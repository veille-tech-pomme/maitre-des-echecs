// Modes d'entraînement : coordonnées, vision, mémoire (« Rejoue la position »), mats contre l'ordinateur, « Devine le coup ».
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Board } from '../components/Board';
import { PlayGoal } from '../components/Exercises';
import { Progress, toast, NavBar, Item } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { Chess, tryMove, legalDests, turnColor, isPromotion, sanFr, moveToUci, type Move } from '../lib/chess';
import { useStore, setState, addXp } from '../lib/store';
import { engine, whiteScore } from '../lib/engine';
import { pickPuzzle, type BankPuzzle } from '../lib/puzzlebank';
import { playForMove, play } from '../lib/sound';

const FILES = 'abcdefgh'; const rndSq = () => FILES[Math.floor(Math.random() * 8)] + (1 + Math.floor(Math.random() * 8));
const EMPTY = '8/8/8/8/8/8/8/8 w - - 0 1';
const best = (k: string) => (useStore((s) => s.training?.[k]) || {}) as any;
const saveBest = (k: string, v: Record<string, number>) => setState((s) => { const t = (s.training[k] ||= {}); for (const [a, b] of Object.entries(v)) t[a] = Math.max(t[a] || 0, b); });

export function TrainingHub() {
  const t = useStore((s) => s.training || {});
  const modes = [
    { href: '#/train/coords', icon: 'grid' as IconName, color: '#0A84FF', title: 'Coordonnées', desc: 'Trouve un maximum de cases en 30 secondes.', stat: t.coords?.best ? `Record : ${t.coords.best}` : '' },
    { href: '#/train/name', icon: 'hash' as IconName, color: '#5E5CE6', title: 'Nomme la case', desc: 'Une case s’allume : quel est son nom ?', stat: t.name?.best ? `Record : ${t.name.best}` : '' },
    { href: '#/train/vision', icon: 'play' as IconName, color: '#30A46C', title: 'Vision du cavalier', desc: 'Combien de coups faut-il au cavalier pour atteindre la case ?', stat: t.vision?.best ? `Record : ${t.vision.best}` : '' },
    { href: '#/train/memory', icon: 'brain' as IconName, color: '#BF5AF2', title: 'Rejoue la position', desc: 'Mémorise une position puis reconstruis-la de tête.', stat: t.memory?.best ? `Meilleur niveau : ${t.memory.best}` : '' },
    { href: '#/train/mates', icon: 'king' as IconName, color: '#FF453A', title: 'Mats contre l’ordinateur', desc: 'Mat en 2 à 5 coups : le moteur défend au mieux.', stat: t.mates?.solved ? `${t.mates.solved} mats réussis` : '' },
    { href: '#/train/guess', icon: 'trophy' as IconName, color: '#F2B544', title: 'Devine le coup', desc: 'Joue à la place des champions du monde, coup par coup.', stat: t.guess?.best ? `Record : ${t.guess.best} %` : '' },
  ];
  return (
    <div class="page">
      <NavBar back="#/learn" backLabel="Apprendre" />
      <h1 class="page-title">Entraînement</h1>
      <p class="muted page-sub">Des exercices courts pour la vision, la mémoire et le calcul.</p>
      <div class="list train-list">{modes.map((m) => <Item href={m.href} icon={m.icon} color={m.color} title={m.title} sub={m.stat || m.desc} large />)}</div>
    </div>
  );
}
function Top({ title }: { title: string }) { return <div class="game-top"><a class="nb-btn round" href="#/train" aria-label="Fermer"><Icon name="close" size={18} stroke={2.5} /></a><div class="gt-title">{title}</div><span /></div>; }

export function Coordinates() {
  const rec = best('coords'); const [color, setColor] = useState<'white' | 'black'>('white'); const [run, setRun] = useState(false);
  const [target, setTarget] = useState(rndSq()); const [score, setScore] = useState(0); const [left, setLeft] = useState(30); const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => { if (!run) return; const t = setInterval(() => setLeft((l) => { if (l <= 1) { clearInterval(t); setRun(false); return 0; } return l - 1; }), 1000); return () => clearInterval(t); }, [run]);
  useEffect(() => { if (!run && left === 0) { saveBest('coords', { best: score }); if (score > (rec.best || 0) && score > 0) toast(`Nouveau record : ${score}`, 'trophy'); addXp(Math.min(20, score), 'Coordonnées'); } }, [run, left]);
  const click = (sq: string) => { if (!run) return; if (sq === target) { setScore((s) => s + 1); play('move'); setFlash(null); let n = rndSq(); while (n === target) n = rndSq(); setTarget(n); } else { setFlash(sq); play('error'); setTimeout(() => setFlash(null), 400); } };
  return (
    <div class="page"><Top title="Coordonnées" />
      <div class="play-grid">
        <div class="coords-wrap"><Board fen={EMPTY} orientation={color} movable="none" coordinates={!run} onSquare={click} highlight={flash ? new Map([[flash, 'wrong']]) : undefined} />{run && <div class="coord-target">{target}</div>}</div>
        <aside class="side card">
          {run ? <><p class="big-num">{score}</p><Progress value={left / 30} /><p class="muted">{left} s · clique sur <b>{target}</b></p></> : <>
            <p>Clique sur la case demandée le plus vite possible. Les coordonnées sont masquées pendant l’exercice.</p>
            <div class="row"><button class={'chip ' + (color === 'white' ? 'on' : '')} onClick={() => setColor('white')}>Côté Blancs</button><button class={'chip ' + (color === 'black' ? 'on' : '')} onClick={() => setColor('black')}>Côté Noirs</button></div>
            {left === 0 && <p class="success-box">Score : <b>{score}</b>{rec.best ? ` · record ${Math.max(rec.best, score)}` : ''}</p>}
            <button class="btn primary" onClick={() => { setScore(0); setLeft(30); setTarget(rndSq()); setRun(true); }}>{left === 0 ? 'Rejouer' : 'Démarrer'}</button></>}
        </aside>
      </div>
    </div>
  );
}

export function NameSquare() {
  const rec = best('name'); const [sq, setSq] = useState(rndSq()); const [score, setScore] = useState(0); const [n, setN] = useState(0); const [color, setColor] = useState<'white' | 'black'>('white'); const [wrong, setWrong] = useState<string | null>(null);
  const opts = useMemo(() => { const s = new Set([sq]); while (s.size < 4) s.add(rndSq()); return [...s].sort(() => Math.random() - 0.5); }, [sq]);
  const total = 20; const done = n >= total;
  const answer = (o: string) => { if (done) return; const ok = o === sq; if (ok) { setScore(score + 1); play('move'); } else { setWrong(sq); play('error'); }
    setTimeout(() => { setWrong(null); const k = n + 1; setN(k); if (k >= total) { saveBest('name', { best: score + (ok ? 1 : 0) }); addXp(10, 'Nomme la case'); } else setSq(rndSq()); }, ok ? 150 : 700); };
  return (
    <div class="page"><Top title="Nomme la case" />
      <div class="play-grid">
        <Board fen={EMPTY} orientation={color} viewOnly coordinates={false} highlight={new Map([[wrong || sq, wrong ? 'wrong' : 'target']])} />
        <aside class="side card">
          {done ? <><p class="success-box">Score : <b>{score}/{total}</b>{rec.best ? ` · record ${Math.max(rec.best, score)}` : ''}</p><button class="btn primary" onClick={() => { setN(0); setScore(0); setSq(rndSq()); }}>Rejouer</button></> : <>
            <p class="muted">Question {n + 1}/{total} · {score} bonnes réponses</p>
            <div class="quiz-opts">{opts.map((o) => <button class="btn ghost big" onClick={() => answer(o)}>{o}</button>)}</div>
            <div class="row"><button class={'chip ' + (color === 'white' ? 'on' : '')} onClick={() => setColor('white')}>Blancs</button><button class={'chip ' + (color === 'black' ? 'on' : '')} onClick={() => setColor('black')}>Noirs</button></div></>}
        </aside>
      </div>
    </div>
  );
}

function knightDist(a: string, b: string) { // BFS
  const q: [string, number][] = [[a, 0]]; const seen = new Set([a]);
  while (q.length) { const [s, d] = q.shift()!; if (s === b) return d; const f = s.charCodeAt(0) - 97, r = +s[1] - 1;
    for (const [df, dr] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) { const nf = f + df, nr = r + dr; if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue; const n = FILES[nf] + (nr + 1); if (!seen.has(n)) { seen.add(n); q.push([n, d + 1]); } } }
  return -1;
}
export function KnightVision() {
  const rec = best('vision'); const gen = () => { let a = rndSq(), b = rndSq(); while (a === b) b = rndSq(); return [a, b]; };
  const [[from, to], setP] = useState(gen()); const [score, setScore] = useState(0); const [n, setN] = useState(0); const [res, setRes] = useState<string | null>(null);
  const d = knightDist(from, to); const total = 15; const done = n >= total;
  const fen = mapFen(new Map([[from, 'N']]));
  const answer = (k: number) => { const ok = k === d; setRes(ok ? 'Exact' : `Raté : il fallait ${d}`); if (ok) { setScore(score + 1); play('move'); } else play('error');
    setTimeout(() => { setRes(null); const m = n + 1; setN(m); if (m >= total) { saveBest('vision', { best: score + (ok ? 1 : 0) }); addXp(10, 'Vision du cavalier'); } else setP(gen()); }, ok ? 300 : 1200); };
  return (
    <div class="page"><Top title="Vision du cavalier" />
      <div class="play-grid">
        <Board fen={fen} viewOnly highlight={new Map([[to, 'target']])} />
        <aside class="side card">
          {done ? <><p class="success-box">Score : <b>{score}/{total}</b></p><button class="btn primary" onClick={() => { setN(0); setScore(0); setP(gen()); }}>Rejouer</button></> : <>
            <p>En combien de coups le cavalier de <b>{from}</b> peut-il atteindre <b>{to}</b> ?</p>
            <div class="quiz-opts">{[1, 2, 3, 4, 5, 6].map((k) => <button class="btn ghost big" onClick={() => !res && answer(k)}>{k}</button>)}</div>
            {res && <p class={'feedback ' + (res === 'Exact' ? 'good' : 'wrong')}><span><Icon name={res === 'Exact' ? 'checkCircle' : 'xCircle'} size={20} />{res}</span></p>}
            <p class="muted small">Question {n + 1}/{total} · {score} bonnes réponses{rec.best ? ` · record ${rec.best}` : ''}</p></>}
        </aside>
      </div>
    </div>
  );
}

// ---------- Mémoire : « Rejoue la position » ----------
const PALETTE = ['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p'];
const GLYPH: Record<string, string> = { K: 'Roi blanc', Q: 'Dame blanche', R: 'Tour blanche', B: 'Fou blanc', N: 'Cavalier blanc', P: 'Pion blanc', k: 'Roi noir', q: 'Dame noire', r: 'Tour noire', b: 'Fou noir', n: 'Cavalier noir', p: 'Pion noir' };
const ROLE_OF: Record<string, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
function boardMap(fen: string) { const m = new Map<string, string>(); fen.split(' ')[0].split('/').forEach((row, ri) => { let f = 0; for (const ch of row) { if (/\d/.test(ch)) f += +ch; else { m.set(FILES[f] + (8 - ri), ch); f++; } } }); return m; }
function mapFen(m: Map<string, string>) { let s = ''; for (let r = 8; r >= 1; r--) { let e = 0; for (let f = 0; f < 8; f++) { const p = m.get(FILES[f] + r); if (p) { if (e) s += e; e = 0; s += p; } else e++; } if (e) s += e; if (r > 1) s += '/'; } return s + ' w - - 0 1'; }
export function MemoryTrainer() {
  const rec = best('memory'); const [level, setLevel] = useState(1); const [phase, setPhase] = useState<'idle' | 'show' | 'build' | 'result'>('idle');
  const [target, setTarget] = useState<Map<string, string>>(new Map()); const [mine, setMine] = useState<Map<string, string>>(new Map()); const [tool, setTool] = useState('K'); const [left, setLeft] = useState(0);
  const pieces = 3 + level * 2; const secs = Math.max(5, 12 - level);
  async function start() {
    let p: BankPuzzle | null = null; for (let k = 0; k < 8; k++) { p = await pickPuzzle({ rating: 800 + level * 150, theme: level < 4 ? 'endgame' : undefined }); if (p && boardMap(p.f).size <= pieces + 2) break; }
    if (!p) return toast('Aucune position disponible', 'info');
    const c = new Chess(p.f); const u = p.m.split(' ')[0]; c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] as any });
    setTarget(boardMap(c.fen())); setMine(new Map()); setPhase('show'); setLeft(secs);
  }
  useEffect(() => { if (phase !== 'show') return; const t = setInterval(() => setLeft((l) => { if (l <= 1) { clearInterval(t); setPhase('build'); return 0; } return l - 1; }), 1000); return () => clearInterval(t); }, [phase]);
  const place = (sq: string) => { if (phase !== 'build') return; const m = new Map(mine); if (tool === 'x' || m.get(sq) === tool) m.delete(sq); else m.set(sq, tool); setMine(m); };
  const check = () => { setPhase('result'); const correct = [...target].filter(([s, p]) => mine.get(s) === p).length; const extra = [...mine].filter(([s, p]) => target.get(s) !== p).length; const perfect = correct === target.size && extra === 0;
    if (perfect) { play('win'); saveBest('memory', { best: level }); addXp(5 + level * 3, 'Mémoire'); } else play('error'); };
  const correct = [...target].filter(([s, p]) => mine.get(s) === p).length; const wrong = [...mine].filter(([s, p]) => target.get(s) !== p).length;
  const hl = phase === 'result' ? new Map<string, string>([...target].map(([s, p]) => [s, mine.get(s) === p ? 'good' : 'wrong'] as [string, string]).concat([...mine].filter(([s]) => !target.has(s)).map(([s]) => [s, 'wrong'] as [string, string]))) : undefined;
  return (
    <div class="page"><Top title="Rejoue la position" />
      <div class="play-grid">
        <Board fen={phase === 'show' ? mapFen(target) : phase === 'idle' ? EMPTY : mapFen(phase === 'result' ? target : mine)} movable="none" onSquare={place} highlight={hl} />
        <aside class="side card">
          {phase === 'idle' && <><p>Une position s’affiche pendant quelques secondes. Reconstruis-la ensuite pièce par pièce.</p>
            <label class="muted">Niveau {level} · ~{pieces} pièces · {secs} s</label><input type="range" min={1} max={8} value={level} onInput={(e) => setLevel(+(e.target as HTMLInputElement).value)} />
            {rec.best && <p class="muted small">Meilleur niveau réussi : {rec.best}</p>}<button class="btn primary" onClick={start}>Commencer</button></>}
          {phase === 'show' && <><p class="big-num">{left}</p><p>Mémorise ! ({target.size} pièces)</p></>}
          {phase === 'build' && <><p>Choisis une pièce puis clique sur les cases ({mine.size}/{target.size} placées).</p>
            <div class="palette">{PALETTE.map((p) => <button class={'pal ' + (tool === p ? 'on' : '')} onClick={() => setTool(p)} aria-label={GLYPH[p]}><span class="cg-wrap pal-piece"><piece class={ROLE_OF[p.toLowerCase()] + ' ' + (p === p.toUpperCase() ? 'white' : 'black')} /></span></button>)}<button class={'pal ' + (tool === 'x' ? 'on' : '')} onClick={() => setTool('x')} aria-label="Gomme"><Icon name="close" size={20} /></button></div>
            <button class="btn primary" onClick={check}>Vérifier</button></>}
          {phase === 'result' && <><p class={correct === target.size && !wrong ? 'success-box' : 'hint-box'}>{correct}/{target.size} pièces correctes{wrong ? `, ${wrong} erreur${wrong > 1 ? 's' : ''}` : ''}.</p>
            <p class="muted small">Le diagramme montre la position correcte (vert : trouvée, rouge : manquée ou fausse).</p>
            <div class="row"><button class="btn primary" onClick={() => { if (correct === target.size && !wrong && level < 8) setLevel(level + 1); start(); }}>{correct === target.size && !wrong ? 'Niveau suivant' : 'Réessayer'}</button><button class="btn ghost" onClick={() => setPhase('idle')}>Réglages</button></div></>}
        </aside>
      </div>
    </div>
  );
}

// ---------- Mats contre l'ordinateur ----------
export function MateDrills() {
  const rec = best('mates'); const [n, setN] = useState(2); const [p, setP] = useState<{ fen: string; r: number } | null>(null); const [reset, setReset] = useState(0); const [done, setDone] = useState(false); const [loading, setLoading] = useState(false);
  async function next(k = n) { setLoading(true); setDone(false); const pz = await pickPuzzle({ rating: 1000 + k * 200, min: 600, max: 2600, theme: `mateIn${k}` }); setLoading(false); if (!pz) return toast('Aucun puzzle disponible', 'info');
    const c = new Chess(pz.f); const u = pz.m.split(' ')[0]; c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] as any }); setP({ fen: c.fen(), r: pz.r }); setReset((x) => x + 1); }
  useEffect(() => { next(); }, []);
  return (
    <div class="page"><Top title="Mats contre l’ordinateur" />
      <div class="chips">{[2, 3, 4, 5].map((k) => <button class={'chip ' + (n === k ? 'on' : '')} onClick={() => { setN(k); next(k); }}>Mat en {k}</button>)}</div>
      {loading || !p ? <div class="loading">Chargement…</div> : <div class="play-grid">
        <PlayGoal fen={p.fen} result="mate" maxMoves={n} resetSignal={reset} onDone={() => { setDone(true); setState((s) => { const t = (s.training.mates ||= {}); t.solved = (t.solved || 0) + 1; }); addXp(5 + n * 3, `Mat en ${n}`); }} />
        <aside class="side card">
          <p><b>Mat en {n}</b> · difficulté {p.r}</p><p class="muted">Le moteur choisit la meilleure défense : chaque coup doit être précis. Une seule erreur et le mat s’envole.</p>
          {rec.solved ? <p class="muted small">{rec.solved} mats réussis au total</p> : null}
          <div class="row"><button class="btn secondary" onClick={() => setReset(reset + 1)}><Icon name="reset" size={18} />Recommencer</button><button class={'btn ' + (done ? 'primary' : 'secondary')} onClick={() => next()}>Suivant<Icon name="right" size={18} stroke={2.5} /></button></div>
        </aside>
      </div>}
    </div>
  );
}

// ---------- Devine le coup ----------
interface Master { w: string; b: string; y: string; ev: string; res: string; side: 'w' | 'b'; hero: string; m: string }
let mastersP: Promise<Master[]> | null = null; const loadMasters = () => (mastersP ||= import('../data/masters.json').then((m: any) => (m.default || m) as Master[]));
export function GuessMove() {
  const [games, setGames] = useState<Master[] | null>(null); const [g, setG] = useState<Master | null>(null); const [ply, setPly] = useState(0); const [pts, setPts] = useState(0); const [max, setMax] = useState(0);
  const [fb, setFb] = useState<string>(''); const [busy, setBusy] = useState(false); const [hero, setHero] = useState('Tous');
  useEffect(() => { loadMasters().then(setGames); }, []);
  const sans = g ? g.m.split(' ') : []; const START_PLY = 10;
  const ch = useMemo(() => { const c = new Chess(); for (const s of sans.slice(0, ply)) c.move(s); return c; }, [g, ply]);
  const pick = () => { if (!games) return; const pool = games.filter((x) => hero === 'Tous' || x.hero === hero); const x = pool[Math.floor(Math.random() * pool.length)]; setG(x); setPts(0); setMax(0); setFb(''); const start = START_PLY + (x.side === 'b' ? 1 : 0); setPly(start); };
  const finished = g && ply >= sans.length;
  useEffect(() => { if (finished && max > 0) { const pct = Math.round((pts / max) * 100); setState((s) => { const t = (s.training.guess ||= {}); t.best = Math.max(t.best || 0, pct); t.games = (t.games || 0) + 1; }); addXp(15, 'Devine le coup'); } }, [finished]);
  async function onMove(from: string, to: string, promotion?: string) {
    if (!g || busy || finished) return false; const c = new Chess(ch.fen()); const m = tryMove(c, { from, to, promotion: promotion || (isPromotion(ch, from, to) ? 'q' : undefined) }); if (!m) return false;
    const master = sans[ply]; const mc = new Chess(ch.fen()); const mm = mc.move(master);
    setBusy(true); let gain = 0; let txt = '';
    if (m.san === mm.san) { gain = 3; txt = `${sanFr(master)} : exactement le coup du maître. +3`; play('win'); }
    else {
      playForMove(m); setFb('Évaluation de ton coup…');
      const fen = ch.fen(); const sgn = ch.turn() === 'w' ? 1 : -1;
      const [a, b] = await Promise.all([engine.analyse(fen, { depth: 12, searchmoves: [moveToUci(m)] }), engine.analyse(fen, { depth: 12, searchmoves: [moveToUci(mm)] })]);
      const sa = whiteScore(a.lines[0], fen) * sgn, sb = whiteScore(b.lines[0], fen) * sgn; const d = sb - sa;
      gain = d <= 25 ? 2 : d <= 80 ? 1 : 0;
      txt = `Tu as joué ${sanFr(m.san)}, le maître a joué ${sanFr(master)}. ${gain === 2 ? 'Aussi bon selon le moteur ! +2' : gain === 1 ? 'Un peu moins précis. +1' : `Le coup du maître était nettement meilleur (${(d / 100).toFixed(1).replace('.', ',')}).`}`;
      if (!gain) play('error');
    }
    setPts((p) => p + gain); setMax((x) => x + 3); setFb(txt); setPly(ply + 2 > sans.length ? sans.length : ply + 2); setBusy(false); return true;
  }
  if (!games) return <div class="page"><Top title="Devine le coup" /><div class="loading" aria-label="Chargement des parties" /></div>;
  const heroes = ['Tous', ...new Set(games.map((x) => x.hero))];
  if (!g) return (
    <div class="page"><Top title="Devine le coup" />
      <p class="muted">{games.length} parties gagnées par des champions du monde. Tu joues le camp du vainqueur à partir du 6e coup : 3 points pour le coup du maître, 2 si ton coup est aussi bon selon le moteur, 1 s’il est proche.</p>
      <div class="chips">{heroes.map((h) => <button class={'chip ' + (hero === h ? 'on' : '')} onClick={() => setHero(h)}>{h}</button>)}</div>
      <button class="btn primary" onClick={pick}>Commencer une partie</button>
    </div>
  );
  const last = ply > 0 ? new Chess() : null; let lm: [string, string] | null = null; if (last) { let mv: Move | null = null; for (const s of sans.slice(0, ply)) mv = last.move(s); if (mv) lm = [mv.from, mv.to]; }
  return (
    <div class="page"><Top title="Devine le coup" />
      <div class="play-grid">
        <Board fen={ch.fen()} orientation={g.side === 'w' ? 'white' : 'black'} turn={turnColor(ch)} movable={!finished && !busy ? (g.side === 'w' ? 'white' : 'black') : 'none'} dests={legalDests(ch)} lastMove={lm}
          onMove={(f, t, p) => { onMove(f, t, p); return true; }} promotionCheck={(f, t) => isPromotion(ch, f, t)} />
        <aside class="side card">
          <p><b>{g.w}</b> – <b>{g.b}</b><br /><small class="muted">{g.ev} {g.y} · {g.res}</small></p>
          <p>Tu joues {g.side === 'w' ? 'les Blancs' : 'les Noirs'} ({g.hero}).</p>
          <p class="big-num">{max ? Math.round((pts / max) * 100) : 0} %</p><small class="muted">{pts}/{max} points · coup {Math.ceil((ply + 1) / 2)}/{Math.ceil(sans.length / 2)}</small>
          {fb && <p class="hint-box">{fb}</p>}
          {finished ? <><p class="success-box">Partie terminée : {max ? Math.round((pts / max) * 100) : 0} % de précision « maître ».</p><button class="btn primary" onClick={pick}>Nouvelle partie</button></> : <button class="btn ghost" onClick={() => { setFb(`Le coup du maître : ${sanFr(sans[ply])}`); setMax((x) => x + 3); setPly(Math.min(sans.length, ply + 2)); }}>Passer ce coup</button>}
          <button class="btn ghost" onClick={() => setG(null)}>Changer de partie</button>
        </aside>
      </div>
    </div>
  );
}
