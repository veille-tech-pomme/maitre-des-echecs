// Cours thématiques (chargés à la demande) : mats célèbres, motifs tactiques, ouvertures, stratégie, finales, parties célèbres.
import type { Lesson, Step, Level } from './types';
import DATA from './course-data.json';
import { MATE_TEXTS, HAND_MATES, TACTIC_TEXTS, ENDGAME_THEME_TEXTS, STRATEGY } from './course-texts';
import { OPENINGS } from '../openings';
import { ENDGAMES } from '../endgames';
import { Chess } from 'chess.js';

export interface Course { id: string; title: string; icon: string; desc: string; premium?: boolean; lessons: Lesson[] }
type Ex = { id: string; fen: string; pre: string[]; line: string[]; r: number };
const EX = (DATA as any).examples as Record<string, Ex[]>;
const sideAfter = (e: Ex) => { const c = new Chess(e.fen); c.move(e.pre[0]); return c.turn() === 'w' ? 'white' : 'black'; };
const exStep = (e: Ex, title: string, tip?: string): Step => ({ type: 'exercise', title, prompt: `${sideAfter(e) === 'white' ? 'Les Blancs' : 'Les Noirs'} jouent et gagnent (puzzle ${e.r}).`, fen: e.fen, pre: e.pre, orientation: sideAfter(e) as any, goal: { kind: 'line', moves: e.line }, hints: tip ? [tip] : undefined, success: 'Bravo !' });
const demoStep = (e: Ex, title: string, body: string): Step => ({ type: 'demo', title, body, fen: e.fen, pre: e.pre, moves: e.line, orientation: sideAfter(e) as any, comments: { [e.line.length - 1]: e.line.length > 1 ? 'Et voilà le schéma !' : 'Le coup gagnant.' } });
function themeLesson(course: string, theme: string, t: { title: string; icon: string; body: string; tip: string; level: string }, opts: { min?: number; max?: number } = {}): Lesson | null {
  const ex = EX[theme] || []; if (ex.length < 2) return null;
  const steps: Step[] = [
    { type: 'text', title: t.title, body: t.body },
    demoStep(ex[0], 'Exemple', 'Regarde la combinaison se dérouler, coup par coup.'),
    ...ex.slice(1, 4).map((e, k) => exStep(e, `À toi ! (${k + 1}/${Math.min(3, ex.length - 1)})`, t.tip)),
    { type: 'puzzles', title: 'Entraînement', body: 'Cinq puzzles réels sur ce motif.', themes: [theme], count: 5, minRating: opts.min ?? 400, maxRating: opts.max ?? (t.level === 'intermediaire' ? 1500 : t.level === 'avance' ? 1900 : 2300) },
  ];
  return { id: `${course}-${theme}`, level: t.level as Level, title: t.title, icon: t.icon, minutes: 8, summary: t.body.split('\n')[0].replace(/\*\*/g, '').slice(0, 90) + '…', steps, course };
}
const nn = <T,>(a: (T | null)[]) => a.filter(Boolean) as T[];
// — Mats célèbres —
const mates: Lesson[] = [
  ...HAND_MATES.map((h): Lesson => ({ id: `mats-${h.id}`, level: h.level, title: h.title, icon: h.icon, minutes: 4, summary: h.body.slice(0, 90) + '…', course: 'mats',
    steps: h.line ? [{ type: 'text', title: h.title, body: h.body }, { type: 'demo', title: 'Le piège', body: 'Observe le piège jusqu’au mat.', moves: h.line.split(' '), comments: { 8: 'Cxe5 !? La dame est en prise…', 9: '…et les Noirs la prennent : erreur fatale !', 12: 'Mat avec trois pièces mineures.' } }, { type: 'exercise', title: 'À toi', prompt: 'Les Noirs viennent de prendre la dame. Donne le mat en 2 !', pre: h.line.split(' ').slice(0, 10), goal: { kind: 'line', moves: h.line.split(' ').slice(10) }, hints: [h.tip] }]
      : [{ type: 'text', title: h.title, body: h.body, fen: h.fen }, { type: 'exercise', title: 'À toi', prompt: 'Les Blancs matent en un coup.', fen: h.fen, goal: { kind: 'any', accept: h.accept! }, hints: [h.tip] }] })),
  ...nn(Object.entries(MATE_TEXTS).map(([k, t]) => themeLesson('mats', k, t))),
];
const tactics = nn(Object.entries(TACTIC_TEXTS).map(([k, t]) => themeLesson('tactique', k, t)));
// — Ouvertures —
const openings: Lesson[] = OPENINGS.map((o) => {
  const steps: Step[] = [{ type: 'text', title: o.name, body: `${o.summary}\n\n**Idées clés :**\n${o.ideas.map((i) => '• ' + i).join('\n')}` }];
  for (const l of o.lines) steps.push({ type: 'demo', title: l.name, body: 'Suis la ligne et lis les commentaires.', moves: l.moves.split(' '), comments: l.notes, orientation: o.side === 'w' ? 'white' : 'black' });
  const l0 = o.lines[0]; const ms = l0.moves.split(' ');
  // exercice : l'élève rejoue les coups de son camp
  const pre = o.side === 'b' ? [ms[0]] : []; const rest = o.side === 'b' ? ms.slice(1) : ms;
  steps.push({ type: 'exercise', title: 'Rejoue la ligne', prompt: `Joue les coups des ${o.side === 'w' ? 'Blancs' : 'Noirs'} de la ligne « ${l0.name} ».`, pre, goal: { kind: 'line', moves: rest.slice(0, rest.length % 2 ? rest.length : rest.length - 1) }, orientation: o.side === 'w' ? 'white' : 'black', hints: ['Repense aux commentaires de la démonstration.'] });
  const lvl: Level = ['italienne', 'londres', 'ecossaise', 'carokann', 'francaise', 'scandinave', 'gambitdame', 'espagnole', 'sicilienne', 'colle', 'viennoise', 'philidor'].includes(o.id) ? 'intermediaire' : 'avance';
  return { id: `ouv-${o.id}`, level: lvl, title: o.name, icon: o.side === 'w' ? '⚪' : '⚫', minutes: 5 + o.lines.length * 2, summary: o.summary.slice(0, 90) + (o.summary.length > 90 ? '…' : ''), steps, course: 'ouvertures' };
});
// — Stratégie —
const strategy: Lesson[] = STRATEGY.map((s) => ({ id: `strat-${s.id}`, level: s.level, title: s.title, icon: s.icon, minutes: 6, course: 'strategie', summary: s.steps[0].body.slice(0, 90) + '…',
  steps: [...s.steps.map((x): Step => ({ type: 'text', title: x.title, body: x.body, fen: x.fen, shapes: x.shapes })),
    ...(s.quiz ? [{ type: 'exercise', title: 'Question', prompt: s.quiz.q, fen: s.quiz.fen, goal: { kind: 'quiz', options: s.quiz.options, answer: s.quiz.answer } } as Step] : []),
    { type: 'puzzles', title: 'Mise en pratique', body: 'Des positions réelles où ce thème est décisif.', themes: s.themes, count: 5, minRating: 800, maxRating: s.level === 'expert' ? 2300 : 1900 }] }));
