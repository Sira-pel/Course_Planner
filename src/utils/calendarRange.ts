import { Course, DAYS_LIST, DayOfWeek } from '../types/schedule';
import { timeToMinutes } from './timeUtils';

export interface HourRange {
  startHour: number;
  endHour: number;
}

/**
 * Visible hours for auto mode. 30 minutes of padding, at least six hours,
 * extended earlier before later. Empty schedules return null.
 * 10:00–14:15 becomes 9–15.
 */
export function computeAutoFitRange(courses: Course[]): HourRange | null {
  let minStart = Infinity;
  let maxEnd = -Infinity;

  for (const course of courses) {
    for (const session of course.sessions || []) {
      const start = timeToMinutes(session.startTime);
      const end = timeToMinutes(session.endTime);
      if (start >= 0 && end > start) {
        minStart = Math.min(minStart, start);
        maxEnd = Math.max(maxEnd, end);
      }
    }
  }

  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) return null;

  let startHour = Math.floor((minStart - 30) / 60);
  let endHour = Math.ceil((maxEnd + 30) / 60);
  startHour = Math.max(0, Math.min(23, startHour));
  endHour = Math.max(1, Math.min(24, endHour));
  if (endHour <= startHour) endHour = Math.min(24, startHour + 1);

  const span = endHour - startHour;
  if (span < 6) {
    const deficit = 6 - span;
    const earlier = Math.min(deficit, startHour);
    startHour -= earlier;
    endHour = Math.min(24, endHour + (deficit - earlier));
  }

  return { startHour, endHour };
}

export function coursesForVisibleRange(active: Course[] | undefined, ghosts: { courses: Course[] }[]): Course[] {
  const courses = [...(active || [])];
  for (const plan of ghosts) courses.push(...(plan.courses || []));
  return courses;
}

/** Week start only reorders the calendar. Weekends hidden stays Monday–Friday. */
export function calendarDayOrder(
  showWeekends: boolean,
  weekStart: 'monday' | 'sunday'
): { id: DayOfWeek; short: string; label: string; full: string }[] {
  if (!showWeekends) {
    return DAYS_LIST.filter((day) => day.id !== 'saturday' && day.id !== 'sunday');
  }
  if (weekStart === 'sunday') {
    const sunday = DAYS_LIST.find((day) => day.id === 'sunday');
    const rest = DAYS_LIST.filter((day) => day.id !== 'sunday');
    return sunday ? [sunday, ...rest] : DAYS_LIST;
  }
  return DAYS_LIST;
}
