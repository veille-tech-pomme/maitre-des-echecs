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
import { Toasts } from './components/ui';
import { Icon, type IconName } from './components/Icon';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { Learn, CoursePage } from './pages/Learn';
import { TrainingHub, Coordinates, NameSquare, KnightVision, MemoryTrainer, MateDrills, GuessMove } from './pages/Training';
import { LessonPage } from './pages/Lesson';
import { PuzzlesHub, PuzzleSession, Rush, PuzzleCustom, Battle, PuzzlePaths, PuzzlePath } from './pages/Puzzles';
import { BotSelect, Game } from './pages/Play';
import { GameReviewPage } from './pages/GameReview';
import { Analysis } from './pages/Analysis';
import { OpeningsHub, OpeningDetail, RepertoireTrainer } from './pages/Openings';
import { EndgamesHub, EndgameDrill } from './pages/Endgames';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { Premium } from './pages/Premium';
import { Privacy } from './pages/Privacy';
import { ReviewHub } from './pages/Review';
import { isNative } from './lib/platform';

const NAV: { href: string; icon: IconName; label: string; match: (p: string[]) => boolean }[] = [
  { href: '#/', icon: 'today', label: 'Aujourd’hui', match: (p) => p.length === 0 },
  { href: '#/learn', icon: 'learn', label: 'Apprendre', match: (p) => ['learn', 'lesson', 'openings', 'endgames', 'train', 'repertoire'].includes(p[0]) },
  { href: '#/puzzles', icon: 'puzzle', label: 'Puzzles', match: (p) => ['puzzles', 'review'].includes(p[0]) },
  { href: '#/play', icon: 'play', label: 'Jouer', match: (p) => ['play', 'game', 'analysis'].includes(p[0]) },
  { href: '#/profile', icon: 'me', label: 'Moi', match: (p) => ['profile', 'settings', 'premium', 'privacy', 'more'].includes(p[0]) },
];
function App() {
  const { parts, query } = useRoute();
  const ent = useStore((s) => s.settings);
  useEffect(() => { applyAppearance(); setSoundEnabled(ent.sound); }, [ent.theme, ent.board, ent.pieces, ent.sound, ent.reduceMotion]);
  const [a, b, c] = parts;
  let page;
  switch (a) {
    case undefined: page = <Home />; break;
    case 'learn': page = b === 'course' ? <CoursePage id={c} /> : <Learn />; break;
    case 'lesson': page = <LessonPage id={b} />; break;
    case 'puzzles': page = b === 'rated' ? <PuzzleSession mode="rated" /> : b === 'daily' ? <PuzzleSession mode="daily" /> : b === 'rush' ? <Rush /> : b === 'theme' ? <PuzzleSession mode="theme" theme={c} /> : b === 'review' ? <PuzzleSession mode="review" /> : b === 'custom' ? (c === 'go' ? <PuzzleSession mode="custom" query={query} /> : <PuzzleCustom />) : b === 'battle' ? <Battle /> : b === 'paths' ? (c ? <PuzzlePath id={c} /> : <PuzzlePaths />) : <PuzzlesHub />; break;
    case 'review': page = <ReviewHub />; break;
    case 'play': page = b ? <Game key={b} botId={b} /> : <BotSelect />; break;
    case 'game': page = <GameReviewPage id={b} />; break;
    case 'analysis': page = <Analysis />; break;
    case 'openings': page = b ? <OpeningDetail id={b} line={c} /> : <OpeningsHub />; break;
    case 'repertoire': page = <RepertoireTrainer id={b} />; break;
    case 'train': page = b === 'coords' ? <Coordinates /> : b === 'name' ? <NameSquare /> : b === 'vision' ? <KnightVision /> : b === 'memory' ? <MemoryTrainer /> : b === 'mates' ? <MateDrills /> : b === 'guess' ? <GuessMove /> : <TrainingHub />; break;
    case 'endgames': page = b ? <EndgameDrill id={b} /> : <EndgamesHub />; break;
    case 'profile': page = <Profile />; break;
    case 'settings': page = <Settings />; break;
    case 'premium': page = <Premium />; break;
    case 'privacy': page = <Privacy />; break;
    case 'more': page = <Profile />; break;
    default: page = <Home />;
  }
  const focus = a === 'lesson' || (a === 'play' && !!b) || (a === 'puzzles' && !!b && b !== 'paths' && b !== 'custom') || (a === 'puzzles' && b === 'custom' && c === 'go') || a === 'game' || a === 'analysis'
    || (a === 'openings' && c != null) || a === 'repertoire' || (a === 'train' && !!b) || (a === 'endgames' && !!b) || a === 'premium';
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
      <Onboarding />
    </div>
  );
}
async function boot() {
  applyAppearance();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyAppearance);
  await initEntitlements().catch(() => {});
  applyAppearance();
  render(<App />, document.getElementById('app')!);
  setTimeout(() => engine.warmup(), 800);
  if ('serviceWorker' in navigator && !(import.meta as any).env?.DEV && !isNative()) {
    import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {});
  }
}
boot();
