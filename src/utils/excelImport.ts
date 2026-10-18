import type { WorkBook, WorkSheet } from 'xlsx';
import { Course, ClassSession, DayOfWeek, COURSE_COLORS } from '../types/schedule';
import { prefixedId } from './id';
import { parseTimeRange, parseSingleTimeToken, normalizeDays, explicitMeridian, interpretCredits } from './textParser';
import { timeToMinutes } from './timeUtils';

type XlsxModule = typeof import('xlsx');

export type ExcelWorkbook = WorkBook;

let xlsxModule: XlsxModule | null = null;
let xlsxLoading: Promise<XlsxModule> | null = null;
let xlsxAttempt = 0;
let xlsxFailedUrl: string | undefined;

function moduleUrlFromError(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/https?:\/\/\S+/);
  if (!match) return undefined;
  try {
    const url = new URL(match[0].replace(/[),.;]+$/, ''));
    url.searchParams.delete('retry');
    return url.href;
  } catch {
    return undefined;
  }
}

function importXlsxRetried(failedUrl: string, attempt: number): Promise<XlsxModule> {
  const parsed = new URL(failedUrl);
  parsed.searchParams.set('retry', String(attempt));
  const pending = import(/* @vite-ignore */ parsed.href) as Promise<XlsxModule>;
  void pending.catch(() => {});
  return pending;
}

