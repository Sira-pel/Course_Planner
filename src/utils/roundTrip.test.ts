import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Course, SchedulePlan } from '../types/schedule';
import { generateIcsCalendar } from './icsExport';
import { parseIcsContent } from './icsImport';
import { parseQuickAdd } from './quickAdd';
import { generateScheduleText } from './textExport';

function fingerprint(course: Course) {
  const sessions = [...course.sessions]
    .map((session) => `${session.day} ${session.startTime}-${session.endTime} ${session.room || ''}`)
    .sort();
  return {
    code: course.code,
    section: course.section,
    name: course.name,
    instructor: course.instructor,
    credits: course.credits,
    sessions,
  };
}

const plan: SchedulePlan = {
  id: 'plan_a',
  name: 'Plan A',
  courses: [
    {
      id: 'c_math',
      code: 'MATH 234A',
      name: 'Analytic Geometry and Calculus I',
      section: '002',
      instructor: 'Sa MATH',
      credits: 4,
      color: '#3B82F6',
      sessions: [
        { id: 's1', day: 'tuesday', startTime: '10:15', endTime: '12:45', room: 'Lecture Theater C13.1 (TLC)' },
        { id: 's2', day: 'friday', startTime: '10:15', endTime: '12:45', room: 'Lecture Theater C13.1 (TLC)' },
      ],
    },
    {
      id: 'c_cosc',
      code: 'COSC 340',
      name: 'Networking Essentials',
      section: '001',
      instructor: 'Movsun KUY',
      credits: 3,
      color: '#10B981',
      sessions: [
        { id: 's3', day: 'monday', startTime: '08:30', endTime: '10:00', room: 'Classroom D29' },
        { id: 's4', day: 'wednesday', startTime: '08:30', endTime: '10:00', room: 'Classroom D29' },
      ],
    },
  ],
};

describe('export round trip', () => {
  it('reimports an .ics export as the same courses', () => {
    const ics = generateIcsCalendar(plan);
    const imported = parseIcsContent(ics).map(fingerprint).sort((a, b) => a.code.localeCompare(b.code));
    const original = plan.courses.map(fingerprint).sort((a, b) => a.code.localeCompare(b.code));
    assert.deepEqual(imported, original);
  });

  it('reimports copied standard text as the same courses', () => {
    const text = generateScheduleText(plan, 'standard');
    const parsed = parseQuickAdd(text);
    assert.equal(parsed.items.every((item) => item.success), true);
    const imported = parsed.items
      .map((item) => fingerprint(item.course!))
      .sort((a, b) => a.code.localeCompare(b.code));
    const original = plan.courses.map(fingerprint).sort((a, b) => a.code.localeCompare(b.code));
    assert.deepEqual(imported, original);
  });
});
