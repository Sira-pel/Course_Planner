import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_CANDIDATES } from './generatorPrefs';
import { shouldClearVisiblePicks } from './visiblePicks';

describe('visible course picks', () => {
  it('clears when every visible course is picked', () => {
    const visible = ['CS 101', 'MATH 201', 'PHYS 105'];
    assert.equal(shouldClearVisiblePicks(visible, new Set(visible)), true);
    assert.equal(shouldClearVisiblePicks(visible, new Set(['CS 101'])), false);
    assert.equal(shouldClearVisiblePicks([], new Set(visible)), false);
  });

  it('clears a 15-course cap when the pool has more courses than All can pick', () => {
    const visible = Array.from({ length: MAX_CANDIDATES + 1 }, (_, index) => `C${index + 1}`);
    const capped = new Set(visible.slice(0, MAX_CANDIDATES));
    assert.equal(capped.size, MAX_CANDIDATES);
    assert.equal(visible.every((key) => capped.has(key)), false);
    assert.equal(shouldClearVisiblePicks(visible, capped), true);
    assert.equal(shouldClearVisiblePicks(visible, new Set(visible.slice(0, MAX_CANDIDATES - 1))), false);
  });
});
