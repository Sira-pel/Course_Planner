import { type Course } from '../types/schedule';
import { nextUnusedCourseColor, withUnusedCourseColors } from '../utils/courseColor';
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
      if (!oldCourse) return;

      const oldKey = courseIdentityKey(oldCourse.code, oldCourse.section);
      const newKey = courseIdentityKey(updatedCourse.code, updatedCourse.section);

      // The same course (same code and section) in other plans follows the edit, as it
      // does when the course is edited from the pool. Each plan keeps its own ids and
      // color. A plan that already holds a different course with the new identity is
      // left alone so the rename cannot create a duplicate in it.
      const updatedPlans = state.plans.map((p) => {
        if (p.id === targetId) {
          return {
            ...p,
            courses: p.courses.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)),
          };
        }
        const holdsOld = p.courses.some((c) => courseIdentityKey(c.code, c.section) === oldKey);
        if (!holdsOld) return p;
        const wouldCollide =
          oldKey !== newKey &&
          p.courses.some((c) => courseIdentityKey(c.code, c.section) === newKey);
        if (wouldCollide) return p;
        return {
          ...p,
          courses: p.courses.map((c) =>
            courseIdentityKey(c.code, c.section) === oldKey
              ? {
                  ...updatedCourse,
                  id: c.id,
                  color: c.color || updatedCourse.color,
                  sessions: updatedCourse.sessions.map((s, idx) => ({ ...s, id: `s_${c.id}_${idx}` })),
                }
              : c
          ),
        };
      });

      // Keep catalogCourses synchronized with updated course
      let updatedCatalog = [...state.catalogCourses];
      const catalogId = updatedCourse.id.startsWith('cat_') ? updatedCourse.id : `cat_${updatedCourse.id}`;
      const keyAt = (index: number) =>
        courseIdentityKey(updatedCatalog[index].code, updatedCatalog[index].section);
      const findByKey = (key: string) =>
        updatedCatalog.findIndex((_, index) => keyAt(index) === key);

      // The pool entry this plan course came from: same identity as before the edit,
      // or the entry made for this course id. Matching the new identity here would
      // pick an unrelated pool entry when the code or section changes.
      let sourceIdx = findByKey(oldKey);
      if (sourceIdx === -1) sourceIdx = updatedCatalog.findIndex((cat) => cat.id === catalogId);
      const targetIdx = oldKey === newKey ? sourceIdx : findByKey(newKey);

      const addToPool = () => {
        updatedCatalog = [{ ...updatedCourse, id: catalogId }, ...updatedCatalog];
      };

      if (oldKey === newKey) {
        if (sourceIdx === -1) {
          addToPool();
        } else {
          updatedCatalog[sourceIdx] = { ...updatedCourse, id: updatedCatalog[sourceIdx].id };
        }
      } else {
        // Only plans that were left alone above still hold the old identity.
        const isOldUsedElsewhere = updatedPlans.some((p) =>
          p.courses.some((c) => courseIdentityKey(c.code, c.section) === oldKey)
        );

        if (targetIdx !== -1) {
          // The new identity is already in the pool: update that entry with the edited
          // details, and drop the old pool entry once no other plan uses it.
          updatedCatalog[targetIdx] = { ...updatedCourse, id: updatedCatalog[targetIdx].id };
          if (!isOldUsedElsewhere && sourceIdx !== -1 && sourceIdx !== targetIdx) {
            updatedCatalog = updatedCatalog.filter((_, index) => index !== sourceIdx);
          }
        } else if (isOldUsedElsewhere || sourceIdx === -1) {
          // Other plans still use the old pool entry. Keep it, and add the new one.
          addToPool();
        } else {
          // Nobody else uses it, so rename the pool entry in place.
          updatedCatalog[sourceIdx] = { ...updatedCourse, id: updatedCatalog[sourceIdx].id };
        }
      }

      commitWithHistory(set, get, {
        plans: updatedPlans,
        catalogCourses: updatedCatalog,
      });
    },

    deleteCourse: (courseId: string, targetPlanId?: string) => {
      const state = get();
      const targetId = targetPlanId || state.activePlanId;
      const targetPlan = state.plans.find((p) => p.id === targetId);
      if (!targetPlan || !targetPlan.courses.some((c) => c.id === courseId)) return;

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
      const targetPlan = state.plans.find((plan) => plan.id === targetId);
      const coloredCourses = withUnusedCourseColors(
        newCourses,
        (targetPlan?.courses || []).map((course) => course.color)
      );

      const updatedPlans = state.plans.map(p => {
        if (p.id === targetId) {
          return {
            ...p,
            courses: [...p.courses, ...coloredCourses],
          };
        }
        return p;
      });

      // Add to catalog pool as well using a Set for O(1) lookups
      const catalogKeys = new Set(
        state.catalogCourses.map(cat => courseIdentityKey(cat.code, cat.section))
      );
      const currentCatalog = [...state.catalogCourses];
      for (const c of coloredCourses) {
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
      const targetPlan = state.plans.find((p) => p.id === targetId);
      const courses = targetPlan?.courses || [];
      return nextUnusedCourseColor(
        courses.map((course) => course.color),
        courses.length
      );
    },
  };
}
