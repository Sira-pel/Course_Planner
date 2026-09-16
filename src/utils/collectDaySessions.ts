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
  conflictingCourseIds: Set<string>
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
    for (const course of ghostPlan.courses) {
      for (const session of course.sessions) {
        if (session.day !== day) continue;
        items.push({
          session,
          course,
          planId: ghostPlan.id,
          planName: ghostPlan.name,
          isGhost: true,
          ghostIndex: gIdx,
          hasConflict: false,
        });
      }
    }
  });

  return items;
}
