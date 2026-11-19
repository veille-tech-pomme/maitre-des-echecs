// « Mes progrès » (#/coach) et test de niveau adaptatif (#/coach/test).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useStore, setState, getState } from '../lib/store';
import { LargeTitle, NavBar, Progress } from '../components/ui';
import { Icon } from '../components/Icon';
import { MoveTrainer } from '../components/MoveTrainer';
import { pickPuzzle, type BankPuzzle } from '../lib/puzzlebank';
import { radar, skillViews, weaknesses, strengths, globalRating, observe, confidence } from '../coach/model';
import { coachPlan, weekProgress, ensureModel } from '../coach/curriculum';
import { FAMILY_LABEL, FAMILIES, SKILL, MOTIF_SKILL, type Family } from '../coach/skills';
import { review as srsReview } from '../lib/srs';
import { diagStart, diagTarget, diagAnswer, diagDone, diagResult, DIAG_THEMES, type DiagState } from '../coach/diagnostic';
import { ACT_ICON, useCoachSync } from '../coach/ui/common';
import { themeName } from '../data/themes';
import { go } from '../lib/router';

function Radar({ data }: { data: { family: Family; value: number; conf: number }[] }) {
  const S = 300, C = S / 2, R = 104; const n = data.length;
  const pt = (i: number, v: number) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [C + Math.cos(a) * R * v, C + Math.sin(a) * R * v]; };
  const poly = (v: (i: number) => number) => data.map((_, i) => pt(i, v(i)).map((x) => x.toFixed(1)).join(',')).join(' ');
  const label = data.map((d) => `${FAMILY_LABEL[d.family]} ${d.value}`).join(', ');
  return (
    <svg class="radar" viewBox={`-56 0 ${S + 112} ${S}`} role="img" aria-label={`Profil par famille (50 = ton niveau moyen) : ${label}`}>
      {[0.25, 0.5, 0.75, 1].map((k) => <polygon class={k === 0.5 ? 'rd-mid' : 'rd-grid'} points={poly(() => k)} />)}
      {data.map((_, i) => { const [x, y] = pt(i, 1); return <line class="rd-axis" x1={C} y1={C} x2={x} y2={y} />; })}
      <polygon class="rd-shape" points={poly((i) => data[i].value / 100)} />
      {data.map((d, i) => { const [x, y] = pt(i, d.value / 100); return <circle class="rd-dot" cx={x} cy={y} r={3.5} opacity={0.4 + 0.6 * d.conf} />; })}
      {data.map((d, i) => { const [x, y] = pt(i, 1.2); return <text x={x} y={y + 4} text-anchor={Math.abs(x - C) < 8 ? 'middle' : x > C ? 'start' : 'end'}>{FAMILY_LABEL[d.family]}</text>; })}
    </svg>
  );
}
export function CoachPage() {
  const s = useStore((x) => x);
  const ready = useCoachSync(s);
  const [fam, setFam] = useState<Family | 'all'>('all');
  if (!ready || !s.coach) return <div class="page"><div class="loading" aria-label="Chargement" /></div>;
  const m = s.coach; const g = globalRating(m);
  const weak = weaknesses(m, 4); const strong = strengths(m, 4); const plan = coachPlan(s, m, 4); const wk = weekProgress(s, m);
  const views = skillViews(m).filter((v) => v.n > 0 && (fam === 'all' || v.family === fam)).sort((a, b) => a.delta - b.delta);
  const unknown = skillViews(m).filter((v) => v.n === 0).length;
  return (
    <div class="page coach-page">
      <NavBar back="#/" backLabel="Accueil" />
      <LargeTitle title="Mes progrès" sub={m.ev.length ? `Niveau estimé ${g} · ${m.games} partie${m.games > 1 ? 's' : ''} analysée${m.games > 1 ? 's' : ''} · ${m.ev.length} observations` : 'Le coach apprend à te connaître à chaque puzzle, leçon et partie analysée.'} />
      {!m.diag && m.ev.length < 15 && (
        <a class="cc-main" href="#/coach/test"><span class="it-icon"><Icon name="gauge" size={20} /></span><span class="grow"><b>Faire le test de niveau</b><small>6 positions, environ 2 minutes</small></span><Icon name="right" size={20} stroke={2.4} class="cc-go" /></a>
      )}
      <div class="cp-grid">
        <div>
          <div class="card"><Radar data={radar(m)} /><p class="muted small center-text">Le cercle pointillé correspond à ton niveau moyen. Plus le point est opaque, plus le coach est sûr de lui.</p></div>
          {strong.length > 0 && <><div class="section-title"><h2>Tes forces</h2></div><div class="strong-chips">{strong.map((x) => <span class="pill"><Icon name="trend" size={14} />{x.label}</span>)}</div></>}
          <div class="section-title"><h2>À travailler</h2></div>
          {weak.length ? weak.map((w) => {
            const sk = SKILL[w.skill];
            return (
              <div class="weak-card">
                <h4><Icon name="target" size={18} />{w.label}</h4>
                {w.evidence.slice(0, 3).map((e) => <p class="evidence"><Icon name="info" size={14} />{e}</p>)}
                <div class="row">
                  {sk.theme && <a class="btn small primary" href={`#/puzzles/theme/${sk.theme}`}>Puzzles ciblés</a>}
                  {sk.lesson && <a class="btn small secondary" href={`#/lesson/${sk.lesson}`}>Leçon</a>}
                  {w.refs.find((r) => r.includes('#')) && <a class="btn small plain" href={`#/game/${w.refs.find((r) => r.includes('#'))!.split('#')[0]}`}>Voir dans ma partie</a>}
                </div>
              </div>
            );
          }) : <p class="muted">{m.ev.length < 20 ? 'Pas encore assez d’observations pour affirmer une faiblesse. Continue : le coach ne conclut qu’avec des preuves.' : 'Aucune faiblesse nette pour l’instant. Bravo !'}</p>}
        </div>
        <div>
          {wk && <><div class="section-title first"><h2>Objectifs de la semaine</h2></div>
            <div class="list">{wk.goals.map((x) => (
              <a class="goal-row" href={x.route}><span class="grow"><span>{x.label}</span><Progress value={x.done / x.target} label={x.label} /></span><small>{x.done}/{x.target}</small>{x.done >= x.target && <Icon name="checkCircle" size={20} class="ok" />}</a>
            ))}</div></>}
          <div class="section-title"><h2>Le plan du coach</h2></div>
          <div class="list">{plan.map((a) => (
            <a class="item" href={a.route}><span class="it-icon" style={{ '--c': ACT_ICON[a.kind].color } as any}><Icon name={ACT_ICON[a.kind].icon} size={17} stroke={2.2} /></span><span class="it-main"><span class="it-title">{a.title}</span><span class="it-sub">{a.evidence || a.why}</span></span><Icon name="right" size={18} class="chev" stroke={2.4} /></a>
          ))}</div>
          <div class="section-title"><h2>Compétences</h2></div>
          <div class="chips" role="tablist" aria-label="Familles">
            {(['all', ...FAMILIES] as const).map((f) => <button class={'chip ' + (fam === f ? 'on' : '')} role="tab" aria-selected={fam === f} onClick={() => setFam(f)}>{f === 'all' ? 'Toutes' : FAMILY_LABEL[f]}</button>)}
          </div>
          <div class="list">
            {views.length ? views.map((v) => (
              <div class="skill-row">
                <span class="sk-name">{v.label}</span><span class="sk-val">{v.r}</span>
                <span class="skill-bar" aria-hidden="true"><span style={{ width: `${Math.max(4, Math.min(100, 50 + v.delta / 8))}%`, '--c': v.delta < -100 ? 'var(--red)' : v.delta > 80 ? 'var(--green)' : 'var(--gold)' } as any} /><i /></span>
                <span class="sk-conf">{v.n} observation{v.n > 1 ? 's' : ''} · confiance {Math.round(confidence(v.rd) * 100)} %</span>
              </div>
            )) : <p class="muted small" style="padding:12px 14px">Rien encore dans cette famille.</p>}
          </div>
          {unknown > 0 && <p class="list-foot">{unknown} compétence{unknown > 1 ? 's' : ''} pas encore observée{unknown > 1 ? 's' : ''}.</p>}
          <p class="list-foot">Chaque compétence a sa propre note (Glicko-2) mise à jour par tes puzzles, tes leçons et les moments clés de tes parties. Tout reste sur ton appareil.</p>
        </div>
      </div>
    </div>
  );
}

