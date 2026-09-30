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
