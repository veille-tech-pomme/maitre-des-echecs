// P0 audit : une promotion n'est réussie que si la position reste gagnante après la réponse du moteur.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Chess } from 'chess.js';
import { promotionVerdict, scriptKey, loneKingWin } from '../src/lib/goal';
import PROMO_LINES from '../tools/data/promo-lines.json';
import { ENDGAMES } from '../src/data/endgames';
import { LESSONS } from '../src/data/lessons';
import { COURSE_LESSONS } from '../src/data/lessons/courses';
// @ts-ignore
import { Uci } from '../tools/uci.mjs';

let e: any;
beforeAll(async () => { e = new Uci(); await e.init(); });
afterAll(() => e?.quit());
/** même décision que PlayGoal : analyse après la promotion, réponse (imposée ou du moteur), verdict */
async function judge(fen: string, sans: string[], script?: Record<string, string>) {
  const c = new Chess(fen); let promo: any = null;
  for (const s of sans) { const m = c.move(s); if (m.promotion && m.color === new Chess(fen).turn()) promo = m; }
  if (c.isGameOver()) return promotionVerdict(c.isCheckmate() ? 10000 : 0, c, promo, null);
  const r = await e.analyse(c.fen(), { depth: 20 }); const l = r.lines[0];
  const userScore = -(l.mate != null ? (l.mate > 0 ? 10000 : -10000) : l.cp); // l est du point de vue de l'adversaire (au trait)
  const forced = script?.[scriptKey(c.fen())]; const u = forced || r.best;
  const reply = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  return promotionVerdict(userScore, c, promo, reply);
}
const SAAV = ENDGAMES.find((d) => d.id === 'saavedra')!;

