import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Course } from '../types/schedule';
import { formatSessionLines, groupPoolCourses } from './poolGroups';

function course(id: string, code: string, section: string): Course {
  return { id, code, name: code, section, credits: 3, color: '#000000', sessions: [] };
}

describe('groupPoolCourses', () => {
  it('groups sections by normalized code and keeps first-seen order', () => {
    const groups = groupPoolCourses([
      course('1', 'ACCT 201', '001'),
      course('2', 'MATH 101', '001'),
      course('3', 'acct  201', '002'),
    ]);
    assert.deepEqual(groups.map((g) => g.courses.map((c) => c.id)), [['1', '3'], ['2']]);
  });
});

describe('formatSessionLines', () => {
  const s = (day: 'monday' | 'wednesday' | 'friday', startTime: string, endTime: string) => ({
    id: `${day}${startTime}`, day, startTime, endTime,
  });

  it('merges days that share a time range and drops a repeated meridiem', () => {
    assert.deepEqual(
      formatSessionLines([s('wednesday', '15:30', '17:00'), s('monday', '15:30', '17:00')]),
      ['Mon, Wed 3:30–5:00 PM'],
    );
  });

  it('keeps both meridiems when the range crosses noon and splits differing ranges', () => {
    assert.deepEqual(
      formatSessionLines([s('monday', '11:00', '13:00'), s('friday', '09:00', '10:30')]),
      ['Mon 11:00 AM–1:00 PM', 'Fri 9:00–10:30 AM'],
    );
  });
});
