import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Course, DayOfWeek } from '../types/schedule';
import { timeToMinutes } from './timeUtils';
import { sanitizeGeneratorPrefs } from './generatorPrefs';
import { nextShownCount } from './generatorSession';
import {
  cappedSearchHint,
  gapFallbackNotice,
  generatePlans,
  MAX_CANDIDATES,
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
  credits = 3,
): Course {
  return {
    id,
    code,
    name: code,
    section: sectionName,
    credits,
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
    assert.equal(cappedSearchHint(first.evaluated, first.plans.length), 'Checked 5,000 mixes. There may be better plans');
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
    // A clash skips the rest of that step, so more first sections than the cap are needed to hit it.
    const sectionsA = Array.from({ length: MAX_EVALUATIONS + 200 }, (_, index) => (
      section(`a${index}`, 'A', '09:00', '10:30', String(index + 1).padStart(3, '0'))
    ));
    const sectionsB = Array.from({ length: 3 }, (_, index) => (
      section(`b${index}`, 'B', '10:00', '11:00', String(index + 1).padStart(3, '0'))
    ));
    const result = generatePlans({
      groups: [group('A', sectionsA), group('B', sectionsB)],
      pinnedKeys: ['A', 'B'],
      preferences: preferences(),
    });
    assert.equal(result.plans.length, 0);
    assert.equal(result.capped, true);
    assert.equal(result.emptyReason, 'Checked 5,000 mixes and none were clash-free yet. Search deeper, narrow the list, or clear a blocked time.');
    assert.equal(cappedSearchHint(result.evaluated, result.plans.length), 'Checked 5,000 mixes. There may still be plans');
    assert.equal(result.gapNotice, null);
  });

  it('skips the rest of a step after the first clash instead of spending mixes on it', () => {
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
    assert.equal(result.capped, false);
    assert.equal(result.evaluated, 80);
    assert.equal(result.emptyReason, 'No clash-free mix fits these courses and filters.');
  });

  it('keeps the finished empty reason when every mix was checked', () => {
    const sectionsA = Array.from({ length: 16 }, (_, index) => (
      section(`a${index}`, 'A', '09:00', '10:30', String(index + 1).padStart(3, '0'))
    ));
    const sectionsB = Array.from({ length: 16 }, (_, index) => (
      section(`b${index}`, 'B', '10:00', '11:00', String(index + 1).padStart(3, '0'))
    ));
    const result = generatePlans({
      groups: [group('A', sectionsA), group('B', sectionsB)],
      pinnedKeys: ['A', 'B'],
      preferences: preferences(),
    });
    assert.equal(result.plans.length, 0);
    assert.equal(result.capped, false);
    assert.equal(result.emptyReason, 'No clash-free mix fits these courses and filters.');
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

  it('finds the one clash-free mix of 15 courses without searching deeper', () => {
    const groups = Array.from({ length: 15 }, (_, courseIndex) => {
      const code = `C${courseIndex + 1}`;
      const goodStart = 8 * 60 + courseIndex * 30;
      const sections = [0, 1, 2].map((sectionIndex) => {
        if (sectionIndex === 2) {
          return section(`${code}-good`, code, clock(goodStart), clock(goodStart + 25), '003');
        }
        return section(
          `${code}-bad-${sectionIndex}`,
          code,
          '08:00',
          '20:00',
          sectionIndex === 0 ? '001' : '002',
        );
      });
      return group(code, sections);
    });

    const result = generatePlans({
      groups,
      pinnedKeys: [],
      preferences: preferences({ courseCount: 15 }),
    });
    assert.equal(result.capped, false);
    assert.equal(result.plans.length, 1);
    assert.equal(result.plans[0].courses.length, 15);
    assert.ok(result.plans[0].courses.every((course) => course.section === '003'));
    assert.ok(result.evaluated < MAX_EVALUATIONS);
    assert.equal(result.validCount, 1);
  });

  it('says when two picked courses can never fit together without walking the mix tree', { timeout: 1_000 }, () => {
    const groups = Array.from({ length: 15 }, (_, courseIndex) => {
      const code = `C${courseIndex + 1}`;
      const clashPair = courseIndex >= 13;
      const sections = [0, 1, 2, 3].map((sectionIndex) => {
        if (clashPair) {
          return section(`${code}-${sectionIndex}`, code, '08:00', '09:00', String(sectionIndex + 1).padStart(3, '0'));
        }
        const start = 10 * 60 + courseIndex * 4 + sectionIndex;
        return section(`${code}-${sectionIndex}`, code, clock(start), clock(start + 1), String(sectionIndex + 1).padStart(3, '0'));
      });
      return group(code, sections);
    });
    const started = Date.now();
    const result = generatePlans({
      groups,
      pinnedKeys: [],
      preferences: preferences({ courseCount: 15 }),
    });
    assert.ok(Date.now() - started < 500, 'impossible course pair should not walk the section tree');
    assert.equal(result.plans.length, 0);
    assert.equal(result.evaluated, 0);
    assert.equal(result.capped, false);
    assert.equal(result.emptyReason, 'C14 overlaps every section of C15.');
  });

  it('pauses while skipping clashing sections and resumes the same plans', () => {
    const groups = Array.from({ length: 8 }, (_, courseIndex) => {
      const code = `C${courseIndex + 1}`;
      const goodStart = 8 * 60 + courseIndex * 30;
      const sections = [0, 1, 2].map((sectionIndex) => {
        if (sectionIndex === 2) {
          return section(`${code}-good`, code, clock(goodStart), clock(goodStart + 25), '003');
        }
        return section(`${code}-bad-${sectionIndex}`, code, '08:00', '20:00', sectionIndex === 0 ? '001' : '002');
      });
      return group(code, sections);
    });
    const input = {
      groups,
      pinnedKeys: [] as string[],
      preferences: preferences({ courseCount: 8 }),
    };
    const search = startGeneratorSearch(input);
    search.advance(5);
    assert.equal(search.done, false);
    assert.equal(search.capped, false);
    while (!search.done) search.advance(40);
    const resumed = search.result();
    const fresh = generatePlans(input);
    assert.deepEqual(resumed.plans.map((plan) => plan.id), fresh.plans.map((plan) => plan.id));
    assert.equal(resumed.plans.length, 1);
    assert.ok(resumed.plans[0].courses.every((course) => course.section === '003'));
  });

  it('caps cleanly and rotates across course sets when clashes occur before the last course', { timeout: 1_000 }, () => {
    const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const baseGroups = Array.from({ length: 8 }, (_, index) => {
      const code = `C${index + 1}`;
      const day = days[index % days.length];
      const start = 8 * 60 + Math.floor(index / days.length) * 60;
      const sections = Array.from({ length: 10 }, (__, secIndex) => (
        section(`${code}-${secIndex}`, code, clock(start), clock(start + 45), String(secIndex + 1).padStart(3, '0'), day)
      ));
      return group(code, sections);
    });
    // C9 has 25 sections colliding with C1 (10 * 25 = 250 > 240, so it enters the mix search at depth < last).
    const clashingC9 = group(
      'C9',
      Array.from({ length: 25 }, (_, secIndex) => (
        section(`C9-${secIndex}`, 'C9', '08:00', '08:45', String(secIndex + 1).padStart(3, '0'), 'monday')
      )),
    );
    const tailC10 = group('C10', [section('C10-0', 'C10', '16:00', '16:45', '001', 'friday')]);

    const started = Date.now();
    const cappedResult = generatePlans({
      groups: [...baseGroups, clashingC9, tailC10],
      pinnedKeys: [],
      preferences: preferences({ courseCount: 10 }),
    });
    assert.ok(Date.now() - started < 500, 'intermediate clash tree must cap promptly');
    assert.equal(cappedResult.evaluated, MAX_EVALUATIONS);
    assert.equal(cappedResult.capped, true);
    assert.equal(cappedResult.plans.length, 0);

    // When another course set (replacing C9 with C11) fits, round-robin reaches it without being starved by C9.
    const validC11 = group('C11', [section('C11-0', 'C11', '17:00', '17:45', '001', 'friday')]);
    const mixedResult = generatePlans({
      groups: [...baseGroups, clashingC9, tailC10, validC11],
      pinnedKeys: [...baseGroups.map((item) => item.key), 'C10'],
      preferences: preferences({ courseCount: 10 }),
    });
    assert.ok(mixedResult.plans.length > 0);
    assert.ok(mixedResult.plans[0].courses.some((course) => course.code === 'C11'));
  });

  it('supports up to 15 candidate course groups and slices beyond MAX_CANDIDATES', () => {
    assert.equal(MAX_CANDIDATES, 15);
    const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const groups = Array.from({ length: 16 }, (_, index) => {
      const code = `C${index + 1}`;
      const day = days[index % days.length];
      const start = 8 * 60 + Math.floor(index / days.length) * 60;
      return group(code, [section(code.toLowerCase(), code, clock(start), clock(start + 50), '001', day)]);
    });

    const result = generatePlans({
      groups,
      pinnedKeys: ['C15'],
      preferences: preferences({ courseCount: 2 }),
    });
    assert.ok(result.plans.length > 0);
    assert.ok(result.plans.every((plan) => plan.courses.some((course) => course.code === 'C15')));
    assert.equal(result.plans.some((plan) => plan.courses.some((course) => course.code === 'C16')), false);
  });

  it('spends a capped search on the best-fitting sections, not the first listed', () => {
    // Each course lists its bad sections first (early MWF, late MWF) and its good one last.
    // Good sections sit Tue/Thu 10:00-14:00, so every five that start at different hours fit.
    const groups = Array.from({ length: 10 }, (_, index) => {
      const code = `G${index + 1}`;
      const slot = 10 * 60 + (index % 5) * 60;
      const early = section(`${code}-early`, code, '08:00', '08:50', '001', 'monday');
      const late = section(`${code}-late`, code, '16:30', '17:20', '002', 'friday');
      const good = section(`${code}-good`, code, clock(slot), clock(slot + 50), '003', 'tuesday');
      return group(code, [early, late, good]);
    });

    const result = generatePlans({
      groups,
      pinnedKeys: [],
      preferences: preferences({
        courseCount: 5,
        daysOff: ['monday', 'friday'],
        classStart: 10 * 60,
        classEnd: 15 * 60,
      }),
    });

    assert.equal(result.capped, true);
    assert.equal(result.evaluated, MAX_EVALUATIONS);
    assert.ok(result.plans[0].courses.every((course) => course.id.endsWith('-good')));
  });

  it('accepts courseCount up to 15 and caps higher values to MAX_CANDIDATES in sanitizeGeneratorPrefs', () => {
    assert.equal(sanitizeGeneratorPrefs({ courseCount: 15 }).courseCount, 15);
    assert.equal(sanitizeGeneratorPrefs({ courseCount: 16 }).courseCount, MAX_CANDIDATES);
    assert.equal(sanitizeGeneratorPrefs({ courseCount: 1 }).courseCount, 2);
  });

  describe('unfeasible cases and error explanations', () => {
    it('returns "Pick at least 2 courses." when fewer than 2 candidates provided', () => {
      const res0 = generatePlans({ groups: [], pinnedKeys: [], preferences: preferences() });
      assert.equal(res0.plans.length, 0);
      assert.equal(res0.emptyReason, 'Pick at least 2 courses.');

      const res1 = generatePlans({
        groups: [group('CS101', [section('s1', 'CS101', '09:00', '10:00')])],
        pinnedKeys: [],
        preferences: preferences(),
      });
      assert.equal(res1.plans.length, 0);
      assert.equal(res1.emptyReason, 'Pick at least 2 courses.');
    });

    it('explains when all sections are excluded or locked section is missing/excluded', () => {
      const resExclude = generatePlans({
        groups: [
          group('CS101', [section('s1', 'CS101', '09:00', '10:00')]),
          group('MATH101', [section('m1', 'MATH101', '10:00', '11:00')]),
        ],
        pinnedKeys: [],
        preferences: preferences({ excludedSectionIds: ['s1'] }),
      });
      assert.equal(resExclude.plans.length, 0);
      assert.equal(resExclude.emptyReason, 'CS101 has no section left after exclusions');

      const resLock = generatePlans({
        groups: [
          group('CS101', [
            section('s1', 'CS101', '09:00', '10:00', '001'),
            section('s2', 'CS101', '11:00', '12:00', '002'),
          ]),
          group('MATH101', [section('m1', 'MATH101', '10:00', '11:00')]),
        ],
        pinnedKeys: [],
        preferences: preferences({ lockedSectionIds: ['s1'], excludedSectionIds: ['s1'] }),
      });
      assert.equal(resLock.plans.length, 0);
      assert.equal(resLock.emptyReason, 'CS101 has no section matching the lock');
    });

    it('explains section self-clashing and blocked time overlap', () => {
      const badCourse: Course = {
        id: 'bad1',
        code: 'CS101',
        name: 'CS101',
        section: '001',
        credits: 3,
        color: '#3B82F6',
        sessions: [
          { id: 'sess1', day: 'monday', startTime: '09:00', endTime: '11:00' },
          { id: 'sess2', day: 'monday', startTime: '10:00', endTime: '12:00' },
        ],
      };
      const resSelf = generatePlans({
        groups: [
          group('CS101', [badCourse]),
          group('MATH101', [section('m1', 'MATH101', '13:00', '14:00')]),
        ],
        pinnedKeys: [],
        preferences: preferences(),
      });
      assert.equal(resSelf.plans.length, 0);
      assert.equal(resSelf.emptyReason, 'CS101 has overlapping meetings in every section');

      const resBlock = generatePlans({
        groups: [
          group('CS101', [section('s1', 'CS101', '09:00', '10:30')]),
          group('MATH101', [section('m1', 'MATH101', '14:00', '15:00')]),
        ],
        pinnedKeys: [],
        preferences: preferences({
          blocked: [{ day: 'monday', startMinutes: 9 * 60, endMinutes: 10 * 60 }],
        }),
      });
      assert.equal(resBlock.plans.length, 0);
      assert.equal(resBlock.emptyReason, 'CS101 has no section outside your blocked times');
    });

    it('leaves out an unpinned course with no usable section and still builds plans from the rest', () => {
      const groups = [
        group('A', [section('a', 'A', '09:00', '10:00', '001', 'tuesday')]),
        group('B', [section('b', 'B', '09:00', '10:00', '001', 'wednesday')]),
        group('X', [section('x', 'X', '09:00', '10:00')]),
      ];
      const blocked = [{ day: 'monday' as DayOfWeek, startMinutes: 9 * 60, endMinutes: 10 * 60 }];

      const res = generatePlans({ groups, pinnedKeys: [], preferences: preferences({ blocked }) });
      assert.ok(res.plans.length > 0);
      assert.deepEqual(res.plans[0].courses.map((course) => course.code).sort(), ['A', 'B']);
      assert.deepEqual(res.leftOut, [{ code: 'X', reason: 'X has no section outside your blocked times' }]);
      assert.equal(res.emptyReason, null);

      const pinned = generatePlans({ groups, pinnedKeys: ['X'], preferences: preferences({ blocked }) });
      assert.equal(pinned.plans.length, 0);
      assert.equal(pinned.emptyReason, 'X has no section outside your blocked times');
    });

    it('leaves out an unpinned course whose sections are all excluded', () => {
      const res = generatePlans({
        groups: [
          group('A', [section('a', 'A', '09:00', '10:00', '001', 'tuesday')]),
          group('B', [section('b', 'B', '09:00', '10:00', '001', 'wednesday')]),
          group('X', [section('x', 'X', '11:00', '12:00')]),
        ],
        pinnedKeys: [],
        preferences: preferences({ excludedSectionIds: ['x'] }),
      });
      assert.ok(res.plans.length > 0);
      assert.deepEqual(res.leftOut, [{ code: 'X', reason: 'X has no section left after exclusions' }]);
    });

    it('explains the left-out course when too few usable courses remain for the plan size', () => {
      const res = generatePlans({
        groups: [
          group('A', [section('a', 'A', '09:00', '10:00', '001', 'tuesday')]),
          group('B', [section('b', 'B', '09:00', '10:00', '001', 'wednesday')]),
          group('X', [section('x', 'X', '11:00', '12:00')]),
        ],
        pinnedKeys: [],
        preferences: preferences({ courseCount: 3, excludedSectionIds: ['x'] }),
      });
      assert.equal(res.plans.length, 0);
      assert.equal(res.emptyReason, 'X has no section left after exclusions');
    });

    it('names the left-out course when a credit range fits nothing', () => {
      const res = generatePlans({
        groups: [
          group('A', [section('a', 'A', '09:00', '10:00', '001', 'tuesday')]),
          group('B', [section('b', 'B', '09:00', '10:00', '001', 'wednesday')]),
          group('X', [section('x', 'X', '11:00', '12:00')]),
        ],
        pinnedKeys: [],
        preferences: preferences({ mode: 'credits', creditMin: 20, creditMax: 24, excludedSectionIds: ['x'] }),
      });
      assert.equal(res.plans.length, 0);
      assert.equal(
        res.emptyReason,
        'No mix of at least 2 courses fits that credit range. X has no section left after exclusions, so it was left out.',
      );
    });

    it('explains plan size mismatches and credit range bounds', () => {
      const resPinsOver = generatePlans({
        groups: [
          group('A', [section('a', 'A', '09:00', '10:00')]),
          group('B', [section('b', 'B', '10:00', '11:00')]),
          group('C', [section('c', 'C', '11:00', '12:00')]),
        ],
        pinnedKeys: ['A', 'B', 'C'],
        preferences: preferences({ courseCount: 2 }),
      });
      assert.equal(resPinsOver.plans.length, 0);
      assert.equal(resPinsOver.emptyReason, 'This plan size is smaller than your pinned courses.');

      const resSizeTooBig = generatePlans({
        groups: [
          group('A', [section('a', 'A', '09:00', '10:00')]),
          group('B', [section('b', 'B', '10:00', '11:00')]),
        ],
        pinnedKeys: [],
        preferences: preferences({ courseCount: 4 }),
      });
      assert.equal(resSizeTooBig.plans.length, 0);
      assert.equal(resSizeTooBig.emptyReason, 'No course set fits that plan size.');

      const resCreditPinOver = generatePlans({
        groups: [
          group('A', [section('a', 'A', '09:00', '10:00', '001', 'monday', 4)]),
          group('B', [section('b', 'B', '10:00', '11:00', '001', 'monday', 4)]),
        ],
        pinnedKeys: ['A', 'B'],
        preferences: preferences({ mode: 'credits', creditMin: 4, creditMax: 6 }),
      });
      assert.equal(resCreditPinOver.plans.length, 0);
      assert.equal(resCreditPinOver.emptyReason, 'A, B already total at least 8 credits, above the 6 credit limit.');

      const resCreditBelow = generatePlans({
        groups: [
          group('A', [section('a', 'A', '09:00', '10:00', '001', 'monday', 2)]),
          group('B', [section('b', 'B', '10:00', '11:00', '001', 'monday', 2)]),
        ],
        pinnedKeys: [],
        preferences: preferences({ mode: 'credits', creditMin: 10, creditMax: 15 }),
      });
      assert.equal(resCreditBelow.plans.length, 0);
      assert.equal(resCreditBelow.emptyReason, 'No mix of at least 2 courses fits that credit range.');
    });

    it('explains schedule collisions between pinned courses and impossible daily caps', () => {
      const resClash = generatePlans({
        groups: [
          group('CS101', [section('s1', 'CS101', '09:00', '10:30', 'SEC-A')]),
          group('MATH101', [section('m1', 'MATH101', '10:00', '11:00', 'SEC-B')]),
        ],
        pinnedKeys: ['CS101', 'MATH101'],
        preferences: preferences({ lockedSectionIds: ['s1', 'm1'] }),
      });
      assert.equal(resClash.plans.length, 0);
      assert.equal(resClash.emptyReason, 'CS101 · SEC-A overlaps MATH101 · SEC-B.');

      const resCap = generatePlans({
        groups: [
          group('A', [section('a', 'A', '09:00', '10:00', '001', 'monday')]),
          group('B', [section('b', 'B', '10:00', '11:00', '001', 'monday')]),
          group('C', [section('c', 'C', '11:00', '12:00', '001', 'monday')]),
        ],
        pinnedKeys: [],
        preferences: preferences({ courseCount: 3, dailyCap: 2 }),
      });
      assert.equal(resCap.plans.length, 0);
      assert.equal(resCap.emptyReason, 'Every clash-free mix puts more than 2 courses on one day.');
    });

    it('generates dayOffNotices when requested day off is unavoidable', () => {
      const res = generatePlans({
        groups: [
          group('A', [section('a', 'A', '09:00', '10:00', '001', 'friday')]),
          group('B', [section('b', 'B', '10:00', '11:00', '001', 'monday')]),
        ],
        pinnedKeys: ['A'],
        preferences: preferences({ courseCount: 2, daysOff: ['friday'] }),
      });
      assert.equal(res.plans.length, 1);
      assert.equal(res.dayOffNotices.length, 1);
      assert.equal(res.dayOffNotices[0], "Friday off isn't possible: A meets every Friday.");
    });
  });

  describe('all preferences and exact scoring', () => {
    it('honors creditMin and creditMax with varying credit values', () => {
      const groups = [
        group('C1', [section('c1', 'C1', '08:00', '09:00', '001', 'monday', 1)]),
        group('C2', [section('c2', 'C2', '09:00', '10:00', '001', 'tuesday', 2)]),
        group('C3', [section('c3', 'C3', '10:00', '11:00', '001', 'wednesday', 3)]),
        group('C4', [section('c4', 'C4', '11:00', '12:00', '001', 'thursday', 4)]),
        group('C5', [section('c5', 'C5', '12:00', '13:00', '001', 'friday', 5)]),
      ];
      const res = generatePlans({
        groups,
        pinnedKeys: [],
        preferences: preferences({ mode: 'credits', creditMin: 7, creditMax: 9 }),
      });
      assert.ok(res.plans.length > 0);
      for (const plan of res.plans) {
        const tot = plan.courses.reduce((sum, c) => sum + (c.credits || 0), 0);
        assert.ok(tot >= 7 && tot <= 9, `Credits ${tot} outside [7, 9]`);
      }
    });

    it('evaluates lunch, days off, class hours, daily cap, and matches hand-calculated score', () => {
      // Hand-calculated scenario:
      // Monday:
      // C1: 09:00 - 11:00 (starts 60m before classStart 10:00)
      // C2: 13:00 - 15:00
      // Gap: 13:00 (780) - 11:00 (660) = 120m. Gap limit: 60m -> gap penalty = 60.
      // maxGap = 120 -> maxGap * 0.01 = 1.2
      // Lunch: window 11:30 - 13:30 (120m). Free interval: 11:00 to 13:00 (90m free in window >= 45m) -> Lunch free (0 penalty)
      // Tuesday:
      // C3: 14:00 - 16:30 (ends 30m after classEnd 16:00)
      // Days off requested: Friday (-25 reward)
      // Active days: 2 (Monday, Tuesday) -> 2 * 0.5 = 1.0
      // Total score = 60 (gap) + 1.2 (tie break) + 0 (lunch) - 25 (day off) + 60 (start) + 30 (end) + 1.0 (active days) = 127.20
      const groups = [
        group('C1', [section('c1', 'C1', '09:00', '11:00', '001', 'monday')]),
        group('C2', [section('c2', 'C2', '13:00', '15:00', '001', 'monday')]),
        group('C3', [section('c3', 'C3', '14:00', '16:30', '001', 'tuesday')]),
      ];
      const res = generatePlans({
        groups,
        pinnedKeys: ['C1', 'C2', 'C3'],
        preferences: preferences({
          courseCount: 3,
          gapsEnabled: true,
          gapLimit: 60,
          lunchEnabled: true,
          lunchStart: 11 * 60 + 30,
          lunchEnd: 13 * 60 + 30,
          lunchMinutes: 45,
          daysOff: ['friday'],
          classStart: 10 * 60,
          classEnd: 16 * 60,
        }),
      });
      assert.equal(res.plans.length, 1);
      const plan = res.plans[0];
      assert.equal(Math.round(plan.score * 100) / 100, 127.20);
      assert.ok(plan.tags.includes('Lunch free'));
      assert.ok(plan.tags.includes('Max gap 2h'));
      assert.ok(plan.tags.some((t) => t.includes('Fri off')));
    });

    it('supports 15 non-clashing candidate courses and selects all 15', () => {
      const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      const groups = Array.from({ length: 15 }, (_, i) => {
        const day = days[Math.floor(i / 3)];
        const slot = i % 3;
        const start = 8 * 60 + slot * 120;
        const end = start + 90;
        const code = `COURSE_${i + 1}`;
        return group(code, [section(`s_${i}`, code, clock(start), clock(end), '001', day)]);
      });

      const res = generatePlans({
        groups,
        pinnedKeys: [],
        preferences: preferences({ courseCount: 15 }),
      });
      assert.equal(res.plans.length, 1);
      assert.equal(res.plans[0].courses.length, 15);
      assert.equal(res.plans[0].includedCodes.length, 15);
      assert.equal(res.plans[0].skippedCodes.length, 0);
    });
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
