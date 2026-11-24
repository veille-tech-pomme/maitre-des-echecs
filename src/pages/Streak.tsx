// Série souple (R4c, plan §2.3) : écran #/serie, mission « sauve ta série » (#/serie/mission), célébration des paliers.
// Les gels se gagnent en jouant et ne s'achètent jamais ; les textes informent sans culpabiliser (lignes rouges §9).
import { useEffect, useState } from 'preact/hooks';
import { MoveTrainer } from '../components/MoveTrainer';
import { NavBar, toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { useStore, getState, setState, today, addXp } from '../lib/store';
import { project, atRisk, inVacation, addDays, startVacation, endVacation, streakVisible, titleFor, TITLES, MAX_FREEZES, FREEZE_EVERY, VACATION_MAX, REPAIR_DAYS } from '../lib/streak';
import { vacationLog } from '../lib/streak-sync';
import { pickPuzzle, type BankPuzzle } from '../lib/puzzlebank';
import { recordPuzzle } from '../lib/progress';
import { DAILY_CARDS, feedProgress } from '../coach/feed';
import { SHARE_URL } from '../lib/daily';
import { go } from '../lib/router';

const dateFr = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;

export function StreakPage({ arg }: { arg?: string }) {
  if (arg === 'mission') return <StreakMission />;
  const s = useStore((x) => x); const d = today(); const st = project(s.streak, d); const vis = streakVisible(s);
  const done = st.last === d; const risk = atRisk(s.streak, d); const vac = st.vacation && inVacation(st, d) ? st.vacation : null;
  const [days, setDays] = useState(3);
  const toNext = FREEZE_EVERY - (st.count % FREEZE_EVERY);
  const cal = Array.from({ length: 28 }, (_, i) => addDays(d, i - 27));
  const cls = (x: string) => x === d && done ? 'on' : (st.frozen || []).includes(x) ? 'ice' : inVacation(st, x) && x <= d ? 'vac' : (s.activity[x] || 0) > 0 ? 'on' : '';
  return (
    <div class="page streak-page">
      <NavBar back="#/" backLabel="Pour toi" title="Ma série" />
      {!vis && <div class="banner"><Icon name="info" size={20} /><span>Ta série est masquée (réglage par défaut avant 13 ans). Tu peux l’afficher plus bas.</span></div>}
      <div class="sk-hero" data-count={st.count}>
        <Icon name="flame" size={44} class={st.count ? 'lit' : ''} />
        <b class="tnum">{st.count}</b><span>{st.count > 1 ? 'jours de suite' : 'jour de suite'}</span>
        <small class="muted">Record {st.best}{titleFor(st.best) ? ` · ${titleFor(st.best)}` : ''}</small>
      </div>
      <div class="list">
        {vac ? <div class="item"><span class="it-main"><span class="it-title">En vacances jusqu’au {dateFr(vac.to)}</span><span class="it-sub">Ta série est en pause, rien ne se perd.</span></span><button class="btn plain sm" onClick={() => { setState((x) => endVacation(x.streak, d)); vacationLog(null); }}>Je suis de retour</button></div>
          : done ? <div class="item sk-ok"><Icon name="checkCircle" size={20} /><span class="it-main"><span class="it-title">Journée validée</span><span class="it-sub">À demain : une réussite suffira.</span></span></div>
          : risk ? <a class="item sk-mission" href="#/serie/mission"><Icon name="timer" size={20} /><span class="it-main"><span class="it-title">Mission 2 minutes</span><span class="it-sub">Une carte choisie par ton coach suffit pour aujourd’hui.</span></span><Icon name="right" size={18} /></a>
          : <div class="item"><span class="it-main"><span class="it-title">Une réussite lance ta série</span><span class="it-sub">Un puzzle, une carte du fil ou le Coup du jour.</span></span></div>}
        {st.repair && <div class="item sk-repair"><Icon name="wand" size={20} /><span class="it-main"><span class="it-title">Réparer ma série de {st.repair.prev} jours : {st.repair.done.length}/{REPAIR_DAYS}</span><span class="it-sub">Atteins ton objectif du jour ({DAILY_CARDS} cartes) aujourd’hui et demain, avant la fin du {dateFr(st.repair.until)}. Aujourd’hui : {Math.min(feedProgress(s).done, DAILY_CARDS)}/{DAILY_CARDS}.</span></span></div>}
      </div>
      <h3 class="sk-h">Gels <span class="sk-ice" aria-label={`${st.freezes || 0} gel${(st.freezes || 0) > 1 ? 's' : ''} sur ${MAX_FREEZES}`}>{Array.from({ length: MAX_FREEZES }, (_, i) => <span class={i < (st.freezes || 0) ? 'on' : ''}>❄️</span>)}</span></h3>
      <p class="muted small sk-p">Un gel protège un jour manqué, tout seul. Tu en gagnes 1 tous les {FREEZE_EVERY} jours de suite, {MAX_FREEZES} au plus{(st.freezes || 0) < MAX_FREEZES && st.count ? ` (prochain dans ${plural(toNext, 'jour')})` : ''}. Ils se gagnent en jouant : ils ne s’achètent pas.</p>
      <h3 class="sk-h">Mes 4 dernières semaines</h3>
      <div class="sk-cal" role="img" aria-label="Calendrier des 28 derniers jours">{cal.map((x) => <span class={'sk-d ' + cls(x) + (x === d ? ' today' : '')} title={x} />)}</div>
      <p class="muted small sk-p sk-legend"><span class="sk-d on" /> joué <span class="sk-d ice" /> gel <span class="sk-d vac" /> vacances</p>
      {!vac && <>
        <h3 class="sk-h">Mode vacances</h3>
        <p class="muted small sk-p">Une pause déclarée, jusqu’à {VACATION_MAX} jours, sans perdre ta série.</p>
        <div class="sk-vac"><label>Durée <select value={days} onChange={(e) => setDays(+(e.target as HTMLSelectElement).value)} aria-label="Durée des vacances">{Array.from({ length: VACATION_MAX }, (_, i) => <option value={i + 1}>{plural(i + 1, 'jour')}</option>)}</select></label>
          <button class="btn plain" onClick={() => { setState((x) => { startVacation(x.streak, d, days); }); vacationLog(days); toast(`Bonnes vacances ! Série en pause ${plural(days, 'jour')}.`, 'sun'); }}>Partir en vacances</button></div>
      </>}
      <div class="list sk-set">
        <label class="item switch-row"><span class="it-main"><span class="it-title">Afficher ma série</span><span class="it-sub">Masquée par défaut avant 13 ans. Elle continue de compter en silence.</span></span><input type="checkbox" class="switch streak-switch" checked={vis} onChange={(e) => setState((x) => { x.settings.streakShow = (e.target as HTMLInputElement).checked; })} /></label>
      </div>
      <p class="muted small sk-p">Une seule réussite par jour suffit : l’objectif de {DAILY_CARDS} cartes reste à part. Paliers fêtés : {Object.keys(TITLES).join(', ')} jours.</p>
    </div>
  );
}

function StreakMission() {
  const [p, setP] = useState<BankPuzzle | null | undefined>(undefined); const [ok, setOk] = useState<boolean | null>(null); const [k, setK] = useState(0);
  useEffect(() => { const st = getState(); setP(undefined); setOk(null); pickPuzzle({ rating: Math.max(400, st.puzzle.rating - 250 - k * 100), seen: st.puzzle.seen }).then(setP, () => setP(null)); }, [k]);
  if (p === undefined) return <div class="page"><div class="loading" aria-label="Préparation de la mission" /></div>;
  if (!p) return <div class="page"><NavBar back="#/serie" backLabel="Ma série" close /><div class="empty"><h3>Mission indisponible hors ligne</h3><p>Le Coup du jour ou une carte du fil comptent aussi.</p><div class="col center-col"><a class="btn primary" href="#/">Pour toi</a></div></div></div>;
  const before = getState().streak.count;
  return (
    <div class="page puzzle-session streak-mission" data-pz={p.i}>
      <div class="game-top"><a class="nb-btn round" href="#/serie" aria-label="Fermer"><Icon name="close" size={18} stroke={2.5} /></a><div class="gt-title">Mission 2 minutes</div><span class="pill tnum">🔥 {before}</span></div>
      <div class="play-grid">
        <MoveTrainer key={p.i} fen={p.f} line={p.m.split(' ')} setup goal="puzzle" ownHints
          onMistake={() => { if (ok == null) { setOk(false); recordPuzzle(p, false, 'rush'); } }}
          onSolved={() => { if (ok == null) { setOk(true); addXp(8, 'Série sauvée'); recordPuzzle(p, true, 'rush'); } else if (!ok) setOk(false); }} />
        <aside class="side">
          <p><b>Une réussite suffit pour aujourd’hui.</b></p>
          <p class="muted small">Un puzzle facile, choisi par ton coach.</p>
          {ok === true && <div class="col"><p class="ok"><b>Série validée : {getState().streak.count} {getState().streak.count > 1 ? 'jours' : 'jour'} 🔥</b></p><button class="btn primary" onClick={() => go('/')}>Continuer</button></div>}
          {ok === false && <div class="col"><p class="muted small">Pas grave. Un autre, plus simple ?</p><button class="btn primary mission-next" onClick={() => setK(k + 1)}>Un autre puzzle</button></div>}
        </aside>
      </div>
    </div>
  );
}

export function StreakMilestone() {
  const s = useStore((x) => x); const n = s.streak.cel;
  if (!n || !streakVisible(s)) return null;
  const close = () => setState((x) => { x.streak.cel = null; });
  const share = async () => {
    const text = `🔥 ${n} jours de suite sur Maître des Échecs${TITLES[n] ? ` · ${TITLES[n]}` : ''}\n${SHARE_URL}`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Copié : colle-le où tu veux', 'check'); } } catch {}
  };
  return (
    <div class="streak-cel" role="dialog" aria-modal="true" aria-label={`${n} jours de suite`}>
      <div class="sc-card">
        <Icon name="flame" size={64} class="lit" />
        <b class="sc-n tnum">{n}</b><span class="sc-l">jours de suite</span>
        {TITLES[n] && <p class="sc-t">Nouveau titre : <b>{TITLES[n]}</b></p>}
        <p class="muted small">Chaque jour compte, même une seule réussite.</p>
        <button class="btn primary lg" onClick={share}><Icon name="share" size={18} />Partager</button>
        <button class="btn plain sc-close" onClick={close}>Continuer</button>
      </div>
    </div>
  );
}
