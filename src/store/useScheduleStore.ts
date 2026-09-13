import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SchedulePlan, Course, ClassSession, DayOfWeek, COURSE_COLORS } from '../types/schedule';
import { SAMPLE_PLANS, SAMPLE_CATALOG } from '../data/sampleSemester';

const VALID_DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function sanitizeCourse(c: any, index: number): Course {
  const courseId = typeof c?.id === 'string' && c.id.trim() ? c.id.trim() : `c_${Date.now()}_${index}`;
  const code = typeof c?.code === 'string' && c.code.trim() ? c.code.trim().toUpperCase() : `CRS ${index + 1}`;
  const name = typeof c?.name === 'string' && c.name.trim() ? c.name.trim() : `${code} Course`;
  const color = typeof c?.color === 'string' && c.color.trim() ? c.color.trim() : COURSE_COLORS[index % COURSE_COLORS.length];
  const credits = typeof c?.credits === 'number' && !isNaN(c.credits) ? Math.max(0, Math.min(30, c.credits)) : 3;

  const sessions: ClassSession[] = Array.isArray(c?.sessions)
    ? c.sessions
        .filter((s: any) => s && typeof s === 'object')
        .map((s: any, sIdx: number): ClassSession => {
          const rawStart = typeof s.startTime === 'string' && s.startTime ? s.startTime : '09:00';
          let rawEnd = typeof s.endTime === 'string' && s.endTime ? s.endTime : '10:15';
          const [sh, sm] = rawStart.split(':').map(Number);
          const [eh, em] = rawEnd.split(':').map(Number);
          const sMin = (isNaN(sh) ? 9 : sh) * 60 + (isNaN(sm) ? 0 : sm);
          const eMin = (isNaN(eh) ? 10 : eh) * 60 + (isNaN(em) ? 15 : em);
          if (eMin <= sMin) {
            const adj = Math.min(23 * 60 + 59, sMin + 50);
            rawEnd = `${Math.floor(adj / 60).toString().padStart(2, '0')}:${(adj % 60).toString().padStart(2, '0')}`;
          }
          return {
            id: typeof s.id === 'string' && s.id ? s.id : `s_${courseId}_${sIdx}`,
            day: VALID_DAYS.includes(s.day) ? s.day : 'monday',
            startTime: rawStart,
            endTime: rawEnd,
            room: typeof s.room === 'string' && s.room.trim() ? s.room.trim() : undefined,
          };
        })
    : [];

  return {
    id: courseId,
    code,
    name,
    section: typeof c?.section === 'string' && c.section.trim() ? c.section.trim() : undefined,
    instructor: typeof c?.instructor === 'string' && c.instructor.trim() ? c.instructor.trim() : undefined,
    credits,
    color,
    sessions: sessions.length > 0 ? sessions : [{ id: `s_${courseId}_0`, day: 'monday', startTime: '09:00', endTime: '10:15' }],
  };
}

function sanitizePlans(rawPlans: any[]): SchedulePlan[] {
  if (!Array.isArray(rawPlans) || rawPlans.length === 0) return [];

  return rawPlans
    .filter((p) => p && typeof p === 'object')
    .map((p, pIdx) => {
      const planId = typeof p.id === 'string' && p.id.trim() ? p.id.trim() : `plan_${pIdx + 1}`;
      const planName = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : `Plan ${String.fromCharCode(65 + pIdx)}`;
      const courses = Array.isArray(p.courses)
        ? p.courses.map((c: any, cIdx: number) => sanitizeCourse(c, cIdx))
        : [];

      return {
        id: planId,
        name: planName,
        courses,
      };
    });
}

function sanitizeCatalog(rawCatalog: any[]): Course[] {
  if (!Array.isArray(rawCatalog)) return [];
  return rawCatalog
    .filter((c) => c && typeof c === 'object')
    .map((c, idx) => sanitizeCourse(c, idx));
}

interface HistorySnapshot {
  plans: SchedulePlan[];
  catalogCourses: Course[];
}

