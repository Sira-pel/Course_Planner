import type { Course } from '../types/schedule';
import { courseIdentityKey, sameCourseIdentity } from '../utils/courseIdentity';
import { prefixedId } from '../utils/id';
import { commitWithHistory } from './history';
import type { ScheduleState, StoreGet, StoreSet } from './types';

export function createCatalogSlice(set: StoreSet, get: StoreGet): Pick<
  ScheduleState,
  | 'addToCatalog'
  | 'bulkAddToCatalog'
  | 'removeFromCatalog'
  | 'updateCatalogCourse'
  | 'addCourseFromPool'
  | 'removeCourseFromPlanByCatalog'
  | 'toggleCourseInPlan'
  | 'clearUnusedCatalogCourses'
> {
  return {
    addToCatalog: (course: Course) => {
      const state = get();
      const exists = state.catalogCourses.some(c => sameCourseIdentity(c, course));
      if (exists) return;
      commitWithHistory(set, get, {
        catalogCourses: [{ ...course, id: course.id.startsWith('cat_') ? course.id : `cat_${course.id}` }, ...state.catalogCourses],
      });
    },

    bulkAddToCatalog: (courses: Course[]) => {
      if (courses.length === 0) return;
      const state = get();
      const existingKeys = new Set(
        state.catalogCourses.map(c => courseIdentityKey(c.code, c.section))
      );
      const newItems: Course[] = [];
      for (const course of courses) {
        const key = courseIdentityKey(course.code, course.section);
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          newItems.push({
            ...course,
            id: course.id.startsWith('cat_') ? course.id : `cat_${course.id}`,
          });
        }
      }
      if (newItems.length === 0) return;
      commitWithHistory(set, get, {
        catalogCourses: [...newItems, ...state.catalogCourses],
      });
    },

    removeFromCatalog: (courseId: string) => {
      const state = get();
      const catCourse = state.catalogCourses.find((c) => c.id === courseId);
      if (!catCourse) return;

      const catKey = courseIdentityKey(catCourse.code, catCourse.section);

      // Also remove from plans so plans never contain orphaned courses deleted from pool
      const updatedPlans = state.plans.map((p) => ({
        ...p,
        courses: p.courses.filter(
          (c) =>
            courseIdentityKey(c.code, c.section) !== catKey &&
            c.id !== courseId
        ),
      }));

      commitWithHistory(set, get, {
        catalogCourses: state.catalogCourses.filter((c) => c.id !== courseId),
        plans: updatedPlans,
      });
    },

    updateCatalogCourse: (updatedCourse: Course) => {
      const state = get();
      const oldCat = state.catalogCourses.find((c) => c.id === updatedCourse.id);
      if (!oldCat) return;

      const oldKey = courseIdentityKey(oldCat.code, oldCat.section);

      const updatedCatalog = state.catalogCourses.map((c) =>
        c.id === updatedCourse.id ? updatedCourse : c
      );

      // Keep enrolled courses in any plans in sync with edited catalog details
      const updatedPlans = state.plans.map((p) => ({
        ...p,
        courses: p.courses.map((c) => {
          if (
            courseIdentityKey(c.code, c.section) === oldKey ||
            c.id === updatedCourse.id
          ) {
            return {
              ...updatedCourse,
              id: c.id,
              color: c.color || updatedCourse.color,
              sessions: updatedCourse.sessions.map((s, idx) => ({
                ...s,
                id: `s_${c.id}_${idx}`,
              })),
            };
          }
          return c;
        }),
      }));

      commitWithHistory(set, get, {
        catalogCourses: updatedCatalog,
        plans: updatedPlans,
      });
    },

    addCourseFromPool: (catalogCourseId: string, targetPlanId?: string) => {
      const state = get();
      const targetId = targetPlanId || state.activePlanId;
      const targetPlan = state.plans.find(p => p.id === targetId);
      if (!targetPlan) return;

      const catalogItem = state.catalogCourses.find(c => c.id === catalogCourseId);
      if (!catalogItem) return;

      // Check if already in active plan
      const alreadyInPlan = targetPlan.courses.some(
        c => sameCourseIdentity(c, catalogItem) || c.id === catalogItem.id
      );
      if (alreadyInPlan) return;

      // Deep copy with fresh unique IDs
      const newCourseId = prefixedId('c');
      const freshCopy: Course = {
        ...catalogItem,
        id: newCourseId,
        color: catalogItem.color || state.getNextColor(targetId),
        sessions: catalogItem.sessions.map((s, idx) => ({
          ...s,
          id: `s_${newCourseId}_${idx}`,
        })),
      };

      const updatedPlans = state.plans.map(p =>
        p.id === targetId ? { ...p, courses: [...p.courses, freshCopy] } : p
      );

      commitWithHistory(set, get, {
        plans: updatedPlans,
      });
    },

    removeCourseFromPlanByCatalog: (catalogCourseId: string, targetPlanId?: string) => {
      const state = get();
      const targetId = targetPlanId || state.activePlanId;
      const targetPlan = state.plans.find(p => p.id === targetId);
      if (!targetPlan) return;

      const catalogItem = state.catalogCourses.find(c => c.id === catalogCourseId);
      if (!catalogItem) return;

      const existingInPlan = targetPlan.courses.find(
        c => sameCourseIdentity(c, catalogItem) || c.id === catalogItem.id
      );
      if (!existingInPlan) return;

      const updatedPlans = state.plans.map(p =>
        p.id === targetId
          ? { ...p, courses: p.courses.filter(c => c.id !== existingInPlan.id) }
          : p
      );

      commitWithHistory(set, get, {
        plans: updatedPlans,
      });
    },

    toggleCourseInPlan: (catalogCourseId: string, targetPlanId?: string) => {
      const state = get();
      const targetId = targetPlanId || state.activePlanId;
      const targetPlan = state.plans.find(p => p.id === targetId);
      if (!targetPlan) return;

      const catalogItem = state.catalogCourses.find(c => c.id === catalogCourseId);
      if (!catalogItem) return;

      const existingInPlan = targetPlan.courses.find(
        c => sameCourseIdentity(c, catalogItem) || c.id === catalogItem.id
      );

      if (existingInPlan) {
        state.removeCourseFromPlanByCatalog(catalogCourseId, targetId);
      } else {
        state.addCourseFromPool(catalogCourseId, targetId);
      }
    },

    clearUnusedCatalogCourses: () => {
      const state = get();
      if (state.catalogCourses.length === 0) return;

      const usedIdentityKeys = new Set<string>();
      const usedIds = new Set<string>();

      for (const plan of state.plans) {
        for (const c of plan.courses) {
          usedIdentityKeys.add(courseIdentityKey(c.code, c.section));
          usedIds.add(c.id);
        }
      }

      const keptCourses = state.catalogCourses.filter((cat) => {
        const key = courseIdentityKey(cat.code, cat.section);
        if (usedIdentityKeys.has(key)) return true;
        return usedIds.has(cat.id);
      });

      if (keptCourses.length === state.catalogCourses.length) {
        return; // All catalog courses are currently in use in at least one plan
      }

      commitWithHistory(set, get, {
        catalogCourses: keptCourses,
      });
    },
  };
}
