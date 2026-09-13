import { Course, ClassSession, DayOfWeek, COURSE_COLORS } from '../types/schedule';

const dayMap: Record<string, DayOfWeek> = {
  'MO': 'monday',
  'TU': 'tuesday',
  'WE': 'wednesday',
  'TH': 'thursday',
  'FR': 'friday',
  'SA': 'saturday',
  'SU': 'sunday',
};

function parseIcsTime(dateStr: string, defaultTime: string = '09:00'): string {
  if (!dateStr || typeof dateStr !== 'string') return defaultTime;
  const cleanStr = dateStr.trim();
  const tIndex = cleanStr.indexOf('T');
  if (tIndex === -1) {
    // All-day event or date-only value (e.g. 20260901)
    return defaultTime;
  }

  const isUTC = cleanStr.endsWith('Z');
  const timePart = cleanStr.substring(tIndex + 1).replace('Z', '');
  if (timePart.length < 4) return defaultTime;

  const hours = parseInt(timePart.substring(0, 2), 10);
  const mins = parseInt(timePart.substring(2, 4), 10);
  const secs = timePart.length >= 6 ? parseInt(timePart.substring(4, 6), 10) : 0;

  if (isNaN(hours) || isNaN(mins)) return defaultTime;

  if (isUTC) {
    const year = parseInt(cleanStr.substring(0, 4), 10);
    const month = parseInt(cleanStr.substring(4, 6), 10) - 1;
    const day = parseInt(cleanStr.substring(6, 8), 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      const d = new Date(Date.UTC(year, month, day, hours, mins, isNaN(secs) ? 0 : secs));
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
  }

  return `${Math.min(23, Math.max(0, hours)).toString().padStart(2, '0')}:${Math.min(59, Math.max(0, mins)).toString().padStart(2, '0')}`;
}

export function parseIcsContent(icsContent: string): Course[] {
  if (!icsContent || typeof icsContent !== 'string') return [];
  // RFC 5545 line unfolding: replace CRLF followed by space/tab
  const unfolded = icsContent.replace(/\r?\n[ \t]/g, '');
  const courses: Course[] = [];
  const eventStrs = unfolded.split(/BEGIN:VEVENT/i);
  
  for (let i = 1; i < eventStrs.length; i++) {
    const evStr = eventStrs[i].split(/END:VEVENT/i)[0];
    const summaryMatch = evStr.match(/(?:SUMMARY|SUMMARY;[^:]*):(.+)/i);
    const startMatch = evStr.match(/(?:DTSTART|DTSTART;[^:]*):(\d{8}T?\d{0,6}Z?)/i);
    const endMatch = evStr.match(/(?:DTEND|DTEND;[^:]*):(\d{8}T?\d{0,6}Z?)/i);
    const rruleMatch = evStr.match(/(?:RRULE|RRULE;[^:]*):(.+)/i);
    const locationMatch = evStr.match(/(?:LOCATION|LOCATION;[^:]*):(.+)/i);

    if (summaryMatch && startMatch && endMatch) {
      const summary = summaryMatch[1].trim()
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\n/gi, '\n')
        .replace(/\\\\/g, '\\');
      
      const startTime = parseIcsTime(startMatch[1], '09:00');
      const endTimeRaw = parseIcsTime(endMatch[1], '10:15');

      // Guarantee chronological order (end time after start time)
      let finalStartTime = startTime;
      let finalEndTime = endTimeRaw;
      const [sh, sm] = finalStartTime.split(':').map(Number);
      const [eh, em] = finalEndTime.split(':').map(Number);
      const startMin = (isNaN(sh) ? 9 : sh) * 60 + (isNaN(sm) ? 0 : sm);
      const endMin = (isNaN(eh) ? 10 : eh) * 60 + (isNaN(em) ? 0 : em);
      if (endMin <= startMin) {
        const adjustedEnd = Math.min(23 * 60 + 59, startMin + 50);
        const adjH = Math.floor(adjustedEnd / 60).toString().padStart(2, '0');
        const adjM = (adjustedEnd % 60).toString().padStart(2, '0');
        finalEndTime = `${adjH}:${adjM}`;
      }

      const location = locationMatch 
        ? locationMatch[1].trim()
            .replace(/\\,/g, ',')
            .replace(/\\;/g, ';')
            .replace(/\\n/gi, ' ')
            .replace(/\\\\/g, '\\') 
        : undefined;
      
      const sessions: ClassSession[] = [];
      
      let days: DayOfWeek[] = [];
      if (rruleMatch) {
        const byDayMatch = rruleMatch[1].match(/BYDAY=([^;]+)/i);
        if (byDayMatch) {
          const dayParts = byDayMatch[1].split(',');
          for (const dp of dayParts) {
            const cleanDay = dp.trim().slice(-2).toUpperCase();
            if (dayMap[cleanDay]) {
              days.push(dayMap[cleanDay]);
            }
          }
        }
      }
      
      if (days.length === 0) {
        const dateStr = startMatch[1];
        const isUTC = dateStr.endsWith('Z');
        const year = parseInt(dateStr.substring(0,4), 10);
        const month = parseInt(dateStr.substring(4,6), 10) - 1;
        const dNum = parseInt(dateStr.substring(6,8), 10);
        const jsDate = isUTC ? new Date(Date.UTC(year, month, dNum)) : new Date(year, month, dNum);
        
        const dayNames: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        days.push(dayNames[jsDate.getDay()]);
      }
      
      for (const d of days) {
        sessions.push({
          id: `tmp_${Math.random()}`,
          day: d,
          startTime: finalStartTime,
          endTime: finalEndTime,
          room: location,
        });
      }
      
      // Attempt to extract code and section from summary e.g. "CS101-01 - Intro" -> code: "CS101", section: "01"
      let code = summary.substring(0, 8);
      let section: string | undefined = undefined;

      const codeMatch = summary.match(/^([A-Z]{2,4}\s*\d{3,4}[A-Z]?)/i);
      if (codeMatch) {
        code = codeMatch[1].trim().toUpperCase();
      } else if (summary.split(/[-: ]/).length > 1) {
        code = summary.split(/[-:]/)[0].trim().substring(0, 10).toUpperCase();
      }

      const secMatch = summary.match(/(?:sec(?:tion)?\.?\s*|–\s*sec\s*|,\s*\(?[A-Z0-9]?\)?\s*)([0-9]{1,4}[A-Z]?)/i) || summary.match(/-([0-9]{2,4})/);
      if (secMatch) {
        section = secMatch[1].trim();
      }
      
      courses.push({
        id: `c_ics_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        code,
        name: summary,
        section,
        credits: 3, // default
        color: COURSE_COLORS[courses.length % COURSE_COLORS.length],
        sessions,
      });
    }
  }
  
  // Try to deduplicate repeating courses without merging distinct sections
  const deduped: Record<string, Course> = {};
  
  for (const c of courses) {
    const key = `${c.code.trim().toUpperCase()}__${(c.section || '').trim().toUpperCase()}__${c.name.trim().toLowerCase()}`;
    if (deduped[key]) {
      deduped[key].sessions.push(...c.sessions);
    } else {
      deduped[key] = c;
    }
  }
  
  // Further dedup sessions inside the course (e.g. if event repeated exactly the same)
  for (const c of Object.values(deduped)) {
    const uniqueSessions = new Map<string, ClassSession>();
    for (const s of c.sessions) {
      const skey = `${s.day}-${s.startTime}-${s.endTime}-${s.room || ''}`;
      if (!uniqueSessions.has(skey)) {
        uniqueSessions.set(skey, s);
      }
    }
    c.sessions = Array.from(uniqueSessions.values()).map((s, sIdx) => ({
      ...s,
      id: `s_${c.id}_${sIdx}`,
    }));
  }

  return Object.values(deduped);
}