function createHistorySnapshot(state: { plans: SchedulePlan[]; catalogCourses: Course[] }): HistorySnapshot {
  if (typeof structuredClone === 'function') {
    try {
      return {
        plans: structuredClone(state.plans),
        catalogCourses: structuredClone(state.catalogCourses),
      };
    } catch {
      // Fallback if environment throws
    }
  }
  return {
    plans: JSON.parse(JSON.stringify(state.plans)),
    catalogCourses: JSON.parse(JSON.stringify(state.catalogCourses)),
  };
}

interface ScheduleState {
  plans: SchedulePlan[];
  activePlanId: string;
  ghostPlanIds: string[];
  catalogCourses: Course[];
  showWeekends: boolean;
  startHour: number;
  endHour: number;
  theme: 'light' | 'dark';

  // History for Undo/Redo
  past: HistorySnapshot[];
  future: HistorySnapshot[];

  // Plan actions
  setActivePlan: (planId: string) => void;
  createPlan: (name?: string) => string;
  duplicatePlan: (planId: string) => string;
  renamePlan: (planId: string, newName: string) => void;
  deletePlan: (planId: string) => void;
  toggleGhostPlan: (planId: string) => void;
  clearGhostPlans: () => void;

  // Course actions
  addCourse: (course: Course, targetPlanId?: string) => void;
  updateCourse: (course: Course, targetPlanId?: string) => void;
  deleteCourse: (courseId: string, targetPlanId?: string) => void;
  bulkAddCourses: (newCourses: Course[], targetPlanId?: string) => void;
  getNextColor: (targetPlanId?: string) => string;

  // Catalog Pool actions
  addToCatalog: (course: Course) => void;
  removeFromCatalog: (courseId: string) => void;
  updateCatalogCourse: (course: Course) => void;
  toggleCourseInPlan: (catalogCourseId: string, targetPlanId?: string) => void;
  addCourseFromPool: (catalogCourseId: string, targetPlanId?: string) => void;
  removeCourseFromPlanByCatalog: (catalogCourseId: string, targetPlanId?: string) => void;

  // Undo / Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Settings & Reset
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setShowWeekends: (show: boolean) => void;
  setTimeRange: (startHour: number, endHour: number) => void;
  resetToBlank: () => void;
  resetToSample: () => void;
  importFullState: (jsonString: string) => { success: boolean; error?: string };
}

const MAX_HISTORY = 25;

