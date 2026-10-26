import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { useScheduleStore } from '../store/useScheduleStore';
import type { Course, SchedulePlan } from '../types/schedule';

function course(id: string, code: string, section: string, day: 'monday' | 'tuesday' = 'monday'): Course {
  return {
    id,
    code,
    section,
    name: `${code} name`,
    credits: 3,
    color: '#3B82F6',
    sessions: [{ id: `s_${id}_0`, day, startTime: '09:00', endTime: '10:00' }],
  };
}

function seed(plans: SchedulePlan[], catalogCourses: Course[]) {
  useScheduleStore.setState({
    plans,
    catalogCourses,
    activePlanId: plans[0].id,
    ghostPlanIds: [],
    past: [],
    future: [],
  });
}

describe('updateCourse keeps plans and the pool in step', () => {
  beforeEach(() => {
    seed([{ id: 'blank', name: 'Blank', courses: [] }], []);
  });

  it('updates the same course in other plans without sharing ids', () => {
    seed(
      [
        { id: 'a', name: 'A', courses: [course('c1', 'CS 101', '001')] },
        { id: 'b', name: 'B', courses: [{ ...course('c2', 'CS 101', '001'), color: '#10B981' }] },
      ],
      [course('cat_c1', 'CS 101', '001')],
    );

    useScheduleStore.getState().updateCourse(
      { ...course('c1', 'CS 101', '001', 'tuesday'), name: 'Renamed' },
      'a',
    );

    const { plans, catalogCourses } = useScheduleStore.getState();
    const other = plans[1].courses[0];
    assert.equal(other.id, 'c2');
    assert.equal(other.name, 'Renamed');
    assert.equal(other.color, '#10B981');
    assert.equal(other.sessions[0].day, 'tuesday');
    assert.equal(other.sessions[0].id, 's_c2_0');
    assert.equal(catalogCourses.length, 1);
    assert.equal(catalogCourses[0].name, 'Renamed');
  });

  it('renames the pool entry that the course came from, not an unrelated one', () => {
    seed(
      [{ id: 'a', name: 'A', courses: [course('c1', 'CS 101', '001')] }],
      [course('cat_x', 'MATH 200', '001'), course('cat_c1', 'CS 101', '001')],
    );

    useScheduleStore.getState().updateCourse(course('c1', 'CS 102', '001'), 'a');

    const pool = useScheduleStore.getState().catalogCourses;
    assert.equal(pool.length, 2);
    assert.deepEqual(pool.map((c) => c.code).sort(), ['CS 102', 'MATH 200']);
    assert.equal(pool.find((c) => c.id === 'cat_c1')?.code, 'CS 102');
  });

  it('merges into an existing pool entry instead of duplicating it and updates its details', () => {
    seed(
      [{ id: 'a', name: 'A', courses: [course('c1', 'CS 101', '001')] }],
      [course('cat_new', 'CS 102', '001', 'monday'), course('cat_c1', 'CS 101', '001')],
    );

    useScheduleStore.getState().updateCourse(
      {
        ...course('c1', 'CS 102', '001', 'tuesday'),
        name: 'Updated Algorithms',
        instructor: 'Dr. Knuth',
        credits: 4,
      },
      'a',
    );

    const pool = useScheduleStore.getState().catalogCourses;
    assert.equal(pool.length, 1);
    assert.equal(pool[0].code, 'CS 102');
    assert.equal(pool[0].id, 'cat_new');
    assert.equal(pool[0].name, 'Updated Algorithms');
    assert.equal(pool[0].instructor, 'Dr. Knuth');
    assert.equal(pool[0].credits, 4);
    assert.equal(pool[0].sessions[0].day, 'tuesday');
  });

  it('keeps the old pool entry while another plan still uses it', () => {
    seed(
      [
        { id: 'a', name: 'A', courses: [course('c1', 'CS 101', '001')] },
        // Already holds CS 102, so the rename is not applied to this plan.
        { id: 'b', name: 'B', courses: [course('c2', 'CS 101', '001'), course('c3', 'CS 102', '001')] },
      ],
      [course('cat_c1', 'CS 101', '001'), course('cat_c3', 'CS 102', '001')],
    );

    useScheduleStore.getState().updateCourse(
      { ...course('c1', 'CS 102', '001', 'tuesday'), name: 'Edited 102' },
      'a',
    );

    const { plans, catalogCourses } = useScheduleStore.getState();
    assert.deepEqual(plans[1].courses.map((c) => c.code), ['CS 101', 'CS 102']);
    assert.deepEqual(catalogCourses.map((c) => c.code).sort(), ['CS 101', 'CS 102']);
    assert.equal(catalogCourses.find((c) => c.id === 'cat_c3')?.name, 'Edited 102');
    assert.equal(catalogCourses.find((c) => c.id === 'cat_c3')?.sessions[0].day, 'tuesday');
  });

  it('updateCatalogCourse merges into an existing pool entry and avoids duplicates in colliding plans', () => {
    seed(
      [
        { id: 'a', name: 'A', courses: [course('c1', 'CS 101', '001')] },
        { id: 'b', name: 'B', courses: [course('c2', 'CS 101', '001'), course('c3', 'CS 102', '001')] },
      ],
      [course('cat_c1', 'CS 101', '001'), course('cat_c3', 'CS 102', '001')],
    );

    useScheduleStore.getState().updateCatalogCourse({
      ...course('cat_c1', 'CS 102', '001', 'tuesday'),
      name: 'Pool Edited 102',
    });

    const { plans, catalogCourses } = useScheduleStore.getState();
    // Plan A had only CS 101 -> renamed to CS 102
    assert.deepEqual(plans[0].courses.map((c) => c.code), ['CS 102']);
    assert.equal(plans[0].courses[0].name, 'Pool Edited 102');
    // Plan B already had CS 102 -> left untouched so it does not end up with two CS 102s
    assert.deepEqual(plans[1].courses.map((c) => c.code), ['CS 101', 'CS 102']);
    // Pool keeps CS 101 (still used by Plan B) and updates CS 102 without duplicating it
    assert.deepEqual(catalogCourses.map((c) => c.code).sort(), ['CS 101', 'CS 102']);
    assert.equal(catalogCourses.find((c) => c.id === 'cat_c3')?.name, 'Pool Edited 102');
  });

  it('updateCatalogCourse copies a new pool color onto the plan courses', () => {
    seed(
      [{ id: 'a', name: 'A', courses: [{ ...course('c1', 'CS 101', '001'), color: '#10B981' }] }],
      [{ ...course('cat_c1', 'CS 101', '001'), color: '#3B82F6' }],
    );

    useScheduleStore.getState().updateCatalogCourse({
      ...course('cat_c1', 'CS 101', '001'),
      color: '#EF4444',
      name: 'Recolored',
    });

    let state = useScheduleStore.getState();
    assert.equal(state.plans[0].courses[0].color, '#EF4444');
    assert.equal(state.plans[0].courses[0].name, 'Recolored');
    assert.equal(state.catalogCourses[0].color, '#EF4444');

    useScheduleStore.setState({
      plans: [{
        id: 'a',
        name: 'A',
        courses: [{ ...state.plans[0].courses[0], color: '#10B981' }],
      }],
    });
    useScheduleStore.getState().updateCatalogCourse({
      ...useScheduleStore.getState().catalogCourses[0],
      name: 'Title only',
    });
    state = useScheduleStore.getState();
    assert.equal(state.plans[0].courses[0].color, '#10B981');
    assert.equal(state.plans[0].courses[0].name, 'Title only');
  });

  it('updateCatalogCourse keeps a plan course color when another course in that plan already uses the new pool color', () => {
    seed(
      [{
        id: 'a',
        name: 'A',
        courses: [
          { ...course('c1', 'CS 101', '001'), color: '#10B981' },
          { ...course('c2', 'MATH 200', '001'), color: '#EF4444' },
        ],
      }, {
        id: 'b',
        name: 'B',
        courses: [{ ...course('c3', 'CS 101', '001'), color: '#F59E0B' }],
      }],
      [{ ...course('cat_c1', 'CS 101', '001'), color: '#3B82F6' }],
    );

    useScheduleStore.getState().updateCatalogCourse({
      ...course('cat_c1', 'CS 101', '001'),
      color: '#EF4444',
    });

    const { plans, catalogCourses } = useScheduleStore.getState();
    assert.equal(plans[0].courses[0].color, '#10B981');
    assert.equal(plans[0].courses[1].color, '#EF4444');
    assert.equal(plans[1].courses[0].color, '#EF4444');
    assert.equal(catalogCourses[0].color, '#EF4444');
  });

  it('updateCatalogCourse recolors plans that hold a course saved without a color', () => {
    const noColor = { ...course('c2', 'MATH 200', '001') } as Partial<Course>;
    delete noColor.color;
    seed(
      [{ id: 'a', name: 'A', courses: [course('c1', 'CS 101', '001'), noColor as Course] }],
      [course('cat_c1', 'CS 101', '001')],
    );

    useScheduleStore.getState().updateCatalogCourse({
      ...course('cat_c1', 'CS 101', '001'),
      color: '#EF4444',
    });

    assert.equal(useScheduleStore.getState().plans[0].courses[0].color, '#EF4444');
  });

  it('bulkAddCourses returns how many courses it actually added', () => {
    seed(
      [{ id: 'a', name: 'A', courses: [course('c1', 'CS 101', '001')] }],
      [course('cat_c1', 'CS 101', '001')],
    );

    const added = useScheduleStore.getState().bulkAddCourses([
      course('d1', 'CS 101', '001'),
      course('d2', 'MATH 200', '001'),
      course('d3', 'CS 101', '001'),
    ], 'a');
    assert.equal(added, 1);

    const again = useScheduleStore.getState().bulkAddCourses([course('d4', 'MATH 200', '001')], 'a');
    assert.equal(again, 0);
  });

  it('updateCourse merges into an existing code and section instead of duplicating it', () => {
    seed(
      [{
        id: 'a',
        name: 'A',
        courses: [
          course('c1', 'CS 101', '001'),
          { ...course('c2', 'CS 102', '001'), color: '#10B981' },
          course('c2b', 'CS 102', '001'),
        ],
      }],
      [course('cat_c1', 'CS 101', '001'), course('cat_c2', 'CS 102', '001')],
    );

    useScheduleStore.getState().updateCourse(
      { ...course('c1', 'CS 102', '001', 'tuesday'), name: 'Merged 102' },
      'a',
    );

    const { plans, catalogCourses } = useScheduleStore.getState();
    assert.equal(plans[0].courses.length, 1);
    assert.equal(plans[0].courses[0].id, 'c2');
    assert.equal(plans[0].courses[0].code, 'CS 102');
    assert.equal(plans[0].courses[0].name, 'Merged 102');
    assert.equal(plans[0].courses[0].sessions[0].day, 'tuesday');
    assert.equal(plans[0].courses[0].sessions[0].id, 's_c2_0');
    assert.deepEqual(catalogCourses.map((c) => c.code), ['CS 102']);
  });

  it('removeCourseFromPlanByCatalog removes every matching copy', () => {
    seed(
      [{
        id: 'a',
        name: 'A',
        courses: [course('c1', 'CS 101', '001'), course('c1b', 'CS 101', '001'), course('c2', 'MATH 200', '001')],
      }],
      [course('cat_c1', 'CS 101', '001')],
    );

    useScheduleStore.getState().removeCourseFromPlanByCatalog('cat_c1', 'a');

    assert.deepEqual(useScheduleStore.getState().plans[0].courses.map((c) => c.code), ['MATH 200']);
  });

  it('addCourse and bulkAddCourses skip a code and section the plan already has', () => {
    seed(
      [{ id: 'a', name: 'A', courses: [course('c1', 'CS 101', '001')] }],
      [course('cat_c1', 'CS 101', '001')],
    );

    useScheduleStore.getState().addCourse(course('c-new', 'CS 101', '001', 'tuesday'), 'a');
    useScheduleStore.getState().bulkAddCourses([
      course('c-again', 'CS 101', '001'),
      course('c-math', 'MATH 200', '001'),
      course('c-math-2', 'MATH 200', '001'),
    ], 'a');

    const { plans, catalogCourses } = useScheduleStore.getState();
    assert.deepEqual(plans[0].courses.map((c) => `${c.code} ${c.section}`), ['CS 101 001', 'MATH 200 001']);
    assert.equal(plans[0].courses[0].id, 'c1');
    assert.equal(plans[0].courses[0].sessions[0].day, 'monday');
    assert.deepEqual(catalogCourses.map((c) => c.code).sort(), ['CS 101', 'MATH 200']);
  });
});

