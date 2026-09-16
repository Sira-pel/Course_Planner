import { createJSONStorage, type PersistOptions } from 'zustand/middleware';
import { applyDomTheme, isThemeName, persistTheme, readStoredTheme } from '../utils/theme';
import { sanitizeCatalog, sanitizePlans } from './sanitize';
import type { PersistedSchedule, ScheduleState } from './types';

export const STORAGE_NAME = 'uniplan_schedule_storage_v2' as const;

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
    } catch {
      // Quota / private mode must not throw into React.
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

export function partialize(state: ScheduleState): PersistedSchedule {
  return {
    plans: state.plans,
    activePlanId: state.activePlanId,
    catalogCourses: state.catalogCourses,
    showWeekends: state.showWeekends,
    startHour: state.startHour,
    endHour: state.endHour,
    theme: state.theme,
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

  const preferred = readStoredTheme() ?? (isThemeName(state.theme) ? state.theme : null);
  if (preferred) {
    state.theme = preferred;
    applyDomTheme(preferred);
    persistTheme(preferred);
  }
}

export const persistOptions: PersistOptions<ScheduleState, PersistedSchedule> = {
  name: STORAGE_NAME,
  storage: createJSONStorage(() => safeLocalStorage),
  partialize,
  onRehydrateStorage: () => (state) => {
    if (!state) return;
    rehydratePersistedState(state);
  },
};
