import { SchedulePlan, DayOfWeek } from '../types/schedule';

const ICS_DAY_CODES: Record<DayOfWeek, { code: string; jsDay: number }> = {
  sunday: { code: 'SU', jsDay: 0 },
  monday: { code: 'MO', jsDay: 1 },
  tuesday: { code: 'TU', jsDay: 2 },
  wednesday: { code: 'WE', jsDay: 3 },
  thursday: { code: 'TH', jsDay: 4 },
  friday: { code: 'FR', jsDay: 5 },
  saturday: { code: 'SA', jsDay: 6 },
};

function escapeIcsText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day, 0, 0, 0);
  }
  return new Date(dateStr);
}

function formatIcsDateTime(date: Date, timeStr: string): string {
  const [h, m] = (timeStr || '09:00').split(':');
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = (h || '09').padStart(2, '0');
  const minutes = (m || '00').padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}00`;
}

function formatIcsUntil(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  // Per RFC 5545 §3.3.10: If DTSTART has floating local time, UNTIL MUST also be floating local time (no Z)
  return `${year}${month}${day}T235959`;
}

/**
 * Finds the first occurrence of target day of the week on or after startDate.
 */
function getFirstDayOccurrence(startDate: Date, targetJsDay: number): Date {
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const currentDay = current.getDay();
  let diff = targetJsDay - currentDay;
  if (diff < 0) diff += 7;
  current.setDate(current.getDate() + diff);
  return current;
}

/**
 * Generates RFC 5545 .ics file content.
 */
export function generateIcsCalendar(
  plan: SchedulePlan,
  semesterStart: string = '2026-09-01',
  semesterEnd: string = '2026-12-18'
): string {
  const startDate = parseLocalDate(semesterStart);
  const endDate = parseLocalDate(semesterEnd);
  const untilStr = formatIcsUntil(endDate);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Uniplan//Course Schedule Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(plan.name || 'Schedule')} - University Schedule`,
  ];

  const now = new Date();
  const dtStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  (plan.courses || []).forEach((course) => {
    (course.sessions || []).forEach((session) => {
      const dayInfo = ICS_DAY_CODES[session.day];
      if (!dayInfo) return;

      const firstSessionDate = getFirstDayOccurrence(startDate, dayInfo.jsDay);
      const dtStart = formatIcsDateTime(firstSessionDate, session.startTime);
      const dtEnd = formatIcsDateTime(firstSessionDate, session.endTime);

      const codeSec = course.section ? `${course.code}-${course.section}` : course.code;
      const summary = escapeIcsText(`${codeSec} ${course.name}`);
      const descParts: string[] = [];
      if (course.instructor) descParts.push(`Instructor: ${course.instructor}`);
      if (course.credits) descParts.push(`Credits: ${course.credits}`);
      if (session.room) descParts.push(`Room: ${session.room}`);
      const description = escapeIcsText(descParts.join(' | '));
      const location = escapeIcsText(session.room || '');

      const safeCourseId = String(course.id).replace(/[^a-zA-Z0-9_-]/g, '');
      const safeSessionId = String(session.id).replace(/[^a-zA-Z0-9_-]/g, '');
      const uid = `event_${safeCourseId || 'c'}_${safeSessionId || 's'}_${Date.now()}@uniplan.app`;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${dtStamp}`);
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
      lines.push(`RRULE:FREQ=WEEKLY;UNTIL=${untilStr};BYDAY=${dayInfo.code}`);
      lines.push(`SUMMARY:${summary}`);
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
  semesterEnd?: string
): void {
  const content = generateIcsCalendar(plan, semesterStart, semesterEnd);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const safeName = plan.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  anchor.download = `${safeName}_Schedule.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
