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
      if (!state.catalogCourses.some((c) => c.id === courseId)) return;
      commitWithHistory(set, get, {
        catalogCourses: state.catalogCourses.filter((c) => c.id !== courseId),
      });
    },

    updateCatalogCourse: (updatedCourse: Course) => {
      const state = get();
      if (!state.catalogCourses.some((c) => c.id === updatedCourse.id)) return;
      commitWithHistory(set, get, {
        catalogCourses: state.catalogCourses.map((c) => c.id === updatedCourse.id ? updatedCourse : c),
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
      const alreadyInPlan = targetPlan.courses.some(c => sameCourseIdentity(c, catalogItem));
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

      const existingInPlan = targetPlan.courses.find(c => sameCourseIdentity(c, catalogItem));
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

      const existingInPlan = targetPlan.courses.find(c => sameCourseIdentity(c, catalogItem));

      if (existingInPlan) {
        state.removeCourseFromPlanByCatalog(catalogCourseId, targetId);
      } else {
        state.addCourseFromPool(catalogCourseId, targetId);
      }
    },
  };
}
