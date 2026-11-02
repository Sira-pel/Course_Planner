process.env.TZ = 'America/New_York';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeTabularRows, parseExcelRowsToCourses } from './excelImport';
import { parseIcsContent } from './icsImport';

const calendar = (...events: string[]) =>
  `BEGIN:VCALENDAR\r\n${events.map((event) => `BEGIN:VEVENT\r\n${event}\r\nEND:VEVENT`).join('\r\n')}\r\nEND:VCALENDAR`;

const meetings = (course: { sessions: { day: string; startTime: string; endTime: string }[] }) =>
  course.sessions.map((session) => `${session.day} ${session.startTime}-${session.endTime}`);

describe('ICS import edge cases', () => {
  it('keeps the weekday when a UTC time converts to the same local day', () => {
    const [course] = parseIcsContent(calendar('SUMMARY:CS 101\r\nDTSTART:20250901T140000Z\r\nDTEND:20250901T151500Z'));
    assert.deepEqual(meetings(course), ['monday 10:00-11:15']);
  });

  it('moves BYDAY with the clock when the conversion crosses midnight', () => {
    const [course] = parseIcsContent(calendar(
      'SUMMARY:CS 101\r\nDTSTART:20250902T020000Z\r\nDTEND:20250902T031500Z\r\nRRULE:FREQ=WEEKLY;BYDAY=TU,TH',
    ));
    assert.deepEqual(meetings(course), ['monday 22:00-23:15', 'wednesday 22:00-23:15']);
  });

  it('leaves floating local times alone', () => {
    const [course] = parseIcsContent(calendar(
      'SUMMARY:CS 101\r\nDTSTART:20250901T090000\r\nDTEND:20250901T101500\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE',
    ));
    assert.deepEqual(meetings(course), ['monday 09:00-10:15', 'wednesday 09:00-10:15']);
  });

  it('skips all-day events', () => {
    const courses = parseIcsContent(calendar(
      'SUMMARY:Labor Day\r\nDTSTART;VALUE=DATE:20250901\r\nDTEND;VALUE=DATE:20250902',
      'SUMMARY:CS 101\r\nDTSTART:20250902T090000\r\nDTEND:20250902T101500',
    ));
    assert.deepEqual(courses.map((course) => course.code), ['CS 101']);
  });

  it('does not add a weekly meeting for one moved class', () => {
    const courses = parseIcsContent(calendar(
      'SUMMARY:CS 101 Intro\r\nDTSTART:20250901T090000\r\nDTEND:20250901T101500\r\nRRULE:FREQ=WEEKLY;BYDAY=MO',
      'SUMMARY:CS 101 Intro\r\nRECURRENCE-ID:20250908T090000\r\nDTSTART:20250909T140000\r\nDTEND:20250909T151500',
    ));
    assert.equal(courses.length, 1);
    assert.deepEqual(meetings(courses[0]), ['monday 09:00-10:15']);
  });

  it('keeps a moved class whose series is not in the file', () => {
    const courses = parseIcsContent(calendar(
      'SUMMARY:CS 101 Intro\r\nRECURRENCE-ID:20250908T090000\r\nDTSTART:20250909T140000\r\nDTEND:20250909T151500',
    ));
    assert.equal(courses.length, 1);
  });

  it('unescapes text in one pass', () => {
    const [course] = parseIcsContent(calendar(
      'SUMMARY:CS 101 Lab\, Room 4 C:\\new\r\nDTSTART:20250901T090000\r\nDTEND:20250901T101500',
    ));
    assert.equal(course.name, 'Lab, Room 4 C:\new');
  });
});

describe('spreadsheet continuation rows', () => {
  const parse = (rows: (string | number)[][]) => {
    const analyzed = analyzeTabularRows(rows);
    return parseExcelRowsToCourses(analyzed.rawRows, analyzed.dataStartRow, analyzed.detectedMapping);
  };

  it('adds a blank-code row to the course above it', () => {
    const result = parse([
      ['Code', 'Name', 'Day', 'Start', 'End', 'Room'],
      ['CS101', 'Intro', 'Mon', '09:00', '10:15', 'A1'],
      ['', '', 'Wed', '09:00', '10:15', 'A1'],
      ['CS102', 'Algo', 'Tue', '13:00', '14:15', 'B'],
    ]);
    assert.deepEqual(result.courses.map((course) => course.code), ['CS101', 'CS102']);
    assert.deepEqual(meetings(result.courses[0]), ['monday 09:00-10:15', 'wednesday 09:00-10:15']);
  });

  it('does not repeat a meeting the course already has', () => {
    const result = parse([
      ['Code', 'Name', 'Day', 'Start', 'End', 'Room'],
      ['CS101', 'Intro', 'Mon', '09:00', '10:15', 'A1'],
      ['', '', 'Mon', '09:00', '10:15', 'A1'],
    ]);
    assert.deepEqual(meetings(result.courses[0]), ['monday 09:00-10:15']);
  });

  it('reads the Time column when an extra count column sits beside it', () => {
    const result = parse([
      ['Course Code', 'Section', 'Title', 'Credits', 'Days', 'Time', 'Waitlist', 'Room'],
      ['CS101', '001', 'Intro', '3', 'MWF', '09:00-10:15', '0', 'A1'],
      ['MATH201', '02', 'Calc', '4', 'TTh', '1:30 PM-2:45 PM', '2', 'C3'],
    ]);
    assert.deepEqual(meetings(result.courses[1]), ['tuesday 13:30-14:45', 'thursday 13:30-14:45']);
    assert.equal(result.warnings.length, 0);
  });
});
