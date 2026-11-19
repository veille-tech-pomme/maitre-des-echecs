// Fil « Pour toi » : classement par le coach, diversité, fin quotidienne, signaux (passe, abandon, temps).
import { describe, it, expect } from 'vitest';
import { defaultState, pushCoach, type State } from '../src/lib/store';
import { ensureModel } from '../src/coach/curriculum';
import { newItem } from '../src/lib/srs';
import { nextFeedCards, recordFeed, recordDiag, diagPending, feedCandidates, kindFactor, feedToday, tomorrowTeaser, DAILY_CARDS, lessonCardSteps, type FeedCard } from '../src/coach/feed';
import { rawToEvents, evidenceFor, sync } from '../src/coach/model';
import { LESSONS } from '../src/data/lessons';
import masters from '../src/data/feed-master.json';
import threats from '../src/data/feed-threats.json';
import { Chess } from 'chess.js';

const NOW = new Date('2026-11-19T18:00:00').getTime();
/** joueur dont le diagnostic est fait (les tests du fil classique) ; newcomer() : tout nouveau, diagnostic à faire */
function fresh(): State { const s = defaultState(); s.onboarded = true; ensureModel(s).diag = { at: 0, r: 800 }; return s; }
function newcomer(ob?: { ok: boolean; ms: number }): State { const s = defaultState(); s.onboarded = true; s.obMate = ob; ensureModel(s); return s; }
const play = (s: State, c: FeedCard, out: 'ok' | 'fail' | 'skip' | 'abandon' = 'ok', ms = 20000) => recordFeed(s, c, out, ms, false, NOW);

