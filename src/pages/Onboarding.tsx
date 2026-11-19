import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore, setState, addXp } from '../lib/store';
import { unlockAudio } from '../lib/sound';
import { MoveTrainer } from '../components/MoveTrainer';
import { toastPrefs } from '../components/ui';
import { Icon } from '../components/Icon';

// Accueil en moins de 15 secondes : un prénom (facultatif), puis un premier mat gagnant tout de suite.
// Pas de niveau à déclarer : le diagnostic se fait dans les premières cartes du fil « Pour toi ».
const MATE_FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
const MATE = 'h5f7';
const AUTO_MS = 4200;

export function Onboarding() {
  const done = useStore((s) => s.onboarded);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [won, setWon] = useState(false);
  const [miss, setMiss] = useState(0);
  const t0 = useRef(0);
  useEffect(() => { if (step === 1) { t0.current = Date.now(); toastPrefs.quietXp = true; return () => { toastPrefs.quietXp = false; }; } }, [step]);
  // le minuteur s'arrête dès que l'accueil est fini (sinon il renvoyait vers « Pour toi » 4 s après un « Continuer » manuel)
  useEffect(() => { if (!won || done) return; const t = setTimeout(finish, AUTO_MS); return () => clearTimeout(t); }, [won, done]);
  if (done) return null;
  const nm = name.trim();
  const start = () => { unlockAudio(); setStep(1); };
  const solved = () => {
    if (won) return; setWon(true);
    addXp(10, 'Premier mat');
    setState((s) => { s.settings.name = nm; s.obMate = { ok: miss === 0, ms: Date.now() - t0.current }; });
  };
  function finish() {
    setState((s) => { s.onboarded = true; s.settings.name = nm; s.obMate ||= { ok: false, ms: 0 }; });
    location.hash = '#/';
  }
  return (
    <div class="ob" role="dialog" aria-modal="true" aria-label="Bienvenue">
      <div class="ob-inner">
        <div class="ob-top">
          {step > 0 && !won ? <button class="nb-btn" onClick={() => setStep(0)} aria-label="Retour"><Icon name="left" size={26} stroke={2.4} /></button> : <span style="width:44px" />}
          <div class="ob-dots" role="img" aria-label={`Étape ${step + 1} sur 2`}>{[0, 1].map((i) => <span class={i === step ? 'on' : ''} />)}</div>
          <span style="width:44px" />
        </div>
        {step === 0 && (
          <div class="ob-body" key="0">
            <div class="ob-mark"><Icon name="crown" size={38} /></div>
            <h1>Deviens le maître de ton jeu.</h1>
            <p class="lead">Ton coach s’adapte à toi, quelques minutes par jour. Tout reste sur ton appareil.</p>
            <input class="name" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter') start(); }} placeholder="Ton prénom (facultatif)" aria-label="Ton prénom (facultatif)" maxLength={24} autoComplete="given-name" enterKeyHint="go" />
          </div>
        )}
        {step === 1 && (
          <div class={'ob-body ob-mate' + (won ? ' won' : '')} key="1">
            <h1>{won ? 'Échec et mat !' : <>Ton premier coup<span class="muted"> : fais mat.</span></>}</h1>
            <p class="lead">{won ? '' : miss ? miss > 1 ? 'La flèche montre le coup : joue-le.' : 'Indice : la case f7 n’est défendue que par le roi noir.' : 'Les Blancs jouent. Un seul coup gagne la partie.'}</p>
            <div class="ob-board">
              <MoveTrainer fen={MATE_FEN} line={[MATE]} hintLevel={Math.min(2, miss)} feedback={false} onMistake={() => setMiss((x) => x + 1)} onSolved={solved} />
              {won && <div class="fc-xp" aria-live="polite"><Icon name="sparkles" size={16} />+10 XP</div>}
            </div>
            {won && (
              <div class="ob-coach" role="status">
                <span class="oc-ico"><Icon name="brainCircuit" size={20} /></span>
                <p>{nm ? `Bravo ${nm} : ` : 'Bravo : '}ta dame, soutenue par le fou, prend f7 et le roi n’a plus aucune case. Maintenant, je découvre ton niveau en 4 positions.</p>
              </div>
            )}
          </div>
        )}
        <div class="ob-actions">
          {step === 0 && <button class="btn primary lg" onClick={start}>Jouer mon premier coup<Icon name="right" size={18} stroke={2.5} /></button>}
          {won && <button class="btn primary lg fc-next auto" style={{ '--auto-ms': AUTO_MS / 1000 + 's' } as any} onClick={finish}>Continuer</button>}
        </div>
      </div>
    </div>
  );
}
