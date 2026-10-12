import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { GeneratorResult } from './planGenerator';
import {
  holdGeneratorSearch,
  nextShownCount,
  readGeneratorSession,
  reopenGeneratorStep,
  retainPreviewId,
  shownCountAfterSearch,
  stampPickedCourses,
  withCourseFreshness,
  writeGeneratorSession,
  type GeneratorSession,
  type StampedCourse,
} from './generatorSession';

const emptyResult: GeneratorResult = {
  plans: [],
  evaluated: 0,
  validCount: 0,
  capped: false,
  estimate: 0,
  emptyReason: null,
  dayOffNotices: [],
};

function session(patch: Partial<GeneratorSession> = {}): GeneratorSession {
  return {
    step: 1,
    picked: ['CS 101', 'MATH 221'],
    pinned: ['CS 101'],
    lockedIds: [],
    excludedIds: [],
    blocked: [],
    result: emptyResult,
    previewId: null,
    shownCount: 5,
    courseStamp: null,
    outdated: false,
    ...patch,
  };
}

function course(patch: Partial<StampedCourse> & Pick<StampedCourse, 'id' | 'code'>): StampedCourse {
  return {
    name: patch.code,
    section: '001',
    credits: 3,
    sessions: [{ day: 'monday', startTime: '09:00', endTime: '10:00' }],
    ...patch,
  };
}

describe('generator session', () => {
  afterEach(() => {
    writeGeneratorSession(session({ picked: [], pinned: [], result: null, step: 1, shownCount: 5 }));
    holdGeneratorSearch(null);
  });

  it('remembers the courses that were picked and the last result', () => {
    writeGeneratorSession(session());
    const stored = readGeneratorSession();
    assert.deepEqual(stored?.picked, ['CS 101', 'MATH 221']);
    assert.deepEqual(stored?.pinned, ['CS 101']);
    assert.equal(stored?.result, emptyResult);
    assert.equal(reopenGeneratorStep(stored), 1);
  });

  it('reopens on the results when a finished run is still stored', () => {
    const finished = session({ step: 3, shownCount: 10 });
    assert.equal(reopenGeneratorStep(finished), 3);
    assert.equal(finished.shownCount, 10);
  });

  it('does not reopen on an unfinished search', () => {
    assert.equal(reopenGeneratorStep(session({ step: 3, result: null })), 2);
    assert.equal(reopenGeneratorStep(null), 1);
  });

  it('remembers how many groups were shown', () => {
    writeGeneratorSession(session({ step: 3, shownCount: 15 }));
    assert.equal(readGeneratorSession()?.shownCount, 15);
    assert.equal(nextShownCount(5, 12), 10);
    assert.equal(nextShownCount(10, 12), 12);
    assert.equal(nextShownCount(12, 12), 12);
  });

  it('keeps every shown plan when a deeper search adds groups', () => {
    assert.equal(shownCountAfterSearch(5, 0, 20), 5);
    assert.equal(shownCountAfterSearch(5, 12, 15), 5);
    assert.equal(shownCountAfterSearch(12, 12, 15), 15);
    assert.equal(shownCountAfterSearch(3, 3, 3), 3);
  });

  it('keeps the preview on the same group when a better section mix replaces it', () => {
    const previous = [{ id: 'old', groupKey: 'CS 101|MATH 221' }];
    const next = [
      { id: 'better', groupKey: 'CS 101|MATH 221' },
      { id: 'other', groupKey: 'CS 101|ENGL 110' },
    ];
    assert.equal(retainPreviewId(previous, next, 'old'), 'better');
    assert.equal(retainPreviewId(previous, next, 'missing'), 'missing');
    assert.equal(retainPreviewId(previous, next, null), null);
  });

  it('marks remembered results outdated when a picked course is edited or deleted', () => {
    const courses = [
      course({ id: 'cs', code: 'CS 101', name: 'Intro' }),
      course({ id: 'math', code: 'MATH 221' }),
      course({ id: 'engl', code: 'ENGL 110' }),
    ];
    const stamp = stampPickedCourses(courses, ['CS 101', 'MATH 221']);
    const stored = session({ step: 3, courseStamp: stamp, shownCount: 10 });

    const edited = withCourseFreshness(stored, [
      course({ id: 'cs', code: 'CS 101', name: 'Intro to CS' }),
      course({ id: 'math', code: 'MATH 221' }),
      course({ id: 'engl', code: 'ENGL 110', name: 'Changed title' }),
    ]);
    assert.equal(edited.outdated, true);
    assert.equal(edited.result, emptyResult);
    assert.equal(edited.shownCount, 10);

    const deleted = withCourseFreshness(stored, [
      course({ id: 'math', code: 'MATH 221' }),
    ]);
    assert.equal(deleted.outdated, true);

    const same = withCourseFreshness(stored, courses);
    assert.equal(same, stored);

    const restored = withCourseFreshness(edited, courses);
    assert.equal(restored.outdated, false);
  });
});
