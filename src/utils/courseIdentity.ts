export function courseIdentityKey(code: string, section?: string): string {
  return `${code.trim().toUpperCase()}__${(section || '').trim().toUpperCase()}`;
}

export function sameCourseIdentity(
  a: { code: string; section?: string },
  b: { code: string; section?: string }
): boolean {
  return courseIdentityKey(a.code, a.section) === courseIdentityKey(b.code, b.section);
}
