import { SchedulePlan } from '../types/schedule';
import { clearAccessToken, getUsableAccessToken } from './authToken';
import {
  formatFloatingDateTime,
  formatIcsUntil,
  getFirstDayOccurrence,
  getIcsDayInfo,
  parseLocalDate,
  sessionTimesAreValid,
  uniplanCalendarSummary,
} from './calendarDates';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const EVENT_INSERT_CONCURRENCY = 4;
const MAX_RETRIES = 4;
const UNIPLAN_EVENT_FLAG = '1';

export type CalendarSyncErrorCode = 'needsAuth' | 'http' | 'aborted' | 'invalid';

export class CalendarSyncError extends Error {
  readonly status: number | undefined;
  readonly code: CalendarSyncErrorCode;

  constructor(
    message: string,
    options?: { status?: number; code?: CalendarSyncErrorCode; cause?: unknown }
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'CalendarSyncError';
    this.status = options?.status;
    this.code = options?.code ?? 'http';
  }
}

export function isCalendarAuthError(error: unknown): boolean {
  if (error instanceof CalendarSyncError) {
    return error.code === 'needsAuth' || error.status === 401;
  }
  return false;
}

export function isCalendarAbortError(error: unknown): boolean {
  if (error instanceof CalendarSyncError && error.code === 'aborted') return true;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && error.name === 'AbortError') return true;
  return false;
}

// Maps arbitrary hex to nearest Google Calendar colorId
// 1: Lavender, 2: Sage, 3: Grape, 4: Flamingo, 5: Banana, 6: Tangerine
// 7: Peacock, 8: Graphite, 9: Blueberry, 10: Basil, 11: Tomato
const GOOGLE_CALENDAR_COLORS = [
  { id: '1', hex: '#7986cb', r: 121, g: 134, b: 203 },
  { id: '2', hex: '#33b679', r: 51, g: 182, b: 121 },
  { id: '3', hex: '#8e24aa', r: 142, g: 36, b: 170 },
  { id: '4', hex: '#e67c73', r: 230, g: 124, b: 115 },
  { id: '5', hex: '#f6c026', r: 246, g: 192, b: 38 },
  { id: '6', hex: '#f5511d', r: 245, g: 81, b: 29 },
  { id: '7', hex: '#039be5', r: 3, g: 155, b: 229 },
  { id: '8', hex: '#616161', r: 97, g: 97, b: 97 },
  { id: '9', hex: '#3f51b5', r: 63, g: 81, b: 181 },
  { id: '10', hex: '#0b8043', r: 11, g: 128, b: 67 },
  { id: '11', hex: '#d60000', r: 214, g: 0, b: 0 },
];

export function getClosestGoogleColorId(hexColor?: string): string {
  if (!hexColor) return '9';
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return '9';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '9';

  let bestId = '9';
  let bestDist = Infinity;
  for (const gc of GOOGLE_CALENDAR_COLORS) {
    const dr = r - gc.r;
    const dg = g - gc.g;
    const db = b - gc.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestId = gc.id;
    }
  }
  return bestId;
}

export type PreparedCalendarEvent = {
  summary: string;
  location: string;
  description: string;
  colorId: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  recurrence: string[];
  extendedProperties: { private: { uniplan: string } };
};

export type PrepareCalendarEventsResult = {
  events: PreparedCalendarEvent[];
  skippedCount: number;
  untilStr: string;
};

export function prepareCalendarEvents(
  plan: SchedulePlan,
  semesterStart: string,
  semesterEnd: string,
  timeZone: string
): PrepareCalendarEventsResult {
  const startDate = parseLocalDate(semesterStart);
  const endDate = parseLocalDate(semesterEnd);
  if (!startDate || !endDate) {
    throw new CalendarSyncError('Semester start and end dates must be valid YYYY-MM-DD values.', {
      code: 'invalid',
    });
  }
  if (endDate.getTime() < startDate.getTime()) {
    throw new CalendarSyncError('Semester end date must be on or after the start date.', {
      code: 'invalid',
    });
  }

  const untilStr = formatIcsUntil(endDate);
  const events: PreparedCalendarEvent[] = [];
  let skippedCount = 0;

  for (const course of plan.courses || []) {
    for (const session of course.sessions || []) {
      const dayInfo = getIcsDayInfo(session.day);
      if (!dayInfo || !sessionTimesAreValid(session.startTime, session.endTime)) {
        skippedCount += 1;
        continue;
      }

      const firstSessionDate = getFirstDayOccurrence(startDate, dayInfo.jsDay);
      if (firstSessionDate.getTime() > endDate.getTime()) {
        skippedCount += 1;
        continue;
      }

      const startDateTime = formatFloatingDateTime(firstSessionDate, session.startTime);
      const endDateTime = formatFloatingDateTime(firstSessionDate, session.endTime);
      if (!startDateTime || !endDateTime) {
        skippedCount += 1;
        continue;
      }

      const codeSec = course.section ? `${course.code}-${course.section}` : course.code;
      const descParts: string[] = [];
      if (course.instructor) descParts.push(`Instructor: ${course.instructor}`);
      if (course.credits) descParts.push(`Credits: ${course.credits}`);

      events.push({
        summary: `${codeSec} ${course.name}`.trim(),
        location: session.room || '',
        description: descParts.join('\n'),
        colorId: getClosestGoogleColorId(course.color),
        start: { dateTime: startDateTime, timeZone },
        end: { dateTime: endDateTime, timeZone },
        recurrence: [`RRULE:FREQ=WEEKLY;UNTIL=${untilStr};BYDAY=${dayInfo.code}`],
        extendedProperties: { private: { uniplan: UNIPLAN_EVENT_FLAG } },
      });
    }
  }

  return { events, skippedCount, untilStr };
}

