import { DAYS_LIST, type Course } from '../types/schedule';
import { minutesToTime, timeToMinutes } from './timeUtils';

const UNKNOWN_DAY = Number.MAX_SAFE_INTEGER;

export interface PoolGroup {
  key: string;
  code: string;
  courses: Course[];
}

/** Groups sections of the same course code, keeping the pool's first-seen order. */
export function groupPoolCourses(courses: Course[]): PoolGroup[] {
  const groups = new Map<string, PoolGroup>();
  for (const course of courses) {
    const code = course.code.trim().replace(/\s+/g, ' ').toUpperCase();
    // Courses without a code must not collapse into one nameless group.
    const key = code || `ID:${course.id}`;
    const group = groups.get(key);
    if (group) group.courses.push(course);
    else groups.set(key, { key, code: course.code, courses: [course] });
  }
  return [...groups.values()];
}

function clock(time: string): string {
  return minutesToTime(timeToMinutes(time));
}

function range(start: string, end: string): string {
  const a = clock(start);
  const b = clock(end);
  const meridiem = (value: string) => value.slice(-2);
  return meridiem(a) === meridiem(b) ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`;
}

/** One line per distinct time range, e.g. "Mon, Wed 3:30–5:00 PM". */
export function formatSessionLines(sessions: Course['sessions']): string[] {
  const order = new Map(DAYS_LIST.map((day, index) => [day.id, index]));
  const byRange = new Map<string, { days: number[]; label: string }>();
  for (const session of sessions) {
    const label = range(session.startTime, session.endTime);
    const entry = byRange.get(label) ?? { days: [], label };
    const day = order.get(session.day) ?? UNKNOWN_DAY;
    if (!entry.days.includes(day)) entry.days.push(day);
    byRange.set(label, entry);
  }
  return [...byRange.values()].map(({ days, label }) => {
    const names = days.sort((x, y) => x - y).map((day) => DAYS_LIST[day]?.label ?? 'TBA');
    return `${names.join(', ')} ${label}`;
  });
}
