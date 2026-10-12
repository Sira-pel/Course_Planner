import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Course, DayOfWeek } from '../types/schedule';
import { timeToMinutes } from './timeUtils';
import { nextShownCount } from './generatorSession';
import {
  gapFallbackNotice,
  generatePlans,
  MAX_EVALUATIONS,
  startGeneratorSearch,
  type CourseGroup,
  type GeneratorPreferences,
} from './planGenerator';

function section(
  id: string,
  code: string,
  start: string,
  end: string,
  sectionName = '001',
  day: DayOfWeek = 'monday',
): Course {
  return {
    id,
    code,
    name: code,
    section: sectionName,
    credits: 3,
    color: '#3B82F6',
    sessions: [{ id: `${id}-s`, day, startTime: start, endTime: end }],
  };
}

function group(code: string, sections: Course[]): CourseGroup {
  return {
    key: code.toUpperCase(),
    code,
    name: code,
    color: '#3B82F6',
    sections,
  };
}

function preferences(patch: Partial<GeneratorPreferences> = {}): GeneratorPreferences {
  return {
    mode: 'courses',
    courseCount: 2,
    creditMin: 0,
    creditMax: 30,
    gapsEnabled: false,
    gapLimit: 60,
    lunchEnabled: false,
    lunchStart: 11 * 60 + 30,
    lunchEnd: 13 * 60 + 30,
    lunchMinutes: 45,
    daysOff: [],
    dailyCap: null,
    classStart: null,
    classEnd: null,
    blocked: [],
    lockedSectionIds: [],
    excludedSectionIds: [],
    ...patch,
  };
}

