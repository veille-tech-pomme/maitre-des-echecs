import { useStore } from '../lib/store';
import { isDue, isMastered } from '../lib/srs';
import { OPENINGS } from '../data/openings';
import { Empty, NavBar, Item } from '../components/ui';
import { Icon } from '../components/Icon';

export function ReviewHub() {
  const s = useStore((x) => x);
  const items = Object.values(s.srs);
  const duePz = items.filter((x) => x.kind === 'puzzle' && isDue(x));
  const dueMk = items.filter((x) => x.kind === 'mistake' && isDue(x));
  const dueOp = items.filter((x) => (x.kind === 'opening' || x.kind === 'repertoire') && isDue(x));
  const mastered = items.filter(isMastered).length;
  const nextDue = items.filter((x) => !isDue(x)).sort((a, b) => a.due - b.due)[0];
  const total = duePz.length + dueOp.length + dueMk.length;
  return (
    <div class="page">
      <NavBar back="#/learn" backLabel="Apprendre" />
      <h1 class="page-title">Révisions</h1>
      <p class="muted page-sub">Ce que tu rates revient juste avant que tu l’oublies : 1 jour, 4 jours, 10 jours, 25 jours…</p>
      <div class="stat-strip">
        <div class="stat-tile" style="--c:#FF9F0A"><span class="st-top"><Icon name="repeat" size={13} />À revoir</span><b>{total}</b><small>maintenant</small></div>
        <div class="stat-tile" style="--c:#30A46C"><span class="st-top"><Icon name="checkCircle" size={13} />Acquis</span><b>{mastered}</b><small>sur {items.length}</small></div>
        <div class="stat-tile" style="--c:#5E5CE6"><span class="st-top"><Icon name="brain" size={13} />Mémoire</span><b>{items.length}</b><small>éléments</small></div>
      </div>
      {total === 0 ? (
        <Empty icon="checkCircle" title="Tout est à jour" text={nextDue ? `Prochaine révision ${new Date(nextDue.due).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}.` : 'Rate un puzzle ou entraîne-toi sur une ouverture pour remplir ta mémoire.'}>
          <div class="col center-col"><a class="btn primary" href="#/">Retour à Pour toi</a><a class="btn plain" href="#/puzzles/rated">Faire des puzzles classés</a></div>
        </Empty>
      ) : (
        <div class="list">
          {dueMk.length > 0 && <Item href="#/review/mistakes" icon="brainCircuit" color="#5E5CE6" title={`${dueMk.length} erreur${dueMk.length > 1 ? 's' : ''} de tes parties`} sub="Les moments clés repérés par le coach" large />}
          {duePz.length > 0 && <Item href="#/puzzles/review" icon="puzzle" color="#FF9F0A" title={`${duePz.length} puzzle${duePz.length > 1 ? 's' : ''} à revoir`} sub="Ceux que tu avais ratés" large />}
          {dueOp.map((it) => {
            if (it.kind === 'repertoire') { const r = s.repertoire.find((x) => 'r:' + x.id === it.id); return r && <Item href={`#/repertoire/${r.id}`} icon="star" color="#F2B544" title={r.name} sub="Ton répertoire" large />; }
            const [, oid, li] = it.id.split(':'); const o = OPENINGS.find((x) => x.id === oid); if (!o) return null;
            return <Item href={`#/openings/${oid}/${li}`} icon="book" color="#30A46C" title={o.name} sub={o.lines[+li]?.name} large />;
          })}
        </div>
      )}
    </div>
  );
}
