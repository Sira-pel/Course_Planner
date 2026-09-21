import { allocatePlanId, sanitizeCatalog, sanitizePlans } from './sanitize';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(sanitizePlans([]).length === 0, 'empty array yields no plans');
assert(sanitizePlans(undefined as unknown as never[]).length === 0, 'non-array yields no plans');
assert(sanitizePlans([null, 'bad']).length === 0, 'null and string entries yield no plans');

const dupes = sanitizePlans([
  { id: 'plan_1', name: 'First', courses: [] },
  { id: 'plan_1', name: 'Second', courses: [] },
]);
assert(dupes.length === 2, 'duplicate ids still produce two plans');
assert(dupes[0].id === 'plan_1', 'first plan keeps preferred id');
assert(dupes[1].id === 'plan_2', 'second duplicate is remapped');
assert(new Set(dupes.map((p) => p.id)).size === 2, 'sanitized plan ids are unique');

const used = new Set(['plan_1', 'plan_2']);
assert(allocatePlanId(used, 'plan_1') === 'plan_3', 'allocatePlanId skips used preferred id');
assert(allocatePlanId(used, 'plan_9') === 'plan_9', 'allocatePlanId keeps unused preferred id');

assert(sanitizeCatalog(undefined as unknown as never[]).length === 0, 'non-array catalog is empty');
assert(sanitizeCatalog([null, 1]).length === 0, 'bad catalog entries are dropped');

const catalog = sanitizeCatalog([{ code: 'cs 101', name: 'Intro', credits: 99 }]);
assert(catalog.length === 1, 'valid catalog row is kept');
assert(catalog[0].code === 'CS 101', 'catalog code is trimmed/uppercased');
assert(catalog[0].credits === 30, 'credits clamp at 30');

const emptySessions = sanitizeCatalog([{ id: 'c_empty', code: 'CS101', name: 'Intro', sessions: [] }]);
assert(emptySessions.length === 1, 'course with empty sessions is kept');
assert(emptySessions[0].sessions.length === 0, 'empty sessions stay empty');

const missingSessions = sanitizeCatalog([{ id: 'c_none', code: 'CS102', name: 'Intro 2' }]);
assert(missingSessions[0].sessions.length === 0, 'missing sessions stay empty');

const invalidOnly = sanitizeCatalog([{ id: 'c_bad', code: 'CS103', name: 'Intro 3', sessions: [null, 'bad'] }]);
assert(invalidOnly[0].sessions.length === 0, 'all-invalid sessions stay empty rather than inventing a meeting');

console.log('sanitize tests passed');
