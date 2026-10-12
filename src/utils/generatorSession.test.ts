import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { GeneratorResult } from './planGenerator';
import {
  readGeneratorSession,
  reopenGeneratorStep,
  writeGeneratorSession,
  type GeneratorSession,
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
    ...patch,
  };
}

describe('generator session', () => {
  afterEach(() => {
    writeGeneratorSession(session({ picked: [], pinned: [], result: null, step: 1 }));
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
    const finished = session({ step: 3 });
    assert.equal(reopenGeneratorStep(finished), 3);
  });

  it('does not reopen on an unfinished search', () => {
    assert.equal(reopenGeneratorStep(session({ step: 3, result: null })), 2);
    assert.equal(reopenGeneratorStep(null), 1);
  });
});
