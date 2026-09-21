import { createPrefsSlice } from './prefsSlice';
import type { HistorySnapshot, ScheduleState, StoreGet, StoreSet } from './types';
import type { Course, SchedulePlan } from '../types/schedule';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function installMemoryLocalStorage(): void {
  const map = new Map<string, string>();
  const mem = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => { map.clear(); },
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: mem, configurable: true });
}

installMemoryLocalStorage();

const keepCourse: Course = {
  id: 'cat_keep',
  code: 'KEEP',
  name: 'Keep Course',
  credits: 3,
  color: '#3B82F6',
  sessions: [],
};

const backupCourse: Course = {
  id: 'c_backup',
  code: 'CS101',
  name: 'Intro',
  credits: 4,
  color: '#10B981',
  sessions: [],
};

const planA: SchedulePlan = { id: 'plan_1', name: 'Plan A', courses: [] };

function createFake(extras: Partial<ScheduleState> = {}) {
  let state = {
    plans: [planA],
    activePlanId: 'plan_1',
    ghostPlanIds: [] as string[],
    catalogCourses: [keepCourse],
    past: [] as HistorySnapshot[],
    future: [] as HistorySnapshot[],
    showWeekends: false,
    startHour: 7,
    endHour: 17,
    theme: 'light' as const,
    semesterStart: '2026-09-01',
    semesterEnd: '2026-12-18',
    ...extras,
  } as ScheduleState;

  const get: StoreGet = () => state;
  const set: StoreSet = (partial) => {
    const resolved = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...resolved };
  };

  const slice = createPrefsSlice(set, get);
  Object.assign(state, slice);
  return { get, slice };
}

const missingCatalog = createFake();
const missingRes = missingCatalog.slice.importFullState(JSON.stringify({
  plans: [{ id: 'plan_z', name: 'Imported', courses: [] }],
  activePlanId: 'plan_z',
}));
assert(missingRes.success === true, 'backup without catalog key succeeds');
assert(missingCatalog.get().catalogCourses.length === 1, 'missing catalogCourses keeps current catalog');
assert(missingCatalog.get().catalogCourses[0].id === 'cat_keep', 'kept catalog course is unchanged');

const emptyCatalog = createFake();
const emptyRes = emptyCatalog.slice.importFullState(JSON.stringify({
  plans: [{ id: 'plan_z', name: 'Imported', courses: [] }],
  catalogCourses: [],
}));
assert(emptyRes.success === true, 'backup with empty catalog succeeds');
assert(emptyCatalog.get().catalogCourses.length === 0, 'empty catalogCourses array replaces current catalog');

const prefsStore = createFake({ theme: 'light', showWeekends: false, startHour: 7, endHour: 17 });
const prefsRes = prefsStore.slice.importFullState(JSON.stringify({
  version: 1,
  plans: [{ id: 'plan_z', name: 'Imported', courses: [backupCourse] }],
  activePlanId: 'plan_z',
  catalogCourses: [backupCourse],
  showWeekends: true,
  startHour: 8,
  endHour: 18,
  theme: 'dark',
  semesterStart: '2025-01-13',
  semesterEnd: '2025-05-02',
}));
assert(prefsRes.success === true, 'prefs backup restores');
assert(prefsStore.get().showWeekends === true, 'showWeekends restored');
assert(prefsStore.get().startHour === 8, 'startHour restored');
assert(prefsStore.get().endHour === 18, 'endHour restored');
assert(prefsStore.get().theme === 'dark', 'theme restored');
assert(prefsStore.get().semesterStart === '2025-01-13', 'semesterStart restored');
assert(prefsStore.get().semesterEnd === '2025-05-02', 'semesterEnd restored');
assert(localStorage.getItem('uniplan_theme') === 'dark', 'restored theme is persisted');

const badTheme = createFake({ theme: 'light' });
badTheme.slice.importFullState(JSON.stringify({
  plans: [{ id: 'plan_z', name: 'Imported', courses: [] }],
  theme: 'sepia',
  showWeekends: true,
}));
assert(badTheme.get().theme === 'light', 'invalid theme is not applied');
assert(badTheme.get().showWeekends === true, 'valid prefs still restore when theme is invalid');

const noVersion = createFake();
const noVersionRes = noVersion.slice.importFullState(JSON.stringify({
  plans: [{ id: 'plan_z', name: 'Imported', courses: [] }],
  showWeekends: true,
}));
assert(noVersionRes.success === true, 'backup without version still imports (treated as current-1)');
assert(noVersion.get().showWeekends === true, 'unversioned backup still restores prefs');

console.log('prefsSlice import tests passed');
