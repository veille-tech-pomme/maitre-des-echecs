import { DEBUTANT } from './debutant';
import { INTERMEDIAIRE } from './intermediaire';
import { AVANCE } from './avance';
import { EXPERT } from './expert';
import type { Lesson, Level } from './types';
export * from './types';
export const LESSONS: Lesson[] = [...DEBUTANT, ...INTERMEDIAIRE, ...AVANCE, ...EXPERT];
export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
export const lessonsOf = (lvl: Level) => LESSONS.filter((l) => l.level === lvl);
