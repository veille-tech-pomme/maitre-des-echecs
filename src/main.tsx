import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import 'chessground/assets/chessground.base.css';
import './styles.css';
import { useRoute } from './lib/router';
import { useStore, setState, getState } from './lib/store';
import { applyAppearance } from './lib/theme';
import { initEntitlements } from './lib/entitlements';
import { setSoundEnabled, unlockAudio } from './lib/sound';
import { engine } from './lib/engine';
import { Toasts, Modal } from './components/ui';
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
import { isIOS, isStandalone, isNative } from './lib/platform';

const NAV = [
  { href: '#/', icon: '🏠', label: 'Accueil', match: (p: string[]) => p.length === 0 },
  { href: '#/learn', icon: '🎓', label: 'Apprendre', match: (p: string[]) => ['learn', 'lesson'].includes(p[0]) },
  { href: '#/puzzles', icon: '🧩', label: 'Puzzles', match: (p: string[]) => ['puzzles', 'review'].includes(p[0]) },
  { href: '#/play', icon: '♟️', label: 'Jouer', match: (p: string[]) => ['play', 'game'].includes(p[0]) },
  { href: '#/more', icon: '☰', label: 'Plus', match: (p: string[]) => ['more', 'analysis', 'openings', 'endgames', 'train', 'profile', 'settings', 'premium', 'privacy', 'repertoire'].includes(p[0]) },
];
const SIDE_EXTRA = [
  { href: '#/train', icon: '🏋️', label: 'Entraînement' }, { href: '#/openings', icon: '📖', label: 'Ouvertures' }, { href: '#/endgames', icon: '♔', label: 'Finales' }, { href: '#/analysis', icon: '🔬', label: 'Analyse' },
  { href: '#/review', icon: '🔁', label: 'Révisions' }, { href: '#/profile', icon: '🏅', label: 'Progression' }, { href: '#/settings', icon: '⚙️', label: 'Réglages' },
];
function More() {
  return (
    <div class="page">
      <h1>Plus</h1>
      <div class="more-grid">
        {[...SIDE_EXTRA, { href: '#/premium', icon: '👑', label: 'Premium' }, { href: '#/privacy', icon: '🔒', label: 'Confidentialité' }].map((x) => <a class="more-item" href={x.href}><span>{x.icon}</span>{x.label}</a>)}
      </div>
      <InstallHelp />
    </div>
  );
}
function InstallHelp() {
  if (isStandalone() || isNative()) return null;
  return (
    <div class="card install">
      <h3>📲 Installer l’application</h3>
      {isIOS() ? <p>Sur iPhone : touche <b>Partager</b> <span aria-hidden="true">⎋</span> dans Safari, puis <b>« Sur l’écran d’accueil »</b>. L’app fonctionne ensuite hors ligne, en plein écran.</p>
        : <p>Sur Windows (Edge ou Chrome) : clique sur l’icône <b>Installer</b> ⊕ dans la barre d’adresse, ou menu ⋯ → <b>Applications → Installer</b>.</p>}
    </div>
  );
}
function Onboarding() {
  const done = useStore((s) => s.onboarded);
  const [name, setName] = useState('');
  if (done) return null;
  const finish = (lvl: string | null) => {
    setState((s) => {
      s.onboarded = true; s.settings.name = name.trim();
      const order = ['debutant', 'intermediaire', 'avance'];
      if (lvl) { for (const k of order.slice(1, order.indexOf(lvl) + 1)) s.lessons['unlock-' + k] = { done: false, stars: 0, step: 0 }; s.puzzle.rating = lvl === 'intermediaire' ? 1100 : lvl === 'avance' ? 1500 : 800; }
    });
    unlockAudio();
    location.hash = lvl && lvl !== 'debutant' ? '#/learn' : '#/lesson/d-echiquier';
  };
  return (
    <Modal open onClose={() => finish(null)} title="Bienvenue dans Maître des Échecs ♞">
      <p>De ta toute première règle jusqu’au niveau expert : leçons interactives, puzzles, bots et un coach qui t’explique <b>pourquoi</b>.</p>
      <label>Comment t’appelles-tu ? <input value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder="Ton prénom (facultatif)" maxLength={24} /></label>
      <p><b>Quel est ton niveau ?</b></p>
      <div class="col">
        <button class="btn primary" onClick={() => finish('debutant')}>🌱 Je débute (ou presque)</button>
        <button class="btn ghost" onClick={() => finish('intermediaire')}>⚔️ Je connais les règles</button>
        <button class="btn ghost" onClick={() => finish('avance')}>🏰 Je joue en club / plus de 1400</button>
      </div>
    </Modal>
  );
}
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
    case 'more': page = <More />; break;
    default: page = <Home />;
  }
  const focus = a === 'lesson' || (a === 'play' && b) || (a === 'puzzles' && b) || a === 'game';
  return (
    <div class={'app ' + (focus ? 'focus' : '')}>
      <nav class="sidebar" aria-label="Navigation principale">
        <a class="brand" href="#/"><img src="./icons/icon.svg" alt="" width="34" height="34" /><span>Maître<br />des Échecs</span></a>
        {NAV.slice(0, 4).map((n) => <a class={'nav-item ' + (n.match(parts) ? 'on' : '')} href={n.href}><span>{n.icon}</span>{n.label}</a>)}
        <hr />
        {SIDE_EXTRA.map((n) => <a class={'nav-item ' + (location.hash.startsWith(n.href) ? 'on' : '')} href={n.href}><span>{n.icon}</span>{n.label}</a>)}
        <a class="nav-item premium-link" href="#/premium"><span>👑</span>Premium</a>
      </nav>
      <main id="main">{page}</main>
      <nav class="tabbar" aria-label="Navigation">
        {NAV.map((n) => <a class={n.match(parts) ? 'on' : ''} href={n.href} aria-label={n.label}><span>{n.icon}</span><small>{n.label}</small></a>)}
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
