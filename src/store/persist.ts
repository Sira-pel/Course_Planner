import { createJSONStorage, type PersistOptions, type PersistStorage, type StorageValue } from 'zustand/middleware';
import type { Course, SchedulePlan } from '../types/schedule';
import { courseIdentityKey } from '../utils/courseIdentity';
import { prefixedId } from '../utils/id';
import { applyDomTheme, isThemeName, persistTheme, readStoredTheme } from '../utils/theme';
import { sanitizeCatalog, sanitizePlans } from './sanitize';
import { clearStorageWriteFailure, reportStorageWriteFailure } from './storageWrite';
import type { PersistedSchedule, ScheduleState } from './types';

export const STORAGE_NAME = 'uniplan_schedule_storage_v2' as const;
export const PERSIST_SCHEMA_VERSION = 1;
export const DEFAULT_SEMESTER_START = '2026-09-01';
export const DEFAULT_SEMESTER_END = '2026-12-18';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(year, month - 1, day);
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day;
}

export function resolvePersistedVersion(raw: unknown): number {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) return raw;
  // Blobs with no version are treated as current-1 so existing users migrate in.
  return PERSIST_SCHEMA_VERSION - 1;
}

export function applyMissingPersistVersion<S>(
  value: StorageValue<S> | null
): StorageValue<S> | null {
  if (!value) return null;
  if (typeof value.version === 'number') return value;
  return { state: value.state, version: PERSIST_SCHEMA_VERSION - 1 };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/**
 * Schema migration ladder. `version` is the wrapper/blob version (missing => current-1).
 * Add a new `if (from < N)` block when PERSIST_SCHEMA_VERSION increases.
 */
export function migratePersistedSchedule(persistedState: unknown, version: unknown): PersistedSchedule {
  const from = resolvePersistedVersion(version);
  const next: Record<string, unknown> = { ...asRecord(persistedState) };

  if (from < 1) {
    // v0 -> v1: stamp inner schema version; persist semester window.
    if (!isIsoDate(next.semesterStart)) next.semesterStart = DEFAULT_SEMESTER_START;
    if (!isIsoDate(next.semesterEnd)) next.semesterEnd = DEFAULT_SEMESTER_END;
  }

  next.version = PERSIST_SCHEMA_VERSION;
  return next as unknown as PersistedSchedule;
}

export const safeLocalStorage = {
  getItem: (name: string) => {
    try {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(name, value);
      clearStorageWriteFailure();
    } catch (error) {
      reportStorageWriteFailure(error);
    }
  },
  removeItem: (name: string) => {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

function createVersionedStorage(): PersistStorage<PersistedSchedule, unknown> {
  const base = createJSONStorage<PersistedSchedule>(() => safeLocalStorage);
  if (!base) {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }
  return {
    getItem: (name) => {
      // Zustand only migrates when `version` is a number that differs from current.
      // Older blobs omit version; coerce to current-1 so migrate() runs.
      const value = base.getItem(name);
      if (value instanceof Promise) {
        return value.then(applyMissingPersistVersion);
      }
      return applyMissingPersistVersion(value);
    },
    setItem: base.setItem,
    removeItem: base.removeItem,
  };
}

export function partialize(state: ScheduleState): PersistedSchedule {
  return {
    version: PERSIST_SCHEMA_VERSION,
    plans: state.plans,
    activePlanId: state.activePlanId,
    catalogCourses: state.catalogCourses,
    showWeekends: state.showWeekends,
    startHour: state.startHour,
    endHour: state.endHour,
    theme: state.theme,
    semesterStart: state.semesterStart,
    semesterEnd: state.semesterEnd,
    customShortcuts: state.customShortcuts || {},
  };
}

export function reconcilePersistedState(
  persistedState: unknown,
  currentState?: ScheduleState
): ScheduleState {
  const raw = asRecord(persistedState);

  const customShortcuts =
    typeof raw.customShortcuts === 'object' && raw.customShortcuts !== null && !Array.isArray(raw.customShortcuts)
      ? (raw.customShortcuts as Record<string, string>)
      : currentState?.customShortcuts || {};

  let plans: SchedulePlan[];
  if (!Array.isArray(raw.plans) || raw.plans.length === 0) {
    plans = [
      {
        id: 'plan_1',
        name: 'Plan A',
        courses: [],
      },
    ];
  } else {
    plans = sanitizePlans(raw.plans as any[]);
    if (plans.length === 0) {
      plans = [
        {
          id: 'plan_1',
          name: 'Plan A',
          courses: [],
        },
      ];
    }
  }

  const rawActiveId = typeof raw.activePlanId === 'string' ? raw.activePlanId : '';
  const activePlanId = plans.some((p) => p.id === rawActiveId)
    ? rawActiveId
    : plans[0]?.id || 'plan_1';

  let catalogCourses: Course[] = Array.isArray(raw.catalogCourses)
    ? sanitizeCatalog(raw.catalogCourses)
    : (currentState?.catalogCourses || []);

  const existingCatalogKeys = new Set(
    catalogCourses.map((c) => courseIdentityKey(c.code, c.section))
  );
  const missingCatalogCourses: Course[] = [];
  for (const plan of plans) {
    for (const c of plan.courses || []) {
      if (!c || typeof c !== 'object') continue;
      const key = courseIdentityKey(c.code, c.section);
      if (!existingCatalogKeys.has(key)) {
        existingCatalogKeys.add(key);
        const cId = typeof c.id === 'string' && c.id ? c.id : prefixedId('c');
        missingCatalogCourses.push({
          ...c,
          id: cId.startsWith('cat_') ? cId : `cat_${cId}`,
        });
      }
    }
  }
  if (missingCatalogCourses.length > 0) {
    catalogCourses = [...catalogCourses, ...missingCatalogCourses];
  }

  const semesterStart = isIsoDate(raw.semesterStart)
    ? raw.semesterStart
    : currentState?.semesterStart || DEFAULT_SEMESTER_START;
  const semesterEnd = isIsoDate(raw.semesterEnd)
    ? raw.semesterEnd
    : currentState?.semesterEnd || DEFAULT_SEMESTER_END;

  const showWeekends =
    typeof raw.showWeekends === 'boolean'
      ? raw.showWeekends
      : currentState?.showWeekends ?? false;

  let startHour =
    typeof raw.startHour === 'number' && Number.isFinite(raw.startHour)
      ? Math.max(0, Math.min(23, Math.round(raw.startHour)))
      : currentState?.startHour ?? 7;

  let endHour =
    typeof raw.endHour === 'number' && Number.isFinite(raw.endHour)
      ? Math.max(0, Math.min(24, Math.round(raw.endHour)))
      : currentState?.endHour ?? 17;

  if (startHour >= endHour) {
    startHour = 7;
    endHour = 17;
  }

  const preferredTheme =
    readStoredTheme() ??
    (isThemeName(raw.theme) ? raw.theme : currentState?.theme ?? 'light');

  const baseState = currentState || ({} as ScheduleState);

  return {
    ...baseState,
    plans,
    activePlanId,
    catalogCourses,
    showWeekends,
    startHour,
    endHour,
    theme: preferredTheme,
    semesterStart,
    semesterEnd,
    customShortcuts,
  };
}

export function rehydratePersistedState(state: ScheduleState): void {
  const reconciled = reconcilePersistedState(state, state);
  Object.assign(state, reconciled);
  if (reconciled.theme) {
    applyDomTheme(reconciled.theme);
    persistTheme(reconciled.theme);
  }
}

export const persistOptions: PersistOptions<ScheduleState, PersistedSchedule> = {
  name: STORAGE_NAME,
  version: PERSIST_SCHEMA_VERSION,
  storage: createVersionedStorage(),
  partialize,
  merge: (persistedState, currentState) => reconcilePersistedState(persistedState, currentState),
  migrate: migratePersistedSchedule,
  onRehydrateStorage: () => (state) => {
    if (!state) return;
    const preferred = readStoredTheme() ?? (isThemeName(state.theme) ? state.theme : null);
    if (preferred) {
      applyDomTheme(preferred);
      persistTheme(preferred);
    }
  },
};
