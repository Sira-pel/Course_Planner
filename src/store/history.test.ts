import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SchedulePlan } from '../types/schedule';
import {
  commitWithHistory,
  createHistorySlice,
  createHistorySnapshot,
  restoreViewFromSnapshot,
} from './history';
import type { HistorySnapshot, ScheduleState, StoreGet, StoreSet } from './types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const planA: SchedulePlan = { id: 'plan_1', name: 'Plan A', courses: [] };
const planB: SchedulePlan = { id: 'plan_2', name: 'Plan B', courses: [] };

function blankSnapshot(overrides: Partial<HistorySnapshot> = {}): HistorySnapshot {
  return {
    plans: [planA],
    catalogCourses: [],
    activePlanId: 'plan_1',
    ghostPlanIds: [],
    ...overrides,
  };
}

function createFakeStore(initial: Partial<ScheduleState>) {
  let state = {
    plans: [planA],
    catalogCourses: [] as ScheduleState['catalogCourses'],
    activePlanId: 'plan_1',
    ghostPlanIds: [] as string[],
    past: [] as HistorySnapshot[],
    future: [] as HistorySnapshot[],
    ...initial,
  } as ScheduleState;

  const get: StoreGet = () => state;
  const set: StoreSet = (partial) => {
    const resolved = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...resolved };
  };

  Object.assign(state, createHistorySlice(set, get));
  return { get, set };
}

const { get, set } = createFakeStore({
  future: [blankSnapshot({ plans: [planB], activePlanId: 'plan_2' })],
});

commitWithHistory(set, get, { plans: [planA, planB], activePlanId: 'plan_2' });
assert(get().past.length === 1, 'commitWithHistory pushes a snapshot');
assert(get().past[0].activePlanId === 'plan_1', 'snapshot captures pre-commit active plan');
assert(get().future.length === 0, 'commitWithHistory clears future');
assert(get().plans.length === 2, 'commitWithHistory applies the patch');
assert(get().activePlanId === 'plan_2', 'commitWithHistory applies activePlanId');

const stale = restoreViewFromSnapshot(blankSnapshot({
  plans: [planB],
  activePlanId: 'gone',
  ghostPlanIds: ['plan_2', 'missing', 'gone'],
}));
assert(stale.activePlanId === 'plan_2', 'restoreViewFromSnapshot repairs missing activePlanId');
assert(stale.ghostPlanIds.length === 0, 'restoreViewFromSnapshot drops stale ghosts and the active plan');

const keepGhost = restoreViewFromSnapshot(blankSnapshot({
  plans: [planA, planB],
  activePlanId: 'plan_1',
  ghostPlanIds: ['plan_2', 'missing'],
}));
assert(keepGhost.activePlanId === 'plan_1', 'valid activePlanId is kept');
assert(keepGhost.ghostPlanIds.join(',') === 'plan_2', 'only live non-active ghosts remain');

const cloned = createHistorySnapshot({
  plans: [planA],
  catalogCourses: [],
  activePlanId: 'plan_1',
  ghostPlanIds: ['g1'],
});
cloned.plans[0].name = 'Mutated';
assert(planA.name === 'Plan A', 'createHistorySnapshot clones plans');

const undoStore = createFakeStore({
  plans: [planA, planB],
  activePlanId: 'plan_2',
  past: [blankSnapshot()],
  future: [blankSnapshot({ plans: [planB], activePlanId: 'plan_2' })],
});
undoStore.get().undo();
assert(undoStore.get().past.length === 0, 'undo pops past');
assert(undoStore.get().future.length === 2, 'undo pushes current onto future instead of clearing it');
assert(undoStore.get().activePlanId === 'plan_1', 'undo restores snapshot view');
assert(undoStore.get().plans.length === 1, 'undo restores snapshot plans');

const redoStore = createFakeStore({
  plans: [planA],
  activePlanId: 'plan_1',
  past: [],
  future: [blankSnapshot({ plans: [planA, planB], activePlanId: 'plan_2' })],
});
redoStore.get().redo();
assert(redoStore.get().future.length === 0, 'redo pops future');
assert(redoStore.get().past.length === 1, 'redo pushes current onto past');
assert(redoStore.get().activePlanId === 'plan_2', 'redo restores next snapshot');

const historySrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'history.ts'), 'utf8');
const undoBody = historySrc.slice(historySrc.indexOf('undo:'), historySrc.indexOf('redo:'));
const redoBody = historySrc.slice(historySrc.indexOf('redo:'), historySrc.indexOf('canUndo:'));
assert(!undoBody.includes('commitWithHistory'), 'undo must not call commitWithHistory');
assert(!redoBody.includes('commitWithHistory'), 'redo must not call commitWithHistory');

console.log('history tests passed');
