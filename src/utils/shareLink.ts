import { DayOfWeek, SchedulePlan, Course, ClassSession, COURSE_COLORS } from '../types/schedule';
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
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
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
    const planName = parsed.n?.trim() || 'Friend Plan';

    const courses: Course[] = parsed.c.map((compactCourse, cIdx) => {
      const courseId = prefixedId(`c_f${cIdx}`);
      const sessions: ClassSession[] = (compactCourse.ss || [])
        .filter((s) => VALID_DAYS.has(s.d as DayOfWeek))
        .map((s, sIdx) => ({
          id: `s_${courseId}_${sIdx}`,
          day: s.d as DayOfWeek,
          startTime: s.st || '09:00',
          endTime: s.et || '10:15',
          room: s.rm || undefined,
        }));

      return {
        id: courseId,
        code: compactCourse.cd || 'COURSE',
        name: compactCourse.nm || 'Class',
        section: compactCourse.sc || undefined,
        instructor: compactCourse.in || undefined,
        credits: Number(compactCourse.cr) || 0,
        color: compactCourse.co || COURSE_COLORS[cIdx % COURSE_COLORS.length],
        sessions,
      };
    });

    const plan: SchedulePlan = {
      id: planId,
      name: planName,
      courses,
    };

    return { success: true, plan };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to decode shared plan.',
    };
  }
}