describe('nextFeedCards', () => {
  it('propose des cartes variées issues du coach, sans deux fois le même type d’affilée (hors puzzles)', () => {
    const s = fresh(); const kinds: string[] = [];
    for (let i = 0; i < DAILY_CARDS; i++) { const [c] = nextFeedCards(s, s.coach!, 1, NOW); expect(c).toBeTruthy(); kinds.push(c.kind); play(s, c); }
    expect(new Set(kinds).size).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < kinds.length; i++) if (kinds[i] !== 'puzzle') expect(kinds[i]).not.toBe(kinds[i - 1]);
    expect(kinds).toContain('master'); expect(kinds).toContain('threat'); expect(kinds).toContain('lesson');
  });
  it('le programme du jour a une fin', () => {
    const s = fresh();
    for (let i = 0; i < DAILY_CARDS; i++) play(s, nextFeedCards(s, s.coach!, 1, NOW)[0]);
    expect(nextFeedCards(s, s.coach!, 2, NOW)).toEqual([]);
    expect(nextFeedCards(s, s.coach!, 2, NOW + 86400000).length).toBe(2); // le lendemain, nouveau programme
  });
  it('les cartes préchargées (pending) comptent dans la diversité et le quota', () => {
    const s = fresh(); const [a, b] = nextFeedCards(s, s.coach!, 2, NOW); const [b2] = nextFeedCards(s, s.coach!, 1, NOW, [a]);
    expect(b2.id).toBe(b.id);
  });
  it('mini-leçon préchargée : la carte suivante de la même leçon passe à l’étape d’après', () => {
    const s = fresh(); const ls = feedCandidates(s, s.coach!, NOW).find((c) => c.kind === 'lesson')!;
    const after = feedCandidates(s, s.coach!, NOW, [ls]).find((c) => c.kind === 'lesson')!;
    expect(+after.ref!.split(':')[1]).toBeGreaterThan(+ls.ref!.split(':')[1]);
  });
  it('les erreurs dues de tes parties passent en tête', () => {
    const s = fresh(); const m = s.coach!;
    m.mistakes['m:g1:12'] = { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', sol: ['f1b5'], motif: 'fork', prompt: 'Tu laisses une fourchette', at: NOW - 86400000 };
    s.srs['m:g1:12'] = { ...newItem('m:g1:12', 'mistake', NOW - 86400000), due: NOW - 1000 };
    const [c] = nextFeedCards(s, m, 1, NOW);
    expect(c.kind).toBe('mistake'); expect(c.ref).toBe('m:g1:12'); expect(c.skill).toBe('fork');
    play(s, c); expect(nextFeedCards(s, m, 3, NOW).some((x) => x.ref === 'm:g1:12')).toBe(false); // une fois par jour
  });
  it('la faiblesse prioritaire du modèle remonte dans le fil', () => {
    const s = fresh();
    for (let i = 0; i < 14; i++) pushCoach(s, { k: 'puzzle', t: NOW - i * 1000, id: 'x' + i, r: 900, th: ['fork'], ok: false, plies: 3 });
    for (let i = 0; i < 14; i++) pushCoach(s, { k: 'puzzle', t: NOW - i * 1000, id: 'y' + i, r: 1000, th: ['pin'], ok: true, plies: 3 });
    ensureModel(s);
    const pz = feedCandidates(s, s.coach!, NOW).filter((c) => c.kind === 'puzzle').sort((a, b) => b.gain - a.gain);
    expect(pz[0].skill).toBe('fork');
  });
});
describe('signaux du fil', () => {
  it('passer = signal négatif : le type de carte souvent passé recule', () => {
    const s = fresh(); const f0 = kindFactor(feedToday(s, NOW), 'master');
    const master = feedCandidates(s, s.coach!, NOW).find((c) => c.kind === 'master')!;
    for (let i = 0; i < 4; i++) play(s, master, 'skip', 5000);
    expect(kindFactor(feedToday(s, NOW), 'master')).toBeLessThan(f0 * 0.75);
  });
  it('passe et abandon deviennent des observations faibles ; geste réflexe < 2 s ignoré ; réussite de puzzle déjà comptée', () => {
    expect(rawToEvents({ k: 'feed', t: 1, id: 'a', card: 'threat', sk: 'vigilance', d: 900, out: 'skip', ms: 8000 })).toEqual([expect.objectContaining({ skill: 'vigilance', s: 0, w: 0.2, ref: 'fs:a' })]);
    expect(rawToEvents({ k: 'feed', t: 1, id: 'a', card: 'threat', sk: 'vigilance', d: 900, out: 'abandon', ms: 30000 })[0].w).toBe(0.3);
    expect(rawToEvents({ k: 'feed', t: 1, id: 'a', card: 'threat', sk: 'vigilance', d: 900, out: 'skip', ms: 900 })).toEqual([]);
    expect(rawToEvents({ k: 'feed', t: 1, id: 'a', card: 'puzzle', sk: 'fork', d: 900, out: 'ok', ms: 9000, counted: true })).toEqual([]);
    const slow = rawToEvents({ k: 'feed', t: 1, id: 'a', card: 'master', sk: 'calculation', d: 1200, out: 'ok', ms: 50000 });
    expect(slow[0].s).toBe(0.8);
  });
  it('les passes ne comptent pas comme des puzzles ratés dans les preuves', () => {
    const s = fresh();
    for (let i = 0; i < 5; i++) pushCoach(s, { k: 'feed', t: NOW + i, id: 't' + i, card: 'threat', sk: 'vigilance', d: 900, out: 'skip', ms: 6000 });
    sync(s.coach!, s.coachQ);
    expect(evidenceFor(s.coach!, 'vigilance').lines.join(' ')).not.toMatch(/réussite/);
  });
  it('un abandon ne consomme pas la carte du jour', () => {
    const s = fresh(); const [c] = nextFeedCards(s, s.coach!, 1, NOW); play(s, c, 'abandon', 30000);
    expect(feedToday(s, NOW).served.length).toBe(0); expect(feedToday(s, NOW).kinds[c.kind].ab).toBe(1);
  });
  it('écran de fin : ce que le coach garde pour demain', () => {
    const s = fresh(); s.srs['p:abc'] = { ...newItem('p:abc', 'puzzle', NOW), due: NOW + 3600000 };
    expect(tomorrowTeaser(s, s.coach!, NOW)).toMatch(/^Demain, je te garde 1 de tes erreurs/);
  });
});
describe('contenu des cartes', () => {
  it('mini-leçons : exercices courts dans toutes les leçons débutant et ≥ 75 % du parcours (finales contre le moteur exclues)', () => {
    const none = LESSONS.filter((l) => lessonCardSteps(l).length === 0);
    expect(none.filter((l) => l.level === 'debutant')).toEqual([]);
    expect(none.length).toBeLessThanOrEqual(LESSONS.length * 0.25);
  });
  it('coups du maître : coup légal, au trait, issu d’une partie réelle', () => {
    expect(masters.length).toBeGreaterThan(300);
    for (const x of masters as any[]) { const c = new Chess(x.f); const m = c.move({ from: x.m.slice(0, 2), to: x.m.slice(2, 4), promotion: x.m[4] }); expect(m.san).toBe(x.san); }
  });
  it('menaces : la menace et les deux leurres sont des coups légaux distincts de l’adversaire', () => {
    expect(threats.length).toBeGreaterThan(300);
    for (const x of threats as any[]) {
      const p = x.f.split(' '); p[1] = p[1] === 'w' ? 'b' : 'w'; p[3] = '-'; const nul = new Chess(p.join(' '));
      const legal = new Set(nul.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion || '')));
      expect(legal.has(x.t)).toBe(true); for (const d of x.d) { expect(legal.has(d)).toBe(true); expect(d).not.toBe(x.t); }
    }
  });
});

