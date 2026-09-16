import type { HistorySnapshot, ScheduleState, StoreGet, StoreSet } from './types';

export const MAX_HISTORY = 25;

export function createHistorySnapshot(state: {
  plans: HistorySnapshot['plans'];
  catalogCourses: HistorySnapshot['catalogCourses'];
  activePlanId: string;
  ghostPlanIds: string[];
}): HistorySnapshot {
  if (typeof structuredClone === 'function') {
    try {
      return {
        plans: structuredClone(state.plans),
        catalogCourses: structuredClone(state.catalogCourses),
        activePlanId: state.activePlanId,
        ghostPlanIds: structuredClone(state.ghostPlanIds),
      };
    } catch {
      // Fallback if environment throws
    }
  }
  return {
    plans: JSON.parse(JSON.stringify(state.plans)),
    catalogCourses: JSON.parse(JSON.stringify(state.catalogCourses)),
    activePlanId: state.activePlanId,
    ghostPlanIds: [...state.ghostPlanIds],
  };
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
  patch: Partial<ScheduleState> | ((state: ScheduleState) => Partial<ScheduleState>)
): void {
  const state = get();
  const snapshot = createHistorySnapshot(state);
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
      const currentSnapshot = createHistorySnapshot(state);
      const view = restoreViewFromSnapshot(previous);

      set({
        past: newPast,
        future: [currentSnapshot, ...state.future].slice(0, MAX_HISTORY),
        plans: previous.plans,
        catalogCourses: previous.catalogCourses,
        activePlanId: view.activePlanId,
        ghostPlanIds: view.ghostPlanIds,
      });
    },

    redo: () => {
      const state = get();
      if (state.future.length === 0) return;

      const next = state.future[0];
      const newFuture = state.future.slice(1);
      const currentSnapshot = createHistorySnapshot(state);
      const view = restoreViewFromSnapshot(next);

      set({
        past: [currentSnapshot, ...state.past].slice(0, MAX_HISTORY),
        future: newFuture,
        plans: next.plans,
        catalogCourses: next.catalogCourses,
        activePlanId: view.activePlanId,
        ghostPlanIds: view.ghostPlanIds,
      });
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
  };
}
