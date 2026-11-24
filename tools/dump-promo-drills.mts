// Liste des exercices « aller à dame » (finales + leçons) pour tools/build-promo-lines.py
import { ENDGAMES } from '../src/data/endgames';
import { LESSONS } from '../src/data/lessons';
import { COURSE_LESSONS } from '../src/data/lessons/courses';
import { writeFileSync } from 'node:fs';
const out = [...ENDGAMES.filter((d) => d.goal === 'promote').map((d) => ({ id: d.id, fen: d.fen, max: d.maxMoves, script: d.script || null })),
  ...[...LESSONS, ...COURSE_LESSONS].flatMap((l) => l.steps.map((s: any, i) => ({ s, i, l }))).filter(({ s }) => s.type === 'exercise' && s.goal.kind === 'play' && s.goal.result === 'promote')
    .map(({ s, i, l }) => ({ id: `${l.id}#${i}`, fen: s.fen, max: s.goal.maxMoves, script: s.goal.script || null }))];
writeFileSync('/tmp/promo-drills.json', JSON.stringify(out)); console.log(out.length);
