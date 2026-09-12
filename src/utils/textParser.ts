import { Course, ClassSession, DayOfWeek, COURSE_COLORS } from '../types/schedule';

export interface ParseResult {
  success: boolean;
  rawText: string;
  course?: Course;
  error?: string;
  warnings?: string[];
}

// Regex to capture course codes with hyphenated sections e.g. CS 101-001, CS101-001, ITM 380-002, COSC-340-01
const COURSE_CODE_WITH_SECTION_REGEX = /\b([A-Za-z]{2,5})\s*[-_]?\s*([0-9]{2,4}[A-Za-z]?)\s*[-_]\s*([0-9A-Za-z]{1,4})\b/i;

// Regex to capture course codes like CS101, CS 101, ITM 380, COSC-340, CYBR 351, MATH 201A
const COURSE_CODE_REGEX = /\b([A-Za-z]{2,5})\s*[-_]?\s*([0-9]{2,4}[A-Za-z]?)\b/i;

// Regex to detect days including MW, TF, WF, TR, TTH, TUTH, MWF, M/W, T/F, W/F, T/R, MoWe, TuFr, etc.
const DAYS_TOKEN_REGEX = /\b(MWF|TTH|TUTH|WF|MW|TF|TR|MTWTHF|MTWRF|MOWEFR|MOWE|TUFR|WEFR|TUTH|MON(?:DAY)?|TUE(?:SDAY)?|WED(?:NESDAY)?|THU(?:RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?|M|T|W|TH|R|F|S|SU)\b/gi;

/**
 * Normalizes day tokens into standard DayOfWeek array.
 */
export function normalizeDays(tokens: string[]): DayOfWeek[] {
  const days = new Set<DayOfWeek>();

  for (const rawToken of tokens) {
    // Clean token
    const token = rawToken.replace(/[/\\,-]/g, '').trim();
    const upper = token.toUpperCase();

    if (upper === 'MWF' || upper === 'MOWEFR') {
      days.add('monday');
      days.add('wednesday');
      days.add('friday');
    } else if (upper === 'TTH' || upper === 'TUTH' || upper === 'TR') {
      days.add('tuesday');
      days.add('thursday');
    } else if (upper === 'TF' || upper === 'TUFR') {
      days.add('tuesday');
      days.add('friday');
    } else if (upper === 'WF' || upper === 'WEFR') {
      days.add('wednesday');
      days.add('friday');
    } else if (upper === 'MW' || upper === 'MOWE') {
      days.add('monday');
      days.add('wednesday');
    } else if (upper === 'MTWTHF' || upper === 'MTWRF' || upper === 'MF' || upper === 'DAILY') {
      days.add('monday');
      days.add('tuesday');
      days.add('wednesday');
      days.add('thursday');
      days.add('friday');
    } else if (upper.startsWith('MON') || upper === 'M') {
      days.add('monday');
    } else if (upper.startsWith('TUE') || upper === 'T' || upper === 'TU') {
      days.add('tuesday');
    } else if (upper.startsWith('WED') || upper === 'W' || upper === 'WE') {
      days.add('wednesday');
    } else if (upper.startsWith('THU') || upper === 'TH' || upper === 'R') {
      days.add('thursday');
    } else if (upper.startsWith('FRI') || upper === 'F' || upper === 'FR') {
      days.add('friday');
    } else if (upper.startsWith('SAT') || upper === 'SA' || upper === 'S') {
      days.add('saturday');
    } else if (upper.startsWith('SUN') || upper === 'SU') {
      days.add('sunday');
    }
  }

  return Array.from(days);
}

/**
 * Parses single time token like "8:30", "10:00", "1:45", "3:15", "9:00am", "1:30 PM", "12:00", "0900", "9", "2pm".
 */
export function parseSingleTimeToken(
  rawToken: string,
  defaultPM: boolean = false,
  partnerHour?: number
): { h: number; m: number } | null {
  const clean = rawToken.trim().toLowerCase().replace(/([ap])\.?m\.?/g, '$1m');
  const isExplicitAM = /am/.test(clean) || clean.endsWith('a');
  const isExplicitPM = /pm/.test(clean) || clean.endsWith('p');

  // Strip AM/PM/A/P and normalize periods/dashes
  const stripped = clean.replace(/[ap]m?/g, '').trim().replace(/\./g, ':');

  if (stripped.includes(':')) {
    const parts = stripped.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] ? parseInt(parts[1], 10) : 0;
    if (isNaN(h) || isNaN(m)) return null;

    if (isExplicitPM) {
      if (h < 12) h += 12;
    } else if (isExplicitAM) {
      if (h === 12) h = 0;
    } else {
      // University Schedule Heuristics:
      // - 1:00 to 7:00 is almost universally PM (13:00 to 19:00)
      // - 8:00 to 11:59 is almost universally AM
      // - 12:00 is Noon (PM)
      if (h >= 1 && h <= 7) {
        h += 12;
      } else if (h === 12) {
        // 12 is 12:00 PM (noon)
      } else if (defaultPM && h < 12) {
        if (partnerHour && partnerHour >= 12 && h <= partnerHour - 12) {
          h += 12;
        }
      }
    }
    return { h, m };
  }

  // 3-digit or 4-digit military time e.g. "0830", "1330", "1415", "0900"
  if (/^\d{3,4}$/.test(stripped)) {
    const num = parseInt(stripped, 10);
    let h = Math.floor(num / 100);
    const m = num % 100;
    if (h > 23 || m > 59) return null;
    if (isExplicitPM && h < 12) h += 12;
    else if (!isExplicitAM && !isExplicitPM && h >= 1 && h <= 7) h += 12;
    return { h, m };
  }

  // Single integer hour e.g. "8", "10", "1", "2"
  const digitsOnly = stripped.replace(/\D/g, '');
  if (digitsOnly.length >= 1 && digitsOnly.length <= 2) {
    let h = parseInt(digitsOnly, 10);
    if (isNaN(h) || h > 24) return null;
    if (isExplicitPM) {
      if (h < 12) h += 12;
    } else if (isExplicitAM) {
      if (h === 12) h = 0;
    } else {
      if (h >= 1 && h <= 7) {
        h += 12;
      } else if (defaultPM && h < 12) {
        if (partnerHour && partnerHour >= 12 && h <= partnerHour - 12) {
          h += 12;
        }
      }
    }
    return { h, m: 0 };
  }

  return null;
}

