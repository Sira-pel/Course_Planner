import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldConfirmLoadDemo } from './loadDemo';

describe('load demo confirmation', () => {
  it('loads immediately when the only plan is empty and the pool is empty', () => {
    assert.equal(shouldConfirmLoadDemo([{ courses: [] }], 0), false);
  });

  it('asks before replacing courses, a filled pool, or extra plans', () => {
    assert.equal(shouldConfirmLoadDemo([{ courses: [{}] }], 0), true);
    assert.equal(shouldConfirmLoadDemo([{ courses: [] }], 2), true);
    assert.equal(shouldConfirmLoadDemo([{ courses: [] }, { courses: [] }], 0), true);
  });
});
