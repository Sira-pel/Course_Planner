import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  analyzeTabularRows,
  applyManualColumnMapping,
  extractDays,
  extractTimeRange,
  EXCEL_MAPPING_FIELDS,
  getEmptyMapping,
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

function imported(rows: (string | number | undefined)[][]) {
  const analyzed = analyzeTabularRows(rows);
  const parsed = parseExcelRowsToCourses(analyzed.rawRows, analyzed.dataStartRow, analyzed.detectedMapping);
  return { analyzed, parsed };
}

function courseShape(code: string, rows: (string | number | undefined)[][]) {
  const { parsed } = imported(rows);
  const course = parsed.courses.find((item) => item.code === code);
  assert.ok(course, `missing ${code}; got ${parsed.courses.map((item) => item.code).join(', ')}`);
  return {
    code: course.code,
    name: course.name,
    section: course.section,
    instructor: course.instructor,
    credits: course.credits,
    days: [...new Set(course.sessions.map((session) => session.day))].sort(),
    times: [...new Set(course.sessions.map((session) => `${session.startTime}-${session.endTime}`))],
    room: course.sessions[0]?.room,
    sessions: course.sessions.length,
  };
}

/** Excel day 0 is 1899-12-30. 2026-08-17 is inside the serial range the detector treats as a date. */
function excelDateSerial(year: number, month: number, day: number): number {
  const utc = Date.UTC(year, month - 1, day);
  const epoch = Date.UTC(1899, 11, 30);
  return Math.round((utc - epoch) / 86400000);
}

describe('school SIS spreadsheet', () => {
  const SCHOOL_SHEET = [
    ['Acad. Dept', 'Course Code', 'Section', 'Course Title', 'Credit', 'Faculty', 'Time*', 'Classroom', 'Start Date', 'End Date', 'Grade Due'],
    ['ACCT', 'ACCT 201', '001', 'Financial Accounting', '3', 'Maya CHEN', '(E) 03:30PM - 05:00PM MW', 'TBD', '2026-08-17', 'December 4, 2026', '2026-12-18'],
    ['BUSN', 'BUSN 370L', '002', 'Operations Management Lab', '1', 'TBC', '(Y) 01:45PM - 02:45PM TH', 'TBD', '2026-08-17', 'December 4, 2026', ''],
    ['', '', '', '', '', '', '', '', '', '', ''],
    ['ACCT', 'ACCT 400E (UA)', '001', 'Advanced External Audit', '3', 'Omar REED', 'Online UA', 'TBD', '2026-08-17', 'December 4, 2026', '2026-12-18'],
    ['', '', '', '', '', '', '', '', '', '', ''],
    ['Schedules may change. Check the student portal before the first meeting.', '', '', '', '', '', '', '', '', '', ''],
  ];

  it('keeps the current school-layout import, including blanks and online rows, and skips the footer note', () => {
    const { analyzed, parsed } = imported(SCHOOL_SHEET);
    assert.equal(analyzed.dataStartRow, 1);
    assert.deepEqual(analyzed.detectedMapping, {
      code: 'col_1',
      subject: 'col_0',
      courseNum: '',
      name: 'col_3',
      section: 'col_2',
      schedule: 'col_6',
      days: '',
      time: '',
      startTime: '',
      endTime: '',
      instructor: 'col_5',
      credits: 'col_4',
      room: 'col_7',
    });
    assert.equal(parsed.success, true);
    assert.equal(parsed.totalRows, 6);
    assert.equal(parsed.skippedRows, 3);
    assert.deepEqual(parsed.issues, []);
    assert.deepEqual(parsed.warnings, [
      'Row 5: "ACCT 400E (UA)" marked as Online / Asynchronous (no calendar meetings assigned)',
    ]);
    assert.deepEqual(
      parsed.courses.map((course) => ({
        code: course.code,
        name: course.name,
        section: course.section,
        instructor: course.instructor,
        credits: course.credits,
        color: course.color,
        sessions: course.sessions.map((session) => ({
          day: session.day,
          start: session.startTime,
          end: session.endTime,
          room: session.room,
        })),
      })),
      [
        {
          code: 'ACCT 201',
          name: 'Financial Accounting',
          section: '001',
          instructor: 'Maya CHEN',
          credits: 3,
          color: '#3B82F6',
          sessions: [
            { day: 'monday', start: '15:30', end: '17:00', room: 'TBD' },
            { day: 'wednesday', start: '15:30', end: '17:00', room: 'TBD' },
          ],
        },
        {
          code: 'BUSN 370L',
          name: 'Operations Management Lab',
          section: '002',
          instructor: 'TBC',
          credits: 1,
          color: '#10B981',
          sessions: [{ day: 'thursday', start: '13:45', end: '14:45', room: 'TBD' }],
        },
        {
          code: 'ACCT 400E (UA)',
          name: 'Advanced External Audit',
          section: '001',
          instructor: 'Omar REED',
          credits: 3,
          color: '#F97316',
          sessions: [],
        },
      ],
    );
    assert.equal(parsed.courses.some((course) => course.code.startsWith('SCHEDULE')), false);
  });

  it('skips a synthetic footer row unless it has a parseable meeting time', () => {
    const rows = [
      ['Acad. Dept', 'Course Code', 'Section', 'Course Title', 'Time'],
      ['ACCT', 'ACCT 201', '001', 'Financial Accounting', 'MW 03:30PM - 05:00PM'],
      ['Schedules may change. Check the student portal before the first meeting.', '', '', '', ''],
      ['Bring a laptop', '', '', '', 'MW 1:00 PM - 2:15 PM'],
    ];
    const { parsed } = imported(rows);
    assert.equal(parsed.skippedRows, 1);
    assert.equal(parsed.courses.some((course) => /schedule/i.test(course.code) || /student portal/i.test(course.name)), false);
    assert.equal(parsed.courses[0]?.code, 'ACCT 201');
    const meetingOnly = parsed.courses[1];
    assert.ok(meetingOnly);
    assert.equal(meetingOnly.code, 'BRING A LA');
    assert.equal(meetingOnly.name, 'Bring a laptop');
    assert.deepEqual(
      [...new Set(meetingOnly.sessions.map((session) => session.day))].sort(),
      ['monday', 'wednesday'],
    );
    assert.deepEqual(
      [...new Set(meetingOnly.sessions.map((session) => `${session.startTime}-${session.endTime}`))],
      ['13:00-14:15'],
    );
  });
});

