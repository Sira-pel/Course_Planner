import type { WorkBook, WorkSheet } from 'xlsx';
import { Course, ClassSession, DayOfWeek, COURSE_COLORS } from '../types/schedule';
import { prefixedId } from './id';
import { parseTimeRange, parseSingleTimeToken, normalizeDays, explicitMeridian, interpretCredits } from './textParser';
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

export interface ImportRowIssue {
  courseId: string;
  message: string;
  /** Invalid or missing time. The row is shown, but it has no invented meeting. */
  blocking: boolean;
}

export interface ExcelParseResult {
  success: boolean;
  courses: Course[];
  totalRows: number;
  skippedRows: number;
  warnings: string[];
  issues: ImportRowIssue[];
  error?: string;
}

export interface TabularAnalysis {
  columns: ColumnOption[];
  rawRows: (string | number | undefined)[][];
  dataStartRow: number;
  detectedMapping: ColumnMapping;
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

const MONTH_NAME =
  'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

/**
 * Calendar dates are not class times or credits.
 * 2026-08-17, 8/17/2026, 17/08/2026, Aug 17, August 17 2026, and Excel date serials.
 */
export function isDateCell(raw: string): boolean {
  const val = raw.trim();
  if (!val) return false;
  if (/^\d{4}-\d{1,2}-\d{1,2}(?:[t\s].*)?$/i.test(val)) return true;
  if (/^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(val)) return true;
  const monthFirst = new RegExp(`^(?:${MONTH_NAME})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?$`, 'i');
  const dayFirst = new RegExp(`^\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_NAME})(?:,?\\s+\\d{4})?$`, 'i');
  if (monthFirst.test(val) || dayFirst.test(val)) return true;
  if (/^\d{5}(?:\.\d+)?$/.test(val)) {
    const serial = Number(val);
    if (serial >= 20000 && serial <= 80000) return true;
  }
  return false;
}

/** Parses a clock string, or an Excel day-fraction such as 0.375 for 9:00. */
function parseCellTime(raw: string): { h: number; m: number } | null {
  const trimmed = raw.trim();
  if (/^\d*\.\d+$/.test(trimmed)) {
    const fraction = Number(trimmed);
    if (fraction >= 0 && fraction < 1) {
      const clock = excelSerialToTime(fraction);
      if (!clock) return null;
      const [h, m] = clock.split(':').map((part) => Number(part));
      return { h, m };
    }
  }
  return parseSingleTimeToken(trimmed, false);
}

/**
 * Extracts a time range { start, end } from any raw string, number, or condensed military format.
 */
export function extractTimeRange(raw: unknown): { start: string; end: string } | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const whole = Math.floor(raw);
    const fraction = raw - whole;
    // Integer serials (and plain counts) are dates or quantities, not a clock.
    if (!(whole >= 1 && fraction === 0)) {
      const clockSource = whole >= 1 ? fraction : raw;
      const t = excelSerialToTime(clockSource);
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
  }

  const str = sanitizeString(raw, 100);
  if (!str || isDateCell(str)) return null;

  if (/^\d*\.\d+$/.test(str)) {
    const fraction = Number(str);
    if (fraction >= 0 && fraction < 1) {
      const t = excelSerialToTime(fraction);
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
  }

  // Clean unicode dashes and common separators
  const cleanStr = str
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212~]/g, '-')
    .replace(/\b(?:to|until|till)\b/gi, '-');

  // Military ranges first. The clock pattern would read "0900-0950" as 0900-09 and turn 09 into 21:00.
  const militaryMatch = cleanStr.match(/\b([012]\d[0-5]\d)\s*[-/ ]\s*([012]\d[0-5]\d)\b/);
  if (militaryMatch) {
    const sH = militaryMatch[1].slice(0, 2);
    const sM = militaryMatch[1].slice(2, 4);
    const eH = militaryMatch[2].slice(0, 2);
    const eM = militaryMatch[2].slice(2, 4);
    const start = `${sH}:${sM}`;
    const end = `${eH}:${eM}`;
    if (timeToMinutes(start) < timeToMinutes(end)) return { start, end };
  }

  // Clock ranges: "08:30AM - 10:00AM", "9:00-10:15", "13:30-15:00", "9.00-9.50"
  const rangeMatch = cleanStr.match(/(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm|a|p)?|\b[012]\d[0-5]\d\b)\s*[-/]\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm|a|p)?|\b[012]\d[0-5]\d\b)/i);
  if (rangeMatch) {
    const parsed = parseTimeRange(`${rangeMatch[1]}-${rangeMatch[2]}`);
    if (parsed) return parsed;
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

  // "M-F" and "Mon-Fri" are ranges. Replacing the hyphen first would leave only Monday and Friday.
  const rangeMatch = withoutPrefix.match(
    /\b(M-F|M-TH|MON-FRI|MON-THU|MONDAY-FRIDAY|MONDAY-THURSDAY|DAILY)\b/i
  );
  if (rangeMatch) {
    const ranged = normalizeDays([rangeMatch[1]]);
    if (ranged.length > 0) return ranged;
  }

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
  startTime: string | null;
  endTime: string | null;
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

  if (!timeResult && days.length === 0) return null;

  return {
    days,
    startTime: timeResult ? timeResult.start : null,
    endTime: timeResult ? timeResult.end : null,
  };
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
export class SpreadsheetRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpreadsheetRejectedError';
  }
}

