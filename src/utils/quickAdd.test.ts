import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SAMPLE_CHIPS } from '../components/course-modal/meetingPatterns';
import { parseQuickAdd } from './quickAdd';

const SIS_SAMPLE = `Fall 2026\tCOSC 221\t001\tComputer Science B\tMovsun KUY\tClassroom D29\tTuesday Friday 01:45 PM - 03:15 PM\tRegistered\t\tAug 17, 2026\tDec 4, 2026\tOn Campus\t\t\t
Fall 2026\tCOSC 331\t001\tOperating Systems\tPhutphalla KONG\tClassroom D17\tMonday Wednesday 12:00 PM - 01:30 PM\tRegistered\t\tAug 17, 2026\tDec 4, 2026\tOn Campus\t\t\t
Fall 2026\tCOSC 340\t001\tNetworking Essentials\tSa MATH\tLecture Theater C3\tMonday Wednesday 08:30 AM - 10:00 AM\tRegistered\t\tAug 17, 2026\tDec 4, 2026\tOn Campus\t\t\t
Fall 2026\tCYBR 351\t001\tIntroduction to Cybersecurity\tProhim TAM\tClassroom D7\tMonday Wednesday 01:45 PM - 03:15 PM\tRegistered\t\tAug 17, 2026\tDec 4, 2026\tOn Campus\t\t\t
Fall 2026\tMATH 234A\t002\tAnalytic Geometry and Calculus I\tSovuthy CHEAB\tLecture Theater C13.1 (TLC)\tTuesday Friday 10:15 AM - 12:45 PM\tRegistered\tAug 17, 2026\tAug 17, 2026\tDec 4, 2026\tOn Campus`;

