// Pilier 8 (cahier GOAT) : validation de TOUT le contenu à coups, reproductible.
//  1. FEN légale (chess.js + lib/legal.ts) ;  2. solution légale qui atteint l'objectif ;
//  3. alternatives : Stockfish multi-PV à budget fixe en nœuds ; tout coup aussi bon (même mat ou plus rapide,
//     ou écart ≤ EQUIV_CP) est écrit dans src/data/accepts.gen.json (lu par le coach à l'exécution, hors ligne) ;
//  4. finales ≤ 7 pièces : catégorie de la base de finales (cache tools/data/tb-cache.json) cohérente avec l'objectif ;
//  5. affirmations des textes : « mat en N » confronté au moteur ; cartes « un seul coup » du fil sans alternative.
// Reproductible : Stockfish épinglé (CI : sf 17.1 avx2), 1 fil, table de hachage vidée, budget en nœuds fixe ;
// cache commité tools/data/validation-cache/<moteur>-n<budget>.json indexé par (FEN, multipv, coup imposé).
// Usage : STOCKFISH=/tmp/sf npx tsx tools/validate-content.mts [--offline] [--jobs=4]
//   --offline : n'utilise que le cache ; une position absente du cache est une erreur « à recalculer ».
//   --fresh   : ignore le cache et recalcule tout (CI de nuit : la régénération ne doit produire aucun diff, CA8.3).
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { LESSONS } from '../src/data/lessons';
import { COURSE_LESSONS } from '../src/data/lessons/courses';
import { ENDGAMES } from '../src/data/endgames';
import { positionIssues } from '../src/lib/legal';
import { equivalence, pts, EQUIV_CP, type Sc } from '../src/lib/judge-rule';
import master from '../src/data/feed-master.json';
import TB from './data/tb-cache.json';
// @ts-ignore
import { Uci, findEngine } from './uci.mjs';

export const NODES = 1_500_000, MPV = 5;
const ENGINE_ID = 'sf17.1';
const CACHE = `tools/data/validation-cache/${ENGINE_ID}-n${NODES}.json`;
const ACCEPTS = 'src/data/accepts.gen.json';
const REPORT = 'tools/data/validation-report.json';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const args = process.argv.slice(2); const OFFLINE = args.includes('--offline'); const FRESH = args.includes('--fresh');
const JOBS = +(args.find((a) => a.startsWith('--jobs='))?.slice(7) || 4);

/** clé de position : placement, trait, roques, en passant (sans les compteurs) */
export const fenKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ');
const uciOf = (m: { from: string; to: string; promotion?: string }) => m.from + m.to + (m.promotion || '');
type Item = { id: string; src: 'lesson' | 'course' | 'master'; fen: string; expected: string; kind: string; opening: boolean; method?: boolean; only?: boolean; claim?: number };
const items: Item[] = []; const errors: string[] = []; const warnings: string[] = [];
let exercises = 0;

// ---------- 1-2. collecte, légalité, solutions ----------
for (const l of [...LESSONS, ...COURSE_LESSONS]) l.steps.forEach((s: any, i: number) => {
  if (s.type !== 'exercise') return; const g = s.goal;
  if (!['any', 'line', 'mate', 'check'].includes(g.kind)) return;
  exercises++;
  const src = (l as any).course ? 'course' : 'lesson'; const id = `${l.id}#${i}`;
  const fen0 = s.fen || START; const bad = positionIssues(fen0); if (bad) { errors.push(`${id} FEN illégale ${fen0} · ${bad}`); return; }
  const ch = new Chess(fen0); for (const m of s.pre || []) { try { ch.move(m); } catch { errors.push(`${id} pré-coup illégal ${m}`); return; } }
  const opening = /^(ouv-|a-ouv|i-principes|rep-)/.test(l.id);
  const text = [s.title, s.prompt].join(' '); const cm = text.match(/mat en (\d+)/i); const claim = cm ? +cm[1] : undefined;
  if (g.kind === 'mate' || g.kind === 'check') {
    const t = ch.moves({ verbose: true }).find((m) => { const c = new Chess(ch.fen()); c.move(m); return g.kind === 'mate' ? c.isCheckmate() : c.inCheck(); });
    if (!t) { errors.push(`${id} objectif « ${g.kind} » impossible : aucun coup ne l'atteint · ${ch.fen()}`); return; }
    if (g.kind === 'mate') items.push({ id, src, fen: ch.fen(), expected: uciOf(t), kind: 'mate', opening, claim });
    return;
  }
  const moves: string[] = g.kind === 'any' ? [g.accept[0]] : g.moves;
  for (const [k, san] of moves.entries()) {
    let m; try { m = new Chess(ch.fen()).move(san); } catch { m = null; }
    if (!m) { errors.push(`${id} coup ${k} de la solution illégal : ${san} · ${ch.fen()}`); return; }
    if (g.kind === 'any') for (const a of g.accept) { try { new Chess(ch.fen()).move(a); } catch { errors.push(`${id} coup accepté illégal : ${a} · ${ch.fen()}`); } }
    if (k % 2 === 0) items.push({ id: `${id}.${k}`, src, fen: ch.fen(), expected: uciOf(m), kind: g.kind, opening, method: !!g.method, claim: k === 0 ? claim : undefined });
    ch.move(san);
  }
});
for (const x of master as any[]) {
  const bad = positionIssues(x.f); if (bad) { errors.push(`maître ${x.f} FEN illégale · ${bad}`); continue; }
  const c = new Chess(x.f); let ok = false; try { ok = !!c.move({ from: x.m.slice(0, 2), to: x.m.slice(2, 4), promotion: x.m[4] }); } catch { ok = false; }
  if (!ok) { errors.push(`maître ${x.f} coup illégal ${x.m}`); continue; }
  items.push({ id: `maître:${x.hero}-${x.vs}-${x.y}-${x.n}`, src: 'master', fen: x.f, expected: x.m, kind: 'master', opening: false, only: x.why?.k === 'only' });
}

