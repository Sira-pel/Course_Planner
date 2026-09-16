import type { StoreApi } from 'zustand';
import type { Course, SchedulePlan } from '../types/schedule';

export interface HistorySnapshot {
  plans: SchedulePlan[];
  catalogCourses: Course[];
  activePlanId: string;
  ghostPlanIds: string[];
}

export interface ScheduleState {
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

export type PersistedSchedule = Pick<
  ScheduleState,
  'plans' | 'activePlanId' | 'catalogCourses' | 'showWeekends' | 'startHour' | 'endHour' | 'theme'
>;

export type StoreSet = StoreApi<ScheduleState>['setState'];
export type StoreGet = StoreApi<ScheduleState>['getState'];
