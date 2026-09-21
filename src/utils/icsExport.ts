import { SchedulePlan, Course } from '../types/schedule';
import {
  formatIcsDateTime,
  formatIcsUntil,
  getFirstDayOccurrence,
  getIcsDayInfo,
  parseLocalDate,
  sessionTimesAreValid,
} from './calendarDates';
import { randomId } from './id';

/**
 * Maps a hex color code to a standard colored circle emoji.
 * Google Calendar, Apple Calendar, and Outlook prominently render emojis in event summaries,
 * ensuring courses remain visibly color-coded on the calendar grid regardless of calendar-level color overrides.
 */
export function getColorEmoji(hexColor?: string): string {
  if (!hexColor || typeof hexColor !== 'string') return '🔵';

  const cleanHex = hexColor.replace('#', '').trim();
  let r = 0, g = 0, b = 0;
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  } else {
    return '🔵';
  }

  if (isNaN(r) || isNaN(g) || isNaN(b)) return '🔵';

  const upperHex = ('#' + cleanHex).toUpperCase();
  const directMap: Record<string, string> = {
    '#3B82F6': '🔵', // Blue
    '#10B981': '🟢', // Emerald
    '#F59E0B': '🟡', // Amber
    '#EF4444': '🔴', // Red
    '#8B5CF6': '🟣', // Violet
    '#EC4899': '🩷', // Pink
    '#06B6D4': '🩵', // Cyan
    '#F97316': '🟠', // Orange
    '#14B8A6': '🟢', // Teal
    '#6366F1': '🔵', // Indigo
    '#84CC16': '🟢', // Lime
    '#D946EF': '🟣', // Fuchsia
  };

  if (directMap[upperHex]) {
    return directMap[upperHex];
  }

  const palette = [
    { emoji: '🔴', r: 239, g: 68, b: 68 },
    { emoji: '🟠', r: 249, g: 115, b: 22 },
    { emoji: '🟡', r: 245, g: 158, b: 11 },
    { emoji: '🟢', r: 16, g: 185, b: 129 },
    { emoji: '🩵', r: 6, g: 182, b: 212 },
    { emoji: '🔵', r: 59, g: 130, b: 246 },
    { emoji: '🟣', r: 139, g: 92, b: 246 },
    { emoji: '🩷', r: 236, g: 72, b: 153 },
    { emoji: '🟤', r: 140, g: 75, b: 30 },
    { emoji: '⚪', r: 240, g: 240, b: 240 },
    { emoji: '⚫', r: 30, g: 41, b: 59 },
  ];

  let bestDist = Infinity;
  let bestEmoji = '🔵';

  for (const item of palette) {
    const dr = r - item.r;
    const dg = g - item.g;
    const db = b - item.b;
    const dist = 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestEmoji = item.emoji;
    }
  }

  return bestEmoji;
}

function escapeIcsText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export interface IcsExportOptions {
  includeColorEmoji?: boolean;
  specificCourseId?: string;
}

/**
 * Generates RFC 5545 and RFC 7986 .ics file content with full color preservation.
 */
