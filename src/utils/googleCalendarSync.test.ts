import type { Course, SchedulePlan } from '../types/schedule';
import { clearAccessToken, getUsableAccessToken, rememberAccessToken } from './authToken';
import {
  CalendarSyncError,
  getClosestGoogleColorId,
  prepareCalendarEvents,
  syncScheduleToGoogleCalendar,
} from './googleCalendarSync';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function course(overrides: Partial<Course> = {}): Course {
  return {
    id: 'c1',
    code: 'CS101',
    name: 'Intro',
    credits: 3,
    color: '#3f51b5',
    sessions: [
      { id: 's1', day: 'tuesday', startTime: '10:00', endTime: '11:15', room: '204' },
    ],
    ...overrides,
  };
}

function plan(overrides: Partial<SchedulePlan> = {}): SchedulePlan {
  return {
    id: 'plan_1',
    name: 'Plan A',
    courses: [course()],
    ...overrides,
  };
}

assert(getClosestGoogleColorId() === '9', 'missing color defaults to Blueberry');
assert(getClosestGoogleColorId('#3f51b5') === '9', 'exact Blueberry');
assert(getClosestGoogleColorId('#33b679') === '2', 'exact Sage');
assert(getClosestGoogleColorId('#d60000') === '11', 'exact Tomato');
assert(getClosestGoogleColorId('#gggggg') === '9', 'invalid hex defaults');
assert(getClosestGoogleColorId('#fff') === '9', 'short hex defaults');

const prepared = prepareCalendarEvents(plan(), '2026-09-01', '2026-12-18', 'America/New_York');
assert(prepared.events.length === 1, 'one valid session is prepared');
assert(prepared.skippedCount === 0, 'valid session is not skipped');
assert(prepared.untilStr === '20261218T235959', 'UNTIL is floating local');
assert(!prepared.untilStr.endsWith('Z'), 'UNTIL has no Z');
assert(prepared.events[0].start.dateTime === '2026-09-01T10:00:00', 'floating start dateTime');
assert(prepared.events[0].end.dateTime === '2026-09-01T11:15:00', 'floating end dateTime');
assert(!prepared.events[0].start.dateTime.endsWith('Z'), 'start dateTime has no Z');
assert(prepared.events[0].start.timeZone === 'America/New_York', 'timeZone is attached');
assert(prepared.events[0].recurrence[0].includes('UNTIL=20261218T235959'), 'RRULE uses floating UNTIL');
assert(prepared.events[0].colorId === '9', 'course color maps onto Google colorId');

const skipped = prepareCalendarEvents(
  plan({
    courses: [
      course({
        sessions: [
          { id: 'bad', day: 'tuesday', startTime: '', endTime: '10:00' },
          { id: 'ok', day: 'wednesday', startTime: '09:00', endTime: '10:00' },
        ],
      }),
    ],
  }),
  '2026-09-01',
  '2026-12-18',
  'UTC'
);
assert(skipped.events.length === 1, 'invalid times are skipped, valid kept');
assert(skipped.skippedCount === 1, 'invalid session counted as skipped');
assert(skipped.events[0].start.dateTime === '2026-09-02T09:00:00', 'kept session is Wednesday');
assert(
  skipped.events.every((event) => event.start.dateTime !== '2026-09-01T09:00:00'),
  'missing times are not invented as 09:00'
);

let threw = false;
try {
  prepareCalendarEvents(plan(), 'not-a-date', '2026-12-18', 'UTC');
} catch (error: unknown) {
  threw = error instanceof CalendarSyncError && error.code === 'invalid';
}
assert(threw, 'invalid semester dates throw');

type FetchCall = { url: string; method: string; body: unknown };

function jsonResponse(status: number, body: unknown): Response {
  if (body === null) return new Response(null, { status });
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function withMockFetch(
  handler: (url: string, init: RequestInit | undefined) => Response | Promise<Response>,
  run: () => Promise<void>
): Promise<FetchCall[]> {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || 'GET').toUpperCase();
    let parsed: unknown = undefined;
    if (typeof init?.body === 'string') {
      try {
        parsed = JSON.parse(init.body) as unknown;
      } catch {
        parsed = init.body;
      }
    }
    calls.push({ url, method, body: parsed });
    return handler(url, init);
  }) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
  return calls;
}

function pathname(url: string): string {
  return new URL(url).pathname;
}

clearAccessToken();
threw = false;
try {
  await syncScheduleToGoogleCalendar(plan(), '2026-09-01', '2026-12-18');
} catch (error: unknown) {
  threw = error instanceof CalendarSyncError && error.code === 'needsAuth';
}
assert(threw, 'token-missing sync does not succeed');

rememberAccessToken('token-ok');
const createCalls = await withMockFetch((url, init) => {
  const path = pathname(url);
  const method = (init?.method || 'GET').toUpperCase();
  if (path === '/calendar/v3/users/me/calendarList') {
    return jsonResponse(200, { items: [] });
  }
  if (path === '/calendar/v3/calendars' && method === 'POST') {
    return jsonResponse(200, { id: 'cal_new' });
  }
  if (path === '/calendar/v3/calendars/cal_new/events' && method === 'POST') {
    return jsonResponse(200, { id: 'evt_1' });
  }
  return jsonResponse(404, { error: { message: `unexpected ${method} ${path}` } });
}, async () => {
  const result = await syncScheduleToGoogleCalendar(plan(), '2026-09-01', '2026-12-18');
  assert(result.calendarId === 'cal_new', 'new calendar id is returned');
  assert(result.reused === false, 'new calendar is not reused');
  assert(result.eventCount === 1, 'one event inserted');
});
assert(
  createCalls.some((call) => pathname(call.url) === '/calendar/v3/calendars' && call.method === 'POST'),
  'creates a calendar when none exists'
);

