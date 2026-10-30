/** Shown on the welcome card. loadDemo.test.ts keeps these in step with sampleSemester.ts. */
export const DEMO_COURSE_COUNT = 11;
export const DEMO_PLAN_COUNT = 3;

/** Load demo replaces every plan and the course pool, so confirm when there is something to lose. */
export function shouldConfirmLoadDemo(
  plans: { courses: unknown[] }[],
  catalogCount: number
): boolean {
  if (catalogCount > 0) return true;
  if (plans.some((plan) => plan.courses.length > 0)) return true;
  if (plans.length > 1) return true;
  return false;
}
