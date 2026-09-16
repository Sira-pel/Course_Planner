import { SAMPLE_CATALOG, SAMPLE_PLANS } from '../data/sampleSemester';
import { applyDomTheme, isThemeName, persistTheme } from '../utils/theme';
import { commitWithHistory } from './history';
import { sanitizeCatalog, sanitizePlans, uniquePlanId } from './sanitize';
import type { ScheduleState, StoreGet, StoreSet } from './types';

export function createPrefsSlice(set: StoreSet, get: StoreGet): Pick<
  ScheduleState,
  'setTheme' | 'toggleTheme' | 'setShowWeekends' | 'setTimeRange' | 'resetToBlank' | 'resetToSample' | 'importFullState'
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
      set({ startHour: Math.max(5, Math.min(12, startHour)), endHour: Math.max(16, Math.min(24, endHour)) });
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
        const parsed = JSON.parse(jsonString);
        if (!parsed.plans || !Array.isArray(parsed.plans) || parsed.plans.length === 0) {
          return { success: false, error: 'Invalid backup file: missing plans array' };
        }
        const sanitizedPlans = sanitizePlans(parsed.plans);
        if (sanitizedPlans.length === 0) {
          return { success: false, error: 'No valid plans found in backup data' };
        }

        const state = get();

        const targetActiveId = sanitizedPlans.some(p => p.id === parsed.activePlanId)
          ? parsed.activePlanId
          : sanitizedPlans[0].id;

        const sanitizedCatalog = Array.isArray(parsed.catalogCourses)
          ? sanitizeCatalog(parsed.catalogCourses)
          : state.catalogCourses;

        commitWithHistory(set, get, {
          plans: sanitizedPlans,
          activePlanId: targetActiveId,
          catalogCourses: sanitizedCatalog,
          ghostPlanIds: [],
        });
        return { success: true };
      } catch (e) {
        return { success: false, error: (e as Error).message || 'Failed to parse JSON backup' };
      }
    },
  };
}
