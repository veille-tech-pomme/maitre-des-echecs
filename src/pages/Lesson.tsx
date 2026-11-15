import { useEffect, useMemo, useState } from 'preact/hooks';
import { lessonById, LESSONS, LEVELS, type Step, type Lesson as L } from '../data/lessons';
import { Board, toShapes } from '../components/Board';
import { MoveTrainer } from '../components/MoveTrainer';
import { StarsExercise, SelectExercise, Quiz, PlayGoal } from '../components/Exercises';
import { Md, Progress, PremiumLock } from '../components/ui';
import { Chess, tryMove, moveToUci, START_FEN, sanFr } from '../lib/chess';
import { setState, addXp, useStore } from '../lib/store';
import { usePremium } from '../lib/entitlements';
import { loadPuzzles, lessonPuzzles, type Puzzle } from '../lib/puzzles';
import { markPlanDone, isUnlocked } from '../lib/plan';
import { playForMove, play } from '../lib/sound';
import { checkBadges } from '../lib/progress';

function fenOf(s: { fen?: string; pre?: string[] }) {
  if (!s.pre?.length) return s.fen || START_FEN;
  const ch = new Chess(s.fen || START_FEN); for (const m of s.pre) tryMove(ch, m); return ch.fen();
}
function sanLineToUci(fen: string, sans: string[]) { const ch = new Chess(fen); return sans.map((s) => { const m = tryMove(ch, s); return m ? moveToUci(m) : ''; }); }