describe('backup restore settings', () => {
  function backup(extra: Record<string, unknown>): string {
    return JSON.stringify({
      version: 2,
      activePlanId: 'plan_b',
      plans: [{ id: 'plan_b', name: 'Backup', courses: [course('c1', 'CS 101', '001')] }],
      catalogCourses: [],
      ...extra,
    });
  }

  beforeEach(() => {
    seed([{ id: 'plan_1', name: 'Plan A', courses: [] }], []);
    useScheduleStore.setState({
      showWeekends: true,
      startHour: 7,
      endHour: 17,
      timeRangeMode: 'auto',
      weekStart: 'monday',
      mobileCalendarView: 'week',
      theme: 'light',
      themePreference: 'system',
      semesterStart: '2026-09-01',
      semesterEnd: '2026-12-18',
    });
  });

  it('keeps a "system" theme preference instead of fixing it to light or dark', () => {
    useScheduleStore.setState({ themePreference: 'dark', theme: 'dark' });
    const result = useScheduleStore.getState().importFullState(backup({ themePreference: 'system' }));
    assert.equal(result.success, true);
    assert.equal(useScheduleStore.getState().themePreference, 'system');
  });

  it('undo and redo bring the settings back with the schedule', () => {
    const result = useScheduleStore.getState().importFullState(
      backup({
        showWeekends: false,
        startHour: 9,
        endHour: 20,
        timeRangeMode: 'custom',
        weekStart: 'sunday',
        mobileCalendarView: 'day',
        themePreference: 'dark',
        semesterStart: '2027-01-10',
        semesterEnd: '2027-05-01',
      }),
    );
    assert.equal(result.success, true);
    let state = useScheduleStore.getState();
    assert.equal(state.showWeekends, false);
    assert.equal(state.startHour, 9);
    assert.equal(state.themePreference, 'dark');

    state.undo();
    state = useScheduleStore.getState();
    assert.equal(state.plans[0].id, 'plan_1');
    assert.equal(state.showWeekends, true);
    assert.equal(state.startHour, 7);
    assert.equal(state.endHour, 17);
    assert.equal(state.timeRangeMode, 'auto');
    assert.equal(state.weekStart, 'monday');
    assert.equal(state.mobileCalendarView, 'week');
    assert.equal(state.themePreference, 'system');
    assert.equal(state.semesterStart, '2026-09-01');
    assert.equal(state.semesterEnd, '2026-12-18');

    state.redo();
    state = useScheduleStore.getState();
    assert.equal(state.plans[0].id, 'plan_b');
    assert.equal(state.showWeekends, false);
    assert.equal(state.startHour, 9);
    assert.equal(state.themePreference, 'dark');
    assert.equal(state.semesterStart, '2027-01-10');
  });

  it('does not touch settings when undoing an ordinary edit', () => {
    useScheduleStore.getState().createPlan('Extra');
    useScheduleStore.getState().setShowWeekends(false);
    useScheduleStore.getState().undo();
    assert.equal(useScheduleStore.getState().plans.length, 1);
    assert.equal(useScheduleStore.getState().showWeekends, false);
  });
});

