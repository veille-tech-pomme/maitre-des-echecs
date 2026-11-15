import { useStore, levelFromXp, streakAlive, today } from '../lib/store';
import { dailyPlan, nextLesson, weaknesses } from '../lib/plan';
import { LESSONS, LEVELS } from '../data/lessons';
import { Progress, Ring, LineChart } from '../components/ui';
import { usePremium } from '../lib/entitlements';
import { trialBanner, dismissTrialBanner } from '../lib/notify';
import { useState } from 'preact/hooks';
import { isDue } from '../lib/srs';

export function Home() {
  const s = useStore((x) => x);
  const ent = usePremium();
  const [, f] = useState(0);
  const lvl = levelFromXp(s.xp);
  const plan = dailyPlan(s);
  const nl = nextLesson(s);
  const doneCount = LESSONS.filter((l) => s.lessons[l.id]?.done).length;
  const weak = weaknesses(s).slice(0, 3);
  const due = Object.values(s.srs).filter((x) => isDue(x)).length;
  const tb = trialBanner();
  const hour = new Date().getHours();
  const hello = hour < 6 ? 'Bonne nuit' : hour < 18 ? 'Bonjour' : 'Bonsoir';
  const planDone = plan.filter((p) => p.done).length;
  return (
    <div class="page home">
      {tb && (
        <div class="banner warn">
          <span>⏰ Ton essai gratuit se termine le <b>{new Date(tb.endsAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</b>. Ensuite : 29,99 €/an. Tu peux annuler à tout moment.</span>
          <div class="row"><a class="btn small" href="#/premium">Gérer</a><button class="btn small ghost" onClick={() => { dismissTrialBanner(); f((x) => x + 1); }}>OK</button></div>
        </div>
      )}
      <header class="hero">
        <div>
          <p class="muted">{hello}{s.settings.name ? `, ${s.settings.name}` : ''} 👋</p>
          <h1>Prêt·e à progresser ?</h1>
        </div>
        <div class="hero-stats">
          <div class={'chip streak ' + (streakAlive(s) && s.streak.count ? 'on' : '')} title="Série de jours"><span>🔥</span><b>{streakAlive(s) ? s.streak.count : 0}</b></div>
          <div class="chip" title="Niveau"><span>⭐</span><b>Niv. {lvl.level}</b></div>
          {ent.premium && <div class="chip gold"><span>👑</span><b>Premium</b></div>}
        </div>
      </header>
      <div class="xpbar"><Progress value={lvl.into / lvl.need} /><span class="muted small">{lvl.into} / {lvl.need} XP</span></div>

      <section class="card plan-card">
        <div class="card-head"><h2>🎯 Ton plan du jour</h2><Ring value={plan.length ? planDone / plan.length : 0} size={44} label={<small>{planDone}/{plan.length}</small>} /></div>
        <ul class="plan-list">
          {plan.map((p) => (
            <li class={p.done ? 'done' : ''}><a href={p.route}><span class="plan-icon">{p.done ? '✅' : p.icon}</span><span><b>{p.title}</b><small>{p.why}</small></span><span class="chev">›</span></a></li>
          ))}
        </ul>
      </section>

      <div class="grid2">
        {nl && (
          <a class="card continue" href={`#/lesson/${nl.id}`} style={{ '--c': LEVELS.find((l) => l.id === nl.level)!.color } as any}>
            <small class="muted">Continuer le parcours · {LEVELS.find((l) => l.id === nl.level)!.name}</small>
            <div class="continue-row"><span class="big-icon">{nl.icon}</span><div><h3>{nl.title}</h3><p class="muted">{nl.summary}</p></div></div>
            <Progress value={doneCount / LESSONS.length} /><small class="muted">{doneCount}/{LESSONS.length} leçons terminées</small>
          </a>
        )}
        <a class="card stat-card" href="#/puzzles">
          <small class="muted">Classement puzzles</small>
          <div class="stat-big">{s.puzzle.rating}</div>
          <LineChart points={s.puzzle.history.slice(-30).map((h) => h.r)} height={70} />
          <small class="muted">{s.puzzle.solved} résolus · série record {s.puzzle.bestStreak}</small>
        </a>
      </div>

      <section class="quick">
        <a class="qa" href="#/puzzles/daily"><span>📅</span>Puzzle du jour{s.daily[today()] && <em>✓</em>}</a>
        <a class="qa" href="#/puzzles/rush"><span>⏱️</span>Contre la montre</a>
        <a class="qa" href="#/play"><span>🤖</span>Jouer un bot</a>
        <a class="qa" href="#/review"><span>🔁</span>Révisions{due > 0 && <em class="badge-n">{due}</em>}</a>
        <a class="qa" href="#/openings"><span>📖</span>Ouvertures</a>
        <a class="qa" href="#/endgames"><span>♔</span>Finales</a>
        <a class="qa" href="#/analysis"><span>🔬</span>Analyse</a>
        <a class="qa" href="#/profile"><span>🏅</span>Badges</a>
      </section>

      {weak.length > 0 && (
        <section class="card">
          <div class="card-head"><h2>🩺 Tes points à travailler</h2><a class="small" href="#/profile">Détails</a></div>
          <ul class="weak-list">
            {weak.map((w) => <li><a href={w.route}><b>{w.label}</b><small class="muted">{w.evidence}</small><span class="chev">›</span></a></li>)}
          </ul>
        </section>
      )}
      {!ent.premium && (
        <a class="card promo" href="#/premium">
          <span class="big-icon">👑</span>
          <div><b>Ta progression est gratuite, pour toujours.</b><p class="muted small">Premium ajoute le niveau Expert, les parties légendaires commentées, le coach approfondi et ton répertoire personnel. 7 jours gratuits.</p></div>
          <span class="chev">›</span>
        </a>
      )}
    </div>
  );
}
