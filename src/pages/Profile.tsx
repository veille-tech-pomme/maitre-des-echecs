import { streakVisible, titleFor } from '../lib/streak';
import { useStore, levelFromXp, streakAlive } from '../lib/store';
import { BADGES } from '../lib/badges';
import { useState } from 'preact/hooks';
import { LineChart, Progress, PremiumLock, Ring, Item } from '../components/ui';
import { Icon } from '../components/Icon';
import { levelColor, badgeVis } from '../lib/visual';
import { isIOS, isStandalone, isNative } from '../lib/platform';
import { weaknesses } from '../lib/plan';
import { themeName } from '../data/themes';
import { botById } from '../data/bots';
import { LESSONS, LEVELS } from '../data/lessons';
import { usePremium } from '../lib/entitlements';
import { CLASS_INFO, CLASS_ORDER } from '../lib/review';
import { lazy } from '../lib/lazy';
const CoachCard = lazy(() => import('../coach/ui/CoachCard'), 'CoachCard', () => <section class="coach-card skeleton" aria-busy="true" />);

export function Profile() {
  const s = useStore((x) => x); const ent = usePremium();
  const lvl = levelFromXp(s.xp);
  const weak = weaknesses(s);
  const themes = Object.entries(s.themes).filter(([t, v]) => v.ok + v.ko >= 2 && !['middlegame', 'endgame'].includes(t)).sort((a, b) => (b[1].ok + b[1].ko) - (a[1].ok + a[1].ko));
  const rev = s.games.filter((g) => g.reviewed);
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
  const phase = (k: 'opening' | 'middlegame' | 'endgame') => avg(rev.map((g) => g.phaseAcc?.[k]).filter((x): x is number => x != null));
  const cls: Record<string, number> = {}; for (const g of rev) for (const [k, v] of Object.entries(g.counts || {})) cls[k] = (cls[k] || 0) + v;
  const totalCls = Object.values(cls).reduce((a, b) => a + b, 0) || 1;
  const days = [...Array(28)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 27 + i); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return { k, v: s.activity[k] || 0 }; });
  const [allGames, setAllGames] = useState(false); const [allBadges, setAllBadges] = useState(false);
  const got = BADGES.filter((b) => s.badges[b.id]).length;
  const badges = allBadges ? BADGES : [...BADGES].sort((a, b) => (s.badges[b.id] ? 1 : 0) - (s.badges[a.id] ? 1 : 0)).slice(0, 6);
  const games = s.games.slice().reverse().slice(0, allGames ? 30 : 4);
  const name = s.settings.name || 'Joueur';
  return (
    <div class="page profile">
      <header class="me-head">
        <span class="avatar-lg">{name.slice(0, 1).toUpperCase()}</span>
        <div class="grow"><h1>{name}</h1><p>Niveau {lvl.level} · {s.xp} XP{ent.premium ? ' · Premium' : ''}</p><Progress value={lvl.into / lvl.need} /></div>
        <a class="nb-btn round" href="#/settings" aria-label="Réglages"><Icon name="settings" size={20} /></a>
      </header>
      <div class="stat-strip four">
        <a class="stat-tile" href="#/serie" style="--c:#FF9F0A"><span class="st-top"><Icon name="flame" size={13} />Série</span>{streakVisible(s) ? <><b>{streakAlive(s) ? s.streak.count : 0}</b><small>record {s.streak.best}{titleFor(s.streak.best) ? ` · ${titleFor(s.streak.best)}` : ''}</small></> : <><b>—</b><small>masquée</small></>}</a>
        <div class="stat-tile" style="--c:#F2B544"><span class="st-top"><Icon name="star" size={13} />Niveau</span><b>{lvl.level}</b><small>{lvl.into}/{lvl.need} XP</small></div>
        <div class="stat-tile" style="--c:#0A84FF"><span class="st-top"><Icon name="puzzle" size={13} />Puzzles</span><b>{s.puzzle.rating}</b><small>{s.puzzle.solved} réussis</small></div>
        <div class="stat-tile" style="--c:#30A46C"><span class="st-top"><Icon name="play" size={13} />Parties</span><b>{s.games.length}</b><small>{rev.length} analysées</small></div>
      </div>
      <div class="section-title"><h2>Mes progrès</h2><a href="#/coach">Tout voir</a></div>
      <CoachCard />
      <div class="list">
        <Item href="#/coach" icon="gauge" color="#FF9F0A" title="Mes progrès" sub="Radar des compétences, forces, faiblesses et objectifs de la semaine" />
      </div>
      {!ent.premium && <a class="card promo" href="#/premium"><span class="lock-icon"><Icon name="crown" size={22} /></span><div class="grow"><b>Essayer Premium</b><p class="muted">7 jours gratuits, puis 29,99 €/an.</p></div><Icon name="right" size={18} class="chev" stroke={2.4} /></a>}
      <div class="list">
        <Item href="#/settings" icon="settings" color="#8E8E93" title="Réglages" sub="Apparence, échiquier, sons, données" />
        {ent.premium && <Item href="#/premium" icon="crown" color="#F2B544" title="Premium" value="Actif" />}
        <Item href="#/privacy" icon="shield" color="#30A46C" title="Confidentialité" sub="Aucun compte, aucune pub, aucun traceur" />
      </div>
      <InstallHelp />

      <div class="section-title"><h2>Activité</h2><span class="muted">28 jours</span></div>
      <section class="card"><div class="heat" role="img" aria-label="Activité des 28 derniers jours">{days.map((d) => <span title={`${d.k} : ${d.v} XP`} class={'h' + (d.v === 0 ? 0 : d.v < 30 ? 1 : d.v < 80 ? 2 : 3)} />)}</div></section>
      {s.puzzle.history.length > 1 && <section class="card"><div class="card-head"><b>Classement puzzles</b><span class="muted tnum">{s.puzzle.rating}</span></div><LineChart points={s.puzzle.history.map((h) => h.r)} height={110} color="var(--gold)" /></section>}
      <section class="card"><div class="card-head"><b>Parcours</b></div>{LEVELS.map((lv) => { const ls = LESSONS.filter((l) => l.level === lv.id); const d = ls.filter((l) => s.lessons[l.id]?.done).length; return <div class="lvl-row"><span>{lv.name}</span><Progress value={d / ls.length} color={levelColor(lv.id)} /><small>{d}/{ls.length}</small></div>; })}</section>
      {weak.length > 0 && <><div class="section-title"><h2>À travailler</h2></div><div class="list">{weak.map((w) => <Item href={w.route} icon="target" color="#FF453A" title={w.label} sub={w.evidence + (w.lesson ? ' · leçon conseillée' : '')} />)}</div></>}

      <div class="section-title"><h2>Badges</h2><button onClick={() => setAllBadges(!allBadges)} aria-expanded={allBadges}>{allBadges ? 'Moins' : `Tout voir (${got}/${BADGES.length})`}</button></div>
      <div class="badge-grid">{badges.map((b) => { const v = badgeVis(b.id); return <div class={'badge ' + (s.badges[b.id] ? 'got' : '')} title={b.desc} style={{ '--c': v.color } as any}><span class="bd-icon"><Icon name={v.icon} size={22} /></span><b>{b.name}</b><small>{b.desc}</small></div>; })}</div>

      <div class="section-title"><h2>Mes parties</h2>{s.games.length > 4 && <button onClick={() => setAllGames(!allGames)} aria-expanded={allGames}>{allGames ? 'Moins' : 'Tout voir'}</button>}</div>
      {s.games.length === 0 ? <div class="card empty-inline"><p class="muted">Aucune partie pour l’instant.</p><a class="btn tinted small" href="#/play">Jouer contre un bot</a></div> :
        <div class="list games">{games.map((g) => { const b = botById(g.botId); const won = (g.result === '1-0' && g.color === 'w') || (g.result === '0-1' && g.color === 'b'); const draw = g.result === '1/2-1/2';
          return <a class="item" href={`#/game/${g.id}`}><span class={'res ' + (won ? 'w' : draw ? 'd' : 'l')}>{won ? 'V' : draw ? 'N' : 'D'}</span><span class="it-main"><span class="it-title">{b.name} <span class="muted">· {b.elo}</span></span><span class="it-sub">{new Date(g.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {Math.ceil(g.moves.length / 2)} coups</span></span>{g.reviewed ? <span class="pill tnum">{String(g.accuracy).replace('.', ',')} %</span> : <span class="pill">Bilan</span>}<Icon name="right" size={18} class="chev" stroke={2.4} /></a>; })}</div>}

      <div class="section-title"><h2>Statistiques avancées</h2>{!ent.premium && <span class="pill gold"><Icon name="crown" size={12} />Premium</span>}</div>
      <section class="card">
        {ent.premium ? (
          rev.length === 0 ? <p class="muted">Fais le bilan d’une partie pour débloquer ces statistiques.</p> : <>
            <div class="grid3">{(['opening', 'middlegame', 'endgame'] as const).map((k) => <div class="center"><Ring value={(phase(k) || 0) / 100} size={60} label={<b>{phase(k) ?? '–'}</b>} /><small class="muted">{k === 'opening' ? 'Ouverture' : k === 'middlegame' ? 'Milieu de jeu' : 'Finale'}</small></div>)}</div>
            <h4>Précision par partie</h4><LineChart points={rev.map((g) => g.accuracy || 0)} height={90} />
            <h4>Répartition de tes coups</h4>
            <div class="cls-bars">{CLASS_ORDER.filter((c) => cls[c]).map((c) => <div class="cls-bar"><span>{CLASS_INFO[c].symbol} {CLASS_INFO[c].label}</span><Progress value={cls[c] / totalCls} color={CLASS_INFO[c].color} /><small>{Math.round((cls[c] / totalCls) * 100)} %</small></div>)}</div>
            <h4>Thèmes de puzzles</h4>
            <table class="theme-table"><tbody>{themes.map(([t, v]) => <tr><td>{themeName(t)}</td><td>{v.ok + v.ko}</td><td><Progress value={v.ok / (v.ok + v.ko)} /></td><td>{Math.round((v.ok / (v.ok + v.ko)) * 100)} %</td></tr>)}</tbody></table>
          </>
        ) : <PremiumLock title="Statistiques avancées" text="Précision par phase de jeu, répartition de tes coups et réussite par thème tactique." />}
      </section>
    </div>
  );
}
function InstallHelp() {
  if (isStandalone() || isNative()) return null;
  return (
    <details class="card install">
      <summary><span class="it-icon" style="--c:#0A84FF"><Icon name="smartphone" size={18} /></span><b class="grow">Installer l’application</b><Icon name="down" size={18} class="chev" /></summary>
      {isIOS() ? <p>Dans Safari, touche <b>Partager</b> puis <b>Sur l’écran d’accueil</b>. L’app fonctionne ensuite hors ligne, en plein écran.</p>
        : <p>Dans Edge ou Chrome, clique sur <b>Installer</b> dans la barre d’adresse, ou menu → <b>Applications → Installer</b>.</p>}
    </details>
  );
}