describe('diagnostic unique dans le fil (R2)', () => {
  const answer = (s: State, ok: boolean) => { const [c] = nextFeedCards(s, s.coach!, 1, NOW); expect(c.kind).toBe('diag'); const r = recordDiag(s, { id: 'x' + c.id, r: c.d, th: [c.theme!], ok, ms: 15000, plies: 1 }, NOW); recordFeed(s, c, ok ? 'ok' : 'fail', 15000, true, NOW); return { c, r }; };
  it('les 4 premières cartes sont le test, adaptatif, puis le fil classique', () => {
    const s = newcomer({ ok: true, ms: 4000 });
    const a = answer(s, true); expect(a.r).toBeNull();
    expect(nextFeedCards(s, s.coach!, 1, NOW, [a.c])).toEqual([]); // pas de préchargement d'une carte adaptative
    const b = answer(s, true); expect(b.c.d).toBeGreaterThan(a.c.d); // réussite → plus difficile
    const c = answer(s, false); expect(c.c.d).toBeGreaterThan(a.c.d);
    const d = answer(s, false); expect(d.r).not.toBeNull();
    expect(s.coach!.diag!.r).toBe(d.r!.rating); expect(s.puzzle.rating).toBe(d.r!.rating);
    expect(s.placement!.items.length).toBe(5); expect(s.placement!.items[0].id).toBe('ob:berger'); // le premier mat de l'accueil compte
    expect(diagPending(s, s.coach!)).toBe(false); expect(nextFeedCards(s, s.coach!, 1, NOW)[0].kind).not.toBe('diag');
    expect(s.coach!.ev.filter((e) => e.src === 'diag').length).toBeGreaterThan(0); // nourrit Glicko par compétence
  });
  it('un échec complet donne un départ bas, une réussite complète ouvre le parcours avancé', () => {
    const lo = newcomer({ ok: false, ms: 30000 }); for (let i = 0; i < 4; i++) answer(lo, false);
    const hi = newcomer({ ok: true, ms: 3000 }); for (let i = 0; i < 4; i++) answer(hi, true);
    expect(lo.coach!.diag!.r).toBeLessThan(800); expect(hi.coach!.diag!.r).toBeGreaterThan(1300);
    expect(lo.lessons['unlock-intermediaire']).toBeUndefined(); expect(hi.lessons['unlock-intermediaire']).toBeTruthy();
  });
  it('pas de diagnostic pour un joueur déjà classé', () => {
    const s = newcomer(); s.puzzle.games = 30; s.puzzle.rating = 1400;
    expect(nextFeedCards(s, s.coach!, 1, NOW)[0].kind).not.toBe('diag');
  });
  it('les cartes du test comptent dans le programme du jour mais pas deux fois dans le modèle', () => {
    const s = newcomer(); answer(s, true);
    const ev = rawToEvents({ k: 'feed', t: NOW, id: 'dg:0', card: 'diag', sk: null, d: 900, out: 'fail', ms: 9000, counted: true } as any);
    expect(ev).toEqual([]); expect(feedToday(s, NOW).served.length).toBe(1);
  });
});