const SPREADSHEET_EXTENSIONS = new Set(['xlsx', 'xlsm', 'xls', 'csv', 'tsv']);

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

/** Reject images, PDFs, and other files that are not Excel or CSV/TSV. */
export function spreadsheetRejectionReason(fileName: string, data: ArrayBuffer): string | null {
  const bytes = new Uint8Array(data.byteLength > 16 ? data.slice(0, 16) : data);
  const sample = new Uint8Array(data.byteLength > 4096 ? data.slice(0, 4096) : data);
  const isZip = startsWith(bytes, [0x50, 0x4b]);
  const isOle = startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0]);
  const isImageOrPdf =
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]) ||
    startsWith(bytes, [0xff, 0xd8, 0xff]) ||
    startsWith(bytes, [0x47, 0x49, 0x46]) ||
    startsWith(bytes, [0x25, 0x50, 0x44, 0x46]) ||
    (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && sample.length > 11 && sample[8] === 0x57);

  if (isImageOrPdf) {
    return 'This file is not a spreadsheet. Upload an Excel, CSV, or TSV file.';
  }

  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';
  if (!fileName) return null;
  if (!SPREADSHEET_EXTENSIONS.has(ext)) {
    return 'This file is not a spreadsheet. Upload an Excel, CSV, or TSV file.';
  }
  if ((ext === 'xlsx' || ext === 'xlsm') && !isZip) {
    return 'This file is not a valid Excel workbook.';
  }
  if (ext === 'xls' && !isOle && !isZip) {
    return 'This file is not a valid Excel workbook.';
  }
  if (ext === 'csv' || ext === 'tsv') {
    if (isZip || isOle || sample.includes(0)) {
      return 'This file is not a CSV spreadsheet.';
    }
    const text = new TextDecoder('utf-8', { fatal: false }).decode(sample).replace(/^\uFEFF/, '').trimStart();
    if (text.startsWith('<')) {
      return 'This file is not a spreadsheet. Upload an Excel, CSV, or TSV file.';
    }
  }
  return null;
}

export async function readExcelFile(data: ArrayBuffer, fileName = ''): Promise<{
  workbook: WorkBook;
  sheets: string[];
}> {
  const rejected = spreadsheetRejectionReason(fileName, data);
  if (rejected) throw new SpreadsheetRejectedError(rejected);
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

  const analyzed = analyzeTabularRows(rawRows);
  return {
    sheets: getVisibleSheetNames(workbook),
    currentSheet: sheetName,
    ...analyzed,
  };
}

