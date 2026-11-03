export function courseIdentityKey(code: string, section?: string): string {
  const normCode = (code || '').trim().replace(/\s+/g, ' ').toUpperCase();
  const normSec = (section || '').trim().toUpperCase();
  return `${normCode}__${normSec}`;
}

/**
 * Identifies a plan by what a student sees: each course's code, credits, instructor and meeting times.
 * Sections that match on all of these count as the same plan, whatever their ids or section numbers.
 */
export function planSignature(courses: {
  code: string;
  credits?: number;
  instructor?: string;
  sessions?: { day: string; startTime: string; endTime: string }[];
}[]): string {
  return courses
    .map((course) => {
      const code = (course.code || '').trim().replace(/\s+/g, ' ').toUpperCase();
      const credits = typeof course.credits === 'number' && Number.isFinite(course.credits) ? course.credits : 0;
      const instructor = (course.instructor || '').trim().replace(/\s+/g, ' ').toLowerCase();
      const meetings = (course.sessions || [])
        .map((session) => `${session.day}@${session.startTime}-${session.endTime}`)
        .sort()
        .join(',');
      return `${code}:${credits}:${instructor}:${meetings}`;
    })
    .sort()
    .join('|');
}

export function sameCourseIdentity(
  a: { code: string; section?: string },
  b: { code: string; section?: string }
): boolean {
  return courseIdentityKey(a.code, a.section) === courseIdentityKey(b.code, b.section);
}

function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Title to show. Empty names stay empty, and legacy generated titles
 * (`${code} Lecture` / `${code} Course`) are hidden without rewriting stored data.
 */
export function displayCourseTitle(course: { code?: string; name?: string }): string {
  const name = (course.name || '').trim().replace(/\s+/g, ' ');
  if (!name) return '';
  const code = (course.code || '').trim().replace(/\s+/g, ' ');
  if (!code) return name;
  const normalized = normalizeTitle(name);
  const codeNorm = normalizeTitle(code);
  if (normalized === `${codeNorm} lecture` || normalized === `${codeNorm} course`) return '';
  return name;
}
