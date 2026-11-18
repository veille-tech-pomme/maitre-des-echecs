import { useEffect, useState } from 'preact/hooks';
import { Chess, sanFr, tryMove } from '../lib/chess';
import { positionStats, prefetch, masterGame, loadMeta, pct, type PosStat, type MasterGame, type ExplorerMeta } from '../lib/explorer';
import { usePremium } from '../lib/entitlements';

const FREE_GAMES = 3;
export function WdlBar({ w, d, b, n, labels = true }: { w: number; d: number; b: number; n: number; labels?: boolean }) {
  const W = pct(w, n), D = pct(d, n), B = Math.max(0, 100 - W - D);
  return (
    <div class="wdl" role="img" aria-label={`Blancs ${W} %, nulles ${D} %, Noirs ${B} %`}>
      <span class="w" style={{ width: W + '%' }}>{labels && W >= 12 ? W + '%' : ''}</span>
      <span class="d" style={{ width: D + '%' }}>{labels && D >= 12 ? D + '%' : ''}</span>
      <span class="b" style={{ width: B + '%' }}>{labels && B >= 12 ? B + '%' : ''}</span>
    </div>
  );
}
const fmt = (n: number) => n.toLocaleString('fr-FR');
/** Statistiques des parties de maîtres pour une position : coups joués, % gains/nulles/pertes, Elo moyen, parties notables. */
export function MasterStats({ fen, onPlay, ply = 0, onStats }: { fen: string; onPlay: (san: string) => void; ply?: number; onStats?: (s: PosStat | null) => void }) {
  const [all, setAll] = useState(false);
  const [st, setSt] = useState<PosStat | null | undefined>(undefined);
  const [err, setErr] = useState(false);
  const [meta, setMeta] = useState<ExplorerMeta | null>(null);
  const [games, setGames] = useState<MasterGame[]>([]);
  const prem = usePremium().premium;
  useEffect(() => { loadMeta().then(setMeta); }, []);
  useEffect(() => {
    let live = true; setErr(false); setGames([]); setAll(false);
    positionStats(fen).then((s) => {
      if (!live) return; setSt(s); onStats?.(s);
      if (s) {
        prefetch(s.moves.slice(0, 4).map((m) => { const c = new Chess(fen); tryMove(c, m.san); return c.fen(); }));
        const ids = s.games.slice(0, prem ? s.games.length : FREE_GAMES);
        Promise.all(ids.map((id) => masterGame(id).catch(() => null))).then((gs) => live && setGames(gs.filter(Boolean) as MasterGame[]));
      }
    }).catch(() => live && setErr(true));
    return () => { live = false; };
  }, [fen, prem]);
  const head = meta ? `${fmt(meta.games)} parties de maîtres (Elo FIDE ≥ ${meta.minElo})` : 'Parties de maîtres';
  return (
    <div class="master-stats">
      <div class="section-label ms-head">Base des maîtres <span>{head}</span></div>
      {err && <p class="muted small">Base indisponible hors-ligne pour cette position (pas encore en cache).</p>}
      {st === undefined && !err && <p class="muted small">Chargement…</p>}
      {st === null && !err && <p class="muted small">{meta && ply >= meta.depth ? `La base couvre les ${meta.depth / 2} premiers coups.` : `Position jouée dans moins de ${meta?.minN ?? 5} parties de maîtres.`}</p>}
      {st && (
        <>
          <div class="ms-total"><span><b>{fmt(st.n)}</b> parties · Elo moy. <b>{st.elo}</b></span><WdlBar {...st} /></div>
          <table class="ms-moves">
            <thead><tr><th>Coup</th><th>Parties</th><th class="ms-bar">Blancs / nulle / Noirs</th><th>Elo</th></tr></thead>
            <tbody>
              {(all ? st.moves : st.moves.slice(0, 8)).map((m) => (
                <tr class="ms-row" onClick={() => onPlay(m.san)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onPlay(m.san)}>
                  <td><b>{sanFr(m.san)}</b></td>
                  <td class="num">{fmt(m.n)} <small class="muted">{m.n * 100 < st.n ? '<1' : pct(m.n, st.n)}%</small></td>
                  <td class="ms-bar"><WdlBar {...m} /></td>
                  <td class="num muted">{m.elo}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!all && st.moves.length > 8 && <button class="btn small ghost" onClick={() => setAll(true)}>Afficher les {st.moves.length} coups</button>}
          {st.games.length > 0 && (
            <div class="ms-games">
              <h5>Parties notables</h5>
              {games.map((g) => (
                <a class="ms-game" href={`#/analysis?game=${g.id}&ply=${ply}`}>
                  <span class="ms-res">{g.result === '1' ? '1-0' : g.result === '0' ? '0-1' : '½-½'}</span>
                  <span class="grow"><b>{g.white}</b> <small class="muted">{g.we}</small> – <b>{g.black}</b> <small class="muted">{g.be}</small><br /><small class="muted">{g.event} · {g.date.slice(0, 4)}</small></span>
                </a>
              ))}
              {!prem && st.games.length > FREE_GAMES && <a class="ms-more" href="#/premium">Voir les {st.games.length} parties notables avec Premium</a>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
