import { render } from 'preact';
import { useEffect } from 'preact/hooks';
import 'chessground/assets/chessground.base.css';
import './styles.css';
import { useRoute } from './lib/router';
import { useStore } from './lib/store';
import { applyAppearance } from './lib/theme';
import { initEntitlements } from './lib/entitlements';
import { setSoundEnabled } from './lib/sound';
import { engine } from './lib/engine';
import { startAppTracking } from './lib/events';
import { startStreakSync } from './lib/streak-sync';
import { startReminders } from './lib/reminders-run';
import { Toasts } from './components/ui';
import { Icon, type IconName } from './components/Icon';
import { Onboarding } from './pages/Onboarding';
const Feed = lazy(() => import('./pages/Feed'), 'Feed', () => <div class="page feed"><div class="feed-card skeleton" aria-busy="true"><div class="fc-board" /></div></div>);
import { Learn, CoursePage } from './pages/Learn';
const trainM = () => import('./pages/Training');
const TrainingHub = lazy(trainM, 'TrainingHub'), Coordinates = lazy(trainM, 'Coordinates'), NameSquare = lazy(trainM, 'NameSquare'), KnightVision = lazy(trainM, 'KnightVision'), MemoryTrainer = lazy(trainM, 'MemoryTrainer'), MateDrills = lazy(trainM, 'MateDrills'), GuessMove = lazy(trainM, 'GuessMove');
import { LessonPage } from './pages/Lesson';
const pzM = () => import('./pages/Puzzles');
const PuzzlesHub = lazy(pzM, 'PuzzlesHub'), PuzzleSession = lazy<any>(pzM, 'PuzzleSession'), Rush = lazy(pzM, 'Rush'), PuzzleCustom = lazy(pzM, 'PuzzleCustom'), Battle = lazy(pzM, 'Battle'), PuzzlePaths = lazy(pzM, 'PuzzlePaths'), PuzzlePath = lazy<any>(pzM, 'PuzzlePath');
const playM = () => import('./pages/Play');
const BotSelect = lazy(playM, 'BotSelect'), Game = lazy<{ botId: string }>(playM, 'Game');
const GameReviewPage = lazy(() => import('./pages/GameReview'), 'GameReviewPage');
const Analysis = lazy(() => import('./pages/Analysis'), 'Analysis');
const DevMetrics = lazy(() => import('./pages/DevMetrics'), 'DevMetrics'), DevEvents = lazy(() => import('./pages/DevMetrics'), 'DevEvents');
const openM = () => import('./pages/Openings');
const OpeningsHub = lazy(openM, 'OpeningsHub'), OpeningDetail = lazy(openM, 'OpeningDetail'), RepertoireTrainer = lazy(openM, 'RepertoireTrainer');
const endM = () => import('./pages/Endgames');
const EndgamesHub = lazy(endM, 'EndgamesHub'), EndgameDrill = lazy(endM, 'EndgameDrill');
import { Profile } from './pages/Profile';
const Settings = lazy(() => import('./pages/Settings'), 'Settings');
const Premium = lazy(() => import('./pages/Premium'), 'Premium');
const DailyPage = lazy(() => import('./pages/Daily'), 'DailyPage');
const streakM = () => import('./pages/Streak');
const StreakPage = lazy(streakM, 'StreakPage'), StreakMilestone = lazy(streakM, 'StreakMilestone');
const Privacy = lazy(() => import('./pages/Privacy'), 'Privacy');
const ReviewHub = lazy(() => import('./pages/Review'), 'ReviewHub');
const coachM = () => import('./pages/Coach');
const CoachPage = lazy(coachM, 'CoachPage'), DiagnosticPage = lazy(coachM, 'DiagnosticPage'), MistakesSession = lazy(coachM, 'MistakesSession');
import { isNative } from './lib/platform';
const MasteryCelebration = lazy(() => import('./components/MasteryCelebration'), 'default');
import { lazy } from './lib/lazy';

