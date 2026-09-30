import { Course, ClassSession, DayOfWeek, COURSE_COLORS } from '../types/schedule';
import { prefixedId } from './id';

export interface ParseResult {
  success: boolean;
  rawText: string;
  course?: Course;
  error?: string;
  warnings?: string[];
}

// Words that must NEVER be treated as course subject prefixes (they indicate section, type, room, etc.)
const RESERVED_PREFIXES = new Set([
  'SEC',
  'SECT',
  'SECTION',
  'LEC',
  'LECT',
  'LECTURE',
  'LAB',
  'LABORATORY',
  'REC',
  'RECITATION',
  'DISC',
  'DISCUSSION',
  'SEM',
  'SEMINAR',
  'TUT',
  'TUTORIAL',
  'ACT',
  'ACTIVITY',
  'STU',
  'STUDIO',
  'RM',
  'ROOM',
  'BLDG',
  'BUILDING',
  'HALL',
  'AUD',
  'AUDITORIUM',
  'CR',
  'CRS',
  'CRSE',
  'UNIT',
  'UNITS',
  'CREDIT',
  'CREDITS',
  'PROF',
  'DR',
  'PERIOD',
  'TIME',
  'DAY',
  'DAYS',
  'TOTAL',
  'COURSE',
  'COURSES',
  'CLASS',
  'CLASSES',
]);

// Regex to capture course codes with hyphenated sections e.g. CS 101-001, CS101-001, ITM 380-002, COSC-340-01
const COURSE_CODE_WITH_SECTION_REGEX = /\b([A-Za-z]{2,5})\s*[-_]?\s*([0-9]{2,4}[A-Za-z]?)\s*[-_]\s*([0-9A-Za-z]{1,4})\b/i;

// Regex to capture standard course codes like CS 101, CS101, ITM 380, COSC-340, CYBR 351, MATH 201A
const COURSE_CODE_REGEX = /\b([A-Za-z]{2,5})\s*[-_]?\s*([0-9]{2,4}[A-Za-z]?)\b/i;

