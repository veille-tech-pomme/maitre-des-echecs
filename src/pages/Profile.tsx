import { useStore, levelFromXp } from '../lib/store';
import { BADGES } from '../lib/badges';
import { LineChart, Progress, PremiumLock, Ring } from '../components/ui';
import { weaknesses } from '../lib/plan';
import { themeName } from '../data/themes';
import { botById } from '../data/bots';
import { LESSONS, LEVELS } from '../data/lessons';
import { usePremium } from '../lib/entitlements';
import { CLASS_INFO, CLASS_ORDER } from '../lib/review';

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
  return (
    <div class="page profile">
      <h1>Ma progression</h1>
      <div class="grid3">
        <div class="card center"><Ring value={lvl.into / lvl.need} size={70} label={<b>{lvl.level}</b>} /><small class="muted">Niveau · {s.xp} XP</small></div>
        <div class="card center"><b class="stat-big">🔥 {s.streak.count}</b><small class="muted">série actuelle · record {s.streak.best}</small></div>
        <div class="card center"><b class="stat-big">{s.puzzle.rating}</b><small class="muted">classement puzzles</small></div>
      </div>
      <section class="card"><h2>Activité (28 jours)</h2><div class="heat">{days.map((d) => <span title={`${d.k} : ${d.v} XP`} class={'h' + (d.v === 0 ? 0 : d.v < 30 ? 1 : d.v < 80 ? 2 : 3)} />)}</div></section>
      <section class="card"><h2>Classement puzzles</h2><LineChart points={s.puzzle.history.map((h) => h.r)} /></section>
      <section class="card"><h2>Parcours</h2>{LEVELS.map((lv) => { const ls = LESSONS.filter((l) => l.level === lv.id); const d = ls.filter((l) => s.lessons[l.id]?.done).length; return <div class="lvl-row"><span>{lv.icon} {lv.name}</span><Progress value={d / ls.length} color={lv.color} /><small>{d}/{ls.length}</small></div>; })}</section>
      {weak.length > 0 && <section class="card"><h2>🩺 Faiblesses détectées</h2><ul class="weak-list">{weak.map((w) => <li><a href={w.route}><b>{w.label}</b><small class="muted">{w.evidence}</small>{w.lesson && <small class="muted">· leçon conseillée</small>}<span class="chev">›</span></a></li>)}</ul></section>}
      <section class="card">
        <h2>📊 Statistiques avancées {!ent.premium && <span class="pill gold">Premium</span>}</h2>
        {ent.premium ? (
          rev.length === 0 ? <p class="muted">Fais le bilan d’une partie pour débloquer ces statistiques.</p> : <>
            <div class="grid3">{(['opening', 'middlegame', 'endgame'] as const).map((k) => <div class="center"><Ring value={(phase(k) || 0) / 100} size={60} label={<b>{phase(k) ?? '—'}</b>} /><small class="muted">{k === 'opening' ? 'Ouverture' : k === 'middlegame' ? 'Milieu de jeu' : 'Finale'}</small></div>)}</div>
            <h4>Précision par partie</h4><LineChart points={rev.map((g) => g.accuracy || 0)} height={90} />
            <h4>Répartition de tes coups</h4>
            <div class="cls-bars">{CLASS_ORDER.filter((c) => cls[c]).map((c) => <div class="cls-bar"><span>{CLASS_INFO[c].symbol} {CLASS_INFO[c].label}</span><Progress value={cls[c] / totalCls} color={CLASS_INFO[c].color} /><small>{Math.round((cls[c] / totalCls) * 100)} %</small></div>)}</div>
            <h4>Thèmes de puzzles</h4>
            <table class="theme-table"><tbody>{themes.map(([t, v]) => <tr><td>{themeName(t)}</td><td>{v.ok + v.ko}</td><td><Progress value={v.ok / (v.ok + v.ko)} /></td><td>{Math.round((v.ok / (v.ok + v.ko)) * 100)} %</td></tr>)}</tbody></table>
          </>
        ) : <PremiumLock title="Statistiques avancées" text="Précision par phase de jeu, répartition de tes coups (brillants, gaffes…), réussite par thème tactique et évolution de ta précision." />}
      </section>
      <section class="card"><h2>🏅 Badges ({Object.keys(s.badges).length}/{BADGES.length})</h2>
        <div class="badge-grid">{BADGES.map((b) => <div class={'badge ' + (s.badges[b.id] ? 'got' : '')} title={b.desc}><span>{b.icon}</span><b>{b.name}</b><small>{b.desc}</small></div>)}</div>
      </section>
      <section class="card"><h2>♟️ Mes parties</h2>
        {s.games.length === 0 ? <p class="muted">Aucune partie pour l’instant. <a href="#/play">Joue contre un bot !</a></p> :
          <ul class="games">{s.games.slice().reverse().slice(0, 30).map((g) => { const b = botById(g.botId); const won = (g.result === '1-0' && g.color === 'w') || (g.result === '0-1' && g.color === 'b'); const draw = g.result === '1/2-1/2';
            return <li><a href={`#/game/${g.id}`}><span class={'res ' + (won ? 'w' : draw ? 'd' : 'l')}>{won ? 'V' : draw ? 'N' : 'D'}</span><span>{b.avatar} {b.name} <small class="muted">({b.elo})</small></span><small class="muted">{new Date(g.date).toLocaleDateString('fr-FR')} · {Math.ceil(g.moves.length / 2)} coups</small>{g.reviewed ? <small class="pill">{String(g.accuracy).replace(".", ",")} %</small> : <small class="pill ghost">Bilan</small>}</a></li>; })}</ul>}
      </section>
    </div>
  );
}
