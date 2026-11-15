import { useEffect, useMemo, useState } from 'preact/hooks';
import { Board } from '../components/Board';
import { MoveTrainer } from '../components/MoveTrainer';
import { PremiumLock, toast, Md } from '../components/ui';
import { OPENINGS, bookMoves } from '../data/openings';
import { Chess, tryMove, moveToUci, sanFr, START_FEN, legalDests, turnColor, isPromotion, formatLine, type Move } from '../lib/chess';
import { useStore, setState, addXp } from '../lib/store';
import { newItem, review, isDue } from '../lib/srs';
import { usePremium } from '../lib/entitlements';
import { checkBadges } from '../lib/progress';
import { playForMove } from '../lib/sound';
import { loadEco, ecoNext, ecoName, type EcoLine } from '../lib/eco';

export function OpeningsHub() {
  const s = useStore((x) => x);
  const [tab, setTab] = useState<'list' | 'explorer' | 'repertoire'>('list');
  return (
    <div class="page openings">
      <h1>Ouvertures</h1>
      <div class="tabs" role="tablist">
        <button class={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>📚 Cours</button>
        <button class={tab === 'explorer' ? 'on' : ''} onClick={() => setTab('explorer')}>🧭 Explorateur</button>
        <button class={tab === 'repertoire' ? 'on' : ''} onClick={() => setTab('repertoire')}>⭐ Mon répertoire</button>
      </div>
      {tab === 'list' && ['e4', 'd4', 'autre'].map((fam) => (
        <section>
          <h2>{fam === 'e4' ? '1.e4' : fam === 'd4' ? '1.d4' : 'Autres'}</h2>
          <div class="opening-grid">
            {OPENINGS.filter((o) => o.family === fam).map((o) => {
              const n = o.lines.length; const ok = o.lines.filter((_, i) => (s.openings[`${o.id}:${i}`]?.ok || 0) > 0).length;
              return <a class="opening-card" href={`#/openings/${o.id}`}><span class="side-dot">{o.side === 'w' ? '⚪' : '⚫'}</span><b>{o.name}</b><small class="muted">{o.eco}</small><small class="muted">{ok}/{n} lignes maîtrisées</small></a>;
            })}
          </div>
        </section>
      ))}
      {tab === 'explorer' && <Explorer />}
      {tab === 'repertoire' && <Repertoire />}
    </div>
  );
}
function Explorer() {
  const [moves, setMoves] = useState<Move[]>([]);
  const [eco, setEco] = useState<EcoLine[] | null>(null);
  useEffect(() => { loadEco().then(setEco); }, []);
  const ch = useMemo(() => { const c = new Chess(); for (const m of moves) tryMove(c, m.san); return c; }, [moves]);
  const sans = moves.map((m) => m.san);
  const book = bookMoves(ch.fen()); const inBook = new Set(book.map((b) => b.san));
  const next = eco ? ecoNext(eco, sans) : [];
  const here = eco ? ecoName(eco, sans) : null;
  const play1 = (san: string) => { const c = new Chess(ch.fen()); const m = tryMove(c, san); if (m) { playForMove(m); setMoves([...moves, m]); } };
  const arrows = (next.length ? next.slice(0, 6).map((x) => x.san) : book.map((b) => b.san));
  return (
    <div class="play-grid">
      <Board fen={ch.fen()} turn={turnColor(ch)} movable={turnColor(ch)} dests={legalDests(ch)} lastMove={moves.length ? [moves[moves.length - 1].from, moves[moves.length - 1].to] : null}
        onMove={(f, t, p) => { const c = new Chess(ch.fen()); const m = tryMove(c, { from: f, to: t, promotion: p || (isPromotion(ch, f, t) ? 'q' : undefined) }); if (!m) return false; playForMove(m); setMoves([...moves, m]); return true; }}
        promotionCheck={(f, t) => isPromotion(ch, f, t)} shapes={arrows.map((san, i) => { const c = new Chess(ch.fen()); const m = tryMove(c, san)!; return { orig: m.from as any, dest: m.to as any, brush: i === 0 ? 'green' : 'paleGreen' }; })} />
      <aside class="side card">
        <p class="muted small">{moves.length ? formatLine(sans) : 'Position de départ'}</p>
        {here && <p><span class="pill">{here.eco}</span> <b>{here.name}</b></p>}
        <h4>Suites connues {eco ? <small class="muted">({eco.length.toLocaleString('fr-FR')} lignes nommées)</small> : <small class="muted">chargement…</small>}</h4>
        <div class="explorer-list">
        {next.length ? next.map((b) => <button class="explorer-row" onClick={() => play1(b.san)}><b>{sanFr(b.san)}</b><small class="muted">{b.eco} · {b.name}{b.lines > 1 ? ` · ${b.lines} lignes` : ''}</small>{inBook.has(b.san) && <span class="pill">Cours</span>}</button>)
          : book.length ? book.map((b) => <button class="explorer-row" onClick={() => play1(b.san)}><b>{sanFr(b.san)}</b><small class="muted">{b.names.join(' · ')}</small></button>)
          : <p class="muted small">Hors théorie répertoriée. Utilise l’analyse pour continuer.</p>}
        </div>
        <div class="row"><button class="btn small ghost" onClick={() => setMoves(moves.slice(0, -1))} disabled={!moves.length}>◀ Retour</button><button class="btn small ghost" onClick={() => setMoves([])}>Début</button></div>
      </aside>
    </div>
  );
}
export function OpeningDetail({ id, line }: { id: string; line?: string }) {
  const o = OPENINGS.find((x) => x.id === id);
  const s = useStore((x) => x);
  if (!o) return <div class="page">Ouverture introuvable</div>;
  if (line != null) return <OpeningTrainer id={id} idx={+line} />;
  return (
    <div class="page">
      <a class="back" href="#/openings">‹ Ouvertures</a>
      <h1>{o.name} <small class="muted">{o.eco}</small></h1>
      <p>{o.summary}</p>
      <div class="chips">{o.ideas.map((i) => <span class="chip">💡 {i}</span>)}</div>
      <h2>Lignes à apprendre</h2>
      {o.lines.map((l, i) => {
        const st = s.openings[`${o.id}:${i}`]; const srs = s.srs[`o:${o.id}:${i}`];
        return (
          <div class="card line-card">
            <div class="grow"><b>{l.name}</b><p class="muted small mono">{formatLine(l.moves.split(' '))}</p>
              <small class="muted">{st ? `${st.ok} réussite${st.ok > 1 ? 's' : ''} · ${st.ko} erreur${st.ko > 1 ? 's' : ''}` : 'Pas encore étudiée'}{srs ? ` · prochaine révision ${isDue(srs) ? 'maintenant' : new Date(srs.due).toLocaleDateString('fr-FR')}` : ''}</small></div>
            <a class="btn primary" href={`#/openings/${o.id}/${i}`}>S’entraîner</a>
          </div>
        );
      })}
    </div>
  );
}
export function OpeningTrainer({ id, idx, custom }: { id: string; idx: number; custom?: { name: string; color: 'w' | 'b'; moves: string[] } }) {
  const o = OPENINGS.find((x) => x.id === id);
  const l = custom ? { name: custom.name, moves: custom.moves.join(' '), notes: {} as Record<number, string> } : o?.lines[idx];
  const side = custom ? custom.color : o?.side || 'w';
  const [mode, setMode] = useState<'learn' | 'test'>('learn');
  const [k, setK] = useState(0); const [mist, setMist] = useState(0); const [done, setDone] = useState(false); const [sig, setSig] = useState(0);
  const key = custom ? `r:${id}` : `${id}:${idx}`;
  const sans = l ? l.moves.split(' ') : [];
  const uci = useMemo(() => { const c = new Chess(); return sans.map((s) => moveToUci(tryMove(c, s)!)); }, [l?.moves]);
  if (!l) return <div class="page">Ligne introuvable</div>;
  // L'élève joue son camp ; si Noirs, le premier coup blanc est joué automatiquement.
  const fen = START_FEN;
  const note = l.notes?.[k - 1];
  const finish = (clean: boolean) => {
    setDone(true);
    setState((s) => {
      const st = (s.openings[key] ||= { ok: 0, ko: 0, last: 0 }); clean ? st.ok++ : st.ko++; st.last = Date.now();
      const sk = custom ? `r:${id}` : `o:${id}:${idx}`; const it = s.srs[sk] || newItem(sk, custom ? 'repertoire' : 'opening');
      s.srs[sk] = review(it, clean ? (mode === 'test' ? 3 : 2) : 0);
    });
    if (clean) addXp(12, 'Ligne d’ouverture'); checkBadges();
  };
  return (
    <div class="page">
      <a class="back" href={custom ? '#/openings' : `#/openings/${id}`}>‹ {custom ? 'Répertoire' : o!.name}</a>
      <div class="session-head"><h1>{l.name}</h1><div class="tabs small"><button class={mode === 'learn' ? 'on' : ''} onClick={() => { setMode('learn'); setSig(sig + 1); setDone(false); setMist(0); setK(0); }}>Apprendre</button><button class={mode === 'test' ? 'on' : ''} onClick={() => { setMode('test'); setSig(sig + 1); setDone(false); setMist(0); setK(0); }}>Tester</button></div></div>
      <div class="play-grid">
        <MoveTrainer key={mode + sig} fen={fen} line={uci} setup={side === 'b'} orientation={side === 'w' ? 'white' : 'black'} hintLevel={mode === 'learn' ? 2 : 0}
          onProgress={setK} onMistake={() => setMist((m) => m + 1)} onSolved={() => finish(mist === 0)} />
        <aside class="side card">
          <p class="muted small">Tu joues les {side === 'w' ? 'Blancs' : 'Noirs'}. {mode === 'learn' ? 'Les flèches te montrent le coup à jouer.' : 'Sans aide : de mémoire !'}</p>
          <p class="mono">{formatLine(sans.slice(0, k))}</p>
          {note && <div class="hint-box"><p>💬 {note}</p></div>}
          {done && <p class="success-box">{mist === 0 ? '🎉 Ligne parfaite ! Elle reviendra dans tes révisions espacées.' : `Ligne terminée avec ${mist} erreur${mist > 1 ? 's' : ''}. Elle reviendra bientôt en révision.`}</p>}
          {done && <button class="btn primary" onClick={() => { setSig(sig + 1); setDone(false); setMist(0); setK(0); setMode('test'); }}>Retester de mémoire</button>}
        </aside>
      </div>
    </div>
  );
}
function Repertoire() {
  const ent = usePremium(); const s = useStore((x) => x);
  const [building, setBuilding] = useState(false); const [moves, setMoves] = useState<Move[]>([]); const [name, setName] = useState(''); const [color, setColor] = useState<'w' | 'b'>('w');
  const ch = useMemo(() => { const c = new Chess(); for (const m of moves) tryMove(c, m.san); return c; }, [moves]);
  if (!ent.premium) return <PremiumLock title="Ton répertoire personnel" text="Construis tes propres lignes d’ouverture en jouant les coups sur l’échiquier, puis révise-les en répétition espacée jusqu’à les connaître par cœur." />;
  if (building) return (
    <div class="play-grid">
      <Board fen={ch.fen()} orientation={color === 'w' ? 'white' : 'black'} turn={turnColor(ch)} movable={turnColor(ch)} dests={legalDests(ch)} promotionCheck={(f, t) => isPromotion(ch, f, t)}
        onMove={(f, t, p) => { const c = new Chess(ch.fen()); const m = tryMove(c, { from: f, to: t, promotion: p || (isPromotion(ch, f, t) ? 'q' : undefined) }); if (!m) return false; playForMove(m); setMoves([...moves, m]); return true; }} />
      <aside class="side card">
        <label>Nom de la ligne<input value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder="Ex. : Mon Italienne" /></label>
        <div class="row"><button class={'btn small ' + (color === 'w' ? 'primary' : 'ghost')} onClick={() => setColor('w')}>⚪ Blancs</button><button class={'btn small ' + (color === 'b' ? 'primary' : 'ghost')} onClick={() => setColor('b')}>⚫ Noirs</button></div>
        <p class="mono">{formatLine(moves.map((m) => m.san)) || 'Joue les coups de ta ligne…'}</p>
        <div class="row wrap"><button class="btn small ghost" onClick={() => setMoves(moves.slice(0, -1))}>◀ Annuler</button>
          <button class="btn small primary" disabled={moves.length < 2} onClick={() => { setState((st) => { st.repertoire.push({ id: 'r' + Date.now().toString(36), name: name || 'Ma ligne', color, moves: moves.map((m) => m.san) }); }); toast('Ligne enregistrée', '⭐'); setBuilding(false); setMoves([]); setName(''); }}>Enregistrer</button>
          <button class="btn small ghost" onClick={() => setBuilding(false)}>Fermer</button></div>
      </aside>
    </div>
  );
  return (
    <div>
      <button class="btn primary" onClick={() => setBuilding(true)}>＋ Nouvelle ligne</button>
      {s.repertoire.length === 0 && <p class="muted">Aucune ligne pour l’instant.</p>}
      {s.repertoire.map((r) => (
        <div class="card line-card"><div class="grow"><b>{r.color === 'w' ? '⚪' : '⚫'} {r.name}</b><p class="muted small mono">{formatLine(r.moves)}</p></div>
          <a class="btn primary" href={`#/repertoire/${r.id}`}>S’entraîner</a>
          <button class="btn ghost small" onClick={() => { if (confirm('Supprimer cette ligne ?')) setState((st) => { st.repertoire = st.repertoire.filter((x) => x.id !== r.id); delete st.srs['r:' + r.id]; }); }} aria-label="Supprimer">🗑</button></div>
      ))}
    </div>
  );
}
export function RepertoireTrainer({ id }: { id: string }) {
  const r = useStore((s) => s.repertoire.find((x) => x.id === id)); const ent = usePremium();
  if (!ent.premium) return <div class="page"><PremiumLock title="Répertoire personnel" text="Fonction Premium." /></div>;
  if (!r) return <div class="page">Ligne introuvable</div>;
  return <OpeningTrainer id={id} idx={0} custom={r} />;
}