describe('spreadsheet column auto-detect', () => {
  const STANDARD = [
    ['Room', 'Credits', 'Instructor', 'End', 'Start', 'Days', 'Section', 'Title', 'Course Code'],
    ['B101', '3', 'Maya CHEN', '10:15 AM', '9:00 AM', 'MW', '001', 'Computer Systems', 'COSC 221'],
    ['E1', '4', 'Lee', '2:15 PM', '1:00 PM', 'TR', '002', 'Linear Algebra', 'MATH 210'],
  ];

  it('reads a reversed header row', () => {
    assert.deepEqual(courseShape('COSC 221', STANDARD), {
      code: 'COSC 221',
      name: 'Computer Systems',
      section: '001',
      instructor: 'Maya CHEN',
      credits: 3,
      days: ['monday', 'wednesday'],
      times: ['09:00-10:15'],
      room: 'B101',
      sessions: 2,
    });
    assert.deepEqual(courseShape('MATH 210', STANDARD), {
      code: 'MATH 210',
      name: 'Linear Algebra',
      section: '002',
      instructor: 'Lee',
      credits: 4,
      days: ['thursday', 'tuesday'],
      times: ['13:00-14:15'],
      room: 'E1',
      sessions: 2,
    });
  });

  it('reads renamed headers', () => {
    const rows = [
      ['Location', 'Units', 'Prof', 'End', 'Start', 'Meeting Days', 'Sec', 'Course Name', 'Course'],
      ['B101', '3', 'Maya CHEN', '10:15 AM', '9:00 AM', 'MW', '001', 'Computer Systems', 'COSC 221'],
      ['E1', '4', 'Lee', '2:15 PM', '1:00 PM', 'TR', '002', 'Linear Algebra', 'MATH 210'],
    ];
    assert.equal(courseShape('COSC 221', rows).name, 'Computer Systems');
    assert.equal(courseShape('COSC 221', rows).section, '001');
    assert.equal(courseShape('COSC 221', rows).instructor, 'Maya CHEN');
    assert.equal(courseShape('COSC 221', rows).credits, 3);
    assert.equal(courseShape('COSC 221', rows).room, 'B101');
    assert.deepEqual(courseShape('COSC 221', rows).days, ['monday', 'wednesday']);
    assert.deepEqual(courseShape('COSC 221', rows).times, ['09:00-10:15']);
    assert.equal(courseShape('MATH 210', rows).instructor, 'Lee');
    assert.equal(courseShape('MATH 210', rows).room, 'E1');
    assert.deepEqual(courseShape('MATH 210', rows).days, ['thursday', 'tuesday']);
    assert.deepEqual(courseShape('MATH 210', rows).times, ['13:00-14:15']);
  });

  it('builds the code from subject and number and ignores term, CRN, and seats', () => {
    const rows = [
      ['Term', 'CRN', 'Subject', 'Number', 'Status', 'Title', 'Schedule', 'Seats', 'Instructor', 'Notes'],
      ['Fall 2026', '10234', 'COSC', '221', 'Open', 'Computer Systems', 'MW 9:00 AM - 10:15 AM', '30', 'Maya CHEN', 'Bring a laptop'],
      ['Fall 2026', '10288', 'MATH', '210', 'Open', 'Linear Algebra', 'TR 1:00 PM - 2:15 PM', '25', 'Lee', 'Optional review'],
    ];
    const { analyzed, parsed } = imported(rows);
    assert.equal(analyzed.detectedMapping.code, '');
    assert.equal(analyzed.detectedMapping.section, '');
    assert.notEqual(analyzed.detectedMapping.subject, '');
    assert.notEqual(analyzed.detectedMapping.courseNum, '');
    assert.deepEqual(parsed.courses.map((course) => course.code), ['COSC 221', 'MATH 210']);
    for (const course of parsed.courses) {
      assert.equal(course.section, undefined);
      assert.notEqual(course.section, '30');
      assert.notEqual(course.section, '25');
    }
    assert.equal(courseShape('COSC 221', rows).name, 'Computer Systems');
    assert.equal(courseShape('COSC 221', rows).instructor, 'Maya CHEN');
    assert.equal(courseShape('COSC 221', rows).credits, 3);
    assert.equal(courseShape('COSC 221', rows).room, undefined);
    assert.deepEqual(courseShape('COSC 221', rows).days, ['monday', 'wednesday']);
    assert.deepEqual(courseShape('COSC 221', rows).times, ['09:00-10:15']);
    assert.equal(courseShape('MATH 210', rows).name, 'Linear Algebra');
    assert.equal(courseShape('MATH 210', rows).instructor, 'Lee');
    assert.deepEqual(courseShape('MATH 210', rows).days, ['thursday', 'tuesday']);
    assert.deepEqual(courseShape('MATH 210', rows).times, ['13:00-14:15']);
  });

  it('treats a day column as days when the sheet has no header row', () => {
    const rows = [
      ['COSC', '221', 'Computer Systems', '001', 'MW', '9:00 AM - 10:15 AM', 'Maya CHEN', '3', 'B101'],
      ['MATH', '210', 'Linear Algebra', '002', 'TR', '1:00 PM - 2:15 PM', 'Lee', '4', 'E1'],
      ['BUSN', '370L', 'Marketing Lab', '003', 'Mon/Wed', '9am - 10:15am', 'Sam RIVERA', '1', 'Hall 3'],
      ['ART', '110', 'Studio Practices', '004', 'TTH', '0900-1015', 'Smith', '3', 'D2'],
    ];
    const { analyzed } = imported(rows);
    assert.equal(analyzed.dataStartRow, 0);
    assert.equal(analyzed.columns.every((column) => column.headerText === ''), true);
    assert.notEqual(analyzed.detectedMapping.days, analyzed.detectedMapping.subject);
    assert.equal(courseShape('COSC 221', rows).name, 'Computer Systems');
    assert.equal(courseShape('COSC 221', rows).section, '001');
    assert.equal(courseShape('COSC 221', rows).instructor, 'Maya CHEN');
    assert.equal(courseShape('COSC 221', rows).credits, 3);
    assert.equal(courseShape('COSC 221', rows).room, 'B101');
    assert.deepEqual(courseShape('COSC 221', rows).days, ['monday', 'wednesday']);
    assert.deepEqual(courseShape('COSC 221', rows).times, ['09:00-10:15']);
    assert.equal(courseShape('MATH 210', rows).instructor, 'Lee');
    assert.equal(courseShape('MATH 210', rows).room, 'E1');
    assert.deepEqual(courseShape('MATH 210', rows).days, ['thursday', 'tuesday']);
    assert.equal(courseShape('BUSN 370L', rows).section, '003');
    assert.equal(courseShape('BUSN 370L', rows).room, 'Hall 3');
    assert.deepEqual(courseShape('BUSN 370L', rows).days, ['monday', 'wednesday']);
    assert.deepEqual(courseShape('BUSN 370L', rows).times, ['09:00-10:15']);
    assert.deepEqual(courseShape('ART 110', rows).days, ['thursday', 'tuesday']);
    assert.deepEqual(courseShape('ART 110', rows).times, ['09:00-10:15']);
    assert.equal(courseShape('ART 110', rows).instructor, 'Smith');
  });

  it('skips title rows above the real header', () => {
    const rows = [
      ['Course', 'Schedule'],
      ['Department listing for visiting students'],
      ['Fall planning sheet'],
      ['Course Code', 'Course Title', 'Section', 'Days', 'Time', 'Instructor', 'Credits', 'Room'],
      ['COSC 221', 'Computer Systems', '001', 'MW', '9:00 AM - 10:15 AM', 'Maya CHEN', '3', 'B101'],
      ['MATH 210', 'Linear Algebra', '002', 'TR', '1:00 PM - 2:15 PM', 'Lee', '4', 'E1'],
    ];
    const { analyzed, parsed } = imported(rows);
    assert.equal(analyzed.dataStartRow, 4);
    assert.equal(analyzed.columns[0]?.headerText, 'Course Code');
    assert.equal(parsed.courses.length, 2);
    assert.equal(courseShape('COSC 221', rows).name, 'Computer Systems');
    assert.equal(courseShape('COSC 221', rows).section, '001');
    assert.equal(courseShape('COSC 221', rows).instructor, 'Maya CHEN');
    assert.equal(courseShape('COSC 221', rows).credits, 3);
    assert.equal(courseShape('COSC 221', rows).room, 'B101');
    assert.deepEqual(courseShape('COSC 221', rows).days, ['monday', 'wednesday']);
    assert.deepEqual(courseShape('MATH 210', rows).room, 'E1');
    assert.equal(courseShape('MATH 210', rows).instructor, 'Lee');
  });

  it('keeps headers when most cells are blank, TBA, or Online', () => {
    const rows = [
      ['Course Code', 'Title', 'Section', 'Days', 'Time', 'Instructor', 'Credits', 'Room'],
      ['COSC 221', 'Intro', '001', 'MW', '9:00 AM - 10:15 AM', 'Lee', '3', 'E1'],
      ['MATH 210', 'Algebra', '002', 'TBA', 'TBA', 'TBA', '4', 'TBA'],
      ['ART 105', 'Studio', '003', '', '', 'Smith', '3', 'Online'],
      ['ENG 110', 'Writing', '004', 'TR', 'Online', 'TBC', '3', 'B101'],
      ['BIO 150', 'Lab Methods', '005', 'TBA', 'TBA', 'TBA', '1', 'TBD'],
      ['CHEM 101', 'Survey', '006', '', 'TBA', '', '4', ''],
    ];
    assert.equal(courseShape('COSC 221', rows).name, 'Intro');
    assert.equal(courseShape('COSC 221', rows).section, '001');
    assert.equal(courseShape('COSC 221', rows).instructor, 'Lee');
    assert.equal(courseShape('COSC 221', rows).credits, 3);
    assert.equal(courseShape('COSC 221', rows).room, 'E1');
    assert.deepEqual(courseShape('COSC 221', rows).days, ['monday', 'wednesday']);
    assert.deepEqual(courseShape('COSC 221', rows).times, ['09:00-10:15']);
    const tba = courseShape('MATH 210', rows);
    assert.equal(tba.name, 'Algebra');
    assert.equal(tba.section, '002');
    assert.equal(tba.instructor, 'TBA');
    assert.equal(tba.credits, 4);
    assert.equal(tba.sessions, 0);
    assert.equal(courseShape('ENG 110', rows).name, 'Writing');
    assert.equal(courseShape('ENG 110', rows).instructor, 'TBC');
    assert.equal(courseShape('ENG 110', rows).room, undefined);
    assert.equal(courseShape('ART 105', rows).name, 'Studio');
    assert.equal(courseShape('ART 105', rows).instructor, 'Smith');
    assert.equal(courseShape('BIO 150', rows).name, 'Lab Methods');
  });

  it('keeps single-word titles, single surnames, and short room codes', () => {
    const rows = [
      ['Course Code', 'Title', 'Section', 'Days', 'Time', 'Faculty', 'Credit', 'Classroom'],
      ['ART 110', 'Intro', '001', 'MW', '9:00 AM - 10:15 AM', 'Smith', '3', 'B101'],
      ['MUS 100', 'Studio', '002', 'TR', '1:00 PM - 2:15 PM', 'Lee', '1', 'E1'],
    ];
    assert.equal(courseShape('ART 110', rows).name, 'Intro');
    assert.equal(courseShape('ART 110', rows).instructor, 'Smith');
    assert.equal(courseShape('ART 110', rows).room, 'B101');
    assert.equal(courseShape('ART 110', rows).section, '001');
    assert.equal(courseShape('ART 110', rows).credits, 3);
    assert.deepEqual(courseShape('ART 110', rows).days, ['monday', 'wednesday']);
    assert.deepEqual(courseShape('ART 110', rows).times, ['09:00-10:15']);
    assert.equal(courseShape('MUS 100', rows).name, 'Studio');
    assert.equal(courseShape('MUS 100', rows).instructor, 'Lee');
    assert.equal(courseShape('MUS 100', rows).room, 'E1');
    assert.deepEqual(courseShape('MUS 100', rows).days, ['thursday', 'tuesday']);
    assert.deepEqual(courseShape('MUS 100', rows).times, ['13:00-14:15']);
  });

  it('reads header synonyms and common day and time spellings', () => {
    const byCrse = [
      ['Dept', 'Crse', 'Sect', 'Title', 'Days', 'Time', 'Prof', 'Credit Hrs', 'Bldg'],
      ['COSC', '221', '001', 'Computer Systems', 'Mon/Wed', '9am - 10:15am', 'Smith', '3', 'B101'],
      ['MATH', '210', '002', 'Linear Algebra', 'Tue Thu', '0900-1015', 'Lee', '4', 'E1'],
      ['ART', '110', '003', 'Studio', 'Thur', '9.00-10.15', 'Park', '3', 'D2'],
      ['MUS', '100', '004', 'Intro', 'M-F', '9:00 to 10:15', 'Cho', '1', 'A1'],
    ];
    assert.equal(courseShape('COSC 221', byCrse).name, 'Computer Systems');
    assert.equal(courseShape('COSC 221', byCrse).section, '001');
    assert.equal(courseShape('COSC 221', byCrse).instructor, 'Smith');
    assert.equal(courseShape('COSC 221', byCrse).credits, 3);
    assert.equal(courseShape('COSC 221', byCrse).room, 'B101');
    assert.deepEqual(courseShape('COSC 221', byCrse).days, ['monday', 'wednesday']);
    assert.deepEqual(courseShape('COSC 221', byCrse).times, ['09:00-10:15']);
    assert.deepEqual(courseShape('MATH 210', byCrse).days, ['thursday', 'tuesday']);
    assert.deepEqual(courseShape('MATH 210', byCrse).times, ['09:00-10:15']);
    assert.equal(courseShape('MATH 210', byCrse).room, 'E1');
    assert.deepEqual(courseShape('ART 110', byCrse).days, ['thursday']);
    assert.deepEqual(courseShape('ART 110', byCrse).times, ['09:00-10:15']);
    assert.deepEqual(courseShape('MUS 100', byCrse).days, ['friday', 'monday', 'thursday', 'tuesday', 'wednesday']);
    assert.deepEqual(courseShape('MUS 100', byCrse).times, ['09:00-10:15']);

    const byNumber = [
      ['Subject', 'Course #', 'Sec', 'Course Name', 'Meeting Days', 'Start', 'End', 'Prof', 'Units', 'Location'],
      ['COSC', '221', '001', 'Computer Systems', 'Mo', '9:00 AM', '10:15 AM', 'Smith', '3', 'B101'],
      ['MATH', '210', '002', 'Linear Algebra', 'R', '1:00 PM', '2:15 PM', 'Lee', '4', 'E1'],
      ['ENG', '101', '003', 'Intro', 'Th', '09:00', '10:15', 'Ng', '3', 'C4'],
    ];
    assert.equal(courseShape('COSC 221', byNumber).section, '001');
    assert.deepEqual(courseShape('COSC 221', byNumber).days, ['monday']);
    assert.deepEqual(courseShape('COSC 221', byNumber).times, ['09:00-10:15']);
    assert.equal(courseShape('COSC 221', byNumber).room, 'B101');
    assert.deepEqual(courseShape('MATH 210', byNumber).days, ['thursday']);
    assert.deepEqual(courseShape('MATH 210', byNumber).times, ['13:00-14:15']);
    assert.equal(courseShape('ENG 101', byNumber).name, 'Intro');
    assert.equal(courseShape('ENG 101', byNumber).instructor, 'Ng');
    assert.deepEqual(courseShape('ENG 101', byNumber).days, ['thursday']);
    assert.deepEqual(courseShape('ENG 101', byNumber).times, ['09:00-10:15']);

    const fullCode = [
      ['Crse', 'Title', 'Sect', 'Days', 'Time', 'Prof', 'Units', 'Bldg'],
      ['COSC 221', 'Computer Systems', '001', 'Mon', '0.375-0.4270833333333333', 'Smith', '3', 'B101'],
      ['MATH 210', 'Linear Algebra', '002', 'TTH', '9:00\u201310:15', 'Lee', '4', 'E1'],
    ];
    assert.equal(courseShape('COSC 221', fullCode).name, 'Computer Systems');
    assert.deepEqual(courseShape('COSC 221', fullCode).days, ['monday']);
    assert.deepEqual(courseShape('COSC 221', fullCode).times, ['09:00-10:15']);
    assert.deepEqual(courseShape('MATH 210', fullCode).days, ['thursday', 'tuesday']);
    assert.deepEqual(courseShape('MATH 210', fullCode).times, ['09:00-10:15']);
    assert.equal(extractTimeRange('0900-1015')?.start, '09:00');
    assert.equal(extractTimeRange('0900-1015')?.end, '10:15');
    assert.equal(extractTimeRange('0.375-0.4270833333333333')?.start, '09:00');
    assert.equal(extractTimeRange('0.375-0.4270833333333333')?.end, '10:15');
  });

  it('never uses a date column as the course title', () => {
    const serial = excelDateSerial(2026, 8, 17);
    assert.ok(serial >= 30000 && serial <= 80000);
    const rows = [
      ['Course Code', 'Start Date', 'End Date', 'Section', 'Days', 'Time', 'Instructor', 'Credits', 'Room', 'Title'],
      ['COSC 221', '2026-08-17', 'December 4, 2026', '001', 'MW', '9:00-10:15', 'Smith', '3', 'B101', 'Computer Systems'],
      ['MATH 210', '8/17/2026', 'Aug 17', '002', 'TR', '13:00-14:15', 'Lee', '4', 'E1', 'Linear Algebra'],
      ['ART 110', serial, 'December 4, 2026', '003', 'MWF', '9:00 AM - 9:50 AM', 'Park', '3', 'D2', 'Intro'],
    ];
    assert.equal(courseShape('COSC 221', rows).name, 'Computer Systems');
    assert.equal(courseShape('MATH 210', rows).name, 'Linear Algebra');
    assert.equal(courseShape('ART 110', rows).name, 'Intro');
    for (const code of ['COSC 221', 'MATH 210', 'ART 110']) {
      const name = courseShape(code, rows).name;
      assert.equal(/\d{4}-\d{2}-\d{2}|December|Aug|2026/.test(name), false);
      assert.notEqual(name, String(serial));
    }

    const noTitle = [
      ['Course Code', 'Start Date', 'End Date', 'Section', 'Days', 'Time', 'Instructor', 'Credits', 'Room'],
      ['COSC 221', '2026-08-17', 'December 4, 2026', '001', 'MW', '9:00-10:15', 'Smith', '3', 'B101'],
      ['MATH 210', serial, 'Aug 17', '002', 'TR', '13:00-14:15', 'Lee', '4', 'E1'],
    ];
    assert.equal(courseShape('COSC 221', noTitle).name, '');
    assert.equal(courseShape('MATH 210', noTitle).name, '');
    assert.equal(courseShape('COSC 221', noTitle).section, '001');
    assert.equal(courseShape('COSC 221', noTitle).room, 'B101');
    assert.deepEqual(courseShape('COSC 221', noTitle).days, ['monday', 'wednesday']);
  });
});

