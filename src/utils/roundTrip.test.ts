import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COURSE_COLORS, type Course, type SchedulePlan } from '../types/schedule';
import { displayCourseColor } from './courseColorDisplay';
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
  it('exports the color a course is drawn in and reimports it as the same preset', () => {
    const colored: SchedulePlan = {
      id: 'plan_colors',
      name: 'Colors',
      courses: COURSE_COLORS.map((color, index) => ({
        id: `c_${index}`,
        code: `COLR ${100 + index}`,
        name: `Color course ${index}`,
        section: '001',
        credits: 3,
        color,
        sessions: [{ id: `s_${index}`, day: 'monday', startTime: '09:00', endTime: '10:00' }],
      })),
    };

    const ics = generateIcsCalendar(colored);
    for (const color of COURSE_COLORS) {
      assert.ok(ics.includes(`COLOR:${displayCourseColor(color).bg}`), `${color} is exported as its drawn shade`);
    }
    assert.equal(ics.includes('COLOR:#EF4444'), false);

    const imported = parseIcsContent(ics).sort((a, b) => a.code.localeCompare(b.code));
    assert.deepEqual(imported.map((course) => course.color), COURSE_COLORS);
  });

  it('keeps a custom color and still reads colors from older Uniplan exports', () => {
    const custom: SchedulePlan = {
      id: 'plan_custom',
      name: 'Custom',
      courses: [{ ...plan.courses[0], id: 'c_custom', color: '#123456' }],
    };
    const [reimported] = parseIcsContent(generateIcsCalendar(custom));
    assert.equal(reimported.color.toLowerCase(), '#123456');

    const older = generateIcsCalendar(plan).replace(/COLOR:#[0-9A-F]{6}/g, 'COLOR:#EF4444');
    const [oldCourse] = parseIcsContent(older);
    assert.equal(oldCourse.color, '#EF4444');
  });
});
