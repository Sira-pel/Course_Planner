import { SchedulePlan, Course, ClassSession, DayOfWeek, COURSE_COLORS, LEGACY_COURSE_COLOR_MAP } from '../types/schedule';
import { parseSessionTime } from '../utils/calendarDates';
import { prefixedId } from '../utils/id';

const VALID_DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function safeTrim(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function clockFromParts(hours: number, minutes: number): { minutes: number; formatted: string } | null {
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return {
    minutes: hours * 60 + minutes,
    formatted: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
  };
}

/**
 * Read a clock exactly. "09:00", "9:00 AM", "09:00:00", and "0900" all become
 * "09:00". Unrecognized values return null so the caller can fall back.
 */
function parseClock(timeStr: unknown): { minutes: number; formatted: string } | null {
  if (typeof timeStr === 'number' && Number.isFinite(timeStr) && timeStr >= 0 && timeStr < 1) {
    const total = Math.round(timeStr * 24 * 60) % (24 * 60);
    return clockFromParts(Math.floor(total / 60), total % 60);
  }
  if (typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim().replace(/[\uFF1A\u2236]/g, ':');
  if (!trimmed) return null;

  const ampm = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([ap])\.?m\.?$/i.exec(trimmed);
  if (ampm) {
    let hours = Number(ampm[1]);
    const minutes = ampm[2] == null ? 0 : Number(ampm[2]);
    const pm = ampm[3].toLowerCase() === 'p';
    if (hours > 12) return null;
    if (pm && hours < 12) hours += 12;
    else if (!pm && hours === 12) hours = 0;
    return clockFromParts(hours, minutes);
  }

  const withSeconds = /^(\d{1,2}):(\d{2}):\d{2}$/.exec(trimmed);
  if (withSeconds) return clockFromParts(Number(withSeconds[1]), Number(withSeconds[2]));

  const parsed = parseSessionTime(trimmed);
  if (parsed) return clockFromParts(parsed.hours, parsed.minutes);

  const dotted = /^(\d{1,2})\.(\d{2})$/.exec(trimmed);
  if (dotted) return clockFromParts(Number(dotted[1]), Number(dotted[2]));

  // Military time without a colon: "0900", "900", "1430".
  const military = /^(\d{3,4})$/.exec(trimmed);
  if (military) {
    const digits = military[1].padStart(4, '0');
    return clockFromParts(Number(digits.slice(0, 2)), Number(digits.slice(2)));
  }
  return null;
}

function parseTimeToMinutes(timeStr: unknown, defaultMinutes: number): { minutes: number; formatted: string } {
  return parseClock(timeStr) ?? clockFromParts(Math.floor(defaultMinutes / 60), defaultMinutes % 60)!;
}

export function sanitizeCourse(c: any, index: number): Course {
  if (!c || typeof c !== 'object') {
    c = {};
  }

  const rawId = safeTrim(c.id, 64);
  const courseId = rawId || prefixedId('c');

  const rawCode = safeTrim(c.code, 30);
  const code = rawCode ? rawCode.toUpperCase() : `CRS ${index + 1}`;

  const rawName = safeTrim(c.name, 200);
  const name = rawName;

  const rawColor = safeTrim(c.color, 32);
  let color = rawColor || COURSE_COLORS[index % COURSE_COLORS.length];
  if (color) {
    const normalized = color.toLowerCase();
    if (LEGACY_COURSE_COLOR_MAP[normalized]) {
      color = LEGACY_COURSE_COLOR_MAP[normalized];
    }
  }

  const rawNum =
    typeof c?.credits === 'number'
      ? c.credits
      : typeof c?.credits === 'string' && c.credits.trim() !== ''
        ? Number(c.credits)
        : NaN;
  // Keep values found in a file or paste, including unusual ones such as 99.
  // Only a missing or non-numeric value falls back to 3.
  const credits = Number.isFinite(rawNum) ? Math.max(0, Math.min(999, rawNum)) : 3;

  const sessions: ClassSession[] = Array.isArray(c?.sessions)
    ? c.sessions
        .filter((s: any) => s && typeof s === 'object')
        .map((s: any, sIdx: number): ClassSession => {
          const startParsed = parseTimeToMinutes(s.startTime, 9 * 60);
          const endParsed = parseTimeToMinutes(s.endTime, 10 * 60 + 15);
          let rawStart = startParsed.formatted;
          let rawEnd = endParsed.formatted;
          const sMin = startParsed.minutes;
          let eMin = endParsed.minutes;

          if (eMin <= sMin) {
            const adj = Math.min(23 * 60 + 59, sMin + 50);
            rawEnd = `${Math.floor(adj / 60).toString().padStart(2, '0')}:${(adj % 60).toString().padStart(2, '0')}`;
          }
          return {
            id: safeTrim(s.id, 64) || `s_${courseId}_${sIdx}`,
            day: VALID_DAYS.includes(s.day) ? s.day : 'monday',
            startTime: rawStart,
            endTime: rawEnd,
            room: safeTrim(s.room, 60),
          };
        })
    : [];

  return {
    id: courseId,
    code,
    name,
    section: safeTrim(c.section, 30),
    instructor: safeTrim(c.instructor, 100),
    credits,
    color,
    sessions,
  };
}

export function allocatePlanId(used: Set<string>, preferred?: string): string {
  if (preferred && !used.has(preferred)) return preferred;
  let n = 1;
  let candidate = `plan_${n}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `plan_${n}`;
  }
  return candidate;
}

export function uniquePlanId(existingIds: Iterable<string>): string {
  const used = existingIds instanceof Set ? existingIds : new Set(existingIds);
  let candidate = prefixedId('plan');
  while (used.has(candidate)) {
    candidate = prefixedId('plan');
  }
  return candidate;
}

export function sanitizePlans(rawPlans: any[]): SchedulePlan[] {
  if (!Array.isArray(rawPlans) || rawPlans.length === 0) return [];

  const usedIds = new Set<string>();
  return rawPlans
    .filter((p) => p && typeof p === 'object')
    .map((p, pIdx) => {
      const rawId = safeTrim(p.id, 64) || '';
      const planId = allocatePlanId(usedIds, rawId || undefined);
      usedIds.add(planId);
      const rawPlanName = safeTrim(p.name, 60);
      const planName = rawPlanName || `Plan ${String.fromCharCode(65 + pIdx)}`;
      const courses = Array.isArray(p.courses)
        ? p.courses
            .filter((c: any) => c && typeof c === 'object')
            .map((c: any, cIdx: number) => sanitizeCourse(c, cIdx))
        : [];

      return {
        id: planId,
        name: planName,
        courses,
      };
    });
}

export function sanitizeCatalog(rawCatalog: any[]): Course[] {
  if (!Array.isArray(rawCatalog)) return [];
  return rawCatalog
    .filter((c) => c && typeof c === 'object')
    .map((c, idx) => sanitizeCourse(c, idx));
}
