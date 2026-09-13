import { ClassSession, Course, Conflict, DayOfWeek, LayoutSession } from '../types/schedule';

/**
 * Converts HH:mm or HH:mm AM/PM string to minutes from midnight (0 to 1439).
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const clean = timeStr.trim().toLowerCase();
  const isPM = clean.includes('pm') || clean.endsWith('p');
  const isAM = clean.includes('am') || clean.endsWith('a');

  const stripped = clean.replace(/[ap]m?/g, '').trim();
  const parts = stripped.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] ? parseInt(parts[1], 10) : 0;
  if (isNaN(h)) return 0;

  if (isPM && h < 12) h += 12;
  else if (isAM && h === 12) h = 0;

  const total = h * 60 + (isNaN(m) ? 0 : m);
  return Math.max(0, Math.min(1439, total));
}

/**
 * Converts minutes from midnight to HH:mm (24h) or 12h format with AM/PM.
 */
export function minutesToTime(minutes: number, format12h: boolean = true): string {
  if (isNaN(minutes)) return format12h ? '12:00 AM' : '00:00';
  const rounded = Math.round(minutes);
  if (rounded >= 1440) {
    return format12h ? '12:00 AM' : '24:00';
  }
  const clamped = Math.max(0, Math.min(1439, rounded));
  const h24 = Math.floor(clamped / 60);
  const m = clamped % 60;
  const mPadded = m.toString().padStart(2, '0');

  if (!format12h) {
    return `${h24.toString().padStart(2, '0')}:${mPadded}`;
  }

  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mPadded} ${period}`;
}

/**
 * Checks if two class sessions collide (same day & overlapping time range).
 */
export function checkSessionCollision(
  sessionA: ClassSession,
  sessionB: ClassSession
): boolean {
  if (!sessionA || !sessionB) return false;
  if (sessionA.day !== sessionB.day) return false;
  const aStart = timeToMinutes(sessionA.startTime);
  const aEnd = timeToMinutes(sessionA.endTime);
  const bStart = timeToMinutes(sessionB.startTime);
  const bEnd = timeToMinutes(sessionB.endTime);

  // If a session has equal or inverted start/end, treat as invalid
  if (aEnd <= aStart || bEnd <= bStart) return false;

  // Overlap condition: start of one is before end of other, and vice versa
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Detects all collision pairs within a list of courses in a plan,
 * including inter-course overlaps and intra-course session overlaps.
 */
export function detectPlanConflicts(courses: Course[]): Conflict[] {
  if (!Array.isArray(courses) || courses.length === 0) return [];
  const conflicts: Conflict[] = [];
  const checkedPairs = new Set<string>();

  for (let i = 0; i < courses.length; i++) {
    const c1 = courses[i];
    if (!c1 || !Array.isArray(c1.sessions)) continue;

    // Check for internal overlaps between sessions of the same course
    for (let sIdx1 = 0; sIdx1 < c1.sessions.length; sIdx1++) {
      for (let sIdx2 = sIdx1 + 1; sIdx2 < c1.sessions.length; sIdx2++) {
        const sA = c1.sessions[sIdx1];
        const sB = c1.sessions[sIdx2];
        if (checkSessionCollision(sA, sB)) {
          const startM = Math.max(timeToMinutes(sA.startTime), timeToMinutes(sB.startTime));
          const endM = Math.min(timeToMinutes(sA.endTime), timeToMinutes(sB.endTime));
          conflicts.push({
            courseId1: c1.id,
            courseId2: c1.id,
            courseCode1: c1.code,
            courseCode2: `${c1.code} (Session ${sIdx2 + 1})`,
            day: sA.day,
            overlapStart: minutesToTime(startM, true),
            overlapEnd: minutesToTime(endM, true),
          });
        }
      }
    }

    // Check for collisions with other courses
    for (let j = i + 1; j < courses.length; j++) {
      const c2 = courses[j];
      if (!c2 || !Array.isArray(c2.sessions)) continue;

      const pairKey = `${c1.id}__${c2.id}`;
      if (checkedPairs.has(pairKey)) continue;

      for (const s1 of c1.sessions) {
        for (const s2 of c2.sessions) {
          if (checkSessionCollision(s1, s2)) {
            const startM = Math.max(timeToMinutes(s1.startTime), timeToMinutes(s2.startTime));
            const endM = Math.min(timeToMinutes(s1.endTime), timeToMinutes(s2.endTime));
            conflicts.push({
              courseId1: c1.id,
              courseId2: c2.id,
              courseCode1: c1.code,
              courseCode2: c2.code,
              day: s1.day,
              overlapStart: minutesToTime(startM, true),
              overlapEnd: minutesToTime(endM, true),
            });
            checkedPairs.add(pairKey);
            break; // Record one conflict per course pair per day
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * Sweepline interval graph algorithm to partition overlapping sessions into
 * non-overlapping columns, just like Google Calendar.
 * Returns LayoutSession array with colIndex and totalCols.
 */
export function computeDayLayout(
  items: {
    session: ClassSession;
    course: Course;
    planId: string;
    planName: string;
    isGhost: boolean;
    ghostIndex?: number;
    hasConflict: boolean;
  }[]
): LayoutSession[] {
  if (items.length === 0) return [];

  // Map to working items with start/end in minutes
  const working = items.map((item, originalIndex) => {
    let start = timeToMinutes(item.session.startTime);
    let end = timeToMinutes(item.session.endTime);
    if (end <= start) {
      end = Math.min(1439, start + 30);
    }
    return {
      ...item,
      start,
      end,
      originalIndex,
      colIndex: 0,
      totalCols: 1,
    };
  });

  // Sort by start time ascending, then longer duration first
  working.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (b.end - b.start) - (a.end - a.start);
  });

  // Group into connected components of overlapping clusters
  const clusters: typeof working[] = [];
  let currentCluster: typeof working = [];
  let clusterEnd = -1;

  for (const item of working) {
    if (currentCluster.length === 0) {
      currentCluster.push(item);
      clusterEnd = item.end;
    } else {
      if (item.start < clusterEnd) {
        currentCluster.push(item);
        clusterEnd = Math.max(clusterEnd, item.end);
      } else {
        clusters.push(currentCluster);
        currentCluster = [item];
        clusterEnd = item.end;
      }
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // For each cluster, assign columns greedily
  for (const cluster of clusters) {
    // Array of column end-times
    const columnEnds: number[] = [];

    for (const item of cluster) {
      // Find the first column whose current end <= item.start
      let placedCol = -1;
      for (let c = 0; c < columnEnds.length; c++) {
        if (columnEnds[c] <= item.start) {
          placedCol = c;
          columnEnds[c] = item.end;
          break;
        }
      }
      if (placedCol === -1) {
        placedCol = columnEnds.length;
        columnEnds.push(item.end);
      }
      item.colIndex = placedCol;
    }

    const maxCols = columnEnds.length;
    for (const item of cluster) {
      item.totalCols = maxCols;
    }
  }

  return working.map(w => ({
    session: w.session,
    course: w.course,
    planId: w.planId,
    planName: w.planName,
    isGhost: w.isGhost,
    ghostIndex: w.ghostIndex,
    colIndex: w.colIndex,
    totalCols: w.totalCols,
    hasConflict: w.hasConflict,
  }));
}

/**
 * Computes contrast text color (black or white) for a given hex or rgb background.
 */
export function getContrastTextColor(hexColor: string): 'text-white' | 'text-slate-900' {
  if (!hexColor || typeof hexColor !== 'string') return 'text-white';

  let r = 0, g = 0, b = 0;

  if (hexColor.startsWith('rgb')) {
    const rgbMatch = hexColor.match(/\d+/g);
    if (rgbMatch && rgbMatch.length >= 3) {
      r = parseInt(rgbMatch[0], 10) || 0;
      g = parseInt(rgbMatch[1], 10) || 0;
      b = parseInt(rgbMatch[2], 10) || 0;
    }
  } else {
    let cleanHex = hexColor.replace('#', '').trim();
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map((char) => char + char).join('');
    }
    if (cleanHex.length >= 6) {
      r = parseInt(cleanHex.substring(0, 2), 16) || 0;
      g = parseInt(cleanHex.substring(2, 4), 16) || 0;
      b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    }
  }

  // Perceived luminance formula (YIQ)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 145 ? 'text-slate-900' : 'text-white';
}
