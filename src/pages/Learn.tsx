import { useEffect, useState } from 'preact/hooks';
import { useStore, setState } from '../lib/store';
import { LESSONS, LEVELS, loadCourses } from '../data/lessons';
import { isUnlocked, nextLesson } from '../lib/plan';
import { usePremium } from '../lib/entitlements';
import { Progress, toast, LargeTitle, NavBar, Item, Stars } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { LEVEL_VIS, levelColor } from '../lib/visual';
import { isDue } from '../lib/srs';
import { today } from '../lib/store';
type Courses = Awaited<ReturnType<typeof loadCourses>>['COURSES'];
function useCourses() { const [c, setC] = useState<Courses | null>(null); useEffect(() => { loadCourses().then((m) => setC(m.COURSES)); }, []); return c; }
const COURSE_VIS: Record<string, { icon: IconName; color: string }> = {
  mats: { icon: 'king', color: '#FF453A' }, tactique: { icon: 'swords', color: '#FF9F0A' }, ouvertures: { icon: 'book', color: '#30A46C' },
  strategie: { icon: 'brain', color: '#0A84FF' }, finales: { icon: 'flag', color: '#5E5CE6' }, parties: { icon: 'library', color: '#BF5AF2' },
};
const cvis = (id: string) => COURSE_VIS[id] || { icon: 'learn' as IconName, color: '#8E8E93' };

export function Learn() {
  const s = useStore((x) => x);
  const ent = usePremium();
  const nl = nextLesson(s);
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({ [nl?.level || 'debutant']: true }));
  const done = LESSONS.filter((l) => s.lessons[l.id]?.done).length;
  return (
    <div class="page learn">
      <LargeTitle title="Apprendre" sub={`${done} sur ${LESSONS.length} leçons du parcours`} />
      <ContinueLesson />
      <PuzzleEntry />
      <div class="section-title"><h2>Le parcours</h2></div>
      {LEVELS.map((lv) => {
        const ls = LESSONS.filter((l) => l.level === lv.id);
        const d = ls.filter((l) => s.lessons[l.id]?.done).length;
        const locked = lv.id === 'expert' && !ent.premium;
        const firstUnlocked = isUnlocked(s, ls[0].id);
        const vis = LEVEL_VIS[lv.id]; const isOpen = !!open[lv.id];
        return (
          <section class={'level ' + (isOpen ? 'open' : '')} style={{ '--c': vis.color } as any}>
            <button class="level-head" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [lv.id]: !isOpen })}>
              <span class="level-icon"><Icon name={vis.icon} size={22} /></span>
              <span class="grow">
                <span class="lh-title">{lv.name}{locked && <span class="pill gold"><Icon name="crown" size={12} />Premium</span>}</span>
                <span class="lh-sub">Elo {lv.elo} · {d}/{ls.length} leçons</span>
                <Progress value={d / ls.length} color={vis.color} />
              </span>
              <Icon name="down" size={20} class="lh-chev" stroke={2.4} />
            </button>
            {isOpen && <>
              <p class="level-desc">{lv.desc}</p>
              {!firstUnlocked && !locked && (
                <button class="btn tinted small skip" onClick={() => { setState((st) => { st.lessons['unlock-' + lv.id] = { done: false, stars: 0, step: 0 }; }); toast(`Niveau ${lv.name} débloqué`, 'lock'); }}>
                  <Icon name="lock" size={15} />Je connais déjà les bases : débloquer
                </button>
              )}
              <ol class="path">
                {ls.map((l, i) => {
                  const st = s.lessons[l.id]; const un = isUnlocked(s, l.id);
                  const href = locked ? '#/premium' : `#/lesson/${l.id}`; // verrouillée : la page de la leçon propose la suite (jamais un toast sans issue)
                  const cur = nl?.id === l.id;
                  return (
                    <li class={'node ' + (st?.done ? 'done' : un ? 'open' : 'locked') + (cur ? ' current' : '')}>
                      <a href={href} aria-label={un || locked ? undefined : `${l.title} (verrouillée)`}>
                        <span class="node-icon">{locked ? <Icon name="crown" size={18} /> : st?.done ? <Icon name="check" size={20} stroke={3} /> : un ? <b class="tnum">{i + 1}</b> : <Icon name="lock" size={17} />}</span>
                        <span class="node-text"><b>{l.title}</b><small>{l.summary}</small></span>
                        <span class="node-meta">{st?.done ? <Stars n={st.stars} size={12} /> : <small>{l.minutes} min</small>}</span>
                      </a>
                    </li>
                  );
                })}
              </ol>
            </>}
          </section>
        );
      })}
      <CourseGrid />
      <div class="section-title"><h2>Bibliothèque</h2></div>
      <div class="list">
        <Item href="#/openings" icon="book" color="#30A46C" title="Ouvertures" sub="Répertoire, lignes et explorateur des maîtres" />
        <Item href="#/endgames" icon="flag" color="#5E5CE6" title="Finales" sub="90 positions à gagner contre le moteur" />
        <Item href="#/train" icon="dumbbell" color="#FF9F0A" title="Entraînement" sub="Coordonnées, vision, mémoire, devine le coup" />
      </div>
    </div>
  );
}

