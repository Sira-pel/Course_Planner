import { Course, ClassSession, DayOfWeek, COURSE_COLORS } from '../types/schedule';
import { prefixedId } from './id';
import {
  extractDays,
  extractTimeRange,
  parseDelimitedText,
  parseExcelRowsToCourses,
  type ColumnMapping,
  type ColumnOption,
  type ImportRowIssue,
} from './excelImport';
import {
  generateCodeFromTitle,
  interpretCredits,
  isPlanHeaderLine,
  parseBulkCourses,
  parseCourseLine,
  type ParseResult,
} from './textParser';

export interface QuickAddTable {
  columns: ColumnOption[];
  rawRows: (string | number | undefined)[][];
  dataStartRow: number;
  mapping: ColumnMapping;
}

export interface QuickAddResult {
  items: ParseResult[];
  table: QuickAddTable | null;
}

const CODE_AT_START = /^\s*([A-Za-z]{2,6})\s*[-_.:]?\s*(\d{2,4}[A-Za-z]?)\b/;
const MEETING_LEAD = /^\s*(?:lec(?:ture)?|lab(?:oratory)?|rec(?:itation)?|disc(?:ussion)?|sem(?:inar)?|tut(?:orial)?|studio)\b/i;
const RESERVED_SUBJECTS = new Set([
  'LEC', 'LECT', 'LECTURE', 'LAB', 'LABORATORY', 'REC', 'RECITATION', 'DISC', 'DISCUSSION',
  'SEM', 'SEMINAR', 'TUT', 'TUTORIAL', 'SEC', 'SECT', 'SECTION', 'ROOM', 'HALL',
]);

function lineStartsNewCourse(line: string): boolean {
  if (MEETING_LEAD.test(line)) return false;
  const match = line.match(CODE_AT_START);
  if (!match) return false;
  return !RESERVED_SUBJECTS.has(match[1].toUpperCase());
}

function groupCourseLines(lines: string[]): string[][] {
  const groups: string[][] = [];
  for (const line of lines) {
    const prev = groups[groups.length - 1];
    const prevAnchored = prev ? prev.some(lineStartsNewCourse) : false;
    if (prev && prevAnchored && !lineStartsNewCourse(line)) prev.push(line);
    else groups.push([line]);
  }
  return groups;
}

function codeAppears(code: string, raw: string): boolean {
  const parts = code.trim().split(/\s+/);
  if (parts.length < 2) return raw.toUpperCase().includes(code.toUpperCase());
  const [prefix, num] = parts;
  return new RegExp(`\\b${prefix}\\s*[-_.:]?\\s*${num}\\b`, 'i').test(raw);
}

function flagInventedDefaults(result: ParseResult): ParseResult {
  if (!result.success || !result.course) return result;
  const inventedTime = result.warnings?.some((warning) => /defaulted/i.test(warning));
  if (!inventedTime) return result;
  const invalidClock = /\d{1,2}\s*:\s*\d{2}/.test(result.rawText) || /\b\d{3,4}\s*-\s*\d{3,4}\b/.test(result.rawText);
  const knownCode = codeAppears(result.course.code, result.rawText);
  return {
    ...result,
    success: false,
    warnings: undefined,
    error: knownCode
      ? (invalidClock ? 'Invalid class time' : 'Missing class time')
      : 'Missing course code and class time',
    course: {
      ...result.course,
      code: knownCode ? result.course.code : '',
      sessions: [],
    },
  };
}

function stripTimeRange(line: string): string {
  return line.replace(
    /(\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|[ap]m|[ap])?|\b[012]\d[0-5]\d\b)\s*[-–—]\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|[ap]m|[ap])?|\b[012]\d[0-5]\d\b)/i,
    ' '
  );
}

