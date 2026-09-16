import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClassSession, Course, DayOfWeek, SchedulePlan } from '../types/schedule';
import { collectDaySessions } from './collectDaySessions';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function session(id: string, day: DayOfWeek, startTime = '09:00', endTime = '10:00'): ClassSession {
  return { id, day, startTime, endTime };
}

function course(id: string, sessions: ClassSession[]): Course {
  return { id, code: id.toUpperCase(), name: id, credits: 3, color: '#3B82F6', sessions };
}

function plan(id: string, name: string, courses: Course[]): SchedulePlan {
  return { id, name, courses };
}

const activeCourse = course('cs101', [
  session('s1', 'monday'),
  session('s2', 'wednesday'),
]);
const conflictCourse = course('cs102', [session('s3', 'monday', '09:30', '10:30')]);
const activePlan = plan('plan_a', 'Plan A', [activeCourse, conflictCourse]);

const ghostCourse = course('hist200', [session('g1', 'monday'), session('g2', 'friday')]);
const ghostPlan = plan('plan_b', 'Plan B', [ghostCourse]);
const otherGhostCourse = course('math300', [session('g3', 'monday')]);
const otherGhostPlan = plan('plan_c', 'Plan C', [otherGhostCourse]);

const conflictingCourseIds = new Set(['cs102']);

const monday = collectDaySessions('monday', activePlan, [ghostPlan, otherGhostPlan], conflictingCourseIds);

assert(monday.length === 4, `monday collects active + ghosts, got ${monday.length}`);

const activeItems = monday.filter((item) => item.planId === activePlan.id);
assert(activeItems.length === 2, 'active plan monday sessions are collected');
assert(
  activeItems.every((item) => item.isGhost === false && item.ghostIndex === undefined),
  'active plan items are not ghosts'
);
assert(activeItems.every((item) => item.planName === 'Plan A'), 'active items keep plan name');

const flagged = activeItems.find((item) => item.course.id === 'cs102');
const unflagged = activeItems.find((item) => item.course.id === 'cs101');
assert(flagged?.hasConflict === true, 'active conflicts are flagged');
assert(unflagged?.hasConflict === false, 'non-conflicting active course is not flagged');

const ghostItems = monday.filter((item) => item.isGhost);
assert(ghostItems.length === 2, 'ghost monday sessions are collected');
assert(
  ghostItems.every((item) => item.isGhost === true && item.hasConflict === false),
  'ghosts are marked isGhost and never inherit active conflicts'
);
assert(ghostItems.find((item) => item.planId === 'plan_b')?.ghostIndex === 0, 'first ghost keeps index 0');
assert(ghostItems.find((item) => item.planId === 'plan_c')?.ghostIndex === 1, 'second ghost keeps index 1');

const wednesday = collectDaySessions('wednesday', activePlan, [ghostPlan], conflictingCourseIds);
assert(wednesday.length === 1, 'other-day sessions are excluded');
assert(wednesday[0].session.id === 's2', 'wednesday keeps the matching active session');
assert(wednesday[0].isGhost === false, 'wednesday active session is not a ghost');

const degenerate = collectDaySessions(
  'monday',
  activePlan,
  [activePlan, ghostPlan],
  conflictingCourseIds
);
assert(
  degenerate.every((item) => item.planId !== activePlan.id || item.isGhost === false),
  'active plan is not also a ghost even if listed in ghostPlans'
);
assert(
  degenerate.filter((item) => item.planId === activePlan.id && item.isGhost).length === 0,
  'no ghost copy of the active plan is emitted'
);
assert(
  degenerate.filter((item) => item.planId === ghostPlan.id && item.isGhost).length === 1,
  'real ghosts still collected when active is mixed into ghostPlans'
);

const noActive = collectDaySessions('monday', undefined, [ghostPlan], conflictingCourseIds);
assert(noActive.length === 1 && noActive[0].isGhost, 'undefined active plan still collects ghosts');

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'collectDaySessions.ts'), 'utf8');
assert(!src.includes('computeDayLayout'), 'collectDaySessions does not call computeDayLayout');

console.log('collectDaySessions tests passed');
