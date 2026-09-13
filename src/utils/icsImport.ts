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

function parseIcsTime(dateStr: string): string {
  const isUTC = dateStr.endsWith('Z');
  
  const year = parseInt(dateStr.substring(0,4), 10);
  const month = parseInt(dateStr.substring(4,6), 10) - 1;
  const day = parseInt(dateStr.substring(6,8), 10);
  const hours = parseInt(dateStr.substring(9,11), 10);
  const mins = parseInt(dateStr.substring(11,13), 10);
  const secs = parseInt(dateStr.substring(13,15), 10);
  
  let d: Date;
  if (isUTC) {
      d = new Date(Date.UTC(year, month, day, hours, mins, secs));
  } else {
      d = new Date(year, month, day, hours, mins, secs);
  }
  
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
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
      
      const startTime = parseIcsTime(startMatch[1]);
      const endTime = parseIcsTime(endMatch[1]);
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
          startTime,
          endTime,
          room: location,
        });
      }
      
      // Attempt to extract code from summary e.g. "CS101 - Intro" -> "CS101"
      let code = summary.substring(0, 8);
      const codeMatch = summary.match(/^([A-Z]{2,4}\s*\d{3,4}[A-Z]?)/i);
      if (codeMatch) {
        code = codeMatch[1].trim();
      } else if (summary.split(/[-: ]/).length > 1) {
        code = summary.split(/[-:]/)[0].trim().substring(0, 10);
      }
      
      courses.push({
        id: `c_ics_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        code,
        name: summary,
        credits: 3, // default
        color: COURSE_COLORS[courses.length % COURSE_COLORS.length],
        sessions,
      });
    }
  }
  
  // Try to deduplicate repeating courses (sometimes an ICS will have the same course in multiple events if they have different locations/days)
  const deduped: Record<string, Course> = {};
  
  for (const c of courses) {
    const key = c.code + c.name;
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
         const skey = `${s.day}-${s.startTime}-${s.endTime}`;
         if (!uniqueSessions.has(skey)) {
             uniqueSessions.set(skey, s);
         }
     }
     c.sessions = Array.from(uniqueSessions.values());
  }

  return Object.values(deduped);
}
