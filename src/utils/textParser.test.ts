import assert from 'node:assert';
import { parseCourseLine, parseBulkCourses, parseTimeRange } from './textParser';

// Test 1: Course code with hyphenated section
{
  const res = parseCourseLine('CS 101-002 Data Structures TR 11:00-12:15 Room 204 Prof. Jane Doe');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.course?.code, 'CS 101');
  assert.strictEqual(res.course?.section, '002');
  assert.strictEqual(res.course?.name, 'Data Structures');
  assert.strictEqual(res.course?.instructor, 'Prof. Jane Doe');
  assert.strictEqual(res.course?.sessions.length, 2);
  assert.strictEqual(res.course?.sessions[0].startTime, '11:00');
  assert.strictEqual(res.course?.sessions[0].endTime, '12:15');
}

// Test 2: Course code with parenthesized title
{
  const res = parseCourseLine('ITM 380 (Cloud Computing) MW 8:30-10:00 AM Rm 101');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.course?.code, 'ITM 380');
  assert.strictEqual(res.course?.name, 'Cloud Computing');
  assert.strictEqual(res.course?.sessions.length, 2);
  assert.strictEqual(res.course?.sessions[0].day, 'monday');
  assert.strictEqual(res.course?.sessions[1].day, 'wednesday');
  assert.strictEqual(res.course?.sessions[0].startTime, '08:30');
  assert.strictEqual(res.course?.sessions[0].endTime, '10:00');
}

// Test 3: Standard course code without section
{
  const res = parseCourseLine('MATH 241 Calculus III MWF 9:00-9:50');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.course?.code, 'MATH 241');
  assert.strictEqual(res.course?.name, 'Calculus III');
  assert.strictEqual(res.course?.sessions.length, 3);
  assert.strictEqual(res.course?.sessions[0].startTime, '09:00');
  assert.strictEqual(res.course?.sessions[0].endTime, '09:50');
}

// Test 4: Military time formatting
{
  const time = parseTimeRange('0830-1000');
  assert.ok(time);
  assert.strictEqual(time.start, '08:30');
  assert.strictEqual(time.end, '10:00');
}

// Test 5: Bulk course parsing
{
  const text = `
    CS 101-001 Intro to CS MWF 9:00-10:15
    BIO 110 General Biology TR 13:00-14:15
  `;
  const results = parseBulkCourses(text);
  assert.strictEqual(results.length, 2);
  assert.strictEqual(results[0].success, true);
  assert.strictEqual(results[0].course?.code, 'CS 101');
  assert.strictEqual(results[1].success, true);
  assert.strictEqual(results[1].course?.code, 'BIO 110');
}

console.log('textParser tests passed');
