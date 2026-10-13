import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  analyzeTabularRows,
  extractDays,
  extractTimeRange,
  isDateCell,
  loadSheetData,
  loadXlsx,
  parseExcelRowsToCourses,
  readExcelFile,
} from './excelImport';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

function imported(rows: (string | number | undefined)[][]) {
  const analyzed = analyzeTabularRows(rows);
  const parsed = parseExcelRowsToCourses(analyzed.rawRows, analyzed.dataStartRow, analyzed.detectedMapping);
  return { analyzed, parsed };
}

function fingerprint(parsed: ReturnType<typeof parseExcelRowsToCourses>) {
  return parsed.courses.map((course) => ({
    code: course.code,
    name: course.name,
    section: course.section || '',
    instructor: course.instructor || '',
    credits: course.credits,
    sessions: course.sessions
      .map((session) => `${session.day}|${session.startTime}|${session.endTime}|${session.room || ''}`)
      .join(';'),
  }));
}

describe('column auto-detection', () => {
  it('imports the school SIS layout with the same courses, days, times, credits, and faculty', async () => {
    const buf = fs.readFileSync(path.join(fixtureDir, 'school-f26-layout.xlsx'));
    const expected = JSON.parse(
      fs.readFileSync(path.join(fixtureDir, 'school-f26-expected.json'), 'utf8')
    ) as {
      mapping: Record<string, string>;
      courses: ReturnType<typeof fingerprint>;
      issueCount: number;
    };
    await loadXlsx();
    const { workbook, sheets } = await readExcelFile(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
      'school-f26-layout.xlsx'
    );
    const data = loadSheetData(workbook, sheets[0]);
    const parsed = parseExcelRowsToCourses(data.rawRows, data.dataStartRow, data.detectedMapping);

    assert.equal(sheets[0], "F'26 All Major Course List");
    assert.deepEqual(data.detectedMapping, expected.mapping);
    assert.equal(parsed.courses.length, 264);
    assert.equal(parsed.issues.length, expected.issueCount);
    assert.equal(parsed.issues.length, 0);
    assert.deepEqual(fingerprint(parsed), expected.courses);

    const accounting = parsed.courses.find((course) => course.code === 'ACCT 201' && course.section === '001');
    assert.ok(accounting);
    assert.equal(accounting.instructor, 'David TERELADZE');
    assert.equal(accounting.credits, 3);
    assert.deepEqual(
      accounting.sessions.map((session) => session.day),
      ['monday', 'wednesday']
    );
    assert.equal(accounting.sessions[0]?.startTime, '15:30');
    assert.equal(accounting.sessions[0]?.endTime, '17:00');
  });

  it('builds the course code from subject and number when CRN values are not codes', () => {
    const { analyzed, parsed } = imported([
      ['CRN', 'Subject', 'Number', 'Title', 'Sec', 'Days', 'Time', 'Prof', 'Units', 'Room'],
      ['10234', 'CS', '101', 'Intro to Computer Science', '001', 'MWF', '9:00-9:50', 'Ada Lovelace', '4', 'Rm 204'],
      ['10235', 'CS', '101', 'Intro to Computer Science', '002', 'TR', '10:30-11:45', 'Grace Hopper', '4', 'Hall 12'],
      ['10400', 'MATH', '221', 'Calculus II', '001', 'Mon/Wed', '1:00 PM - 2:15 PM', 'Isaac Newton', '4', 'Newton 110'],
    ]);

    assert.equal(analyzed.detectedMapping.code, '');
    assert.equal(analyzed.detectedMapping.subject, 'col_1');
    assert.equal(analyzed.detectedMapping.courseNum, 'col_2');
    assert.equal(analyzed.detectedMapping.section, 'col_4');
    assert.deepEqual(
      parsed.courses.map((course) => course.code),
      ['CS 101', 'CS 101', 'MATH 221']
    );
    assert.deepEqual(
      parsed.courses.map((course) => course.section),
      ['001', '002', '001']
    );
    assert.equal(parsed.courses[0]?.credits, 4);
    assert.equal(parsed.courses[0]?.instructor, 'Ada Lovelace');
    assert.deepEqual(
      [...new Set(parsed.courses[0]?.sessions.map((session) => session.day))].sort(),
      ['friday', 'monday', 'wednesday']
    );
    assert.equal(parsed.courses[2]?.sessions[0]?.startTime, '13:00');
    assert.equal(parsed.courses[2]?.sessions[0]?.room, 'Newton 110');
  });

  it('does not read a seats column as the section', () => {
    const { analyzed, parsed } = imported([
      ['Course', 'Title', 'Seats', 'Days', 'Time', 'Credits'],
      ['CS 101', 'Intro to CS', '30', 'MW', '9:00-9:50', '4'],
      ['CS 101', 'Intro to CS', '25', 'TR', '10:30-11:45', '4'],
      ['MATH 221', 'Calculus II', '40', 'MWF', '1:00 PM - 2:15 PM', '4'],
      ['ENG 110', 'Writing', '28', 'Mon/Wed', '9am - 10:15am', '3'],
    ]);

    assert.equal(analyzed.detectedMapping.section, '');
    assert.notEqual(analyzed.detectedMapping.courseNum, 'col_2');
    assert.equal(analyzed.detectedMapping.days, 'col_3');
    assert.equal(analyzed.detectedMapping.credits, 'col_5');
    assert.deepEqual(
      parsed.courses.map((course) => course.section),
      [undefined, undefined, undefined, undefined]
    );
    assert.deepEqual(
      parsed.courses.map((course) => course.credits),
      [4, 4, 4, 3]
    );
    assert.deepEqual(
      [...new Set(parsed.courses[3]?.sessions.map((session) => session.day))].sort(),
      ['monday', 'wednesday']
    );
    assert.equal(parsed.courses[3]?.sessions[0]?.startTime, '09:00');
    assert.equal(parsed.courses[3]?.sessions[0]?.endTime, '10:15');
  });

  it('does not read a days column as the subject when there is no header row', () => {
    const { analyzed, parsed } = imported([
      ['CS 101', 'Intro to Computer Science', 'MW', '9:00 AM - 9:50 AM', 'Ada Lovelace', '4'],
      ['MATH 221', 'Calculus II', 'TR', '10:30 AM - 11:45 AM', 'Isaac Newton', '4'],
      ['ENG 110', 'College Writing', 'MW', '1:00 PM - 2:15 PM', 'Jane Austen', '3'],
      ['HIST 210', 'World History', 'TR', '11:00 AM - 12:15 PM', 'Howard Zinn', '3'],
    ]);

    assert.equal(analyzed.detectedMapping.days, 'col_2');
    assert.notEqual(analyzed.detectedMapping.subject, 'col_2');
    assert.equal(analyzed.detectedMapping.code, 'col_0');
    assert.equal(analyzed.detectedMapping.name, 'col_1');
    assert.equal(analyzed.detectedMapping.time, 'col_3');
    assert.equal(analyzed.detectedMapping.instructor, 'col_4');
    assert.equal(parsed.courses[0]?.code, 'CS 101');
    assert.equal(parsed.courses[0]?.name, 'Intro to Computer Science');
    assert.deepEqual(
      [...new Set(parsed.courses[1]?.sessions.map((session) => session.day))].sort(),
      ['thursday', 'tuesday']
    );
    assert.equal(parsed.courses[1]?.sessions[0]?.startTime, '10:30');
  });

  it('recognizes day, time, and date spellings and header synonyms', () => {
    assert.deepEqual(extractDays('Monday'), ['monday']);
    assert.deepEqual(extractDays('Mon'), ['monday']);
    assert.deepEqual(extractDays('Mo'), ['monday']);
    assert.deepEqual(extractDays('M'), ['monday']);
    assert.deepEqual(extractDays('Thursday'), ['thursday']);
    assert.deepEqual(extractDays('Thu'), ['thursday']);
    assert.deepEqual(extractDays('Thur'), ['thursday']);
    assert.deepEqual(extractDays('Thurs'), ['thursday']);
    assert.deepEqual(extractDays('Th'), ['thursday']);
    assert.deepEqual(extractDays('R'), ['thursday']);
    assert.deepEqual(extractDays('MWF'), ['monday', 'wednesday', 'friday']);
    assert.deepEqual(extractDays('TTH'), ['tuesday', 'thursday']);
    assert.deepEqual(extractDays('TR'), ['tuesday', 'thursday']);
    assert.deepEqual(extractDays('Mon/Wed'), ['monday', 'wednesday']);
    assert.deepEqual(extractDays('Tue Thu'), ['tuesday', 'thursday']);
    assert.deepEqual(extractDays('M-F'), ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);

    assert.deepEqual(extractTimeRange('0900-0950'), { start: '09:00', end: '09:50' });
    assert.deepEqual(extractTimeRange('9.00-9.50'), { start: '09:00', end: '09:50' });
    assert.deepEqual(extractTimeRange('9am-10am'), { start: '09:00', end: '10:00' });
    assert.deepEqual(extractTimeRange('9:00 to 9:50'), { start: '09:00', end: '09:50' });
    assert.deepEqual(extractTimeRange('13:00-14:15'), { start: '13:00', end: '14:15' });
    assert.equal(extractTimeRange('8/17/2026'), null);
    assert.equal(extractTimeRange('17/08/2026'), null);
    assert.equal(extractTimeRange('2026-08-17'), null);
    assert.equal(extractTimeRange('46251'), null);
    for (const date of ['2026-08-17', '8/17/2026', '17/08/2026', 'Aug 17', 'August 17 2026', 'August 17, 2026', '46251']) {
      assert.equal(isDateCell(date), true, date);
    }
    assert.equal(isDateCell('9:00'), false);
    assert.equal(isDateCell('3'), false);

    const { analyzed, parsed } = imported([
      ['Course', 'Meeting Days', 'Time', 'Start Date', 'End Date', 'Credit Hrs', 'Prof', 'Bldg'],
      ['CS 101', 'Monday', '9:00-9:50', '2026-08-17', '2026-12-04', '3', 'Ada Lovelace', 'Rm 204'],
      ['CS 102', 'Mon', '09:00-09:50', '8/17/2026', '12/4/2026', '3', 'Grace Hopper', 'Hall 12'],
      ['CS 103', 'Mo', '9am-10am', '17/08/2026', '04/12/2026', '4', 'Alan Turing', 'Lab 1'],
      ['CS 104', 'M', '9:00 AM - 9:50 AM', 'Aug 17', 'Dec 4', '3', 'Ken Thompson', 'Bldg 2'],
      ['CS 105', 'Thursday', '0900-0950', 'August 17 2026', 'December 4 2026', '3', 'Dennis Ritchie', 'Room 10'],
      ['CS 106', 'Thu', '9.00-9.50', 'August 17, 2026', 'December 4, 2026', '3', 'Barbara Liskov', 'Hall 1'],
      ['CS 107', 'Thur', '13:00-14:15', '46251', '46360', '3', 'Edsger Dijkstra', 'Rm 8'],
      ['CS 108', 'Thurs', '9:00 to 9:50', '2026-08-17', '2026-12-04', '3', 'Donald Knuth', 'Rm 9'],
      ['CS 109', 'Th', '9:00–9:50', '8/17/2026', '12/4/2026', '3', 'Frances Allen', 'Rm 3'],
      ['CS 110', 'R', '10:30-11:45', 'Aug 17, 2026', 'Dec 4, 2026', '3', 'John Backus', 'Rm 4'],
      ['CS 111', 'MWF', '9:00-9:50', '2026-08-17', '2026-12-04', '3', 'Margaret Hamilton', 'Rm 5'],
      ['CS 112', 'TTH', '10:30-11:45', '2026-08-17', '2026-12-04', '3', 'Radia Perlman', 'Rm 6'],
      ['CS 113', 'TR', '10:30 AM - 11:45 AM', '2026-08-17', '2026-12-04', '3', 'Leslie Lamport', 'Rm 7'],
      ['CS 114', 'Mon/Wed', '1:00 PM - 2:15 PM', '2026-08-17', '2026-12-04', '3', 'Jean Bartik', 'Rm 11'],
      ['CS 115', 'Tue Thu', '2:00-3:15', '2026-08-17', '2026-12-04', '3', 'Betty Holberton', 'Rm 12'],
      ['CS 116', 'M-F', '9:00-9:50', '2026-08-17', '2026-12-04', '1', 'Grace Hopper', 'Rm 13'],
    ]);

    assert.equal(analyzed.detectedMapping.days, 'col_1');
    assert.equal(analyzed.detectedMapping.time, 'col_2');
    assert.equal(analyzed.detectedMapping.startTime, '');
    assert.equal(analyzed.detectedMapping.endTime, '');
    assert.equal(analyzed.detectedMapping.credits, 'col_5');
    assert.equal(analyzed.detectedMapping.instructor, 'col_6');
    assert.equal(analyzed.detectedMapping.room, 'col_7');
    assert.equal(parsed.issues.length, 0);

    const byCode = new Map(parsed.courses.map((course) => [course.code, course]));
    const expectCourse = (
      code: string,
      days: string[],
      time: string,
      credits: number,
      room: string
    ) => {
      const course = byCode.get(code);
      assert.ok(course, code);
      assert.deepEqual([...new Set(course.sessions.map((session) => session.day))].sort(), [...days].sort());
      assert.deepEqual(
        [...new Set(course.sessions.map((session) => `${session.startTime}-${session.endTime}`))],
        [time]
      );
      assert.equal(course.credits, credits);
      assert.equal(course.sessions[0]?.room, room);
    };

    expectCourse('CS 101', ['monday'], '09:00-09:50', 3, 'Rm 204');
    expectCourse('CS 103', ['monday'], '09:00-10:00', 4, 'Lab 1');
    expectCourse('CS 105', ['thursday'], '09:00-09:50', 3, 'Room 10');
    expectCourse('CS 106', ['thursday'], '09:00-09:50', 3, 'Hall 1');
    expectCourse('CS 107', ['thursday'], '13:00-14:15', 3, 'Rm 8');
    expectCourse('CS 109', ['thursday'], '09:00-09:50', 3, 'Rm 3');
    expectCourse('CS 110', ['thursday'], '10:30-11:45', 3, 'Rm 4');
    expectCourse('CS 111', ['friday', 'monday', 'wednesday'], '09:00-09:50', 3, 'Rm 5');
    expectCourse('CS 112', ['thursday', 'tuesday'], '10:30-11:45', 3, 'Rm 6');
    expectCourse('CS 114', ['monday', 'wednesday'], '13:00-14:15', 3, 'Rm 11');
    expectCourse('CS 115', ['thursday', 'tuesday'], '14:00-15:15', 3, 'Rm 12');
    expectCourse('CS 116', ['friday', 'monday', 'thursday', 'tuesday', 'wednesday'], '09:00-09:50', 1, 'Rm 13');
    assert.equal(byCode.get('CS 105')?.instructor, 'Dennis Ritchie');

    const clocks = imported([
      ['Course', 'Days', 'Start', 'End', 'Cr'],
      ['CS 201', 'MW', '9am', '10:15 AM', '3'],
      ['CS 202', 'TR', 0.375, 0.4375, '4'],
    ]);
    assert.equal(clocks.analyzed.detectedMapping.startTime, 'col_2');
    assert.equal(clocks.analyzed.detectedMapping.endTime, 'col_3');
    assert.equal(clocks.analyzed.detectedMapping.credits, 'col_4');
    assert.equal(clocks.parsed.courses[0]?.sessions[0]?.startTime, '09:00');
    assert.equal(clocks.parsed.courses[0]?.sessions[0]?.endTime, '10:15');
    assert.equal(clocks.parsed.courses[1]?.sessions[0]?.startTime, '09:00');
    assert.equal(clocks.parsed.courses[1]?.sessions[0]?.endTime, '10:30');
    assert.equal(clocks.parsed.courses[1]?.credits, 4);

    const synonyms = imported([
      ['Subject', 'Course #', 'Sect', 'Title', 'Units', 'Prof', 'Location', 'Days', 'Time'],
      ['CS', '101', '01', 'Intro to Algorithms', '3', 'Ada Lovelace', 'Rm 204', 'MWF', '9:00-9:50'],
      ['MATH', '221', '02', 'Calculus II', '4', 'Isaac Newton', 'Hall 12', 'TTH', '10:30-11:45'],
    ]);
    assert.equal(synonyms.analyzed.detectedMapping.subject, 'col_0');
    assert.equal(synonyms.analyzed.detectedMapping.courseNum, 'col_1');
    assert.equal(synonyms.analyzed.detectedMapping.code, '');
    assert.equal(synonyms.analyzed.detectedMapping.section, 'col_2');
    assert.equal(synonyms.analyzed.detectedMapping.credits, 'col_4');
    assert.equal(synonyms.analyzed.detectedMapping.instructor, 'col_5');
    assert.equal(synonyms.analyzed.detectedMapping.room, 'col_6');
    assert.deepEqual(
      synonyms.parsed.courses.map((course) => [course.code, course.section, course.credits, course.instructor]),
      [
        ['CS 101', '01', 3, 'Ada Lovelace'],
        ['MATH 221', '02', 4, 'Isaac Newton'],
      ]
    );
  });
});
