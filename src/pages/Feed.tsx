// Onglet « Pour toi » : un fil vertical de cartes courtes (15–60 s) choisies par le coach.
// Réussite → carte suivante automatique ; « Passer » (ou balayage vers le haut) = signal négatif enregistré ;
// la carte N+1 est préparée pendant la carte N (et seulement elle) ; fin propre quand le programme du jour est fait.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useStore, getState, setState, addXp, levelFromXp, streakAlive } from '../lib/store';
import { MoveTrainer } from '../components/MoveTrainer';
import { CONCEPT } from '../data/concepts';
import { Board, toShapes } from '../components/Board';
import { Icon, type IconName } from '../components/Icon';
import { Md, toastPrefs } from '../components/ui';
import { trialBanner, dismissTrialBanner } from '../lib/notify';
import { pickPuzzle, findPuzzle, type BankPuzzle } from '../lib/puzzlebank';
import { recordPuzzle } from '../lib/progress';
import { review as srsReview } from '../lib/srs';
import { Chess, sanFr } from '../lib/chess';
import { play } from '../lib/sound';
import { findLesson, type Step, type Lesson } from '../data/lessons';
import { StepBoard } from './Lesson';
import { SKILL } from '../coach/skills';
import { useCoachSync } from '../coach/ui/common';
import { ensureModel } from '../coach/curriculum';
import { logEvent } from '../lib/events';
import { shouldAskConsent } from '../lib/consent';
import { lazy } from '../lib/lazy';
const ConsentSheet = lazy<{ onClose: (d: boolean) => void }>(() => import('../components/ConsentSheet'), 'ConsentSheet', () => <div />);
import { nextFeedCards, recordFeed, recordDiag, diagBeginner, tomorrowTeaser, feedProgress, KIND_LABEL, DAILY_CARDS, sessionActive, sessionPlan, startSession, sessionCard, sessionOver, sessionSummary, type FeedCard, type FeedOutcome, type SessionSummary } from '../coach/feed';
import { go as goTo } from '../lib/router';
import { feedDiagPlanned } from '../coach/diagnostic';

interface MasterX { f: string; m: string; r: number; hero: string; vs: string; y: string; ev: string; n: string; san: string; why: { k: 'mate' | 'win' | 'theme' | 'only'; n?: number; th?: string; line: string[] } }
interface ThreatX { id: string; f: string; last: string; ls: string; t: string; d: string[]; r: number; w: { k: 'mate' | 'cap' | 'mat' | 'strong'; n?: number; p?: string }; line: string[]; th?: string }
type Content =
  | { t: 'puzzle'; p: BankPuzzle; review: boolean; diag?: boolean }
  | { t: 'mistake'; fen: string; sol: string[]; prompt: string }
  | { t: 'threat'; x: ThreatX }
  | { t: 'master'; x: MasterX }
  | { t: 'lesson'; lesson: Lesson; step: Extract<Step, { type: 'exercise' }>; idx: number; notion?: string };
interface Slot { card: FeedCard; content: Content | null }

let masterP: Promise<MasterX[]> | null = null, threatP: Promise<ThreatX[]> | null = null;
const loadMasters = () => (masterP ||= import('../data/feed-master.json').then((m: any) => (m.default || m) as MasterX[]));
const loadThreats = () => (threatP ||= import('../data/feed-threats.json').then((m: any) => (m.default || m) as ThreatX[]));
const SEEN = 'echecs-feed-vus';
const seenList = (): string[] => { try { return JSON.parse(localStorage.getItem(SEEN) || '[]'); } catch { return []; } };
const markSeen = (id: string) => { const l = seenList().filter((x) => x !== id); l.push(id); try { localStorage.setItem(SEEN, JSON.stringify(l.slice(-800))); } catch { /* quota */ } };
function nearest<T extends { r: number }>(list: T[], d: number, key: (x: T) => string): T | null {
  const seen = new Set(seenList()); const pool = list.filter((x) => !seen.has(key(x)));
  const arr = (pool.length ? pool : list).slice().sort((a, b) => Math.abs(a.r - d) - Math.abs(b.r - d)).slice(0, 10);
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
}
const PIECE_ART: Record<string, string> = { p: 'un pion', n: 'un cavalier', b: 'un fou', r: 'une tour', q: 'la dame', k: 'le roi' };
const sanOf = (fen: string, uci: string) => { try { return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined }).san; } catch { return uci; } };