export type CalendarSyncResult = {
  calendarId: string;
  reused: boolean;
  eventCount: number;
  skippedCount: number;
};

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new CalendarSyncError('Sync cancelled.', { code: 'aborted' });
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new CalendarSyncError('Sync cancelled.', { code: 'aborted' }));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new CalendarSyncError('Sync cancelled.', { code: 'aborted' }));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const asSeconds = Number(header);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.min(asSeconds * 1000, 30_000);
  }
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) {
    return Math.min(Math.max(asDate - Date.now(), 0), 30_000);
  }
  return null;
}

function googleErrorMessage(status: number, body: unknown): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error: unknown }).error;
    if (err && typeof err === 'object' && 'message' in err) {
      const message = (err as { message: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message;
    }
  }
  return `Google Calendar request failed (${status}).`;
}

async function readResponseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function calendarFetch(
  url: string,
  init: RequestInit,
  token: string,
  signal?: AbortSignal
): Promise<{ res: Response; body: unknown }> {
  let lastError: CalendarSyncError | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    throwIfAborted(signal);
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init.headers || {}),
        },
      });
    } catch (error: unknown) {
      if (isCalendarAbortError(error)) {
        throw new CalendarSyncError('Sync cancelled.', { code: 'aborted', cause: error });
      }
      throw error;
    }

    if (res.status === 401) {
      clearAccessToken();
      await readResponseBody(res);
      throw new CalendarSyncError('Google Calendar access expired. Please sign in again.', {
        status: 401,
        code: 'needsAuth',
      });
    }

    if (res.status === 429 || res.status === 503) {
      const retryAfter = parseRetryAfterMs(res.headers.get('Retry-After'));
      const delay = retryAfter ?? Math.min(500 * 2 ** attempt, 8_000);
      await readResponseBody(res);
      lastError = new CalendarSyncError(
        'Google Calendar is rate-limiting requests. Try again in a moment.',
        { status: res.status, code: 'http' }
      );
      if (attempt === MAX_RETRIES - 1) break;
      await sleep(delay, signal);
      continue;
    }

    const body = await readResponseBody(res);
    return { res, body };
  }

  throw lastError ?? new CalendarSyncError('Google Calendar request failed.', { code: 'http' });
}

