import type { DayOfWeek } from '../types/schedule';

const SESSION_TIME_RE = /^(\d{1,2}):(\d{2})$/;

export interface ParsedSessionTime {
  hours: number;
  minutes: number;
}

/**
 * Parse a YYYY-MM-DD calendar date as local midnight. Returns null if the
 * string is missing, malformed, or is not a real calendar day (e.g. Feb 31).
 */
export function parseLocalDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return date;
}

/**
 * First occurrence of `targetJsDay` (0=Sun … 6=Sat) on or after `startDate`.
 */
export function getFirstDayOccurrence(startDate: Date, targetJsDay: number): Date {
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const currentDay = current.getDay();
  let diff = targetJsDay - currentDay;
  if (diff < 0) diff += 7;
  current.setDate(current.getDate() + diff);
  return current;
}

export function parseSessionTime(timeStr: string | undefined | null): ParsedSessionTime | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = SESSION_TIME_RE.exec(timeStr.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

/** True when both times parse and the start is strictly before the end the same day. */
export function sessionTimesAreValid(
  startTime: string | undefined | null,
  endTime: string | undefined | null
): boolean {
  const start = parseSessionTime(startTime);
  const end = parseSessionTime(endTime);
  if (!start || !end) return false;
  return start.hours * 60 + start.minutes < end.hours * 60 + end.minutes;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * RFC 5545 floating local UNTIL. DTSTART is floating local, so UNTIL must not
 * use a Z suffix (RFC 5545 §3.3.10).
 */
export function formatIcsUntil(date: Date): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}${month}${day}T235959`;
}

/** ICS local datetime: YYYYMMDDTHHmmss (no Z). */
export function formatIcsDateTime(date: Date, timeStr: string): string | null {
  const parsed = parseSessionTime(timeStr);
  if (!parsed) return null;
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}${month}${day}T${pad2(parsed.hours)}${pad2(parsed.minutes)}00`;
}

/**
 * Google Calendar floating local dateTime (RFC3339 without offset) to pair with
 * an explicit `timeZone`. Must not end in Z — a Z + timeZone mix is interpreted
 * inconsistently by Calendar.
 */
export function formatFloatingDateTime(date: Date, timeStr: string): string | null {
  const parsed = parseSessionTime(timeStr);
  if (!parsed) return null;
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}T${pad2(parsed.hours)}:${pad2(parsed.minutes)}:00`;
}

function isDayOfWeek(day: string): day is DayOfWeek {
  switch (day) {
    case 'monday':
    case 'tuesday':
    case 'wednesday':
    case 'thursday':
    case 'friday':
    case 'saturday':
    case 'sunday':
      return true;
    default:
      return false;
  }
}

export function getIcsDayInfo(day: string): { code: string; jsDay: number } | null {
  if (!isDayOfWeek(day)) return null;
  switch (day) {
    case 'sunday':
      return { code: 'SU', jsDay: 0 };
    case 'monday':
      return { code: 'MO', jsDay: 1 };
    case 'tuesday':
      return { code: 'TU', jsDay: 2 };
    case 'wednesday':
      return { code: 'WE', jsDay: 3 };
    case 'thursday':
      return { code: 'TH', jsDay: 4 };
    case 'friday':
      return { code: 'FR', jsDay: 5 };
    case 'saturday':
      return { code: 'SA', jsDay: 6 };
    default: {
      const _never: never = day;
      throw new Error(`Unhandled day: ${String(_never)}`);
    }
  }
}

export function uniplanCalendarSummary(planName?: string): string {
  return `${planName || 'My Schedule'} - Uniplan`;
}
