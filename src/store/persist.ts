import { createJSONStorage, type PersistOptions, type PersistStorage, type StorageValue } from 'zustand/middleware';
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
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
      clearStorageWriteFailure();
    } catch (error) {
      reportStorageWriteFailure(error);
    }
  },
  removeItem: (name: string) => {
    try {
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
  };
}

export function rehydratePersistedState(state: ScheduleState): void {
  // Verify plans integrity - default to a single blank Plan A if empty
  // or if sanitization filters out every entry (e.g. [null, "bad"]).
  if (!Array.isArray(state.plans) || state.plans.length === 0) {
    state.plans = [
      {
        id: 'plan_1',
        name: 'Plan A',
        courses: [],
      },
    ];
  } else {
    state.plans = sanitizePlans(state.plans);
    if (state.plans.length === 0) {
      state.plans = [
        {
          id: 'plan_1',
          name: 'Plan A',
          courses: [],
        },
      ];
    }
  }

  // Verify activePlanId validity
  if (!state.plans.some((p) => p.id === state.activePlanId)) {
    state.activePlanId = state.plans[0]?.id || 'plan_1';
  }

  // Verify catalog - default to empty array
  if (!Array.isArray(state.catalogCourses)) {
    state.catalogCourses = [];
  } else {
    state.catalogCourses = sanitizeCatalog(state.catalogCourses);
  }

  state.semesterStart = isIsoDate(state.semesterStart) ? state.semesterStart : DEFAULT_SEMESTER_START;
  state.semesterEnd = isIsoDate(state.semesterEnd) ? state.semesterEnd : DEFAULT_SEMESTER_END;

  const preferred = readStoredTheme() ?? (isThemeName(state.theme) ? state.theme : null);
  if (preferred) {
    state.theme = preferred;
    applyDomTheme(preferred);
    persistTheme(preferred);
  }
}

export const persistOptions: PersistOptions<ScheduleState, PersistedSchedule> = {
  name: STORAGE_NAME,
  version: PERSIST_SCHEMA_VERSION,
  storage: createVersionedStorage(),
  partialize,
  migrate: migratePersistedSchedule,
  onRehydrateStorage: () => (state) => {
    if (!state) return;
    rehydratePersistedState(state);
  },
};
