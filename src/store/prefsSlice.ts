import { SAMPLE_CATALOG, SAMPLE_PLANS } from '../data/sampleSemester';
import { applyDomTheme, isThemeName, persistTheme } from '../utils/theme';
import { commitWithHistory } from './history';
import { isIsoDate, PERSIST_SCHEMA_VERSION, resolvePersistedVersion } from './persist';
import { sanitizeCatalog, sanitizePlans, uniquePlanId } from './sanitize';
import type { ScheduleState, StoreGet, StoreSet } from './types';

function clampStartHour(value: number): number {
  return Math.max(5, Math.min(12, value));
}

function clampEndHour(value: number): number {
  return Math.max(16, Math.min(24, value));
}

/**
 * Backup JSON version ladder. Missing `version` is treated as current-1.
 * Add a new `if (from < N)` block when the backup shape breaks.
 */
function migrateBackupPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const from = resolvePersistedVersion(raw.version);
  const next: Record<string, unknown> = { ...raw };
  if (from < 1) {
    // v0 backups only had plans/catalog; prefs and semester dates are optional keys.
  }
  next.version = PERSIST_SCHEMA_VERSION;
  return next;
}

export function createPrefsSlice(set: StoreSet, get: StoreGet): Pick<
  ScheduleState,
  | 'setTheme'
  | 'toggleTheme'
  | 'setShowWeekends'
  | 'setTimeRange'
  | 'setSemesterDates'
  | 'resetToBlank'
  | 'resetToSample'
  | 'importFullState'
> {
  return {
    setTheme: (theme: 'light' | 'dark') => {
      if (!isThemeName(theme)) return;
      applyDomTheme(theme);
      persistTheme(theme);
      if (get().theme === theme) return;
      set({ theme });
    },

    toggleTheme: () => {
      const current = get().theme;
      const next = current === 'dark' ? 'light' : 'dark';
      get().setTheme(next);
    },

    setShowWeekends: (show: boolean) => set({ showWeekends: show }),

    setTimeRange: (startHour: number, endHour: number) => {
      set({ startHour: clampStartHour(startHour), endHour: clampEndHour(endHour) });
    },

    setSemesterDates: (start: string, end: string) => {
      const current = get();
      const semesterStart = isIsoDate(start) ? start : current.semesterStart;
      const semesterEnd = isIsoDate(end) ? end : current.semesterEnd;
      if (semesterStart === current.semesterStart && semesterEnd === current.semesterEnd) return;
      set({ semesterStart, semesterEnd });
    },

    resetToBlank: () => {
      const state = get();
      const newPlanId = uniquePlanId(state.plans.map((p) => p.id));
      commitWithHistory(set, get, {
        plans: [{ id: newPlanId, name: 'Plan A', courses: [] }],
        catalogCourses: [],
        activePlanId: newPlanId,
        ghostPlanIds: [],
      });
    },

    resetToSample: () => {
      commitWithHistory(set, get, {
        plans: SAMPLE_PLANS,
        catalogCourses: SAMPLE_CATALOG,
        activePlanId: 'plan_a',
        ghostPlanIds: [],
      });
    },

    importFullState: (jsonString: string) => {
      try {
        const parsed: unknown = JSON.parse(jsonString);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return { success: false, error: 'Invalid backup file: expected a JSON object' };
        }
        const backup = migrateBackupPayload(parsed as Record<string, unknown>);

        if (!backup.plans || !Array.isArray(backup.plans) || backup.plans.length === 0) {
          return { success: false, error: 'Invalid backup file: missing plans array' };
        }
        const sanitizedPlans = sanitizePlans(backup.plans);
        if (sanitizedPlans.length === 0) {
          return { success: false, error: 'No valid plans found in backup data' };
        }

        const state = get();

        const targetActiveId = sanitizedPlans.some((p) => p.id === backup.activePlanId)
          ? String(backup.activePlanId)
          : sanitizedPlans[0].id;

        // If backup includes catalogCourses (even an empty array), restore it.
        // If the key is missing, keep the current catalog.
        const sanitizedCatalog = Object.prototype.hasOwnProperty.call(backup, 'catalogCourses')
          ? (Array.isArray(backup.catalogCourses) ? sanitizeCatalog(backup.catalogCourses) : [])
          : state.catalogCourses;

        const nextTheme = isThemeName(backup.theme) ? backup.theme : state.theme;
        if (isThemeName(backup.theme)) {
          applyDomTheme(backup.theme);
          persistTheme(backup.theme);
        }

        const startHour = typeof backup.startHour === 'number' && Number.isFinite(backup.startHour)
          ? clampStartHour(backup.startHour)
          : state.startHour;
        const endHour = typeof backup.endHour === 'number' && Number.isFinite(backup.endHour)
          ? clampEndHour(backup.endHour)
          : state.endHour;

        commitWithHistory(set, get, {
          plans: sanitizedPlans,
          activePlanId: targetActiveId,
          catalogCourses: sanitizedCatalog,
          ghostPlanIds: [],
          showWeekends: typeof backup.showWeekends === 'boolean' ? backup.showWeekends : state.showWeekends,
          startHour,
          endHour,
          theme: nextTheme,
          semesterStart: isIsoDate(backup.semesterStart) ? backup.semesterStart : state.semesterStart,
          semesterEnd: isIsoDate(backup.semesterEnd) ? backup.semesterEnd : state.semesterEnd,
        });
        return { success: true };
      } catch (e) {
        return { success: false, error: (e as Error).message || 'Failed to parse JSON backup' };
      }
    },
  };
}
