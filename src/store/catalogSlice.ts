import type { Course } from '../types/schedule';
import { withUnusedCourseColors } from '../utils/courseColor';
import { courseIdentityKey, sameCourseIdentity } from '../utils/courseIdentity';
import { prefixedId } from '../utils/id';
import { commitWithHistory } from './history';
import type { ScheduleState, StoreGet, StoreSet } from './types';

export function createCatalogSlice(set: StoreSet, get: StoreGet): Pick<
  ScheduleState,
  | 'bulkAddToCatalog'
  | 'removeFromCatalog'
  | 'updateCatalogCourse'
  | 'addCourseFromPool'
  | 'removeCourseFromPlanByCatalog'
  | 'clearUnusedCatalogCourses'
  | 'clearPlanCourses'
> {
  return {
    bulkAddToCatalog: (courses: Course[]) => {
      if (courses.length === 0) return 0;
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
      if (newItems.length === 0) return 0;
      commitWithHistory(set, get, {
        catalogCourses: [...newItems, ...state.catalogCourses],
      });
      return newItems.length;
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
      const newKey = courseIdentityKey(updatedCourse.code, updatedCourse.section);

      // Keep enrolled courses in any plans in sync with edited catalog details.
      // Leave a plan alone when renaming would collide with another course it already holds.
      const updatedPlans = state.plans.map((p) => {
        const holdsOld = p.courses.some(
          (c) => courseIdentityKey(c.code, c.section) === oldKey || c.id === updatedCourse.id
        );
        if (!holdsOld) return p;
        const wouldCollide =
          oldKey !== newKey &&
          p.courses.some(
            (c) =>
              courseIdentityKey(c.code, c.section) === newKey &&
              courseIdentityKey(c.code, c.section) !== oldKey &&
              c.id !== updatedCourse.id
          );
        if (wouldCollide) return p;

        const colorChanged = oldCat.color !== updatedCourse.color;
        const isTarget = (c: Course) =>
          courseIdentityKey(c.code, c.section) === oldKey || c.id === updatedCourse.id;
        // Plans keep their course colors distinct, so the pool color only carries over
        // when no other course in this plan already uses it.
        const newColor = (updatedCourse.color ?? '').toLowerCase();
        const colorTaken = p.courses.some(
          (c) => !isTarget(c) && (c.color ?? '').toLowerCase() === newColor
        );
        return {
          ...p,
          courses: p.courses.map((c) => {
            if (
              courseIdentityKey(c.code, c.section) === oldKey ||
              c.id === updatedCourse.id
            ) {
              return {
                ...updatedCourse,
                id: c.id,
                color: colorChanged && !colorTaken ? updatedCourse.color : (c.color || updatedCourse.color),
                sessions: updatedCourse.sessions.map((s, idx) => ({
                  ...s,
                  id: `s_${c.id}_${idx}`,
                })),
              };
            }
            return c;
          }),
        };
      });

      let updatedCatalog = [...state.catalogCourses];
      const sourceIdx = updatedCatalog.findIndex((c) => c.id === updatedCourse.id);
      const targetIdx =
        oldKey === newKey
          ? sourceIdx
          : updatedCatalog.findIndex(
              (c, idx) => idx !== sourceIdx && courseIdentityKey(c.code, c.section) === newKey
            );

      if (oldKey === newKey) {
        updatedCatalog[sourceIdx] = updatedCourse;
      } else {
        const isOldUsedElsewhere = updatedPlans.some((p) =>
          p.courses.some((c) => courseIdentityKey(c.code, c.section) === oldKey)
        );

        if (targetIdx !== -1) {
          updatedCatalog[targetIdx] = { ...updatedCourse, id: updatedCatalog[targetIdx].id };
          if (!isOldUsedElsewhere && sourceIdx !== -1 && sourceIdx !== targetIdx) {
            updatedCatalog = updatedCatalog.filter((_, idx) => idx !== sourceIdx);
          }
        } else if (isOldUsedElsewhere) {
          const newCatId = prefixedId('cat');
          updatedCatalog = [{ ...updatedCourse, id: newCatId }, ...updatedCatalog];
        } else {
          updatedCatalog[sourceIdx] = updatedCourse;
        }
      }

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

      // Deep copy with fresh unique IDs. Keep the pool color when this plan is not using it.
      const newCourseId = prefixedId('c');
      const [placed] = withUnusedCourseColors(
        [catalogItem],
        targetPlan.courses.map((course) => course.color)
      );
      const freshCopy: Course = {
        ...placed,
        id: newCourseId,
        sessions: placed.sessions.map((s, idx) => ({
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

      const matchesCatalog = (course: Course) =>
        sameCourseIdentity(course, catalogItem) || course.id === catalogItem.id;
      if (!targetPlan.courses.some(matchesCatalog)) return;

      const updatedPlans = state.plans.map(p =>
        p.id === targetId
          ? { ...p, courses: p.courses.filter(c => !matchesCatalog(c)) }
          : p
      );

      commitWithHistory(set, get, {
        plans: updatedPlans,
      });
    },

    clearPlanCourses: (targetPlanId?: string) => {
      const state = get();
      const targetId = targetPlanId || state.activePlanId;
      const targetPlan = state.plans.find(p => p.id === targetId);
      if (!targetPlan || targetPlan.courses.length === 0) return;

      commitWithHistory(set, get, {
        plans: state.plans.map(p => (p.id === targetId ? { ...p, courses: [] } : p)),
      });
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
