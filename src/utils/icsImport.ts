import { Course, ClassSession, DayOfWeek, COURSE_COLORS, LEGACY_COURSE_COLOR_MAP } from '../types/schedule';
import { storedCourseColor } from './courseColorDisplay';
import { prefixedId } from './id';

const dayMap: Record<string, DayOfWeek> = {
  'MO': 'monday',
  'TU': 'tuesday',
  'WE': 'wednesday',
  'TH': 'thursday',
  'FR': 'friday',
  'SA': 'saturday',
  'SU': 'sunday',
};

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseTzid(params: string): string | undefined {
  const match = params.match(/TZID="?([^";]+)"?/i);
  return match ? match[1].trim() : undefined;
}

function timeZoneOffsetMs(utcMs: number, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
      hour: 'numeric',
    }).formatToParts(new Date(utcMs));
    const name = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
    if (/^(GMT|UTC)$/i.test(name)) return 0;
    const match = name.match(/(?:GMT|UTC)([+-])(\d{1,2})(?::(\d{2}))?/i);
    if (!match) return null;
    const sign = match[1] === '-' ? -1 : 1;
    const hours = Number(match[2]);
    const minutes = Number(match[3] || '0');
    return sign * (hours * 60 + minutes) * 60 * 1000;
  } catch {
    return null;
  }
}

/**
 * Convert a wall-clock time in `timeZone` to the viewer's local HH:mm.
 * Unknown/unsupported TZIDs return null so callers can fall back to floating local time.
 */
function zonedWallClockToLocal(
  year: number,
  monthIndex: number,
  day: number,
  hours: number,
  mins: number,
  secs: number,
  timeZone: string
): { hm: string; local: Date } | null {
  const wallAsUtc = Date.UTC(year, monthIndex, day, hours, mins, secs);
  const firstOffset = timeZoneOffsetMs(wallAsUtc, timeZone);
  if (firstOffset === null) return null;
  let utcMs = wallAsUtc - firstOffset;
  const secondOffset = timeZoneOffsetMs(utcMs, timeZone);
  if (secondOffset === null) return null;
  utcMs = wallAsUtc - secondOffset;
  const local = new Date(utcMs);
  return { hm: `${pad2(local.getHours())}:${pad2(local.getMinutes())}`, local };
}

/**
 * ICS clock rules:
 * - `Z` / TZID=UTC: convert UTC to the viewer's local clock.
 * - other TZID: convert that zone's wall clock to local via Intl. If the zone is
 *   unknown, fall back to the written HH:mm as floating local time (schedule grid
 *   is weekly wall-clock, not a full TZ database).
 * - no TZID and no Z: RFC 5545 floating local time, used as-is.
 */
function parseIcsTime(
  dateStr: string,
  defaultTime: string = '09:00',
  tzid?: string
): string {
  if (!dateStr || typeof dateStr !== 'string') return defaultTime;
  const cleanStr = dateStr.trim();
  const tIndex = cleanStr.indexOf('T');
  if (tIndex === -1) {
    return defaultTime;
  }

  const isUTC = cleanStr.endsWith('Z') || (tzid !== undefined && /^(UTC|Etc\/UTC|Etc\/GMT)$/i.test(tzid));
  const timePart = cleanStr.substring(tIndex + 1).replace(/Z$/i, '');
  if (timePart.length < 4) return defaultTime;

  const hours = parseInt(timePart.substring(0, 2), 10);
  const mins = parseInt(timePart.substring(2, 4), 10);
  const secs = timePart.length >= 6 ? parseInt(timePart.substring(4, 6), 10) : 0;
  if (isNaN(hours) || isNaN(mins)) return defaultTime;

  const year = parseInt(cleanStr.substring(0, 4), 10);
  const month = parseInt(cleanStr.substring(4, 6), 10) - 1;
  const day = parseInt(cleanStr.substring(6, 8), 10);

  if (isUTC) {
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      const d = new Date(Date.UTC(year, month, day, hours, mins, isNaN(secs) ? 0 : secs));
      return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }
  } else if (tzid) {
    const converted = zonedWallClockToLocal(
      year,
      month,
      day,
      hours,
      mins,
      isNaN(secs) ? 0 : secs,
      tzid
    );
    if (converted) return converted.hm;
    // Fallback: floating wall-clock from the ICS text.
  }

  return `${pad2(Math.min(23, Math.max(0, hours)))}:${pad2(Math.min(59, Math.max(0, mins)))}`;
}

