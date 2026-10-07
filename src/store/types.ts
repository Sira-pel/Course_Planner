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
  timeRangeMode: 'auto' | 'custom';
  weekStart: 'monday' | 'sunday';
  mobileCalendarView: 'week' | 'day';
  theme: 'light' | 'dark';
  themePreference: 'light' | 'dark' | 'system';
  semesterStart: string;
  semesterEnd: string;

  // History for Undo/Redo
  past: HistorySnapshot[];
  future: HistorySnapshot[];

  // Plan actions
  setActivePlan: (planId: string) => void;
  createPlan: (name?: string) => string;
  duplicatePlan: (planId: string, name?: string) => string;
  renamePlan: (planId: string, newName: string) => void;
  deletePlan: (planId: string) => void;
  toggleGhostPlan: (planId: string) => void;
  clearGhostPlans: () => void;
  importPlan: (plan: SchedulePlan, asGhost?: boolean) => string;

  // Course actions
  addCourse: (course: Course, targetPlanId?: string) => void;
  updateCourse: (course: Course, targetPlanId?: string) => void;
  deleteCourse: (courseId: string, targetPlanId?: string) => void;
  bulkAddCourses: (newCourses: Course[], targetPlanId?: string) => void;
  getNextColor: (targetPlanId?: string) => string;

  // Catalog Pool actions
  addToCatalog: (course: Course) => void;
  bulkAddToCatalog: (courses: Course[]) => void;
  removeFromCatalog: (courseId: string) => void;
  updateCatalogCourse: (course: Course) => void;
  toggleCourseInPlan: (catalogCourseId: string, targetPlanId?: string) => void;
  addCourseFromPool: (catalogCourseId: string, targetPlanId?: string) => void;
  removeCourseFromPlanByCatalog: (catalogCourseId: string, targetPlanId?: string) => void;
  clearUnusedCatalogCourses: () => void;

  // Undo / Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Settings, Shortcuts & Reset
  customShortcuts: Record<string, string>;
  setCustomShortcut: (actionId: string, shortcut: string) => void;
  resetCustomShortcuts: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setThemePreference: (preference: 'light' | 'dark' | 'system') => void;
  commitTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setShowWeekends: (show: boolean) => void;
  setTimeRange: (startHour: number, endHour: number) => void;
  setTimeRangeMode: (mode: 'auto' | 'custom') => void;
  setWeekStart: (weekStart: 'monday' | 'sunday') => void;
  setMobileCalendarView: (view: 'week' | 'day') => void;
  setSemesterDates: (start: string, end: string) => void;
  resetToBlank: () => void;
  resetToSample: () => void;
  importFullState: (jsonString: string) => { success: boolean; error?: string };
}

export type PersistedSchedule = Pick<
  ScheduleState,
  | 'plans'
  | 'activePlanId'
  | 'catalogCourses'
  | 'showWeekends'
  | 'startHour'
  | 'endHour'
  | 'timeRangeMode'
  | 'weekStart'
  | 'mobileCalendarView'
  | 'theme'
  | 'themePreference'
  | 'semesterStart'
  | 'semesterEnd'
  | 'customShortcuts'
> & {
  version: number;
};

export type StoreSet = StoreApi<ScheduleState>['setState'];
export type StoreGet = StoreApi<ScheduleState>['getState'];