/** Prépare le contenu d'une carte (chargé à la demande, hors ligne si déjà en cache). null = indisponible. */
async function resolve(c: FeedCard): Promise<Content | null> {
  const s = getState();
  if (c.kind === 'puzzle' || c.kind === 'mate1') {
    const p = await pickPuzzle({ rating: c.d, theme: c.theme, seen: s.puzzle.seen, maxMoves: c.skill === 'calculation' || c.skill === 'mateN' ? 6 : 4 }).catch(() => null);
    return p ? { t: 'puzzle', p, review: false } : null;
  }
  if (c.kind === 'diag') {
    let p = await pickPuzzle({ rating: c.d, theme: c.theme, seen: s.puzzle.seen, maxMoves: 4 }).catch(() => null);
    if (!p) p = await pickPuzzle({ rating: c.d, seen: s.puzzle.seen, maxMoves: 4 }).catch(() => null);
    return p ? { t: 'puzzle', p, review: false, diag: true } : null;
  }
  if (c.kind === 'mistake' && c.ref) {
    if (c.ref.startsWith('p:')) { const p = await findPuzzle(c.ref.slice(2)); return p ? { t: 'puzzle', p, review: true } : null; }
    const mk = s.coach?.mistakes[c.ref]; return mk ? { t: 'mistake', fen: mk.fen, sol: mk.sol, prompt: mk.prompt } : null;
  }
  if (c.kind === 'threat') { const x = nearest(await loadThreats(), c.d, (y) => 't' + y.id); return x ? { t: 'threat', x } : null; }
  if (c.kind === 'master') { const x = nearest(await loadMasters(), c.d, (y) => 'm' + y.f); return x ? { t: 'master', x } : null; }
  if (c.kind === 'lesson' && c.ref) {
    const [lid, i] = c.ref.split(':'); const lesson = await findLesson(lid); const step = lesson?.steps[+i];
    if (!lesson || !step || step.type !== 'exercise') return null;
    let notion: string | undefined; for (let k = +i - 1; k >= 0; k--) { const st = lesson.steps[k]; if (st.type === 'text' || st.type === 'demo') { notion = st.body; break; } }
    return { t: 'lesson', lesson, step, idx: +i, notion };
  }
  return null;
}
function computeNext(pending: FeedCard[], n: number): FeedCard[] {
  const s = getState(); if (!s.coach) return [];
  return nextFeedCards(s, s.coach, n, Date.now(), pending);
}

