import type { ScheduleState } from './types';
import { persistTheme } from '../utils/theme';
import { clearStorageWriteFailure, getStorageWriteError } from './storageWrite';

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

const {
  STORAGE_NAME,
  PERSIST_SCHEMA_VERSION,
  DEFAULT_SEMESTER_START,
  DEFAULT_SEMESTER_END,
  partialize,
  rehydratePersistedState,
  migratePersistedSchedule,
  resolvePersistedVersion,
  applyMissingPersistVersion,
  safeLocalStorage,
} = await import('./persist');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(STORAGE_NAME === 'uniplan_schedule_storage_v2', 'persist name is frozen');
assert(PERSIST_SCHEMA_VERSION === 1, 'current persist schema version is 1');
assert(resolvePersistedVersion(undefined) === 0, 'missing version is current-1');
assert(resolvePersistedVersion(null) === 0, 'null version is current-1');
assert(resolvePersistedVersion(1) === 1, 'numeric version is kept');

const migrated = migratePersistedSchedule({ plans: [], showWeekends: true }, undefined);
assert(migrated.version === 1, 'migrate stamps current version');
assert(migrated.semesterStart === DEFAULT_SEMESTER_START, 'v0 migrate fills semesterStart');
assert(migrated.semesterEnd === DEFAULT_SEMESTER_END, 'v0 migrate fills semesterEnd');
assert(migrated.showWeekends === true, 'migrate preserves existing prefs');

const v1KeepDates = migratePersistedSchedule(
  { semesterStart: '2025-01-13', semesterEnd: '2025-05-02' },
  1
);
assert(v1KeepDates.semesterStart === '2025-01-13', 'v1 migrate keeps semesterStart');
assert(v1KeepDates.version === 1, 'v1 migrate still stamps current version');

assert(applyMissingPersistVersion(null) === null, 'null storage value stays null');
assert(applyMissingPersistVersion({ state: { a: 1 } })?.version === 0, 'wrapper without version becomes current-1');
assert(applyMissingPersistVersion({ state: { a: 1 }, version: 1 })?.version === 1, 'wrapper with version is unchanged');

const partial = partialize({
  plans: [{ id: 'plan_1', name: 'Plan A', courses: [] }],
  activePlanId: 'plan_1',
  ghostPlanIds: ['plan_x'],
  catalogCourses: [],
  showWeekends: true,
  startHour: 8,
  endHour: 18,
  theme: 'dark',
  semesterStart: '2026-09-01',
  semesterEnd: '2026-12-18',
  past: [],
  future: [],
} as ScheduleState);

const keys = Object.keys(partial).sort();
assert(
  keys.join(',') === 'activePlanId,catalogCourses,endHour,plans,semesterEnd,semesterStart,showWeekends,startHour,theme,version',
  `partialize key set exact, got ${keys.join(',')}`
);
assert(partial.version === 1, 'partialize writes schema version');
assert(!('past' in partial), 'past is not persisted');
assert(!('future' in partial), 'future is not persisted');
assert(!('ghostPlanIds' in partial), 'ghostPlanIds is not persisted');

const emptyPlans = {
  plans: [],
  activePlanId: 'missing',
  catalogCourses: [{ id: 'keep' }],
  showWeekends: false,
  startHour: 7,
  endHour: 17,
  theme: 'light',
} as unknown as ScheduleState;
rehydratePersistedState(emptyPlans);
assert(emptyPlans.plans.length === 1, 'empty plans become one default plan');
assert(emptyPlans.plans[0].id === 'plan_1', 'default plan id is plan_1');
assert(emptyPlans.plans[0].name === 'Plan A', 'default plan name is Plan A');
assert(emptyPlans.activePlanId === 'plan_1', 'activePlanId is repaired to plan_1');
assert(emptyPlans.semesterStart === DEFAULT_SEMESTER_START, 'missing semesterStart is defaulted');
assert(emptyPlans.semesterEnd === DEFAULT_SEMESTER_END, 'missing semesterEnd is defaulted');

const badPlans = {
  plans: [null, 'bad'],
  activePlanId: 'x',
  catalogCourses: [],
  theme: 'light',
} as unknown as ScheduleState;
rehydratePersistedState(badPlans);
assert(badPlans.plans.length === 1 && badPlans.plans[0].id === 'plan_1', 'unsanitizable plans become Plan A');

const badCatalog = {
  plans: [{ id: 'plan_1', name: 'Plan A', courses: [] }],
  activePlanId: 'plan_1',
  catalogCourses: 'nope',
  theme: 'light',
} as unknown as ScheduleState;
rehydratePersistedState(badCatalog);
assert(Array.isArray(badCatalog.catalogCourses) && badCatalog.catalogCourses.length === 0, 'non-array catalog becomes []');

localStorage.setItem('uniplan_theme', 'dark');
const themed = {
  plans: [{ id: 'plan_1', name: 'Plan A', courses: [] }],
  activePlanId: 'plan_1',
  catalogCourses: [],
  theme: 'light',
} as unknown as ScheduleState;
rehydratePersistedState(themed);
assert(themed.theme === 'dark', 'preferred uniplan_theme wins over persisted theme');
assert(localStorage.getItem('uniplan_theme') === 'dark', 'preferred theme is written back');

clearStorageWriteFailure();
const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem('keep', '1');
localStorage.setItem = () => {
  throw Object.assign(new Error('quota'), { name: 'QuotaExceededError', code: 22 });
};
safeLocalStorage.setItem('uniplan_schedule_storage_v2', '{}');
assert(getStorageWriteError() === 'quota', 'setItem quota failure is not swallowed');
clearStorageWriteFailure();
persistTheme('dark');
assert(getStorageWriteError() === 'quota', 'persistTheme quota failure is not swallowed');
localStorage.setItem = originalSetItem;
clearStorageWriteFailure();
safeLocalStorage.setItem('uniplan_schedule_storage_v2', '{"ok":true}');
assert(getStorageWriteError() === null, 'successful setItem clears the warning');

console.log('persist.rehydrate tests passed');
