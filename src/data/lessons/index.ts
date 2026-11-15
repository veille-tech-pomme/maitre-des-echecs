import { DEBUTANT } from './debutant';
import { INTERMEDIAIRE } from './intermediaire';
import { AVANCE } from './avance';
import { EXPERT } from './expert';
import type { Lesson, Level } from './types';
export * from './types';
export const LESSONS: Lesson[] = [...DEBUTANT, ...INTERMEDIAIRE, ...AVANCE, ...EXPERT];
export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
export const lessonsOf = (lvl: Level) => LESSONS.filter((l) => l.level === lvl);
/** Cours thématiques (≈ 140 leçons), chargés à la demande pour garder un démarrage rapide. */
let coursesP: Promise<typeof import('./courses')> | null = null;
export const loadCourses = () => (coursesP ||= import('./courses'));
let courseCache: Lesson[] | null = null;

export async function findLesson(id: string): Promise<Lesson | undefined> {
  const l = lessonById(id); if (l) return l;
  const m = await loadCourses(); courseCache = m.COURSE_LESSONS; return courseCache.find((x) => x.id === id);
}
export const cachedCourseLesson = (id: string) => courseCache?.find((x) => x.id === id);
