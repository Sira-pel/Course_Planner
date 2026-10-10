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