describe('quick add paste', () => {
  it('keeps a multi-line lecture and lab as one course', () => {
    const text = [
      'CS 330',
      'Operating Systems',
      'Lecture  MWF  11:00AM - 11:50AM  Eng 210',
      'Lab  R  3:00PM - 4:50PM  Eng 115',
    ].join('\n');
    const parsed = parseQuickAdd(text);
    assert.equal(parsed.items.length, 1);
    const course = parsed.items[0].course;
    assert.equal(parsed.items[0].success, true);
    assert.equal(course?.code, 'CS 330');
    assert.equal(course?.name, 'Operating Systems');
    const rooms = new Set(course?.sessions.map((session) => session.room));
    assert.deepEqual([...rooms].sort(), ['Eng 115', 'Eng 210']);
    const lecture = course?.sessions.filter((session) => session.room === 'Eng 210') || [];
    assert.deepEqual(lecture.map((session) => session.day).sort(), ['friday', 'monday', 'wednesday']);
    assert.equal(lecture[0]?.startTime, '11:00');
    assert.equal(lecture[0]?.endTime, '11:50');
    const lab = course?.sessions.filter((session) => session.room === 'Eng 115') || [];
    assert.deepEqual(lab.map((session) => session.day), ['thursday']);
    assert.equal(lab[0]?.startTime, '15:00');
    assert.equal(lab[0]?.endTime, '16:50');
    assert.equal(parsed.items.some((item) => /OS 301|ENG 219|ENG 115/.test(item.course?.code || '')), false);
  });

  it('uses a header row for columns and lets a mapping override correct the code', () => {
    const text = [
      'Course,Title,Days,Time,Room,Instructor,Credits',
      'CS 101,Intro to CS,MWF,9:00 AM - 9:50 AM,Rm 204,Ada Lovelace,4',
    ].join('\n');
    const parsed = parseQuickAdd(text);
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0].course?.code, 'CS 101');
    assert.equal(parsed.items[0].course?.name, 'Intro to CS');
    assert.equal(parsed.items[0].course?.credits, 4);
    assert.equal(parsed.items[0].course?.instructor, 'Ada Lovelace');
    assert.ok(parsed.table);

    const titleColumn = parsed.table.columns.find((column) => /title/i.test(column.headerText))?.key;
    assert.ok(titleColumn);
    const overridden = parseQuickAdd(text, 0, { ...parsed.table.mapping, code: titleColumn });
    assert.equal(overridden.items[0].course?.code, 'INTRO TO CS');
  });

  it('imports the school SIS paste by the first seven columns', () => {
    const parsed = parseQuickAdd(SIS_SAMPLE);
    assert.equal(parsed.items.length, 5);
    assert.equal(parsed.items.every((item) => item.success), true);

    const expected = [
      ['COSC 221', '001', 'Computer Science B', 'Movsun KUY', 'Classroom D29', 'friday,tuesday', '13:45-15:15'],
      ['COSC 331', '001', 'Operating Systems', 'Phutphalla KONG', 'Classroom D17', 'monday,wednesday', '12:00-13:30'],
      ['COSC 340', '001', 'Networking Essentials', 'Sa MATH', 'Lecture Theater C3', 'monday,wednesday', '08:30-10:00'],
      ['CYBR 351', '001', 'Introduction to Cybersecurity', 'Prohim TAM', 'Classroom D7', 'monday,wednesday', '13:45-15:15'],
      ['MATH 234A', '002', 'Analytic Geometry and Calculus I', 'Sovuthy CHEAB', 'Lecture Theater C13.1 (TLC)', 'friday,tuesday', '10:15-12:45'],
    ] as const;

    for (const [code, section, title, instructor, room, days, time] of expected) {
      const course = parsed.items.find((item) => item.course?.code === code)?.course;
      assert.ok(course, code);
      assert.equal(course.section, section);
      assert.equal(course.name, title);
      assert.equal(course.instructor, instructor);
      assert.equal(course.credits, 3);
      const gotDays = [...new Set(course.sessions.map((session) => session.day))].sort().join(',');
      const gotTime = [...new Set(course.sessions.map((session) => `${session.startTime}-${session.endTime}`))];
      const gotRooms = [...new Set(course.sessions.map((session) => session.room))];
      assert.equal(gotDays, days);
      assert.deepEqual(gotTime, [time]);
      assert.deepEqual(gotRooms, [room]);
    }
  });

  it('flags a missing or invalid time instead of inventing 9:00 and a course code', () => {
    const text = ['Just a title', 'CS 400 Systems 25:00-26:00 MWF', 'CS 401 Systems MWF'].join('\n');
    const parsed = parseQuickAdd(text);
    assert.equal(parsed.items.length, 3);
    for (const item of parsed.items) {
      assert.equal(item.success, false);
      assert.equal(item.course?.sessions.length, 0);
      assert.equal(item.course?.sessions.some((session) => session.startTime === '09:00'), false);
    }
    assert.equal(parsed.items[0].course?.code, '');
    assert.equal(parsed.items[1].course?.code, 'CS 400');
    assert.equal(parsed.items[2].course?.code, 'CS 401');
    assert.match(parsed.items[1].error || '', /invalid/i);
    assert.match(parsed.items[2].error || '', /missing/i);
  });

  it('keeps 4 credits and still parses the sample chips that already include a time', () => {
    const credited = parseQuickAdd('CS 101 Computer science MWF 09:00-10:00 4 cr');
    assert.equal(credited.items[0].success, true);
    assert.equal(credited.items[0].course?.credits, 4);

    const chip = SAMPLE_CHIPS.find((sample) => sample.label === 'OS & Cyber');
    assert.ok(chip);
    const parsed = parseQuickAdd(chip.text);
    assert.equal(parsed.items.length, 2);
    assert.equal(parsed.items.every((item) => item.success && (item.course?.sessions.length || 0) > 0), true);
    const times = parsed.items.map((item) => item.course?.sessions[0]?.startTime).sort();
    assert.deepEqual(times, ['12:00', '13:45']);
  });
});
