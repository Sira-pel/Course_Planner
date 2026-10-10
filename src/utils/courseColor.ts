import { COURSE_COLORS, LEGACY_COURSE_COLOR_MAP } from '../types/schedule';

/** Palette hex for a stored color, including older shades that map onto the current set. */
export function normalizeCourseColor(color: string | undefined | null): string {
  const raw = (color || '').trim().toLowerCase();
  if (!raw) return '';
  return (LEGACY_COURSE_COLOR_MAP[raw] || raw).toLowerCase();
}

/**
 * First palette color that is not already taken.
 * When every palette color is in use, continue from `fallbackIndex` so a batch still cycles.
 */
export function nextUnusedCourseColor(usedColors: Iterable<string>, fallbackIndex = 0): string {
  const used = new Set<string>();
  for (const color of usedColors) {
    const normalized = normalizeCourseColor(color);
    if (normalized) used.add(normalized);
  }

  for (const color of COURSE_COLORS) {
    if (!used.has(color.toLowerCase())) return color;
  }

  const count = COURSE_COLORS.length;
  const idx = ((fallbackIndex % count) + count) % count;
  return COURSE_COLORS[idx];
}

/**
 * Keep each course color when it is still free. Replace a missing or already used color
 * with the next free palette color. Checks `usedColors` and earlier courses in this list.
 */
export function withUnusedCourseColors<T extends { color: string }>(
  courses: readonly T[],
  usedColors: Iterable<string>
): T[] {
  const used = [...usedColors];
  let fallbackIndex = used.length;
  return courses.map((course) => {
    const normalized = normalizeCourseColor(course.color);
    const taken = normalized !== '' && used.some((color) => normalizeCourseColor(color) === normalized);
    if (normalized && !taken) {
      used.push(course.color);
      fallbackIndex += 1;
      return course;
    }
    const color = nextUnusedCourseColor(used, fallbackIndex);
    used.push(color);
    fallbackIndex += 1;
    return { ...course, color };
  });
}
