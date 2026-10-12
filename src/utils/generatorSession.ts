import type { DayOfWeek } from '../types/schedule';
import { courseCodeKey, MAX_RESULTS, type GeneratorResult, type GeneratorSearch } from './planGenerator';

export interface RememberedBlock {
  id: string;
  day: DayOfWeek;
  start: string;
  end: string;
}

/** Catalog fields that change a generated mix. Color is left out. */
export interface StampedCourse {
  id: string;
  code: string;
  name?: string;
  section?: string;
  instructor?: string;
  credits?: number;
  sessions?: { day: string; startTime: string; endTime: string; room?: string }[];
}

/** What Generate should still know after the dialog closes. */
export interface GeneratorSession {
  step: 1 | 2 | 3;
  picked: string[];
  pinned: string[];
  lockedIds: string[];
  excludedIds: string[];
  blocked: RememberedBlock[];
  result: GeneratorResult | null;
  previewId: string | null;
  /** How many ranked groups were on screen. Reopening keeps this instead of dropping to 5. */
  shownCount: number;
  /** Picked sections at generation time. A mismatch means the result is outdated. */
  courseStamp: string | null;
  outdated: boolean;
}

let current: GeneratorSession | null = null;
let activeSearch: GeneratorSearch | null = null;

export function readGeneratorSession(): GeneratorSession | null {
  return current;
}

export function writeGeneratorSession(session: GeneratorSession): void {
  current = session;
}

export function readGeneratorSearch(): GeneratorSearch | null {
  return activeSearch;
}

export function holdGeneratorSearch(search: GeneratorSearch | null): void {
  activeSearch = search;
}

/** Step 3 with no finished result is an in-progress search, so it must not reopen on the spinner. */
export function persistedGeneratorStep(step: 1 | 2 | 3, result: GeneratorResult | null): 1 | 2 | 3 {
  if (step === 3 && !result) return 2;
  return step;
}

export function reopenGeneratorStep(session: GeneratorSession | null): 1 | 2 | 3 {
  if (!session) return 1;
  return persistedGeneratorStep(session.step, session.result);
}

export function stampPickedCourses(courses: StampedCourse[], pickedKeys: string[]): string {
  const keys = new Set(pickedKeys);
  return courses
    .filter((course) => keys.has(courseCodeKey(course.code)))
    .map((course) => {
      const meetings = (course.sessions ?? [])
        .map((session) => `${session.day}@${session.startTime}-${session.endTime}@${session.room ?? ''}`)
        .sort()
        .join(',');
      return [
        course.id,
        courseCodeKey(course.code),
        (course.section ?? '').trim().toUpperCase(),
        (course.name ?? '').trim(),
        (course.instructor ?? '').trim(),
        String(course.credits ?? 0),
        meetings,
      ].join('#');
    })
    .sort()
    .join('\n');
}

/** Mark a stored result when a picked course was edited or deleted. Matching data clears the mark. */
export function withCourseFreshness(session: GeneratorSession, courses: StampedCourse[]): GeneratorSession {
  if (!session.result || session.courseStamp == null) return session;
  const outdated = stampPickedCourses(courses, session.picked) !== session.courseStamp;
  if (outdated === session.outdated) return session;
  return { ...session, outdated };
}

export function nextShownCount(shown: number, total: number): number {
  if (total <= shown) return shown;
  return Math.min(total, shown + MAX_RESULTS);
}

/**
 * When every current group is already on screen, keep those plans and make room
 * for new ones. A first result stays on the first page.
 */
export function shownCountAfterSearch(shown: number, previousTotal: number, nextTotal: number): number {
  if (previousTotal > 0 && shown >= previousTotal) return Math.max(shown, nextTotal);
  return shown;
}

export function retainPreviewId(
  previous: { id: string; groupKey: string }[] | undefined,
  next: { id: string; groupKey: string }[],
  previewId: string | null,
): string | null {
  if (!previewId) return null;
  if (next.some((plan) => plan.id === previewId)) return previewId;
  const previousPlan = previous?.find((plan) => plan.id === previewId);
  if (!previousPlan) return previewId;
  return next.find((plan) => plan.groupKey === previousPlan.groupKey)?.id ?? previewId;
}
