import { useEffect, useMemo, useState } from 'preact/hooks';
import { lessonById, LESSONS, LEVELS, findLesson, cachedCourseLesson, loadCourses, type Step, type Lesson as L } from '../data/lessons';
import { Board, toShapes } from '../components/Board';
import { MoveTrainer } from '../components/MoveTrainer';
import { StarsExercise, SelectExercise, Quiz, PlayGoal } from '../components/Exercises';
import { Md, inlineMd, Progress, PremiumLock, NavBar, Stars, AutoNext } from '../components/ui';
import { go } from '../lib/router';
import { Icon } from '../components/Icon';
import { levelColor } from '../lib/visual';
import { Chess, tryMove, moveToUci, START_FEN, sanFr } from '../lib/chess';
import { setState, addXp, useStore, pushCoach } from '../lib/store';
import { usePremium } from '../lib/entitlements';
import { loadPuzzles, lessonPuzzles, type Puzzle } from '../lib/puzzles';
import { themedForLesson } from '../lib/puzzlebank';
import { markPlanDone, isUnlocked, nextLesson } from '../lib/plan';
import { playForMove, play } from '../lib/sound';
import { checkBadges } from '../lib/progress';

function fenOf(s: { fen?: string; pre?: string[] }) {
  if (!s.pre?.length) return s.fen || START_FEN;
  const ch = new Chess(s.fen || START_FEN); for (const m of s.pre) tryMove(ch, m); return ch.fen();
}
function sanLineToUci(fen: string, sans: string[]) { const ch = new Chess(fen); return sans.map((s) => { const m = tryMove(ch, s); return m ? moveToUci(m) : ''; }); }