export function LessonPage({ id }: { id: string }) {
  const lesson = lessonById(id);
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
  useEffect(() => { setI(0); setFinished(false); setTotalMist(0); }, [id]);
  useEffect(() => { setMist(0); setHints(0); setSolved(false); setSol(0); }, [i, id]);
  if (!lesson) return <div class="page"><h1>Leçon introuvable</h1><a href="#/learn">Retour</a></div>;
  if (lesson.level === 'expert' && !ent.premium) return <div class="page"><a class="back" href="#/learn">‹ Parcours</a><h1>{lesson.icon} {lesson.title}</h1><PremiumLock title="Leçon Expert" text="Le niveau Expert (calcul avancé, prophylaxie, finales complexes et parties légendaires commentées) fait partie de Premium." /></div>;
  const step = lesson.steps[i];
  const lv = LEVELS.find((l) => l.id === lesson.level)!;
  const interactive = step.type === 'exercise' || step.type === 'puzzles';
  const canNext = !interactive || solved;
  const next = () => {
    if (i < lesson.steps.length - 1) { setI(i + 1); return; }
    const stars = totalMist === 0 ? 3 : totalMist <= 3 ? 2 : 1;
    const first = !st.lessons[lesson.id]?.done;
    setState((s) => { const prev = s.lessons[lesson.id]; s.lessons[lesson.id] = { done: true, stars: Math.max(stars, prev?.stars || 0), step: 0 }; markPlanDone(s, 'lesson:' + lesson.id); });
    addXp(first ? 30 + stars * 10 : 10, 'Leçon terminée'); play('win'); checkBadges(); setFinished(true);
  };
  const onSolved = () => { setSolved(true); };
  const onMistake = () => { setMist((m) => m + 1); setTotalMist((m) => m + 1); };
  const idx = LESSONS.indexOf(lesson); const nextL = LESSONS[idx + 1];
  if (finished) {
    const s2 = st.lessons[lesson.id];
    return (
      <div class="page lesson done-screen">
        <div class="celebrate">🎉</div>
        <h1>Leçon terminée !</h1>
        <p class="stars-big">{'★'.repeat(s2?.stars || 1)}{'☆'.repeat(3 - (s2?.stars || 1))}</p>
        <p class="muted">{totalMist === 0 ? 'Sans aucune erreur, impressionnant !' : `${totalMist} erreur${totalMist > 1 ? 's' : ''} — refais la leçon pour viser 3 étoiles.`}</p>
        <div class="row center">
          <button class="btn ghost" onClick={() => { setI(0); setFinished(false); setTotalMist(0); }}>Recommencer</button>
          {nextL && (nextL.level !== 'expert' || ent.premium) && isUnlocked(st, nextL.id) ? <a class="btn primary" href={`#/lesson/${nextL.id}`}>Leçon suivante : {nextL.title} ›</a> : <a class="btn primary" href="#/learn">Retour au parcours</a>}
        </div>
      </div>
    );
  }
  return (
    <div class="page lesson" style={{ '--c': lv.color } as any}>
      <div class="lesson-top">
        <a class="back" href="#/learn" aria-label="Retour au parcours">✕</a>
        <Progress value={(i + (canNext ? 1 : 0)) / lesson.steps.length} color={lv.color} />
        <span class="muted small">{i + 1}/{lesson.steps.length}</span>
      </div>
      <div class="lesson-grid">
        <div class="lesson-board">
          <StepBoard key={`${id}-${i}`} step={step} lessonId={lesson.id} hints={hints} sol={sol} reset={reset} onSolved={onSolved} onMistake={onMistake} />
        </div>
        <div class="lesson-side">
          <p class="eyebrow">{lesson.icon} {lesson.title}</p>
          <h2>{step.title}</h2>
          {'body' in step && step.body && <Md text={step.body} />}
          {step.type === 'exercise' && <div class="prompt"><Md text={step.prompt} /></div>}
          {step.type === 'exercise' && hints > 0 && step.hints && <div class="hint-box">{step.hints.slice(0, hints).map((h) => <p>💡 {h}</p>)}</div>}
          {step.type === 'exercise' && solved && step.success && <p class="success-box">✅ {step.success}</p>}
          <div class="lesson-actions">
            {step.type === 'exercise' && !solved && (
              <>
                {step.hints && hints < step.hints.length + (['line', 'any', 'mate'].includes(step.goal.kind) ? 2 : 0) && <button class="btn ghost" onClick={() => setHints((h) => h + 1)}>💡 Indice</button>}
                {['play', 'stars'].includes(step.goal.kind) && <button class="btn ghost" onClick={() => setReset((r) => r + 1)}>↺ Recommencer</button>}
                {['line', 'any', 'mate'].includes(step.goal.kind) && mist >= 2 && <button class="btn ghost" onClick={() => { setSol((x) => x + 1); onMistake(); }}>👁 Solution</button>}
                {step.goal.kind === 'play' && mist >= 1 && <button class="btn ghost" onClick={() => setSolved(true)}>Passer</button>}
              </>
            )}
            <button class={'btn primary ' + (canNext ? '' : 'disabled')} disabled={!canNext} onClick={next}>{i === lesson.steps.length - 1 ? 'Terminer' : 'Continuer'} ›</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepBoard({ step, lessonId, hints, sol, reset, onSolved, onMistake }: { step: Step; lessonId: string; hints: number; sol: number; reset: number; onSolved: () => void; onMistake: () => void }) {
  if (step.type === 'text') return <Board fen={fenOf(step)} viewOnly orientation={step.orientation} shapes={toShapes(step.shapes)} />;
  if (step.type === 'demo') return <Demo step={step} />;
  if (step.type === 'puzzles') return <LessonPuzzles step={step} lessonId={lessonId} onSolved={onSolved} onMistake={onMistake} />;
  const g = step.goal; const fen = fenOf(step);
  const moveHints = Math.max(0, hints - (step.hints?.length || 0));
  switch (g.kind) {
    case 'stars': return <StarsExercise piece={g.piece} from={g.from} stars={g.stars} blockers={g.blockers} par={g.par} resetSignal={reset} onDone={(c) => { if (!c) onMistake(); onSolved(); }} />;
    case 'select': return <SelectExercise fen={fen} squares={g.squares} orientation={step.orientation} onDone={onSolved} onMistake={onMistake} />;
    case 'quiz': return <div><Board fen={fen} viewOnly orientation={step.orientation} shapes={toShapes(step.shapes)} /><Quiz options={g.options} answer={g.answer} onDone={onSolved} onMistake={onMistake} /></div>;
    case 'play': return <PlayGoal fen={fen} result={g.result} maxMoves={g.maxMoves} orientation={step.orientation} resetSignal={reset} onDone={onSolved} onFail={onMistake} />;
    case 'line': return <MoveTrainer fen={fen} line={sanLineToUci(fen, g.moves)} orientation={step.orientation} hintLevel={moveHints} showSolutionSignal={sol} onSolved={onSolved} onMistake={onMistake} />;
    case 'any': {
      const line = sanLineToUci(fen, [g.accept[0]]);
      return <MoveTrainer fen={fen} line={line} orientation={step.orientation} hintLevel={moveHints} showSolutionSignal={sol} accept={(_, m) => g.accept.some((a) => a.replace(/[+#]/g, '') === m.san.replace(/[+#]/g, ''))} onSolved={onSolved} onMistake={onMistake} />;
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
      <div class="demo-comment" aria-live="polite">{ply === 0 ? '▶ Lance la démonstration' : <><b>{num(ply - 1) || `${Math.floor((ply - 1) / 2) + 1}…`} {sanFr(step.moves[ply - 1])}</b> {comment || ''}</>}</div>
      <div class="demo-ctrl">
        <button class="btn icon" onClick={() => go(0)} aria-label="Début">⏮</button>
        <button class="btn icon" onClick={() => go(ply - 1)} aria-label="Précédent">◀</button>
        <button class="btn icon primary" onClick={() => { if (ply >= step.moves.length) setPly(0); setAuto(!auto); }} aria-label="Lecture">{auto ? '⏸' : '▶'}</button>
        <button class="btn icon" onClick={() => go(ply + 1)} aria-label="Suivant">▶</button>
        <button class="btn icon" onClick={() => go(step.moves.length)} aria-label="Fin">⏭</button>
      </div>
      <div class="demo-moves">{step.moves.map((m, k) => <button class={'mv ' + (k === ply - 1 ? 'cur' : '') + (step.comments?.[k] ? ' has-c' : '')} onClick={() => setPly(k + 1)}>{num(k)}{sanFr(m)}</button>)}</div>
    </div>
  );
}
function LessonPuzzles({ step, lessonId, onSolved, onMistake }: { step: Extract<Step, { type: 'puzzles' }>; lessonId: string; onSolved: () => void; onMistake: () => void }) {
  const [list, setList] = useState<Puzzle[] | null>(null); const [k, setK] = useState(0); const [done, setDone] = useState(0); const [hint, setHint] = useState(0); const [sol, setSol] = useState(0); const [solvedCur, setSolvedCur] = useState(false);
  useEffect(() => { loadPuzzles().then((all) => setList(lessonPuzzles(all, lessonId, step.themes, step.count, step.maxRating, step.minRating))); }, []);
  if (!list) return <div class="loading">Chargement des puzzles…</div>;
  const p = list[k];
  if (!p) return <div class="empty">🎉 Série terminée !</div>;
  return (
    <div>
      <MoveTrainer key={p.i} fen={p.f} line={p.m.split(' ')} setup hintLevel={hint} showSolutionSignal={sol}
        onMistake={() => { onMistake(); }} onSolved={() => { setSolvedCur(true); const d = done + 1; setDone(d); if (d >= list.length) onSolved(); }} />
      <div class="row between puzzle-bar">
        <span class="muted small">Puzzle {k + 1}/{list.length} · {p.r}</span>
        <div class="row">
          {!solvedCur && <button class="btn small ghost" onClick={() => setHint((h) => h + 1)}>💡</button>}
          {!solvedCur && <button class="btn small ghost" onClick={() => { setSol((x) => x + 1); onMistake(); setSolvedCur(true); const d = done + 1; setDone(d); if (d >= list.length) onSolved(); }}>👁</button>}
          {solvedCur && k < list.length - 1 && <button class="btn small primary" onClick={() => { setK(k + 1); setHint(0); setSolvedCur(false); }}>Suivant ›</button>}
        </div>
      </div>
    </div>
  );
}
export type { L };