// Regex to detect days including slash/dash/space compound combinations e.g. MW, TF, WF, TR, TTH, TuTh, T/F, M/W, Mon/Wed, Tu/Fr, etc.
const DAYS_COMPOUND_REGEX = /\b(?:MWF|MOWEFR|TTH|TUTH|TR|T\/R|TU\/TH|TUE\/THU|TF|T\/F|TU\/FR|TUE\/FRI|WF|W\/F|WE\/FR|WED\/FRI|MW|M\/W|MO\/WE|MON\/WED|MTH|MOTH|M\/TH|MON\/THU|MTWTHF|MTWRF|M-F|MON-FRI)\b/gi;
const DAYS_SINGLE_TOKEN_REGEX = /\b(MON(?:DAY)?|TUE(?:SDAY)?|WED(?:NESDAY)?|THU(?:RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?|M|T|W|TH|R|F|S|SU|TU|WE|FR|SA)\b/gi;

/**
 * Normalizes raw day tokens into standard DayOfWeek array.
 */
export function normalizeDays(tokens: string[]): DayOfWeek[] {
  const days = new Set<DayOfWeek>();

  for (const rawToken of tokens) {
    if (!rawToken) continue;
    // Normalize slashes, commas, dashes
    const token = rawToken.replace(/[/\\,-]/g, '').trim();
    const upper = token.toUpperCase();

    if (upper === 'MWF' || upper === 'MOWEFR' || upper === 'MONWEDFRI') {
      days.add('monday');
      days.add('wednesday');
      days.add('friday');
    } else if (upper === 'TTH' || upper === 'TUTH' || upper === 'TR' || upper === 'TUR' || upper === 'TUETHU') {
      days.add('tuesday');
      days.add('thursday');
    } else if (upper === 'MTH' || upper === 'MOTH' || upper === 'MONTHU') {
      days.add('monday');
      days.add('thursday');
    } else if (upper === 'TF' || upper === 'TUFR' || upper === 'TUEFRI') {
      days.add('tuesday');
      days.add('friday');
    } else if (upper === 'WF' || upper === 'WEFR' || upper === 'WEDFRI') {
      days.add('wednesday');
      days.add('friday');
    } else if (upper === 'MW' || upper === 'MOWE' || upper === 'MONWED') {
      days.add('monday');
      days.add('wednesday');
    } else if (upper === 'MTWTHF' || upper === 'MTWRF' || upper === 'MF' || upper === 'MONFRI' || upper === 'DAILY') {
      days.add('monday');
      days.add('tuesday');
      days.add('wednesday');
      days.add('thursday');
      days.add('friday');
    } else if (upper.startsWith('MON') || upper === 'M' || upper === 'MO') {
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

  // 4-digit military time e.g. "0830", "1330", "1415", "0900"
  if (/^\d{4}$/.test(stripped)) {
    const num = parseInt(stripped, 10);
    let h = Math.floor(num / 100);
    const m = num % 100;
    if (h > 23 || m > 59) return null;
    if (isExplicitPM && h < 12) h += 12;
    else if (!isExplicitAM && !isExplicitPM && h >= 1 && h <= 7) h += 12;
    return { h, m };
  }

  // 3-digit military time e.g. "830", "915" (8:30, 9:15)
  if (/^[1-9]\d{2}$/.test(stripped)) {
    const num = parseInt(stripped, 10);
    let h = Math.floor(num / 100);
    const m = num % 100;
    if (m > 59) return null;
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
 * Parses time string like "8:30–10:00", "12:00–1:30", "1:45-3:15", "10:15–12:45", "9:00 AM - 10:15 AM".
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

  let startMinutes = startParsed.h * 60 + startParsed.m;
  let endMinutes = endParsed.h * 60 + endParsed.m;

  // Auto-correct if start is 11 or 10 and end is 1 or 2 (crosses noon)
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
 * Derives a clean, recognizable course code from a course title when no formal course code is provided.
 */
export function generateCodeFromTitle(title: string): string {
  const cleanTitle = title.trim();
  if (!cleanTitle) return 'COURSE 101';

  const lower = cleanTitle.toLowerCase();

  // Determine course level / sequence suffix
  let levelSuffix = '101';
  if (/\b(?:iii|3|c)\b/i.test(lower)) levelSuffix = '201';
  else if (/\b(?:ii|2|b)\b/i.test(lower)) levelSuffix = '102';
  else if (/\b(?:iv|4|d)\b/i.test(lower)) levelSuffix = '301';
  else if (/\b(?:advanced|adv|grad)\b/i.test(lower)) levelSuffix = '401';
  else if (/\b(?:intermediate|inter)\b/i.test(lower)) levelSuffix = '201';

  // Specific domain shortcuts
  if (/\boperating\s*systems?\b/i.test(lower) || /\bos\b/i.test(lower)) {
    return `OS ${levelSuffix === '101' ? '301' : levelSuffix}`;
  }
  if (/\bnetwork(?:ing)?\b/i.test(lower)) return `NET ${levelSuffix}`;
  if (/\bcyber(?:security)?\b/i.test(lower) || /\binformation\s*sec(?:urity)?\b/i.test(lower)) return `CYBR ${levelSuffix}`;
  if (/\bcalculus\b/i.test(lower)) return `CALC ${levelSuffix}`;
  if (/\bcomputer\s*sci(?:ence)?\b/i.test(lower)) {
    if (/\bb\b/i.test(lower)) return 'CS 102';
    if (/\ba\b/i.test(lower)) return 'CS 101';
    return `CS ${levelSuffix}`;
  }
  if (/\bdata\s*struct(?:ures)?\b/i.test(lower)) return 'CS 201';
  if (/\balgorithm(?:s)?\b/i.test(lower)) return 'CS 301';
  if (/\bsoftware\s*eng(?:ineering)?\b/i.test(lower)) return 'SE 101';
  if (/\bdatabase\b/i.test(lower)) return 'DB 101';
  if (/\bweb\s*dev(?:elopment)?\b/i.test(lower)) return 'WEB 101';
  if (/\bartificial\s*intel(?:ligence)?\b/i.test(lower) || /\bai\b/i.test(lower)) return 'AI 101';
  if (/\bmachine\s*learn(?:ing)?\b/i.test(lower) || /\bml\b/i.test(lower)) return 'ML 101';
  if (/\bphysics\b/i.test(lower)) return `PHYS ${levelSuffix}`;
  if (/\bchem(?:istry)?\b/i.test(lower)) return `CHEM ${levelSuffix}`;
  if (/\bbio(?:logy)?\b/i.test(lower)) return `BIO ${levelSuffix}`;
  if (/\bmath(?:ematics)?\b/i.test(lower)) return `MATH ${levelSuffix}`;
  if (/\bstat(?:istics)?\b/i.test(lower)) return `STAT ${levelSuffix}`;
  if (/\becon(?:omics)?\b/i.test(lower)) return `ECON ${levelSuffix}`;
  if (/\bpsyc(?:hology)?\b/i.test(lower)) return `PSYC ${levelSuffix}`;
  if (/\bsoc(?:iology)?\b/i.test(lower)) return `SOC ${levelSuffix}`;
  if (/\bhist(?:ory)?\b/i.test(lower)) return `HIST ${levelSuffix}`;
  if (/\beng(?:lish)?\b/i.test(lower) || /\blit(?:erature)?\b/i.test(lower)) return `ENG ${levelSuffix}`;
  if (/\bphil(?:osophy)?\b/i.test(lower)) return `PHIL ${levelSuffix}`;
  if (/\bfin(?:ance)?\b/i.test(lower)) return `FIN ${levelSuffix}`;
  if (/\bacct|accounting\b/i.test(lower)) return `ACCT ${levelSuffix}`;
  if (/\bmktg|marketing\b/i.test(lower)) return `MKTG ${levelSuffix}`;
  if (/\bmgmt|management\b/i.test(lower)) return `MGMT ${levelSuffix}`;

  // Filter stop words
  const stopWords = new Set([
    'intro',
    'introduction',
    'fundamentals',
    'principles',
    'to',
    'of',
    'and',
    'the',
    'in',
    'for',
    'a',
    'an',
    'basic',
    'basics',
    'foundations',
    'with',
    'on',
  ]);

  const words = cleanTitle
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const significantWords = words.filter((w) => !stopWords.has(w.toLowerCase()));
  const candidateWords = significantWords.length > 0 ? significantWords : words;

  if (candidateWords.length === 0) return 'COURSE 101';

  if (candidateWords.length === 1) {
    const w = candidateWords[0].toUpperCase();
    const prefix = w.length <= 4 ? w : w.substring(0, 4);
    return `${prefix} ${levelSuffix}`;
  }

  // Generate acronym from first letter of each significant word (up to 4 chars)
  const acronym = candidateWords.map((w) => w[0]).join('').substring(0, 4).toUpperCase();
  return `${acronym} ${levelSuffix}`;
}

/**
 * Checks if a line is a plan label, schedule title, horizontal divider, or summary line that should be ignored.
 */
export function isPlanHeaderLine(line: string): boolean {
  const trimmed = line.trim().replace(/^[`'"]+|[`'"]+$/g, '').trim();
  if (!trimmed) return true;

  // Horizontal Dividers (e.g. "----------------------------------------", "========", "####")
  if (/^[-=_*~#]{3,}$/.test(trimmed)) return true;

  // Schedule headers (e.g. "MY SCHEDULE (Plan A)", "WEEKLY SCHEDULE BY DAY (Plan A)", "SCHEDULE (Plan 1)")
  if (/^(?:my\s+)?(?:weekly\s+)?schedule(?:\s+by\s+day)?(?:\s*\([^)]*\))?:?$/i.test(trimmed)) return true;
  if (/^(?:plan\s*[a-z0-9]+|alternate\s+plan\s*[a-z0-9]+|option\s*[a-z0-9]+|schedule\s*[a-z0-9]+):?$/i.test(trimmed)) return true;

  // Summary and statistics lines (e.g. "Total Courses: 5 | Total Credits: 15", "Total Credits: 12", "Enrolled: 5 courses")
  if (/^total\s+(?:courses?|classes?|credits?|units?|hours?)\b/i.test(trimmed)) return true;
  if (/^enrolled:\s*\d+/i.test(trimmed)) return true;
  if (/^no\s+courses\s+enrolled/i.test(trimmed)) return true;

  // Day headers in by-day export format (e.g. "[MONDAY]", "[TUESDAY]")
  if (/^\[?\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s*\]?:?$/i.test(trimmed)) return true;

  return false;
}

/**
 * Helper to parse time and days from a schedule segment string like "Mon, Wed 8:30 AM - 10:00 AM".
 */
function parseScheduleSegment(
  segmentStr: string,
  timeRangeRegex: RegExp
): { days: DayOfWeek[]; startTime: string; endTime: string } | null {
  const tMatch = segmentStr.match(timeRangeRegex);
  if (!tMatch) return null;

  const parsedTime = parseTimeRange(tMatch[0]);
  if (!parsedTime) return null;

  const remainder = segmentStr.replace(tMatch[0], ' ');
  const dCompound = remainder.match(DAYS_COMPOUND_REGEX);
  let days: DayOfWeek[] = [];

  if (dCompound && dCompound.length > 0) {
    days = normalizeDays(dCompound);
  } else {
    const dSingle = remainder.match(DAYS_SINGLE_TOKEN_REGEX);
    if (dSingle && dSingle.length > 0) {
      days = normalizeDays(dSingle);
    }
  }

  if (days.length === 0) {
    days = ['monday', 'wednesday', 'friday'];
  }

  return {
    days,
    startTime: parsedTime.start,
    endTime: parsedTime.end,
  };
}

/**
 * Universal Course Line Parser
 * Handles:
 * - Compact export format: "ITM 380-001: Cloud Computing | Mon, Wed 8:30 AM - 10:00 AM"
 * - Tabbed format: "Operating Systems\tSec001 (12:00–1:30 MW)"
 * - Single-line format: "Intro to cyber (1:45-3:15 MW)"
 * - Standard syllabus lines: "CS 101-001 Intro to CS MWF 09:00-10:00 Rm 204"
 * - Multi-session lines separated by semicolons
 */
export function parseCourseLine(line: string, colorIndex: number = 0): ParseResult {
  try {
    let raw = (line || '').slice(0, 500).trim().replace(/^[`'"]+|[`'"]+$/g, '').trim();
    if (!raw) {
      return { success: false, rawText: line, error: 'Empty line' };
    }

    if (isPlanHeaderLine(raw)) {
      return { success: false, rawText: line, error: 'Header or summary line ignored' };
    }

    // Strip markdown formatting tags like **Optional**, [Elective], etc.
    raw = raw.replace(/\*\*[^*]+\*\*/g, ' ');

    // Normalize unicode dashes throughout the entire line
    let lineWorking = raw.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-');

    const warnings: string[] = [];
    let section: string | undefined = undefined;
    let code = '';
    let name = '';
    let room: string | undefined = undefined;
    let instructor: string | undefined = undefined;
    let credits = 3;

    // Time range matching regex: e.g. "8:30-10:00", "12:00-1:30", "1:45-3:15", "10:15-12:45", "9:00 AM - 10:15 AM"
    const timeRangeRegex = /\b(\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|am|pm|a|p)?|[012]?\d[0-5]\d)\s*(?:-|\b(?:to|until|till)\b)\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|am|pm|a|p)?|[012]?\d[0-5]\d)\b/i;

    const parsedSessionsList: { days: DayOfWeek[]; startTime: string; endTime: string }[] = [];

    // -------------------------------------------------------------
    // STEP 0: Extract Room in square brackets [Room 204] or [Rm 101]
    // -------------------------------------------------------------
    const bracketRoomMatch = lineWorking.match(/\[\s*([A-Za-z0-9\s-]+)\s*\]/);
    if (bracketRoomMatch) {
      room = bracketRoomMatch[1].trim();
      lineWorking = lineWorking.replace(bracketRoomMatch[0], ' ');
    }

    // -------------------------------------------------------------
    // STEP 1: Handle Pipe-Separated Compact Format
    // e.g. "ITM 380-001: Cloud Computing | Mon, Wed 8:30 AM - 10:00 AM"
    // e.g. "CYBR 351-001: Intro to Cybersecurity | Mon, Wed 1:45 PM - 3:15 PM"
    // -------------------------------------------------------------
    if (lineWorking.includes('|')) {
      const pipeParts = lineWorking.split('|');
      const leftPart = pipeParts[0].trim();
      const rightPart = pipeParts.slice(1).join('|').trim();

      // Check if right part contains schedule times
      if (timeRangeRegex.test(rightPart)) {
        // Multi-session semicolon support: "Mon, Wed 8:30-10:00; Fri 9:00-10:00"
        const sessionSegments = rightPart.split(';').map((s) => s.trim()).filter(Boolean);
        for (const seg of sessionSegments) {
          const parsedSeg = parseScheduleSegment(seg, timeRangeRegex);
          if (parsedSeg) {
            parsedSessionsList.push(parsedSeg);
          }
        }

        // Parse course code, section, title from leftPart
        let leftWorking = leftPart;

        // Code with hyphenated section: "ITM 380-001" or "COSC 340-002"
        const codeSecMatch = leftWorking.match(COURSE_CODE_WITH_SECTION_REGEX);
        if (codeSecMatch && !RESERVED_PREFIXES.has(codeSecMatch[1].toUpperCase())) {
          code = `${codeSecMatch[1].toUpperCase()} ${codeSecMatch[2].toUpperCase()}`;
          section = codeSecMatch[3];
          leftWorking = leftWorking.replace(codeSecMatch[0], ' ');
        } else {
          // Standard course code: "CS 101"
          const codeMatch = leftWorking.match(COURSE_CODE_REGEX);
          if (codeMatch && !RESERVED_PREFIXES.has(codeMatch[1].toUpperCase())) {
            code = `${codeMatch[1].toUpperCase()} ${codeMatch[2].toUpperCase()}`;
            leftWorking = leftWorking.replace(codeMatch[0], ' ');
          }
        }

        // Section keyword: "Sec 001", "Section 1"
        if (!section) {
          const secMatch = leftWorking.match(/\b(?:sec(?:tion)?\.?)\s*[-_:#]?\s*([0-9A-Za-z]+)\b/i);
          if (secMatch) {
            section = secMatch[1];
            leftWorking = leftWorking.replace(secMatch[0], ' ');
          }
        }

        // Title from remainder of leftWorking
        const cleanTitle = leftWorking
          .replace(/^[:;,\-–—\s]+|[:;,\-–—\s]+$/g, '')
          .replace(/[()[\]{}]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (cleanTitle) {
          name = cleanTitle;
        }

        // Set lineWorking to empty since everything was extracted
        lineWorking = '';
      }
    }

    // -------------------------------------------------------------
    // STEP 2: Process parenthesized / bracketed segments: ( ... )
    // Checks if the bracket contains a schedule (e.g. "(12:00–1:30 MW)", "(1:45-3:15 TF)"),
    // a course code (e.g. "(CS 101)"), or a title.
    // -------------------------------------------------------------
    if (parsedSessionsList.length === 0 && lineWorking) {
      const parenMatches = Array.from(lineWorking.matchAll(/\(([^)]+)\)/g));
      for (const match of parenMatches) {
        const inside = match[1].trim();

        // Check if bracket contains time range
        const tMatch = inside.match(timeRangeRegex);
        // Check if bracket contains days
        const dCompound = inside.match(DAYS_COMPOUND_REGEX);
        const dSingle = inside.match(DAYS_SINGLE_TOKEN_REGEX);
        const dTokens = dCompound || dSingle;

        if (tMatch || dTokens) {
          // This parenthesized block is a schedule!
          const parsedSeg = parseScheduleSegment(inside, timeRangeRegex);
          if (parsedSeg) {
            parsedSessionsList.push(parsedSeg);
          }

          // Check if room is inside schedule parentheses e.g. "(12:00-1:30 MW, Rm 301)"
          const rMatch = inside.match(/\b(?:room|rm|hall|auditorium|bldg)\.?\s*([A-Za-z0-9-]+)\b/i);
          if (rMatch && !room) {
            room = rMatch[0].trim();
          }

          // Remove the schedule parenthesis from lineWorking
          lineWorking = lineWorking.replace(match[0], ' ');
        } else {
          // Check if parenthesis contains a course code e.g. "Operating Systems (CS 301)"
          const codeMatch = inside.match(COURSE_CODE_REGEX);
          if (codeMatch && !RESERVED_PREFIXES.has(codeMatch[1].toUpperCase())) {
            code = `${codeMatch[1].toUpperCase()} ${codeMatch[2].toUpperCase()}`;
            lineWorking = lineWorking.replace(match[0], ' ');
          }
        }
      }
    }

    // -------------------------------------------------------------
    // STEP 3: Extract Section (Sec001, Sec 001, Section 02, -001)
    // -------------------------------------------------------------
    if (!section && lineWorking) {
      const explicitSectionMatch = lineWorking.match(/\b(?:sec(?:tion)?\.?)\s*[-_:#]?\s*([0-9A-Za-z]+)\b/i);
      if (explicitSectionMatch) {
        section = explicitSectionMatch[1];
        lineWorking = lineWorking.replace(explicitSectionMatch[0], ' ');
      } else {
        const lectureSectionMatch = lineWorking.match(/\b(?:lec(?:ture)?\.?|lab(?:oratory)?\.?|rec(?:itation)?\.?|disc(?:ussion)?\.?)\s*[-_:#]?\s*([0-9A-Za-z]+)\b/i);
        if (lectureSectionMatch) {
          section = lectureSectionMatch[1];
          lineWorking = lineWorking.replace(lectureSectionMatch[0], ' ');
        }
      }
    }

    // -------------------------------------------------------------
    // STEP 4: Extract Time Range & Days from remaining text if not yet detected
    // -------------------------------------------------------------
    if (parsedSessionsList.length === 0 && lineWorking) {
      const parsedSeg = parseScheduleSegment(lineWorking, timeRangeRegex);
      if (parsedSeg) {
        parsedSessionsList.push(parsedSeg);
      }

      // Remove time range & day tokens from lineWorking
      const tMatch = lineWorking.match(timeRangeRegex);
      if (tMatch) {
        lineWorking = lineWorking.replace(tMatch[0], ' ');
      }
      lineWorking = lineWorking.replace(DAYS_COMPOUND_REGEX, ' ').replace(DAYS_SINGLE_TOKEN_REGEX, ' ');
    }

    // -------------------------------------------------------------
    // STEP 5: Extract Credits, Room, Instructor
    // -------------------------------------------------------------
    if (lineWorking) {
      // Single/Double-letter cohort codes in parentheses like (A), (B), (DD), (L)
      lineWorking = lineWorking.replace(/\(\s*[A-Z]{1,3}\s*\)/g, ' ');

      // Extract Credits if present (e.g. 3 credits, 4.0 cr, 3 units)
      const creditsMatch = lineWorking.match(/\b([1-6](?:\.[05])?)\s*(?:credits?|cr|units?)\b/i);
      if (creditsMatch) {
        credits = parseFloat(creditsMatch[1]);
        lineWorking = lineWorking.replace(creditsMatch[0], ' ');
      }

      // Extract Room if present (e.g. "Room 302", "Rm 101", "Hall 101", "Gates G01")
      if (!room) {
        const roomMatch = lineWorking.match(/\b(?:room|rm|hall|auditorium|bldg)\.?\s*([A-Za-z0-9-]+)\b/i);
        if (roomMatch) {
          room = roomMatch[0].trim();
          lineWorking = lineWorking.replace(roomMatch[0], ' ');
        }
      }

      // Extract Instructor
      const profMatch = lineWorking.match(/\b(?:prof(?:essor)?\.?|dr\.?)\s+([A-Za-z\s.'-]+)\b/i);
      if (profMatch) {
        instructor = profMatch[0].trim();
        lineWorking = lineWorking.replace(profMatch[0], ' ');
      } else {
        const trailingNameMatch = lineWorking.match(/,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*$/);
        if (trailingNameMatch) {
          instructor = trailingNameMatch[1].trim();
          lineWorking = lineWorking.replace(trailingNameMatch[0], ' ');
        }
      }
    }

    // -------------------------------------------------------------
    // STEP 6: Extract Course Code (with optional hyphenated section)
    // -------------------------------------------------------------
    if (!code && lineWorking) {
      // Pattern 1: Code followed by parenthesized title e.g. "ITM 380 (Cloud Computing)"
      const codeWithParenTitleMatch = lineWorking.match(/\b([A-Za-z]{2,5})\s*[-_]?\s*([0-9]{2,4}[A-Za-z]?)\s*\(\s*([^)]+)\s*\)/i);
      if (codeWithParenTitleMatch && !RESERVED_PREFIXES.has(codeWithParenTitleMatch[1].toUpperCase())) {
        code = `${codeWithParenTitleMatch[1].toUpperCase()} ${codeWithParenTitleMatch[2].toUpperCase()}`;
        name = codeWithParenTitleMatch[3].trim();
        lineWorking = lineWorking.replace(codeWithParenTitleMatch[0], ' ');
      } else {
        // Pattern 2: Course Code with Hyphenated Section e.g. "CS 101-001", "CS101-001", "COSC 340-02"
        const codeWithSectionMatch = lineWorking.match(COURSE_CODE_WITH_SECTION_REGEX);
        if (codeWithSectionMatch && !RESERVED_PREFIXES.has(codeWithSectionMatch[1].toUpperCase())) {
          code = `${codeWithSectionMatch[1].toUpperCase()} ${codeWithSectionMatch[2].toUpperCase()}`;
          if (!section) section = codeWithSectionMatch[3];
          lineWorking = lineWorking.replace(codeWithSectionMatch[0], ' ');
        } else {
          // Pattern 3: Standard Course Code e.g. "CS 101", "CS101", "ITM 380"
          const codeMatch = lineWorking.match(COURSE_CODE_REGEX);
          if (codeMatch && !RESERVED_PREFIXES.has(codeMatch[1].toUpperCase())) {
            code = `${codeMatch[1].toUpperCase()} ${codeMatch[2].toUpperCase()}`;
            lineWorking = lineWorking.replace(codeMatch[0], ' ');
          }
        }
      }
    }

    // If section still not found, check for trailing standalone section number e.g. "- 001" or "- 02"
    if (!section && lineWorking) {
      const hyphenSectionMatch = lineWorking.match(/(?:^|\s)[-_]\s*([0-9A-Za-z]{1,4})\b/i);
      if (hyphenSectionMatch) {
        section = hyphenSectionMatch[1];
        lineWorking = lineWorking.replace(hyphenSectionMatch[0], ' ');
      }
    }

    // -------------------------------------------------------------
    // STEP 7: Course Title Extraction & Code Derivation
    // -------------------------------------------------------------
    if (!name && lineWorking) {
      const parenTitleMatch = lineWorking.match(/\(\s*([^)]+)\s*\)/);
      if (parenTitleMatch) {
        const potentialName = parenTitleMatch[1].trim();
        if (potentialName) {
          name = potentialName;
          lineWorking = lineWorking.replace(parenTitleMatch[0], ' ');
        }
      }
    }

    if (!name && lineWorking) {
      let cleanedRemaining = lineWorking
        .replace(/[()[\]{}]+/g, ' ')
        .replace(/[|,\\/\-_–—\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      cleanedRemaining = cleanedRemaining.replace(/^[:;,\-–—\s]+|[:;,\-–—\s]+$/g, '').trim();

      if (cleanedRemaining.length > 0) {
        name = cleanedRemaining;
      }
    }

    if (!name) {
      if (code) {
        name = `${code} Lecture`;
      } else {
        name = 'Course';
      }
    }

    if (!code) {
      code = generateCodeFromTitle(name);
    }

    // Default sessions if none detected
    if (parsedSessionsList.length === 0) {
      parsedSessionsList.push({
        days: ['monday', 'wednesday', 'friday'],
        startTime: '09:00',
        endTime: '10:15',
      });
      warnings.push('No schedule detected, defaulted to Mon, Wed, Fri 09:00-10:15 AM');
    }

    // Format final Course object
    const color = COURSE_COLORS[Math.abs(colorIndex) % COURSE_COLORS.length];
    const courseId = prefixedId('c');

    const sessions: ClassSession[] = parsedSessionsList.flatMap((seg, segIdx) =>
      seg.days.map((day, dIdx) => ({
        id: `s_${courseId}_${segIdx}_${dIdx}`,
        day,
        startTime: seg.startTime,
        endTime: seg.endTime,
        room,
      }))
    );

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
 * Handles compact exports, standard multi-line exports, by-day schedules, and direct spreadsheet pastes.
 */
export function parseBulkCourses(text: string, existingCourseCount: number = 0): ParseResult[] {
  if (!text || !text.trim()) return [];

  // Check if text is a multi-line "Standard" export format (blocks starting with "Course:")
  if (/^\s*Course:\s*/im.test(text)) {
    const rawBlocks = text.split(/\n\s*\n/);
    const results: ParseResult[] = [];

    for (const block of rawBlocks) {
      const trimmedBlock = block.trim();
      if (!trimmedBlock || isPlanHeaderLine(trimmedBlock)) continue;

      const lines = trimmedBlock.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      let courseLine = '';
      let timeLine = '';
      let instructorLine = '';
      let roomLine = '';
      let creditsLine = '';

      for (const l of lines) {
        if (/^Course:\s*/i.test(l)) courseLine = l.replace(/^Course:\s*/i, '').trim();
        else if (/^Time:\s*/i.test(l)) timeLine = l.replace(/^Time:\s*/i, '').trim();
        else if (/^Instructor:\s*/i.test(l)) instructorLine = l.replace(/^Instructor:\s*/i, '').trim();
        else if (/^Room:\s*/i.test(l)) roomLine = l.replace(/^Room:\s*/i, '').trim();
        else if (/^Credits:\s*/i.test(l)) creditsLine = l.replace(/^Credits:\s*/i, '').trim();
      }

      if (courseLine || timeLine) {
        const combined = `${courseLine} | ${timeLine}${roomLine ? ` [${roomLine}]` : ''}${instructorLine ? ` - ${instructorLine}` : ''}${creditsLine ? ` ${creditsLine} cr` : ''}`;
        const parsed = parseCourseLine(combined, existingCourseCount + results.length);
        if (parsed.success) {
          results.push({
            ...parsed,
            rawText: trimmedBlock,
          });
        }
      }
    }

    if (results.length > 0) return results;
  }

  // Standard line-by-line parsing
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[`'"]+|[`'"]+$/g, '').trim())
    .filter(Boolean)
    .filter((l) => !isPlanHeaderLine(l))
    .slice(0, 100);

  return lines.map((line, index) => parseCourseLine(line, existingCourseCount + index));
}