export function Feed() {
  const s = useStore((x) => x);
  const ready = useCoachSync(s);
  const [cur, setCur] = useState<Slot | null | undefined>(undefined); // undefined = chargement, null = fin du jour
  const nextRef = useRef<Promise<Slot | null> | null>(null);
  const [k, setK] = useState(0);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  /** consentement (brief P0 §6) : jamais avant le 1er mat de l'accueil ; à la 2e carte montrée, une fois */
  const shown = useRef(0); const [askConsent, setAskConsent] = useState(false);
  /** un geste depuis l'accueil (CA7.1) : la séance démarre sur la carte affichée (ou en prépare une) */
  const start = () => { logEvent('session_start', { kind: 'coach5' }); setState((d) => startSession(d, ensureModel(d))); setSummary(null); if (cur === null) { nextRef.current = null; setCur(undefined); setK((x) => x + 1); } };
  useEffect(() => { toastPrefs.quietXp = true; return () => { toastPrefs.quietXp = false; }; }, []);
  /** prépare une carte jouable (si une source est indisponible, on essaie la suivante) */
  async function prepare(pending: FeedCard[]): Promise<Slot | null> {
    for (let tries = 0; tries < 4; tries++) {
      const [c] = computeNext(pending, 1); if (!c) return null;
      const content = await resolve(c).catch(() => null);
      if (content) return { card: c, content };
      pending = [...pending, c];
    }
    return null;
  }
  // rien n'est chargé tant que l'accueil (onboarding) est affiché : le premier chargement reste léger
  const go = (ready || cur !== undefined) && s.onboarded; // une fois lancé, la resynchronisation du modèle ne démonte pas la carte
  useEffect(() => {
    if (!go || cur !== undefined) return;
    let live = true;
    (async () => { const first = await prepare([]); if (!live) return; setCur(first); if (first) nextRef.current = preload(first); })();
    return () => { live = false; };
  }, [go]);
  async function advance() {
    // fin de séance : budget de temps consommé → écran de fin (l'élève peut continuer ensuite)
    if (sessionOver(getState())) { let sm: SessionSummary | null = null; setState((d) => { const m = ensureModel(d); sm = sessionSummary(d, m); d.session!.over = true; }); setSummary(sm); logEvent('session_end', { kind: 'coach5', n: getState().session?.n ?? 0, ms: getState().session?.spent ?? 0 }); }
    let nx = nextRef.current ? await nextRef.current : await prepare([]);
    // préchargée avant le début de la séance (programme du jour fini → rien) : on redemande avec le budget de séance
    if (!nx && sessionActive(getState())) nx = await prepare([]);
    // la carte préchargée a pu devenir caduque (programme terminé entre-temps)
    const gs = getState(); const left = sessionActive(gs) ? 1 : DAILY_CARDS - feedProgress(gs).done; // séance : budget en temps, pas le plafond du jour
    const slot = left > 0 ? nx : null;
    setCur(slot); setK((x) => x + 1);
    if (slot && ++shown.current >= 1 && shouldAskConsent()) setAskConsent(true);
    nextRef.current = slot ? preload(slot) : null;
  }
  // le diagnostic s'adapte à chaque réponse : sa carte suivante ne peut pas être préparée d'avance
  const preload = (sl: Slot) => (sl.card.kind === 'diag' ? null : prepare([sl.card]));
  if (summary) return <div class="page feed"><FeedHead onStart={start} /><SessionEnd sm={summary} onContinue={() => setSummary(null)} /></div>;
  if (!go || cur === undefined) return <div class="page feed"><FeedHead onStart={start} /><div class="feed-card skeleton" role="status" aria-busy="true" aria-label="Préparation de ton fil"><div class="fc-board" /></div></div>;
  if (cur === null) {
    if (sessionActive(s)) { const m = s.coach; if (m) setTimeout(() => { let sm: SessionSummary | null = null; setState((d) => { sm = sessionSummary(d, ensureModel(d)); d.session!.over = true; }); setSummary(sm); logEvent('session_end', { kind: 'coach5', n: getState().session?.n ?? 0, ms: getState().session?.spent ?? 0 }); }, 0); }
    return <div class="page feed"><FeedHead onStart={start} /><FeedEnd /></div>;
  }
  return (
    <div class="page feed">
      <FeedHead onStart={start} />
      <CardView key={k} slot={cur} onDone={advance} />
      {askConsent && <ConsentSheet onClose={() => setAskConsent(false)} />}
    </div>
  );
}
function FeedHead({ onStart }: { onStart?: () => void }) {
  const s = useStore((x) => x); const pr = feedProgress(s); const streak = streakAlive(s) ? s.streak.count : 0;
  const [, f] = useState(0); const tb = trialBanner();
  const sess = sessionActive(s) ? s.session! : null;
  const plan = useMemo(() => (!sess && s.coach && s.onboarded ? sessionPlan(s, s.coach) : null), [!!sess, !!s.coach, s.onboarded, pr.done]);
  return (<>
    <header class="feed-head">
      <h1>Pour toi</h1>
      <div class="fh-dots" role="progressbar" aria-label="Programme du jour" aria-valuemin={0} aria-valuemax={pr.total} aria-valuenow={pr.done}>
        {Array.from({ length: pr.total }, (_, i) => <span class={i < pr.done ? 'on' : i === pr.done ? 'cur' : ''} />)}
      </div>
      <a class="streak-btn" href="#/profile" aria-label={`Série : ${streak} jour${streak > 1 ? 's' : ''}`}><Icon name="flame" size={18} class={streak ? 'lit' : ''} /><b class="tnum">{streak}</b></a>
    </header>
    {onStart && !sess && plan && plan.cards > 0 && (
      <button class="session-start" onClick={onStart}>
        <span class="ss-ico"><Icon name="playIcon" size={20} /></span>
        <span class="ss-txt"><b>Ma séance de 5 minutes</b><small class="tnum">≈ {Math.max(1, Math.round(plan.ms / 60000))} min · {plan.cards} carte{plan.cards > 1 ? 's' : ''}{plan.due ? ` · ${plan.due} à revoir` : ''}</small></span>
        <Icon name="right" size={18} stroke={2.5} />
      </button>
    )}
    {sess && (() => { const frac = Math.min(1, sess.spent / sess.budget); const left = Math.max(0, Math.ceil((sess.budget - sess.spent) / 60000));
      return <div class="session-gauge" role="progressbar" aria-label="Séance de 5 minutes" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(frac * 100)}><div class="sg-bar"><span style={{ width: `${Math.round(frac * 100)}%` }} /></div><span class="sg-txt tnum">{sess.n} carte{sess.n > 1 ? 's' : ''} · {left ? `≈ ${left} min restante${left > 1 ? 's' : ''}` : 'dernière carte'}</span></div>; })()}
    {tb && (
      <div class="banner">
        <Icon name="clock" size={20} />
        <span>Ton essai se termine le <b>{new Date(tb.endsAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</b>. Ensuite 29,99 €/an, annulable à tout moment.</span>
        <div class="row"><a class="btn small tinted" href="#/premium">Gérer</a><button class="btn small plain" onClick={() => { dismissTrialBanner(); f((x) => x + 1); }}>OK</button></div>
      </div>
    )}
  </>);
}
const KIND_ICON: Record<FeedCard['kind'], { icon: IconName; color: string }> = {
  puzzle: { icon: 'puzzle', color: '#0A84FF' }, mate1: { icon: 'king', color: '#FF453A' }, threat: { icon: 'crosshair', color: '#FF9F0A' },
  master: { icon: 'crown', color: '#F2B544' }, mistake: { icon: 'repeat', color: '#5E5CE6' }, lesson: { icon: 'book', color: '#30D158' }, diag: { icon: 'gauge', color: '#FF9F0A' },
};

function CardView({ slot, onDone }: { slot: Slot; onDone: () => void }) {
  useEffect(() => { const c = slot.card; logEvent('card_served', { card: c.id, kind: c.kind, skill: c.skill, d: c.d, score: c.score ?? c.gain, p: 1, policy: 'greedy-v1', rank: 1, nCands: c.nCands ?? null, ref: c.ref ?? null }); }, []); // montrée (pas préchargée) ; p = 1 : politique gloutonne
  const { card, content } = slot; const c = content!;
  const t0 = useRef(Date.now()); const hidden = useRef(0); const hidAt = useRef(0); const outcome = useRef<FeedOutcome | null>(null); const failed = useRef(false);
  const [state, setSt] = useState<'play' | 'ok' | 'reveal'>('play');
  const [why, setWhy] = useState(false); const [sol, setSol] = useState(0); const [xp, setXp] = useState(0); const [leaving, setLeaving] = useState(false);
  const elapsed = () => Date.now() - t0.current - hidden.current;
  useEffect(() => {
    const vis = () => { if (document.hidden) hidAt.current = Date.now(); else if (hidAt.current) { hidden.current += Date.now() - hidAt.current; hidAt.current = 0; } };
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); if (!outcome.current && elapsed() > 10000) { setState((d) => recordFeed(d, card, 'abandon', elapsed())); logEvent('card_result', { card: card.id, kind: card.kind, out: 'abandon', ms: elapsed() }); } };
  }, []);
  const counted = c.t === 'puzzle';
  const isDiag = c.t === 'puzzle' && !!c.diag;
  const [dres, setDres] = useState<{ rating: number; rd: number } | null>(null);
  /** carte du diagnostic : une seule tentative, la réponse nourrit le test adaptatif (et non le classement puzzle) */
  const answerDiag = (ok: boolean, quick = false) => {
    if (outcome.current || c.t !== 'puzzle') return; outcome.current = ok ? 'ok' : 'fail';
    const p = c.p; const ms = elapsed(); let res: { rating: number; rd: number } | null = null;
    setState((d) => {
      res = recordDiag(d, { id: p.i, r: p.r, th: p.t, ok, ms, plies: p.m.split(' ').length - 1 });
      recordFeed(d, card, ok ? 'ok' : 'fail', ms, true);
      if (sessionActive(d)) sessionCard(d, ms, ok);
      if (!d.puzzle.seen.includes(p.i)) d.puzzle.seen.push(p.i);
      ensureModel(d);
    });
    logEvent('card_result', { card: card.id, kind: card.kind, out: ok ? 'ok' : 'fail', ms });
    setDres(res);
    if (ok) { addXp(8, KIND_LABEL.diag); setXp(8); }
    if (ok && !res) { setSt('ok'); go(450); return; }
    if (quick && !res) { setLeaving(true); setTimeout(onDone, 200); return; }
    if (!ok) setSol((x) => x + 1);
    setSt('reveal');
  };
  /** fin de carte : enregistre le signal une seule fois */
  const finish = (out: FeedOutcome) => {
    if (outcome.current) return; outcome.current = out;
    setState((d) => {
      if (c.t === 'mistake' && card.ref && d.srs[card.ref]) d.srs[card.ref] = srsReview(d.srs[card.ref], out === 'ok' ? 2 : out === 'fail' ? 0 : 1);
      recordFeed(d, card, out, elapsed(), counted && out !== 'skip', Date.now(), c.t === 'mistake' ? c.fen : c.t === 'master' ? c.x.f : undefined);
      if (sessionActive(d)) sessionCard(d, elapsed(), out === 'ok');
      ensureModel(d); // le modèle consomme le signal tout de suite
    });
    logEvent('card_result', { card: card.id, kind: card.kind, out, ms: elapsed() });
    if (c.t === 'threat') markSeen('t' + c.x.id); if (c.t === 'master') markSeen('m' + c.x.f);
  };
  // révélation réussie (coup du maître, menace) : on lit la phrase puis on enchaîne seul, sauf si « pourquoi ? » est ouvert
  useEffect(() => { if (state !== 'reveal' || (failed.current && !isDiag) || why) return; const t = setTimeout(() => go(0), isDiag ? (dres ? 4500 : 2200) : 3800); return () => clearTimeout(t); }, [state, why]);
  const go = (delay: number) => { setTimeout(() => { setLeaving(true); setTimeout(onDone, 220); }, delay); };
  const success = (gain: number, auto = true) => {
    if (outcome.current) return;
    const clean = !failed.current;
    if (c.t === 'puzzle') recordPuzzle(c.p, clean, c.review ? 'review' : 'theme', { interleaved: true });
    finish(clean ? 'ok' : 'fail');
    if (c.t !== 'puzzle' && clean) addXp(gain, KIND_LABEL[card.kind]);
    setXp(clean ? (c.t === 'puzzle' ? (c.review ? 8 : 8) : gain) : 0);
    setSt(auto ? 'ok' : 'reveal');
    if (auto) go(450);
  };
  const miss = () => { if (!failed.current) { failed.current = true; if (c.t === 'puzzle') { /* l'échec est enregistré à la fin (une seule fois) */ } } };
  const skip = () => { if (outcome.current) { onDone(); return; } if (isDiag) { answerDiag(false, true); return; } finish('skip'); setLeaving(true); setTimeout(onDone, 200); };
  // balayage vers le haut hors de l'échiquier = passer (ou suivante si la carte est finie)
  const touch = useRef<{ y: number; x: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => { const el = e.target as HTMLElement; if (el.closest('.board-wrap, button, a, .quiz')) { touch.current = null; return; } touch.current = { y: e.touches[0].clientY, x: e.touches[0].clientX }; };
  const onTouchEnd = (e: TouchEvent) => { const st = touch.current; touch.current = null; if (!st) return; const t = e.changedTouches[0]; const dy = t.clientY - st.y, dx = Math.abs(t.clientX - st.x); if (dy < -70 && dx < 60) { state === 'play' ? skip() : onDone(); } };

  const vis = KIND_ICON[card.kind];
  const finished = state !== 'play';
  // CA2.3 : le thème n'est jamais annoncé avant la réponse (reconnaître le motif fait partie de l'exercice)
  const conceptLabel = card.concept ? CONCEPT[card.concept]?.label : undefined;
  const label = !finished && (card.kind === 'mate1' || card.kind === 'puzzle') ? 'Trouve le meilleur coup' : !finished && card.kind === 'mistake' ? 'À revoir' : KIND_LABEL[card.kind];
  const sub = !finished && card.kind !== 'master' && !isDiag ? null : conceptLabel && card.kind !== 'master' && !isDiag ? `Notion : ${conceptLabel}` : card.kind === 'puzzle' && card.skill ? SKILL[card.skill].label : card.kind === 'lesson' && c.t === 'lesson' ? c.lesson.title : card.kind === 'master' && c.t === 'master' ? `${c.x.hero} – ${c.x.vs}, ${c.x.y}` : isDiag ? `Position ${+card.id.slice(3) + 1} sur ${feedDiagPlanned(getState().placement)}` : null;
  return (
    <article class={'feed-card' + (leaving ? ' leaving' : '') + (state === 'ok' ? ' won' : '') + (state === 'reveal' ? ' revealed' : '')} style={{ '--c': vis.color } as any} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} aria-label={label} data-concept={finished ? card.concept : undefined}
      data-kind={card.kind} data-ref={c.t === 'master' ? c.x.f : c.t === 'threat' ? c.x.id : c.t === 'puzzle' ? c.p.i : card.ref}>
      <div class="fc-top">
        <span class="fc-kind"><span class="fc-ico"><Icon name={!finished && card.kind === 'mate1' ? 'puzzle' : vis.icon} size={15} /></span>{label}</span>
        {sub && <span class="fc-sub">{sub}</span>}
      </div>
      <div class="fc-body">
        {c.t === 'puzzle' && <MoveTrainer fen={c.p.f} line={c.p.m.split(' ')} setup ownHints={!isDiag} goal="puzzle" showSolutionSignal={sol} onMistake={isDiag ? () => answerDiag(false) : miss} onSolved={isDiag ? () => answerDiag(true) : () => success(8)} />}
        {isDiag && state === 'reveal' && <div class={'fc-reveal ' + (dres ? 'good' : 'bad')} aria-live="polite">{dres
          ? <><h4>Je te connais mieux : niveau de départ {dres.rating}</h4><p class="muted small">Marge ± {dres.rd}, elle se resserre à chaque carte. À partir de maintenant, ton fil s’adapte à toi.</p></>
          : <><h4>Pas grave, voici le coup.</h4><p class="muted small">La position suivante sera plus abordable : le test s’adapte à tes réponses.</p></>}</div>}
        {c.t === 'mistake' && <MoveTrainer fen={c.fen} line={c.sol} ownHints goal="puzzle" showSolutionSignal={sol} onMistake={miss} onSolved={() => success(10)} />}
        {c.t === 'master' && <MasterCard x={c.x} sol={sol} done={finished} onMistake={miss} onSolved={() => success(12, false)} />}
        {c.t === 'threat' && <ThreatCard x={c.x} onAnswer={(ok) => { if (!ok) failed.current = true; success(10, false); }} />}
        {c.t === 'lesson' && <div class="fc-lesson"><p class="fc-prompt"><Md text={c.step.prompt} /></p><StepBoard step={c.step} lessonId={c.lesson.id} hints={0} sol={sol} reset={0} onSolved={() => success(6)} onMistake={miss} /></div>}
      </div>
      {why && (
        <div class="fc-why" role="note">
          <Icon name="brainCircuit" size={18} />
          {finished || card.kind === 'diag' || card.kind === 'master' ? <div><p>{card.why}</p>{card.evidence && <p class="muted small">{card.evidence}</p>}{c.t === 'lesson' && c.notion && <p class="muted small"><Md text={c.notion} /></p>}</div>
            : <div><p>Je te dis pourquoi cette position juste après ta réponse : le thème n’est pas annoncé, c’est ce qui t’apprend à le reconnaître seul en partie.</p></div>}
        </div>
      )}
      {state === 'ok' && <div class="fc-xp" aria-live="polite"><Icon name="sparkles" size={16} />{xp ? `+${xp} XP` : 'Résolu'}</div>}
      <div class="fc-actions">
        <button class={'btn plain small fc-whybtn' + (why ? ' on' : '')} onClick={() => setWhy(!why)} aria-expanded={why}>Pourquoi ?</button>
        {!finished && failed.current && (c.t === 'puzzle' || c.t === 'mistake' || c.t === 'master') && <button class="btn plain small" onClick={() => { setSol((x) => x + 1); if (!outcome.current) { if (c.t === 'puzzle') recordPuzzle(c.p, false, c.review ? 'review' : 'theme', { interleaved: true }); finish('fail'); } setSt('reveal'); }}><Icon name="eye" size={16} />Solution</button>}
        {isDiag && !finished && state === 'play' && <button class="btn plain small fc-beginner" onClick={() => { setState((d) => diagBeginner(d)); goTo('/lesson/d-echiquier'); }}>Je débute</button>}
        <span class="grow" />
        {finished && state === 'reveal' ? <button class={'btn primary fc-next' + ((isDiag || !failed.current) && !why ? ' auto' : '')} style={isDiag ? { '--auto-ms': dres ? '4.5s' : '2.2s' } as any : undefined} onClick={() => onDone()}>Suivant<Icon name="down" size={16} stroke={2.6} /></button>
          : <button class="btn secondary small fc-skip" onClick={skip} disabled={state === 'ok'}>{isDiag ? 'Je ne sais pas' : 'Passer'}<Icon name="down" size={15} stroke={2.6} /></button>}
      </div>
    </article>
  );
}