async function calendarFetchOk(
  url: string,
  init: RequestInit,
  token: string,
  signal?: AbortSignal
): Promise<unknown> {
  const { res, body } = await calendarFetch(url, init, token, signal);
  if (!res.ok) {
    throw new CalendarSyncError(googleErrorMessage(res.status, body), {
      status: res.status,
      code: 'http',
    });
  }
  return body;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>;
  return null;
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  if (items.length === 0) return;
  let next = 0;
  let firstError: unknown = null;

  async function worker(): Promise<void> {
    while (true) {
      if (firstError) return;
      throwIfAborted(signal);
      const index = next;
      next += 1;
      if (index >= items.length) return;
      try {
        await fn(items[index], index);
      } catch (error: unknown) {
        firstError = error;
        return;
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (firstError) throw firstError;
}

async function listCalendarSummaries(
  token: string,
  signal?: AbortSignal
): Promise<Array<{ id: string; summary: string }>> {
  const found: Array<{ id: string; summary: string }> = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${CALENDAR_API}/users/me/calendarList`);
    url.searchParams.set('maxResults', '250');
    url.searchParams.set('minAccessRole', 'owner');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const body = await calendarFetchOk(url.toString(), { method: 'GET' }, token, signal);
    const record = asRecord(body);
    const items = record && Array.isArray(record.items) ? record.items : [];
    for (const item of items) {
      const row = asRecord(item);
      if (!row) continue;
      const id = typeof row.id === 'string' ? row.id : '';
      const summary = typeof row.summary === 'string' ? row.summary : '';
      const summaryOverride = typeof row.summaryOverride === 'string' ? row.summaryOverride : '';
      if (id) found.push({ id, summary: summaryOverride || summary });
    }
    pageToken = typeof record?.nextPageToken === 'string' ? record.nextPageToken : undefined;
  } while (pageToken);

  return found;
}

async function findExistingUniplanCalendar(
  token: string,
  summary: string,
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const calendars = await listCalendarSummaries(token, signal);
    const match = calendars.find((cal) => cal.summary === summary);
    return match?.id ?? null;
  } catch (error: unknown) {
    // calendar.calendarlist.readonly may be missing; fall back to create.
    if (error instanceof CalendarSyncError && (error.status === 403 || error.status === 404)) {
      return null;
    }
    throw error;
  }
}

async function createUniplanCalendar(
  token: string,
  summary: string,
  timeZone: string,
  signal?: AbortSignal
): Promise<string> {
  const body = await calendarFetchOk(
    `${CALENDAR_API}/calendars`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary,
        description: 'Course schedule generated by Uniplan',
        timeZone,
      }),
    },
    token,
    signal
  );
  const record = asRecord(body);
  const id = record && typeof record.id === 'string' ? record.id : '';
  if (!id) {
    throw new CalendarSyncError('Google Calendar created a calendar without an id.', { code: 'http' });
  }
  return id;
}

async function listEventIds(
  token: string,
  calendarId: string,
  signal?: AbortSignal
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  const encoded = encodeURIComponent(calendarId);

  do {
    const url = new URL(`${CALENDAR_API}/calendars/${encoded}/events`);
    url.searchParams.set('maxResults', '2500');
    url.searchParams.set('showDeleted', 'false');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const body = await calendarFetchOk(url.toString(), { method: 'GET' }, token, signal);
    const record = asRecord(body);
    const items = record && Array.isArray(record.items) ? record.items : [];
    for (const item of items) {
      const row = asRecord(item);
      if (!row) continue;
      if (typeof row.id === 'string' && row.id) ids.push(row.id);
    }
    pageToken = typeof record?.nextPageToken === 'string' ? record.nextPageToken : undefined;
  } while (pageToken);

  return ids;
}

async function deleteEvent(
  token: string,
  calendarId: string,
  eventId: string,
  signal?: AbortSignal
): Promise<void> {
  await calendarFetchOk(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
    token,
    signal
  );
}

async function clearPreviousSyncEvents(
  token: string,
  calendarId: string,
  signal?: AbortSignal,
  onProgress?: (msg: string) => void
): Promise<void> {
  // Dedicated "{plan} - Uniplan" calendars are treated as ours, including events
  // from older clients that did not set extendedProperties.private.uniplan.
  if (onProgress) onProgress('Updating existing calendar...');
  const eventIds = await listEventIds(token, calendarId, signal);
  await mapPool(
    eventIds,
    EVENT_INSERT_CONCURRENCY,
    async (eventId) => {
      await deleteEvent(token, calendarId, eventId, signal);
    },
    signal
  );
}

async function deleteCalendarBestEffort(token: string, calendarId: string): Promise<void> {
  try {
    await calendarFetchOk(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}`,
      { method: 'DELETE' },
      token
    );
  } catch {
    // Best-effort orphan cleanup; the original sync error is what we surface.
  }
}

async function insertEvent(
  token: string,
  calendarId: string,
  event: PreparedCalendarEvent,
  signal?: AbortSignal
): Promise<void> {
  await calendarFetchOk(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    },
    token,
    signal
  );
}

export async function syncScheduleToGoogleCalendar(
  plan: SchedulePlan,
  semesterStart: string,
  semesterEnd: string,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal
): Promise<CalendarSyncResult> {
  throwIfAborted(signal);

  const token = getUsableAccessToken();
  if (!token) {
    throw new CalendarSyncError('Not authenticated with Google Calendar. Please sign in again.', {
      code: 'needsAuth',
    });
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const prepared = prepareCalendarEvents(plan, semesterStart, semesterEnd, timeZone);
  if (prepared.events.length === 0) {
    throw new CalendarSyncError(
      'No valid class sessions to sync. Check that each session has a day and start/end times.',
      { code: 'invalid' }
    );
  }

  const summary = uniplanCalendarSummary(plan.name);
  let calendarId: string | null = null;
  let createdThisSession = false;

  try {
    throwIfAborted(signal);
    if (onProgress) onProgress('Looking for an existing Uniplan calendar...');
    calendarId = await findExistingUniplanCalendar(token, summary, signal);

    if (calendarId) {
      await clearPreviousSyncEvents(token, calendarId, signal, onProgress);
    } else {
      if (onProgress) onProgress('Creating calendar...');
      calendarId = await createUniplanCalendar(token, summary, timeZone, signal);
      createdThisSession = true;
    }

    let done = 0;
    const total = prepared.events.length;
    if (onProgress) onProgress(`Adding events (0/${total})...`);

    await mapPool(
      prepared.events,
      EVENT_INSERT_CONCURRENCY,
      async (event) => {
        await insertEvent(token, calendarId as string, event, signal);
        done += 1;
        if (onProgress) onProgress(`Adding events (${done}/${total})...`);
      },
      signal
    );

    if (onProgress) onProgress('Sync complete!');
    return {
      calendarId,
      reused: !createdThisSession,
      eventCount: prepared.events.length,
      skippedCount: prepared.skippedCount,
    };
  } catch (error: unknown) {
    if (createdThisSession && calendarId) {
      const cleanupToken = getUsableAccessToken() ?? token;
      await deleteCalendarBestEffort(cleanupToken, calendarId);
    }
    throw error;
  }
}
