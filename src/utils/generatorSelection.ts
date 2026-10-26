import { MAX_CANDIDATES } from './generatorPrefs';

export interface GeneratorSelection {
  picked: string[];
  pinned: string[];
  pickedCount: number;
  pinnedCount: number;
  courseMin: number;
  courseMax: number;
  atCap: boolean;
}

/**
 * Drop picked and pinned keys whose courses are gone from the pool.
 * Counts, the candidate cap, and the course min/max use only courses that remain.
 */
export function liveGeneratorSelection(
  picked: Iterable<string>,
  pinned: Iterable<string>,
  poolKeys: ReadonlySet<string>,
  maxCandidates = MAX_CANDIDATES,
): GeneratorSelection {
  const livePicked = keepPoolKeys(picked, poolKeys);
  const livePinned = keepPoolKeys(pinned, poolKeys);
  const pickedCount = livePicked.length;
  const pinnedCount = livePinned.length;
  const courseMin = Math.max(2, pinnedCount);
  const courseMax = Math.max(courseMin, pickedCount);
  return {
    picked: livePicked,
    pinned: livePinned,
    pickedCount,
    pinnedCount,
    courseMin,
    courseMax,
    atCap: pickedCount >= maxCandidates,
  };
}

/**
 * Same as liveGeneratorSelection, but an empty pool means the courses have not loaded
 * yet, so saved picks are kept as they are instead of being erased.
 */
export function settledGeneratorSelection(
  picked: Iterable<string>,
  pinned: Iterable<string>,
  poolKeys: ReadonlySet<string>,
  maxCandidates = MAX_CANDIDATES,
): GeneratorSelection {
  if (poolKeys.size > 0) return liveGeneratorSelection(picked, pinned, poolKeys, maxCandidates);
  const keptPicked = [...picked];
  const keptPinned = [...pinned];
  return liveGeneratorSelection(keptPicked, keptPinned, new Set([...keptPicked, ...keptPinned]), maxCandidates);
}

function keepPoolKeys(keys: Iterable<string>, poolKeys: ReadonlySet<string>): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const key of keys) {
    if (!poolKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    kept.push(key);
  }
  return kept;
}
