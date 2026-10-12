import type { DayOfWeek } from '../types/schedule';
import {
  courseCodeKey,
  MAX_RESULTS,
  type GeneratedPlan,
  type GeneratorResult,
  type GeneratorSearch,
} from './planGenerator';

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
  /** How many plans were on screen. Reopening keeps this instead of dropping to 5. */
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

/**
 * Fresh results replace the list. Search deeper keeps plans already on screen,
 * except when a gap-limit fallback is replaced by plans that actually fit.
 */
export function mergeSearchResults(
  previous: GeneratorResult | null,
  next: GeneratorResult,
  shownCount: number,
  revealNew: boolean,
): { plans: GeneratedPlan[]; shownCount: number } {
  const leftFallback = Boolean(previous?.gapNotice) && next.gapNotice == null;
  if (!revealNew || !previous || leftFallback) {
    const count = leftFallback ? Math.min(MAX_RESULTS, next.plans.length) : shownCount;
    return { plans: next.plans, shownCount: count };
  }
  return mergeDeeperPlans(previous.plans, shownCount, next.plans);
}

export function nextShownCount(shown: number, total: number): number {
  if (total <= shown) return shown;
  return Math.min(total, shown + MAX_RESULTS);
}

function comparePlans(a: { score: number; id: string }, b: { score: number; id: string }): number {
  return a.score - b.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Keep plans already on screen. A better section mix of a shown group is added
 * beside it, in best-fit order, and does not replace it.
 */
export function mergeDeeperPlans(
  previous: GeneratedPlan[] | undefined,
  shown: number,
  next: GeneratedPlan[],
): { plans: GeneratedPlan[]; shownCount: number } {
  if (!previous || previous.length === 0) {
    return { plans: next, shownCount: shown };
  }
  const visible = Math.min(Math.max(shown, 0), previous.length);
  const frozen = previous.slice(0, visible);
  const frozenIds = new Set(frozen.map((plan) => plan.id));
  const previousIds = new Set(previous.map((plan) => plan.id));
  const newcomers = next.filter((plan) => !previousIds.has(plan.id)).sort(comparePlans);
  const hidden = next.filter((plan) => !frozenIds.has(plan.id) && previousIds.has(plan.id));

  const onScreen: GeneratedPlan[] = [];
  let added = 0;
  for (const plan of frozen) {
    while (added < newcomers.length && comparePlans(newcomers[added], plan) < 0) {
      onScreen.push(newcomers[added]);
      added += 1;
    }
    onScreen.push(plan);
  }
  const tail = [...newcomers.slice(added), ...hidden].sort(comparePlans);
  const plans = [...onScreen, ...tail];
  const shownCount = shown >= previous.length ? plans.length : onScreen.length;
  return { plans, shownCount };
}
