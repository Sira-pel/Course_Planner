import { COURSE_COLORS, type Course } from '../types/schedule';
import { sameCourseIdentity } from '../utils/courseIdentity';
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
        : [...state.catalogCourses, { ...course, id: `cat_${course.id}` }];

      commitWithHistory(set, get, {
        plans: updatedPlans,
        catalogCourses: updatedCatalog,
      });
    },

    updateCourse: (updatedCourse: Course, targetPlanId?: string) => {
      const state = get();
      const targetId = targetPlanId || state.activePlanId;

      const updatedPlans = state.plans.map(p => {
        if (p.id === targetId) {
          return {
            ...p,
            courses: p.courses.map(c => c.id === updatedCourse.id ? updatedCourse : c),
          };
        }
        return p;
      });

      commitWithHistory(set, get, {
        plans: updatedPlans,
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

      // Add to catalog pool as well
      const currentCatalog = [...state.catalogCourses];
      newCourses.forEach(c => {
        const exists = currentCatalog.some(cat => sameCourseIdentity(cat, c));
        if (!exists) {
          currentCatalog.push({ ...c, id: `cat_${c.id}` });
        }
      });

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
