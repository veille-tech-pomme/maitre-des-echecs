import { useState } from 'preact/hooks';
import { useStore, setState } from '../lib/store';
import { unlockAudio } from '../lib/sound';
import { Board } from '../components/Board';
import { Icon, type IconName } from '../components/Icon';

const LEVELS: { id: string; icon: IconName; color: string; title: string; sub: string }[] = [
  { id: 'debutant', icon: 'sprout', color: '#30A46C', title: 'Je débute', sub: 'Je découvre les règles, ou presque.' },
  { id: 'intermediaire', icon: 'swords', color: '#0A84FF', title: 'Je connais les règles', sub: 'Je joue de temps en temps.' },
  { id: 'avance', icon: 'castle', color: '#BF5AF2', title: 'Je joue en club', sub: 'Plus de 1400 Elo environ.' },
];
const FEATS: { icon: IconName; t: string; s: string }[] = [
  { icon: 'learn', t: 'Des leçons qui expliquent', s: 'Chaque coup a son « pourquoi ».' },
  { icon: 'puzzle', t: 'Puzzles à ta mesure', s: 'Ton classement s’ajuste à chaque essai.' },
  { icon: 'brainCircuit', t: 'Un coach personnel', s: 'Il repère tes faiblesses, explique tes erreurs et t’entraîne dessus.' },
];
const ART_FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

/** Accueil en 3 écrans plein écran : bienvenue → prénom → niveau. */
export function Onboarding() {
  const done = useStore((s) => s.onboarded);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [lvl, setLvl] = useState('debutant');
  if (done) return null;
  const finish = (l: string | null, test = false) => {
    setState((s) => {
      s.onboarded = true; s.settings.name = name.trim();
      const order = ['debutant', 'intermediaire', 'avance'];
      if (l) { for (const k of order.slice(1, order.indexOf(l) + 1)) s.lessons['unlock-' + k] = { done: false, stars: 0, step: 0 }; s.puzzle.rating = l === 'intermediaire' ? 1100 : l === 'avance' ? 1500 : 800; }
    });
    unlockAudio();
    location.hash = test ? '#/coach/test' : l && l !== 'debutant' ? '#/learn' : '#/lesson/d-echiquier';
  };
  const next = () => { unlockAudio(); setStep(step + 1); };
  return (
    <div class="ob" role="dialog" aria-modal="true" aria-label="Bienvenue">
      <div class="ob-inner">
        <div class="ob-top">
          {step > 0 ? <button class="nb-btn" onClick={() => setStep(step - 1)} aria-label="Retour"><Icon name="left" size={26} stroke={2.4} /></button> : <span style="width:44px" />}
          <div class="ob-dots" role="img" aria-label={`Étape ${step + 1} sur 3`}>{[0, 1, 2].map((i) => <span class={i === step ? 'on' : ''} />)}</div>
          <button class="btn plain small" onClick={() => finish(null)}>Passer</button>
        </div>
        {step === 0 && (
          <div class="ob-body" key="0">
            <div class="ob-art"><Board fen={ART_FEN} viewOnly coordinates={false} /></div>
            <h1>Deviens le maître de ton jeu.</h1>
            <p class="lead">De ta toute première règle au niveau expert, à ton rythme, quelques minutes par jour.</p>
          </div>
        )}
        {step === 1 && (
          <div class="ob-body" key="1">
            <div class="ob-mark"><Icon name="play" size={38} /></div>
            <h1>Comment t’appelles-tu ?</h1>
            <p class="lead">Ton coach s’adressera à toi par ton prénom. Tout reste sur ton appareil.</p>
            <input class="name" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter') next(); }} placeholder="Ton prénom" aria-label="Ton prénom" maxLength={24} autoComplete="given-name" />
            <div class="ob-feats">
              {FEATS.map((f) => <div class="feat"><span><Icon name={f.icon} size={20} /></span><div><b>{f.t}</b><small>{f.s}</small></div></div>)}
            </div>
          </div>
        )}
        {step === 2 && (
          <div class="ob-body" key="2">
            <h1>{name.trim() ? `${name.trim()}, où` : 'Où'} en es-tu ?</h1>
            <p class="lead" style="margin-bottom:22px">On adapte ton parcours. Tu pourras changer à tout moment.</p>
            <div role="radiogroup" aria-label="Ton niveau">
              {LEVELS.map((l) => (
                <button class={'level-opt ' + (lvl === l.id ? 'on' : '')} role="radio" aria-checked={lvl === l.id} onClick={() => setLvl(l.id)}>
                  <span class="lo-icon" style={{ '--c': l.color } as any}><Icon name={l.icon} size={22} /></span>
                  <span><b>{l.title}</b><small>{l.sub}</small></span>
                  <span class="radio">{lvl === l.id && <Icon name="check" size={15} stroke={3} />}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div class="ob-actions">
          {step < 2 ? <button class="btn primary lg" onClick={next}>{step === 0 ? 'Commencer' : 'Continuer'}</button>
            : <>{lvl !== 'debutant' && <button class="btn secondary lg" onClick={() => finish(lvl, true)}><Icon name="gauge" size={18} />Test de niveau (2 min)</button>}<button class="btn primary lg" onClick={() => finish(lvl)}>C’est parti</button></>}
        </div>
      </div>
    </div>
  );
}
