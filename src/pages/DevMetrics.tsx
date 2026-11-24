// #/dev/metrics : mes mesures, calculées sur cet appareil (R4a, plan §2.13). Rien n'est envoyé.
import { useEffect, useState } from 'preact/hooks';
import { getState } from '../lib/store';
import { allEvents, exportEvents, stats, query, appendRaw, maybeCompact, CAP_EVENTS, CAP_BYTES, TIER, type AppEvent } from '../lib/events';
import { computeMetrics, type LocalMetrics, type Ret, addDays } from '../lib/metrics';
import { SCHEMA_VERSION } from '../lib/migrations';
import { NavBar } from '../components/ui';

const RET_TXT: Record<Ret, string> = { yes: 'Oui', no: 'Non', pending: 'À venir' };
const fmtDay = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

export function DevMetrics() {
  const [m, setM] = useState<LocalMetrics | null>(null); const [ev, setEv] = useState<AppEvent[]>([]);
  useEffect(() => { allEvents().then((e) => { setEv(e); setM(computeMetrics(e, getState())); }); }, []);
  const s = getState();
  const download = async () => { const b = new Blob([await exportEvents()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `maitre-echecs-journal-${new Date().toISOString().slice(0, 10)}.json`; a.click(); };
  const tile = (label: string, r: Ret, n: number) => (
    <div class={'mt-tile ' + r} data-ret={r}><small>{label}</small><b>{RET_TXT[r]}</b><span class="tnum">{m && (r === 'pending' ? `le ${fmtDay(addDays(m.installDay, n))}` : fmtDay(addDays(m.installDay, n)))}</span></div>
  );
  return (
    <div class="page dev-metrics">
      <NavBar back="#/settings" backLabel="Réglages" title="Mes mesures" />
      <p class="muted mt-intro">Calculées sur cet appareil à partir de ton journal local. <b>Rien n’est envoyé</b> : pas de compte, pas de traceur, pas de serveur.</p>
      {!m ? <div class="loading" role="status">Calcul…</div> : (
        <>
          <div class="section-label">Est-ce que je reviens ?</div>
          <p class="list-foot mt-def">J<i>n</i> = tu as ouvert l’app le <i>n</i>-ième jour après ton premier jour ({fmtDay(m.installDay)}).</p>
          <div class="mt-tiles" data-testid="retention">{tile('J1', m.ret.d1, 1)}{tile('J7', m.ret.d7, 7)}{tile('J30', m.ret.d30, 30)}</div>
          <p class="list-foot">Au moins une fois dans la 1re semaine : <b>{RET_TXT[m.within.d7]}</b> · dans le 1er mois : <b>{RET_TXT[m.within.d30]}</b></p>

          <div class="section-label">Mes 30 derniers jours</div>
          <div class="mt-strip" role="img" aria-label={`${m.last30.filter((d) => d.active).length} jours actifs sur 30`}>
            {m.last30.map((d) => <span class={d.active ? 'on' : ''} title={fmtDay(d.day)} />)}
          </div>
          <div class="list mt-list">
            <div class="item"><span class="it-main"><span class="it-title">Visites</span><span class="it-sub">{m.sessionsPerActiveDay} par jour actif</span></span><b class="tnum">{m.sessions}</b></div>
            <div class="item"><span class="it-main"><span class="it-title">Minutes</span><span class="it-sub">{m.minutesPerActiveDay} par jour actif</span></span><b class="tnum">{m.minutes}</b></div>
            <div class="item"><span class="it-main"><span class="it-title">Jours avec le puzzle du jour</span></span><b class="tnum">{m.dailyPlayedDays}</b></div>
            <div class="item"><span class="it-main"><span class="it-title">Cartes du fil réussies</span></span><b class="tnum">{m.cards.ok} / {m.cards.served}</b></div>
            <div class="item"><span class="it-main"><span class="it-title">Jours actifs</span><span class="it-sub">{m.sources.eventDays} dans le journal{m.sources.legacyDays ? ` · ${m.sources.legacyDays} d’avant le journal (historique d’activité)` : ''}</span></span><b class="tnum">{m.activeDays.length}</b></div>
          </div>

          <div class="section-label">Mon journal</div>
          <div class="list mt-list" data-testid="by-type">
            {Object.entries(m.byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => <div class="item" data-type={k}><span class="it-main"><code>{k}</code></span><b class="tnum">{v}</b></div>)}
          </div>
          <p class="list-foot">{ev.length} évènements · schéma des données v{s.v} (app v{SCHEMA_VERSION}) · cohorte {m.cohort}<br />Identifiant d’installation : <code class="mt-dev">{s.deviceId.slice(0, 8)}…</code> (tiré au hasard, propre à cette installation, jamais envoyé ; « Tout effacer » en tire un nouveau).</p>
          <div class="list"><button class="item mt-export" onClick={download}><span class="it-main"><span class="it-title">Exporter mon journal (JSON)</span><span class="it-sub">Un fichier sur ton appareil, lisible</span></span></button></div>
        </>
      )}
    </div>
  );
}

const fmtBytes = (b: number) => (b < 1024 ? `${b} o` : b < 1048576 ? `${(b / 1024).toFixed(1)} Ko` : `${(b / 1048576).toFixed(1)} Mo`);
/** #/dev/events : ce que le coach sait de moi (brief P0 §6-7) ; outils de test seulement en mode développeur */
export function DevEvents() {
  const [st, setSt] = useState<Awaited<ReturnType<typeof stats>> | null>(null);
  const [last, setLast] = useState<AppEvent[]>([]); const [est, setEst] = useState<{ usage?: number; quota?: number } | null>(null); const [busy, setBusy] = useState('');
  const dev = (import.meta as any).env?.DEV || location.search.includes('dev=1') || location.hash.includes('dev=1');
  const load = async () => { setSt(await stats()); setLast((await query()).slice(-50).reverse()); setEst((await (navigator as any).storage?.estimate?.().catch(() => null)) || null); };
  useEffect(() => { void load(); }, []);
  const c = getState().consent;
  const gen = async () => { setBusy('Génération…'); const { syntheticGames } = await import('../lib/synthetic'); await appendRaw(syntheticGames(1000, { startT: Date.now() - 400 * 86400e3, dev: getState().deviceId })); setBusy(''); await load(); };
  const comp = async () => { setBusy('Compactage…'); const r = await maybeCompact(Date.now(), { events: 0, bytes: 0 }); setBusy(r ? `${r.remove.length} supprimés, ${r.add.length} résumés de partie` : 'rien à compacter'); await load(); };
  return (
    <div class="page dev-metrics dev-events">
      <NavBar back="#/settings" backLabel="Réglages" title="Ce que le coach sait de moi" />
      <p class="muted mt-intro">Tout est sur cet appareil. <b>Rien n’est envoyé.</b> Analyse détaillée : <b data-testid="consent">{c?.detail ? 'activée' : 'désactivée'}</b>{c?.ageBand ? ` · ${c.ageBand === '13+' ? '13 ans ou plus' : 'moins de 13 ans'}` : ''}.</p>
      {!st ? <div class="loading" role="status">Lecture…</div> : (
        <>
          <div class="list mt-list">
            <div class="item"><span class="it-main"><span class="it-title">Évènements</span><span class="it-sub">plafond {CAP_EVENTS.toLocaleString('fr-FR')}</span></span><b class="tnum" data-testid="ev-count">{st.count}</b></div>
            <div class="item"><span class="it-main"><span class="it-title">Taille estimée</span><span class="it-sub">plafond {fmtBytes(CAP_BYTES)}</span></span><b class="tnum">{fmtBytes(st.bytes)}</b></div>
            <div class="item"><span class="it-main"><span class="it-title">Plus ancien</span></span><b class="tnum">{st.oldest ? new Date(st.oldest).toLocaleDateString('fr-FR') : '—'}</b></div>
            {est?.usage != null && <div class="item"><span class="it-main"><span class="it-title">Stockage du navigateur</span></span><b class="tnum">{fmtBytes(est.usage)}{est.quota ? ` / ${fmtBytes(est.quota)}` : ''}</b></div>}
          </div>
          <div class="section-label">Par type</div>
          <div class="list mt-list" data-testid="ev-types">
            {Object.entries(st.byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => <div class="item" data-type={k}><span class="it-main"><code>{k}</code><span class="it-sub">{(TIER as any)[k] === 'detail' ? 'détaillé (avec ton accord)' : 'de base'}</span></span><b class="tnum">{v}</b></div>)}
          </div>
          {dev && <>
            <div class="section-label">Outils de test (développeur)</div>
            <div class="list"><button class="item mt-export" onClick={gen} disabled={!!busy}>Générer 1 000 parties synthétiques (datées d’il y a 400 jours)</button><button class="item mt-export" onClick={comp} disabled={!!busy}>Forcer le compactage</button></div>
            {busy && <p class="list-foot" role="status">{busy}</p>}
            <div class="section-label">50 derniers évènements</div>
            <pre class="ev-last">{last.map((e) => `${new Date(e.t).toLocaleTimeString('fr-FR')} ${e.type} ${JSON.stringify(e.data).slice(0, 140)}`).join('\n')}</pre>
          </>}
        </>
      )}
    </div>
  );
}
