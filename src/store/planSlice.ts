import type { SchedulePlan } from '../types/schedule';
import { commitWithHistory } from './history';
import { uniquePlanId } from './sanitize';
import type { ScheduleState, StoreGet, StoreSet } from './types';

export function createPlanSlice(set: StoreSet, get: StoreGet): Pick<
  ScheduleState,
  'setActivePlan' | 'createPlan' | 'duplicatePlan' | 'renamePlan' | 'deletePlan' | 'toggleGhostPlan' | 'clearGhostPlans'
> {
  return {
    setActivePlan: (planId: string) => {
      set((state) => {
        // If the plan is currently in ghostPlanIds, remove it from ghostPlanIds
        const ghostPlanIds = state.ghostPlanIds.filter(id => id !== planId);
        return { activePlanId: planId, ghostPlanIds };
      });
    },

    createPlan: (name?: string) => {
      const state = get();
      const planCount = state.plans.length + 1;
      const alphabet = String.fromCharCode(65 + ((planCount - 1) % 26));
      const planName = name || `Plan ${alphabet}`;
      const newPlanId = uniquePlanId(state.plans.map((p) => p.id));

      const newPlan: SchedulePlan = {
        id: newPlanId,
        name: planName,
        courses: [],
      };

      commitWithHistory(set, get, {
        plans: [...state.plans, newPlan],
        activePlanId: newPlanId,
      });

      return newPlanId;
    },

    duplicatePlan: (planId: string) => {
      const state = get();
      const sourcePlan = state.plans.find(p => p.id === planId);
      if (!sourcePlan) return planId;

      const newPlanId = uniquePlanId(state.plans.map((p) => p.id));
      // Deep copy courses with new collision-free IDs to prevent reference collisions
      const clonedCourses = sourcePlan.courses.map((c, cIdx) => {
        const newCourseId = `c_${Date.now()}_${cIdx}_${Math.random().toString(36).substring(2, 7)}`;
        return {
          ...c,
          id: newCourseId,
          sessions: c.sessions.map((s, sIdx) => ({
            ...s,
            id: `s_${newCourseId}_${sIdx}`,
          })),
        };
      });

      const duplicatedPlan: SchedulePlan = {
        id: newPlanId,
        name: `${sourcePlan.name} (Copy)`,
        courses: clonedCourses,
      };

      commitWithHistory(set, get, {
        plans: [...state.plans, duplicatedPlan],
        activePlanId: newPlanId,
      });

      return newPlanId;
    },

    renamePlan: (planId: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      const state = get();

      commitWithHistory(set, get, {
        plans: state.plans.map(p => p.id === planId ? { ...p, name: trimmed } : p),
      });
    },

    deletePlan: (planId: string) => {
      const state = get();
      if (state.plans.length <= 1) return;
      const idx = state.plans.findIndex((p) => p.id === planId);
      if (idx === -1) return;
      const remainingPlans = state.plans.filter((_, i) => i !== idx);
      if (remainingPlans.length === 0) return;

      const remainingIds = new Set(remainingPlans.map((p) => p.id));
      const newActiveId = remainingIds.has(state.activePlanId)
        ? state.activePlanId
        : remainingPlans[0].id;
      const newGhostIds = state.ghostPlanIds.filter((id) => remainingIds.has(id) && id !== newActiveId);

      commitWithHistory(set, get, {
        plans: remainingPlans,
        activePlanId: newActiveId,
        ghostPlanIds: newGhostIds,
      });
    },

    toggleGhostPlan: (planId: string) => {
      set((state) => {
        if (planId === state.activePlanId) return state; // Active plan cannot be ghosted
        const exists = state.ghostPlanIds.includes(planId);
        const ghostPlanIds = exists
          ? state.ghostPlanIds.filter(id => id !== planId)
          : [...state.ghostPlanIds, planId];
        return { ghostPlanIds };
      });
    },

    clearGhostPlans: () => {
      set({ ghostPlanIds: [] });
    },
  };
}