describe('lazyWithRetry', () => {
  it('does not re-request a failed chunk in a loop until reset() is called', async () => {
    const { lazyWithRetry } = await import('../components/app/dialogLoaders');
    let calls = 0;
    let shouldFail = true;
    const Stub = () => null;
    const Retryable = lazyWithRetry(async () => {
      calls += 1;
      if (shouldFail) throw new Error('offline');
      return { default: Stub };
    });

    const unwrapLazy = () => {
      const element = (Retryable as unknown as (props: Record<string, never>) => {
        type: { _init: (payload: unknown) => unknown; _payload: unknown };
      })({});
      return element.type._init(element.type._payload);
    };

    // First render starts the import and suspends by throwing a promise.
    let firstThrown: unknown;
    try {
      unwrapLazy();
    } catch (thrown) {
      firstThrown = thrown;
    }
    assert.equal(calls, 1);
    assert.equal(typeof (firstThrown as Promise<unknown>)?.then, 'function');
    await (firstThrown as Promise<unknown>).then(
      () => {},
      () => {},
    );

    // When Suspense wakes up on rejection and re-renders, the failed lazy component
    // must throw the rejection synchronously to the error boundary instead of calling
    // load() again in an endless loop.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert.throws(() => unwrapLazy(), /offline/);
      assert.equal(calls, 1);
    }

    // Once the user retries via reset(), a fresh lazy wrapper requests the chunk again.
    shouldFail = false;
    Retryable.reset();
    let retryThrown: unknown;
    try {
      unwrapLazy();
    } catch (thrown) {
      retryThrown = thrown;
    }
    assert.equal(calls, 2);
    await (retryThrown as Promise<unknown>);
    assert.equal(unwrapLazy(), Stub);
  });
});
