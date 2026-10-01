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

// 12 uniquely distinct, visually pleasing, non-overlapping course colors across separate color families.
// Softer and lighter with balanced saturation for comfortable viewing on calendar grids and cards.
export const COURSE_COLORS: string[] = [
  '#3B82F6', // Blue
  '#10B981', // Emerald Green
  '#F97316', // Tangerine Orange
  '#8B5CF6', // Royal Purple
  '#EF4444', // Coral Red
  '#F59E0B', // Golden Amber
  '#14B8A6', // Pine Teal
  '#EC4899', // Rose Pink
  '#84CC16', // Lime Green
  '#F43F5E', // Warm Rose
  '#64748B', // Slate Grey
  '#C07D3E', // Caramel Bronze
];

export const COURSE_COLOR_NAMES: Record<string, string> = {
  '#3B82F6': 'Blue',
  '#10B981': 'Emerald Green',
  '#F97316': 'Tangerine Orange',
  '#8B5CF6': 'Royal Purple',
  '#EF4444': 'Coral Red',
  '#F59E0B': 'Golden Amber',
  '#14B8A6': 'Pine Teal',
  '#EC4899': 'Rose Pink',
  '#84CC16': 'Lime Green',
  '#F43F5E': 'Warm Rose',
  '#64748B': 'Slate Grey',
  '#C07D3E': 'Caramel Bronze',
};

// Maps legacy darker / overly saturated shades to the lighter, softer palette colors
export const LEGACY_COURSE_COLOR_MAP: Record<string, string> = {
  // Heavy / overly saturated previous palette
  '#2563eb': '#3B82F6', // Cobalt Blue -> Blue
  '#059669': '#10B981', // Dark Emerald -> Emerald Green
  '#ea580c': '#F97316', // Intense Orange -> Tangerine Orange
  '#7c3aed': '#8B5CF6', // Deep Purple -> Royal Purple
  '#dc2626': '#EF4444', // Dark Red -> Coral Red
  '#d97706': '#F59E0B', // Dark Amber -> Golden Amber
  '#0f766e': '#14B8A6', // Dark Pine Teal -> Pine Teal
  '#db2777': '#EC4899', // Deep Magenta -> Rose Pink
  '#65a30d': '#84CC16', // Dark Lime -> Lime Green
  '#9f1239': '#F43F5E', // Dark Burgundy -> Warm Rose
  '#475569': '#64748B', // Dark Slate -> Slate Grey
  '#92400e': '#C07D3E', // Dark Brown -> Caramel Bronze
  '#b45309': '#C07D3E', // Cinnamon -> Caramel Bronze
  // Additional previous legacy values
  '#06b6d4': '#14B8A6',
  '#6366f1': '#8B5CF6',
  '#d946ef': '#EC4899',
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
