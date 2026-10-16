import { SAMPLE_CATALOG, SAMPLE_PLANS } from '../data/sampleSemester';
import type { Course } from '../types/schedule';
import { BACKUP_READ_ERROR, loadBackup } from '../utils/backupRestore';
import { courseIdentityKey } from '../utils/courseIdentity';
import { applyDomTheme, isThemeName, isThemePreference, persistTheme, resolveTheme, type ThemePreference } from '../utils/theme';
import { commitWithHistory } from './history';
import { isIsoDate } from './persist';
import { uniquePlanId } from './sanitize';
import type { ScheduleState, StoreGet, StoreSet } from './types';

function clampStartHour(value: number): number {
  return Math.max(5, Math.min(12, value));
}

function clampEndHour(value: number): number {
  return Math.max(16, Math.min(24, value));
}

export function createPrefsSlice(set: StoreSet, get: StoreGet): Pick<
  ScheduleState,
  | 'setCustomShortcut'
  | 'resetCustomShortcuts'
  | 'setThemePreference'
  | 'commitTheme'
  | 'setShowWeekends'
  | 'setTimeRange'
  | 'setTimeRangeMode'
  | 'setWeekStart'
  | 'setMobileCalendarView'
  | 'setSemesterDates'
  | 'resetToBlank'
  | 'resetToSample'
  | 'importFullState'
> {
  return {
    setCustomShortcut: (actionId: string, shortcut: string) => {
      const trimmed = shortcut.trim();
      const current = get().customShortcuts || {};
      if (!trimmed) {
        const next = { ...current };
        delete next[actionId];
        set({ customShortcuts: next });
        return;
      }
      set({ customShortcuts: { ...current, [actionId]: trimmed } });
    },

    resetCustomShortcuts: () => {
      set({ customShortcuts: {} });
    },

    setThemePreference: (preference: ThemePreference) => {
      if (!isThemePreference(preference)) return;
      const theme = resolveTheme(preference);
      applyDomTheme(theme);
      persistTheme(preference);
      if (get().theme === theme && get().themePreference === preference) return;
      set({ theme, themePreference: preference });
    },

    commitTheme: (theme: 'light' | 'dark') => {
      if (!isThemeName(theme)) return;
      if (get().theme === theme) return;
      set({ theme });
    },

    setShowWeekends: (show: boolean) => set({ showWeekends: show }),

    setTimeRange: (startHour: number, endHour: number) => {
      set({
        startHour: clampStartHour(startHour),
        endHour: clampEndHour(endHour),
        timeRangeMode: 'custom',
      });
    },

    setTimeRangeMode: (mode: 'auto' | 'custom') => {
      if (mode !== 'auto' && mode !== 'custom') return;
      if (get().timeRangeMode === mode) return;
      set({ timeRangeMode: mode });
    },

    setWeekStart: (weekStart: 'monday' | 'sunday') => {
      if (weekStart !== 'monday' && weekStart !== 'sunday') return;
      if (get().weekStart === weekStart) return;
      set({ weekStart });
    },

    setMobileCalendarView: (view: 'week' | 'day') => {
      if (view !== 'week' && view !== 'day') return;
      if (get().mobileCalendarView === view) return;
      set({ mobileCalendarView: view });
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
      const loaded = loadBackup(jsonString);
      if (loaded.ok === false) return { success: false, error: loaded.error };
      const backup = loaded.backup.raw;
      const sanitizedPlans = loaded.backup.plans;
      const targetActiveId = loaded.backup.activePlanId;
      try {
        const state = get();

        // If backup includes catalogCourses (even an empty array), restore it.
        // If the key is missing, keep the current catalog.
        const baseCatalog = loaded.backup.catalogCourses ?? state.catalogCourses;

        // Ensure all plan courses are in catalog
        const catKeys = new Set(baseCatalog.map((c) => courseIdentityKey(c.code, c.section)));
        const missingFromCat: Course[] = [];
        for (const p of sanitizedPlans) {
          for (const c of p.courses) {
            const k = courseIdentityKey(c.code, c.section);
            if (!catKeys.has(k)) {
              catKeys.add(k);
              missingFromCat.push({
                ...c,
                id: c.id.startsWith('cat_') ? c.id : `cat_${c.id}`,
              });
            }
          }
        }
        const sanitizedCatalog = [...baseCatalog, ...missingFromCat];

        let nextTheme = state.theme;
        let nextPreference = state.themePreference;
        if (isThemePreference(backup.themePreference)) {
          // Keep "system" as the preference. Only the applied theme is resolved.
          nextPreference = backup.themePreference;
          nextTheme = resolveTheme(nextPreference);
          applyDomTheme(nextTheme);
          persistTheme(nextPreference);
        } else if (isThemeName(backup.theme)) {
          nextTheme = backup.theme;
          nextPreference = backup.theme;
          applyDomTheme(backup.theme);
          persistTheme(backup.theme);
        }

        const hoursPresent = typeof backup.startHour === 'number' || typeof backup.endHour === 'number';
        const startHour = typeof backup.startHour === 'number' && Number.isFinite(backup.startHour)
          ? clampStartHour(backup.startHour)
          : state.startHour;
        const endHour = typeof backup.endHour === 'number' && Number.isFinite(backup.endHour)
          ? clampEndHour(backup.endHour)
          : state.endHour;
        const timeRangeMode = backup.timeRangeMode === 'auto' || backup.timeRangeMode === 'custom'
          ? backup.timeRangeMode
          : hoursPresent
            ? (startHour === 7 && endHour === 17 ? 'auto' : 'custom')
            : state.timeRangeMode;
        const weekStart = backup.weekStart === 'monday' || backup.weekStart === 'sunday'
          ? backup.weekStart
          : state.weekStart;
        const mobileCalendarView = backup.mobileCalendarView === 'week' || backup.mobileCalendarView === 'day'
          ? backup.mobileCalendarView
          : state.mobileCalendarView;

        commitWithHistory(set, get, {
          plans: sanitizedPlans,
          activePlanId: targetActiveId,
          catalogCourses: sanitizedCatalog,
          ghostPlanIds: [],
          showWeekends: typeof backup.showWeekends === 'boolean' ? backup.showWeekends : state.showWeekends,
          startHour,
          endHour,
          timeRangeMode,
          weekStart,
          mobileCalendarView,
          theme: nextTheme,
          themePreference: nextPreference,
          semesterStart: isIsoDate(backup.semesterStart) ? backup.semesterStart : state.semesterStart,
          semesterEnd: isIsoDate(backup.semesterEnd) ? backup.semesterEnd : state.semesterEnd,
        }, { includeSettings: true });
        return { success: true };
      } catch {
        return { success: false, error: BACKUP_READ_ERROR };
      }
    },
  };
}
