import { useStore, setState } from '../lib/store';
import { LESSONS, LEVELS } from '../data/lessons';
import { isUnlocked } from '../lib/plan';
import { usePremium } from '../lib/entitlements';
import { Progress } from '../components/ui';
import { toast } from '../components/ui';
import { useEffect, useState } from 'preact/hooks';
import { loadCourses } from '../data/lessons';
type Courses = Awaited<ReturnType<typeof loadCourses>>['COURSES'];
function useCourses() { const [c, setC] = useState<Courses | null>(null); useEffect(() => { loadCourses().then((m) => setC(m.COURSES)); }, []); return c; }

export function Learn() {
  const s = useStore((x) => x);
  const ent = usePremium();
  return (
    <div class="page learn">
      <h1>Parcours d’apprentissage</h1>
      <p class="muted">De la toute première règle jusqu’au niveau expert. Chaque leçon : une explication courte, une démonstration et des exercices sur l’échiquier.</p>
      <CourseGrid />
      <h2>Le parcours principal</h2>
      {LEVELS.map((lv) => {
        const ls = LESSONS.filter((l) => l.level === lv.id);
        const done = ls.filter((l) => s.lessons[l.id]?.done).length;
        const locked = lv.id === 'expert' && !ent.premium;
        const firstUnlocked = isUnlocked(s, ls[0].id);
        return (
          <section class="level" style={{ '--c': lv.color } as any}>
            <div class="level-head">
              <span class="level-icon">{lv.icon}</span>
              <div class="grow"><h2>{lv.name} {locked && <span class="pill gold">Premium</span>}</h2><p class="muted small">{lv.desc} · Elo {lv.elo}</p><Progress value={done / ls.length} color={lv.color} /></div>
              <b class="level-count">{done}/{ls.length}</b>
            </div>
            {!firstUnlocked && !locked && (
              <button class="btn small ghost" onClick={() => { setState((st) => { st.lessons['unlock-' + lv.id] = { done: false, stars: 0, step: 0 }; }); toast(`Niveau ${lv.name} débloqué`, '🔓'); }}>
                🔓 Je connais déjà le niveau précédent : débloquer
              </button>
            )}
            <ol class="path">
              {ls.map((l, i) => {
                const st = s.lessons[l.id]; const un = isUnlocked(s, l.id);
                const href = locked ? '#/premium' : un ? `#/lesson/${l.id}` : undefined;
                return (
                  <li class={'node ' + (st?.done ? 'done' : un ? 'open' : 'locked') + (i % 2 ? ' alt' : '')}>
                    <a href={href} aria-disabled={!href} onClick={(e) => { if (!href) { e.preventDefault(); toast('Termine la leçon précédente pour débloquer celle-ci', '🔒'); } }}>
                      <span class="node-icon">{locked ? '👑' : st?.done ? '✓' : un ? l.icon : '🔒'}</span>
                      <span class="node-text"><b>{l.title}</b><small class="muted">{l.summary}</small><small class="muted">⏱ {l.minutes} min {st?.done && '· ' + '★'.repeat(st.stars) + '☆'.repeat(3 - st.stars)}</small></span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function CourseGrid() {
  const cs = useCourses(); const s = useStore((x) => x); const ent = usePremium();
  if (!cs) return <div class="loading">Chargement des cours…</div>;
  const total = cs.reduce((a, c) => a + c.lessons.length, 0);
  return (
    <section>
      <h2>Cours thématiques <small class="muted">{total} leçons</small></h2>
      <div class="opening-grid">{cs.map((c) => { const done = c.lessons.filter((l) => s.lessons[l.id]?.done).length; return (
        <a class="opening-card" href={`#/learn/course/${c.id}`}><span class="side-dot">{c.icon}</span><b>{c.title} {c.premium && !ent.premium && <span class="pill gold">Premium</span>}</b><small class="muted">{c.desc}</small><Progress value={done / c.lessons.length} /><small class="muted">{done}/{c.lessons.length} leçons</small></a>); })}</div>
    </section>
  );
}
const LVL_NAME: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé', expert: 'Expert' };
export function CoursePage({ id }: { id: string }) {
  const cs = useCourses(); const s = useStore((x) => x); const ent = usePremium(); const [q, setQ] = useState('');
  if (!cs) return <div class="page"><div class="loading">Chargement…</div></div>;
  const c = cs.find((x) => x.id === id); if (!c) return <div class="page"><h1>Cours introuvable</h1><a href="#/learn">Retour</a></div>;
  const list = c.lessons.filter((l) => !q || l.title.toLowerCase().includes(q.toLowerCase()));
  const done = c.lessons.filter((l) => s.lessons[l.id]?.done).length;
  return (
    <div class="page learn">
      <a class="back" href="#/learn">‹ Apprendre</a>
      <h1>{c.icon} {c.title}</h1>
      <p class="muted">{c.desc}</p>
      <Progress value={done / c.lessons.length} /> <small class="muted">{done}/{c.lessons.length} terminées</small>
      {c.lessons.length > 12 && <input class="search" type="search" placeholder="Rechercher une leçon…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />}
      <div class="opening-grid">{list.map((l) => { const locked = (c.premium || l.level === 'expert') && !ent.premium; const st = s.lessons[l.id]; return (
        <a class={'opening-card ' + (st?.done ? 'done' : '')} href={locked ? '#/premium' : `#/lesson/${l.id}`}><span class="side-dot">{locked ? '👑' : l.icon}</span><b>{l.title}</b><small class="muted">{LVL_NAME[l.level]} · ⏱ {l.minutes} min{st?.done ? ' · ' + '★'.repeat(st.stars) : ''}</small><small class="muted">{l.summary}</small></a>); })}</div>
    </div>
  );
}
