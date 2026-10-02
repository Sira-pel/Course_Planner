import { DayOfWeek, SchedulePlan, Course, ClassSession, COURSE_COLORS, LEGACY_COURSE_COLOR_MAP } from '../types/schedule';
import { sanitizePlans } from '../store/sanitize';
import { prefixedId } from './id';

interface CompactSession {
  d: DayOfWeek;
  st: string;
  et: string;
  rm?: string;
}

interface CompactCourse {
  cd: string;
  nm: string;
  sc?: string;
  in?: string;
  cr?: number;
  co: string;
  ss: CompactSession[];
}

interface CompactPayload {
  v: 1;
  n: string;
  c: CompactCourse[];
}

const VALID_DAYS: Set<DayOfWeek> = new Set([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(base64url: string): string {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Encodes a schedule plan into a compact, portable share URL.
 */
export function encodePlanToShareUrl(plan: SchedulePlan): string {
  const compact: CompactPayload = {
    v: 1,
    n: plan.name || 'Friend Plan',
    c: (plan.courses || []).map((c) => ({
      cd: c.code || '',
      nm: c.name || '',
      sc: c.section || undefined,
      in: c.instructor || undefined,
      cr: c.credits !== undefined ? c.credits : undefined,
      co: c.color || COURSE_COLORS[0],
      ss: (c.sessions || []).map((s) => ({
        d: s.day,
        st: s.startTime,
        et: s.endTime,
        rm: s.room || undefined,
      })),
    })),
  };

  const json = JSON.stringify(compact);
  const hash = toBase64Url(json);
  const base = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : 'https://uniplan.app/';

  return `${base}#share=${hash}`;
}

/**
 * Extracts the share payload string from a URL, hash, or raw string.
 */
export function extractSharePayloadFromUrl(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Match #share=... or ?share=...
  const match = trimmed.match(/[#?&]share=([^&#\s]+)/);
  if (match) return decodeURIComponent(match[1]);

  // If input looks like raw base64url payload
  if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Decodes a share payload back into a sanitized, validated SchedulePlan with unique IDs.
 */
export function decodePlanFromSharePayload(payload: string): {
  success: boolean;
  plan?: SchedulePlan;
  error?: string;
} {
  try {
    const jsonStr = fromBase64Url(payload);
    const parsed = JSON.parse(jsonStr) as Partial<CompactPayload>;

    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.c)) {
      return { success: false, error: 'Invalid or unsupported share link format.' };
    }

    const planId = prefixedId('plan_friend');
    const planName = typeof parsed.n === 'string' && parsed.n.trim() ? parsed.n.trim() : 'Friend Plan';

    const courses: Course[] = parsed.c
      .filter((compactCourse): compactCourse is CompactCourse => Boolean(compactCourse && typeof compactCourse === 'object'))
      .map((compactCourse, cIdx) => {
        const courseId = prefixedId(`c_f${cIdx}`);
        const rawSessions = Array.isArray(compactCourse.ss) ? compactCourse.ss : [];
        const sessions: ClassSession[] = rawSessions
          .filter((s) => s && typeof s === 'object' && VALID_DAYS.has(s.d as DayOfWeek))
          .map((s, sIdx) => ({
            id: `s_${courseId}_${sIdx}`,
            day: s.d as DayOfWeek,
            startTime: typeof s.st === 'string' ? s.st : '09:00',
            endTime: typeof s.et === 'string' ? s.et : '10:15',
            room: typeof s.rm === 'string' ? s.rm : undefined,
          }));

        const colorStr = typeof compactCourse.co === 'string' ? compactCourse.co : '';
        const normalizedColor = colorStr
          ? LEGACY_COURSE_COLOR_MAP[colorStr.toLowerCase()] || colorStr
          : undefined;

        const rawCredits =
          typeof compactCourse.cr === 'number' && Number.isFinite(compactCourse.cr)
            ? compactCourse.cr
            : undefined;

        return {
          id: courseId,
          code: typeof compactCourse.cd === 'string' ? compactCourse.cd : 'COURSE',
          name: typeof compactCourse.nm === 'string' ? compactCourse.nm : 'Class',
          section: typeof compactCourse.sc === 'string' ? compactCourse.sc : undefined,
          instructor: typeof compactCourse.in === 'string' ? compactCourse.in : undefined,
          credits: rawCredits !== undefined ? rawCredits : 3,
          color: normalizedColor || COURSE_COLORS[cIdx % COURSE_COLORS.length],
          sessions,
        };
      });

    const rawPlan: SchedulePlan = {
      id: planId,
      name: planName,
      courses,
    };

    const sanitizedPlan = sanitizePlans([rawPlan])[0];
    if (!sanitizedPlan) {
      return { success: false, error: 'Failed to sanitize shared plan.' };
    }

    return { success: true, plan: sanitizedPlan };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to decode shared plan.',
    };
  }
}