export function analyzeTabularRows(inputRows: (string | number | undefined)[][]): TabularAnalysis {
  if (!inputRows || inputRows.length === 0) {
    return {
      columns: [],
      rawRows: [],
      dataStartRow: 0,
      detectedMapping: getEmptyMapping(),
    };
  }

  let maxColIndexWithData = -1;
  for (let r = 0; r < inputRows.length; r++) {
    const row = inputRows[r];
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
  const trimmedRows = inputRows.map((row) => {
    const trimmed = (row || []).slice(0, maxCols);
    while (trimmed.length < maxCols) trimmed.push('');
    return trimmed;
  });

  const sampleScanRows = Math.min(trimmedRows.length, 300);
  let headerRowIndex = -1;
  const HEADER_KEYWORDS = [
    'course', 'code', 'subject', 'subj', 'title', 'name', 'section', 'sec',
    'instructor', 'professor', 'prof', 'faculty', 'day', 'days', 'time', 'times',
    'start', 'end', 'room', 'bldg', 'classroom', 'location', 'credit', 'credits', 'unit', 'units', 'schedule',
    'crn', 'catalog', 'crse', 'descr', 'nbr', 'dept', 'sect', 'hour', 'hours', 'building', 'rm',
  ];

  for (let r = 0; r < Math.min(trimmedRows.length, 12); r++) {
    const row = trimmedRows[r];
    if (!row) continue;
    let matchCount = 0;
    for (const cell of row) {
      const rawText = sanitizeString(cell).toLowerCase().trim();
      if (!rawText || rawText.length > 40) continue;
      const words = rawText.split(/[\s_\-/\\:]+/).filter(Boolean);
      if (words.some((word) => HEADER_KEYWORDS.includes(word))) matchCount++;
    }
    if (matchCount >= 2) {
      headerRowIndex = r;
      break;
    }
  }

  let dataStartRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
  if (headerRowIndex < 0) {
    for (let r = 0; r < sampleScanRows; r++) {
      const row = trimmedRows[r];
      if (row && row.some((cell) => sanitizeString(cell) !== '')) {
        dataStartRow = r;
        break;
      }
    }
  }

  const columns: ColumnOption[] = [];
  for (let c = 0; c < maxCols; c++) {
    const letter = getColumnLetter(c);
    const key = `col_${c}`;
    const rawHeader = headerRowIndex >= 0 && trimmedRows[headerRowIndex]
      ? sanitizeString(trimmedRows[headerRowIndex][c], 40)
      : '';
    const samples: string[] = [];
    for (let r = dataStartRow; r < sampleScanRows && samples.length < 3; r++) {
      const val = sanitizeString(trimmedRows[r]?.[c], 40);
      if (val && !samples.includes(val)) samples.push(val);
    }
    let label = `Col ${letter}`;
    if (rawHeader) label += ` [${rawHeader}]`;
    else if (samples.length > 0) label += ` (${samples.slice(0, 2).join(', ')})`;
    else label += ' (Empty)';
    columns.push({ key, index: c, letter, headerText: rawHeader, label, samples });
  }

  return {
    columns,
    rawRows: trimmedRows,
    dataStartRow,
    detectedMapping: autoDetectColumns(trimmedRows, dataStartRow, columns),
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

const DETECT_FIELDS = [
  'code',
  'subject',
  'courseNum',
  'name',
  'section',
  'schedule',
  'days',
  'time',
  'startTime',
  'endTime',
  'instructor',
  'credits',
  'room',
] as const;

type DetectField = (typeof DETECT_FIELDS)[number];

const DAY_WORD_RE =
  /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues|tue|wed|thurs|thur|thu|fri|sat|sun|mo|tu|we|th|fr|sa|su|mwf|mtwrf|mtwthf|mtwr|tth|tuth|tr|mw|wf|tf|mf|mr|wr|rf|daily|m|t|w|r|f|s|u)$/i;

const COMPACT_DAY_RE =
  /^(?:m-f|m-th|mon-fri|mon-thu|monday-friday|monday-thursday|mtwthf|mtwrf|mtwr|mwf|tth|tuth|tr|mw|wf|tf|th|daily)$/i;

function blankFieldScores(): Record<DetectField, number> {
  return {
    code: 0,
    subject: 0,
    courseNum: 0,
    name: 0,
    section: 0,
    schedule: 0,
    days: 0,
    time: 0,
    startTime: 0,
    endTime: 0,
    instructor: 0,
    credits: 0,
    room: 0,
  };
}

/** Monday, Mon, Mo, M, Thur, R, MWF, TTH, TR, Mon/Wed, "Tue Thu", M-F, and the same shapes. */
function isDayPatternCell(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed || /\d/.test(trimmed)) return false;
  if (COMPACT_DAY_RE.test(trimmed.replace(/\s+/g, ''))) return true;
  const parts = trimmed.split(/\s*(?:[/,&+]|\band\b|-)\s*|\s+/i).filter(Boolean);
  return parts.length > 0 && parts.every((part) => DAY_WORD_RE.test(part));
}

function headerTextNorm(header: string): string {
  return header
    .toLowerCase()
    .replace(/#/g, ' # ')
    .replace(/[_/\\|]+/g, ' ')
    .replace(/[^a-z0-9#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Header synonyms. Course/Crse/Course #, Sec/Sect, Prof/Faculty, Units/Cr/Credit Hrs, Room/Bldg. */
function scoreHeaderText(header: string): Record<DetectField, number> {
  const scores = blankFieldScores();
  const norm = headerTextNorm(header);
  if (!norm) return scores;

  const hasDate = /\bdate\b/.test(norm);
  const isTitle = /\b(?:title|name|desc|description|descr)\b/.test(norm);

  if (
    /\b(?:acad\s+dept|academic\s+department|subject|subj|department|dept|discipline)\b/.test(norm) &&
    !isTitle
  ) {
    scores.subject = 14;
  }

  if (
    /\b(?:crse|course)\s*#/.test(norm) ||
    /\b(?:crse|course)\s+(?:no|num|number|nbr)\b/.test(norm) ||
    /\b(?:catalog|cat)\s*#/.test(norm) ||
    /\b(?:catalog|cat)\s+(?:no|num|number|nbr)\b/.test(norm)
  ) {
    scores.courseNum = 14;
  } else if (/\b(?:number|num|nbr)\b/.test(norm) && !/\b(?:section|sec|sect|phone|room|bldg|id)\b/.test(norm)) {
    scores.courseNum = 12;
  }

  if (
    /\b(?:course\s+code|course\s+id|course\s+identifier|crn|subj\s+crse)\b/.test(norm) ||
    /\bclass\s*#/.test(norm) ||
    /\bclass\s+(?:nbr|number)\b/.test(norm)
  ) {
    scores.code = 16;
  } else if (/\bcode\b/.test(norm)) {
    scores.code = 12;
  } else if (!isTitle && /\b(?:course|crse)\b/.test(norm) && !/\b(?:schedule|day|days|time)\b/.test(norm)) {
    // "Course" and "Crse" are a code or a number depending on the values underneath.
    scores.code = 12;
    if (!scores.courseNum) scores.courseNum = 12;
  }

  if (
    /\b(?:course\s+title|course\s+name|subject\s+title|course\s+desc|description|descr|long\s+title)\b/.test(norm)
  ) {
    scores.name = 16;
  } else if (/\b(?:title|name)\b/.test(norm) && !/\b(?:instructor|prof|teacher|faculty)\b/.test(norm)) {
    scores.name = 8;
  }

  if (
    /\b(?:section|sect)\b/.test(norm) ||
    /\bsec\b/.test(norm) ||
    /\bsec\s*#/.test(norm) ||
    /\b(?:class\s+sec|section\s+number|sec\s+no)\b/.test(norm)
  ) {
    scores.section = 16;
  }

  if (
    /\b(?:schedule|meeting\s+pattern|class\s+schedule|meeting\s+info|days?\s+and\s+times?)\b/.test(norm) ||
    (/\bday\b/.test(norm) && /\btime\b/.test(norm))
  ) {
    scores.schedule = 16;
  } else if (/\btime\b/.test(norm) && !/\b(?:start|end|begin|finish|due|date)\b/.test(norm)) {
    scores.schedule = 10;
    scores.time = 10;
  }

  if (/\b(?:meeting\s+days?|class\s+days?|mtg\s+days?|pattern)\b/.test(norm) && !scores.schedule) {
    scores.days = 14;
  } else if (/\bdays?\b/.test(norm) && !/\btime\b/.test(norm)) {
    scores.days = 8;
  }

  if (!hasDate && /\b(?:start\s+time|begin\s+time|start|begin|from)\b/.test(norm)) scores.startTime = 14;
  if (!hasDate && /\b(?:end\s+time|finish\s+time|end|finish|to)\b/.test(norm)) scores.endTime = 14;

  if (/\b(?:faculty|instructor|professor|teacher|prof|lecturer|instr)\b/.test(norm)) scores.instructor = 16;
  else if (/\bstaff\b/.test(norm)) scores.instructor = 6;

  if (/\b(?:credit\s+hours?|credit\s+hrs?|credits?|units?|hrs?|hours?|cr)\b/.test(norm)) scores.credits = 16;

  if (/\b(?:classroom|class\s+room|room|location|bldg|building|facility|hall|venue|rm)\b/.test(norm)) {
    scores.room = 16;
  }

  return scores;
}

function fitsCode(val: string): boolean {
  if (isDateCell(val) || isDayPatternCell(val)) return false;
  const codePrefix = val.match(/^([A-Za-z]{2,6})\b/)?.[1] || '';
  if (/^(?:hall|room|rm|lab|bldg|building|aud|auditorium|online|tba|tbd)$/i.test(codePrefix)) return false;
  if (COURSE_CODE_REGEX.test(val)) return true;
  const stripped = val.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (stripped !== val && COURSE_CODE_REGEX.test(stripped)) return true;
  return /^[A-Za-z]{2,6}\s+\d{2,4}[A-Za-z]?(?:\s*\/\s*[A-Za-z]{2,6}\s+\d{2,4}[A-Za-z]?)+$/.test(val);
}

function fitsSubject(val: string): boolean {
  if (isDayPatternCell(val)) return false;
  return SUBJECT_ONLY_REGEX.test(val);
}

function fitsCourseNum(val: string): boolean {
  return COURSE_NUMBER_ONLY_REGEX.test(val);
}

function fitsName(val: string): boolean {
  if (fitsCode(val) || isDateCell(val) || isDayPatternCell(val)) return false;
  if (extractTimeRange(val) || looksLikeSingleTime(val)) return false;
  if (val.length < 5 || !/\s/.test(val)) return false;
  if (/^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(val)) return false;
  if (/^\d{1,2}[\/.-]\d{1,2}/.test(val)) return false;
  return true;
}

function fitsSectionValue(val: string): boolean {
  if (isDayPatternCell(val) || isDateCell(val)) return false;
  if (!SECTION_REGEX.test(val) || val.length > 4) return false;
  if (/^[A-Za-z]{2,}/.test(val)) return false;
  return true;
}

/** 30, 25, 40 is a seats column. 001, 002, 101 is still a section column. */
function isLargeVariedNumberColumn(values: string[]): boolean {
  const nonempty = values.filter((value) => value.trim() !== '');
  if (nonempty.length < 2) return false;
  const nums: number[] = [];
  for (const value of nonempty) {
    if (!/^\d{1,4}$/.test(value)) return false;
    nums.push(Number(value));
  }
  if (new Set(nums).size < 2) return false;
  const large = nums.filter((num) => num >= 20).length / nums.length;
  return large >= 0.6;
}

/** Seats sit under 100. Catalog numbers such as 101 and 221 do not. */
function isSeatsColumn(values: string[]): boolean {
  if (!isLargeVariedNumberColumn(values)) return false;
  const nums = values.filter((value) => /^\d{1,4}$/.test(value)).map(Number);
  if (nums.length === 0) return false;
  return nums.filter((num) => num < 100).length / nums.length >= 0.8;
}

function fitsSchedule(val: string): boolean {
  if (isDateCell(val)) return false;
  if (!extractTimeRange(val)) return false;
  return extractDays(val).length > 0;
}

function isExcelTimeFraction(val: string): boolean {
  const s = val.trim();
  if (!/^\d*\.\d+$/.test(s)) return false;
  const fraction = Number(s);
  return fraction >= 0 && fraction < 1;
}

function looksLikeSingleTime(val: string): boolean {
  if (isDateCell(val)) return false;
  if (isExcelTimeFraction(val)) return true;
  if (extractTimeRange(val)) return false;
  const s = val.trim();
  if (/^\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?$/i.test(s)) return true;
  if (/^\d{1,2}\.\d{2}$/.test(s)) return true;
  if (/^\d{1,2}\s*[ap]\.?m\.?$/i.test(s)) return true;
  if (/^(?:[01]\d|2[0-3])[0-5]\d$/.test(s)) return true;
  return false;
}

function fitsTime(val: string): boolean {
  if (isDateCell(val) || fitsSchedule(val)) return false;
  if (isExcelTimeFraction(val)) return true;
  return extractTimeRange(val) !== null;
}

function fitsInstructor(val: string): boolean {
  if (/^(?:staff|tba|tbd|tbc|online(?:\s+\w+)?)$/i.test(val)) return true;
  const cleaned = val
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || /\d/.test(cleaned)) return false;
  const words = cleaned.split(' ');
  if (words.length < 2 || words.length > 5) return false;
  if (/\b(?:of|the|and|to|for|in|introduction|intro|principles|fundamentals)\b/i.test(cleaned)) return false;
  return words.every((word) => /^[A-Z][A-Za-z'’.ʼ-]*$/.test(word));
}

function fitsCredits(val: string): boolean {
  if (isDateCell(val)) return false;
  const match = val.match(/^(\d+(?:\.\d+)?)(?:\s*(?:credits?|credit\s*hours?|units?|hrs?|cr))?$/i);
  if (!match) return false;
  if (/^0\d/.test(match[1])) return false;
  const credits = Number(match[1]);
  return credits >= 0.5 && credits <= 8;
}

function fitsRoom(val: string): boolean {
  if (/^(?:tbd|tba|online(?:\s+\w+)?|arr(?:anged)?)$/i.test(val)) return true;
  if (/^(?:room|rm\.?|hall|bldg|building|lab|auditorium|aud|classroom|facility)\b/i.test(val)) return true;
  if (/^[A-Za-z]{5,}\s+\d{1,4}[A-Za-z]?$/.test(val)) return true;
  return false;
}

function valueFits(field: DetectField, val: string): boolean {
  switch (field) {
    case 'code':
      return fitsCode(val);
    case 'subject':
      return fitsSubject(val);
    case 'courseNum':
      return fitsCourseNum(val);
    case 'name':
      return fitsName(val);
    case 'section':
      return fitsSectionValue(val);
    case 'schedule':
      return fitsSchedule(val);
    case 'days':
      return isDayPatternCell(val);
    case 'time':
      return fitsTime(val);
    case 'startTime':
    case 'endTime':
      return looksLikeSingleTime(val);
    case 'instructor':
      return fitsInstructor(val);
    case 'credits':
      return fitsCredits(val);
    case 'room':
      return fitsRoom(val);
    default:
      return false;
  }
}

/**
 * Automatically detects which column corresponds to each course field
 * combining header keyword analysis and deep content validation across up to 1,000 rows.
 *
 * A header match is kept only when the sampled values fit that field. Day patterns
 * are not subjects, and a column of large varied numbers is not a section. When two
 * fields want one column, the stronger data score wins. Days are filled before subject.
 * The school SIS layout (Acad. Dept, Course Code, Section, Time*) keeps its headers
 * when the values agree, which they do.
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
    index: number;
    data: Record<DetectField, number>;
    header: Record<DetectField, number>;
  }

  const DATA_WEIGHT: Record<DetectField, number> = {
    code: 8,
    subject: 6,
    courseNum: 6,
    name: 8,
    section: 8,
    schedule: 8,
    days: 6,
    time: 6,
    startTime: 6,
    endTime: 6,
    instructor: 8,
    credits: 8,
    room: 8,
  };

  const scores: FieldScore[] = columns.map((col) => {
    const header = scoreHeaderText(col.headerText);
    const hits = blankFieldScores();
    let nonempty = 0;
    const seen: string[] = [];

    for (let r = dataStartRow; r < scanEnd; r++) {
      const row = rawRows[r];
      if (!row) continue;
      const val = sanitizeString(row[col.index]);
      if (!val) continue;
      nonempty++;
      seen.push(val);
      for (const field of DETECT_FIELDS) {
        if (field === 'section') continue;
        if (valueFits(field, val)) hits[field] += 1;
      }
      if (fitsSectionValue(val)) hits.section += 1;
    }

    // Seats (30, 25) match the section pattern. Drop them when the column is large and varied.
    if (isLargeVariedNumberColumn(seen)) hits.section = 0;
    if (isSeatsColumn(seen)) hits.courseNum = 0;

    for (const field of DETECT_FIELDS) {
      if (header[field] < 8) continue;
      if (nonempty > 0 && hits[field] / nonempty < 0.5) header[field] = 0;
    }

    const data = blankFieldScores();
    for (const field of DETECT_FIELDS) {
      data[field] = (hits[field] / totalSampleRows) * DATA_WEIGHT[field];
    }

    return { colKey: col.key, index: col.index, data, header };
  });

  const assigned = new Set<string>();

  // Validated headers win before sample guesses, in the school column order.
  const headerFields: DetectField[] = [
    'subject',
    'courseNum',
    'section',
    'credits',
    'room',
    'instructor',
    'days',
    'startTime',
    'endTime',
    'schedule',
    'time',
    'name',
    'code',
  ];
  for (const field of headerFields) {
    const best = scores
      .filter((score) => !assigned.has(score.colKey) && score.header[field] >= 8)
      .sort((a, b) => b.header[field] - a.header[field] || a.index - b.index)[0];
    if (best) {
      mapping[field] = best.colKey;
      assigned.add(best.colKey);
    }
  }

  // Days outrank subject on a tie so MW/TR is not read as a department.
  const dataPriority: DetectField[] = [
    'days',
    'schedule',
    'time',
    'startTime',
    'endTime',
    'code',
    'courseNum',
    'name',
    'instructor',
    'credits',
    'room',
    'section',
    'subject',
  ];
  const candidates: { field: DetectField; colKey: string; score: number; index: number; priority: number }[] = [];
  for (const score of scores) {
    dataPriority.forEach((field, priority) => {
      if (score.data[field] >= 1.5) {
        candidates.push({
          field,
          colKey: score.colKey,
          score: score.data[field],
          index: score.index,
          priority,
        });
      }
    });
  }
  candidates.sort((a, b) => b.score - a.score || a.priority - b.priority || a.index - b.index);

  const fieldTaken = new Set<DetectField>(
    DETECT_FIELDS.filter((field) => mapping[field] !== '')
  );
  for (const candidate of candidates) {
    if (fieldTaken.has(candidate.field) || assigned.has(candidate.colKey)) continue;
    if (candidate.field === 'subject' && mapping.code && candidate.score < 5) continue;
    mapping[candidate.field] = candidate.colKey;
    assigned.add(candidate.colKey);
    fieldTaken.add(candidate.field);
  }

  if (!mapping.code && !mapping.subject && columns.length > 0) {
    const unassigned = columns.find((col) => !assigned.has(col.key) && col.samples.length > 0);
    if (unassigned) {
      mapping.code = unassigned.key;
      assigned.add(unassigned.key);
    }
  }

  if (!mapping.name && columns.length > 1) {
    const unassigned = columns.find((col) => !assigned.has(col.key) && col.samples.length > 0);
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
  const issues: ImportRowIssue[] = [];
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
    const safeTag = (code || name || `item_${r}`).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    const courseId = prefixedId(`c_${safeTag}`);
    const label = code || name || `Row ${r + 1}`;
    const resolved = resolveRowMeetings(row, mapping, getCell);
    const rowSessions: ClassSession[] = resolved.meetings.map((meeting, sIdx) => ({
      id: `s_${courseId}_${sIdx}`,
      day: meeting.day,
      startTime: meeting.start,
      endTime: meeting.end,
      room: room || undefined,
    }));
    let rowIssue: ImportRowIssue | undefined;

    if (resolved.problem) {
      const message = `Row ${r + 1}: "${label}" ${resolved.problem}`;
      warnings.push(message);
      rowIssue = { courseId, message: resolved.problem, blocking: true };
    } else if (rowSessions.length === 0 && resolved.online) {
      warnings.push(`Row ${r + 1}: "${label}" marked as Online / Asynchronous (no calendar meetings assigned)`);
    }

    const readCredits = interpretCredits(creditsStr);
    const credits = readCredits.credits;
    if (readCredits.unrealistic) {
      const message = `Unusual credit value ${readCredits.credits}`;
      warnings.push(`Row ${r + 1}: "${label}" has an ${message.charAt(0).toLowerCase()}${message.slice(1)}`);
      if (!rowIssue) rowIssue = { courseId, message, blocking: false };
    }

    const colorIdx = (startColorIndex + courses.length) % COURSE_COLORS.length;
    const color = COURSE_COLORS[colorIdx];

    const finalCode = code
      ? code.replace(/\s+/g, ' ').toUpperCase()
      : (name ? name.slice(0, 10).toUpperCase() : 'COURSE');
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

    if (rowIssue) issues.push(rowIssue);
    courses.push(course);
  }

  return {
    success: courses.length > 0,
    courses,
    totalRows: rawRows.length - dataStartRow,
    skippedRows,
    warnings,
    issues,
  };
}

interface ResolvedMeeting {
  day: DayOfWeek;
  start: string;
  end: string;
}

function clockFromParts(parsed: { h: number; m: number } | null): string | null {
  if (!parsed) return null;
  if (parsed.h < 0 || parsed.h > 23 || parsed.m < 0 || parsed.m > 59) return null;
  return `${String(parsed.h).padStart(2, '0')}:${String(parsed.m).padStart(2, '0')}`;
}

function combineStartAndEnd(startRaw: string, endRaw: string): { start: string; end: string } | null {
  if (!startRaw || !endRaw) return null;
  let parsedStart = parseCellTime(startRaw);
  let parsedEnd = parseCellTime(endRaw);
  if (!parsedStart || !parsedEnd) return null;
  const startExplicit = explicitMeridian(startRaw) !== null;
  const endExplicit = explicitMeridian(endRaw) !== null;
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
  const start = clockFromParts(parsedStart);
  const end = clockFromParts(parsedEnd);
  if (!start || !end || timeToMinutes(start) >= timeToMinutes(end)) return null;
  return { start, end };
}

function looksLikeClock(raw: string): boolean {
  return /\d{1,2}\s*:\s*\d{2}/.test(raw) || /\b\d{3,4}\s*[-–/]\s*\d{3,4}\b/.test(raw);
}

/**
 * Days and times stay in their own columns. A time-only schedule cell must not
 * invent Monday, and a missing or impossible clock must not become 09:00-10:15.
 */
function resolveRowMeetings(
  row: (string | number | undefined)[],
  mapping: ColumnMapping,
  getCell: (row: (string | number | undefined)[], colKey: string | undefined) => string
): { meetings: ResolvedMeeting[]; problem?: string; online?: boolean } {
  const daysRaw = mapping.days ? getCell(row, mapping.days) : '';
  const timeRaw = mapping.time ? getCell(row, mapping.time) : '';
  const startRaw = mapping.startTime ? getCell(row, mapping.startTime) : '';
  const endRaw = mapping.endTime ? getCell(row, mapping.endTime) : '';
  const scheduleRaw = mapping.schedule ? getCell(row, mapping.schedule) : '';
  const explicitDays = daysRaw ? extractDays(daysRaw) : [];

  const pushDays = (days: DayOfWeek[], start: string, end: string, into: ResolvedMeeting[]) => {
    for (const day of days) into.push({ day, start, end });
  };

  if (timeRaw || startRaw || endRaw) {
    let range: { start: string; end: string } | null = null;
    if (timeRaw) range = extractTimeRange(timeRaw);
    else range = combineStartAndEnd(startRaw, endRaw);
    const days = explicitDays.length > 0 ? explicitDays : extractDays(timeRaw);
    if (!range) {
      const shown = timeRaw || `${startRaw}-${endRaw}`;
      return { meetings: [], problem: `has an invalid time (${shown})` };
    }
    if (days.length === 0) {
      return { meetings: [], problem: 'is missing days' };
    }
    const meetings: ResolvedMeeting[] = [];
    pushDays(days, range.start, range.end, meetings);
    return { meetings };
  }

  if (scheduleRaw) {
    if (isOnlineOrTBA(scheduleRaw) && !looksLikeClock(scheduleRaw)) {
      return { meetings: [], online: true };
    }
    const segments = scheduleRaw.split(/[;\n|]+|\s*\/\/\s*/).map((part) => part.trim()).filter(Boolean);
    const meetings: ResolvedMeeting[] = [];
    for (const segment of segments) {
      const parsed = parseScheduleString(segment);
      const days = parsed && parsed.days.length > 0 ? parsed.days : explicitDays;
      if (!parsed || !parsed.startTime || !parsed.endTime) {
        if (looksLikeClock(segment) || explicitDays.length > 0 || (parsed && parsed.days.length > 0)) {
          return { meetings: [], problem: `has an invalid time (${segment})` };
        }
        continue;
      }
      if (days.length === 0) {
        return { meetings: [], problem: 'is missing days' };
      }
      pushDays(days, parsed.startTime, parsed.endTime, meetings);
    }
    if (meetings.length > 0) return { meetings };
    if (explicitDays.length > 0) return { meetings: [], problem: 'is missing a class time' };
    return { meetings: [], problem: `has an unparseable schedule "${scheduleRaw}"` };
  }

  if (explicitDays.length > 0) {
    return { meetings: [], problem: 'is missing a class time' };
  }

  return { meetings: [] };
}

export interface DelimitedTable extends TabularAnalysis {
  sis: boolean;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** School SIS rows: term, code, section, title, instructor, room, days+time. Later columns are ignored. */
export function looksLikeSisRow(cols: string[]): boolean {
  if (cols.length < 7) return false;
  const term = cols[0].trim();
  const code = cols[1].trim();
  const section = cols[2].trim();
  const when = cols[6].trim();
  if (!/^(?:fall|spring|summer|winter|autumn)\s+\d{4}$/i.test(term)) return false;
  if (!/^[A-Za-z]{2,6}\s+\d{2,4}[A-Za-z]?$/.test(code)) return false;
  if (!/^[0-9A-Za-z]{1,4}$/.test(section)) return false;
  if (!/\d{1,2}\s*:\s*\d{2}/.test(when)) return false;
  return extractDays(when).length > 0;
}

/**
 * Split a paste on tabs or commas. Returns null when the text is not a table,
 * so freeform course lines stay on the line parser.
 */
export function parseDelimitedText(text: string): DelimitedTable | null {
  if (!text || !text.trim()) return null;
  const nonEmpty = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());
  if (nonEmpty.length === 0) return null;

  const tabLines = nonEmpty.filter((line) => line.includes('\t'));
  let rows: string[][] | null = null;
  if (tabLines.length / nonEmpty.length >= 0.8 && tabLines.some((line) => line.split('\t').length >= 2)) {
    rows = nonEmpty.map((line) => line.split('\t').map((cell) => cell.trim()));
  } else if (tabLines.length === 0) {
    const csvRows = nonEmpty.map(splitCsvLine);
    const width = csvRows[0]?.length ?? 0;
    if (width >= 2 && csvRows.every((row) => row.length === width)) rows = csvRows;
  }
  if (!rows) return null;

  const sisHits = rows.filter(looksLikeSisRow).length;
  const sis = sisHits >= Math.max(1, Math.ceil(rows.length * 0.6));
  const limited = sis ? rows.map((row) => row.slice(0, 7)) : rows;
  const analyzed = analyzeTabularRows(limited);
  if (sis) {
    analyzed.detectedMapping = {
      ...getEmptyMapping(),
      code: 'col_1',
      section: 'col_2',
      name: 'col_3',
      instructor: 'col_4',
      room: 'col_5',
      schedule: 'col_6',
    };
  }
  return { ...analyzed, sis };
}
