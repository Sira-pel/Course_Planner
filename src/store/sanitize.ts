import { SchedulePlan, Course, ClassSession, DayOfWeek, COURSE_COLORS } from '../types/schedule';
import { parseSessionTime } from '../utils/calendarDates';
import { prefixedId } from '../utils/id';

const VALID_DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function safeTrim(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function parseTimeToMinutes(timeStr: unknown, defaultMinutes: number): { minutes: number; formatted: string } {
  if (typeof timeStr !== 'string' || !timeStr.trim()) {
    const hours = Math.floor(defaultMinutes / 60);
    const mins = defaultMinutes % 60;
    return {
      minutes: defaultMinutes,
      formatted: `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`,
    };
  }

  const trimmed = timeStr.trim();
  const parsed = parseSessionTime(trimmed);
  if (parsed) {
    const minutes = parsed.hours * 60 + parsed.minutes;
    return {
      minutes,
      formatted: `${parsed.hours.toString().padStart(2, '0')}:${parsed.minutes.toString().padStart(2, '0')}`,
    };
  }

  // Handle military time without colon: 3 or 4 digits (e.g., "0900", "900", "1430")
  const militaryMatch = /^(\d{1,2})(\d{2})$/.exec(trimmed);
  if (militaryMatch) {
    const hours = Number(militaryMatch[1]);
    const mins = Number(militaryMatch[2]);
    if (hours >= 0 && hours <= 23 && mins >= 0 && mins <= 59) {
      const minutes = hours * 60 + mins;
      return {
        minutes,
        formatted: `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`,
      };
    }
  }

  // Fallback to default
  const hours = Math.floor(defaultMinutes / 60);
  const mins = defaultMinutes % 60;
  return {
    minutes: defaultMinutes,
    formatted: `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`,
  };
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
  const name = rawName || `${code} Course`;

  const rawColor = safeTrim(c.color, 32);
  const color = rawColor || COURSE_COLORS[index % COURSE_COLORS.length];

  const credits = typeof c?.credits === 'number' && !isNaN(c.credits) ? Math.max(0, Math.min(30, c.credits)) : 3;

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
        ? p.courses.map((c: any, cIdx: number) => sanitizeCourse(c, cIdx))
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
