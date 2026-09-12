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

// 12 distinct, high-contrast, accessible course colors
export const COURSE_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#84CC16', // Lime
  '#D946EF', // Fuchsia
];

// Distinct styling accents for ghost plans comparison
export const GHOST_PLAN_COLORS = [
  { border: 'border-violet-500 dark:border-violet-400', bg: 'bg-violet-500/15 dark:bg-violet-500/20', text: 'text-violet-700 dark:text-violet-300', dot: '#8B5CF6' },
  { border: 'border-amber-500 dark:border-amber-400', bg: 'bg-amber-500/15 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', dot: '#F59E0B' },
  { border: 'border-emerald-500 dark:border-emerald-400', bg: 'bg-emerald-500/15 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', dot: '#10B981' },
  { border: 'border-rose-500 dark:border-rose-400', bg: 'bg-rose-500/15 dark:bg-rose-500/20', text: 'text-rose-700 dark:text-rose-300', dot: '#F43F5E' },
];

export const DAYS_LIST: { id: DayOfWeek; short: string; label: string; full: string }[] = [
  { id: 'monday', short: 'M', label: 'Mon', full: 'Monday' },
  { id: 'tuesday', short: 'T', label: 'Tue', full: 'Tuesday' },
  { id: 'wednesday', short: 'W', label: 'Wed', full: 'Wednesday' },
  { id: 'thursday', short: 'TH', label: 'Thu', full: 'Thursday' },
  { id: 'friday', short: 'F', label: 'Fri', full: 'Friday' },
  { id: 'saturday', short: 'SA', label: 'Sat', full: 'Saturday' },
  { id: 'sunday', short: 'SU', label: 'Sun', full: 'Sunday' },
];
