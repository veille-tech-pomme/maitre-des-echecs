import { useStore, setState } from '../lib/store';
import { LESSONS, LEVELS } from '../data/lessons';
import { isUnlocked } from '../lib/plan';
import { usePremium } from '../lib/entitlements';
import { Progress } from '../components/ui';
import { toast } from '../components/ui';

export function Learn() {
  const s = useStore((x) => x);
  const ent = usePremium();
  return (
    <div class="page learn">
      <h1>Parcours d’apprentissage</h1>
      <p class="muted">De la toute première règle jusqu’au niveau expert. Chaque leçon : une explication courte, une démonstration et des exercices sur l’échiquier.</p>
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