function stripDayTokens(line: string): string {
  return line
    .replace(/\b(?:MWF|TTH|TUTH|MTWRF|MTWR|MW|TR|WF|TF|MTH|MON(?:DAY)?|TUE(?:SDAY)?|WED(?:NESDAY)?|THU(?:RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?|TH|SA|SU|TU|WE|MO|FR)\b/gi, ' ')
    .replace(/\b[MTWRFSU]\b/g, ' ');
}

interface MeetingDraft {
  days: DayOfWeek[];
  start?: string;
  end?: string;
  room?: string;
  problem?: string;
}

function parseMeetingLine(line: string): MeetingDraft | null {
  const stripped = line.replace(MEETING_LEAD, '').trim();
  const hasClock = /\d{1,2}\s*:\s*\d{2}/.test(stripped) || /\b\d{3,4}\s*[-–]\s*\d{3,4}\b/.test(stripped);
  const range = extractTimeRange(stripped);
  if (!range && !hasClock) return null;
  if (!range) return { days: extractDays(stripped), problem: 'Invalid time' };
  const withoutTime = stripTimeRange(stripped);
  const days = extractDays(withoutTime);
  const room = stripDayTokens(withoutTime).replace(/\s+/g, ' ').replace(/^[\s,;:|\-]+|[\s,;:|\-]+$/g, '').trim();
  if (days.length === 0) return { days, start: range.start, end: range.end, room: room || undefined, problem: 'Missing days' };
  return { days, start: range.start, end: range.end, room: room || undefined };
}

function parseCourseBlock(lines: string[], colorIndex: number): ParseResult {
  const rawText = lines.join('\n');
  let code = '';
  let section: string | undefined;
  let name = '';
  let instructor: string | undefined;
  let credits = 3;
  let creditNote: string | undefined;
  const meetings: { days: DayOfWeek[]; start: string; end: string; room?: string }[] = [];
  const problems: string[] = [];

  for (const line of lines) {
    const creditMatch = line.match(/\b(\d+(?:\.\d+)?)\s*(?:credits?|cr\.?|units?|hrs?\.?)\b/i);
    if (creditMatch) {
      const read = interpretCredits(creditMatch[0]);
      if (read.detected) {
        credits = read.credits;
        if (read.unrealistic) creditNote = `Unusual credit value ${read.credits}`;
      }
    }

    const instructorLabel = line.match(/^(?:instructor|professor)\s*[:\-]\s*(.+)$/i);
    if (instructorLabel && !extractTimeRange(line)) {
      instructor = instructorLabel[1].trim();
      continue;
    }

    let working = line.trim();
    if (!code && lineStartsNewCourse(working)) {
      const match = working.match(CODE_AT_START);
      if (match) {
        code = `${match[1].toUpperCase()} ${match[2].toUpperCase()}`;
        working = working.slice(match[0].length).replace(/^[\s:;,\-–]+/, '').trim();
        const sectionMatch = working.match(/^(?:sec(?:tion)?\.?\s*|(?:[-–]\s*))([0-9A-Za-z]{1,4})\b\s*[:\-–]?\s*/i);
        if (sectionMatch && extractDays(sectionMatch[1]).length === 0) {
          section = sectionMatch[1];
          working = working.slice(sectionMatch[0].length).trim();
        }
      }
    }

    const meetingSource = MEETING_LEAD.test(line) ? line : working;
    const meeting = parseMeetingLine(meetingSource);
    if (meeting) {
      if (meeting.problem || !meeting.start || !meeting.end) {
        problems.push(meeting.problem || 'Invalid time');
      } else {
        meetings.push({ days: meeting.days, start: meeting.start, end: meeting.end, room: meeting.room });
      }
      const titleBits = stripDayTokens(stripTimeRange(working))
        .replace(MEETING_LEAD, '')
        .replace(/\s+/g, ' ')
        .replace(/^[\s,;:|\-]+|[\s,;:|\-]+$/g, '')
        .trim();
      if (titleBits && !name && !/\d/.test(titleBits)) name = titleBits;
      continue;
    }

    if (working && !name) name = working;
  }

  const color = COURSE_COLORS[Math.abs(colorIndex) % COURSE_COLORS.length];
  const courseId = prefixedId('c');
  const sessions: ClassSession[] = meetings.flatMap((meeting, meetingIndex) =>
    meeting.days.map((day, dayIndex) => ({
      id: `s_${courseId}_${meetingIndex}_${dayIndex}`,
      day,
      startTime: meeting.start,
      endTime: meeting.end,
      room: meeting.room,
    }))
  );

  if (!code && name && sessions.length > 0) code = generateCodeFromTitle(name);

  const base: Course = {
    id: courseId,
    code,
    name,
    section,
    instructor,
    credits,
    color,
    sessions,
  };

  if (!code) {
    return { success: false, rawText, error: 'Missing course code', course: { ...base, sessions: [] } };
  }
  if (sessions.length === 0) {
    return {
      success: false,
      rawText,
      error: problems[0] || 'Missing class time',
      course: { ...base, sessions: [] },
    };
  }

  return {
    success: true,
    rawText,
    course: base,
    warnings: creditNote ? [creditNote] : undefined,
  };
}

function parseLooseBlocks(text: string, existingCourseCount: number): ParseResult[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[`'"]+|[`'"]+$/g, '').trim())
    .filter(Boolean)
    .filter((line) => !isPlanHeaderLine(line))
    .slice(0, 5000);
  return groupCourseLines(lines).map((group, index) => {
    if (group.length === 1) return flagInventedDefaults(parseCourseLine(group[0], existingCourseCount + index));
    return parseCourseBlock(group, existingCourseCount + index);
  });
}

function courseToResult(course: Course, issue?: ImportRowIssue): ParseResult {
  if (issue?.blocking) {
    return {
      success: false,
      rawText: [course.code, course.name].filter(Boolean).join(' '),
      error: issue.message,
      course: { ...course, sessions: [] },
    };
  }
  return {
    success: true,
    rawText: [course.code, course.name].filter(Boolean).join(' '),
    course,
    warnings: issue ? [issue.message] : undefined,
  };
}

export function parseQuickAdd(
  text: string,
  existingCourseCount = 0,
  mappingOverride?: ColumnMapping
): QuickAddResult {
  if (!text || !text.trim()) return { items: [], table: null };

  if (/^\s*Course:\s*/im.test(text) && !text.includes('\t')) {
    return { items: parseBulkCourses(text, existingCourseCount), table: null };
  }

  const delimited = parseDelimitedText(text);
  if (delimited && delimited.columns.length >= 2) {
    const mapping = mappingOverride ?? delimited.detectedMapping;
    const parsed = parseExcelRowsToCourses(delimited.rawRows, delimited.dataStartRow, mapping, existingCourseCount);
    const issues = new Map(parsed.issues.map((issue) => [issue.courseId, issue]));
    return {
      items: parsed.courses.map((course) => courseToResult(course, issues.get(course.id))),
      table: {
        columns: delimited.columns,
        rawRows: delimited.rawRows,
        dataStartRow: delimited.dataStartRow,
        mapping,
      },
    };
  }

  return { items: parseLooseBlocks(text, existingCourseCount), table: null };
}
