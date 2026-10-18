import { MAX_CANDIDATES } from './generatorPrefs';

/**
 * Clear the courses on screen when they are all picked, or when the candidate
 * cap is already full so "All" cannot select anything else.
 */
export function shouldClearVisiblePicks(
  visibleKeys: readonly string[],
  picked: ReadonlySet<string>,
  maxCandidates = MAX_CANDIDATES,
): boolean {
  if (visibleKeys.length === 0) return false;
  if (visibleKeys.every((key) => picked.has(key))) return true;
  return picked.size >= maxCandidates;
}
