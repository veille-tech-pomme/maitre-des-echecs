// Carte « Ton coach » de l'accueil : la priorité du jour, pourquoi, la preuve, et les prochaines activités.
import { useStore, today } from '../../lib/store';
import { Icon } from '../../components/Icon';
import { Progress } from '../../components/ui';
import { coachPlan, coachHeadline, weekProgress } from '../curriculum';
import { ACT_ICON, useCoachSync } from './common';

export function CoachCard() {
  const s = useStore((x) => x);
  const ready = useCoachSync(s);
  if (!ready || !s.coach) return <section class="coach-card skeleton" aria-busy="true" />;
  const m = s.coach; const plan = coachPlan(s, m, 4); const head = coachHeadline(s, m);
  const [first, ...rest] = plan; const wk = weekProgress(s, m);
  const gDone = wk ? wk.goals.filter((g) => g.done >= g.target).length : 0;
  const gFrac = wk ? wk.goals.reduce((a, g) => a + g.done / g.target, 0) / wk.goals.length : 0;
  const done = s.plan.date === today() ? s.plan.done : [];
  return (
    <section class="coach-card" aria-labelledby="cc-t">
      <div class="cc-head">
        <span class="cc-avatar" aria-hidden="true"><Icon name="brainCircuit" size={22} /></span>
        <div class="grow"><div class="cc-eyebrow">Ton coach</div><div class="cc-title" id="cc-t">{head.title}</div></div>
      </div>
      <p class="cc-text">{head.text}</p>
      {first && (
        <a class="cc-main" href={first.route}>
          <span class="it-icon"><Icon name={ACT_ICON[first.kind].icon} size={20} stroke={2.2} /></span>
          <span class="grow"><b>{first.title}</b><small>{first.why} · {first.minutes} min</small></span>
          <Icon name="right" size={20} stroke={2.4} class="cc-go" />
        </a>
      )}
      {rest.length > 0 && (
        <div class="list">
          {rest.map((a) => (
            <a class={'item ' + (done.includes(a.id) ? 'done' : '')} href={a.route}>
              <span class="it-icon" style={{ '--c': ACT_ICON[a.kind].color } as any}><Icon name={ACT_ICON[a.kind].icon} size={17} stroke={2.2} /></span>
              <span class="it-main"><span class="it-title">{a.title}</span><span class="it-sub">{a.evidence || a.why}</span></span>
              <Icon name="right" size={18} class="chev" stroke={2.4} />
            </a>
          ))}
        </div>
      )}
      <div class="cc-foot">
        {wk && <span class="cc-goal"><span>Semaine</span><Progress value={gFrac} label="Objectifs de la semaine" /><span class="tnum">{gDone}/{wk.goals.length}</span></span>}
        <a href="#/coach">Mes progrès<Icon name="right" size={16} stroke={2.4} /></a>
      </div>
    </section>
  );
}
