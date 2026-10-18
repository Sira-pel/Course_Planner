import { MAX_CANDIDATES } from './generatorPrefs';

/**
 * Show the clear bin only when a visible course is picked and either every
 * visible course is picked or the candidate cap is already full.
 */
export function shouldClearVisiblePicks(
  visibleKeys: readonly string[],
  picked: ReadonlySet<string>,
  maxCandidates = MAX_CANDIDATES,
): boolean {
  if (!visibleKeys.some((key) => picked.has(key))) return false;
  if (visibleKeys.every((key) => picked.has(key))) return true;
  return picked.size >= maxCandidates;
}

/** "All" stays disabled when the list is empty or the cap is full and nothing visible can be added. */
export function isAllControlDisabled(
  visibleKeys: readonly string[],
  picked: ReadonlySet<string>,
  maxCandidates = MAX_CANDIDATES,
): boolean {
  if (shouldClearVisiblePicks(visibleKeys, picked, maxCandidates)) return false;
  if (visibleKeys.length === 0) return true;
  return picked.size >= maxCandidates;
}