describe('plan generator', () => {
  it('ranks every course group best fit first, past the first five', () => {
    const groups = [
      group('A', [section('a', 'A', '09:00', '10:00')]),
      group('B', [section('b', 'B', '10:00', '11:00')]),
      group('C', [section('c', 'C', '13:00', '14:00')]),
      group('D', [section('d', 'D', '16:00', '17:00')]),
      group('E', [section('e', 'E', '19:00', '20:00')]),
      group('F', [section('f', 'F', '21:00', '22:00')]),
    ];
    const result = generatePlans({ groups, pinnedKeys: [], preferences: preferences() });
    assert.equal(result.capped, false);
    assert.equal(result.plans.length, 15);
    const scores = result.plans.map((plan) => plan.score);
    assert.deepEqual(scores, [...scores].sort((a, b) => a - b));
    assert.deepEqual(result.plans[0].courses.map((course) => course.code).sort(), ['A', 'B']);
    assert.equal(result.plans[0].groupKey, 'A|B');
    assert.equal(new Set(result.plans.map((plan) => plan.groupKey)).size, 15);
  });

  it('fills out to 3 plans with section mixes when fewer than 3 course groups exist', () => {
    const sectionsA = [
      section('a1', 'A', '09:00', '10:00', '001'),
      section('a2', 'A', '08:00', '09:00', '002'),
      section('a3', 'A', '07:00', '08:00', '003'),
      section('a4', 'A', '06:00', '07:00', '004'),
    ];
    const result = generatePlans({
      groups: [group('A', sectionsA), group('B', [section('b1', 'B', '10:00', '11:00')])],
      pinnedKeys: [],
      preferences: preferences(),
    });
    assert.equal(result.plans.length, 3);
    assert.deepEqual(result.plans.map((plan) => plan.groupKey), ['A|B', 'A|B', 'A|B']);
    assert.deepEqual(
      result.plans.map((plan) => plan.courses.find((course) => course.code === 'A')?.section),
      ['001', '002', '003'],
    );
    const onlyOne = generatePlans({
      groups: [
        group('A', [section('a', 'A', '09:00', '10:00')]),
        group('B', [section('b', 'B', '11:00', '12:00')]),
      ],
      pinnedKeys: [],
      preferences: preferences(),
    });
    assert.equal(onlyOne.plans.length, 1);
  });

  it('raises the mix limit and continues without restarting', () => {
    const sectionsA = Array.from({ length: 100 }, (_, index) => (
      section(`a${index}`, 'A', '09:00', '10:00', String(index + 1).padStart(3, '0'))
    ));
    const sectionsB = Array.from({ length: 100 }, (_, index) => (
      section(`b${index}`, 'B', '14:00', '15:00', String(index + 1).padStart(3, '0'))
    ));
    const search = startGeneratorSearch({
      groups: [group('A', sectionsA), group('B', sectionsB)],
      pinnedKeys: [],
      preferences: preferences(),
    });
    while (!search.done) search.advance(500);
    const first = search.result();
    assert.equal(search.evaluated, MAX_EVALUATIONS);
    assert.equal(search.capped, true);
    assert.equal(first.plans.length, 3);
    assert.equal(new Set(first.plans.map((plan) => plan.id)).size, 3);
    assert.equal(first.validCount, MAX_EVALUATIONS);
    const firstId = first.plans[0].id;

    search.raiseLimit(MAX_EVALUATIONS);
    assert.equal(search.done, false);
    assert.equal(search.capped, false);
    while (!search.done) search.advance(500);
    const second = search.result();
    assert.equal(search.evaluated, MAX_EVALUATIONS * 2);
    assert.equal(search.capped, false);
    assert.equal(second.validCount, MAX_EVALUATIONS * 2);
    assert.equal(second.plans.length, 3);
    assert.equal(second.plans[0].id, firstId);
    assert.equal(second.plans[0].groupKey, first.plans[0].groupKey);

    search.raiseLimit();
    assert.equal(search.done, true);
    search.advance(500);
    assert.equal(search.evaluated, MAX_EVALUATIONS * 2);
  });

  it('describes an empty capped search with the number of mixes it actually checked', () => {
    const sectionsA = Array.from({ length: 80 }, (_, index) => (
      section(`a${index}`, 'A', '09:00', '10:30', String(index + 1).padStart(3, '0'))
    ));
    const sectionsB = Array.from({ length: 80 }, (_, index) => (
      section(`b${index}`, 'B', '10:00', '11:00', String(index + 1).padStart(3, '0'))
    ));
    const result = generatePlans({
      groups: [group('A', sectionsA), group('B', sectionsB)],
      pinnedKeys: ['A', 'B'],
      preferences: preferences(),
    });
    assert.equal(result.plans.length, 0);
    assert.equal(result.capped, true);
    assert.equal(result.emptyReason, 'Checked 5,000 mixes and none were clash-free. Narrow the list or clear a blocked time.');
    assert.equal(result.gapNotice, null);
  });

  it('drops plans whose longest gap is over the limit and keeps the max-gap tie break', () => {
    const chain = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((code, index) => {
      const start = 8 * 60 + index * 60;
      return group(code, [section(code.toLowerCase(), code, clock(start), clock(start + 30))]);
    });
    const far = group('H', [section('h', 'H', '20:00', '21:00')]);
    const result = generatePlans({
      groups: [...chain, far],
      pinnedKeys: [],
      preferences: preferences({ gapsEnabled: true, gapLimit: 60, courseCount: 2 }),
    });
    assert.equal(result.gapNotice, null);
    assert.equal(result.plans.length, 6);
    assert.ok(result.plans.every((plan) => longestGap(plan.courses) <= 60));
    assert.equal(result.plans.some((plan) => plan.courses.some((course) => course.code === 'H')), false);
    assert.equal(nextShownCount(5, result.plans.length), 6);
    assert.ok(longestGap(result.plans[5].courses) <= 60);

    const ranked = generatePlans({
      groups: [
        group('A', [section('a', 'A', '09:00', '10:00')]),
        group('B', [section('b', 'B', '10:00', '11:00')]),
        group('C', [section('c', 'C', '12:00', '13:00')]),
      ],
      pinnedKeys: [],
      preferences: preferences({ gapsEnabled: true, gapLimit: 60, courseCount: 2 }),
    });
    assert.deepEqual(ranked.plans[0].courses.map((course) => course.code).sort(), ['A', 'B']);
    assert.equal(longestGap(ranked.plans[0].courses), 0);
    assert.ok(ranked.plans.every((plan) => longestGap(plan.courses) <= 60));
    assert.equal(ranked.plans.some((plan) => plan.groupKey === 'A|C'), false);
  });

  it('falls back to the closest matches when no plan meets the gap limit', () => {
    const result = generatePlans({
      groups: [
        group('A', [section('a', 'A', '09:00', '10:00')]),
        group('B', [section('b', 'B', '12:00', '13:00')]),
        group('C', [section('c', 'C', '15:00', '16:00')]),
      ],
      pinnedKeys: [],
      preferences: preferences({ gapsEnabled: true, gapLimit: 60, courseCount: 2 }),
    });
    assert.equal(result.gapNotice, gapFallbackNotice(60));
    assert.equal(result.gapNotice, 'No plans fit a 1h gap limit; showing closest matches.');
    assert.equal(result.plans.length, 3);
    assert.equal(longestGap(result.plans[0].courses), 120);
    assert.equal(longestGap(result.plans[result.plans.length - 1].courses), 300);
  });

  it('replaces the gap fallback after a deeper search finds a plan that fits', () => {
    const sectionsA = Array.from({ length: 100 }, (_, index) => (
      index < 50
        ? section(`a${index}`, 'A', '09:00', '10:00', String(index + 1).padStart(3, '0'))
        : section(`a${index}`, 'A', '13:00', '14:00', String(index + 1).padStart(3, '0'))
    ));
    const sectionsB = Array.from({ length: 100 }, (_, index) => (
      section(`b${index}`, 'B', '14:00', '15:00', String(index + 1).padStart(3, '0'))
    ));
    const search = startGeneratorSearch({
      groups: [group('A', sectionsA), group('B', sectionsB)],
      pinnedKeys: [],
      preferences: preferences({ gapsEnabled: true, gapLimit: 60 }),
    });
    while (!search.done) search.advance(500);
    const first = search.result();
    assert.equal(first.gapNotice, 'No plans fit a 1h gap limit; showing closest matches.');
    assert.ok(first.plans.length > 0);
    assert.ok(first.plans.every((plan) => longestGap(plan.courses) > 60));

    search.raiseLimit(MAX_EVALUATIONS);
    while (!search.done) search.advance(500);
    const second = search.result();
    assert.equal(second.gapNotice, null);
    assert.ok(second.plans.length > 0);
    assert.ok(second.plans.every((plan) => longestGap(plan.courses) <= 60));
    assert.equal(search.capped, false);
  });
});

function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function longestGap(courses: Course[]): number {
  const byDay = new Map<string, { start: number; end: number }[]>();
  for (const course of courses) {
    for (const session of course.sessions || []) {
      const list = byDay.get(session.day) ?? [];
      list.push({ start: timeToMinutes(session.startTime), end: timeToMinutes(session.endTime) });
      byDay.set(session.day, list);
    }
  }
  let max = 0;
  for (const list of byDay.values()) {
    list.sort((a, b) => a.start - b.start);
    for (let index = 1; index < list.length; index += 1) {
      const gap = list[index].start - list[index - 1].end;
      if (gap > max) max = gap;
    }
  }
  return max;
}
