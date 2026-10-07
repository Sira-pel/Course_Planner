import type { WorkBook, WorkSheet } from 'xlsx';
import { Course, ClassSession, DayOfWeek, COURSE_COLORS } from '../types/schedule';
import { prefixedId } from './id';
import { parseTimeRange, parseSingleTimeToken, normalizeDays } from './textParser';
import { timeToMinutes } from './timeUtils';

type XlsxModule = typeof import('xlsx');

export type ExcelWorkbook = WorkBook;

let xlsxModule: XlsxModule | null = null;
let xlsxLoading: Promise<XlsxModule> | null = null;

/** Loads SheetJS the first time a workbook is read or written. */
export function loadXlsx(): Promise<XlsxModule> {
  if (xlsxModule) return Promise.resolve(xlsxModule);
  if (!xlsxLoading) {
    xlsxLoading = import('xlsx').then((mod) => {
      xlsxModule = mod;
      return mod;
    });
  }
  return xlsxLoading;
}

function requireXlsx(): XlsxModule {
  if (!xlsxModule) {
    throw new Error('Spreadsheet parser is not loaded.');
  }
  return xlsxModule;
}

export interface ColumnOption {
  key: string;         // e.g. "col_0", "col_1"
  index: number;       // 0, 1, 2...
  letter: string;      // "A", "B", "C"...
  headerText: string;  // header label if present
  label: string;       // "Col B [Course Code]"
  samples: string[];   // preview values
}

export interface ColumnMapping {
  code: string;        // column key e.g. "col_1"
  subject?: string;    // separate subject column e.g. "col_0" (e.g. BUSN)
  courseNum?: string;  // separate course number column e.g. "col_1" (e.g. 200, 370)
  name: string;        // column key e.g. "col_3"
  section: string;     // column key e.g. "col_2"
  schedule: string;    // combined day + time column e.g. "col_6"
  days: string;        // separate days column (if schedule not combined)
  time: string;        // separate time column (if schedule not combined)
  startTime: string;   // separate start time column
  endTime: string;     // separate end time column
  instructor: string;  // column key e.g. "col_5"
  credits: string;     // column key e.g. "col_4"
  room: string;        // column key e.g. "col_7"
}

export interface ExcelWorkbookData {
  sheets: string[];
  currentSheet: string;
  columns: ColumnOption[];
  rawRows: (string | number | undefined)[][];
  dataStartRow: number;
  detectedMapping: ColumnMapping;
}

export interface ExcelParseResult {
  success: boolean;
  courses: Course[];
  totalRows: number;
  skippedRows: number;
  warnings: string[];
  error?: string;
}

/**
 * Converts 0-indexed column number to Excel column letter (0 -> 'A', 25 -> 'Z', 26 -> 'AA', etc.)
 */
export function getColumnLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Sanitizes cell input to prevent formula injection and clean text.
 */
export function sanitizeString(val: unknown, maxLen = 200): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  // Strip dangerous spreadsheet formula prefixes
  if (/^[=+\-@]/.test(str)) {
    str = str.replace(/^[=+\-@]+/, '').trim();
  }
  // Remove non-printable control characters
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return str.slice(0, maxLen).trim();
}

/**
 * Converts an Excel serial date/time number into "HH:mm" (24-hour string).
 */
