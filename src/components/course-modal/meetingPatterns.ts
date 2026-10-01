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
  { label: '1h', minutes: 60 },
  { label: '1h30', minutes: 90 },
  { label: '2h', minutes: 120 },
  { label: '2h30', minutes: 150 },
] as const;

export const DEFAULT_DURATION_MINUTES = 90;

export const SAMPLE_CHIPS = [
  { label: 'Schedule Export', text: 'MY SCHEDULE (Plan A)\n----------------------------------------\nITM 380-001: Cloud Computing | Mon, Wed 8:30 AM - 10:00 AM\nCOSC 340-002: Networking Essentials | Mon, Wed 10:15 AM - 11:45 AM\nCYBR 351-001: Intro to Cybersecurity | Mon, Wed 1:45 PM - 3:15 PM\nCOSC 331-002: Operating Systems | Tue, Fri 1:45 PM - 3:15 PM\nCOSC 221-003: Computer Science B | Wed, Fri 12:00 PM - 1:30 PM\n----------------------------------------\nTotal Courses: 5 | Total Credits: 15' },
  { label: 'OS & Cyber', text: 'Operating Systems\tSec001 (12:00–1:30 MW)\nIntro to cyber (1:45-3:15 MW)' },
  { label: 'CS 101', text: 'CS 101 Computer science MWF 09:00-10:00' },
  { label: 'ITM 380', text: 'ITM 380 (Cloud Computing) - Sec 001, 8:30-10:00 MW, Vanndy You' },
] as const;

export const MWF: DayOfWeek[] = ['monday', 'wednesday', 'friday'];
export const TTH: DayOfWeek[] = ['tuesday', 'thursday'];
export const MTH: DayOfWeek[] = ['monday', 'thursday'];
export const TF: DayOfWeek[] = ['tuesday', 'friday'];
export const MW: DayOfWeek[] = ['monday', 'wednesday'];
export const MF: DayOfWeek[] = ['monday', 'friday'];
export const MT: DayOfWeek[] = ['monday', 'tuesday'];

export const DAY_PRESETS = [
  { label: 'MW', days: MW },
  { label: 'TTh', days: TTH },
  { label: 'MTh', days: MTH },
  { label: 'TF', days: TF },
  { label: 'MF', days: MF },
] as const;

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
  if (daysEqual(sorted, MTH)) return 'MTh';
  if (daysEqual(sorted, TF)) return 'TF';
  if (daysEqual(sorted, MW)) return 'MW';
  if (daysEqual(sorted, MF)) return 'MF';
  if (daysEqual(sorted, MT)) return 'MT';
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
        endTime: '10:30',
        room: '',
      },
    ];
  }

  const groups: MeetingPattern[] = [];
  const indexByKey = new Map<string, number>();

  for (const session of sessions) {
    const startTime = toInputTime(session.startTime, '09:00');
    const endTime = toInputTime(session.endTime, '10:30');
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
    const endTime = toInputTime(pattern.endTime, '10:30');
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
