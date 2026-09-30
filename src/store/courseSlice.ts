import { COURSE_COLORS, type Course } from '../types/schedule';
import { courseIdentityKey, sameCourseIdentity } from '../utils/courseIdentity';
import { commitWithHistory } from './history';
import type { ScheduleState, StoreGet, StoreSet } from './types';

export function createCourseSlice(set: StoreSet, get: StoreGet): Pick<
  ScheduleState,
  'addCourse' | 'updateCourse' | 'deleteCourse' | 'bulkAddCourses' | 'getNextColor'
> {
  return {
    addCourse: (course: Course, targetPlanId?: string) => {
      const state = get();
      const targetId = targetPlanId || state.activePlanId;

      const updatedPlans = state.plans.map(p => {
        if (p.id === targetId) {
          return {
            ...p,
            courses: [...p.courses, course],
          };
        }
        return p;
      });

      // Also ensure it's saved in the shared course pool if not already there
      const inCatalog = state.catalogCourses.some(c => sameCourseIdentity(c, course));
      const updatedCatalog = inCatalog
        ? state.catalogCourses
        : [...state.catalogCourses, { ...course, id: course.id.startsWith('cat_') ? course.id : `cat_${course.id}` }];

      commitWithHistory(set, get, {
        plans: updatedPlans,
        catalogCourses: updatedCatalog,
      });
    },

    updateCourse: (updatedCourse: Course, targetPlanId?: string) => {
      const state = get();
      const targetId = targetPlanId || state.activePlanId;
      const targetPlan = state.plans.find((p) => p.id === targetId);
      const oldCourse = targetPlan?.courses.find((c) => c.id === updatedCourse.id);

      const updatedPlans = state.plans.map((p) => {
        if (p.id === targetId) {
          return {
            ...p,
            courses: p.courses.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)),
          };
        }
        return p;
      });

      // Keep catalogCourses synchronized with updated course
      let updatedCatalog = [...state.catalogCourses];
      const oldKey = oldCourse ? courseIdentityKey(oldCourse.code, oldCourse.section) : null;
      const newKey = courseIdentityKey(updatedCourse.code, updatedCourse.section);

      const catalogIdx = updatedCatalog.findIndex(
        (cat) =>
          (oldKey && courseIdentityKey(cat.code, cat.section) === oldKey) ||
          courseIdentityKey(cat.code, cat.section) === newKey ||
          cat.id === updatedCourse.id ||
          cat.id === `cat_${updatedCourse.id}`
      );

      if (catalogIdx !== -1) {
        // If identity changed, check if any other plan still uses oldKey
        const isOldUsedElsewhere =
          oldKey &&
          oldKey !== newKey &&
          state.plans.some((p) =>
            p.courses.some(
              (c) =>
                (p.id !== targetId || c.id !== updatedCourse.id) &&
                courseIdentityKey(c.code, c.section) === oldKey
            )
          );

        if (isOldUsedElsewhere) {
          // Keep old catalog item for other plans, add updated one if needed
          if (!updatedCatalog.some((c) => courseIdentityKey(c.code, c.section) === newKey)) {
            updatedCatalog = [
              {
                ...updatedCourse,
                id: updatedCourse.id.startsWith('cat_') ? updatedCourse.id : `cat_${updatedCourse.id}`,
              },
              ...updatedCatalog,
            ];
          }
        } else {
          // Update in place
          const existingCat = updatedCatalog[catalogIdx];
          updatedCatalog[catalogIdx] = {
            ...updatedCourse,
            id: existingCat.id,
          };
        }
      } else {
        // Not in catalog, add it
        updatedCatalog = [
          {
            ...updatedCourse,
            id: updatedCourse.id.startsWith('cat_') ? updatedCourse.id : `cat_${updatedCourse.id}`,
          },
          ...updatedCatalog,
        ];
      }

      commitWithHistory(set, get, {
        plans: updatedPlans,
        catalogCourses: updatedCatalog,
      });
    },

    deleteCourse: (courseId: string, targetPlanId?: string) => {
      const state = get();
      const targetId = targetPlanId || state.activePlanId;

      const updatedPlans = state.plans.map(p => {
        if (p.id === targetId) {
          return {
            ...p,
            courses: p.courses.filter(c => c.id !== courseId),
          };
        }
        return p;
      });

      commitWithHistory(set, get, {
        plans: updatedPlans,
      });
    },

    bulkAddCourses: (newCourses: Course[], targetPlanId?: string) => {
      if (newCourses.length === 0) return;
      const state = get();
      const targetId = targetPlanId || state.activePlanId;

      const updatedPlans = state.plans.map(p => {
        if (p.id === targetId) {
          return {
            ...p,
            courses: [...p.courses, ...newCourses],
          };
        }
        return p;
      });

      // Add to catalog pool as well using a Set for O(1) lookups
      const catalogKeys = new Set(
        state.catalogCourses.map(cat => courseIdentityKey(cat.code, cat.section))
      );
      const currentCatalog = [...state.catalogCourses];
      for (const c of newCourses) {
        const key = courseIdentityKey(c.code, c.section);
        if (!catalogKeys.has(key)) {
          catalogKeys.add(key);
          currentCatalog.push({ ...c, id: c.id.startsWith('cat_') ? c.id : `cat_${c.id}` });
        }
      }

      commitWithHistory(set, get, {
        plans: updatedPlans,
        catalogCourses: currentCatalog,
      });
    },

    getNextColor: (targetPlanId?: string) => {
      const state = get();
      const targetId = targetPlanId || state.activePlanId;
      const targetPlan = state.plans.find(p => p.id === targetId);
      const usedColors = new Set(targetPlan?.courses.map(c => c.color) || []);

      for (const color of COURSE_COLORS) {
        if (!usedColors.has(color)) return color;
      }
      // If all colors used, return random or modular
      const idx = (targetPlan?.courses.length || 0) % COURSE_COLORS.length;
      return COURSE_COLORS[idx];
    },
  };
}
