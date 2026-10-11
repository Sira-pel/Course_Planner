import type { DayOfWeek } from '../types/schedule';
import { DAYS_LIST } from '../types/schedule';

/**
 * Generator preferences live under their own storage key so the schedule
 * store shape stays unchanged.
 */
export const GENERATOR_PREFS_KEY = 'uniplan_generator_prefs';

export type GapLimit = 30 | 60 | 120;

export interface StoredGeneratorPrefs {
  mode: 'courses' | 'credits';
  courseCount: number;
  creditTarget: number;
  gapsEnabled: boolean;
  gapLimit: GapLimit;
  lunchEnabled: boolean;
  lunchStart: string;
  lunchEnd: string;
  daysOff: DayOfWeek[];
  classStart: string | null;
  classEnd: string | null;
}

export const DEFAULT_GENERATOR_PREFS: StoredGeneratorPrefs = {
  mode: 'courses',
  courseCount: 5,
  creditTarget: 15,
  gapsEnabled: true,
  gapLimit: 60,
  lunchEnabled: true,
  lunchStart: '11:30',
  lunchEnd: '13:30',
  daysOff: [],
  classStart: null,
  classEnd: null,
};

const DAY_IDS = new Set<string>(DAYS_LIST.map((day) => day.id));
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function isGapLimit(value: unknown): value is GapLimit {
  return value === 30 || value === 60 || value === 120;
}

function clock(value: unknown, fallback: string): string {
  return typeof value === 'string' && HHMM.test(value) ? value : fallback;
}

function optionalClock(value: unknown): string | null {
  if (value == null || value === '') return null;
  return typeof value === 'string' && HHMM.test(value) ? value : null;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function sanitizeGeneratorPrefs(raw: unknown): StoredGeneratorPrefs {
  const record = typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? raw as Partial<StoredGeneratorPrefs>
    : {};
  const daysOff = Array.isArray(record.daysOff)
    ? record.daysOff.filter((day): day is DayOfWeek => typeof day === 'string' && DAY_IDS.has(day))
    : [];

  return {
    mode: record.mode === 'credits' ? 'credits' : 'courses',
    courseCount: clampInt(record.courseCount, 2, 12, DEFAULT_GENERATOR_PREFS.courseCount),
    creditTarget: clampInt(record.creditTarget, 1, 40, DEFAULT_GENERATOR_PREFS.creditTarget),
    gapsEnabled: typeof record.gapsEnabled === 'boolean' ? record.gapsEnabled : DEFAULT_GENERATOR_PREFS.gapsEnabled,
    gapLimit: isGapLimit(record.gapLimit) ? record.gapLimit : DEFAULT_GENERATOR_PREFS.gapLimit,
    lunchEnabled: typeof record.lunchEnabled === 'boolean' ? record.lunchEnabled : DEFAULT_GENERATOR_PREFS.lunchEnabled,
    lunchStart: clock(record.lunchStart, DEFAULT_GENERATOR_PREFS.lunchStart),
    lunchEnd: clock(record.lunchEnd, DEFAULT_GENERATOR_PREFS.lunchEnd),
    daysOff: [...new Set(daysOff)],
    classStart: optionalClock(record.classStart),
    classEnd: optionalClock(record.classEnd),
  };
}

export function loadGeneratorPrefs(): StoredGeneratorPrefs {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_GENERATOR_PREFS };
    const raw = localStorage.getItem(GENERATOR_PREFS_KEY);
    if (!raw) return { ...DEFAULT_GENERATOR_PREFS };
    return sanitizeGeneratorPrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_GENERATOR_PREFS };
  }
}

export function saveGeneratorPrefs(prefs: StoredGeneratorPrefs): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(GENERATOR_PREFS_KEY, JSON.stringify(sanitizeGeneratorPrefs(prefs)));
  } catch {
    // Preference persistence is optional. The generator still runs in memory.
  }
}
