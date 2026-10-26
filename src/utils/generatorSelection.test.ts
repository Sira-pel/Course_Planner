import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_CANDIDATES } from './generatorPrefs';
import { liveGeneratorSelection, settledGeneratorSelection } from './generatorSelection';

describe('generator selection stays inside the pool', () => {
  it('drops picked and pinned keys that are no longer in the pool and sizes the plan from what remains', () => {
    const pool = new Set(['CS 101', 'MATH 201']);
    const picked = ['CS 101', 'GONE', 'MATH 201', 'EXTRA'];
    const pinned = ['GONE', 'CS 101'];
    const selection = liveGeneratorSelection(picked, pinned, pool);

    assert.deepEqual(selection.picked, ['CS 101', 'MATH 201']);
    assert.deepEqual(selection.pinned, ['CS 101']);
    assert.equal(selection.pickedCount, 2);
    assert.equal(selection.pinnedCount, 1);
    assert.equal(selection.courseMin, 2);
    assert.equal(selection.courseMax, 2);
    assert.equal(selection.atCap, false);

    const ghosts = Array.from({ length: MAX_CANDIDATES }, (_, index) => `GHOST ${index + 1}`);
    const full = liveGeneratorSelection([...pool, ...ghosts], ['CS 101', ...ghosts], pool);
    assert.equal(full.pickedCount, 2);
    assert.equal(full.pinnedCount, 1);
    assert.equal(full.atCap, false);
    assert.equal(full.courseMax, 2);

    const cappedKeys = Array.from({ length: MAX_CANDIDATES }, (_, index) => `C${index + 1}`);
    const capped = liveGeneratorSelection(
      [...cappedKeys, 'GONE'],
      ['GONE'],
      new Set(cappedKeys),
    );
    assert.equal(capped.pickedCount, MAX_CANDIDATES);
    assert.equal(capped.pinnedCount, 0);
    assert.equal(capped.atCap, true);
    assert.equal(capped.courseMin, 2);
    assert.equal(capped.courseMax, MAX_CANDIDATES);
  });
});

describe('saved picks survive a pool that has not loaded', () => {
  it('keeps picked and pinned keys when the pool is empty and prunes once it has courses', () => {
    const empty = settledGeneratorSelection(['CS 101', 'MATH 201'], ['CS 101'], new Set());
    assert.deepEqual(empty.picked, ['CS 101', 'MATH 201']);
    assert.deepEqual(empty.pinned, ['CS 101']);

    const loaded = settledGeneratorSelection(['CS 101', 'MATH 201'], ['CS 101'], new Set(['MATH 201']));
    assert.deepEqual(loaded.picked, ['MATH 201']);
    assert.deepEqual(loaded.pinned, []);
  });
});