// ---------- 4. finales : base de finales ----------
const pieces = (fen: string) => fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
let tbChecked = 0, tbSkipped = 0;
const tbWant = (goal: string) => (goal === 'draw' ? ['draw', 'blessed-loss', 'cursed-win'] : ['win']);
for (const e of ENDGAMES) {
  const bad = positionIssues(e.fen); if (bad) { errors.push(`finale ${e.id} FEN illégale · ${bad}`); continue; }
  if (pieces(e.fen) > 7) { tbSkipped++; continue; }
  const t = (TB as any)[e.fen]; if (!t) { warnings.push(`finale ${e.id} absente du cache de la base de finales`); tbSkipped++; continue; }
  tbChecked++; if (!tbWant(e.goal).includes(t.category)) errors.push(`finale ${e.id} objectif « ${e.goal} » mais base de finales : ${t.category} · ${e.fen}`);
}
for (const l of [...LESSONS, ...COURSE_LESSONS]) l.steps.forEach((s: any, i: number) => {
  if (s.type !== 'exercise' || s.goal.kind !== 'play') return; exercises++;
  const ch = new Chess(s.fen || START); for (const m of s.pre || []) ch.move(m); const fen = ch.fen();
  const t = (TB as any)[fen] || (TB as any)[fenKey(fen) + ' 0 1'];
  if (pieces(fen) > 7 || !t) { tbSkipped++; return; }
  tbChecked++; if (!tbWant(s.goal.result).includes(t.category)) errors.push(`${l.id}#${i} objectif « ${s.goal.result} » mais base de finales : ${t.category} · ${fen}`);
});

