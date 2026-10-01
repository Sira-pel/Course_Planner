export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface TimeRange {
  startMinutes: number; // e.g. 9:00 AM = 540
  endMinutes: number;   // e.g. 10:15 AM = 615
}

export interface ClassSession {
  id: string;
  day: DayOfWeek;
  startTime: string;    // "09:00" (24h format HH:mm)
  endTime: string;      // "10:15"
  room?: string;
}

export interface Course {
  id: string;
  code: string;         // e.g. "CS101"
  name: string;         // e.g. "Intro to Computer Science"
  section?: string;     // e.g. "02" — displayed on grid block as "CS101-02"
  instructor?: string;  // e.g. "Prof. Alan Turing"
  credits: number;      // e.g. 3 or 4 (default 0 or 3)
  color: string;        // Hex color e.g. "#3B82F6"
  sessions: ClassSession[];
}

export interface SchedulePlan {
  id: string;
  name: string;         // e.g. "Plan A (Primary)", "Plan B (Backup)"
  isArchived?: boolean;
  courses: Course[];
}

export interface Conflict {
  courseId1: string;
  courseId2: string;
  courseCode1: string;
  courseCode2: string;
  day: DayOfWeek;
  overlapStart: string;
  overlapEnd: string;
}

export interface LayoutSession {
  session: ClassSession;
  course: Course;
  planId: string;
  planName: string;
  isGhost: boolean;
  ghostIndex?: number;
  // Layout computed properties
  colIndex: number;
  totalCols: number;
  hasConflict: boolean;
}

// 12 uniquely distinct, high-contrast, non-overlapping course colors across separate color families.
// Maximally distinguishable so automated color assignments never confuse users between courses.
export const COURSE_COLORS: string[] = [
  '#2563EB', // Cobalt Blue (single dedicated blue)
  '#059669', // Emerald Green
  '#EA580C', // Tangerine Orange
  '#7C3AED', // Royal Purple
  '#DC2626', // Crimson Red
  '#D97706', // Golden Amber
  '#0F766E', // Pine Teal
  '#DB2777', // Rose Pink
  '#65A30D', // Lime Green
  '#9F1239', // Burgundy Wine
  '#475569', // Slate Grey
  '#92400E', // Cinnamon Bronze
];

export const COURSE_COLOR_NAMES: Record<string, string> = {
  '#2563EB': 'Cobalt Blue',
  '#059669': 'Emerald Green',
  '#EA580C': 'Tangerine Orange',
  '#7C3AED': 'Royal Purple',
  '#DC2626': 'Crimson Red',
  '#D97706': 'Golden Amber',
  '#0F766E': 'Pine Teal',
  '#DB2777': 'Rose Pink',
  '#65A30D': 'Lime Green',
  '#9F1239': 'Burgundy Wine',
  '#475569': 'Slate Grey',
  '#92400E': 'Cinnamon Bronze',
};

// Maps legacy ambiguous/duplicate shades to distinct new palette colors
export const LEGACY_COURSE_COLOR_MAP: Record<string, string> = {
  '#3b82f6': '#2563EB', // Old Blue -> Cobalt Blue
  '#10b981': '#059669', // Old Emerald -> Emerald Green
  '#f59e0b': '#D97706', // Old Amber -> Golden Amber
  '#ef4444': '#DC2626', // Old Red -> Crimson Red
  '#8b5cf6': '#7C3AED', // Old Violet -> Royal Purple
  '#ec4899': '#DB2777', // Old Pink -> Rose Pink
  '#06b6d4': '#EA580C', // Old Cyan (was blue-like!) -> Tangerine Orange
  '#f97316': '#92400E', // Old Orange (was duplicate amber!) -> Cinnamon Bronze
  '#14b8a6': '#0F766E', // Old Teal (was blue-green!) -> Pine Teal
  '#6366f1': '#9F1239', // Old Indigo (was blue-like!) -> Burgundy Wine
  '#84cc16': '#65A30D', // Old Lime -> Lime Green
  '#d946ef': '#475569', // Old Fuchsia (was purple-pink!) -> Slate Grey
};

// Distinct styling accents for ghost plans comparison
export const GHOST_PLAN_COLORS = [
  { border: 'border-violet-500 dark:border-violet-400', bg: 'bg-violet-500/15 dark:bg-violet-500/20', text: 'text-violet-700 dark:text-violet-300', dot: '#8B5CF6' },
  { border: 'border-amber-500 dark:border-amber-400', bg: 'bg-amber-500/15 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', dot: '#F59E0B' },
  { border: 'border-emerald-500 dark:border-emerald-400', bg: 'bg-emerald-500/15 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', dot: '#10B981' },
  { border: 'border-rose-500 dark:border-rose-400', bg: 'bg-rose-500/15 dark:bg-rose-500/20', text: 'text-rose-700 dark:text-rose-300', dot: '#F43F5E' },
];

export function getPlanGhostColorIndex(planId: string, plans: SchedulePlan[]): number {
  const idx = plans.findIndex((p) => p.id === planId);
  return idx >= 0 ? idx : 0;
}

export function getPlanGhostColor(planId: string, plans: SchedulePlan[]) {
  const colorIndex = getPlanGhostColorIndex(planId, plans);
  return GHOST_PLAN_COLORS[colorIndex % GHOST_PLAN_COLORS.length];
}

export const DAYS_LIST: { id: DayOfWeek; short: string; label: string; full: string }[] = [
  { id: 'monday', short: 'M', label: 'Mon', full: 'Monday' },
  { id: 'tuesday', short: 'T', label: 'Tue', full: 'Tuesday' },
  { id: 'wednesday', short: 'W', label: 'Wed', full: 'Wednesday' },
  { id: 'thursday', short: 'TH', label: 'Thu', full: 'Thursday' },
  { id: 'friday', short: 'F', label: 'Fri', full: 'Friday' },
  { id: 'saturday', short: 'SA', label: 'Sat', full: 'Saturday' },
  { id: 'sunday', short: 'SU', label: 'Sun', full: 'Sunday' },
];