export function DiagnosticPage() {
  const s0 = useMemo(() => getState(), []);
  const start = s0.puzzle.games >= 10 ? s0.puzzle.rating : s0.puzzle.rating || 900;
  const [st, setSt] = useState<DiagState>(() => diagStart(start));
  const [p, setP] = useState<BankPuzzle | null | undefined>(undefined);
  const [res, setRes] = useState<boolean | null>(null);
  const t0 = useRef(Date.now()); const seen = useRef<string[]>([...s0.puzzle.seen]);
  const load = async (d: DiagState) => {
    setP(undefined); setRes(null);
    const tg = diagTarget(d);
    let q = await pickPuzzle({ rating: tg.rating, theme: tg.theme, seen: seen.current }).catch(() => null);
    if (!q) q = await pickPuzzle({ rating: tg.rating, seen: seen.current }).catch(() => null);
    if (q) seen.current.push(q.i); setP(q); t0.current = Date.now();
  };
  useEffect(() => { load(st); }, []);
  const answer = (ok: boolean) => {
    if (res !== null || !p) return; setRes(ok);
    const n = diagAnswer(st, { id: p.i, r: p.r, th: p.t, ok, ms: Date.now() - t0.current, plies: p.m.split(' ').length - 1 });
    setTimeout(() => { setSt(n); if (diagDone(n)) finish(n); else load(n); }, ok ? 700 : 1300);
  };
  const finish = (n: DiagState) => {
    const r = diagResult(n);
    setState((s) => { const m = ensureModel(s); m.diag = { at: Date.now(), r: r.rating }; m.base = r.rating; for (const e of r.events) observe(m, e); if (s.puzzle.games < 10) s.puzzle.rating = r.rating; });
  };
  const done = diagDone(st);
  if (done) {
    const r = diagResult(st); const ok = st.items.filter((x) => x.ok);
    return (
      <div class="page">
        <NavBar back="#/" backLabel="Accueil" />
        <div class="diag-result">
          <p class="muted">Ton niveau estimé</p>
          <div class="big">{r.rating}</div>
          <p class="muted small">Marge d’incertitude ± {r.rd}. Elle se resserre à chaque puzzle et partie.</p>
          <p>{ok.length} position{ok.length > 1 ? 's' : ''} réussie{ok.length > 1 ? 's' : ''} sur {st.items.length}.</p>
          <div class="list" style="text-align:left">
            {st.items.map((x, i) => <div class="item"><span class="it-icon" style={{ '--c': x.ok ? 'var(--green)' : 'var(--red)' } as any}><Icon name={x.ok ? 'check' : 'close'} size={16} stroke={3} /></span><span class="it-main"><span class="it-title">{themeName(DIAG_THEMES[i])}</span><span class="it-sub">Difficulté {x.r}</span></span></div>)}
          </div>
          <button class="btn primary lg" onClick={() => go('/')}>Voir le plan du coach</button>
        </div>
      </div>
    );
  }
  return (
    <div class="page puzzle-session">
      <div class="game-top"><a class="nb-btn round" href="#/" aria-label="Fermer"><Icon name="close" size={18} stroke={2.5} /></a>
        <div class="gt-title diag-top"><span>Test de niveau</span><span class="diag-dots" aria-label={`Position ${st.i + 1} sur ${DIAG_THEMES.length}`}>{DIAG_THEMES.map((_, i) => <i class={i < st.items.length ? (st.items[i].ok ? 'ok' : 'ko') : i === st.i ? 'cur' : ''} />)}</span></div><span class="pill tnum">{st.i + 1}/{DIAG_THEMES.length}</span></div>
      <div class="play-grid">
        {p === undefined ? <div class="loading" aria-label="Chargement" /> : p ? (
          <MoveTrainer key={p.i} fen={p.f} line={p.m.split(' ')} setup onMistake={() => answer(false)} onSolved={() => answer(true)} />
        ) : <div class="empty"><h3>Puzzles indisponibles</h3><p>Hors ligne, le test a besoin des packs de puzzles déjà téléchargés.</p></div>}
        <aside class="side">
          <p class="muted">Trouve le meilleur coup. Une seule tentative par position : le test s’adapte à tes réponses.</p>
          {res === true && <p class="success-box"><Icon name="checkCircle" size={20} />Bien joué.</p>}
          {res === false && <p class="muted">Pas grave : la position suivante sera plus abordable.</p>}
          <div class="actionbar"><button class="tool" onClick={() => answer(false)} disabled={res !== null || !p}><Icon name="right" size={22} />Je ne sais pas</button></div>
        </aside>
      </div>
    </div>
  );
}