/** Loads SheetJS the first time a workbook is read or written. */
export function loadXlsx(): Promise<XlsxModule> {
  if (xlsxModule) return Promise.resolve(xlsxModule);
  if (!xlsxLoading) {
    const source =
      xlsxAttempt > 0 && xlsxFailedUrl
        ? importXlsxRetried(xlsxFailedUrl, xlsxAttempt)
        : import('xlsx');
    const next = source
      .then((mod) => {
        xlsxModule = mod;
        return mod;
      })
      .catch((error: unknown) => {
        const url = moduleUrlFromError(error);
        if (url) xlsxFailedUrl = url;
        xlsxAttempt += 1;
        if (xlsxLoading === next) xlsxLoading = null;
        throw error;
      });
    xlsxLoading = next;
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

  // Excel day-fractions: 0.375 is 09:00. "9.00-10.15" is a clock, not a fraction.
  const fractionMatch = cleanStr.match(/(\d*\.\d+)\s*-\s*(\d*\.\d+)/);
  if (fractionMatch) {
    const startFrac = Number(fractionMatch[1]);
    const endFrac = Number(fractionMatch[2]);
    if (startFrac >= 0 && startFrac < 1 && endFrac >= 0 && endFrac < 1) {
      const start = excelSerialToTime(startFrac);
      const end = excelSerialToTime(endFrac);
      if (start && end && timeToMinutes(start) < timeToMinutes(end)) return { start, end };
    }
  }

  // 4-digit military ranges before the short clock pattern. Otherwise "0900-1015"
  // is read as 09:00-10:00 because "10" matches an hour and "15" is left over.
  const militaryMatch = cleanStr.match(/\b([012]\d[0-5]\d)\s*[-/]\s*([012]\d[0-5]\d)\b/);
  if (militaryMatch) {
    const start = `${militaryMatch[1].slice(0, 2)}:${militaryMatch[1].slice(2, 4)}`;
    const end = `${militaryMatch[2].slice(0, 2)}:${militaryMatch[2].slice(2, 4)}`;
    if (timeToMinutes(start) < timeToMinutes(end)) return { start, end };
  }

  // "08:30AM - 10:00AM", "9:00-10:15", "9am - 10:15am", "13:30-15:00"
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

const HEADER_KEYWORD_SET = new Set([
  'course', 'code', 'subject', 'subj', 'title', 'name', 'section', 'sec', 'sect',
  'instructor', 'professor', 'prof', 'faculty', 'day', 'days', 'time', 'times',
  'start', 'end', 'room', 'bldg', 'classroom', 'location', 'credit', 'credits', 'unit', 'units',
  'schedule', 'crn', 'catalog', 'crse', 'descr', 'nbr', 'dept', 'meeting', 'date', 'hrs', 'hr',
]);

function headerCellHit(cell: unknown): boolean {
  const rawText = sanitizeString(cell).toLowerCase().trim();
  if (!rawText || rawText.length > 32) return false;
  const words = rawText.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length === 0 || words.length > 5) return false;
  return words.some((word) => HEADER_KEYWORD_SET.has(word));
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
  let headerRowScore = 1;
  const headerScanEnd = Math.min(trimmedRows.length, 12);
  for (let r = 0; r < headerScanEnd; r++) {
    const row = trimmedRows[r];
    if (!row) continue;
    let matchCount = 0;
    for (const cell of row) {
      if (headerCellHit(cell)) matchCount++;
    }
    if (matchCount > headerRowScore) {
      headerRowScore = matchCount;
      headerRowIndex = r;
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

export interface ExcelMappingField {
  field: keyof ColumnMapping;
  label: string;
  required: boolean;
  hint: string;
}

/** Fields shown on the Excel column-mapping screen, including separate start and end times. */
export const EXCEL_MAPPING_FIELDS: ExcelMappingField[] = [
  { field: 'code', label: 'Course Code / ID', required: true, hint: 'e.g. ICT 304, CS 101' },
  { field: 'subject', label: 'Subject / Dept (Optional)', required: false, hint: 'e.g. CS, MATH, BIO' },
  { field: 'courseNum', label: 'Course # (Optional)', required: false, hint: 'e.g. 101, 2040, 380' },
  { field: 'name', label: 'Course Name / Title', required: true, hint: 'e.g. Mobile App Dev' },
  { field: 'schedule', label: 'Schedule (Days & Times)', required: false, hint: 'e.g. (H) 01:45PM - 03:15PM TTH' },
  { field: 'days', label: 'Days (Separate)', required: false, hint: 'e.g. MWF, TTH, Mon/Wed' },
  { field: 'time', label: 'Time Range (Separate)', required: false, hint: 'e.g. 08:30AM - 10:00AM' },
  { field: 'startTime', label: 'Start Time', required: false, hint: 'e.g. 09:00 AM' },
  { field: 'endTime', label: 'End Time', required: false, hint: 'e.g. 10:15 AM' },
  { field: 'section', label: 'Section', required: false, hint: 'e.g. 001, 101, A' },
  { field: 'instructor', label: 'Professor / Instructor', required: false, hint: 'e.g. Kabin Antony' },
  { field: 'credits', label: 'Credits', required: false, hint: 'e.g. 3, 4' },
  { field: 'room', label: 'Room / Location', required: false, hint: 'e.g. TBD, Hall 101' },
];

/**
 * A hand-picked Schedule or Time column owns the meeting.
 * Clear Start and End so a leftover pair cannot override that choice.
 */
export function applyManualColumnMapping(
  mapping: ColumnMapping,
  field: keyof ColumnMapping,
  colKey: string,
): ColumnMapping {
  const next: ColumnMapping = { ...mapping, [field]: colKey };
  if ((field === 'schedule' || field === 'time') && colKey) {
    next.startTime = '';
    next.endTime = '';
  }
  return next;
}

type DetectField =
  | 'code'
  | 'subject'
  | 'courseNum'
  | 'name'
  | 'section'
  | 'schedule'
  | 'days'
  | 'time'
  | 'startTime'
  | 'endTime'
  | 'instructor'
  | 'credits'
  | 'room';

const DETECT_FIELDS: DetectField[] = [
  'code', 'subject', 'courseNum', 'name', 'section', 'schedule', 'days', 'time',
  'startTime', 'endTime', 'instructor', 'credits', 'room',
];

/** Header labels lock a column before sample scores. Same order the school SIS sheet already relies on. */
const HEADER_FIELD_ORDER: DetectField[] = [
  'subject', 'courseNum', 'section', 'credits', 'room', 'instructor',
  'days', 'startTime', 'endTime', 'schedule', 'time', 'name', 'code',
];

/** Days before subject, and a higher sample score wins when one column fits two fields. */
const DATA_FIELD_ORDER: DetectField[] = [
  'days', 'schedule', 'time', 'startTime', 'endTime',
  'code', 'name', 'section', 'instructor', 'credits', 'room',
  'courseNum', 'subject',
];

const DATA_SCORE_WEIGHT = 8;
const DATA_SCORE_THRESHOLD = 1.5;

const CODE_VALUE_RE = /^[A-Za-z]{2,6}\s+\d{2,4}[A-Za-z]{0,3}(?:\s*\([^)]{1,16}\))?$/;
const LOOSE_CODE_RE = /^[A-Za-z]{2,5}\s+\d{2,4}\b/;
const TERM_VALUE_RE = /^(?:fall|spring|summer|winter|autumn)\s+\d{4}$/i;
const ROOM_WORD_RE = /^(?:hall|room|rm|lab|bldg|building|aud|auditorium|online|tba|tbd|classroom|studio)$/i;
const ROOM_VALUE_RE = /^(?:(?:room|rm\.?|hall|bldg|building|lab|auditorium|aud|studio|classroom)\b.*|[A-Za-z]{1,3}\s*-?\s*\d{1,4}[A-Za-z]?)$/i;
const DATE_VALUE_RE = /^(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:,?\s+\d{4})?|\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?,?\s+\d{4})$/i;
const CLOCK_FIND_RE = /(?<!\d)(?:[01]\d|2[0-3])[0-5]\d(?!\d)|\b\d{1,2}[:.]\d{2}\s*(?:a\.?m\.?|p\.?m\.?)?|\b\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?)\b/gi;
const DAY_IN_TEXT_RE = /\b(?:m-f|m-th|mon-fri|mon-thu|monday-friday|mwf|tth|tuth|mtwrf|mtwr|mw|tr|wf|mf|tf|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues|tue|wed|thurs|thur|thu|fri|sat|sun|mo|tu|we|th|fr|sa|su|[mtwrfsu])\b/i;
const NEUTRAL_VALUE_RE = /^(?:online|async|asynchronous|remote|virtual|web|hybrid|flexible|flex|distance|arranged|arr|tba|tbd|tbc|staff|n\/a|na)(?:\s+\S+)?$/i;
const NAME_WORD_RE = /^[A-Za-z][A-Za-z.'-]{1,20}$/;

const DAY_TOKEN_SET = new Set([
  'm', 't', 'w', 'r', 'f', 's', 'u',
  'mo', 'tu', 'we', 'th', 'fr', 'sa', 'su',
  'mon', 'tue', 'tues', 'wed', 'thu', 'thur', 'thurs', 'fri', 'sat', 'sun',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'mw', 'mwf', 'tr', 'tth', 'tuth', 'wf', 'mf', 'tf', 'mt', 'wr', 'rf', 'mr', 'fs', 'tw',
  'mtw', 'mtwr', 'mtwrf', 'mtwthf', 'tthf', 'trf',
  'm-f', 'm-th', 'mon-fri', 'mon-thu', 'monday-friday', 'daily',
]);

const SINGLE_TITLE_WORDS = new Set([
  'intro', 'introduction', 'studio', 'survey', 'seminar', 'lab', 'lecture', 'calculus',
  'biology', 'chemistry', 'physics', 'writing', 'composition', 'design', 'painting',
  'drawing', 'choir', 'band', 'thesis', 'capstone', 'practicum', 'internship',
  'workshop', 'recitation', 'algebra', 'systems', 'accounting', 'management', 'audit',
  'marketing', 'methods', 'essentials', 'programming', 'networks', 'finance',
]);

const NOT_SUBJECT = new Set([
  'TBA', 'TBD', 'TBC', 'LAB', 'SEC', 'AM', 'PM', 'ONLINE', 'OPEN', 'CLOSED',
  'ROOM', 'HALL', 'STAFF', 'NOTE', 'NOTES', 'CRN', 'NA', 'FULL', 'WAIT',
]);

interface CellProfile {
  code: number;
  subject: number;
  courseNum: number;
  title: number;
  section: number;
  schedule: number;
  days: number;
  time: number;
  start: number;
  end: number;
  instructor: number;
  credits: number;
  room: number;
  date: number;
  term: number;
  crn: number;
  seats: number;
  serial: number;
  neutral: number;
}

function emptyProfile(): CellProfile {
  return {
    code: 0, subject: 0, courseNum: 0, title: 0, section: 0,
    schedule: 0, days: 0, time: 0, start: 0, end: 0,
    instructor: 0, credits: 0, room: 0,
    date: 0, term: 0, crn: 0, seats: 0, serial: 0, neutral: 0,
  };
}

const EMPTY_PROFILE: CellProfile = emptyProfile();

function normalizeHeader(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/#/g, ' num ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeDayCell(text: string): boolean {
  if (!text || text.length > 40 || /\d/.test(text)) return false;
  const lower = text.toLowerCase();
  if (DAY_TOKEN_SET.has(lower)) return true;
  const parts = lower
    .replace(/\b(?:and|to)\b/g, ' ')
    .split(/[^a-z]+/)
    .filter(Boolean);
  return parts.length >= 2 && parts.length <= 7 && parts.every((part) => DAY_TOKEN_SET.has(part));
}

function clockCount(text: string): number {
  CLOCK_FIND_RE.lastIndex = 0;
  const found = text.match(CLOCK_FIND_RE);
  CLOCK_FIND_RE.lastIndex = 0;
  return found ? found.length : 0;
}

function hasRangeSeparator(text: string): boolean {
  return /-|to\b/i.test(text);
}

function isExcelSerial(text: string): boolean {
  if (!/^\d{5}$/.test(text)) return false;
  const value = Number(text);
  return value >= 30000 && value <= 80000;
}

function classifyText(text: string): CellProfile {
  if (!text) return EMPTY_PROFILE;
  if (NEUTRAL_VALUE_RE.test(text)) {
    const neutral = emptyProfile();
    neutral.neutral = 1;
    neutral.instructor = 0.2;
    neutral.room = 0.15;
    return neutral;
  }
  if (text.length > 96) {
    const long = emptyProfile();
    if (text.includes(' ') && !DATE_VALUE_RE.test(text) && !TERM_VALUE_RE.test(text)) long.title = 1;
    return long;
  }
  if (TERM_VALUE_RE.test(text)) {
    const term = emptyProfile();
    term.term = 1;
    return term;
  }
  if (DATE_VALUE_RE.test(text)) {
    const date = emptyProfile();
    date.date = 1;
    return date;
  }
  if (isExcelSerial(text)) {
    const serial = emptyProfile();
    serial.serial = 1;
    serial.date = 1;
    return serial;
  }

  const made = emptyProfile();
  if (/^0\d{1,3}[A-Za-z]?$/.test(text)) {
    made.section = 1;
    return made;
  }
  if (/^(?:[01]\d|2[0-3])[0-5]\d$/.test(text)) {
    made.time = 1;
    made.start = 0.5;
    made.end = 0.5;
    return made;
  }
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    if (numeric >= 0 && numeric < 1) {
      const decimals = text.split('.')[1]?.length ?? 0;
      const halfStepCredit = decimals <= 2 && (numeric === 0.5 || numeric === 0.25 || numeric === 0.75);
      if (!halfStepCredit) {
        made.time = 1;
        made.start = 0.5;
        made.end = 0.5;
        return made;
      }
    }
    if (/^\d{4,6}$/.test(text)) {
      made.crn = 1;
      return made;
    }
    if (numeric >= 0.5 && numeric <= 8) made.credits = 1;
    if (Number.isInteger(numeric) && numeric >= 15 && numeric < 100) made.seats = 1;
    if (/^(?!0)\d{2,4}[A-Za-z]{0,2}$/.test(text) && (numeric >= 100 || /[A-Za-z]$/.test(text))) {
      made.courseNum = 1;
    }
    return made;
  }

  if (/^(?!0)\d{2,4}[A-Za-z]{1,2}$/.test(text)) {
    made.courseNum = 1;
    return made;
  }

  if (looksLikeDayCell(text)) {
    made.days = 1;
    return made;
  }

  const fractionRange = text.match(/(\d*\.\d+)\s*-\s*(\d*\.\d+)/);
  let timeKind: 'range' | 'single' | null = null;
  if (fractionRange) {
    const startFrac = Number(fractionRange[1]);
    const endFrac = Number(fractionRange[2]);
    if (startFrac >= 0 && startFrac < 1 && endFrac >= 0 && endFrac < 1) timeKind = 'range';
  }
  if (!timeKind) {
    const clocks = clockCount(text);
    if (clocks >= 2 && hasRangeSeparator(text)) timeKind = 'range';
    else if (clocks === 1) timeKind = 'single';
  }
  const dayInText = DAY_IN_TEXT_RE.test(text);
  if (timeKind === 'range' && dayInText) {
    made.schedule = 1;
    return made;
  }
  if (timeKind === 'range') {
    made.time = 1;
    return made;
  }
  if (timeKind === 'single') {
    made.start = 0.5;
    made.end = 0.5;
    made.time = 0.25;
  }

  const codePrefix = text.match(/^([A-Za-z]{2,6})\b/)?.[1] || '';
  const roomWord = ROOM_WORD_RE.test(codePrefix);
  if (!roomWord && !timeKind && CODE_VALUE_RE.test(text)) made.code = 1;
  else if (!roomWord && !timeKind && LOOSE_CODE_RE.test(text) && !TERM_VALUE_RE.test(text)) made.code = 0.8;

  if (
    /^[A-Za-z]{2,5}$/.test(text) &&
    text === text.toUpperCase() &&
    !DAY_TOKEN_SET.has(text.toLowerCase()) &&
    !NOT_SUBJECT.has(text.toUpperCase()) &&
    !SINGLE_TITLE_WORDS.has(text.toLowerCase())
  ) {
    made.subject = 1;
  }

  if (ROOM_VALUE_RE.test(text)) made.room = 1;

  const nameParts = text.split(/\s+/);
  let blockTitle = false;
  if (nameParts.length === 1 && /^[A-Z][a-z]{2,19}$/.test(text) && !DAY_TOKEN_SET.has(text.toLowerCase())) {
    if (!SINGLE_TITLE_WORDS.has(text.toLowerCase()) && !NOT_SUBJECT.has(text.toUpperCase())) {
      made.instructor = 0.9;
      blockTitle = true;
    }
  } else if (
    nameParts.length === 2 &&
    NAME_WORD_RE.test(nameParts[0]) &&
    NAME_WORD_RE.test(nameParts[1])
  ) {
    const secondAllCaps = nameParts[1] === nameParts[1].toUpperCase() && nameParts[1].length >= 2;
    if (/^[A-Z][a-z]/.test(nameParts[0]) && secondAllCaps) {
      made.instructor = 1;
      blockTitle = true;
    } else if (/^[A-Z][a-z]+$/.test(nameParts[0]) && /^[A-Z][a-z]+$/.test(nameParts[1])) {
      made.instructor = 0.35;
    }
  } else if (nameParts.length === 3 && nameParts.every((part) => NAME_WORD_RE.test(part))) {
    made.instructor = 0.55;
  }

  if (!blockTitle && made.code === 0 && made.room === 0 && made.schedule === 0 && made.days === 0 && !timeKind) {
    if (SINGLE_TITLE_WORDS.has(text.toLowerCase())) made.title = 1;
    else if (text.includes(' ') && text.length >= 5) made.title = 1;
  }
  const signal = made.code + made.subject + made.courseNum + made.title + made.section +
    made.schedule + made.days + made.time + made.start + made.end + made.instructor +
    made.credits + made.room + made.date + made.term + made.crn + made.seats + made.serial +
    made.neutral;
  return signal > 0 ? made : EMPTY_PROFILE;
}

function profileFor(raw: unknown, cache: Map<string, CellProfile>): CellProfile {
  if (raw === null || raw === undefined || raw === '') return EMPTY_PROFILE;
  const key = typeof raw === 'number' ? String(raw) : String(raw);
  const cached = cache.get(key);
  if (cached) return cached;
  const text = sanitizeString(key, 200);
  const profile = text ? classifyText(text) : EMPTY_PROFILE;
  cache.set(key, profile);
  return profile;
}

interface ColumnStat {
  key: string;
  index: number;
  header: Record<DetectField, number>;
  sum: Record<DetectField, number>;
  data: Record<DetectField, number>;
  nonEmpty: number;
  date: number;
  term: number;
  crn: number;
  seats: number;
  serial: number;
  seatsHeader: boolean;
  crnHeader: boolean;
  termHeader: boolean;
  dateHeader: boolean;
  samples: number;
}

function zeroFieldScores(): Record<DetectField, number> {
  return {
    code: 0, subject: 0, courseNum: 0, name: 0, section: 0,
    schedule: 0, days: 0, time: 0, startTime: 0, endTime: 0,
    instructor: 0, credits: 0, room: 0,
  };
}

function headerScores(headerText: string): {
  scores: Record<DetectField, number>;
  seatsHeader: boolean;
  crnHeader: boolean;
  termHeader: boolean;
  dateHeader: boolean;
} {
  const scores = zeroFieldScores();
  const h = normalizeHeader(headerText);
  const seatsHeader = /\b(?:seats?|enrollment|enrolled|capacity)\b/.test(h);
  const crnHeader = /\bcrn\b/.test(h) || /\bcourse reference\b/.test(h);
  const termHeader = /\b(?:term|semester|session)\b/.test(h);
  const dateHeader = /\b(?:date|due)\b/.test(h);

  if (/\b(?:acad dept|academic department|subject|subj|department|dept)\b/.test(h)) scores.subject = 14;

  if (/\b(?:crse|course num|course no|course number|catalog num|cat num|catalog nbr|catalog number)\b/.test(h)) {
    scores.courseNum = 14;
  } else if (/\b(?:number|num|nbr)\b/.test(h) && !/\b(?:section|sec|phone|room|bldg|id|seat|crn)\b/.test(h)) {
    scores.courseNum = 12;
  }

  if (/\b(?:course code|course id|course identifier|subj crse)\b/.test(h)) scores.code = 16;
  else if (/\bcode\b/.test(h)) scores.code = 8;
  else if (/^courses?$/.test(h)) scores.code = 8;

  if (/\b(?:course title|course name|subject title|course desc|description|descr|long title)\b/.test(h)) {
    scores.name = 16;
  } else if (/\b(?:title|name)\b/.test(h) && !/\b(?:instructor|prof|teacher|faculty|user|file)\b/.test(h)) {
    scores.name = 8;
  }

  if (/\b(?:section|sect|sec|class sec|section num|sec num|sec no)\b/.test(h) && !seatsHeader) scores.section = 16;

  if (
    /\b(?:schedule|meeting pattern|class schedule|meeting info)\b/.test(h) ||
    (/\bdays?\b/.test(h) && /\btimes?\b/.test(h))
  ) {
    scores.schedule = 16;
  } else if (/\btimes?\b/.test(h) && !/\b(?:start|end|begin|finish|due|date)\b/.test(h)) {
    scores.schedule = 10;
    scores.time = 10;
  }

  if (/\b(?:meeting days?|class days?|mtg days?)\b/.test(h)) scores.days = 14;
  else if (/\bdays?\b/.test(h) && !/\btimes?\b/.test(h)) scores.days = 8;

  if (/\b(?:start time|begin time|start|begin|from)\b/.test(h) && !dateHeader) scores.startTime = 14;
  if (/\b(?:end time|finish time|end|finish|to)\b/.test(h) && !dateHeader) scores.endTime = 14;

  if (/\b(?:faculty|instructor|professor|teacher|prof|lecturer|primary instructor)\b/.test(h)) {
    scores.instructor = 16;
  } else if (/\bstaff\b/.test(h)) scores.instructor = 6;

  if (/\b(?:credit hours?|credit hrs?|credits?|units?|credit units?|hrs?|cr)\b/.test(h)) scores.credits = 16;
  if (/\b(?:classroom|room|location|bldg|building|facility|hall|venue)\b/.test(h)) scores.room = 16;

  if (crnHeader || termHeader) scores.code = 0;
  if (seatsHeader) scores.section = 0;
  if (dateHeader) {
    scores.name = 0;
    scores.startTime = 0;
    scores.endTime = 0;
    scores.time = 0;
    scores.schedule = 0;
  }
  return { scores, seatsHeader, crnHeader, termHeader, dateHeader };
}

function share(count: number, total: number): number {
  if (total <= 0) return 0;
  return count / total;
}

/**
 * Automatically detects which column corresponds to each course field
 * combining header keyword analysis and content checks across up to 1,000 rows.
 * Each distinct cell value is classified once.
 */
export function autoDetectColumns(
  rawRows: (string | number | undefined)[][],
  dataStartRow: number,
  columns: ColumnOption[]
): ColumnMapping {
  const mapping = getEmptyMapping();
  if (columns.length === 0 || rawRows.length === 0) return mapping;

  const scanEnd = Math.min(rawRows.length, dataStartRow + 1000);
  const cache = new Map<string, CellProfile>();
  const stats: ColumnStat[] = columns.map((col) => {
    const header = headerScores(col.headerText);
    return {
      key: col.key,
      index: col.index,
      header: header.scores,
      sum: zeroFieldScores(),
      data: zeroFieldScores(),
      nonEmpty: 0,
      date: 0,
      term: 0,
      crn: 0,
      seats: 0,
      serial: 0,
      seatsHeader: header.seatsHeader,
      crnHeader: header.crnHeader,
      termHeader: header.termHeader,
      dateHeader: header.dateHeader,
      samples: col.samples.length,
    };
  });

  for (let r = dataStartRow; r < scanEnd; r++) {
    const row = rawRows[r];
    if (!row) continue;
    for (let c = 0; c < stats.length; c++) {
      const stat = stats[c];
      const profile = profileFor(row[stat.index], cache);
      if (profile === EMPTY_PROFILE) continue;
      stat.nonEmpty++;
      stat.sum.code += profile.code;
      stat.sum.subject += profile.subject;
      stat.sum.courseNum += profile.courseNum;
      stat.sum.name += profile.title;
      stat.sum.section += profile.section;
      stat.sum.schedule += profile.schedule;
      stat.sum.days += profile.days;
      stat.sum.time += profile.time;
      stat.sum.startTime += profile.start;
      stat.sum.endTime += profile.end;
      stat.sum.instructor += profile.instructor;
      stat.sum.credits += profile.credits;
      stat.sum.room += profile.room;
      stat.date += profile.date;
      stat.term += profile.term;
      stat.crn += profile.crn;
      stat.seats += profile.seats;
      stat.serial += profile.serial;
    }
  }

  for (const stat of stats) {
    const total = stat.nonEmpty;
    if (stat.seatsHeader || (stat.seats > 0 && stat.seats >= stat.sum.section)) stat.sum.section = 0;
    if (stat.sum.days > 0 && stat.sum.days >= stat.sum.subject) stat.sum.subject = 0;
    const codeBlockers = stat.term + stat.crn + stat.date + stat.serial;
    if (stat.crnHeader || stat.termHeader || (codeBlockers > 0 && codeBlockers >= stat.sum.code)) stat.sum.code = 0;
    if (stat.dateHeader || stat.termHeader || ((stat.date + stat.serial + stat.term) > 0 && stat.date + stat.serial + stat.term >= stat.sum.name)) {
      stat.sum.name = 0;
    }
    if (stat.dateHeader) {
      stat.sum.startTime = 0;
      stat.sum.endTime = 0;
      stat.sum.time = 0;
      stat.sum.schedule = 0;
    }
    if (stat.seatsHeader) {
      stat.sum.credits = 0;
      stat.sum.courseNum = 0;
    }
    for (const field of DETECT_FIELDS) {
      stat.data[field] = share(stat.sum[field], total) * DATA_SCORE_WEIGHT;
    }
  }

  const assigned = new Set<string>();

  const contradicted = (field: DetectField, stat: ColumnStat): boolean => {
    const total = Math.max(stat.nonEmpty, 1);
    if (field === 'code' && (stat.crnHeader || stat.termHeader || stat.dateHeader)) return true;
    if (field === 'name' && (stat.dateHeader || stat.termHeader)) return true;
    if (field === 'section' && stat.seatsHeader) return true;
    if ((field === 'startTime' || field === 'endTime' || field === 'time' || field === 'schedule') && stat.dateHeader) {
      return true;
    }
    if (field === 'code') {
      const bad = (stat.term + stat.crn + stat.date + stat.serial) / total;
      const support = stat.sum.code / total;
      const titles = stat.sum.name / total;
      if (bad >= 0.5 && support < 0.25) return true;
      if (titles >= 0.6 && support < 0.25) return true;
    }
    if (field === 'courseNum') {
      const support = stat.sum.courseNum / total;
      if (support < 0.25 && (stat.sum.subject / total >= 0.5 || stat.sum.code / total >= 0.5)) return true;
    }
    if (field === 'name' && (stat.date + stat.serial) / total >= 0.5) return true;
    if (field === 'section' && stat.seats / total >= 0.5 && stat.sum.section / total < 0.25) return true;
    return false;
  };

  for (const field of HEADER_FIELD_ORDER) {
    let best: ColumnStat | null = null;
    for (const stat of stats) {
      if (assigned.has(stat.key) || stat.header[field] < 8 || contradicted(field, stat)) continue;
      if (!best || stat.header[field] > best.header[field]) best = stat;
    }
    if (best) {
      mapping[field] = best.key;
      assigned.add(best.key);
    }
  }

  const open = new Set<DetectField>(DATA_FIELD_ORDER.filter((field) => !mapping[field]));
  while (open.size > 0) {
    let best: { field: DetectField; stat: ColumnStat; score: number; fieldIndex: number } | null = null;
    let fieldIndex = 0;
    for (const field of DATA_FIELD_ORDER) {
      if (!open.has(field)) {
        fieldIndex++;
        continue;
      }
      for (const stat of stats) {
        if (assigned.has(stat.key)) continue;
        const score = stat.data[field];
        if (score < DATA_SCORE_THRESHOLD) continue;
        let dominated = false;
        for (const other of open) {
          if (other !== field && stat.data[other] > score) {
            dominated = true;
            break;
          }
        }
        if (dominated) continue;
        if (
          !best ||
          score > best.score ||
          (score === best.score && fieldIndex < best.fieldIndex)
        ) {
          best = { field, stat, score, fieldIndex };
        }
      }
      fieldIndex++;
    }
    if (!best) break;
    mapping[best.field] = best.stat.key;
    assigned.add(best.stat.key);
    open.delete(best.field);
  }

  const badCode = (stat: ColumnStat): boolean => {
    const total = Math.max(stat.nonEmpty, 1);
    if (stat.crnHeader || stat.termHeader || stat.dateHeader || stat.seatsHeader) return true;
    if ((stat.term + stat.crn + stat.date + stat.serial + stat.seats) / total >= 0.4) return true;
    if (stat.sum.days / total >= 0.5 || stat.sum.schedule / total >= 0.5) return true;
    return false;
  };
  const badName = (stat: ColumnStat): boolean => {
    const total = Math.max(stat.nonEmpty, 1);
    if (stat.dateHeader || stat.termHeader || stat.crnHeader || stat.seatsHeader) return true;
    if ((stat.date + stat.serial + stat.term + stat.crn) / total >= 0.4) return true;
    if (stat.sum.days / total >= 0.5 || stat.sum.time / total >= 0.5 || stat.sum.schedule / total >= 0.5) return true;
    if (stat.sum.instructor > 0 && stat.sum.instructor >= stat.sum.name) return true;
    if (stat.sum.section / total >= 0.5 || stat.sum.credits / total >= 0.5 || stat.sum.room / total >= 0.5) return true;
    if (stat.sum.code / total >= 0.5) return true;
    return false;
  };

  if (!mapping.code && !mapping.subject) {
    const fallback = stats.find((stat) => !assigned.has(stat.key) && stat.samples > 0 && !badCode(stat));
    if (fallback) {
      mapping.code = fallback.key;
      assigned.add(fallback.key);
    }
  }
  if (!mapping.name) {
    const fallback = stats.find((stat) => !assigned.has(stat.key) && stat.samples > 0 && !badName(stat));
    if (fallback) {
      mapping.name = fallback.key;
      assigned.add(fallback.key);
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

    // A note with no code and no title is not a course. Keep it only when the
    // row still has a real meeting, so a footer like "Schedules may change…"
    // does not become a fake "SCHEDULES" section.
    const resolved = resolveRowMeetings(row, mapping, getCell);
    if (!code && !name) {
      const firstText = row.find((c) => sanitizeString(c).length > 0);
      const textVal = firstText ? sanitizeString(firstText) : '';
      const banner = /^(?:total|page\s*\d+|department of|undergraduate|graduate|fall\s*\d+|spring\s*\d+|summer\s*\d+|winter\s*\d+)\b/i.test(textVal);
      if (!textVal || banner || resolved.meetings.length === 0) {
        skippedRows++;
        continue;
      }
      code = textVal.slice(0, 10).toUpperCase();
      name = textVal;
    }

    // Parse Schedule Sessions for current row
    const safeTag = (code || name || `item_${r}`).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    const courseId = prefixedId(`c_${safeTag}`);
    const label = code || name || `Row ${r + 1}`;
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

function commaMeetingParts(raw: string): string[] {
  return raw.split(',').map((part) => part.trim()).filter(Boolean);
}

/** "MW 09:00-10:15, F 11:00-12:00" is two meetings. "Mon, Wed 09:00-10:15" is one. */
function eachPartHasItsOwnTime(raw: string): boolean {
  const parts = commaMeetingParts(raw);
  if (parts.length < 2) return false;
  return parts.every((part) => {
    const parsed = parseScheduleString(part);
    return Boolean(parsed?.startTime && parsed.endTime && parsed.days.length > 0);
  });
}

function splitScheduleSegments(scheduleRaw: string): string[] {
  const rough = scheduleRaw.split(/[;\n|]+|\s*\/\/\s*/).map((part) => part.trim()).filter(Boolean);
  const segments: string[] = [];
  for (const part of rough) {
    if (eachPartHasItsOwnTime(part)) segments.push(...commaMeetingParts(part));
    else segments.push(part);
  }
  return segments;
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

  if (timeRaw) {
    const range = extractTimeRange(timeRaw);
    const days = explicitDays.length > 0 ? explicitDays : extractDays(timeRaw);
    if (!range) {
      return { meetings: [], problem: `has an invalid time (${timeRaw})` };
    }
    if (days.length === 0) {
      return { meetings: [], problem: 'is missing days' };
    }
    const meetings: ResolvedMeeting[] = [];
    pushDays(days, range.start, range.end, meetings);
    return { meetings };
  }

  const startEndRange = startRaw || endRaw ? combineStartAndEnd(startRaw, endRaw) : null;
  if (startEndRange) {
    let days = explicitDays.length > 0 ? explicitDays : extractDays(`${startRaw} ${endRaw}`);
    // Start and End have the clock, but the weekdays may live only in Schedule.
    if (days.length === 0 && !mapping.days && scheduleRaw) days = extractDays(scheduleRaw);
    if (days.length === 0) {
      return { meetings: [], problem: 'is missing days' };
    }
    const meetings: ResolvedMeeting[] = [];
    pushDays(days, startEndRange.start, startEndRange.end, meetings);
    return { meetings };
  }

  // Start/End is missing or unparseable. Use the schedule cell when one is mapped.
  if ((startRaw || endRaw) && !scheduleRaw) {
    return { meetings: [], problem: `has an invalid time (${startRaw}-${endRaw})` };
  }

  if (scheduleRaw) {
    if (isOnlineOrTBA(scheduleRaw) && !looksLikeClock(scheduleRaw)) {
      return { meetings: [], online: true };
    }
    const segments = splitScheduleSegments(scheduleRaw);
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

function splitDelimitedLine(line: string, delimiter: string): string[] {
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
    } else if (ch === delimiter) {
      cells.push(current.trim().replace(/^"(.*)"$/, '$1').trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim().replace(/^"(.*)"$/, '$1').trim());
  return cells;
}

function splitCsvLine(line: string): string[] {
  return splitDelimitedLine(line, ',');
}

const WEEKDAY_NAME = String.raw`mon(?:day)?|tues(?:day)?|tue|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?`;
const DAY_LIST_COMMA = new RegExp(
  `\\b(?:${WEEKDAY_NAME})\\s*,\\s*(?=(?:${WEEKDAY_NAME})\\b)`,
  'gi'
);
const CLOCK_IN_CELL = /\d{1,2}\s*:\s*\d{2}|\b\d{3,4}\s*[-–—]\s*\d{3,4}\b/;

/** "Mon, Wed" is a day list inside one course line, not two spreadsheet cells. */
function hideDayListCommas(line: string): string {
  return line.replace(DAY_LIST_COMMA, (match) => match.replace(',', ' '));
}

/** "9:00-10:00; Fri 11:00-12:00" separates meetings, not columns. */
function hideSessionSemicolons(line: string): string {
  if (!line.includes(';')) return line;
  const parts = splitDelimitedLine(line, ';').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2 || !parts.every((part) => CLOCK_IN_CELL.test(part))) return line;
  return line.replace(/;/g, ' ');
}

function contentWidth(row: string[]): number {
  let width = 0;
  for (let i = 0; i < row.length; i++) {
    if (row[i].trim()) width = i + 1;
  }
  return width;
}

/**
 * A comma or semicolon paste is a table when it has a header or a stable wide grid.
 * A course sentence that merely contains a comma or a second meeting is not.
 */
function delimitedRowsAreTable(rows: string[][]): boolean {
  if (rows.length === 0) return false;
  const widths = rows.map(contentWidth);
  const maxCols = Math.max(...widths, 0);
  const wideEnough = widths.filter((width) => width >= 2).length;
  if (maxCols < 2 || wideEnough / rows.length < 0.7) return false;

  const scan = Math.min(rows.length, 3);
  for (let i = 0; i < scan; i++) {
    const hits = rows[i].filter((cell) => headerCellHit(cell)).length;
    if (hits >= 2) return true;
  }

  const counts = new Map<number, number>();
  for (const width of widths) counts.set(width, (counts.get(width) ?? 0) + 1);
  let mode = 0;
  let modeCount = 0;
  for (const [width, count] of counts) {
    if (count > modeCount || (count === modeCount && width > mode)) {
      mode = width;
      modeCount = count;
    }
  }
  return mode >= 4 && modeCount / rows.length >= 0.7;
}

function padRows(rows: string[][], width: number): string[][] {
  return rows.map((row) => {
    const padded = [...row];
    while (padded.length < width) padded.push('');
    return padded;
  });
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
 * Split a paste on tabs, commas, or semicolons. Returns null when the text is not a table,
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
    rows = nonEmpty.map((line) => line.split('\t').map((cell) => cell.trim().replace(/^"(.*)"$/, '$1').trim()));
  } else if (tabLines.length === 0) {
    const csvRows = nonEmpty.map(hideDayListCommas).map(splitCsvLine);
    if (delimitedRowsAreTable(csvRows)) {
      const original = nonEmpty.map(splitCsvLine);
      rows = padRows(original, Math.max(...original.map((row) => row.length), 0));
    } else {
      // Fallback check for semicolon delimiter (common in European Excel exports)
      const semiRows = nonEmpty.map(hideSessionSemicolons).map((line) => splitDelimitedLine(line, ';'));
      if (delimitedRowsAreTable(semiRows)) {
        const original = nonEmpty.map((line) => splitDelimitedLine(line, ';'));
        rows = padRows(original, Math.max(...original.map((row) => row.length), 0));
      }
    }
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