describe('excel schedule cells and column mapping', () => {
  it('splits a schedule cell on commas when each part has its own time', () => {
    const mapping = {
      ...getEmptyMapping(),
      code: 'col_0',
      name: 'col_1',
      schedule: 'col_2',
    };
    const rows = [
      ['Code', 'Title', 'Schedule'],
      ['CS 210', 'Systems', 'MW 09:00-10:15, F 11:00-12:00'],
      ['HIST 200', 'Survey', 'Mon, Wed 09:00-10:15'],
    ];
    const parsed = parseExcelRowsToCourses(rows, 1, mapping);
    const systems = parsed.courses.find((course) => course.code === 'CS 210');
    const survey = parsed.courses.find((course) => course.code === 'HIST 200');
    assert.ok(systems);
    assert.ok(survey);
    assert.deepEqual(
      systems.sessions.map((session) => `${session.day} ${session.startTime}-${session.endTime}`),
      [
        'monday 09:00-10:15',
        'wednesday 09:00-10:15',
        'friday 11:00-12:00',
      ],
    );
    assert.deepEqual(
      survey.sessions.map((session) => `${session.day} ${session.startTime}-${session.endTime}`),
      ['monday 09:00-10:15', 'wednesday 09:00-10:15'],
    );
  });

  it('offers Start Time and End Time, clears them when Schedule or Time is mapped, and falls back to Schedule when they are incomplete', () => {
    assert.deepEqual(
      EXCEL_MAPPING_FIELDS.filter((field) => field.field === 'startTime' || field.field === 'endTime').map((field) => field.label),
      ['Start Time', 'End Time'],
    );

    const detected = {
      ...getEmptyMapping(),
      code: 'col_0',
      startTime: 'col_2',
      endTime: 'col_3',
      schedule: 'col_4',
    };
    const scheduled = applyManualColumnMapping(detected, 'schedule', 'col_4');
    assert.equal(scheduled.schedule, 'col_4');
    assert.equal(scheduled.startTime, '');
    assert.equal(scheduled.endTime, '');
    const timed = applyManualColumnMapping(detected, 'time', 'col_5');
    assert.equal(timed.time, 'col_5');
    assert.equal(timed.startTime, '');
    assert.equal(timed.endTime, '');

    const mapping = {
      ...getEmptyMapping(),
      code: 'col_0',
      name: 'col_1',
      days: 'col_2',
      startTime: 'col_3',
      endTime: 'col_4',
      schedule: 'col_5',
    };
    const parsed = parseExcelRowsToCourses(
      [
        ['Code', 'Title', 'Days', 'Start', 'End', 'Schedule'],
        ['CS 310', 'Incomplete', 'MW', '09:00', '', 'MW 09:00-10:15, F 11:00-12:00'],
        ['CS 311', 'Complete', 'TR', '13:00', '14:15', 'F 08:00-09:00'],
      ],
      1,
      mapping,
    );
    const incomplete = parsed.courses.find((course) => course.code === 'CS 310');
    const complete = parsed.courses.find((course) => course.code === 'CS 311');
    assert.ok(incomplete);
    assert.ok(complete);
    assert.deepEqual(
      incomplete.sessions.map((session) => `${session.day} ${session.startTime}-${session.endTime}`),
      ['monday 09:00-10:15', 'wednesday 09:00-10:15', 'friday 11:00-12:00'],
    );
    assert.deepEqual(
      complete.sessions.map((session) => `${session.day} ${session.startTime}-${session.endTime}`),
      ['tuesday 13:00-14:15', 'thursday 13:00-14:15'],
    );
    assert.equal(parsed.issues.some((issue) => issue.courseId === incomplete.id), false);
  });

  it('reads days from the schedule cell when start and end are set and no days column is mapped', () => {
    const rows = [
      ['Course', 'Title', 'Section', 'Schedule', 'Start Time', 'End Time'],
      ['COSC 221', 'CS B', '001', 'MW 09:00-10:15', '09:00', '10:15'],
    ];
    const analyzed = analyzeTabularRows(rows);
    const mapping = analyzed.detectedMapping;
    assert.equal(mapping.days, '');
    assert.ok(mapping.schedule);
    assert.ok(mapping.startTime);
    assert.ok(mapping.endTime);
    const parsed = parseExcelRowsToCourses(analyzed.rawRows, analyzed.dataStartRow, mapping);
    const course = parsed.courses.find((item) => item.code === 'COSC 221');
    assert.ok(course);
    assert.equal(course.section, '001');
    assert.equal(parsed.issues.some((issue) => /missing days/i.test(issue.message)), false);
    assert.deepEqual(
      course.sessions.map((session) => `${session.day} ${session.startTime}-${session.endTime}`),
      ['monday 09:00-10:15', 'wednesday 09:00-10:15'],
    );
  });
  it('takes weekdays only from the Schedule meeting that matches Start and End', () => {
    const rows = [
      ['Course', 'Title', 'Section', 'Schedule', 'Start Time', 'End Time'],
      ['COSC 221', 'CS B', '001', 'MW 09:00-10:15, F 11:00-12:00', '09:00', '10:15'],
    ];
    const analyzed = analyzeTabularRows(rows);
    const parsed = parseExcelRowsToCourses(analyzed.rawRows, analyzed.dataStartRow, analyzed.detectedMapping);
    const course = parsed.courses.find((item) => item.code === 'COSC 221');
    assert.ok(course);
    assert.deepEqual(
      course.sessions.map((session) => `${session.day} ${session.startTime}-${session.endTime}`),
      ['monday 09:00-10:15', 'wednesday 09:00-10:15'],
    );
  });

  it('reports missing days when Start and End match none of several Schedule meetings', () => {
    const rows = [
      ['Course', 'Title', 'Section', 'Schedule', 'Start Time', 'End Time'],
      ['COSC 221', 'CS B', '001', 'MW 09:00-10:15, F 11:00-12:00', '13:00', '14:15'],
    ];
    const analyzed = analyzeTabularRows(rows);
    const parsed = parseExcelRowsToCourses(analyzed.rawRows, analyzed.dataStartRow, analyzed.detectedMapping);
    assert.equal(parsed.courses.some((item) => item.code === 'COSC 221' && item.sessions.length > 0), false);
    assert.equal(parsed.issues.some((issue) => /missing days/i.test(issue.message)), true);
  });

  it('uses the whole Schedule cell when it holds a single meeting at a different time', () => {
    const rows = [
      ['Course', 'Title', 'Section', 'Schedule', 'Start Time', 'End Time'],
      ['COSC 221', 'CS B', '001', 'MW 09:00-10:15', '13:00', '14:15'],
    ];
    const analyzed = analyzeTabularRows(rows);
    const parsed = parseExcelRowsToCourses(analyzed.rawRows, analyzed.dataStartRow, analyzed.detectedMapping);
    const course = parsed.courses.find((item) => item.code === 'COSC 221');
    assert.ok(course);
    assert.deepEqual(
      course.sessions.map((session) => `${session.day} ${session.startTime}-${session.endTime}`),
      ['monday 13:00-14:15', 'wednesday 13:00-14:15'],
    );
  });
});
