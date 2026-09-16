import type { SchedulePlan } from '../types/schedule';
import { createPlanSlice } from './planSlice';
import type { HistorySnapshot, ScheduleState, StoreGet, StoreSet } from './types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function createFake(plans: SchedulePlan[], extras: Partial<ScheduleState> = {}) {
  let state = {
    plans,
    activePlanId: plans[0]?.id ?? 'plan_1',
    ghostPlanIds: [] as string[],
    catalogCourses: [] as ScheduleState['catalogCourses'],
    past: [] as HistorySnapshot[],
    future: [] as HistorySnapshot[],
    showWeekends: false,
    startHour: 7,
    endHour: 17,
    theme: 'light' as const,
    ...extras,
  } as ScheduleState;

  const get: StoreGet = () => state;
  const set: StoreSet = (partial) => {
    const resolved = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...resolved };
  };

  const slice = createPlanSlice(set, get);
  Object.assign(state, slice);
  return { get, slice };
}

const dupA: SchedulePlan = { id: 'dup', name: 'First', courses: [] };
const dupB: SchedulePlan = { id: 'dup', name: 'Second', courses: [] };
const dupStore = createFake([dupA, dupB], { activePlanId: 'dup' });
dupStore.slice.deletePlan('dup');
assert(dupStore.get().plans.length === 1, 'duplicate-id deletePlan removes one plan');
assert(dupStore.get().plans[0].name === 'Second', 'deletePlan filters by index, not id');
assert(dupStore.get().plans[0].id === 'dup', 'remaining duplicate id is kept');
assert(dupStore.get().past.length === 1, 'successful deletePlan snapshots history');
assert(dupStore.get().future.length === 0, 'deletePlan clears future');

const last: SchedulePlan = { id: 'only', name: 'Only', courses: [] };
const lastStore = createFake([last]);
lastStore.slice.deletePlan('only');
assert(lastStore.get().plans.length === 1, 'last-plan delete is a no-op');
assert(lastStore.get().plans[0].id === 'only', 'last plan is unchanged');
assert(lastStore.get().past.length === 0, 'last-plan delete does not snapshot');

const missingStore = createFake([
  { id: 'plan_1', name: 'Plan A', courses: [] },
  { id: 'plan_2', name: 'Plan B', courses: [] },
]);
missingStore.slice.deletePlan('nope');
assert(missingStore.get().plans.length === 2, 'missing id is a no-op');
assert(missingStore.get().past.length === 0, 'missing id does not snapshot');

console.log('planSlice tests passed');