rememberAccessToken('token-ok');
const reuseCalls = await withMockFetch((url, init) => {
  const path = pathname(url);
  const method = (init?.method || 'GET').toUpperCase();
  if (path === '/calendar/v3/users/me/calendarList') {
    return jsonResponse(200, { items: [{ id: 'cal_existing', summary: 'Plan A - Uniplan' }] });
  }
  if (path === '/calendar/v3/calendars/cal_existing/events' && method === 'GET') {
    return jsonResponse(200, { items: [{ id: 'old_evt' }] });
  }
  if (path === '/calendar/v3/calendars/cal_existing/events/old_evt' && method === 'DELETE') {
    return jsonResponse(204, null);
  }
  if (path === '/calendar/v3/calendars/cal_existing/events' && method === 'POST') {
    return jsonResponse(200, { id: 'evt_new' });
  }
  return jsonResponse(404, { error: { message: `unexpected ${method} ${path}` } });
}, async () => {
  const result = await syncScheduleToGoogleCalendar(plan(), '2026-09-01', '2026-12-18');
  assert(result.calendarId === 'cal_existing', 'reuses existing calendar');
  assert(result.reused === true, 'reused flag is set');
});
assert(
  !reuseCalls.some((call) => pathname(call.url) === '/calendar/v3/calendars' && call.method === 'POST'),
  'does not create a duplicate calendar'
);
assert(
  reuseCalls.some((call) => call.method === 'POST' && call.url.includes('/calendars/cal_existing/events')),
  'inserts events into the existing calendar'
);

rememberAccessToken('token-ok');
let postFailed = false;
const failCalls = await withMockFetch((url, init) => {
  const path = pathname(url);
  const method = (init?.method || 'GET').toUpperCase();
  if (path === '/calendar/v3/users/me/calendarList') return jsonResponse(200, { items: [] });
  if (path === '/calendar/v3/calendars' && method === 'POST') return jsonResponse(200, { id: 'cal_orphan' });
  if (path === '/calendar/v3/calendars/cal_orphan/events' && method === 'POST') {
    return jsonResponse(500, { error: { message: 'insert failed' } });
  }
  if (path === '/calendar/v3/calendars/cal_orphan' && method === 'DELETE') return jsonResponse(204, null);
  return jsonResponse(404, { error: { message: `unexpected ${method} ${path}` } });
}, async () => {
  try {
    await syncScheduleToGoogleCalendar(plan(), '2026-09-01', '2026-12-18');
  } catch (error: unknown) {
    postFailed = error instanceof CalendarSyncError && error.message.includes('insert failed');
  }
});
assert(postFailed, 'event POST failure does not report success');
assert(
  failCalls.some((call) => pathname(call.url) === '/calendar/v3/calendars/cal_orphan' && call.method === 'DELETE'),
  'orphan calendar created this session is deleted after event failure'
);

rememberAccessToken('token-ok');
let reusedFailDeleted = false;
await withMockFetch((url, init) => {
  const path = pathname(url);
  const method = (init?.method || 'GET').toUpperCase();
  if (path === '/calendar/v3/users/me/calendarList') {
    return jsonResponse(200, { items: [{ id: 'cal_keep', summary: 'Plan A - Uniplan' }] });
  }
  if (path === '/calendar/v3/calendars/cal_keep/events' && method === 'GET') {
    return jsonResponse(200, { items: [] });
  }
  if (path === '/calendar/v3/calendars/cal_keep/events' && method === 'POST') {
    return jsonResponse(500, { error: { message: 'insert failed' } });
  }
  if (path === '/calendar/v3/calendars/cal_keep' && method === 'DELETE') {
    reusedFailDeleted = true;
    return jsonResponse(204, null);
  }
  return jsonResponse(404, { error: { message: `unexpected ${method} ${path}` } });
}, async () => {
  let failed = false;
  try {
    await syncScheduleToGoogleCalendar(plan(), '2026-09-01', '2026-12-18');
  } catch {
    failed = true;
  }
  assert(failed, 'reuse + event failure still throws');
});
assert(!reusedFailDeleted, 'pre-existing calendar is not deleted after event failure');

rememberAccessToken('token-401');
let authFailed = false;
await withMockFetch(() => jsonResponse(401, { error: { message: 'unauthorized' } }), async () => {
  try {
    await syncScheduleToGoogleCalendar(plan(), '2026-09-01', '2026-12-18');
  } catch (error: unknown) {
    authFailed = error instanceof CalendarSyncError && error.code === 'needsAuth';
  }
});
assert(authFailed, '401 is surfaced as needsAuth');
assert(getUsableAccessToken() === null, '401 clears the cached access token');

console.log('googleCalendarSync tests passed');