export function LessonPage({ id }: { id: string }) {
  const [lesson, setLesson] = useState<L | undefined>(() => lessonById(id) || cachedCourseLesson(id));
  const [courseList, setCourseList] = useState<L[] | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => { const l = lessonById(id) || cachedCourseLesson(id); setLesson(l); setMissing(false); if (!l) findLesson(id).then((x) => { setLesson(x); setMissing(!x); }); }, [id]);
  useEffect(() => { if (lesson?.course) loadCourses().then((m) => setCourseList(m.COURSES.find((c) => c.id === lesson.course)?.lessons || null)); }, [lesson?.course]);
  const ent = usePremium();
  const st = useStore((s) => s);
  const [i, setI] = useState(0);
  const [mist, setMist] = useState(0);
  const [hints, setHints] = useState(0);
  const [solved, setSolved] = useState(false);
  const [finished, setFinished] = useState(false);
  const [sol, setSol] = useState(0);
  const [reset, setReset] = useState(0);
  const [totalMist, setTotalMist] = useState(0);
  /** réussite interactive (pas « Passer », pas la solution) : l'étape avance seule */
  const [won, setWon] = useState(false);
  useEffect(() => { setI(0); setFinished(false); setTotalMist(0); }, [id]);
  useEffect(() => { setMist(0); setHints(0); setSolved(false); setSol(0); setWon(false); }, [i, id]);
  if (!lesson) return missing ? <div class="page"><NavBar back="#/learn" backLabel="Apprendre" /><h1>Leçon introuvable</h1></div> : <div class="page"><div class="loading" aria-label="Chargement de la leçon" /></div>;
  if (lesson.level === 'expert' && !ent.premium) return <div class="page"><NavBar back="#/learn" backLabel="Apprendre" /><h1>{lesson.title}</h1><PremiumLock title="Leçon Expert" text="Le niveau Expert (calcul avancé, prophylaxie, finales complexes et parties légendaires commentées) fait partie de Premium." /><FreeNext /></div>;
  if (!lesson.course && !isUnlocked(st, lesson.id)) return <LockedLesson lesson={lesson} />;
  const step = lesson.steps[i];
  const lv = LEVELS.find((l) => l.id === lesson.level)!;
  const interactive = step.type === 'exercise' || step.type === 'puzzles';
  const canNext = !interactive || solved;
  const next = () => {
    if (i < lesson.steps.length - 1) { setI(i + 1); return; }
    const stars = totalMist === 0 ? 3 : totalMist <= 3 ? 2 : 1;
    const first = !st.lessons[lesson.id]?.done;
    setState((s) => { const prev = s.lessons[lesson.id]; s.lessons[lesson.id] = { done: true, stars: Math.max(stars, prev?.stars || 0), step: 0 }; markPlanDone(s, 'lesson:' + lesson.id); pushCoach(s, { k: 'lesson', t: Date.now(), id: lesson.id, level: lesson.level, stars }); });
    addXp(first ? 30 + stars * 10 : 10, 'Leçon terminée'); play('win'); checkBadges(); setFinished(true);
  };
  const onSolved = () => { setSolved(true); setWon(true); };
  const onMistake = () => { setMist((m) => m + 1); setTotalMist((m) => m + 1); };
  const seq = lesson.course ? courseList || [] : LESSONS; const idx = seq.indexOf(lesson); const nextL = seq[idx + 1];
  const backHref = lesson.course ? `#/learn/course/${lesson.course}` : '#/learn';
  const canChain = !!nextL && (nextL.level !== 'expert' || ent.premium) && (!!nextL.course || isUnlocked(st, nextL.id));
  if (finished) {
    const s2 = st.lessons[lesson.id];
    return (
      <div class="page lesson done-screen">
        <div class="celebrate"><Icon name="trophy" size={56} stroke={1.8} /></div>
        <h1>Leçon terminée</h1>
        <div class="stars-big"><Stars n={s2?.stars || 1} size={34} /></div>
        <p class="muted">{totalMist === 0 ? 'Sans la moindre erreur. Impressionnant.' : `${totalMist} erreur${totalMist > 1 ? 's' : ''}. Refais-la pour viser trois étoiles.`}</p>
        {/* fin de leçon : on enchaîne sur la suivante, sinon on retombe dans le fil */}
        <div class="col center-col done-next">
          {canChain && <p class="muted small next-title">Ensuite : {nextL!.title}</p>}
          {canChain ? <AutoNext ms={6000} count onGo={() => go(`/lesson/${nextL!.id}`)}>Leçon suivante<Icon name="right" size={18} stroke={2.5} /></AutoNext>
            : <AutoNext ms={6000} count onGo={() => go('/')}>Retour à Pour toi<Icon name="sparkles" size={18} /></AutoNext>}
          <div class="row center done-links"><a class="btn plain" href={backHref}>{lesson.course ? 'Le cours' : 'Le parcours'}</a><button class="btn plain" onClick={() => { setI(0); setFinished(false); setTotalMist(0); }}>Recommencer</button></div>
        </div>
      </div>
    );
  }
  return (
    <div class="page lesson" style={{ '--c': levelColor(lv.id) } as any}>
      <div class="lesson-top">
        <a class="nb-btn round" href={backHref} aria-label="Quitter la leçon"><Icon name="close" size={18} stroke={2.5} /></a>
        <Progress value={(i + (canNext ? 1 : 0)) / lesson.steps.length} color={levelColor(lv.id)} />
        <span class="muted small" aria-label={`Étape ${i + 1} sur ${lesson.steps.length}`}>{i + 1}/{lesson.steps.length}</span>
      </div>
      <div class="lesson-grid">
        <div class="lesson-board">
          <StepBoard key={`${id}-${i}`} step={step} lessonId={lesson.id} hints={hints} sol={sol} reset={reset} onSolved={onSolved} onMistake={onMistake} />
        </div>
        <div class="lesson-side">
          <p class="eyebrow">{lesson.title}</p>
          <h2>{step.title}</h2>
          {'body' in step && step.body && <Md text={step.body} />}
          {step.type === 'exercise' && <div class="prompt"><Md text={step.prompt} /></div>}
          {step.type === 'exercise' && hints > 0 && step.hints && <div class="hint-box"><Icon name="bulb" size={18} /><div>{step.hints.slice(0, hints).map((h) => <p>{h}</p>)}</div></div>}
          {step.type === 'exercise' && solved && step.success && <p class="success-box"><Icon name="checkCircle" size={20} />{step.success}</p>}
          <div class="lesson-actions">
            {step.type === 'exercise' && !solved && (
              <>
                {step.hints && hints < step.hints.length + (['line', 'any', 'mate'].includes(step.goal.kind) ? 2 : 0) && <button class="btn secondary icon" onClick={() => setHints((h) => h + 1)} aria-label="Indice" title="Indice"><Icon name="bulb" size={20} /></button>}
                {['play', 'stars'].includes(step.goal.kind) && <button class="btn secondary icon" onClick={() => setReset((r) => r + 1)} aria-label="Recommencer" title="Recommencer"><Icon name="reset" size={20} /></button>}
                {['line', 'any', 'mate'].includes(step.goal.kind) && mist >= 2 && <button class="btn secondary icon" onClick={() => { setSol((x) => x + 1); onMistake(); setTimeout(() => setSolved(true), 300 + 700 * (step.goal.kind === 'line' ? step.goal.moves.length : 1)); }} aria-label="Solution" title="Solution"><Icon name="eye" size={20} /></button>}
                {step.goal.kind === 'play' && mist >= 1 && <button class="btn secondary" onClick={() => setSolved(true)}>Passer</button>}
              </>
            )}
            {won && solved ? <AutoNext key={i} ms={Math.min(9000, 1300 + ((step.type === 'exercise' && step.success) || '').length * 30)} stop={null} onGo={next}>{i === lesson.steps.length - 1 ? 'Terminer' : 'Continuer'}</AutoNext>
              : <button class={'btn primary ' + (canNext ? '' : 'disabled')} disabled={!canNext} onClick={next}>{i === lesson.steps.length - 1 ? 'Terminer' : canNext ? 'Continuer' : interactive ? 'À toi de jouer' : 'Continuer'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** coup différent de la solution : le coach (chargé à la demande) l'accepte s'il est aussi bon, sinon l'explique */
const judgeMove = (fen: string, uci: string, rest: string[]) => import('../coach/client').then((c) => c.judgeLessonMove(fen, uci, rest));
export function StepBoard({ step, lessonId, hints, sol, reset, onSolved, onMistake }: { step: Step; lessonId: string; hints: number; sol: number; reset: number; onSolved: () => void; onMistake: () => void }) {
  if (step.type === 'text') return <Board fen={fenOf(step)} viewOnly orientation={step.orientation} shapes={toShapes(step.shapes)} />;
  if (step.type === 'demo') return <Demo step={step} />;
  if (step.type === 'puzzles') return <LessonPuzzles step={step} lessonId={lessonId} onSolved={onSolved} onMistake={onMistake} />;
  const g = step.goal; const fen = fenOf(step);
  const moveHints = Math.max(0, hints - (step.hints?.length || 0));
  switch (g.kind) {
    case 'stars': return <StarsExercise piece={g.piece} from={g.from} stars={g.stars} blockers={g.blockers} par={g.par} resetSignal={reset} onDone={(c) => { if (!c) onMistake(); onSolved(); }} />;
    case 'select': return <SelectExercise fen={fen} squares={g.squares} orientation={step.orientation} onDone={onSolved} onMistake={onMistake} />;
    case 'quiz': return <div><Board fen={fen} viewOnly orientation={step.orientation} shapes={toShapes(step.shapes)} /><Quiz options={g.options} answer={g.answer} onDone={onSolved} onMistake={onMistake} /></div>;
    case 'play': return <PlayGoal fen={fen} result={g.result} maxMoves={g.maxMoves} script={g.script} orientation={step.orientation} resetSignal={reset} onDone={onSolved} onFail={onMistake} />;
    case 'line': return <MoveTrainer fen={fen} line={sanLineToUci(fen, g.moves)} orientation={step.orientation} hintLevel={moveHints} showSolutionSignal={sol} judge={judgeMove} onSolved={onSolved} onMistake={onMistake} />;
    case 'any': {
      const line = sanLineToUci(fen, [g.accept[0]]);
      return <MoveTrainer fen={fen} line={line} orientation={step.orientation} hintLevel={moveHints} showSolutionSignal={sol} accept={(_, m) => g.accept.some((a) => a.replace(/[+#]/g, '') === m.san.replace(/[+#]/g, ''))} judge={judgeMove} onSolved={onSolved} onMistake={onMistake} />;
    }
    case 'mate': case 'check': {
      const ch = new Chess(fen);
      const target = ch.moves({ verbose: true }).find((m) => { const c = new Chess(fen); c.move(m); return g.kind === 'mate' ? c.isCheckmate() : c.inCheck(); });
      return <MoveTrainer fen={fen} line={target ? [moveToUci(target)] : []} orientation={step.orientation} hintLevel={moveHints} showSolutionSignal={sol} accept={(_, m, after) => (g.kind === 'mate' ? after.isCheckmate() : after.inCheck())} onSolved={onSolved} onMistake={onMistake} />;
    }
  }
}
function Demo({ step }: { step: Extract<Step, { type: 'demo' }> }) {
  const start = fenOf(step);
  const [ply, setPly] = useState(0); const [auto, setAuto] = useState(false);
  const pos = useMemo(() => { const ch = new Chess(start); let last: [string, string] | null = null; for (const m of step.moves.slice(0, ply)) { const r = tryMove(ch, m); if (r) last = [r.from, r.to]; } return { fen: ch.fen(), last }; }, [ply, start]);
  useEffect(() => { if (!auto) return; if (ply >= step.moves.length) { setAuto(false); return; } const t = setTimeout(() => go(ply + 1), 1100); return () => clearTimeout(t); }, [auto, ply]);
  const go = (n: number) => { n = Math.max(0, Math.min(step.moves.length, n)); if (n === ply + 1) { const ch = new Chess(pos.fen); const m = tryMove(ch, step.moves[ply]); if (m) playForMove(m); } setPly(n); };
  const comment = ply > 0 ? step.comments?.[ply - 1] : null;
  const num = (k: number) => (k % 2 === 0 ? `${k / 2 + 1}.` : '');
  return (
    <div class="demo">
      <Board fen={pos.fen} viewOnly orientation={step.orientation} lastMove={pos.last} />
      <div class="demo-comment" aria-live="polite">{ply === 0 ? <span class="muted">Appuie sur lecture pour voir la démonstration.</span> : <><b>{num(ply - 1) || `${Math.floor((ply - 1) / 2) + 1}…`} {sanFr(step.moves[ply - 1])}</b> {comment ? inlineMd(comment) : ''}</>}</div>
      <div class="demo-ctrl">
        <button class="btn icon" onClick={() => go(0)} aria-label="Début"><Icon name="first" size={20} /></button>
        <button class="btn icon" onClick={() => go(ply - 1)} aria-label="Précédent"><Icon name="left" size={22} stroke={2.4} /></button>
        <button class="btn icon primary" onClick={() => { if (ply >= step.moves.length) setPly(0); setAuto(!auto); }} aria-label={auto ? 'Pause' : 'Lecture'}><Icon name={auto ? 'pause' : 'playIcon'} size={22} /></button>
        <button class="btn icon" onClick={() => go(ply + 1)} aria-label="Suivant"><Icon name="right" size={22} stroke={2.4} /></button>
        <button class="btn icon" onClick={() => go(step.moves.length)} aria-label="Fin"><Icon name="last" size={20} /></button>
      </div>
      <div class="demo-moves">{step.moves.map((m, k) => <button class={'mv ' + (k === ply - 1 ? 'cur' : '') + (step.comments?.[k] ? ' has-c' : '')} onClick={() => setPly(k + 1)}>{num(k)}{sanFr(m)}</button>)}</div>
    </div>
  );
}
function LessonPuzzles({ step, lessonId, onSolved, onMistake }: { step: Extract<Step, { type: 'puzzles' }>; lessonId: string; onSolved: () => void; onMistake: () => void }) {
  const [list, setList] = useState<Puzzle[] | null>(null); const [k, setK] = useState(0); const [done, setDone] = useState(0); const [hint, setHint] = useState(0); const [sol, setSol] = useState(0); const [solvedCur, setSolvedCur] = useState(false);
  useEffect(() => { loadPuzzles().then(async (all) => { const base = lessonPuzzles(all, lessonId, step.themes, step.count, step.maxRating, step.minRating); if (base.length >= step.count) { setList(base); return; } try { const more = await themedForLesson(lessonId, step.themes, step.count - base.length, step.minRating ?? 0, step.maxRating); setList([...base, ...more]); } catch { setList(base); } }); }, []);
  if (!list) return <div class="loading" aria-label="Chargement des puzzles" />;
  const p = list[k];
  if (!p) return <div class="empty"><div class="empty-icon"><Icon name="trophy" size={30} /></div><h3>Série terminée</h3></div>;
  return (
    <div data-pz={p.i}>
      <MoveTrainer key={p.i} fen={p.f} line={p.m.split(' ')} setup hintLevel={hint} showSolutionSignal={sol}
        onMistake={() => { onMistake(); }} onSolved={() => { setSolvedCur(true); const d = done + 1; setDone(d); if (d >= list.length) onSolved(); else setTimeout(() => { setK((x) => x + 1); setHint(0); setSolvedCur(false); }, 900); }} />
      <div class="row between puzzle-bar">
        <span class="muted small tnum">Puzzle {k + 1} sur {list.length} · {p.r}</span>
        <div class="row">
          {!solvedCur && <button class="btn small secondary" onClick={() => setHint((h) => h + 1)}><Icon name="bulb" size={16} />Indice</button>}
          {!solvedCur && <button class="btn small secondary" onClick={() => { setSol((x) => x + 1); onMistake(); setSolvedCur(true); const d = done + 1; setDone(d); if (d >= list.length) onSolved(); }}><Icon name="eye" size={16} />Solution</button>}
          {solvedCur && k < list.length - 1 && sol > 0 && <button class="btn small primary" onClick={() => { setK(k + 1); setHint(0); setSolvedCur(false); setSol(0); }}>Suivant<Icon name="right" size={16} stroke={2.5} /></button>}
        </div>
      </div>
    </div>
  );
}
/** Leçon verrouillée : jamais une impasse — la leçon qui l'ouvre, le déblocage du niveau, ou le fil. */
function LockedLesson({ lesson }: { lesson: L }) {
  const st = useStore((s) => s); const lv = LEVELS.find((l) => l.id === lesson.level)!;
  const same = LESSONS.filter((l) => l.level === lesson.level); const pos = same.indexOf(lesson);
  const before = same.slice(0, pos).find((l) => !st.lessons[l.id]?.done && isUnlocked(st, l.id)) || nextLesson(st);
  return (
    <div class="page center-page locked-lesson">
      <NavBar back="#/learn" backLabel="Apprendre" />
      <div class="celebrate"><Icon name="lock" size={48} stroke={1.8} /></div>
      <h1>{lesson.title}</h1>
      <p class="muted">{before ? `Cette leçon s’ouvre après « ${before.title} ». Chaque leçon s’appuie sur la précédente.` : 'Cette leçon s’ouvre quand le niveau précédent est fait.'}</p>
      <div class="col center-col">
        {before && <a class="btn primary lg" href={`#/lesson/${before.id}`}><Icon name="playIcon" size={18} />Commencer « {before.title} »</a>}
        <button class="btn secondary" onClick={() => setState((s) => { s.lessons['unlock-' + lesson.level] = { done: false, stars: 0, step: 0 }; })}><Icon name="lockOpen" size={18} />Je connais déjà : ouvrir le niveau {lv.name}</button>
        <a class="btn plain" href="#/">Retour à Pour toi</a>
      </div>
    </div>
  );
}
/** Sous un verrou Premium : une suite gratuite, toujours (premium honnête). */
function FreeNext() {
  const st = useStore((s) => s); const nl = nextLesson(st);
  return <div class="col center-col free-next">{nl && <a class="btn secondary" href={`#/lesson/${nl.id}`}>Continuer le parcours gratuit : {nl.title}</a>}<a class="btn plain" href="#/">Retour à Pour toi</a></div>;
}
export type { L };