export function generateIcsCalendar(
  plan: SchedulePlan,
  semesterStart: string = '2026-09-01',
  semesterEnd: string = '2026-12-18',
  options: IcsExportOptions = {}
): string {
  if (!plan) return '';

  const startDate = parseLocalDate(semesterStart);
  const endDate = parseLocalDate(semesterEnd);
  const untilStr = endDate ? formatIcsUntil(endDate) : '';
  const includeColorEmoji = options.includeColorEmoji !== false;

  const targetCourses = options.specificCourseId
    ? (plan.courses || []).filter((c) => c.id === options.specificCourseId)
    : (plan.courses || []);

  const isSingleCourse = targetCourses.length === 1;
  const singleCourse = isSingleCourse ? targetCourses[0] : null;

  const calendarName = singleCourse
    ? `${singleCourse.code} - ${singleCourse.name}`
    : `${plan.name || 'Schedule'} - University Schedule`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Uniplan//Course Schedule Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];

  if (singleCourse && singleCourse.color) {
    lines.push(`COLOR:${singleCourse.color}`);
    lines.push(`X-APPLE-CALENDAR-COLOR:${singleCourse.color}`);
    lines.push(`X-OUTLOOK-COLOR:${singleCourse.color}`);
    lines.push(`X-COLOR:${singleCourse.color}`);
  } else if (targetCourses.length > 0 && targetCourses[0].color) {
    // Set fallback calendar default color to the first course's color
    lines.push(`X-APPLE-CALENDAR-COLOR:${targetCourses[0].color}`);
  }

  const now = new Date();
  const dtStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  targetCourses.forEach((course) => {
    (course.sessions || []).forEach((session) => {
      if (!startDate || !endDate) return;
      const dayInfo = getIcsDayInfo(session.day);
      if (!dayInfo) return;
      if (!sessionTimesAreValid(session.startTime, session.endTime)) return;

      const firstSessionDate = getFirstDayOccurrence(startDate, dayInfo.jsDay);
      if (firstSessionDate.getTime() > endDate.getTime()) return;
      const dtStart = formatIcsDateTime(firstSessionDate, session.startTime);
      const dtEnd = formatIcsDateTime(firstSessionDate, session.endTime);
      if (!dtStart || !dtEnd) return;

      const codeSec = course.section ? `${course.code}-${course.section}` : course.code;
      const colorPrefix = '';
      const summary = escapeIcsText(`${colorPrefix}${codeSec} ${course.name}`.trim());

      const descParts: string[] = [];
      if (course.instructor) descParts.push(`Instructor: ${course.instructor}`);
      if (course.credits) descParts.push(`Credits: ${course.credits}`);
      if (session.room) descParts.push(`Room: ${session.room}`);
      if (course.color) descParts.push(`Color: ${course.color}`);
      const description = escapeIcsText(descParts.join(' | '));
      const location = escapeIcsText(session.room || '');

      const safeCourseId = String(course.id).replace(/[^a-zA-Z0-9_-]/g, '');
      const safeSessionId = String(session.id).replace(/[^a-zA-Z0-9_-]/g, '');
      const uid = `event_${safeCourseId || 'c'}_${safeSessionId || 's'}_${randomId()}@uniplan.app`;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${dtStamp}`);
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
      lines.push(`RRULE:FREQ=WEEKLY;UNTIL=${untilStr};BYDAY=${dayInfo.code}`);
      lines.push(`SUMMARY:${summary}`);

      // Full cross-platform color preservation (RFC 7986, Apple Calendar, Outlook, generic)
      if (course.color) {
        lines.push(`COLOR:${course.color}`);
        lines.push(`X-APPLE-CALENDAR-COLOR:${course.color}`);
        lines.push(`X-OUTLOOK-COLOR:${course.color}`);
        lines.push(`X-COLOR:${course.color}`);
      }
      lines.push(`CATEGORIES:${escapeIcsText(course.code)}`);

      if (description) lines.push(`DESCRIPTION:${description}`);
      if (location) lines.push(`LOCATION:${location}`);
      lines.push('STATUS:CONFIRMED');
      lines.push('TRANSP:OPAQUE');
      lines.push('END:VEVENT');
    });
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Triggers a browser download of the generated .ics file.
 */
export function downloadIcsFile(
  plan: SchedulePlan,
  semesterStart?: string,
  semesterEnd?: string,
  options?: IcsExportOptions
): void {
  const content = generateIcsCalendar(plan, semesterStart, semesterEnd, options);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;

  let safeName = plan.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (options?.specificCourseId) {
    const course = plan.courses.find((c) => c.id === options.specificCourseId);
    if (course) {
      safeName = `${course.code.replace(/[^a-zA-Z0-9_-]/g, '_')}_${safeName}`;
    }
  }

  anchor.download = `${safeName}_Schedule.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Triggers a download for a single course as an independent .ics file.
 * Useful for importing into Google Calendar as a dedicated course-specific calendar.
 */
export function downloadCourseIcsFile(
  plan: SchedulePlan,
  course: Course,
  semesterStart?: string,
  semesterEnd?: string,
  options?: IcsExportOptions
): void {
  downloadIcsFile(plan, semesterStart, semesterEnd, {
    ...options,
    specificCourseId: course.id,
  });
}

