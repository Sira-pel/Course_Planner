import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Course, DayOfWeek } from '../types/schedule';
import {
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
    gapsEnabled: true,
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
  });
});
