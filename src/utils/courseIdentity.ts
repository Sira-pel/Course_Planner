export function courseIdentityKey(code: string, section?: string): string {
  const normCode = (code || '').trim().replace(/\s+/g, ' ').toUpperCase();
  const normSec = (section || '').trim().toUpperCase();
  return `${normCode}__${normSec}`;
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
