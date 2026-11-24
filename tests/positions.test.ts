/// <reference types="node" />
// Légalité de TOUTES les positions de l'application : leçons (parcours + cours), exercices, finales, puzzles
// (base intégrée + packs), cartes du fil (menaces, coups du maître), parties de maîtres, accueil, ouvertures.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { Chess } from 'chess.js';
import { positionIssues } from '../src/lib/legal';
import { LESSONS } from '../src/data/lessons';
import { COURSE_LESSONS } from '../src/data/lessons/courses';
import * as TEXTS from '../src/data/lessons/course-texts';
import { ENDGAMES } from '../src/data/endgames';
import { OPENINGS } from '../src/data/openings';
import { OPENINGS_EXTRA } from '../src/data/openings-extra';
import { BOTS } from '../src/data/bots';
import { PUZZLE_PATHS } from '../src/data/puzzle-paths';
import { MATE_FEN, MATE } from '../src/data/onboarding';
import puzzles from '../src/data/puzzles.json';
import threats from '../src/data/feed-threats.json';
import master from '../src/data/feed-master.json';
import masters from '../src/data/masters.json';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN_RE = /^([1-8pnbrqkPNBRQK]{1,8}\/){7}[1-8pnbrqkPNBRQK]{1,8} [wb](\s|$)/;
/** toutes les chaînes FEN d'une structure de données, avec leur chemin */
function walk(x: any, path: string, out: [string, string][], seen = new Set<any>()) {
  if (typeof x === 'string') { if (FEN_RE.test(x)) out.push([path, x]); return; }
  if (!x || typeof x !== 'object' || seen.has(x)) return; seen.add(x);
  for (const [k, v] of Object.entries(x)) walk(v, path + '.' + k, out, seen);
}
const bad = (list: [string, string][]) => list.map(([p, f]) => [p, f, positionIssues(f)]).filter((r) => r[2]).map((r) => r.join(' · '));

describe('Légalité des positions', () => {
  it('le vérificateur détecte les positions illégales de l’audit', () => {
    expect(positionIssues('7k/8/6K1/8/8/8/8/Q7 w - - 0 1')).toMatch(/échec/);
    expect(positionIssues('6k1/8/5K2/8/8/8/8/6Q1 w - - 0 1')).toMatch(/échec/);
    expect(positionIssues('7k/8/6K1/8/8/8/Q7/8 w - - 0 1')).toBeNull();
    expect(positionIssues('6k1/Q7/5K2/8/8/8/8/8 w - - 0 1')).toBeNull();
    expect(positionIssues('4k3/8/8/8/8/8/8/4K2P w - - 0 1')).toMatch(/pawn|pion/);
    expect(positionIssues('4k3/8/8/8/8/8/8/K3K3 w - - 0 1')).toBeTruthy();
    expect(positionIssues('4k3/8/8/8/8/8/8/4K3 w K - 0 1')).toMatch(/roque/);
    expect(positionIssues('4k3/8/8/8/4P3/8/8/4K3 b - e3 0 1')).toBeNull();
    expect(positionIssues('4k3/8/8/8/8/8/8/4K3 b - e3 0 1')).toMatch(/passant/);
    expect(positionIssues(START)).toBeNull();
  });
  it('leçons et cours : positions de départ, après les pré-coups, et toutes les FEN du contenu', () => {
    const errs: string[] = []; let diagrams = 0; const diagFens = new Set<string>();
    for (const l of [...LESSONS, ...COURSE_LESSONS]) l.steps.forEach((s: any, i) => {
      if (s.type === 'puzzles') return;
      // schémas sans rois : seulement dans les leçons de règles du Débutant, pour une pièce seule ou l'échiquier vide
      const diagram = l.id.startsWith('d-') && (s.type === 'text' || ['select', 'quiz', 'stars'].includes(s.goal?.kind)) && !s.goal?.verify;
      const fen = s.fen || START; const why = positionIssues(fen, { diagram }); if (diagram && !why && !(/K/.test(fen.split(' ')[0]) && /k/.test(fen.split(' ')[0]))) { diagrams++; diagFens.add(fen); return; } if (why) { errs.push(`${l.id}#${i} ${fen} · ${why}`); return; }
      const ch = new Chess(fen); for (const m of s.pre || []) ch.move(m);
      const w2 = positionIssues(ch.fen()); if (w2) errs.push(`${l.id}#${i} après pré-coups ${ch.fen()} · ${w2}`);
    });
    const all: [string, string][] = []; walk([LESSONS, COURSE_LESSONS], 'leçons', all); walk(TEXTS, 'textes', all);
    errs.push(...bad(all.filter(([, f]) => !diagFens.has(f))));
    expect(errs, errs.join('\n')).toEqual([]);
    expect(diagrams).toBeLessThan(20);
    expect(all.length).toBeGreaterThan(300);
  });
  it('finales, ouvertures, bots, parcours de puzzles, accueil', () => {
    const all: [string, string][] = []; walk(ENDGAMES, 'finales', all); walk([OPENINGS, OPENINGS_EXTRA], 'ouvertures', all); walk(BOTS, 'bots', all); walk(PUZZLE_PATHS, 'parcours', all);
    all.push(['accueil', MATE_FEN]);
    expect(bad(all)).toEqual([]);
    expect(ENDGAMES.every((e) => all.some(([, f]) => f === e.fen))).toBe(true);
    const c = new Chess(MATE_FEN); c.move({ from: MATE.slice(0, 2), to: MATE.slice(2, 4) }); expect(c.isCheckmate()).toBe(true);
  });
  it('cartes du fil : menaces et coups du maître', () => {
    const all: [string, string][] = []; walk(threats, 'menaces', all); walk(master, 'maître', all);
    expect(bad(all)).toEqual([]); expect(all.length).toBeGreaterThanOrEqual((threats as any[]).length + (master as any[]).length);
  });
  it('parties de maîtres : toutes les positions sont atteintes par des coups légaux', () => {
    for (const g of masters as any[]) { const c = new Chess(); for (const m of g.m.split(' ')) expect(c.move(m), `${g.w} - ${g.b} ${m}`).toBeTruthy(); }
  });
  it('puzzles intégrés : position et position après le coup adverse', () => {
    const errs: string[] = [];
    for (const p of puzzles as any[]) {
      const w = positionIssues(p.f); if (w) { errs.push(`${p.i} ${w}`); continue; }
      const c = new Chess(p.f); for (const u of p.m.split(' ')) if (!c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })) { errs.push(`${p.i} coup illégal ${u}`); break; }
    }
    expect(errs).toEqual([]);
  });
  it('packs de puzzles (cœur + plus) : chaque position est légale', () => {
    const errs: string[] = []; let n = 0;
    for (const tier of ['core', 'plus']) {
      const dir = `public/packs/${tier}`; if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.gz'))) {
        const txt = zlib.gunzipSync(fs.readFileSync(`${dir}/${f}`)).toString('utf8');
        for (const line of txt.split('\n')) { if (!line) continue; const [id, fen] = line.split('|') as [string, string]; n++; const w = positionIssues(fen + ' 0 1'); if (w) errs.push(`${tier}/${f} ${id} ${w}`); }
      }
    }
    expect(errs.slice(0, 20)).toEqual([]); expect(n).toBeGreaterThan(300000);
  }, 300000);
});