const NAV: { href: string; icon: IconName; label: string; match: (p: string[]) => boolean }[] = [
  { href: '#/', icon: 'sparkles', label: 'Pour toi', match: (p) => p.length === 0 },
  { href: '#/learn', icon: 'learn', label: 'Apprendre', match: (p) => ['learn', 'lesson', 'openings', 'endgames', 'train', 'repertoire', 'puzzles', 'review', 'jour'].includes(p[0]) },
  { href: '#/play', icon: 'play', label: 'Jouer', match: (p) => ['play', 'game', 'analysis'].includes(p[0]) },
  { href: '#/profile', icon: 'me', label: 'Moi', match: (p) => ['profile', 'settings', 'premium', 'privacy', 'more', 'coach', 'serie'].includes(p[0]) },
];
function App() {
  const { parts, query } = useRoute();
  const ent = useStore((s) => s.settings);
  const celebrate = useStore((s) => !!s.coach?.masteredLog?.some((x) => !x.seen));
  const streakCel = useStore((s) => !!s.streak.cel && s.onboarded);
  useEffect(() => { applyAppearance(); setSoundEnabled(ent.sound); }, [ent.theme, ent.board, ent.pieces, ent.sound, ent.reduceMotion]);
  const [a, b, c] = parts;
  let page;
  switch (a) {
    case undefined: page = <Feed />; break;
    case 'learn': page = b === 'course' ? <CoursePage id={c} /> : <Learn />; break;
    case 'lesson': page = <LessonPage key={b} id={b} />; break;
    case 'puzzles': page = b === 'rated' ? <PuzzleSession key="rated" mode="rated" /> : b === 'daily' ? <DailyPage /> : b === 'rush' ? <Rush /> : b === 'theme' ? <PuzzleSession key={c} mode="theme" theme={c} /> : b === 'review' ? <PuzzleSession key="review" mode="review" /> : b === 'custom' ? (c === 'go' ? <PuzzleSession key={"custom" + query?.toString()} mode="custom" query={query} /> : <PuzzleCustom />) : b === 'battle' ? <Battle /> : b === 'paths' ? (c ? <PuzzlePath id={c} /> : <PuzzlePaths />) : <PuzzlesHub />; break;
    case 'jour': page = <DailyPage arg={b} />; break;
    case 'serie': page = <StreakPage key={b} arg={b} />; break;
    case 'review': page = b === 'mistakes' ? <MistakesSession /> : <ReviewHub />; break;
    case 'coach': page = b === 'test' ? <DiagnosticPage /> : <CoachPage />; break;
    case 'play': page = b ? <Game key={b} botId={b} /> : <BotSelect />; break;
    case 'game': page = <GameReviewPage key={b} id={b} />; break;
    case 'analysis': page = <Analysis />; break;
    case 'openings': page = b ? <OpeningDetail id={b} line={c} /> : <OpeningsHub />; break;
    case 'repertoire': page = <RepertoireTrainer id={b} />; break;
    case 'train': page = b === 'coords' ? <Coordinates /> : b === 'name' ? <NameSquare /> : b === 'vision' ? <KnightVision /> : b === 'memory' ? <MemoryTrainer /> : b === 'mates' ? <MateDrills /> : b === 'guess' ? <GuessMove /> : <TrainingHub />; break;
    case 'endgames': page = b ? <EndgameDrill key={b} id={b} /> : <EndgamesHub />; break;
    case 'profile': page = <Profile />; break;
    case 'settings': page = <Settings />; break;
    case 'premium': page = <Premium />; break;
    case 'privacy': page = <Privacy />; break;
    case 'dev': page = b === 'events' ? <DevEvents /> : <DevMetrics />; break;
    case 'more': page = <Profile />; break;
    default: page = <Feed />;
  }
  const focus = a === 'lesson' || (a === 'jour' && b !== 'archives') || (a === 'serie' && b === 'mission') || (a === 'play' && !!b) || (a === 'puzzles' && !!b && b !== 'paths' && b !== 'custom') || (a === 'puzzles' && b === 'custom' && c === 'go') || a === 'game' || a === 'analysis'
    || (a === 'openings' && c != null) || a === 'repertoire' || (a === 'train' && !!b) || (a === 'endgames' && !!b) || a === 'premium' || (a === 'coach' && b === 'test') || (a === 'review' && b === 'mistakes');
  return (
    <div class={'app ' + (focus ? 'focus' : '')}>
      <nav class="sidebar" aria-label="Navigation principale">
        <a class="brand" href="#/"><img src="./icons/icon.svg" alt="" width="34" height="34" /><span>Maître<br />des Échecs</span></a>
        {NAV.map((n) => <a class={'nav-item ' + (n.match(parts) ? 'on' : '')} href={n.href} aria-current={n.match(parts) ? 'page' : undefined}><Icon name={n.icon} size={20} />{n.label}</a>)}
        <a class="nav-item premium-link" href="#/premium"><Icon name="crown" size={20} />Premium</a>
      </nav>
      <main id="main">{page}</main>
      <nav class="tabbar" aria-label="Navigation">
        {NAV.map((n) => <a class={n.match(parts) ? 'on' : ''} href={n.href} aria-current={n.match(parts) ? 'page' : undefined}><Icon name={n.icon} size={25} stroke={1.9} /><small>{n.label}</small></a>)}
      </nav>
      <Toasts />
      {a !== 'jour' && <Onboarding />}
      {celebrate && <MasteryCelebration />}
      {streakCel && !celebrate && <StreakMilestone />}
    </div>
  );
}
async function boot() {
  applyAppearance();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyAppearance);
  await initEntitlements().catch(() => {});
  applyAppearance();
  render(<App />, document.getElementById('app')!);
  startAppTracking(); // journal local (R4a) : rien ne quitte l'appareil
  startStreakSync(); // série souple (R4c) : jours manqués → vacances, gel ou pause
  startReminders(); // rappels opt-in (R4d) : notifications locales (app), pastille d'icône (web)
  setTimeout(() => engine.warmup(), 800);
  // FSRS (répétition espacée) : chargé après le premier affichage, hors du premier chargement
  setTimeout(() => import('./lib/srs').then((m) => m.loadFsrs()), 1500);
  if ('serviceWorker' in navigator && !(import.meta as any).env?.DEV && !isNative()) {
    import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {});
  }
}
boot();
