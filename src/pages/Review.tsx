import { useStore } from '../lib/store';
import { isDue, isMastered } from '../lib/srs';
import { OPENINGS } from '../data/openings';
import { Empty, Ring } from '../components/ui';

export function ReviewHub() {
  const s = useStore((x) => x);
  const items = Object.values(s.srs);
  const duePz = items.filter((x) => x.kind === 'puzzle' && isDue(x));
  const dueOp = items.filter((x) => (x.kind === 'opening' || x.kind === 'repertoire') && isDue(x));
  const mastered = items.filter(isMastered).length;
  const nextDue = items.filter((x) => !isDue(x)).sort((a, b) => a.due - b.due)[0];
  return (
    <div class="page">
      <h1>🔁 Révisions espacées</h1>
      <p class="muted">Ce que tu rates revient au moment idéal : juste avant de l’oublier. Chaque réussite espace la prochaine révision (1 j, 4 j, 10 j, 25 j…).</p>
      <div class="grid3">
        <div class="card center"><Ring value={items.length ? mastered / items.length : 0} size={64} label={<b>{mastered}</b>} /><small class="muted">maîtrisés</small></div>
        <div class="card center"><b class="stat-big">{duePz.length + dueOp.length}</b><small class="muted">à réviser</small></div>
        <div class="card center"><b class="stat-big">{items.length}</b><small class="muted">dans ta mémoire</small></div>
      </div>
      {duePz.length + dueOp.length === 0 ? (
        <Empty icon="✅" title="Tout est à jour !" text={nextDue ? `Prochaine révision : ${new Date(nextDue.due).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}` : 'Rate un puzzle ou entraîne-toi sur une ouverture pour remplir ta mémoire.'}>
          <a class="btn primary" href="#/puzzles/rated">Faire des puzzles</a>
        </Empty>
      ) : (
        <>
          {duePz.length > 0 && <a class="card line-card" href="#/puzzles/review"><span class="big-icon">🧩</span><div class="grow"><b>{duePz.length} puzzle{duePz.length > 1 ? 's' : ''} à revoir</b><small class="muted">Puzzles que tu avais ratés</small></div><span class="btn primary">Réviser</span></a>}
          {dueOp.map((it) => {
            if (it.kind === 'repertoire') { const r = s.repertoire.find((x) => 'r:' + x.id === it.id); return r && <a class="card line-card" href={`#/repertoire/${r.id}`}><span class="big-icon">⭐</span><div class="grow"><b>{r.name}</b><small class="muted">Ton répertoire</small></div><span class="btn primary">Réviser</span></a>; }
            const [, oid, li] = it.id.split(':'); const o = OPENINGS.find((x) => x.id === oid); if (!o) return null;
            return <a class="card line-card" href={`#/openings/${oid}/${li}`}><span class="big-icon">📖</span><div class="grow"><b>{o.name}</b><small class="muted">{o.lines[+li]?.name}</small></div><span class="btn primary">Réviser</span></a>;
          })}
        </>
      )}
    </div>
  );
}
