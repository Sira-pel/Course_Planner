import { applyDomTheme, persistTheme, resolveTheme } from '../utils/theme';
import type { HistorySnapshot, ScheduleState, SettingsSnapshot, StoreGet, StoreSet } from './types';

export const MAX_HISTORY = 25;

export function createHistorySnapshot(
  state: {
    plans: HistorySnapshot['plans'];
    catalogCourses: HistorySnapshot['catalogCourses'];
    activePlanId: string;
    ghostPlanIds: string[];
  },
  settings?: SettingsSnapshot,
): HistorySnapshot {
  return {
    plans: state.plans,
    catalogCourses: state.catalogCourses,
    activePlanId: state.activePlanId,
    ghostPlanIds: state.ghostPlanIds,
    ...(settings ? { settings } : {}),
  };
}

export function pickSettings(state: ScheduleState): SettingsSnapshot {
  return {
    showWeekends: state.showWeekends,
    startHour: state.startHour,
    endHour: state.endHour,
    timeRangeMode: state.timeRangeMode,
    weekStart: state.weekStart,
    mobileCalendarView: state.mobileCalendarView,
    theme: state.theme,
    themePreference: state.themePreference,
    semesterStart: state.semesterStart,
    semesterEnd: state.semesterEnd,
  };
}

/** State patch for a saved settings snapshot. Also puts the page theme and its storage key back. */
function restoreSettings(settings: SettingsSnapshot): SettingsSnapshot {
  // A "system" preference follows the OS as it is now, not as it was when saved.
  const theme = resolveTheme(settings.themePreference);
  applyDomTheme(theme);
  persistTheme(settings.themePreference);
  return { ...settings, theme };
}

export function restoreViewFromSnapshot(snapshot: HistorySnapshot): { activePlanId: string; ghostPlanIds: string[] } {
  const planIds = new Set(snapshot.plans.map((p) => p.id));
  const activePlanId = planIds.has(snapshot.activePlanId)
    ? snapshot.activePlanId
    : snapshot.plans[0]?.id || 'plan_1';
  const ghostPlanIds = (snapshot.ghostPlanIds ?? []).filter((id) => planIds.has(id) && id !== activePlanId);
  return { activePlanId, ghostPlanIds };
}

export function commitWithHistory(
  set: StoreSet,
  get: StoreGet,
  patch: Partial<ScheduleState> | ((state: ScheduleState) => Partial<ScheduleState>),
  options: { includeSettings?: boolean } = {},
): void {
  const state = get();
  const snapshot = createHistorySnapshot(state, options.includeSettings ? pickSettings(state) : undefined);
  const resolved = typeof patch === 'function' ? patch(state) : patch;
  set({
    past: [snapshot, ...state.past].slice(0, MAX_HISTORY),
    future: [],
    ...resolved,
  });
}

export function createHistorySlice(set: StoreSet, get: StoreGet): Pick<
  ScheduleState,
  'undo' | 'redo' | 'canUndo' | 'canRedo'
> {
  return {
    undo: () => {
      const state = get();
      if (state.past.length === 0) return;

      const previous = state.past[0];
      const newPast = state.past.slice(1);
      // When the step being undone changed settings, keep today's settings for Redo.
      const currentSnapshot = createHistorySnapshot(
        state,
        previous.settings ? pickSettings(state) : undefined,
      );
      const view = restoreViewFromSnapshot(previous);

      set({
        past: newPast,
        future: [currentSnapshot, ...state.future].slice(0, MAX_HISTORY),
        plans: previous.plans,
        catalogCourses: previous.catalogCourses,
        activePlanId: view.activePlanId,
        ghostPlanIds: view.ghostPlanIds,
        ...(previous.settings ? restoreSettings(previous.settings) : {}),
      });
    },

    redo: () => {
      const state = get();
      if (state.future.length === 0) return;

      const next = state.future[0];
      const newFuture = state.future.slice(1);
      const currentSnapshot = createHistorySnapshot(
        state,
        next.settings ? pickSettings(state) : undefined,
      );
      const view = restoreViewFromSnapshot(next);

      set({
        past: [currentSnapshot, ...state.past].slice(0, MAX_HISTORY),
        future: newFuture,
        plans: next.plans,
        catalogCourses: next.catalogCourses,
        activePlanId: view.activePlanId,
        ghostPlanIds: view.ghostPlanIds,
        ...(next.settings ? restoreSettings(next.settings) : {}),
      });
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
  };
}
