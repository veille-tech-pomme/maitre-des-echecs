import { useState } from 'preact/hooks';
import { ENDGAMES } from '../data/endgames';
import { PlayGoal } from '../components/Exercises';
import { useStore, setState, addXp } from '../lib/store';
import { checkBadges } from '../lib/progress';

export function EndgamesHub() {
  const s = useStore((x) => x);
  return (
    <div class="page">
      <h1>♔ Finales</h1>
      <p class="muted">Les positions que tout joueur doit savoir gagner (ou annuler). Le moteur défend à pleine puissance.</p>
      {[1, 2, 3].map((lv) => (
        <section><h2>{lv === 1 ? 'Essentielles' : lv === 2 ? 'Finales de pions' : 'Techniques avancées'}</h2>
          <div class="opening-grid">{ENDGAMES.filter((e) => e.level === lv).map((e) => <a class={'opening-card ' + (s.endgames[e.id]?.done ? 'done' : '')} href={`#/endgames/${e.id}`}><span class="side-dot">{e.icon}</span><b>{e.title}</b><small class="muted">{e.desc}</small>{s.endgames[e.id]?.done && <small class="ok">✓ réussi</small>}</a>)}</div>
        </section>
      ))}
    </div>
  );
}
export function EndgameDrill({ id }: { id: string }) {
  const d = ENDGAMES.find((x) => x.id === id); const [reset, setReset] = useState(0); const [won, setWon] = useState(false); const [tip, setTip] = useState(false);
  if (!d) return <div class="page">Exercice introuvable</div>;
  return (
    <div class="page">
      <a class="back" href="#/endgames">‹ Finales</a>
      <div class="session-head"><h1>{d.icon} {d.title}</h1></div>
      <div class="play-grid">
        <PlayGoal fen={d.fen} result={d.goal} maxMoves={d.maxMoves} resetSignal={reset}
          onDone={() => { setWon(true); const first = !useStoreSnapshot().endgames[d.id]?.done; setState((s) => { s.endgames[d.id] = { done: true }; }); addXp(first ? 30 : 5, 'Finale réussie'); checkBadges(); }} />
        <aside class="side card">
          <p><b>Objectif :</b> {d.goal === 'mate' ? `mater en ${d.maxMoves} coups maximum` : d.goal === 'promote' ? 'aller à dame' : `tenir ${d.maxMoves} coups sans perdre`}.</p>
          <p class="muted">{d.desc}</p>
          {tip ? <div class="hint-box"><p>💡 {d.tip}</p></div> : <button class="btn ghost" onClick={() => setTip(true)}>💡 Méthode</button>}
          <button class="btn ghost" onClick={() => { setReset(reset + 1); setWon(false); }}>↺ Recommencer</button>
          {won && <p class="success-box">🎉 Réussi ! Rejoue-la pour l’automatiser.</p>}
        </aside>
      </div>
    </div>
  );
}
import { getState as useStoreSnapshot } from '../lib/store';