// ---------- 3. moteur (cache) ----------
type Line = { move: string; cp: number | null; mate: number | null; pv: string[] };
const cache: Record<string, Line[]> = !FRESH && fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const used = new Set<string>();
let hits = 0, misses = 0; const missing: string[] = [];
const engines: any[] = []; let engineName = '';
async function getEngine(i: number) {
  if (!engines[i]) { const e = new Uci(); await e.init(); engines[i] = e; engineName = e.name; }
  return engines[i];
}
async function analyse(w: number, fen: string, mpv: number, only?: string): Promise<Line[] | null> {
  const key = `${fenKey(fen)}|${mpv}|${only || ''}`; used.add(key);
  if (cache[key]) { hits++; return cache[key]; }
  if (OFFLINE) { misses++; missing.push(key); return null; }
  misses++; const e = await getEngine(w);
  const r = await e.analyse(fen, { nodes: NODES, multipv: mpv, searchmoves: only ? [only] : undefined });
  const lines = r.lines.map((l: any) => ({ move: l.move, cp: l.cp, mate: l.mate, pv: l.pv.slice(0, 8) }));
  cache[key] = lines; return lines;
}
const accepts: Record<string, Record<string, { s: string; pv?: string[] }>> = {};
const scoreStr = (l: Sc) => (l.mate != null ? 'm' + l.mate : String(l.cp));
let alternatives = 0; let analysed = 0;
async function check(w: number, p: Item) {
  const c = new Chess(p.fen); if (c.isGameOver()) return;
  const lines = await analyse(w, p.fen, p.src === 'master' ? 3 : MPV); if (!lines) return;
  let ex: Line | undefined = lines.find((l) => l.move === p.expected);
  if (!ex) { const r = await analyse(w, p.fen, 1, p.expected); if (!r) return; ex = r[0]; }
  analysed++;
  const after = new Chess(p.fen); after.move({ from: p.expected.slice(0, 2), to: p.expected.slice(2, 4), promotion: p.expected[4] });
  const expSc: Sc = after.isCheckmate() ? { cp: null, mate: 1 } : { cp: ex?.cp ?? null, mate: ex?.mate ?? null };
  const best = lines[0];
  if (!p.opening && !(expSc.mate! > 0) && pts(best) - pts(expSc) > 150) errors.push(`${p.id} coup prévu faible : ${p.expected} (${pts(expSc)}) contre ${best.move} (${pts(best)}) · ${p.fen}`);
  if (p.claim && p.kind !== 'mate' && !(expSc.mate === p.claim || (p.claim === 1 && after.isCheckmate()))) {
    // « mat en N » : la solution doit mater en N exactement (la ligne peut aussi commencer par un coup d'approche)
    if (!(expSc.mate != null && expSc.mate > 0 && expSc.mate <= p.claim)) errors.push(`${p.id} le texte annonce « mat en ${p.claim} », le moteur trouve ${scoreStr(expSc)} · ${p.fen}`);
  }
  const entry: Record<string, { s: string; pv?: string[] }> = { [p.expected]: { s: scoreStr(expSc) } };
  for (const alt of lines) {
    if (alt.move === p.expected) continue;
    const a = new Chess(p.fen); a.move({ from: alt.move.slice(0, 2), to: alt.move.slice(2, 4), promotion: alt.move[4] });
    const altSc: Sc = a.isCheckmate() ? { cp: null, mate: 1 } : alt;
    const eq = p.kind === 'mate' ? (a.isCheckmate() ? 'mate-equal' : 'worse') : equivalence(expSc, altSc);
    if (eq === 'worse') continue;
    if (p.only && !(expSc.mate! > 0)) { warnings.push(`${p.id} carte « un seul coup » : ${alt.move} (${pts(altSc)}) vaut ${p.expected} (${pts(expSc)}) à ${EQUIV_CP} cp près · ${p.fen}`); continue; }
    if (p.method) continue; // exercice de méthode : seule la méthode est acceptée (audit C3)
    alternatives++; entry[alt.move] = altSc.mate != null && altSc.mate > 0 ? { s: scoreStr(altSc), pv: alt.pv.slice(1, 8) } : { s: scoreStr(altSc) };
  }
  if (p.src === 'master') return; // cartes du fil : validées, pas d'acceptation à l'exécution
  const k = fenKey(p.fen); accepts[k] = { ...(accepts[k] || {}), ...entry };
}
const queue = [...items]; const t0 = Date.now();
await Promise.all(Array.from({ length: OFFLINE ? 1 : JOBS }, async (_, w) => {
  while (queue.length) { const p = queue.shift()!; await check(w, p); if (!OFFLINE && misses && (items.length - queue.length) % 100 === 0) process.stderr.write(`${items.length - queue.length}/${items.length} ${Math.round((Date.now() - t0) / 1000)} s\n`); }
}));
engines.forEach((e) => e.quit());
if (missing.length) errors.push(`${missing.length} analyses absentes du cache ${CACHE} : relancer sans --offline (Stockfish 17.1) et commiter le cache. Ex. ${missing.slice(0, 3).join(' ; ')}`);
if (engineName && !engineName.startsWith('Stockfish 17.1')) errors.push(`moteur ${engineName} : le cache est indexé pour Stockfish 17.1 (résultats non reproductibles)`);

// ---------- sorties stables (clés triées, pas d'horodatage) ----------
const sortObj = (o: any): any => (Array.isArray(o) || !o || typeof o !== 'object' ? o : Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortObj(o[k])])));
if (!OFFLINE) fs.writeFileSync(CACHE, JSON.stringify(sortObj(Object.fromEntries([...used].filter((k) => cache[k]).map((k) => [k, cache[k]])))) + '\n');
fs.writeFileSync(ACCEPTS, JSON.stringify(sortObj(accepts)) + '\n');
const moveExercises = items.filter((i) => i.src !== 'master');
const report = sortObj({
  engine: ENGINE_ID, nodes: NODES, multipv: MPV, equivCp: EQUIV_CP,
  counts: { exercises, movePositions: moveExercises.length, masterCards: items.length - moveExercises.length, analysed, withAccepts: Object.keys(accepts).length, alternatives, tbChecked, tbSkipped },
  coverage: { movePositions: moveExercises.length, covered: moveExercises.filter((i) => accepts[fenKey(i.fen)]?.[i.expected] || new Chess(i.fen).isGameOver()).length },
  errors: [...errors].sort(), warnings: [...warnings].sort(),
});
fs.writeFileSync(REPORT, JSON.stringify(report, null, 1) + '\n');
console.log(`validate-content : ${items.length} positions (${moveExercises.length} d'exercices, ${report.counts.masterCards} cartes du maître), ${alternatives} alternatives aussi bonnes, finales ${tbChecked} vérifiées / ${tbSkipped} hors base ; cache ${hits} / ${misses} ; ${errors.length} erreur(s), ${warnings.length} avertissement(s)`);
for (const e of errors) console.log('  ✗ ' + e);
for (const w of warnings.slice(0, 15)) console.log('  ! ' + w);
process.exit(errors.length ? 1 : 0);
