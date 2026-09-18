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

const { STORAGE_NAME, partialize, rehydratePersistedState, safeLocalStorage } = await import('./persist');
import type { ScheduleState } from './types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(STORAGE_NAME === 'uniplan_schedule_storage_v2', 'persist name is frozen');

const partial = partialize({
  plans: [{ id: 'plan_1', name: 'Plan A', courses: [] }],
  activePlanId: 'plan_1',
  ghostPlanIds: ['plan_x'],
  catalogCourses: [],
  showWeekends: true,
  startHour: 8,
  endHour: 18,
  theme: 'dark',
  past: [],
  future: [],
} as ScheduleState);

const keys = Object.keys(partial).sort();
assert(
  keys.join(',') === 'activePlanId,catalogCourses,endHour,plans,showWeekends,startHour,theme',
  `partialize key set exact, got ${keys.join(',')}`
);
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

const boom = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
  removeItem() { throw new Error('blocked'); },
};
Object.defineProperty(globalThis, 'localStorage', { value: boom, configurable: true });
assert(safeLocalStorage.getItem('x') === null, 'throwing getItem returns null');
safeLocalStorage.setItem('x', 'y');
safeLocalStorage.removeItem('x');
installMemoryLocalStorage();

console.log('persist.rehydrate tests passed');
