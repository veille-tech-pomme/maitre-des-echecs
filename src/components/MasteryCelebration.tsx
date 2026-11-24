// Pilier 7 (F7.4, CA7.2) : célébration courte exactement quand une notion passe à « Maîtrisée » (journal
// masteredLog du modèle, rempli par mastery.ts au moment de la transition). Sobre : pas de confettis en boucle.
import { useEffect } from 'preact/hooks';
import { useStore, setState } from '../lib/store';
import { CONCEPT, CONCEPTS } from '../data/concepts';
import { evidenceText } from '../coach/mastery';
import { Icon } from './Icon';
import { play } from '../lib/sound';

export default function MasteryCelebration() {
  const s = useStore((x) => x);
  const e = s.coach?.masteredLog?.find((x) => !x.seen);
  useEffect(() => { if (e) play('win'); }, [e?.id, e?.t]);
  if (!e) return null;
  const c = CONCEPT[e.id]; const st = s.coach?.concepts?.[e.id];
  const opens = CONCEPTS.filter((x) => x.prereq.includes(e.id)).map((x) => x.label).slice(0, 3);
  const close = () => setState((d) => { const x = d.coach?.masteredLog?.find((y) => y.id === e.id && y.t === e.t); if (x) x.seen = true; });
  return (
    <div class="mastery-cel" role="dialog" aria-modal="true" aria-labelledby="mc-title">
      <div class="mc-card">
        <span class="mc-ico"><Icon name="trophy" size={44} stroke={1.8} /></span>
        <h2 id="mc-title">Tu maîtrises : {c?.label || e.id} !</h2>
        <p>{evidenceText(st)}</p>
        {opens.length > 0 && <p class="muted small">Ça t’ouvre : {opens.join(', ')}.</p>}
        <button class="btn primary lg" onClick={close} autoFocus>Super</button>
      </div>
    </div>
  );
}