function MasterCard({ x, sol, done, onSolved, onMistake }: { x: MasterX; sol: number; done: boolean; onSolved: () => void; onMistake: () => void }) {
  const white = x.f.split(' ')[1] === 'w';
  const said = (() => { const w = x.why; const th = w.th ? ` C’est ${w.th}.` : '';
    if (w.k === 'mate') return `Il force le mat en ${w.n}.${th}`;
    if (w.k === 'win') return `Il gagne du matériel (${w.n} point${(w.n || 0) > 1 ? 's' : ''}).${th}`;
    if (w.k === 'theme') return `Il exploite ${w.th}.`;
    return `C’était le seul coup fort : tout autre coup laissait filer environ ${w.n} pions d’avantage.`; })();
  const line = x.why.line.slice(1).map(sanFr).join(' '); const ev = x.ev.includes(x.y) ? x.ev : `${x.ev}, ${x.y}`;
  return (
    <div class="fc-master">
      {!done && <p class="fc-prompt">{x.hero} a les {white ? 'Blancs' : 'Noirs'}. <b>Trouve son coup.</b></p>}
      <MoveTrainer fen={x.f} line={[x.m]} orientation={white ? 'white' : 'black'} ownHints goal="master" showSolutionSignal={sol} onMistake={onMistake} onSolved={onSolved} feedback={false} />
      {done && <div class="fc-reveal"><h4>{x.n}{sanFr(x.san)}{x.why.k === 'only' ? ' !' : ' !'} <span class="muted">· {x.hero}</span></h4><p>{said}</p><p class="muted small fc-line">{line ? `Suite : ${line} · ` : ''}{ev}</p></div>}
    </div>
  );
}
function ThreatCard({ x, onAnswer }: { x: ThreatX; onAnswer: (ok: boolean) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const nul = useMemo(() => { const p = x.f.split(' '); p[1] = p[1] === 'w' ? 'b' : 'w'; p[3] = '-'; return p.join(' '); }, [x.f]);
  const opts = useMemo(() => { const all = [x.t, ...x.d]; let h = 0; for (const ch of x.id) h = (h * 31 + ch.charCodeAt(0)) | 0; const r = Math.abs(h) % 3; return [...all.slice(r), ...all.slice(0, r)]; }, [x.id]);
  const me = x.f.split(' ')[1] === 'w' ? 'white' : 'black';
  const what = (() => { const w = x.w; const s = sanFr(x.line[0] || sanOf(nul, x.t));
    if (w.k === 'mate') return w.n === 1 ? `${s} et c’est mat.` : `${s}, avec mat en ${w.n}.`;
    if (w.k === 'cap') return `${s}, qui gagne ${PIECE_ART[w.p!]}.`;
    if (w.k === 'mat') return `${s}, qui gagne du matériel.`;
    return `${s}, très fort.`; })();
  const shapes = picked ? toShapes([`${x.t.slice(0, 2)}${x.t.slice(2, 4)}${picked === x.t ? 'G' : 'R'}`]) : [];
  return (
    <div class="fc-threat">
      <p class="fc-prompt">L’adversaire vient de jouer <b>{sanFr(x.ls)}</b>. Que menace-t-il ?</p>
      <Board fen={x.f} viewOnly orientation={me} lastMove={[x.last.slice(0, 2), x.last.slice(2, 4)]} shapes={shapes} />
      {!picked && <div class="fc-choices" role="group" aria-label="Choisis la menace">
        {opts.map((u) => { const san = sanFr(sanOf(nul, u)).replace(/[+#]/g, ''); /* pas d'indice (+, #) dans les choix */ const st = picked ? (u === x.t ? 'right' : u === picked ? 'wrong' : 'dim') : '';
          return <button class={'fc-choice ' + st} disabled={!!picked} onClick={() => { setPicked(u); const ok = u === x.t; play(ok ? 'success' : 'error'); onAnswer(ok); }}>{san}</button>; })}
      </div>}
      {picked && <div class={'fc-reveal ' + (picked === x.t ? 'good' : 'bad')}><h4>{picked === x.t ? 'Bien vu : ' : `Pas ${sanFr(sanOf(nul, picked)).replace(/[+#]/g, '')}. La menace : `}{what}</h4><p class="muted small">{x.th ? `Le motif : ${x.th}. ` : ''}Avant chaque coup, cherche d’abord ce que veut ton adversaire.</p></div>}
    </div>
  );
}
/** Fin de séance (pilier 7) : ce qui a progressé (notions, note) et ce qui revient demain ; on peut continuer. */
function SessionEnd({ sm, onContinue }: { sm: SessionSummary; onContinue: () => void }) {
  const min = Math.max(1, Math.round(sm.ms / 60000));
  return (
    <section class="session-end" aria-live="polite">
      <span class="fe-icon"><Icon name="checkCircle" size={40} /></span>
      <h2>Séance terminée</h2>
      <p class="fe-stats"><b class="tnum">{sm.ok}</b>/{sm.n} réussies · {min} min</p>
      {sm.mastered.length > 0 && <p class="se-mastered"><Icon name="trophy" size={18} />Maîtrisée{sm.mastered.length > 1 ? 's' : ''} : {sm.mastered.map((id) => CONCEPT[id]?.label || id).join(', ')}</p>}
      {sm.progressed.length > 0 ? <div class="se-prog"><p class="eyebrow">Ce qui a progressé</p><ul>{sm.progressed.map((x) => <li><span>{CONCEPT[x.id]?.label || x.id}</span><b class="tnum">+{Math.round(x.dp * 100)} %</b></li>)}</ul></div>
        : <p class="muted">Pas encore de notion qui bouge nettement : c’est en répétant sur plusieurs jours que la maîtrise se construit.</p>}
      <p class="muted small">Note d’entraînement : <b class="tnum">{sm.rating}</b>{sm.dRating ? ` (${sm.dRating > 0 ? '+' : ''}${sm.dRating})` : ''}</p>
      <p class="fe-teaser">{sm.tomorrow}</p>
      <div class="fe-actions">
        <button class="btn primary lg se-continue" onClick={onContinue}>Continuer</button>
        <a class="btn secondary lg" href="#/play"><Icon name="play" size={18} />Jouer une partie</a>
      </div>
    </section>
  );
}
function FeedEnd() {
  const s = useStore((x) => x); const pr = feedProgress(s); const lvl = levelFromXp(s.xp);
  const teaser = s.coach ? tomorrowTeaser(s, s.coach) : 'Demain, je te prépare un nouveau programme.';
  return (
    <section class="feed-end">
      <span class="fe-icon"><Icon name="checkCircle" size={40} /></span>
      <h2>C’est tout pour aujourd’hui</h2>
      <p class="fe-stats"><b class="tnum">{pr.ok}</b>/{pr.total} réussies · niveau {lvl.level} · série {streakAlive(s) ? s.streak.count : 0} j</p>
      <p class="fe-teaser">{teaser}</p>
      <div class="fe-actions">
        <a class="btn primary lg" href="#/play"><Icon name="play" size={18} />Jouer une partie</a>
        <a class="btn secondary lg" href="#/learn"><Icon name="learn" size={18} />Apprendre</a>
      </div>
      <p class="muted small">Le fil s’arrête là exprès : mieux vaut un peu chaque jour qu’un marathon.</p>
    </section>
  );
}