/** Rejouer ses propres erreurs (répétition espacée, kind 'mistake'). */
export function MistakesSession() {
  const s = useStore((x) => x);
  const [k, setK] = useState(0); const [state, setStateL] = useState<'play' | 'ok' | 'ko'>('play'); const failed = useRef(false);
  const due = useMemo(() => Object.values(getState().srs).filter((x) => x.kind === 'mistake' && x.due <= Date.now()).sort((a, b) => a.due - b.due).map((x) => x.id), [k === 0]);
  const id = due[k]; const mk = id ? s.coach?.mistakes[id] : undefined;
  const grade = (ok: boolean) => {
    setState((d) => {
      const it = d.srs[id]; if (it) d.srs[id] = srsReview(it, ok ? (failed.current ? 1 : 2) : 0);
      const m = ensureModel(d); const sk = (mk?.motif && MOTIF_SKILL[mk.motif]) || 'vigilance';
      observe(m, { skill: sk, s: ok && !failed.current ? 1 : 0, d: globalRating(m), w: 0.5, src: 'puzzle', ref: id });
    });
  };
  if (!id || !mk) {
    const pending = Object.values(s.srs).filter((x) => x.kind === 'mistake' && x.due > Date.now()).sort((a, b) => a.due - b.due);
    const wait = pending.length ? Math.max(1, Math.round((pending[0].due - Date.now()) / 60000)) : 0;
    const when = wait < 60 ? `dans ${wait} min` : wait < 1440 ? `dans ${Math.round(wait / 60)} h` : `dans ${Math.round(wait / 1440)} j`;
    const idle = pending.length ? `${pending.length} position${pending.length > 1 ? 's' : ''} tirée${pending.length > 1 ? 's' : ''} de tes parties ${pending.length > 1 ? 'sont programmées' : 'est programmée'} : la prochaine revient ${when}. Les revoir un peu plus tard les grave mieux en mémoire.` : 'Après chaque bilan, le coach transforme tes moments clés en exercices personnels.';
    return (
    <div class="page"><NavBar back="#/review" backLabel="Révisions" />
      <div class="empty"><div class="empty-icon"><Icon name="checkCircle" size={30} /></div><h3>{k ? 'Séance terminée' : pending.length ? 'Rien à rejouer pour l’instant' : 'Aucune erreur à rejouer'}</h3><p>{k ? `Tu as revu ${k} position${k > 1 ? 's' : ''} tirée${k > 1 ? 's' : ''} de tes parties. Elles reviendront au bon moment.` : idle}</p><a class="btn primary" href="#/">Retour à l’accueil</a></div>
    </div>
  ); }
  return (
    <div class="page puzzle-session">
      <div class="game-top"><a class="nb-btn round" href="#/review" aria-label="Fermer"><Icon name="close" size={18} stroke={2.5} /></a><div class="gt-title">Tes erreurs</div><span class="pill tnum">{k + 1}/{due.length}</span></div>
      <div class="play-grid">
        <MoveTrainer key={id} fen={mk.fen} line={mk.sol} onMistake={() => { if (!failed.current) { failed.current = true; setStateL('ko'); } }} onSolved={() => { setStateL('ok'); grade(true); }} />
        <aside class="side">
          <div class="coach-box cls-mistake"><div class="coach-head"><Icon name="brainCircuit" size={20} /><b>Tiré de ta partie</b></div><p>Dans cette position, tu avais joué un coup faible : « {mk.prompt} ». Trouve le meilleur coup.</p></div>
          {state === 'ko' && <p class="muted">Pas encore. Cherche les échecs, les prises et les menaces.</p>}
          {state === 'ok' && <button class="btn primary lg next-btn" onClick={() => { failed.current = false; setStateL('play'); setK(k + 1); }}>Suivante<Icon name="right" size={18} stroke={2.5} /></button>}
          <div class="actionbar">
            {state !== 'ok' && <button class="tool" onClick={() => { failed.current = true; grade(false); setStateL('play'); setK(k + 1); }}><Icon name="eye" size={22} />Passer</button>}
            {mk.game && <a class="tool" href={`#/game/${mk.game}`}><Icon name="microscope" size={22} />La partie</a>}
          </div>
        </aside>
      </div>
    </div>
  );
}