function weekdayFromIcsDate(dateStr: string, tzid?: string): DayOfWeek {
  const dayNames: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10) - 1;
  const dNum = parseInt(dateStr.substring(6, 8), 10);
  const isUTC = dateStr.endsWith('Z') || (tzid !== undefined && /^(UTC|Etc\/UTC|Etc\/GMT)$/i.test(tzid));

  if (isUTC) {
    const jsDate = new Date(Date.UTC(year, month, dNum));
    return dayNames[jsDate.getDay()];
  }

  if (tzid) {
    const tIndex = dateStr.indexOf('T');
    const timePart = tIndex === -1 ? '' : dateStr.substring(tIndex + 1).replace(/Z$/i, '');
    const hours = timePart.length >= 2 ? parseInt(timePart.substring(0, 2), 10) : 0;
    const mins = timePart.length >= 4 ? parseInt(timePart.substring(2, 4), 10) : 0;
    const converted = zonedWallClockToLocal(
      year,
      month,
      dNum,
      isNaN(hours) ? 0 : hours,
      isNaN(mins) ? 0 : mins,
      0,
      tzid
    );
    if (converted) return dayNames[converted.local.getDay()];
  }

  const jsDate = new Date(year, month, dNum);
  return dayNames[jsDate.getDay()];
}

function parseDescriptionFields(raw: string | undefined): { instructor?: string; credits?: number } {
  if (!raw) return {};
  const text = unescapeIcsText(raw);
  const instructorMatch = text.match(/Instructor:\s*([^|\r\n]+)/i);
  const creditsMatch = text.match(/Credits:\s*(\d+(?:\.\d+)?)/i);
  const instructor = instructorMatch?.[1]?.trim();
  const credits = creditsMatch ? Number(creditsMatch[1]) : undefined;
  return {
    instructor: instructor ? instructor : undefined,
    credits: credits !== undefined && Number.isFinite(credits) && credits >= 0 ? credits : undefined,
  };
}

function parseIcsSummary(summary: string): { code: string; section?: string; name: string } {
  const codeMatch = summary.match(/^([A-Za-z]{2,6})\s*[-_.:]?\s*(\d{2,4}[A-Za-z]?)/);
  if (!codeMatch) {
    const fallback = summary.split(/[-:]/)[0]?.trim().slice(0, 12).toUpperCase() || 'COURSE';
    return { code: fallback, name: summary };
  }
  const code = `${codeMatch[1].toUpperCase()} ${codeMatch[2].toUpperCase()}`;
  let rest = summary.slice(codeMatch[0].length).trim();
  let section: string | undefined;
  const sectionMatch = rest.match(/^[-–—]\s*([0-9A-Za-z]{1,4})\b[:\s-]*/);
  if (sectionMatch) {
    section = sectionMatch[1];
    rest = rest.slice(sectionMatch[0].length).trim();
  }
  rest = rest.replace(/^[:\-–—]+\s*/, '').trim();
  return { code, section, name: rest };
}

function matchIcsProperty(evStr: string, name: string): { params: string; value: string } | null {
  const re = new RegExp(`${name}([^:\\r\\n]*):([^\\r\\n]+)`, 'i');
  const match = evStr.match(re);
  if (!match) return null;
  return { params: match[1] || '', value: match[2].trim() };
}

