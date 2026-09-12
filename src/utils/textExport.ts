import { Course, SchedulePlan, DAYS_LIST, DayOfWeek } from '../types/schedule';
import { minutesToTime, timeToMinutes } from './timeUtils';

export type TextExportFormat = 'standard' | 'compact' | 'by-day';

const DAY_LABELS_SHORT: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

/**
 * Summarizes course sessions into human readable text like "Mon, Wed, Fri 09:00 AM - 10:15 AM"
 */
function formatSessionSummary(course: Course): string {
  if (course.sessions.length === 0) return 'No scheduled sessions';

  // Group by time range
  const timeGroups = new Map<string, DayOfWeek[]>();
  for (const s of course.sessions) {
    const key = `${s.startTime}__${s.endTime}`;
    if (!timeGroups.has(key)) {
      timeGroups.set(key, []);
    }
    timeGroups.get(key)!.push(s.day);
  }

  const parts: string[] = [];
  timeGroups.forEach((days, timeKey) => {
    const [start, end] = timeKey.split('__');
    const dayStr = days.map(d => DAY_LABELS_SHORT[d]).join(', ');
    const timeFormatted = `${minutesToTime(timeToMinutes(start))} - ${minutesToTime(timeToMinutes(end))}`;
    parts.push(`${dayStr} ${timeFormatted}`);
  });

  return parts.join('; ');
}

/**
 * Generates formatted clean plain text of a schedule plan.
 */
export function generateScheduleText(
  plan: SchedulePlan,
  format: TextExportFormat = 'standard'
): string {
  const courses = plan.courses;
  const totalCredits = courses.reduce((sum, c) => sum + (c.credits || 0), 0);
  const divider = '----------------------------------------';

  if (courses.length === 0) {
    return `MY SCHEDULE (${plan.name})\n${divider}\nNo courses enrolled in this plan.\n${divider}`;
  }

  if (format === 'compact') {
    const lines = [
      `MY SCHEDULE (${plan.name})`,
      divider,
    ];

    courses.forEach(c => {
      const codeSec = c.section ? `${c.code}-${c.section}` : c.code;
      const sessionsStr = formatSessionSummary(c);
      const roomStr = c.sessions[0]?.room ? ` [${c.sessions[0].room}]` : '';
      lines.push(`${codeSec}: ${c.name} | ${sessionsStr}${roomStr}`);
    });

    lines.push(divider);
    lines.push(`Total Courses: ${courses.length} | Total Credits: ${totalCredits}`);
    return lines.join('\n');
  }

  if (format === 'by-day') {
    const lines = [
      `WEEKLY SCHEDULE BY DAY (${plan.name})`,
      divider,
    ];

    // Check each day
    DAYS_LIST.forEach(d => {
      // Find all sessions on this day
      const daySessions: { course: Course; startTime: string; endTime: string; room?: string }[] = [];
      courses.forEach(c => {
        c.sessions.filter(s => s.day === d.id).forEach(s => {
          daySessions.push({
            course: c,
            startTime: s.startTime,
            endTime: s.endTime,
            room: s.room,
          });
        });
      });

      if (daySessions.length > 0) {
        // Sort chronologically
        daySessions.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        lines.push(`\n[${d.full.toUpperCase()}]`);
        daySessions.forEach(ds => {
          const codeSec = ds.course.section ? `${ds.course.code}-${ds.course.section}` : ds.course.code;
          const timeFormatted = `${minutesToTime(timeToMinutes(ds.startTime))} - ${minutesToTime(timeToMinutes(ds.endTime))}`;
          const room = ds.room ? ` (${ds.room})` : '';
          const instructor = ds.course.instructor ? ` - ${ds.course.instructor}` : '';
          lines.push(`  ${timeFormatted} | ${codeSec}: ${ds.course.name}${room}${instructor}`);
        });
      }
    });

    lines.push(`\n${divider}`);
    lines.push(`Total Courses: ${courses.length} | Total Credits: ${totalCredits}`);
    return lines.join('\n');
  }

  // Standard Format
  const lines = [
    `MY SCHEDULE (${plan.name})`,
    divider,
  ];

  courses.forEach(c => {
    const codeSec = c.section ? `${c.code} (Section ${c.section})` : c.code;
    lines.push(`Course: ${codeSec} - ${c.name}`);
    lines.push(`Time: ${formatSessionSummary(c)}`);
    if (c.instructor) {
      lines.push(`Instructor: ${c.instructor}`);
    }
    const room = c.sessions.find(s => s.room)?.room;
    if (room) {
      lines.push(`Room: ${room}`);
    }
    if (c.credits > 0) {
      lines.push(`Credits: ${c.credits}`);
    }
    lines.push(''); // blank line between courses
  });

  lines.push(divider);
  lines.push(`Total Courses: ${courses.length} | Total Credits: ${totalCredits}`);

  return lines.join('\n');
}