// — Finales —
const endgames: Lesson[] = [
  ...['Mats élémentaires', 'Finales de pions', 'Finales de tours', 'Pièces mineures', 'Dame', 'Études'].map((cat, k): Lesson => {
    const list = ENDGAMES.filter((e) => e.cat === cat && !e.series).slice(0, 4);
    return { id: `fin-${k}`, level: k < 2 ? 'intermediaire' : k < 5 ? 'avance' : 'expert', title: `Théorie : ${cat.toLowerCase()}`, icon: list[0]?.icon || '♔', minutes: 10, course: 'finales', summary: list.map((e) => e.title).join(', ').slice(0, 90),
      steps: list.flatMap((e): Step[] => [{ type: 'text', title: e.title, body: `${e.desc}\n\n💡 ${e.tip}`, fen: e.fen, orientation: e.fen.split(' ')[1] === 'w' ? 'white' : 'black' }, { type: 'exercise', title: `À toi : ${e.title}`, prompt: e.goal === 'mate' ? `Mate en ${e.maxMoves} coups maximum contre le moteur.` : e.goal === 'promote' ? 'Va à dame contre le moteur, en gardant une position gagnante.' : `Tiens ${e.maxMoves} coups sans perdre.`, fen: e.fen, orientation: e.fen.split(' ')[1] === 'w' ? 'white' : 'black', goal: { kind: 'play', result: e.goal, maxMoves: e.maxMoves, script: e.script } }]) };
  }),
  ...nn(Object.entries(ENDGAME_THEME_TEXTS).map(([k, t]) => themeLesson('finales', k, t))),
];
// — Parties célèbres —
const famous: Lesson[] = ((DATA as any).famous as any[]).map((g) => {
  const year = (g.date || '').slice(0, 4);
  const comments: Record<number, string> = {}; g.comments.slice(0, g.keyIdx).forEach((c: string, i: number) => (comments[i] = c));
  const kEnd = g.keyIdx + g.keyLen; const blackKey = g.keyIdx % 2 === 1;
  const steps: Step[] = [
    { type: 'text', title: g.title, body: `**${g.white} – ${g.black}**, ${g.event || ''} ${year} (${g.result.replace('1/2-1/2', '½-½')})\n\n${g.intro}` },
    { type: 'demo', title: 'La partie commentée', body: 'Avance coup par coup : chaque coup est commenté, les moments clés sont en gras.', moves: g.sans.slice(0, g.keyIdx), comments },
    { type: 'exercise', title: 'Trouve le coup !', prompt: g.keyPrompt, pre: g.sans.slice(0, g.keyIdx), orientation: blackKey ? 'black' : 'white', goal: g.keyLen === 1 ? { kind: 'any', accept: [g.sans[g.keyIdx]] } : { kind: 'line', moves: g.sans.slice(g.keyIdx, kEnd) }, hints: ['Pense aux coups forcés : échecs, prises, menaces.'] },
    { type: 'demo', title: 'La fin de la partie', body: 'Découvre la suite et la conclusion.', pre: g.sans.slice(0, g.keyIdx), moves: g.sans.slice(g.keyIdx), comments: Object.fromEntries(g.comments.slice(g.keyIdx).map((c: string, i: number) => [i, c])), orientation: blackKey ? 'black' : 'white' },
    { type: 'text', title: 'Ce qu’il faut retenir', body: g.takeaways.map((t: string) => '• ' + t).join('\n') },
  ];
  return { id: `partie-${g.id}`, level: 'expert', title: g.title, icon: g.icon, minutes: 15, summary: `${g.white.split(',')[0]} – ${g.black.split(',')[0]}, ${year}`, steps, course: 'parties' };
});
export const COURSES: Course[] = [
  { id: 'mats', title: 'Mats célèbres', icon: '♚', desc: `${mates.length} schémas de mat à connaître par cœur : couloir, étouffé, Anastasia, Boden, Morphy…`, lessons: mates },
  { id: 'tactique', title: 'Motifs tactiques', icon: '⚔️', desc: `${tactics.length} motifs, de la fourchette au coup tranquille, avec des positions de vraies parties.`, lessons: tactics },
  { id: 'ouvertures', title: 'Ouvertures', icon: '📖', desc: `${openings.length} ouvertures expliquées ligne par ligne, avec exercice de mémorisation.`, lessons: openings },
  { id: 'strategie', title: 'Stratégie du milieu de jeu', icon: '🧠', desc: 'Centre, structures, avant-postes, colonnes, plans et prophylaxie.', lessons: strategy },
  { id: 'finales', title: 'Théorie des finales', icon: '♔', desc: 'Les finales théoriques jouées contre le moteur, plus les finales tactiques.', lessons: endgames },
  { id: 'parties', title: 'Parties célèbres', icon: '🏛️', desc: `${famous.length} chefs-d’œuvre commentés coup par coup, de Morphy à Carlsen.`, premium: true, lessons: famous },
];
export const COURSE_LESSONS: Lesson[] = COURSES.flatMap((c) => c.lessons);
