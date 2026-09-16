import { SchedulePlan, Course, ClassSession, DayOfWeek, COURSE_COLORS } from '../types/schedule';

const VALID_DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function sanitizeCourse(c: any, index: number): Course {
  const courseId = typeof c?.id === 'string' && c.id.trim() ? c.id.trim() : `c_${Date.now()}_${index}`;
  const code = typeof c?.code === 'string' && c.code.trim() ? c.code.trim().toUpperCase() : `CRS ${index + 1}`;
  const name = typeof c?.name === 'string' && c.name.trim() ? c.name.trim() : `${code} Course`;
  const color = typeof c?.color === 'string' && c.color.trim() ? c.color.trim() : COURSE_COLORS[index % COURSE_COLORS.length];
  const credits = typeof c?.credits === 'number' && !isNaN(c.credits) ? Math.max(0, Math.min(30, c.credits)) : 3;

  const sessions: ClassSession[] = Array.isArray(c?.sessions)
    ? c.sessions
        .filter((s: any) => s && typeof s === 'object')
        .map((s: any, sIdx: number): ClassSession => {
          const rawStart = typeof s.startTime === 'string' && s.startTime ? s.startTime : '09:00';
          let rawEnd = typeof s.endTime === 'string' && s.endTime ? s.endTime : '10:15';
          const [sh, sm] = rawStart.split(':').map(Number);
          const [eh, em] = rawEnd.split(':').map(Number);
          const sMin = (isNaN(sh) ? 9 : sh) * 60 + (isNaN(sm) ? 0 : sm);
          const eMin = (isNaN(eh) ? 10 : eh) * 60 + (isNaN(em) ? 15 : em);
          if (eMin <= sMin) {
            const adj = Math.min(23 * 60 + 59, sMin + 50);
            rawEnd = `${Math.floor(adj / 60).toString().padStart(2, '0')}:${(adj % 60).toString().padStart(2, '0')}`;
          }
          return {
            id: typeof s.id === 'string' && s.id ? s.id : `s_${courseId}_${sIdx}`,
            day: VALID_DAYS.includes(s.day) ? s.day : 'monday',
            startTime: rawStart,
            endTime: rawEnd,
            room: typeof s.room === 'string' && s.room.trim() ? s.room.trim() : undefined,
          };
        })
    : [];

  return {
    id: courseId,
    code,
    name,
    section: typeof c?.section === 'string' && c.section.trim() ? c.section.trim() : undefined,
    instructor: typeof c?.instructor === 'string' && c.instructor.trim() ? c.instructor.trim() : undefined,
    credits,
    color,
    sessions: sessions.length > 0 ? sessions : [{ id: `s_${courseId}_0`, day: 'monday', startTime: '09:00', endTime: '10:15' }],
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
  const timed = `plan_${Date.now()}`;
  if (!used.has(timed)) return timed;
  return allocatePlanId(used);
}

export function sanitizePlans(rawPlans: any[]): SchedulePlan[] {
  if (!Array.isArray(rawPlans) || rawPlans.length === 0) return [];

  const usedIds = new Set<string>();
  return rawPlans
    .filter((p) => p && typeof p === 'object')
    .map((p, pIdx) => {
      const rawId = typeof p.id === 'string' && p.id.trim() ? p.id.trim() : '';
      const planId = allocatePlanId(usedIds, rawId || undefined);
      usedIds.add(planId);
      const planName = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : `Plan ${String.fromCharCode(65 + pIdx)}`;
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
