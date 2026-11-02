import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SAMPLE_PLANS } from '../data/sampleSemester';
import { DEMO_COURSE_COUNT, DEMO_PLAN_COUNT, shouldConfirmLoadDemo } from './loadDemo';

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

describe('demo counts on the welcome card', () => {
  it('match the sample semester', () => {
    assert.equal(DEMO_COURSE_COUNT, SAMPLE_PLANS.reduce((sum, plan) => sum + plan.courses.length, 0));
    assert.equal(DEMO_PLAN_COUNT, SAMPLE_PLANS.length);
  });
});