/**
 * Parses time string like "8:30–10:00", "12:00–1:30", "1:45-3:15", "10:15–11:45", "9:00 AM - 10:15 AM".
 * Returns [startTime24h, endTime24h] e.g. ["08:30", "10:00"]
 */
export function parseTimeRange(timeStr: string): { start: string; end: string } | null {
  const clean = timeStr
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212~]/g, '-')
    .replace(/\b(?:to|until|till)\b/gi, '-')
    .trim();

  const parts = clean.split('-');
  if (parts.length !== 2) return null;

  const rawStart = parts[0].trim();
  const rawEnd = parts[1].trim();

  const endHasPM = /p/i.test(rawEnd);
  const startHasPM = /p/i.test(rawStart);

  const endParsed = parseSingleTimeToken(rawEnd, endHasPM);
  if (!endParsed) return null;

  const startParsed = parseSingleTimeToken(
    rawStart,
    startHasPM || (endHasPM && endParsed.h >= 12),
    endParsed.h
  );
  if (!startParsed) return null;

  // If start is e.g. 12:00 (noon) and end is 1:30 (13:30), startMinutes < endMinutes is true!
  // If user typed 11:00 - 1:00 (11:00 AM to 13:00 PM), ensure start is AM and end is PM:
  let startMinutes = startParsed.h * 60 + startParsed.m;
  let endMinutes = endParsed.h * 60 + endParsed.m;

  // Auto-correct if start is 11 or 10 and end is 1 or 2
  if (startMinutes >= endMinutes && startParsed.h >= 12 && !startHasPM) {
    startParsed.h -= 12;
    startMinutes = startParsed.h * 60 + startParsed.m;
  }

  if (startMinutes >= endMinutes) {
    // If start is e.g. 12:00 and end resolved to 01:30 AM, bump end to PM
    if (endParsed.h < 12 && !endHasPM) {
      endParsed.h += 12;
      endMinutes = endParsed.h * 60 + endParsed.m;
    }
  }

  if (startMinutes >= endMinutes) {
    return null;
  }

  const pad = (n: number) => n.toString().padStart(2, '0');
  return {
    start: `${pad(startParsed.h)}:${pad(startParsed.m)}`,
    end: `${pad(endParsed.h)}:${pad(endParsed.m)}`,
  };
}

/**
 * Derives a short course code fallback from a title (e.g. "Operating Systems" -> "OS 101", "Networking Essentials" -> "NET 101").
 */