function parseIcsDuration(durationStr: string): number {
  // Returns duration in minutes (RFC 5545 duration format e.g. PT50M, PT1H15M, P1D)
  const match = durationStr.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/i);
  if (!match) return 50;
  const days = parseInt(match[1] || '0', 10);
  const hours = parseInt(match[2] || '0', 10);
  const mins = parseInt(match[3] || '0', 10);
  const total = days * 1440 + hours * 60 + mins;
  return total > 0 ? total : 50;
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
    const startProp = matchIcsProperty(evStr, 'DTSTART');
    const endProp = matchIcsProperty(evStr, 'DTEND');
    const durationProp = matchIcsProperty(evStr, 'DURATION');
    const rruleMatch = evStr.match(/(?:RRULE|RRULE;[^:]*):(.+)/i);
    const locationMatch = evStr.match(/(?:LOCATION|LOCATION;[^:]*):(.+)/i);
    const descriptionProp = matchIcsProperty(evStr, 'DESCRIPTION');

    if (summaryMatch && startProp && (endProp || durationProp)) {
      const rawSummary = unescapeIcsText(summaryMatch[1].trim());
      const startTzid = parseTzid(startProp.params);
      const endTzid = endProp ? (parseTzid(endProp.params) ?? startTzid) : startTzid;

      // Check for color properties in event (RFC 7986, Apple, Outlook, generic)
      const colorMatch = evStr.match(/(?:COLOR|X-APPLE-CALENDAR-COLOR|X-OUTLOOK-COLOR|X-COLOR):([^\r\n]+)/i);
      let eventColor = colorMatch ? colorMatch[1].trim() : undefined;

      // Check for color emoji prefix e.g. 🔵 CS101 or 🟢 MATH201
      const emojiMatch = rawSummary.match(/^(\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)\s*(.+)$/u);
      let summary = rawSummary;
      if (emojiMatch) {
        summary = emojiMatch[2].trim();
        if (!eventColor) {
          const emojiToColor: Record<string, string> = {
            '🔵': '#3B82F6',
            '🟢': '#10B981',
            '🟡': '#F59E0B',
            '🔴': '#EF4444',
            '🟣': '#8B5CF6',
            '🩷': '#EC4899',
            '🩵': '#06B6D4',
            '🟠': '#F97316',
          };
          if (emojiToColor[emojiMatch[1]]) {
            eventColor = emojiToColor[emojiMatch[1]];
          }
        }
      }
      
      const startTime = parseIcsTime(startProp.value, '09:00', startTzid);
      let endTime = endProp
        ? parseIcsTime(endProp.value, '10:15', endTzid)
        : (() => {
            const durationMin = durationProp ? parseIcsDuration(durationProp.value) : 50;
            const [sh, sm] = startTime.split(':').map(Number);
            const startMin = (isNaN(sh) ? 9 : sh) * 60 + (isNaN(sm) ? 0 : sm);
            const calcEnd = Math.min(23 * 60 + 59, startMin + durationMin);
            const endH = Math.floor(calcEnd / 60).toString().padStart(2, '0');
            const endM = (calcEnd % 60).toString().padStart(2, '0');
            return `${endH}:${endM}`;
          })();

      // Guarantee chronological order (end time after start time)
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const startMin = (isNaN(sh) ? 9 : sh) * 60 + (isNaN(sm) ? 0 : sm);
      const endMin = (isNaN(eh) ? 10 : eh) * 60 + (isNaN(em) ? 0 : em);
      if (endMin <= startMin) {
        const adjustedEnd = Math.min(23 * 60 + 59, startMin + 50);
        const adjH = Math.floor(adjustedEnd / 60).toString().padStart(2, '0');
        const adjM = (adjustedEnd % 60).toString().padStart(2, '0');
        endTime = `${adjH}:${adjM}`;
      }

      const location = locationMatch 
        ? unescapeIcsText(locationMatch[1].trim()).replace(/\n/g, ' ')
        : undefined;

      const descFields = parseDescriptionFields(descriptionProp?.value);
      
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
        days.push(weekdayFromIcsDate(startProp.value, startTzid));
      }
      
      for (const d of days) {
        sessions.push({
          id: prefixedId('s'),
          day: d,
          startTime,
          endTime,
          room: location,
        });
      }
      
      const parsedSummary = parseIcsSummary(summary);

      // A file exported by Uniplan carries the shade a preset is drawn in. Turn it back into the preset.
      const importedColor = eventColor ? storedCourseColor(eventColor) : undefined;
      courses.push({
        id: prefixedId('c'),
        code: parsedSummary.code,
        name: parsedSummary.name,
        section: parsedSummary.section,
        instructor: descFields.instructor,
        credits: descFields.credits ?? 3,
        color:
          (importedColor && LEGACY_COURSE_COLOR_MAP[importedColor.toLowerCase()]) ||
          importedColor ||
          COURSE_COLORS[courses.length % COURSE_COLORS.length],
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