export const DEFAULT_INITIAL_PLANS: SchedulePlan[] = [
  {
    id: 'plan_1',
    name: 'Plan A',
    courses: [],
  },
];

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      plans: DEFAULT_INITIAL_PLANS,
      activePlanId: 'plan_1',
      ghostPlanIds: [],
      catalogCourses: [],
      showWeekends: false,
      startHour: 7,
      endHour: 17,
      theme: typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      past: [],
      future: [],

      setActivePlan: (planId: string) => {
        set((state) => {
          // If the plan is currently in ghostPlanIds, remove it from ghostPlanIds
          const ghostPlanIds = state.ghostPlanIds.filter(id => id !== planId);
          return { activePlanId: planId, ghostPlanIds };
        });
      },

      createPlan: (name?: string) => {
        const state = get();
        // Save history snapshot
        const snapshot = createHistorySnapshot(state);

        const planCount = state.plans.length + 1;
        const alphabet = String.fromCharCode(65 + ((planCount - 1) % 26));
        const planName = name || `Plan ${alphabet}`;
        const newPlanId = `plan_${Date.now()}`;

        const newPlan: SchedulePlan = {
          id: newPlanId,
          name: planName,
          courses: [],
        };

        set({
          past: [snapshot, ...state.past].slice(0, MAX_HISTORY),
          future: [],
          plans: [...state.plans, newPlan],
          activePlanId: newPlanId,
        });

        return newPlanId;
      },

      duplicatePlan: (planId: string) => {
        const state = get();
        const sourcePlan = state.plans.find(p => p.id === planId);
        if (!sourcePlan) return planId;

        const snapshot = createHistorySnapshot(state);

        const newPlanId = `plan_${Date.now()}`;
        // Deep copy courses with new IDs to prevent reference collisions
        const clonedCourses: Course[] = sourcePlan.courses.map(c => ({
          ...c,
          id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          sessions: c.sessions.map((s, idx) => ({
            ...s,
            id: `s_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
          })),
        }));

        const duplicatedPlan: SchedulePlan = {
          id: newPlanId,
          name: `${sourcePlan.name} (Copy)`,
          courses: clonedCourses,
        };

        set({
          past: [snapshot, ...state.past].slice(0, MAX_HISTORY),
          future: [],
          plans: [...state.plans, duplicatedPlan],
          activePlanId: newPlanId,
        });

        return newPlanId;
      },

      renamePlan: (planId: string, newName: string) => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        const state = get();
        const snapshot = createHistorySnapshot(state);

        set({
          past: [snapshot, ...state.past].slice(0, MAX_HISTORY),
          future: [],
          plans: state.plans.map(p => p.id === planId ? { ...p, name: trimmed } : p),
        });
      },

      deletePlan: (planId: string) => {
        const state = get();
        if (state.plans.length <= 1) return; // Keep at least one plan

        const snapshot = createHistorySnapshot(state);

        const remainingPlans = state.plans.filter(p => p.id !== planId);
        const newActiveId = state.activePlanId === planId ? remainingPlans[0].id : state.activePlanId;
        const newGhostIds = state.ghostPlanIds.filter(id => id !== planId);

        set({
          past: [snapshot, ...state.past].slice(0, MAX_HISTORY),
          future: [],
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

      addCourse: (course: Course, targetPlanId?: string) => {
        const state = get();
        const targetId = targetPlanId || state.activePlanId;
        const snapshot = createHistorySnapshot(state);

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
        const inCatalog = state.catalogCourses.some(c => c.code === course.code && c.section === course.section);
        const updatedCatalog = inCatalog
          ? state.catalogCourses
          : [...state.catalogCourses, { ...course, id: `cat_${course.id}` }];

        set({
          past: [snapshot, ...state.past].slice(0, MAX_HISTORY),
          future: [],
          plans: updatedPlans,
          catalogCourses: updatedCatalog,
        });
      },

      updateCourse: (updatedCourse: Course, targetPlanId?: string) => {
        const state = get();
        const targetId = targetPlanId || state.activePlanId;
        const snapshot = createHistorySnapshot(state);

        const updatedPlans = state.plans.map(p => {
          if (p.id === targetId) {
            return {
              ...p,
              courses: p.courses.map(c => c.id === updatedCourse.id ? updatedCourse : c),
            };
          }
          return p;
        });

        set({
          past: [snapshot, ...state.past].slice(0, MAX_HISTORY),
          future: [],
          plans: updatedPlans,
        });
      },

      deleteCourse: (courseId: string, targetPlanId?: string) => {
        const state = get();
        const targetId = targetPlanId || state.activePlanId;
        const snapshot = createHistorySnapshot(state);

        const updatedPlans = state.plans.map(p => {
          if (p.id === targetId) {
            return {
              ...p,
              courses: p.courses.filter(c => c.id !== courseId),
            };
          }
          return p;
        });

        set({
          past: [snapshot, ...state.past].slice(0, MAX_HISTORY),
          future: [],
          plans: updatedPlans,
        });
      },

      bulkAddCourses: (newCourses: Course[], targetPlanId?: string) => {
        if (newCourses.length === 0) return;
        const state = get();
        const targetId = targetPlanId || state.activePlanId;
        const snapshot = createHistorySnapshot(state);

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
          const exists = currentCatalog.some(cat => cat.code === c.code && cat.section === c.section);
          if (!exists) {
            currentCatalog.push({ ...c, id: `cat_${c.id}` });
          }
        });

        set({
          past: [snapshot, ...state.past].slice(0, MAX_HISTORY),
          future: [],
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

      addToCatalog: (course: Course) => {
        const state = get();
        const exists = state.catalogCourses.some(
          c => c.code.trim().toUpperCase() === course.code.trim().toUpperCase() &&
               (c.section || '').trim().toUpperCase() === (course.section || '').trim().toUpperCase()
        );
        if (exists) return;
        set({
          catalogCourses: [{ ...course, id: course.id.startsWith('cat_') ? course.id : `cat_${course.id}` }, ...state.catalogCourses],
        });
      },

      removeFromCatalog: (courseId: string) => {
        set((state) => ({
          catalogCourses: state.catalogCourses.filter(c => c.id !== courseId),
        }));
      },

      updateCatalogCourse: (updatedCourse: Course) => {
        set((state) => ({
          catalogCourses: state.catalogCourses.map(c => c.id === updatedCourse.id ? updatedCourse : c),
        }));
      },

      addCourseFromPool: (catalogCourseId: string, targetPlanId?: string) => {
        const state = get();
        const targetId = targetPlanId || state.activePlanId;
        const targetPlan = state.plans.find(p => p.id === targetId);
        if (!targetPlan) return;

        const catalogItem = state.catalogCourses.find(c => c.id === catalogCourseId);
        if (!catalogItem) return;

        // Check if already in active plan
        const alreadyInPlan = targetPlan.courses.some(c =>
          c.code.trim().toUpperCase() === catalogItem.code.trim().toUpperCase() &&
          (c.section || '').trim().toUpperCase() === (catalogItem.section || '').trim().toUpperCase()
        );
        if (alreadyInPlan) return;

        const snapshot = createHistorySnapshot(state);

        // Deep copy with fresh unique IDs
        const newCourseId = `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
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

        set({
          past: [snapshot, ...state.past].slice(0, MAX_HISTORY),
          future: [],
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

        const existingInPlan = targetPlan.courses.find(c =>
          c.code.trim().toUpperCase() === catalogItem.code.trim().toUpperCase() &&
          (c.section || '').trim().toUpperCase() === (catalogItem.section || '').trim().toUpperCase()
        );
        if (!existingInPlan) return;

        const snapshot = createHistorySnapshot(state);

        const updatedPlans = state.plans.map(p =>
          p.id === targetId
            ? { ...p, courses: p.courses.filter(c => c.id !== existingInPlan.id) }
            : p
        );

        set({
          past: [snapshot, ...state.past].slice(0, MAX_HISTORY),
          future: [],
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

        // Check if course already in plan
        const existingInPlan = targetPlan.courses.find(
          c => c.code.trim().toUpperCase() === catalogItem.code.trim().toUpperCase() &&
               (c.section || '').trim().toUpperCase() === (catalogItem.section || '').trim().toUpperCase()
        );

        if (existingInPlan) {
          state.removeCourseFromPlanByCatalog(catalogCourseId, targetId);
        } else {
          state.addCourseFromPool(catalogCourseId, targetId);
        }
      },

      undo: () => {
        const state = get();
        if (state.past.length === 0) return;

        const previous = state.past[0];
        const newPast = state.past.slice(1);
        const currentSnapshot = createHistorySnapshot(state);

        // Ensure activePlanId points to an existing plan
        const hasActive = previous.plans.some(p => p.id === state.activePlanId);
        const validActiveId = hasActive ? state.activePlanId : previous.plans[0]?.id || '';

        set({
          past: newPast,
          future: [currentSnapshot, ...state.future].slice(0, MAX_HISTORY),
          plans: previous.plans,
          catalogCourses: previous.catalogCourses,
          activePlanId: validActiveId,
        });
      },

      redo: () => {
        const state = get();
        if (state.future.length === 0) return;

        const next = state.future[0];
        const newFuture = state.future.slice(1);
        const currentSnapshot = createHistorySnapshot(state);

        const hasActive = next.plans.some(p => p.id === state.activePlanId);
        const validActiveId = hasActive ? state.activePlanId : next.plans[0]?.id || '';

        set({
          past: [currentSnapshot, ...state.past].slice(0, MAX_HISTORY),
          future: newFuture,
          plans: next.plans,
          catalogCourses: next.catalogCourses,
          activePlanId: validActiveId,
        });
      },

      canUndo: () => get().past.length > 0,
      canRedo: () => get().future.length > 0,

      setTheme: (theme: 'light' | 'dark') => {
        if (typeof document !== 'undefined') {
          if (theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          localStorage.setItem('uniplan_theme', theme);
        }
        set({ theme });
      },

      toggleTheme: () => {
        const current = get().theme;
        const next = current === 'dark' ? 'light' : 'dark';
        get().setTheme(next);
      },

      setShowWeekends: (show: boolean) => set({ showWeekends: show }),

      setTimeRange: (startHour: number, endHour: number) => {
        set({ startHour: Math.max(5, Math.min(12, startHour)), endHour: Math.max(16, Math.min(24, endHour)) });
      },

      resetToBlank: () => {
        const state = get();
        const snapshot = createHistorySnapshot(state);
        const newPlanId = `plan_${Date.now()}`;
        set({
          past: [snapshot, ...state.past].slice(0, MAX_HISTORY),
          future: [],
          plans: [{ id: newPlanId, name: 'Plan A', courses: [] }],
          catalogCourses: [],
          activePlanId: newPlanId,
          ghostPlanIds: [],
        });
      },

      resetToSample: () => {
        const state = get();
        const snapshot = createHistorySnapshot(state);
        set({
          past: [snapshot, ...state.past].slice(0, MAX_HISTORY),
          future: [],
          plans: SAMPLE_PLANS,
          catalogCourses: SAMPLE_CATALOG,
          activePlanId: 'plan_a',
          ghostPlanIds: [],
        });
      },

      importFullState: (jsonString: string) => {
        try {
          const parsed = JSON.parse(jsonString);
          if (!parsed.plans || !Array.isArray(parsed.plans) || parsed.plans.length === 0) {
            return { success: false, error: 'Invalid backup file: missing plans array' };
          }
          const sanitizedPlans = sanitizePlans(parsed.plans);
          if (sanitizedPlans.length === 0) {
            return { success: false, error: 'No valid plans found in backup data' };
          }

          const state = get();
          const snapshot = createHistorySnapshot(state);

          const targetActiveId = sanitizedPlans.some(p => p.id === parsed.activePlanId)
            ? parsed.activePlanId
            : sanitizedPlans[0].id;

          const sanitizedCatalog = Array.isArray(parsed.catalogCourses)
            ? sanitizeCatalog(parsed.catalogCourses)
            : state.catalogCourses;

          set({
            past: [snapshot, ...state.past].slice(0, MAX_HISTORY),
            future: [],
            plans: sanitizedPlans,
            activePlanId: targetActiveId,
            catalogCourses: sanitizedCatalog,
            ghostPlanIds: [],
          });
          return { success: true };
        } catch (e) {
          return { success: false, error: (e as Error).message || 'Failed to parse JSON backup' };
        }
      },
    }),
    {
      name: 'uniplan_schedule_storage_v2',
      partialize: (state) => ({
        plans: state.plans,
        activePlanId: state.activePlanId,
        catalogCourses: state.catalogCourses,
        showWeekends: state.showWeekends,
        startHour: state.startHour,
        endHour: state.endHour,
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Verify plans integrity - default to a single blank Plan A if empty
        if (!Array.isArray(state.plans) || state.plans.length === 0) {
          state.plans = [
            {
              id: 'plan_1',
              name: 'Plan A',
              courses: [],
            },
          ];
        } else {
          state.plans = sanitizePlans(state.plans);
        }

        // Verify activePlanId validity
        if (!state.plans.some((p) => p.id === state.activePlanId)) {
          state.activePlanId = state.plans[0]?.id || 'plan_1';
        }

        // Verify catalog - default to empty array
        if (!Array.isArray(state.catalogCourses)) {
          state.catalogCourses = [];
        } else {
          state.catalogCourses = sanitizeCatalog(state.catalogCourses);
        }

        // Synchronize DOM theme on hydration
        if (typeof document !== 'undefined' && state.theme) {
          if (state.theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      },
    }
  )
);