describe('Objectif « aller à dame »', () => {
  it('kp-only : 1.d7 Re7 2.d8=D+ ?? Rxd8 est refusé (nulle)', async () => {
    const v = await judge('3k4/8/2KP4/8/8/8/8/8 w - - 0 1', ['d7', 'Ke7', 'd8=Q+']);
    expect(v.ok).toBe(false); if (!v.ok) expect(v.why).toMatch(/prise aussitôt|nulle/);
  }, 60000);
  it('kp-only : la bonne méthode (1.d7 Re7 2.Rc7 ! puis d8=D) est acceptée', async () => {
    const v = await judge('3k4/8/2KP4/8/8/8/8/8 w - - 0 1', ['d7', 'Ke7', 'Kc7', 'Ke6', 'd8=Q']);
    expect(v.ok, JSON.stringify(v)).toBe(true);
  }, 60000);
  it('Saavedra : 6.c8=D ? Tc4+ 7.Dxc4 pat est refusé', async () => {
    const v = await judge(SAAV.fen, ['c7', 'Rd6+', 'Kb5', 'Rd5+', 'Kb4', 'Rd4+', 'Kb3', 'Rd3+', 'Kc2', 'Rd4', 'c8=Q'], SAAV.script);
    expect(v.ok).toBe(false);
  }, 60000);
  it('Saavedra : la défense imposée suit l’étude (…Td6+, …Td5+, …Td4+, …Td3+, …Td4)', () => {
    const c = new Chess(SAAV.fen); const line = ['c7', 'Rd6+', 'Kb5', 'Rd5+', 'Kb4', 'Rd4+', 'Kb3', 'Rd3+', 'Kc2', 'Rd4'];
    for (let i = 0; i < line.length; i++) { if (i % 2) { const u = SAAV.script![scriptKey(c.fen())]; const m = new Chess(c.fen()).move(line[i]); expect(u, line[i]).toBe(m.from + m.to); } c.move(line[i]); }
  });
  it('Saavedra : 6.c8=T !! est accepté', async () => {
    const v = await judge(SAAV.fen, ['c7', 'Rd6+', 'Kb5', 'Rd5+', 'Kb4', 'Rd4+', 'Kb3', 'Rd3+', 'Kc2', 'Rd4', 'c8=R'], SAAV.script);
    expect(v.ok, JSON.stringify(v)).toBe(true);
  }, 60000);
  it('verdicts sans moteur : pat, matériel insuffisant, mat', () => {
    const pat = new Chess('k7/2Q5/1K6/8/8/8/8/8 b - - 0 1'); // pat
    expect(promotionVerdict(0, pat, { san: 'c8=Q', promotion: 'q', color: 'w', to: 'c8' } as any).ok).toBe(false);
    const kk = new Chess('8/8/8/8/8/8/8/k1K5 w - - 0 1');
    const v = promotionVerdict(0, kk, { san: 'd8=Q+', promotion: 'q', color: 'w', to: 'd8' } as any, { san: 'Kxd8', captured: 'q', to: 'd8' } as any);
    expect(v.ok).toBe(false); if (!v.ok) expect(v.why).toMatch(/prise aussitôt/);
    const mate = new Chess('k1Q5/8/1K6/8/8/8/8/8 b - - 0 1');
    expect(promotionVerdict(10000, mate, { san: 'c8=Q#', promotion: 'q', color: 'w', to: 'c8' } as any).ok).toBe(true);
    expect(promotionVerdict(450, new Chess('3k4/8/3K4/8/8/8/8/3Q4 b - - 0 1'), { san: 'd8=Q', promotion: 'q', color: 'w', to: 'd1' } as any).ok).toBe(true);
    expect(promotionVerdict(120, new Chess('3k4/8/3K4/8/8/8/8/3Q4 b - - 0 1'), { san: 'd8=Q', promotion: 'q', color: 'w', to: 'd1' } as any).ok).toBe(false);
  });
  // la règle ne doit pas rendre un exercice impossible : le moteur contre lui-même promeut en gardant le gain
  const drills = [...ENDGAMES.filter((d) => d.goal === 'promote').map((d) => ({ id: d.id, fen: d.fen, max: d.maxMoves, script: d.script })),
    ...[...LESSONS, ...COURSE_LESSONS].flatMap((l) => l.steps.map((s: any, i) => ({ s, i, l }))).filter(({ s }) => s.type === 'exercise' && s.goal.kind === 'play' && s.goal.result === 'promote')
      .map(({ s, i, l }) => ({ id: `${l.id}#${i}`, fen: s.fen, max: s.goal.maxMoves, script: s.goal.script }))];
  it(`au moins 28 finales + leçons « aller à dame » (${drills.length})`, () => expect(drills.length).toBeGreaterThanOrEqual(36));
  // Lignes optimales de la base de finales (tools/build-promo-lines.py, ≤ 7 pièces) : le camp fort gagne
  // dans la limite de coups, et la position après sa promotion (et la réponse de la défense) reste gagnante.
  // Au-delà de 7 pièces : Stockfish contre lui-même. Fin acceptée par l'app : promotion gagnante, mat, ou roi seul.
  // @ts-ignore
  const LINES: Record<string, { fen: string; line: string[]; end: string; afterCategory: string | null; userMoves: number }> = PROMO_LINES;
  const ending = async (d: { fen: string; script?: Record<string, string> }, sans: string[]) => {
    const c = new Chess(d.fen); const me = c.turn(); for (const s of sans) c.move(s);
    if (c.isCheckmate()) return { ok: c.turn() !== me, why: 'mat' };
    if (sans.some((s, i) => i % 2 === 0 && /=/.test(s))) { const k = sans.findIndex((s, i) => i % 2 === 0 && /=/.test(s)); return judge(d.fen, sans.slice(0, k + 1), d.script); }
    return { ok: loneKingWin(c, me), why: 'roi seul' };
  };
  for (const d of drills) it(`${d.id} : le meilleur jeu atteint l’objectif dans la limite de coups, et l’app l’accepte`, async () => {
    let sans: string[]; const L = LINES[d.id];
    if (L) {
      expect(L.fen).toBe(d.fen); sans = L.line;
      // ligne rejouée avec la défense imposée de l'exercice
      const c = new Chess(d.fen); const me = c.turn();
      for (const s of sans) { if (c.turn() !== me && d.script?.[scriptKey(c.fen())]) { const m = new Chess(c.fen()).move(s); expect(d.script[scriptKey(c.fen())], `${d.id} défense ${s}`).toBe(m.from + m.to); } c.move(s); }
      if (L.end === 'promote') expect(L.afterCategory, `${d.id} après la promotion`).toBe('win');
      if (L.end === 'promote') sans = sans.slice(0, sans.findIndex((s, i) => i % 2 === 0 && /=/.test(s)) + 1);
    } else {
      const c = new Chess(d.fen); const me = c.turn(); sans = [];
      for (let k = 0; k < d.max * 2 + 2; k++) {
        const forced = c.turn() !== me ? d.script?.[scriptKey(c.fen())] : undefined;
        const u = forced || (await e.analyse(c.fen(), { depth: 20 })).best;
        const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); sans.push(m.san);
        if ((m.promotion && m.color === me) || c.isGameOver() || (c.turn() === me && loneKingWin(c, me))) break;
      }
    }
    const userMoves = Math.ceil(sans.length / 2);
    expect(userMoves, `${d.id} ${userMoves} coups > ${d.max} : ${sans.join(' ')}`).toBeLessThanOrEqual(d.max);
    const v = await ending(d, sans);
    expect(v.ok, `${d.id} ${sans.join(' ')} ${JSON.stringify(v)}`).toBe(true);
  }, 120000);
});