/** Leçon en cours (anciennement sur l'accueil). Parcours terminé : une prochaine action, jamais une impasse. */
function ContinueLesson() {
  const s = useStore((x) => x); const nl = nextLesson(s);
  const doneCount = LESSONS.filter((l) => s.lessons[l.id]?.done).length;
  if (!nl) return (
    <a class="hero-card" href="#/play">
      <span class="hc-eyebrow">Parcours terminé</span><h2>Bravo, tu as tout appris.</h2><p>Mets ton savoir à l’épreuve face à un bot, ou approfondis avec les cours.</p>
      <span class="btn primary"><Icon name="play" size={18} />Jouer</span>
    </a>
  );
  const lv = LEVELS.find((l) => l.id === nl.level)!; const ls = LESSONS.filter((l) => l.level === nl.level); const d = ls.filter((l) => s.lessons[l.id]?.done).length;
  return (
    <a class="hero-card" href={`#/lesson/${nl.id}`}>
      <span class="hc-art" aria-hidden="true"><Icon name={LEVEL_VIS[nl.level]?.icon || 'king'} size={128} stroke={1.2} /></span>
      <span class="hc-eyebrow">{doneCount ? 'Continuer' : 'Ta première leçon'} · {lv.name}</span>
      <h2>{nl.title}</h2>
      <p>{nl.summary}</p>
      <span class="btn primary"><Icon name="playIcon" size={18} />{doneCount ? 'Continuer' : 'Commencer'}</span>
      <span class="hc-meta"><Icon name="clock" size={15} />{nl.minutes} min<span aria-hidden="true">·</span><span class="grow"><Progress value={d / Math.max(1, ls.length)} /></span>{d}/{ls.length}</span>
    </a>
  );
}
/** Les puzzles vivent dans le fil « Pour toi » ; ici, l'entrée claire vers les modes complets. */
function PuzzleEntry() {
  const s = useStore((x) => x); const due = Object.values(s.srs).filter((x) => isDue(x)).length;
  return (
    <section class="pz-entry">
      <a class="card pz-hub" href="#/puzzles">
        <span class="it-icon" style="--c:#0A84FF"><Icon name="puzzle" size={22} /></span>
        <span class="grow"><b>Puzzles</b><small>Classés, par thème, parcours, duel, sur mesure</small></span>
        <span class="pz-rating"><b class="tnum">{s.puzzle.rating}</b><small>classement</small></span>
        <Icon name="right" size={18} class="chev" stroke={2.4} />
      </a>
      <div class="tiles">
        <a class="tile" href="#/puzzles/daily"><span class="tl-icon" style="--c:#0A84FF"><Icon name="calendar" size={20} /></span>{s.daily[today()] && <span class="tl-badge pill ok"><Icon name="check" size={12} stroke={3} />Fait</span>}<b>Puzzle du jour</b><small>Un défi par jour</small></a>
        <a class="tile" href="#/puzzles/rush"><span class="tl-icon" style="--c:#FF9F0A"><Icon name="timer" size={20} /></span><b>Contre la montre</b><small>3 minutes, 3 vies</small></a>
        <a class="tile" href="#/review"><span class="tl-icon" style="--c:#5E5CE6"><Icon name="repeat" size={20} /></span>{due > 0 && <span class="tl-badge badge-n">{due}</span>}<b>Révisions</b><small>{due ? `${due} à revoir` : 'Tout est à jour'}</small></a>
        <a class="tile" href="#/analysis"><span class="tl-icon" style="--c:#64D2FF"><Icon name="microscope" size={20} /></span><b>Analyse</b><small>Stockfish 18</small></a>
      </div>
    </section>
  );
}
function CourseGrid() {
  const cs = useCourses(); const s = useStore((x) => x); const ent = usePremium();
  if (!cs) return <div class="course-scroll" aria-busy="true">{[0, 1, 2].map(() => <div class="course-card skeleton" />)}</div>;
  const total = cs.reduce((a, c) => a + c.lessons.length, 0);
  return (
    <section>
      <div class="section-title"><h2>Cours</h2><span class="muted">{total} leçons</span></div>
      <div class="course-scroll">{cs.map((c) => {
        const d = c.lessons.filter((l) => s.lessons[l.id]?.done).length; const v = cvis(c.id);
        return (
          <a class="course-card" href={`#/learn/course/${c.id}`} style={{ '--c': v.color } as any}>
            <span class="cc-art" aria-hidden="true"><Icon name={v.icon} size={110} stroke={1.3} /></span>
            <span class="cc-icon"><Icon name={v.icon} size={20} /></span>
            {c.premium && !ent.premium && <span class="pill"><Icon name="crown" size={12} />Premium</span>}
            <b>{c.title}</b>
            <small>{d ? `${d} sur ${c.lessons.length} terminées` : `${c.lessons.length} leçons`}</small>
            <Progress value={d / c.lessons.length} />
          </a>
        );
      })}</div>
    </section>
  );
}
const LVL_NAME: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé', expert: 'Expert' };
export function CoursePage({ id }: { id: string }) {
  const cs = useCourses(); const s = useStore((x) => x); const ent = usePremium(); const [q, setQ] = useState('');
  if (!cs) return <div class="page"><NavBar back="#/learn" backLabel="Apprendre" /><div class="loading" /></div>;
  const c = cs.find((x) => x.id === id);
  if (!c) return <div class="page"><NavBar back="#/learn" backLabel="Apprendre" /><h1>Cours introuvable</h1></div>;
  const list = c.lessons.filter((l) => !q || l.title.toLowerCase().includes(q.toLowerCase()));
  const done = c.lessons.filter((l) => s.lessons[l.id]?.done).length;
  const v = cvis(c.id);
  return (
    <div class="page learn course">
      <NavBar back="#/learn" backLabel="Apprendre" />
      <header class="course-head" style={{ '--c': v.color } as any}>
        <span class="level-icon"><Icon name={v.icon} size={26} /></span>
        <h1>{c.title}</h1>
        <p class="muted">{c.desc}</p>
        <div class="row"><span class="grow"><Progress value={done / c.lessons.length} color={v.color} /></span><small class="muted tnum">{done}/{c.lessons.length}</small></div>
      </header>
      {c.lessons.length > 12 && <input class="search" type="search" placeholder="Rechercher une leçon" aria-label="Rechercher une leçon" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />}
      <div class="list lesson-list">{list.map((l) => {
        const locked = (c.premium || l.level === 'expert') && !ent.premium; const st = s.lessons[l.id];
        return (
          <a class={'item ' + (st?.done ? 'is-done' : '')} href={locked ? '#/premium' : `#/lesson/${l.id}`}>
            <span class="it-icon" style={{ '--c': st?.done ? 'var(--green)' : levelColor(l.level) } as any}><Icon name={locked ? 'crown' : st?.done ? 'check' : v.icon} size={18} stroke={st?.done ? 3 : 2.2} /></span>
            <span class="it-main"><span class="it-title">{l.title}</span><span class="it-sub">{LVL_NAME[l.level]} · {l.minutes} min</span></span>
            {st?.done ? <Stars n={st.stars} size={12} /> : locked ? <span class="pill gold">Premium</span> : null}
            <Icon name="right" size={18} class="chev" stroke={2.4} />
          </a>
        );
      })}</div>
    </div>
  );
}
