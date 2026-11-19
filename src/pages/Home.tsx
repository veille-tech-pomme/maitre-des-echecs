import { useState } from 'preact/hooks';
import { useStore, levelFromXp, streakAlive, today } from '../lib/store';
import { nextLesson } from '../lib/plan';
import { lazy } from '../lib/lazy';
import { LESSONS, LEVELS } from '../data/lessons';
import { Progress, LargeTitle } from '../components/ui';
import { Icon } from '../components/Icon';
import { usePremium } from '../lib/entitlements';
import { trialBanner, dismissTrialBanner } from '../lib/notify';
import { isDue } from '../lib/srs';
import { LEVEL_VIS } from '../lib/visual';

const CoachCard = lazy(() => import('../coach/ui/CoachCard'), 'CoachCard', () => <section class="coach-card skeleton" aria-busy="true" />);

export function Home() {
  const s = useStore((x) => x);
  const ent = usePremium();
  const [, f] = useState(0);
  const lvl = levelFromXp(s.xp);
  const nl = nextLesson(s);
  const doneCount = LESSONS.filter((l) => s.lessons[l.id]?.done).length;
  const due = Object.values(s.srs).filter((x) => isDue(x)).length;
  const tb = trialBanner();
  const hour = new Date().getHours();
  const hello = hour < 6 ? 'Bonne nuit' : hour < 18 ? 'Bonjour' : 'Bonsoir';
  const streak = streakAlive(s) ? s.streak.count : 0;
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const nlLevel = nl && LEVELS.find((l) => l.id === nl.level)!;
  const levelLessons = nl ? LESSONS.filter((l) => l.level === nl.level) : [];
  const levelDone = levelLessons.filter((l) => s.lessons[l.id]?.done).length;
  return (
    <div class="page home">
      <div class="home-grid">
      <LargeTitle eyebrow={date} title={`${hello}${s.settings.name ? ', ' + s.settings.name : ''}`}
        right={<a class="streak-btn" href="#/profile" aria-label={`Série : ${streak} jour${streak > 1 ? 's' : ''}`}><Icon name="flame" size={20} class={streak ? 'lit' : ''} /><b class="tnum">{streak}</b></a>} />
      {tb && (
        <div class="banner">
          <Icon name="clock" size={20} />
          <span>Ton essai se termine le <b>{new Date(tb.endsAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</b>. Ensuite 29,99 €/an, annulable à tout moment.</span>
          <div class="row"><a class="btn small tinted" href="#/premium">Gérer</a><button class="btn small plain" onClick={() => { dismissTrialBanner(); f((x) => x + 1); }}>OK</button></div>
        </div>
      )}

      {nl && nlLevel ? (
        <a class="hero-card" href={`#/lesson/${nl.id}`}>
          <span class="hc-art" aria-hidden="true"><Icon name={LEVEL_VIS[nl.level]?.icon || 'king'} size={128} stroke={1.2} /></span>
          <span class="hc-eyebrow">{doneCount ? 'Continuer' : 'Ta première leçon'} · {nlLevel.name}</span>
          <h2>{nl.title}</h2>
          <p>{nl.summary}</p>
          <span class="btn primary"><Icon name="playIcon" size={18} />{doneCount ? 'Continuer' : 'Commencer'}</span>
          <span class="hc-meta"><Icon name="clock" size={15} />{nl.minutes} min<span aria-hidden="true">·</span><span class="grow"><Progress value={levelDone / Math.max(1, levelLessons.length)} /></span>{levelDone}/{levelLessons.length}</span>
        </a>
      ) : (
        <a class="hero-card" href="#/play">
          <span class="hc-eyebrow">Parcours terminé</span><h2>Bravo, tu as tout appris.</h2><p>Mets ton savoir à l’épreuve face à un bot.</p>
          <span class="btn primary"><Icon name="play" size={18} />Jouer</span>
        </a>
      )}

      <CoachCard />

      <div class="stat-strip">
        <a class="stat-tile" href="#/profile" style={{ '--c': '#FF9F0A' } as any}><span class="st-top"><Icon name="flame" size={13} />Série</span><b>{streak}</b><small>{streak > 1 ? 'jours' : streak ? 'jour' : 'à lancer'}</small></a>
        <a class="stat-tile" href="#/profile" style={{ '--c': '#F2B544' } as any}><span class="st-top"><Icon name="star" size={13} />Niveau</span><b>{lvl.level}</b><small>{lvl.into}/{lvl.need} XP</small></a>
        <a class="stat-tile" href="#/puzzles" style={{ '--c': '#0A84FF' } as any}><span class="st-top"><Icon name="puzzle" size={13} />Puzzles</span><b>{s.puzzle.rating}</b><small>{s.puzzle.solved} résolus</small></a>
      </div>

      <section class="hs-tiles">
      <div class="section-title"><h2>Raccourcis</h2></div>
      <div class="tiles">
        <a class="tile" href="#/puzzles/daily"><span class="tl-icon" style="--c:#0A84FF"><Icon name="calendar" size={20} /></span>{s.daily[today()] && <span class="tl-badge pill ok"><Icon name="check" size={12} stroke={3} />Fait</span>}<b>Puzzle du jour</b><small>Un défi par jour</small></a>
        <a class="tile" href="#/puzzles/rush"><span class="tl-icon" style="--c:#FF9F0A"><Icon name="timer" size={20} /></span><b>Contre la montre</b><small>3 minutes, 3 vies</small></a>
        <a class="tile" href="#/review"><span class="tl-icon" style="--c:#5E5CE6"><Icon name="repeat" size={20} /></span>{due > 0 && <span class="tl-badge badge-n">{due}</span>}<b>Révisions</b><small>{due ? `${due} à revoir` : 'Tout est à jour'}</small></a>
        <a class="tile" href="#/analysis"><span class="tl-icon" style="--c:#64D2FF"><Icon name="microscope" size={20} /></span><b>Analyse</b><small>Stockfish 18</small></a>
      </div>
      </section>

      {!ent.premium && (
        <a class="card promo hs-promo" href="#/premium">
          <span class="lock-icon"><Icon name="crown" size={22} /></span>
          <div class="grow"><b>Passe au niveau Expert</b><p class="muted">Grandes parties commentées, coach approfondi, répertoire. 7 jours offerts.</p></div>
          <Icon name="right" size={18} class="chev" stroke={2.4} />
        </a>
      )}
      </div>
    </div>
  );
}
