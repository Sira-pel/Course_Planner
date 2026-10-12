import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { useScheduleStore } from '../store/useScheduleStore';
import type { SchedulePlan } from '../types/schedule';
import {
  BACKUP_EMPTY_ERROR,
  BACKUP_READ_ERROR,
  backupReplaceMessage,
  loadBackup,
} from './backupRestore';

function backup(startTime: string, endTime: string): string {
  return JSON.stringify({
    version: 2,
    activePlanId: 'plan_b',
    plans: [{
      id: 'plan_b',
      name: 'Backup',
      courses: [{
        id: 'c1',
        code: 'CS 101',
        name: 'Intro',
        credits: 3,
        color: '#3B82F6',
        sessions: [{ id: 's1', day: 'monday', startTime, endTime, room: 'Hall' }],
      }],
    }],
    catalogCourses: [],
  });
}

function sessionTimes(json: string): { startTime: string; endTime: string } {
  const loaded = loadBackup(json);
  assert.equal(loaded.ok, true);
  if (!loaded.ok) throw new Error('expected a backup');
  const session = loaded.backup.plans[0].courses[0].sessions[0];
  return { startTime: session.startTime, endTime: session.endTime };
}

describe('backup restore', () => {
  it('round-trips a 09:00-10:00 session exactly', () => {
    assert.deepEqual(sessionTimes(backup('09:00', '10:00')), { startTime: '09:00', endTime: '10:00' });
    assert.deepEqual(sessionTimes(backup('9:00 AM', '10:00 AM')), { startTime: '09:00', endTime: '10:00' });
    assert.deepEqual(sessionTimes(backup('09:00:00', '10:00:00')), { startTime: '09:00', endTime: '10:00' });
    assert.deepEqual(sessionTimes(backup('0900', '1000')), { startTime: '09:00', endTime: '10:00' });

    const once = loadBackup(backup('09:00', '10:00'));
    assert.equal(once.ok, true);
    if (!once.ok) return;
    const twice = loadBackup(JSON.stringify({ version: 2, plans: once.backup.plans }));
    assert.equal(twice.ok, true);
    if (!twice.ok) return;
    const session = twice.backup.plans[0].courses[0].sessions[0];
    assert.equal(session.startTime, '09:00');
    assert.equal(session.endTime, '10:00');
  });

  it('describes what the backup will replace', () => {
    assert.equal(
      backupReplaceMessage({ plans: 2, courses: 5 }, { plans: 1, courses: 3 }),
      "This replaces your 2 plans and 5 courses with the backup's 1 plan and 3 courses. You can undo it.",
    );
    assert.equal(
      backupReplaceMessage({ plans: 1, courses: 1 }, { plans: 1, courses: 1 }),
      "This replaces your 1 plan and 1 course with the backup's 1 plan and 1 course. You can undo it.",
    );
    const loaded = loadBackup(backup('09:00', '10:00'));
    assert.equal(loaded.ok, true);
    if (loaded.ok) {
      assert.equal(loaded.backup.plans.length, 1);
      assert.equal(loaded.backup.plans[0].courses.length, 1);
    }
  });

  it('returns a plain error for a corrupt backup and does not change saved data', () => {
    for (const raw of ['{', 'not json', '[]', '{"plans":']) {
      const loaded = loadBackup(raw);
      assert.equal(loaded.ok, false);
      if (!loaded.ok) {
        assert.equal(loaded.error, BACKUP_READ_ERROR);
        assert.equal(loaded.error.includes('Unexpected'), false);
        assert.equal(loaded.error.includes('position'), false);
      }
    }
    const empty = loadBackup('{"version":2,"plans":[]}');
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(empty.error, BACKUP_EMPTY_ERROR);

    const original: SchedulePlan[] = [{
      id: 'plan_1',
      name: 'Plan A',
      courses: [{
        id: 'kept',
        code: 'MATH 221',
        name: 'Calculus',
        credits: 3,
        color: '#10B981',
        sessions: [{ id: 's-kept', day: 'tuesday', startTime: '08:00', endTime: '09:00' }],
      }],
    }];
    useScheduleStore.setState({
      plans: original,
      catalogCourses: [],
      activePlanId: 'plan_1',
      ghostPlanIds: [],
      past: [],
      future: [],
    });

    const corrupt = useScheduleStore.getState().importFullState('{');
    assert.equal(corrupt.success, false);
    assert.equal(corrupt.error, BACKUP_READ_ERROR);
    assert.equal(useScheduleStore.getState().plans[0].courses[0].sessions[0].startTime, '08:00');
    assert.equal(useScheduleStore.getState().past.length, 0);

    const restored = useScheduleStore.getState().importFullState(backup('09:00', '10:00'));
    assert.equal(restored.success, true);
    const session = useScheduleStore.getState().plans[0].courses[0].sessions[0];
    assert.equal(session.startTime, '09:00');
    assert.equal(session.endTime, '10:00');
    assert.equal(useScheduleStore.getState().canUndo(), true);
    useScheduleStore.getState().undo();
    assert.equal(useScheduleStore.getState().plans[0].id, 'plan_1');
    assert.equal(useScheduleStore.getState().plans[0].courses[0].sessions[0].startTime, '08:00');
    assert.equal(useScheduleStore.getState().plans[0].courses[0].sessions[0].endTime, '09:00');
  });
});
