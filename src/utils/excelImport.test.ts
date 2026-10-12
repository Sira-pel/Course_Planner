import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  analyzeTabularRows,
  extractDays,
  parseExcelRowsToCourses,
  spreadsheetRejectionReason,
} from './excelImport';

function meetings(code: string, rows: (string | number | undefined)[][]) {
  const analyzed = analyzeTabularRows(rows);
  const parsed = parseExcelRowsToCourses(analyzed.rawRows, analyzed.dataStartRow, analyzed.detectedMapping);
  const course = parsed.courses.find((item) => item.code === code);
  assert.ok(course, `missing ${code}`);
  return {
    course,
    days: [...new Set(course.sessions.map((session) => session.day))].sort(),
    times: [...new Set(course.sessions.map((session) => `${session.startTime}-${session.endTime}`))],
    parsed,
  };
}

const DAY_SHEET = [
  ['Course', 'Title', 'Days', 'Time', 'Room', 'Instructor', 'Credits'],
  ['CS 101', 'Intro to CS', 'MWF', '9:00 AM - 9:50 AM', 'Rm 204', 'Ada Lovelace', '4'],
  ['MATH 221', 'Calculus II', 'TR', '10:30 AM - 11:45 AM', 'Newton 110', 'Isaac Newton', '4'],
  ['ENG 101', 'Composition', 'MW', '1:00 PM - 2:15 PM', 'Hall 3', 'Jane Austen', '3'],
  ['PHYS 111', 'Physics Lab', 'F', '2:00 PM - 4:00 PM', 'Lab B', 'Marie Curie', '1'],
  ['ART 110', 'Studio', 'Sa', '9:00 AM - 12:00 PM', 'Studio 1', 'Frida Kahlo', '3'],
  ['HIST 200', 'Survey', 'Mon, Wed', '11:00 AM - 12:15 PM', 'Hall 1', 'Howard Zinn', '3'],
  ['BIO 101', 'Biology', 'Monday Wednesday', '8:30 AM - 9:45 AM', 'Lab A', 'Lynn Margulis', '4'],
];

describe('spreadsheet days and credits', () => {
  it('reads compact and written day columns instead of landing every class on Monday', () => {
    assert.deepEqual(extractDays('MWF'), ['monday', 'wednesday', 'friday']);
    assert.deepEqual(extractDays('TR'), ['tuesday', 'thursday']);
    assert.deepEqual(extractDays('MW'), ['monday', 'wednesday']);
    assert.deepEqual(extractDays('F'), ['friday']);
    assert.deepEqual(extractDays('Sa'), ['saturday']);
    assert.deepEqual(extractDays('Mon, Wed'), ['monday', 'wednesday']);
    assert.deepEqual(extractDays('Monday Wednesday'), ['monday', 'wednesday']);
    assert.deepEqual(extractDays('Tuesday Friday'), ['tuesday', 'friday']);

    const cs = meetings('CS 101', DAY_SHEET);
    assert.deepEqual(cs.days, ['friday', 'monday', 'wednesday']);
    assert.deepEqual(cs.times, ['09:00-09:50']);
    assert.equal(cs.course.credits, 4);
    assert.equal(cs.course.sessions[0]?.room, 'Rm 204');

    assert.deepEqual(meetings('MATH 221', DAY_SHEET).days, ['thursday', 'tuesday']);
    assert.deepEqual(meetings('MATH 221', DAY_SHEET).times, ['10:30-11:45']);
    assert.deepEqual(meetings('ENG 101', DAY_SHEET).days, ['monday', 'wednesday']);
    assert.deepEqual(meetings('ENG 101', DAY_SHEET).times, ['13:00-14:15']);
    assert.deepEqual(meetings('PHYS 111', DAY_SHEET).days, ['friday']);
    assert.deepEqual(meetings('PHYS 111', DAY_SHEET).times, ['14:00-16:00']);
    assert.deepEqual(meetings('ART 110', DAY_SHEET).days, ['saturday']);
    assert.deepEqual(meetings('HIST 200', DAY_SHEET).days, ['monday', 'wednesday']);
    assert.deepEqual(meetings('BIO 101', DAY_SHEET).days, ['monday', 'wednesday']);
    assert.deepEqual(meetings('BIO 101', DAY_SHEET).times, ['08:30-09:45']);
    assert.equal(meetings('CS 101', DAY_SHEET).parsed.courses.length, 7);
  });

  it('flags impossible times and keeps the credit value that was written', () => {
    const rows = [
      ['Course', 'Title', 'Days', 'Time', 'Credits'],
      ['CS 400', 'Bad Clock', 'MWF', '25:00-26:00', '3'],
      ['CS 401', 'No Time', 'MWF', '', '3'],
      ['CS 402', 'Backwards', 'MW', '15:00-09:00', '3'],
      ['CS 403', 'Too Many', 'MWF', '9:00 AM - 10:00 AM', '99'],
      ['CS 404', 'Four', 'MWF', '9:00 AM - 10:00 AM', '4'],
      ['CS 405', 'Unspecified', 'MWF', '9:00 AM - 10:00 AM', ''],
    ];
    const analyzed = analyzeTabularRows(rows);
    const parsed = parseExcelRowsToCourses(analyzed.rawRows, analyzed.dataStartRow, analyzed.detectedMapping);
    const byCode = new Map(parsed.courses.map((course) => [course.code, course]));

    for (const code of ['CS 400', 'CS 401', 'CS 402']) {
      const course = byCode.get(code);
      assert.ok(course);
      assert.equal(course.sessions.length, 0);
      assert.equal(course.sessions.some((session) => session.startTime === '09:00'), false);
      const issue = parsed.issues.find((item) => item.courseId === course.id);
      assert.equal(issue?.blocking, true);
    }

    const unusual = byCode.get('CS 403');
    assert.equal(unusual?.credits, 99);
    assert.equal(unusual?.sessions.length, 3);
    assert.equal(parsed.issues.find((item) => item.courseId === unusual?.id)?.blocking, false);

    assert.equal(byCode.get('CS 404')?.credits, 4);
    assert.equal(byCode.get('CS 405')?.credits, 3);
    assert.equal(parsed.issues.some((item) => item.courseId === byCode.get('CS 405')?.id), false);
  });

  it('rejects files that are not spreadsheets', () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer as ArrayBuffer;
    const text = (value: string) => new TextEncoder().encode(value).buffer as ArrayBuffer;
    assert.ok(spreadsheetRejectionReason('photo.png', png));
    assert.ok(spreadsheetRejectionReason('photo.csv', png));
    assert.ok(spreadsheetRejectionReason('notes.txt', text('hello')));
    assert.ok(spreadsheetRejectionReason('page.csv', text('<html></html>')));
    assert.equal(spreadsheetRejectionReason('courses.csv', text('Course,Days\nCS 101,MWF')), null);
  });
});