export function excelSerialToTime(val: number): string | null {
  if (isNaN(val)) return null;
  let fraction = val - Math.floor(val);
  if (fraction === 0 && val >= 0 && val < 1) fraction = val;
  if (fraction < 0 || fraction >= 1) return null;

  const totalMinutes = Math.round(fraction * 24 * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Extracts a time range { start, end } from any raw string, number, or condensed military format.
 */
export function extractTimeRange(raw: unknown): { start: string; end: string } | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    const t = excelSerialToTime(raw);
    if (t) {
      const [hStr, mStr] = t.split(':');
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      const endH = (h + 1) % 24;
      return {
        start: t,
        end: `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      };
    }
  }

  const str = sanitizeString(raw, 100);
  if (!str) return null;

  // Clean unicode dashes and common separators
  const cleanStr = str
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212~]/g, '-')
    .replace(/\b(?:to|until|till)\b/gi, '-');

  // 1. Try standard regex time range: e.g. "08:30AM - 10:00AM", "01:45PM - 03:15PM", "1:45 PM - 3:15 PM", "9:00-10:15", "13:30-15:00"
  const rangeMatch = cleanStr.match(/(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm|a|p)?|\b[012]\d[0-5]\d\b)\s*[-/]\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm|a|p)?|\b[012]\d[0-5]\d\b)/i);
  if (rangeMatch) {
    const parsed = parseTimeRange(`${rangeMatch[1]}-${rangeMatch[2]}`);
    if (parsed) return parsed;
  }

  // 2. Condensed military time: e.g. "0900-1015" or "1330-1500"
  const militaryMatch = cleanStr.match(/\b([012]\d[0-5]\d)\s*[-/ ]\s*([012]\d[0-5]\d)\b/);
  if (militaryMatch) {
    const sH = militaryMatch[1].slice(0, 2);
    const sM = militaryMatch[1].slice(2, 4);
    const eH = militaryMatch[2].slice(0, 2);
    const eM = militaryMatch[2].slice(2, 4);
    return {
      start: `${sH}:${sM}`,
      end: `${eH}:${eM}`,
    };
  }

  return parseTimeRange(cleanStr);
}

/**
 * Regex patterns for day tokens: MWF, TTH, TUTH, TR, M, T, W, R, F, Mon, Tue, Wed, Thu, Fri, TF, TH, MW, WF, etc.
 */
const DAY_TOKEN_REGEX = /\b(MWF|TTH|TUTH|MTH|MOTH|WF|MW|TF|TR|TRF|TTHF|TUFR|WEFR|MTWTHF|MTWRF|TWTHF|MON(?:DAY)?|TUE(?:SDAY)?|WED(?:NESDAY)?|THU(?:RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?|TH|SU|SA|TU|WE|MO|FR|M|T|W|R|F|S|U)\b/gi;

/**
 * Extracts DayOfWeek[] from any raw string or array of tokens.
 */
export function extractDays(raw: unknown): DayOfWeek[] {
  if (raw === null || raw === undefined) return [];
  const str = sanitizeString(raw, 100);
  if (!str) return [];

  // Strip cohort prefixes e.g. "(DD)", "(A)", "(AA)", "(Y)", "(Z)", "(B)", "(BB)", "(L)"
  const withoutPrefix = str.replace(/^\([A-Za-z0-9]+\)\s*/, '');
  const cleanStr = withoutPrefix.replace(/[-–—/]/g, ' ');

  // Match all day tokens in the string
  const matches = cleanStr.match(DAY_TOKEN_REGEX);
  if (matches && matches.length > 0) {
    const normalized = normalizeDays(matches);
    if (normalized.length > 0) return normalized;
  }

  // Fallback: split by delimiters
  const parts = str.split(/[\s,;/&+\-–—]+/).filter(Boolean);
  if (parts.length > 0) {
    const res = normalizeDays(parts);
    if (res.length > 0) return res;
  }

  return [];
}

/**
 * Checks if a string represents an Online, Asynchronous, TBA, or Flexible course.
 */
export function isOnlineOrTBA(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  const s = sanitizeString(val, 100).toLowerCase();
  return /\b(online|async|asynchronous|tba|tbd|tbc|arr|arranged|distance|virtual|remote|web|flex|flexible|n\/a)\b/i.test(s);
}

/**
 * Parses schedule strings that contain both day and time, e.g.:
 * "(DD) 01:45PM - 03:15PM TF"
 * "(A) 08:30AM - 10:00AM MW"
 * "(AA) 08:30AM - 10:00AM TF"
 * "(Y) 01:45PM - 02:45PM TH"
 * "(Z) 03:30PM - 04:30PM TH"
 * "(B) 10:15AM - 11:45AM MW"
 * "(BB) 10:15AM - 11:45AM TF"
 * "(L) 12:00PM - 01:30PM WF"
 * "MWF 9:00AM - 10:00AM"
 */
export function parseScheduleString(raw: unknown): {
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
} | null {
  if (raw === null || raw === undefined) return null;
  let str = sanitizeString(raw, 100);
  if (!str) return null;

  // 1. Strip cohort or letter prefix in parentheses: e.g. "(DD)", "(AA)", "(1)", "(L)", "(A)", "(Y)", "(Z)"
  str = str.replace(/^\([A-Za-z0-9]+\)\s*/, '');
  str = str.replace(/\s*\([A-Za-z0-9]+\)$/, '');

  // 2. Extract day tokens
  const days = extractDays(str);

  // 3. Extract time range
  const timeResult = extractTimeRange(str);

  if (timeResult) {
    return {
      days: days.length > 0 ? days : ['monday'],
      startTime: timeResult.start,
      endTime: timeResult.end,
    };
  }

  if (days.length > 0) {
    return {
      days,
      startTime: '09:00',
      endTime: '10:15',
    };
  }

  return null;
}

/**
 * Returns sheet names excluding hidden / very-hidden sheets (e.g. stale
 * previous-semester data). Falls back to all sheets if every sheet is hidden.
 */
export function getVisibleSheetNames(workbook: WorkBook): string[] {
  const meta = workbook.Workbook?.Sheets;
  const visible = workbook.SheetNames.filter((_, i) => !meta?.[i]?.Hidden);
  return visible.length > 0 ? visible : workbook.SheetNames;
}

/**
 * Reads workbook file from ArrayBuffer and inspects sheet structure.
 */
export async function readExcelFile(data: ArrayBuffer): Promise<{
  workbook: WorkBook;
  sheets: string[];
}> {
  const XLSX = await loadXlsx();
  const workbook = XLSX.read(data, {
    type: 'array',
    cellDates: false,
    raw: false,
  });

  return {
    workbook,
    sheets: getVisibleSheetNames(workbook),
  };
}

/**
 * Clamps the sheet's !ref range to only rows and columns that contain actual non-empty data.
 */
export function clampSheetRange(sheet: WorkSheet, maxAllowedCols = 60, maxAllowedRows = 10000): void {
  if (!sheet) return;
  const XLSX = requireXlsx();

  let maxR = -1;
  let maxC = -1;
  let hasCells = false;

  for (const key of Object.keys(sheet)) {
    if (key.charCodeAt(0) === 33) continue;
    const cellVal = sheet[key];
    if (!cellVal) continue;

    const v = cellVal.v;
    const w = cellVal.w;
    const f = cellVal.f;
    const hasValue =
      (v !== undefined && v !== null && String(v).trim() !== '') ||
      (w !== undefined && w !== null && String(w).trim() !== '') ||
      (f !== undefined && f !== null && String(f).trim() !== '');

    if (!hasValue) continue;

    const cell = XLSX.utils.decode_cell(key);
    hasCells = true;
    if (cell.r > maxR) maxR = cell.r;
    if (cell.c > maxC) maxC = cell.c;
  }

  if (hasCells) {
    const endRow = Math.min(maxR, maxAllowedRows - 1);
    const endCol = Math.min(maxC, maxAllowedCols - 1);
    sheet['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: endRow, c: endCol },
    });
  } else {
    sheet['!ref'] = 'A1:A1';
  }
}

/**
 * Inspects a sheet, detects columns, sample values, header rows, and content mappings.
 */
export function loadSheetData(workbook: WorkBook, sheetName: string): ExcelWorkbookData {
  const XLSX = requireXlsx();
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return {
      sheets: getVisibleSheetNames(workbook),
      currentSheet: sheetName,
      columns: [],
      rawRows: [],
      dataStartRow: 0,
      detectedMapping: getEmptyMapping(),
    };
  }

  // Pre-clamp range so sheet_to_json does not expand empty columns
  clampSheetRange(sheet);

  // Convert sheet to 2D array of values
  const rawRows: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });

  if (rawRows.length === 0) {
    return {
      sheets: getVisibleSheetNames(workbook),
      currentSheet: sheetName,
      columns: [],
      rawRows: [],
      dataStartRow: 0,
      detectedMapping: getEmptyMapping(),
    };
  }

  // Find max column index with actual non-empty content
  let maxColIndexWithData = -1;
  for (let r = 0; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row) continue;
    for (let c = row.length - 1; c > maxColIndexWithData; c--) {
      const val = row[c];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        maxColIndexWithData = c;
        break;
      }
    }
  }

  const maxCols = Math.min(Math.max(maxColIndexWithData + 1, 1), 60);

  // Normalize rows to have consistent length
  const trimmedRows = rawRows.map((row) => {
    const trimmed = row.slice(0, maxCols);
    while (trimmed.length < maxCols) {
      trimmed.push('');
    }
    return trimmed;
  });

  const sampleScanRows = Math.min(trimmedRows.length, 300);

  // Detect header row index
  let headerRowIndex = -1;
  const HEADER_KEYWORDS = [
    'course', 'code', 'subject', 'subj', 'title', 'name', 'section', 'sec',
    'instructor', 'professor', 'prof', 'faculty', 'day', 'days', 'time', 'times',
    'start', 'end', 'room', 'bldg', 'classroom', 'location', 'credit', 'credits', 'unit', 'units', 'schedule',
    'crn', 'catalog', 'crse', 'descr', 'nbr', 'dept'
  ];

  for (let r = 0; r < Math.min(trimmedRows.length, 12); r++) {
    const row = trimmedRows[r];
    if (!row) continue;
    let matchCount = 0;
    for (const cell of row) {
      const rawText = sanitizeString(cell).toLowerCase().trim();
      if (!rawText) continue;
      if (rawText.length <= 40) {
        const words = rawText.split(/[\s_\-/\\:]+/).filter(Boolean);
        if (words.some((w) => HEADER_KEYWORDS.includes(w))) {
          matchCount++;
        }
      }
    }
    if (matchCount >= 2) {
      headerRowIndex = r;
      break;
    }
  }

  // Determine data start row
  let dataStartRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
  if (headerRowIndex < 0) {
    for (let r = 0; r < sampleScanRows; r++) {
      const row = trimmedRows[r];
      const hasContent = row && row.some((c) => sanitizeString(c) !== '');
      if (hasContent) {
        dataStartRow = r;
        break;
      }
    }
  }

  // Build ColumnOption descriptors
  const columns: ColumnOption[] = [];
  for (let c = 0; c < maxCols; c++) {
    const letter = getColumnLetter(c);
    const key = `col_${c}`;

    const rawHeader = headerRowIndex >= 0 && trimmedRows[headerRowIndex] ? sanitizeString(trimmedRows[headerRowIndex][c], 40) : '';

    // Collect sample values
    const samples: string[] = [];
    for (let r = dataStartRow; r < sampleScanRows && samples.length < 3; r++) {
      const row = trimmedRows[r];
      if (!row) continue;
      const val = sanitizeString(row[c], 40);
      if (val && !samples.includes(val)) {
        samples.push(val);
      }
    }

    let label = `Col ${letter}`;
    if (rawHeader) {
      label += ` [${rawHeader}]`;
    } else if (samples.length > 0) {
      const preview = samples.slice(0, 2).join(', ');
      label += ` (${preview})`;
    } else {
      label += ` (Empty)`;
    }

    columns.push({
      key,
      index: c,
      letter,
      headerText: rawHeader,
      label,
      samples,
    });
  }

  // Content-based and header-based intelligent column detection
  const detectedMapping = autoDetectColumns(trimmedRows, dataStartRow, columns);

  return {
    sheets: getVisibleSheetNames(workbook),
    currentSheet: sheetName,
    columns,
    rawRows: trimmedRows,
    dataStartRow,
    detectedMapping,
  };
}

export function getEmptyMapping(): ColumnMapping {
  return {
    code: '',
    subject: '',
    courseNum: '',
    name: '',
    section: '',
    schedule: '',
    days: '',
    time: '',
    startTime: '',
    endTime: '',
    instructor: '',
    credits: '',
    room: '',
  };
}

// Regex patterns for course code, subject, number, section, and schedule detection
const COURSE_CODE_REGEX = /^[A-Za-z]{2,6}\s*[-_.:]?\s*\d{2,4}[A-Za-z]?$/;
const SUBJECT_ONLY_REGEX = /^[A-Za-z]{2,5}$/;
const COURSE_NUMBER_ONLY_REGEX = /^\d{2,4}[A-Za-z]?$/;
const SECTION_REGEX = /^\d{1,4}[A-Za-z]?$|^[A-Za-z]\d{0,2}$/i;

/**
 * Automatically detects which column corresponds to each course field
 * combining header keyword analysis and deep content validation across up to 1,000 rows.
 */
export function autoDetectColumns(
  rawRows: (string | number | undefined)[][],
  dataStartRow: number,
  columns: ColumnOption[]
): ColumnMapping {
  const mapping = getEmptyMapping();
  if (columns.length === 0 || rawRows.length === 0) return mapping;

  const scanEnd = Math.min(rawRows.length, dataStartRow + 1000);
  const totalSampleRows = Math.max(1, scanEnd - dataStartRow);

  interface FieldScore {
    colKey: string;
    code: number;
    subject: number;
    courseNum: number;
    name: number;
    section: number;
    schedule: number;
    days: number;
    time: number;
    startTime: number;
    endTime: number;
    instructor: number;
    credits: number;
    room: number;
  }

  const scores: FieldScore[] = columns.map((col) => {
    const rawH = col.headerText.toLowerCase();
    const cleanH = rawH.replace(/[^a-z0-9]/g, ' ').trim();

    // 1. Header keyword weights
    let codeH = 0;
    let subjectH = 0;
    let courseNumH = 0;
    let nameH = 0;
    let sectionH = 0;
    let scheduleH = 0;
    let daysH = 0;
    let timeH = 0;
    let startH = 0;
    let endH = 0;
    let instructorH = 0;
    let creditsH = 0;
    let roomH = 0;

    // Subject column detection e.g. "Acad. Dept", "Subject", "Dept"
    if (/\b(acad\s*dept|academic\s*department|subject|subj|department|dept)\b/i.test(cleanH)) subjectH = 14;

    // Course number column detection e.g. "Crse", "Course #"
    if (/\b(crse|course\s*no|course\s*num|course\s*#|catalog\s*#|cat\s*#|cat\s*no|catalog\s*nbr|catalog\s*number)\b/i.test(cleanH)) courseNumH = 14;

    // Full Course Code detection e.g. "Course Code", "Course ID", "CRN"
    if (/\b(course\s*code|course\s*id|crn|class\s*#|class\s*nbr|course\s*identifier|subj\s*crse)\b/i.test(cleanH)) codeH = 16;
    else if (/\b(code)\b/i.test(cleanH)) codeH = 8;

    // Course Title detection e.g. "Course Title", "Course Name"
    if (/\b(course\s*title|course\s*name|subject\s*title|course\s*desc|description|descr|long\s*title)\b/i.test(cleanH)) nameH = 16;
    else if (/\b(title|name)\b/i.test(cleanH) && !/\b(instructor|prof|teacher|faculty)\b/i.test(cleanH)) nameH = 8;

    // Section e.g. "Section", "Sec"
    if (/\b(section|sec|sec\s*#|sec\s*no|sect|class\s*sec|section\s*number)\b/i.test(cleanH)) sectionH = 16;

    // Schedule / Meeting / Time* e.g. "Time*", "Schedule", "Day / Time"
    if (/\b(schedule|day\s*[\/&]\s*time|days\s*[\/&]\s*time|days\s*and\s*times?|meeting\s*pattern|class\s*schedule|meeting\s*info)\b/i.test(cleanH)) {
      scheduleH = 16;
    } else if (/\b(time)\b/i.test(cleanH) && !/\b(start|end|begin|finish|due|date)\b/i.test(cleanH)) {
      scheduleH = 10;
      timeH = 10;
    }

    if (/\b(meeting\s*days?|class\s*days?|pattern|mtg\s*days?)\b/i.test(cleanH)) daysH = 14;
    else if (/\b(days?)\b/i.test(cleanH) && !/\btime\b/i.test(cleanH)) daysH = 8;

    if (/\b(start\s*time|begin\s*time|start|begin|from)\b/i.test(cleanH) && !/\bdate\b/i.test(cleanH)) startH = 14;
    if (/\b(end\s*time|finish\s*time|end|finish|to)\b/i.test(cleanH) && !/\bdate\b/i.test(cleanH)) endH = 14;

    // Faculty / Professor / Instructor e.g. "Faculty", "Instructor"
    if (/\b(faculty|instructor|professor|teacher|prof|lecturer|instructor\s*name|primary\s*instructor)\b/i.test(cleanH)) instructorH = 16;
    else if (/\bstaff\b/i.test(cleanH)) instructorH = 6;

    // Credit e.g. "Credit", "Credits", "Units"
    if (/\b(credit\s*hours?|credits?|units?|credit\s*units?|hrs?|cr|credit)\b/i.test(cleanH)) creditsH = 16;

    // Classroom / Room e.g. "Classroom", "Room", "Location"
    if (/\b(classroom|room|location|bldg|building|facility|hall|venue|facility\s*id)\b/i.test(cleanH)) roomH = 16;

    // 2. Data content analysis across rows
    let codeMatches = 0;
    let subjectMatches = 0;
    let courseNumMatches = 0;
    let nameMatches = 0;
    let sectionMatches = 0;
    let scheduleMatches = 0;
    let daysMatches = 0;
    let timeMatches = 0;
    let startMatches = 0;
    let endMatches = 0;
    let instructorMatches = 0;
    let creditsMatches = 0;
    let roomMatches = 0;

    for (let r = dataStartRow; r < scanEnd; r++) {
      const row = rawRows[r];
      if (!row) continue;
      const val = sanitizeString(row[col.index]);
      if (!val) continue;

      // Full Course Code e.g. "BUSN 200", "BUSN 370", "BUSN 370L", "ECON 200"
      if (COURSE_CODE_REGEX.test(val)) {
        codeMatches++;
      } else if (/^[A-Za-z]{2,5}\s+\d{2,4}/.test(val)) {
        codeMatches += 0.8;
      }

      // Subject Only e.g. "BUSN", "ECON", "MATH", "CS"
      if (SUBJECT_ONLY_REGEX.test(val) && val.length <= 5) {
        subjectMatches++;
      }

      // Course Number Only e.g. "200", "370", "370L"
      if (COURSE_NUMBER_ONLY_REGEX.test(val) && val.length <= 5) {
        courseNumMatches++;
      }

      // Section e.g. "001", "002", "003", "A"
      if (SECTION_REGEX.test(val) && val.length <= 4 && !/^[A-Za-z]{2,}/.test(val)) {
        sectionMatches++;
      }

      // Course Title e.g. "Intro to Business Communication", "Management of Information Systems"
      if (
        val.length >= 5 &&
        val.includes(' ') &&
        !/\d{1,2}:\d{2}/.test(val) &&
        !/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(val) &&
        !/^\d{1,2}\/\d{1,2}/.test(val)
      ) {
        nameMatches++;
      }

      // Schedule (Day + Time combined) e.g. "(DD) 01:45PM - 03:15PM TF", "(A) 08:30AM - 10:00AM MW"
      const hasTime = /\d{1,2}[:.]\d{2}|\b[012]\d[0-5]\d\b/.test(val);
      const hasDays = /(?:MWF|TTH|TF|WF|MW|TR|TUFR|MTH|MTWRF|MON|TUE|WED|THU|FRI|\bTH\b|\bTF\b|\bMW\b|\bWF\b)/i.test(val);

      if (hasTime && hasDays) {
        scheduleMatches++;
      } else if (hasDays && !hasTime) {
        daysMatches++;
      } else if (hasTime && !hasDays) {
        if (/[-–~to/]/.test(val)) {
          timeMatches++;
        } else {
          startMatches += 0.5;
          endMatches += 0.5;
        }
      }

      // Instructor e.g. "Yusuf Nulla", "Darin Duch", "TBC", "TBA", "Staff"
      if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(val) || val === 'Staff' || val === 'TBA' || val === 'TBC') {
        instructorMatches++;
      }

      // Credits e.g. 1 to 6
      const num = Number(val);
      if (!isNaN(num) && num >= 0.5 && num <= 8) {
        creditsMatches++;
      }

      // Room e.g. "TBD", "TBA", "Hall 101", "Room 204"
      if (
        val === 'TBD' ||
        val === 'TBA' ||
        /^Room|Hall|Bldg|Lab|Aud/i.test(val) ||
        /\b[A-Za-z]{1,3}\s*\d{3}\b/.test(val)
      ) {
        roomMatches++;
      }
    }

    return {
      colKey: col.key,
      code: codeH + (codeMatches / totalSampleRows) * 8,
      subject: subjectH + (subjectMatches / totalSampleRows) * 6,
      courseNum: courseNumH + (courseNumMatches / totalSampleRows) * 6,
      name: nameH + (nameMatches / totalSampleRows) * 8,
      section: sectionH + (sectionMatches / totalSampleRows) * 8,
      schedule: scheduleH + (scheduleMatches / totalSampleRows) * 8,
      days: daysH + (daysMatches / totalSampleRows) * 6,
      time: timeH + (timeMatches / totalSampleRows) * 6,
      startTime: startH + (startMatches / totalSampleRows) * 6,
      endTime: endH + (endMatches / totalSampleRows) * 6,
      instructor: instructorH + (instructorMatches / totalSampleRows) * 8,
      credits: creditsH + (creditsMatches / totalSampleRows) * 8,
      room: roomH + (roomMatches / totalSampleRows) * 8,
    };
  });

  const assigned = new Set<string>();

  const pickBest = (field: keyof Omit<FieldScore, 'colKey'>, threshold = 1.5): string => {
    const candidates = scores
      .filter((s) => !assigned.has(s.colKey) && s[field] >= threshold)
      .sort((a, b) => b[field] - a[field]);

    if (candidates.length > 0) {
      const best = candidates[0].colKey;
      assigned.add(best);
      return best;
    }
    return '';
  };

  // Assign in prioritized order
  mapping.code = pickBest('code');
  if (!mapping.code) {
    mapping.subject = pickBest('subject');
    mapping.courseNum = pickBest('courseNum');
  } else {
    // Subject (Acad Dept) can still be recognized optionally
    mapping.subject = pickBest('subject', 5.0);
  }

  mapping.name = pickBest('name');
  mapping.schedule = pickBest('schedule');
  if (!mapping.schedule) {
    mapping.days = pickBest('days');
    mapping.time = pickBest('time');
    if (!mapping.time) {
      mapping.startTime = pickBest('startTime');
      mapping.endTime = pickBest('endTime');
    }
  }

  mapping.section = pickBest('section');
  mapping.instructor = pickBest('instructor');
  mapping.credits = pickBest('credits');
  mapping.room = pickBest('room');

  // Safety fallback: if code still empty, pick first non-empty column
  if (!mapping.code && !mapping.subject && columns.length > 0) {
    const unassigned = columns.find((c) => !assigned.has(c.key) && c.samples.length > 0);
    if (unassigned) {
      mapping.code = unassigned.key;
      assigned.add(unassigned.key);
    }
  }

  // Safety fallback: if name still empty, pick next non-empty column
  if (!mapping.name && columns.length > 1) {
    const unassigned = columns.find((c) => !assigned.has(c.key) && c.samples.length > 0);
    if (unassigned) {
      mapping.name = unassigned.key;
      assigned.add(unassigned.key);
    }
  }

  return mapping;
}

/**
 * Parses raw data rows into structured Course objects based on active column mapping.
 * Each data row in the spreadsheet corresponds to 1 independent course / section option.
 */
export function parseExcelRowsToCourses(
  rawRows: (string | number | undefined)[][],
  dataStartRow: number,
  mapping: ColumnMapping,
  startColorIndex = 0
): ExcelParseResult {
  const courses: Course[] = [];
  const warnings: string[] = [];
  let skippedRows = 0;

  const getCell = (row: (string | number | undefined)[], colKey: string | undefined): string => {
    if (!colKey || !colKey.startsWith('col_')) return '';
    const idx = parseInt(colKey.replace('col_', ''), 10);
    if (isNaN(idx) || idx < 0 || idx >= row.length) return '';
    return sanitizeString(row[idx]);
  };

  for (let r = dataStartRow; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) {
      skippedRows++;
      continue;
    }

    let code = getCell(row, mapping.code);
    const subject = getCell(row, mapping.subject);
    const courseNum = getCell(row, mapping.courseNum);
    let name = getCell(row, mapping.name);
    const section = getCell(row, mapping.section);
    const instructor = getCell(row, mapping.instructor);
    const creditsStr = getCell(row, mapping.credits);
    const room = getCell(row, mapping.room);

    // If row is entirely blank, skip
    const isRowBlank = row.every((c) => sanitizeString(c) === '');
    if (isRowBlank) {
      skippedRows++;
      continue;
    }

    // Auto-combine Subject + Course Number if mapped separately e.g. "BUSN" + "200"
    if (!code && subject && courseNum) {
      code = `${subject.toUpperCase()} ${courseNum.toUpperCase()}`;
    } else if (code && !code.includes(' ') && courseNum && !code.includes(courseNum)) {
      code = `${code.toUpperCase()} ${courseNum.toUpperCase()}`;
    }

    // Auto-decompose code and title if one contains the other: e.g. "ICT 304 Mobile App Dev"
    if (code && !name && code.includes(' ')) {
      const codeMatch = code.match(/^([A-Za-z]{2,6}\s*[-_.:]?\s*\d{2,4}[A-Za-z]?)\s+(.+)$/);
      if (codeMatch) {
        code = codeMatch[1].trim().toUpperCase();
        name = codeMatch[2].trim();
      }
    } else if (!code && name && name.includes(' ')) {
      const codeMatch = name.match(/^([A-Za-z]{2,6}\s*[-_.:]?\s*\d{2,4}[A-Za-z]?)\s+(.+)$/);
      if (codeMatch) {
        code = codeMatch[1].trim().toUpperCase();
        name = codeMatch[2].trim();
      }
    }

    // If neither code nor name found, check if any cell has text
    if (!code && !name) {
      const firstText = row.find((c) => sanitizeString(c).length > 0);
      if (firstText) {
        const textVal = sanitizeString(firstText);
        // Ignore department banner or page total lines
        if (/^(?:total|page\s*\d+|department of|undergraduate|graduate|fall\s*\d+|spring\s*\d+|summer\s*\d+|winter\s*\d+)\b/i.test(textVal)) {
          skippedRows++;
          continue;
        }
        code = textVal.slice(0, 10).toUpperCase();
        name = textVal;
      } else {
        skippedRows++;
        continue;
      }
    }

    // Parse Schedule Sessions for current row
    let rowSessions: ClassSession[] = [];
    const safeTag = (code || name || `item_${r}`).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    const courseId = prefixedId(`c_${safeTag}`);

    // Path 1: Combined schedule column e.g. "(DD) 01:45PM - 03:15PM TF"
    if (mapping.schedule) {
      const scheduleRaw = getCell(row, mapping.schedule);
      if (scheduleRaw) {
        // Support multi-meeting schedule strings separated by semicolon, newline, pipe, or double-slash
        const segments = scheduleRaw.split(/[;\n|]+|\s*\/\/\s*/).map((s) => s.trim()).filter(Boolean);
        for (const seg of segments) {
          const scheduleParsed = parseScheduleString(seg);
          if (scheduleParsed) {
            for (const day of scheduleParsed.days) {
              rowSessions.push({
                id: `s_${courseId}_${rowSessions.length}`,
                day,
                startTime: scheduleParsed.startTime,
                endTime: scheduleParsed.endTime,
                room: room || undefined,
              });
            }
          }
        }
      }
    }

    // Path 2: Separate Days and Time column (or StartTime + EndTime)
    if (rowSessions.length === 0 && (mapping.days || mapping.time || mapping.startTime || mapping.endTime)) {
      const daysRaw = getCell(row, mapping.days);
      const timeRaw = getCell(row, mapping.time);
      const startRaw = getCell(row, mapping.startTime);
      const endRaw = getCell(row, mapping.endTime);

      const parsedDays = extractDays(daysRaw);
      if (parsedDays.length > 0 || timeRaw || startRaw || endRaw) {
        const finalDays: DayOfWeek[] = parsedDays.length > 0 ? parsedDays : ['monday', 'wednesday', 'friday'];
        let startTime = '09:00';
        let endTime = '10:15';

        let timesValid = true;
        if (timeRaw) {
          const timeParsed = extractTimeRange(timeRaw);
          if (timeParsed) {
            startTime = timeParsed.start;
            endTime = timeParsed.end;
          }
        } else if (startRaw || endRaw) {
          const pad = (n: number) => String(n).padStart(2, '0');
          let parsedStart = startRaw ? parseSingleTimeToken(startRaw, false) : null;
          let parsedEnd = endRaw ? parseSingleTimeToken(endRaw, false) : null;
          const startExplicit = /[ap]/i.test(startRaw);
          const endExplicit = /[ap]/i.test(endRaw);

          // "7:00" / "9:00" parses as 19:00 and 09:00. Move the end forward
          // before giving up, so the session stays on the same afternoon.
          if (parsedStart && parsedEnd) {
            let startMinutes = parsedStart.h * 60 + parsedStart.m;
            let endMinutes = parsedEnd.h * 60 + parsedEnd.m;
            if (startMinutes >= endMinutes && parsedEnd.h < 12 && !endExplicit) {
              parsedEnd = { ...parsedEnd, h: parsedEnd.h + 12 };
              endMinutes = parsedEnd.h * 60 + parsedEnd.m;
            }
            if (startMinutes >= endMinutes && parsedStart.h >= 12 && !startExplicit) {
              parsedStart = { ...parsedStart, h: parsedStart.h - 12 };
              startMinutes = parsedStart.h * 60 + parsedStart.m;
            }
          }

          if (parsedStart) {
            startTime = `${pad(parsedStart.h)}:${pad(parsedStart.m)}`;
          }
          if (parsedEnd) {
            endTime = `${pad(parsedEnd.h)}:${pad(parsedEnd.m)}`;
          } else if (parsedStart && parsedStart.h < 23) {
            endTime = `${pad(parsedStart.h + 1)}:${pad(parsedStart.m)}`;
          }
        }

        if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
          timesValid = false;
          warnings.push(
            `Row ${r + 1}: "${code || name}" has an invalid time range (${startRaw || startTime}-${endRaw || endTime})`
          );
        }

        if (timesValid) {
          rowSessions = finalDays.map((day, sIdx) => ({
            id: `s_${courseId}_${sIdx}`,
            day,
            startTime,
            endTime,
            room: room || undefined,
          }));
        }
      }
    }

    // Credits
    let credits = 3;
    if (creditsStr) {
      const parsedNum = parseFloat(creditsStr);
      if (!isNaN(parsedNum) && parsedNum >= 0 && parsedNum <= 12) {
        credits = parsedNum;
      }
    }

    // Path 3: Fallback if no sessions parsed (e.g. online/async or unmapped schedule)
    if (rowSessions.length === 0) {
      const scheduleRaw = getCell(row, mapping.schedule);
      const isOnline = isOnlineOrTBA(scheduleRaw) || isOnlineOrTBA(room);
      if (isOnline) {
        warnings.push(`Row ${r + 1}: "${code || name}" marked as Online / Asynchronous (no calendar meetings assigned)`);
      } else if (scheduleRaw) {
        warnings.push(`Row ${r + 1}: "${code || name}" has unparseable schedule "${scheduleRaw}"`);
      }
    }

    const colorIdx = (startColorIndex + courses.length) % COURSE_COLORS.length;
    const color = COURSE_COLORS[colorIdx];

    const finalCode = code || (name ? name.slice(0, 10).toUpperCase() : 'COURSE');
    const finalName = name || '';

    const course: Course = {
      id: courseId,
      code: finalCode,
      name: finalName,
      section: section || undefined,
      instructor: instructor || undefined,
      credits,
      color,
      sessions: rowSessions,
    };

    courses.push(course);
  }

  return {
    success: courses.length > 0,
    courses,
    totalRows: rawRows.length - dataStartRow,
    skippedRows,
    warnings,
  };
}