function generateCodeFromTitle(title: string): string {
  const words = title
    .replace(/[^A-Za-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return 'COURSE 101';
  if (words.length === 1) {
    return `${words[0].substring(0, 4).toUpperCase()} 101`;
  }
  const acronym = words.map((w) => w[0]).join('').substring(0, 4).toUpperCase();
  return `${acronym} 101`;
}

/**
 * Checks if a line is a plan label / section divider that should be ignored.
 */
export function isPlanHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  if (/^(plan\s*[a-z0-9]+|alternate\s+plan\s*[a-z0-9]+|option\s*[a-z0-9]+|schedule\s*[a-z0-9]+):?$/i.test(trimmed)) {
    return true;
  }
  if (/^[-=_*~#]{3,}$/.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Universal Course Line Parser
 * Handles standard formats, portal copy-pastes, dash-separated lines,
 * parenthesized course titles, section cohorts, and tabbed tables.
 */
export function parseCourseLine(line: string, colorIndex: number = 0): ParseResult {
  try {
    let raw = (line || '').slice(0, 500).trim();
    if (!raw) {
      return { success: false, rawText: line, error: 'Empty line' };
    }

    if (isPlanHeaderLine(raw)) {
      return { success: false, rawText: line, error: 'Plan header line ignored' };
    }

    // Strip formatting tags like **Optional**, [Elective], etc.
    raw = raw.replace(/\*\*[^*]+\*\*/g, ' ').replace(/\[[^\]]+\]/g, ' ');

    let lineWorking = raw;
    const warnings: string[] = [];

    // -------------------------------------------------------------
    // STEP 1: Extract Time Range & Days
    // -------------------------------------------------------------
    // Normalize unicode dashes in the entire line for uniform matching
    lineWorking = lineWorking.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-');

    // Time range regex: e.g. "8:30-10:00", "12:00-1:30", "1:45-3:15", "10:15-11:45", "9:00 AM - 10:15 AM"
    const timeRangeRegex = /\b(\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|am|pm|a|p)?|\d{3,4})\s*(?:-|\b(?:to|until|till)\b)\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|am|pm|a|p)?|\d{3,4})\b/i;
    const timeRangeMatch = lineWorking.match(timeRangeRegex);

    let startTime = '09:00';
    let endTime = '10:15';
    let timeDetected = false;

    if (timeRangeMatch) {
      const parsed = parseTimeRange(timeRangeMatch[0]);
      if (parsed) {
        startTime = parsed.start;
        endTime = parsed.end;
        timeDetected = true;
        lineWorking = lineWorking.replace(timeRangeMatch[0], ' ');
      }
    }

    // Days Extraction
    // First, look for days attached right next to time or in parenthesized schedule
    const dayMatches = lineWorking.match(DAYS_TOKEN_REGEX);
    let days: DayOfWeek[] = [];

    if (dayMatches && dayMatches.length > 0) {
      days = normalizeDays(dayMatches);
      for (const d of dayMatches) {
        // Remove day token from lineWorking
        lineWorking = lineWorking.replace(new RegExp(`\\b${d}\\b`, 'gi'), ' ');
      }
    }

    if (days.length === 0) {
      days = ['monday', 'wednesday', 'friday'];
      warnings.push('No days detected, defaulted to Mon, Wed, Fri');
    }

    if (!timeDetected) {
      warnings.push('No time range detected, defaulted to 09:00 - 10:15 AM');
    }

    // -------------------------------------------------------------
    // STEP 2: Extract Section, Single-Letter Cohorts, Credits, Room
    // -------------------------------------------------------------
    let section: string | undefined = undefined;
    let code = '';
    let name = '';

    // Check for Course Code with Hyphenated Section first (e.g. "CS 101-001", "CS101-001", "COSC 340-02")
    const codeWithSectionMatch = lineWorking.match(COURSE_CODE_WITH_SECTION_REGEX);
    if (codeWithSectionMatch) {
      code = `${codeWithSectionMatch[1].toUpperCase()} ${codeWithSectionMatch[2].toUpperCase()}`;
      section = codeWithSectionMatch[3];
      lineWorking = lineWorking.replace(codeWithSectionMatch[0], ' ');
    } else {
      // Standard Section keyword matching e.g. "Sec 001", "Section 02", "-001"
      const sectionMatch = lineWorking.match(/\b(?:sec|section)\.?\s*([0-9A-Za-z]+)\b/i) || lineWorking.match(/(?:^|\s)[-_]\s*([0-9A-Za-z]{1,4})\b/i);
      if (sectionMatch) {
        section = sectionMatch[1];
        lineWorking = lineWorking.replace(sectionMatch[0], ' ');
      }
    }

    // Single/Double-letter cohort codes in parentheses like (A), (B), (DD), (L)
    lineWorking = lineWorking.replace(/\(\s*[A-Z]{1,3}\s*\)/g, ' ');

    // Extract Credits if present (e.g. 3 credits, 4.0 cr, 3 units)
    let credits = 3;
    const creditsMatch = lineWorking.match(/\b([1-6](?:\.[05])?)\s*(?:credits?|cr|units?)\b/i);
    if (creditsMatch) {
      credits = parseFloat(creditsMatch[1]);
      lineWorking = lineWorking.replace(creditsMatch[0], ' ');
    }

    // Extract Room if present (e.g. "Room 302", "Rm 101", "Hall 101", "Gates G01")
    let room: string | undefined = undefined;
    const roomMatch = lineWorking.match(/\b(?:room|rm|hall|auditorium)\.?\s*([A-Za-z0-9-]+)\b/i);
    if (roomMatch) {
      room = roomMatch[0].trim();
      lineWorking = lineWorking.replace(roomMatch[0], ' ');
    }

    // -------------------------------------------------------------
    // STEP 3: Extract Instructor
    // -------------------------------------------------------------
    let instructor: string | undefined = undefined;

    // Pattern A: "Prof. John Doe", "Dr. Turing"
    const profMatch = lineWorking.match(/\b(?:prof(?:essor)?\.?|dr\.?)\s+([A-Za-z\s.'-]+)\b/i);
    if (profMatch) {
      instructor = profMatch[0].trim();
      lineWorking = lineWorking.replace(profMatch[0], ' ');
    } else {
      // Pattern B: Trailing comma name e.g. ", Vanndy You", ", Math Sa", ", Prohim Tam"
      const trailingNameMatch = lineWorking.match(/,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*$/);
      if (trailingNameMatch) {
        instructor = trailingNameMatch[1].trim();
        lineWorking = lineWorking.replace(trailingNameMatch[0], ' ');
      }
    }

    // -------------------------------------------------------------
    // STEP 4: Extract Course Code (if not matched) and Course Title
    // -------------------------------------------------------------
    if (!code) {
      // Pattern 1: Code followed by parenthesized title e.g. "ITM 380 (Cloud Computing)"
      const codeWithParenTitleMatch = lineWorking.match(/\b([A-Za-z]{2,5}\s*[-_]?\s*[0-9]{2,4}[A-Za-z]?)\s*\(\s*([^)]+)\s*\)/i);
      if (codeWithParenTitleMatch) {
        code = codeWithParenTitleMatch[1].replace(/\s+/g, ' ').toUpperCase();
        name = codeWithParenTitleMatch[2].trim();
        lineWorking = lineWorking.replace(codeWithParenTitleMatch[0], ' ');
      } else {
        // Pattern 2: Standard Code detection e.g. "ITM 380", "COSC 340", "CYBR 351", "CS101", "CS 101"
        const codeMatch = lineWorking.match(COURSE_CODE_REGEX);
        if (codeMatch) {
          code = `${codeMatch[1].toUpperCase()} ${codeMatch[2].toUpperCase()}`;
          lineWorking = lineWorking.replace(codeMatch[0], ' ');
        }
      }
    } else {
      // Code is already extracted, check if there is a parenthesized title like (Data Structures)
      const parenTitleMatch = lineWorking.match(/\(\s*([^)]+)\s*\)/);
      if (parenTitleMatch) {
        name = parenTitleMatch[1].trim();
        lineWorking = lineWorking.replace(parenTitleMatch[0], ' ');
      }
    }

    // Clean remaining lineWorking to form the title (or instructor if not matched)
    let cleanedRemaining = lineWorking
      .replace(/[()[\]{}]+/g, ' ')
      .replace(/[|,\\/\-_–—\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!name) {
      if (cleanedRemaining.length > 0) {
        name = cleanedRemaining;
      } else if (code) {
        name = `${code} Lecture`;
      } else {
        name = 'Course';
      }
    }

    if (!code) {
      code = generateCodeFromTitle(name);
    }

    // Format final Course object
    const color = COURSE_COLORS[Math.abs(colorIndex) % COURSE_COLORS.length];
    const courseId = `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const sessions: ClassSession[] = days.map((day, idx) => ({
      id: `s_${courseId}_${idx}`,
      day,
      startTime,
      endTime,
      room,
    }));

    const course: Course = {
      id: courseId,
      code,
      name,
      section,
      instructor,
      credits,
      color,
      sessions,
    };

    return {
      success: true,
      rawText: line,
      course,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (err) {
    return {
      success: false,
      rawText: line,
      error: err instanceof Error ? err.message : 'Unexpected parsing error',
    };
  }
}

/**
 * Parses multiple lines of course text (bulk input).
 */
export function parseBulkCourses(text: string, existingCourseCount: number = 0): ParseResult[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !isPlanHeaderLine(l))
    .slice(0, 100);

  return lines.map((line, index) => parseCourseLine(line, existingCourseCount + index));
}
