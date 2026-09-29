import type { ClassSession, Course, DayOfWeek, SchedulePlan } from '../types/schedule';

export interface DaySessionItem {
  session: ClassSession;
  course: Course;
  planId: string;
  planName: string;
  isGhost: boolean;
  ghostIndex?: number;
  hasConflict: boolean;
}

export function collectDaySessions(
  day: DayOfWeek,
  activePlan: SchedulePlan | undefined,
  ghostPlans: SchedulePlan[],
  conflictingCourseIds: Set<string>,
  planIndexMap?: Map<string, number>
): DaySessionItem[] {
  const items: DaySessionItem[] = [];

  if (activePlan) {
    for (const course of activePlan.courses) {
      for (const session of course.sessions) {
        if (session.day !== day) continue;
        items.push({
          session,
          course,
          planId: activePlan.id,
          planName: activePlan.name,
          isGhost: false,
          hasConflict: conflictingCourseIds.has(course.id),
        });
      }
    }
  }

  ghostPlans.forEach((ghostPlan, gIdx) => {
    if (activePlan && ghostPlan.id === activePlan.id) return;
    const ghostIndex = planIndexMap ? (planIndexMap.get(ghostPlan.id) ?? gIdx) : gIdx;
    for (const course of ghostPlan.courses) {
      for (const session of course.sessions) {
        if (session.day !== day) continue;
        items.push({
          session,
          course,
          planId: ghostPlan.id,
          planName: ghostPlan.name,
          isGhost: true,
          ghostIndex,
          hasConflict: false,
        });
      }
    }
  });

  return items;
}
