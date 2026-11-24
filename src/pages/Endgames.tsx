import { useState } from 'preact/hooks';
import { ENDGAMES, ENDGAME_CATS } from '../data/endgames';
import { PlayGoal } from '../components/Exercises';
import { useStore, setState, addXp, pushCoach } from '../lib/store';
import { checkBadges } from '../lib/progress';
import { NavBar } from '../components/ui';
import { Icon } from '../components/Icon';

export function EndgamesHub() {
  const s = useStore((x) => x); const [cat, setCat] = useState('Toutes');
  return (
    <div class="page">
      <NavBar back="#/learn" backLabel="Apprendre" />
      <h1 class="page-title">Finales</h1>
      <p class="muted page-sub">{ENDGAMES.length} positions à savoir gagner ou annuler. Le moteur défend à pleine puissance.</p>
      <div class="chips">{['Toutes', ...ENDGAME_CATS].map((c) => <button class={'chip ' + (cat === c ? 'on' : '')} onClick={() => setCat(c)}>{c}</button>)}</div>
      {ENDGAME_CATS.filter((c) => cat === 'Toutes' || c === cat).map((c) => { const list = ENDGAMES.filter((e) => e.cat === c).sort((a, b) => a.level - b.level); const done = list.filter((e) => s.endgames[e.id]?.done).length; return (
        <section><div class="section-title"><h2>{c}</h2><span class="muted tnum">{done}/{list.length}</span></div>
          <div class="opening-grid">{list.map((e) => <a class={'opening-card ' + (s.endgames[e.id]?.done ? 'done' : '')} href={`#/endgames/${e.id}`}><span class={'side-dot ' + (s.endgames[e.id]?.done ? 'ok' : '')}><Icon name={s.endgames[e.id]?.done ? 'check' : e.goal === 'mate' ? 'king' : e.goal === 'promote' ? 'pawn' : 'shieldHalf'} size={16} stroke={s.endgames[e.id]?.done ? 3 : 2} /></span><b>{e.title}</b><small class="muted"><span class="lvl-dots" aria-label={`Difficulté ${e.level} sur 3`}>{[1, 2, 3].map((k) => <i class={k <= e.level ? 'on' : ''} />)}</span>{e.goal === 'mate' ? 'Mater' : e.goal === 'promote' ? 'Promouvoir' : 'Annuler'}</small></a>)}</div>
        </section>); })}
    </div>
  );
}
export function EndgameDrill({ id }: { id: string }) {
  const d = ENDGAMES.find((x) => x.id === id); const [reset, setReset] = useState(0); const [won, setWon] = useState(false); const [tip, setTip] = useState(false);
  if (!d) return <div class="page">Exercice introuvable</div>;
  return (
    <div class="page">
      <div class="game-top"><a class="nb-btn round" href="#/endgames" aria-label="Fermer"><Icon name="close" size={18} stroke={2.5} /></a><div class="gt-title">{d.title}</div><span /></div>
      <div class="play-grid">
        <PlayGoal fen={d.fen} result={d.goal} maxMoves={d.maxMoves} script={d.script} method={d.method} resetSignal={reset}
          onDone={() => { setWon(true); const first = !useStoreSnapshot().endgames[d.id]?.done; setState((s) => { s.endgames[d.id] = { done: true }; pushCoach(s, { k: 'endgame', t: Date.now(), id: d.id, ok: true }); }); addXp(first ? 30 : 5, 'Finale réussie'); checkBadges(); }} />
        <aside class="side">
          <p class="goal-line"><Icon name="target" size={18} /><span><b>Objectif :</b> {d.goal === 'mate' ? `mater en ${d.maxMoves} coups maximum` : d.goal === 'promote' ? 'aller à dame en gardant une position gagnante' : `tenir ${d.maxMoves} coups sans perdre`}.</span></p>
          <p class="muted">{d.desc}</p>
          {tip && <div class="hint-box"><Icon name="bulb" size={18} /><p>{d.tip}</p></div>}
          {won && <p class="success-box"><Icon name="checkCircle" size={20} />Réussi. Rejoue-la pour l’automatiser.</p>}
          <div class="actionbar">
            <button class="tool" onClick={() => setTip(true)} disabled={tip}><Icon name="bulb" size={22} />Méthode</button>
            <button class="tool" onClick={() => { setReset(reset + 1); setWon(false); }}><Icon name="reset" size={22} />Recommencer</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
import { getState as useStoreSnapshot } from '../lib/store';
