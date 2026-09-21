import { ClassSession, Course, DayOfWeek, DAYS_LIST } from '../../types/schedule';
import { prefixedId } from '../../utils/id';
import { timeToMinutes, minutesToTime } from '../../utils/timeUtils';

export interface MeetingPattern {
  id: string;
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
  room: string;
}

export interface EditableRecognizedItem {
  id: string;
  rawText: string;
  course: Course;
  selected: boolean;
  isEditing: boolean;
  hasError?: boolean;
  errorMessage?: string;
}

const DAY_ORDER = DAYS_LIST.map((d) => d.id);

export const DURATION_CHIPS = [
  { label: '50m', minutes: 50 },
  { label: '75m', minutes: 75 },
  { label: '90m', minutes: 90 },
] as const;

export const SAMPLE_CHIPS = [
  { label: 'CS 101', text: 'CS 101 Computer science MWF 09:00-10:15' },
  { label: 'ITM 380', text: 'ITM 380 (Cloud Computing) - Sec 001, 8:30-10:00 MW, Vanndy You' },
  { label: 'COSC 340', text: 'COSC 340 (Networking Essentials) - Sec 002, 10:15-11:45 MW, Math Sa' },
] as const;

export const MWF: DayOfWeek[] = ['monday', 'wednesday', 'friday'];
export const TTH: DayOfWeek[] = ['tuesday', 'thursday'];

export const FALLBACK_DAYS: DayOfWeek[] = ['monday'];
export const LAST_MINUTE = 23 * 60 + 59;

export function sortDays(days: DayOfWeek[]): DayOfWeek[] {
  return [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
}

export function daysKey(days: DayOfWeek[]): string {
  return sortDays(days).join(',');
}

export function daysEqual(a: DayOfWeek[], b: DayOfWeek[]): boolean {
  return daysKey(a) === daysKey(b);
}

export function formatDaysShort(days: DayOfWeek[]): string {
  const sorted = sortDays(days);
  if (daysEqual(sorted, MWF)) return 'MWF';
  if (daysEqual(sorted, TTH)) return 'TTh';
  return sorted.map((d) => DAYS_LIST.find((x) => x.id === d)?.label ?? d).join(' ');
}

export function toInputTime(value: string, fallback: string): string {
  const trimmed = value.trim();
  const hm = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
  if (hm) {
    const hour = Number(hm[1]);
    const minute = Number(hm[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }
  }
  if (!trimmed) return fallback;
  const as24 = minutesToTime(timeToMinutes(trimmed), false);
  return as24 === '24:00' ? '23:59' : as24;
}

export function endAfterStart(startTime: string, durationMinutes: number): string {
  const startM = timeToMinutes(startTime || '09:00');
  const endM = Math.min(LAST_MINUTE, startM + durationMinutes);
  if (endM <= startM) {
    return minutesToTime(LAST_MINUTE, false);
  }
  return minutesToTime(endM, false);
}

export function sessionsToPatterns(sessions: ClassSession[]): MeetingPattern[] {
  if (sessions.length === 0) {
    return [
      {
        id: prefixedId('p'),
        days: ['monday'],
        startTime: '09:00',
        endTime: '10:15',
        room: '',
      },
    ];
  }

  const groups: MeetingPattern[] = [];
  const indexByKey = new Map<string, number>();

  for (const session of sessions) {
    const startTime = toInputTime(session.startTime, '09:00');
    const endTime = toInputTime(session.endTime, '10:15');
    const key = `${startTime}|${endTime}|${session.room || ''}`;
    const existing = indexByKey.get(key);
    if (existing !== undefined) {
      const group = groups[existing];
      if (!group.days.includes(session.day)) group.days.push(session.day);
    } else {
      indexByKey.set(key, groups.length);
      groups.push({
        id: session.id || `p_${groups.length}`,
        days: [session.day],
        startTime,
        endTime,
        room: session.room || '',
      });
    }
  }

  return groups.map((group) => ({ ...group, days: sortDays(group.days) }));
}

export function patternsToSessions(patterns: MeetingPattern[]): ClassSession[] {
  return patterns.flatMap((pattern) => {
    const days = pattern.days.length > 0 ? sortDays(pattern.days) : FALLBACK_DAYS;
    const startTime = toInputTime(pattern.startTime, '09:00');
    const endTime = toInputTime(pattern.endTime, '10:15');
    return days.map((day) => ({
      id: `${pattern.id}_${day}`,
      day,
      startTime,
      endTime,
      ...(pattern.room.trim() ? { room: pattern.room.trim() } : {}),
    }));
  });
}

export function nextUnusedDay(used: DayOfWeek[]): DayOfWeek {
  const weekday = DAY_ORDER.filter((d) => d !== 'saturday' && d !== 'sunday');
  return weekday.find((d) => !used.includes(d)) || 'friday';
}
