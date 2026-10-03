import * as XLSX from 'xlsx';
import { Course, ClassSession, DayOfWeek, COURSE_COLORS } from '../types/schedule';
import { prefixedId } from './id';
import { parseTimeRange, parseSingleTimeToken, normalizeDays } from './textParser';

export interface ColumnOption {
  key: string;         // e.g. "col_0", "col_1"
  index: number;       // 0, 1, 2...
  letter: string;      // "A", "B", "C"...
  headerText: string;  // header label if present
  label: string;       // "Col B (ICT 304...)" or "Col B: Course Code"
  samples: string[];   // preview values
}

export interface ColumnMapping {
  code: string;        // column key e.g. "col_1"
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
 * In Excel: 0.375 = 09:00, 0.5 = 12:00, 0.5625 = 13:30, 0.75 = 18:00
 */
export function excelSerialToTime(val: number): string | null {
  if (isNaN(val)) return null;
  // If date + time (e.g. 44500.375), take only the fractional time component
  let fraction = val - Math.floor(val);
  if (fraction === 0 && val >= 0 && val < 1) fraction = val;
  if (fraction < 0 || fraction >= 1) return null;

  const totalMinutes = Math.round(fraction * 24 * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Extracts a time range { start, end } from any raw string or number.
 */
export function extractTimeRange(raw: unknown): { start: string; end: string } | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    const t = excelSerialToTime(raw);
    if (t) {
      // If only a single time was given, assume 1 hour duration
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

  // 1. Try standard regex time range: e.g. "08:30AM - 10:00AM", "1:45 PM - 3:15 PM", "9:00-10:15", "13:30-15:00"
  const rangeMatch = cleanStr.match(/(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm|a|p)?|\b[012]\d[0-5]\d\b)\s*-\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm|a|p)?|\b[012]\d[0-5]\d\b)/i);
  if (rangeMatch) {
    const parsed = parseTimeRange(`${rangeMatch[1]}-${rangeMatch[2]}`);
    if (parsed) return parsed;
  }

  // 2. Direct fallback using parseTimeRange on the cleaned string
  return parseTimeRange(cleanStr);
}

/**
 * Regex patterns for day tokens: MWF, TTH, TUTH, TR, M, T, W, R, F, Mon, Tue, Wed, Thu, Fri, etc.
 */
const DAY_TOKEN_REGEX = /\b(MWF|TTH|TUTH|MTH|MOTH|WF|MW|TF|TR|TUFR|WEFR|MTWTHF|MTWRF|MON(?:DAY)?|TUE(?:SDAY)?|WED(?:NESDAY)?|THU(?:RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?|TH|SU|M|T|W|R|F|S|U)\b/gi;

/**
 * Extracts DayOfWeek[] from any raw string or array of tokens.
 */
export function extractDays(raw: unknown): DayOfWeek[] {
  if (raw === null || raw === undefined) return [];
  const str = sanitizeString(raw, 100);
  if (!str) return [];

  // Match all day tokens in the string
  const matches = str.match(DAY_TOKEN_REGEX);
  if (matches && matches.length > 0) {
    const normalized = normalizeDays(matches);
    if (normalized.length > 0) return normalized;
  }

  // Fallback: split by commas, slashes, spaces
  const parts = str.split(/[\s,;/&]+/).filter(Boolean);
  if (parts.length > 0) {
    return normalizeDays(parts);
  }

  return [];
}

/**
 * Parses schedule strings that contain both day and time, e.g.:
 * "(H) 01:45PM - 03:15PM TTH"
 * "(E) 03:30PM - 05:00PM MW"
 * "MWF 9:00AM - 10:00AM"
 * "09:00 - 10:15 MWF"
 * "TTH 1:30 - 3:00 PM"
 * "Mon/Wed 8:30-10:00"
 */
export function parseScheduleString(raw: unknown): {
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
} | null {
  if (raw === null || raw === undefined) return null;
  let str = sanitizeString(raw, 100);
  if (!str) return null;

  // 1. Strip cohort or letter prefix in parentheses: e.g. "(H)", "(AA)", "(1)", "(L)"
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

  // If days exist but time range could not be parsed, default to 09:00 - 10:15
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
 * Reads workbook file from ArrayBuffer and inspects sheet structure.
 */
export function readExcelFile(data: ArrayBuffer): {
  workbook: XLSX.WorkBook;
  sheets: string[];
} {
  const workbook = XLSX.read(data, {
    type: 'array',
    cellDates: false,
    raw: false, // Extract formatted strings from cells
  });

  return {
    workbook,
    sheets: workbook.SheetNames,
  };
}

/**
 * Clamps the sheet's !ref range to only rows and columns that contain actual non-empty data.
 * Always sets start cell to A1 (s: { r: 0, c: 0 }) so column indexing remains strictly aligned.
 */
export function clampSheetRange(sheet: XLSX.WorkSheet, maxAllowedCols = 60, maxAllowedRows = 10000): void {
  if (!sheet) return;

  let maxR = -1;
  let maxC = -1;
  let hasCells = false;

  for (const key of Object.keys(sheet)) {
    if (key.charCodeAt(0) === 33) continue; // skip '!ref', '!merges', '!cols', etc.
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
export function loadSheetData(workbook: XLSX.WorkBook, sheetName: string): ExcelWorkbookData {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return {
      sheets: workbook.SheetNames,
      currentSheet: sheetName,
      columns: [],
      rawRows: [],
      dataStartRow: 0,
      detectedMapping: getEmptyMapping(),
    };
  }

  // Pre-clamp range so sheet_to_json does not expand 16,384 empty columns
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
      sheets: workbook.SheetNames,
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

  const sampleScanRows = Math.min(trimmedRows.length, 100);

  // Detect header row index
  let headerRowIndex = -1;
  const HEADER_KEYWORDS = [
    'course', 'code', 'subject', 'subj', 'title', 'name', 'section', 'sec',
    'instructor', 'professor', 'prof', 'faculty', 'day', 'days', 'time', 'times',
    'start', 'end', 'room', 'bldg', 'location', 'credit', 'credits', 'unit', 'units', 'schedule'
  ];

  for (let r = 0; r < Math.min(trimmedRows.length, 6); r++) {
    const row = trimmedRows[r];
    if (!row) continue;
    let matchCount = 0;
    for (const cell of row) {
      const text = sanitizeString(cell).toLowerCase();
      if (HEADER_KEYWORDS.some((kw) => text.includes(kw))) {
        matchCount++;
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
    sheets: workbook.SheetNames,
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

// Regex patterns for course code, section, and schedule detection
const COURSE_CODE_REGEX = /^[A-Za-z]{2,6}\s*[-_.:]?\s*\d{2,4}[A-Za-z]?$/;
const SECTION_REGEX = /^\d{1,4}[A-Za-z]?$|^[A-Za-z]\d{0,2}$/i;

/**
 * Automatically detects which column corresponds to each course field
 * combining header keyword analysis and deep content validation.
 */
export function autoDetectColumns(
  rawRows: (string | number | undefined)[][],
  dataStartRow: number,
  columns: ColumnOption[]
): ColumnMapping {
  const mapping = getEmptyMapping();
  if (columns.length === 0 || rawRows.length === 0) return mapping;

  const scanEnd = Math.min(rawRows.length, dataStartRow + 500);
  const totalSampleRows = Math.max(1, scanEnd - dataStartRow);

  interface FieldScore {
    colKey: string;
    code: number;
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
    const h = col.headerText.toLowerCase();

    // 1. Header keyword weights
    let codeH = 0;
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

    if (/\b(course\s*code|course\s*id|course\s*num|course\s*#|subj|subject|catalog|cat\s*#|crn|class\s*#|course\s*no)\b/i.test(h)) codeH = 10;
    else if (/\b(code)\b/i.test(h)) codeH = 8;

    if (/\b(course\s*title|course\s*name|subject\s*title|course\s*desc|description)\b/i.test(h)) nameH = 10;
    else if (/\b(title|name)\b/i.test(h) && !/\b(instructor|prof|teacher|faculty)\b/i.test(h)) nameH = 7;

    if (/\b(section|sec|sec\s*#|sec\s*no|sect|class\s*sec)\b/i.test(h)) sectionH = 10;

    if (/\b(schedule|day\s*[\/&]\s*time|days\s*[\/&]\s*time|days\s*and\s*times?|meeting\s*pattern|class\s*schedule)\b/i.test(h)) scheduleH = 10;
    else if (/\b(meeting|meeting\s*time)\b/i.test(h)) scheduleH = 8;

    if (/\b(meeting\s*days?|class\s*days?|pattern)\b/i.test(h)) daysH = 10;
    else if (/\b(days?)\b/i.test(h) && !/\btime\b/i.test(h)) daysH = 8;

    if (/\b(class\s*times?|meeting\s*time|time\s*range)\b/i.test(h)) timeH = 10;
    else if (/\b(time|times|hours)\b/i.test(h) && !/\b(start|end|begin|finish|day)\b/i.test(h)) timeH = 8;

    if (/\b(start\s*time|begin\s*time|start|begin|from)\b/i.test(h)) startH = 10;
    if (/\b(end\s*time|finish\s*time|end|finish|to)\b/i.test(h)) endH = 10;

    if (/\b(instructor|professor|faculty|teacher|prof|lecturer|instructor\s*name)\b/i.test(h)) instructorH = 10;
    else if (/\bstaff\b/i.test(h)) instructorH = 6;

    if (/\b(credit\s*hours?|credits?|units?|credit\s*units?|hrs?|cr)\b/i.test(h)) creditsH = 10;

    if (/\b(room|location|bldg|building|facility|classroom|hall|venue)\b/i.test(h)) roomH = 10;

    // 2. Data content analysis
    let codeMatches = 0;
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

      // Course Code e.g. "ICT 304", "COSC 241", "CS 101", "CS101", "BIO-102"
      if (COURSE_CODE_REGEX.test(val)) {
        codeMatches++;
      } else if (/^[A-Za-z]{2,5}\s+\d{2,4}/.test(val)) {
        codeMatches += 0.8;
      }

      // Section e.g. "001", "101", "01", "A"
      if (SECTION_REGEX.test(val) && val.length <= 4 && !/^[A-Za-z]{2,}/.test(val)) {
        sectionMatches++;
      }

      // Course Title e.g. "Mobile App Development", "Calculus I"
      if (
        val.length >= 6 &&
        val.includes(' ') &&
        !/\d{1,2}:\d{2}/.test(val) &&
        !/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(val)
      ) {
        nameMatches++;
      }

      // Schedule (Day + Time combined) e.g. "(H) 01:45PM - 03:15PM TTH", "MWF 9:00-10:00"
      const hasTime = /\d{1,2}[:.]\d{2}/.test(val);
      const hasDays = /(?:MWF|TTH|TF|WF|MW|TR|TUFR|MTH|MTWRF|MON|TUE|WED|THU|FRI)/i.test(val);

      if (hasTime && hasDays) {
        scheduleMatches++;
      } else if (hasDays && !hasTime) {
        daysMatches++;
      } else if (hasTime && !hasDays) {
        if (/[-–~to]/.test(val)) {
          timeMatches++;
        } else {
          startMatches += 0.5;
          endMatches += 0.5;
        }
      }

      // Instructor e.g. "Kabin Antony", "Jesse Lee Orndorff", "Staff", "TBA"
      if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(val) || val === 'Staff' || val === 'TBA' || val === 'TBC') {
        instructorMatches++;
      }

      // Credits e.g. 1 to 6
      const num = Number(val);
      if (!isNaN(num) && num >= 0.5 && num <= 8) {
        creditsMatches++;
      }

      // Room e.g. "Hall 101", "TBD", "Room 204", "Science 301"
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
      code: codeH + (codeMatches / totalSampleRows) * 5,
      name: nameH + (nameMatches / totalSampleRows) * 5,
      section: sectionH + (sectionMatches / totalSampleRows) * 5,
      schedule: scheduleH + (scheduleMatches / totalSampleRows) * 5,
      days: daysH + (daysMatches / totalSampleRows) * 5,
      time: timeH + (timeMatches / totalSampleRows) * 5,
      startTime: startH + (startMatches / totalSampleRows) * 5,
      endTime: endH + (endMatches / totalSampleRows) * 5,
      instructor: instructorH + (instructorMatches / totalSampleRows) * 5,
      credits: creditsH + (creditsMatches / totalSampleRows) * 5,
      room: roomH + (roomMatches / totalSampleRows) * 5,
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

  // Assign in logical priority order
  mapping.code = pickBest('code');
  mapping.name = pickBest('name');
  mapping.schedule = pickBest('schedule');
  if (!mapping.schedule) {
    mapping.days = pickBest('days');
    mapping.time = pickBest('time');
    if (!mapping.time) {
      mapping.startTime = pickBest('startTime');
      mapping.endTime = pickBest('endTime');
    }
  } else {
    // If schedule was picked, check if days/time were separate
    mapping.days = pickBest('days', 3.0);
    mapping.time = pickBest('time', 3.0);
  }

  mapping.section = pickBest('section');
  mapping.instructor = pickBest('instructor');
  mapping.credits = pickBest('credits');
  mapping.room = pickBest('room');

  // Safety fallback: if code still empty, pick first non-empty column
  if (!mapping.code && columns.length > 0) {
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

  const getCell = (row: (string | number | undefined)[], colKey: string): string => {
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

    if (!code && !name) {
      // If neither code nor name found, check if any cell has text
      const firstText = row.find((c) => sanitizeString(c).length > 0);
      if (firstText) {
        code = sanitizeString(firstText).slice(0, 10).toUpperCase();
        name = sanitizeString(firstText);
      } else {
        skippedRows++;
        continue;
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

    // Schedule Parsing
    let sessions: ClassSession[] = [];
    const safeTag = (code || name || 'item').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    const courseId = prefixedId(`c_${safeTag}`);

    // Path 1: Combined schedule column
    if (mapping.schedule) {
      const scheduleRaw = getCell(row, mapping.schedule);
      const scheduleParsed = parseScheduleString(scheduleRaw);
      if (scheduleParsed) {
        sessions = scheduleParsed.days.map((day, sIdx) => ({
          id: `s_${courseId}_${sIdx}`,
          day,
          startTime: scheduleParsed.startTime,
          endTime: scheduleParsed.endTime,
          room: room || undefined,
        }));
      }
    }

    // Path 2: Separate Days and Time column (or StartTime + EndTime)
    if (sessions.length === 0 && (mapping.days || mapping.time || mapping.startTime || mapping.endTime)) {
      const daysRaw = getCell(row, mapping.days);
      const timeRaw = getCell(row, mapping.time);
      const startRaw = getCell(row, mapping.startTime);
      const endRaw = getCell(row, mapping.endTime);

      const parsedDays = extractDays(daysRaw);
      const finalDays: DayOfWeek[] = parsedDays.length > 0 ? parsedDays : ['monday', 'wednesday', 'friday'];

      let startTime = '09:00';
      let endTime = '10:15';

      if (timeRaw) {
        const timeParsed = extractTimeRange(timeRaw);
        if (timeParsed) {
          startTime = timeParsed.start;
          endTime = timeParsed.end;
        }
      } else if (startRaw || endRaw) {
        const parsedStart = parseSingleTimeToken(startRaw, false);
        const parsedEnd = parseSingleTimeToken(endRaw, true);

        if (parsedStart) {
          startTime = `${String(parsedStart.h).padStart(2, '0')}:${String(parsedStart.m).padStart(2, '0')}`;
        }
        if (parsedEnd) {
          endTime = `${String(parsedEnd.h).padStart(2, '0')}:${String(parsedEnd.m).padStart(2, '0')}`;
        } else if (parsedStart) {
          const endH = (parsedStart.h + 1) % 24;
          endTime = `${String(endH).padStart(2, '0')}:${String(parsedStart.m).padStart(2, '0')}`;
        }
      }

      sessions = finalDays.map((day, sIdx) => ({
        id: `s_${courseId}_${sIdx}`,
        day,
        startTime,
        endTime,
        room: room || undefined,
      }));
    }

    // Path 3: Fallback if no sessions parsed (e.g. online/async or unmapped schedule)
    if (sessions.length === 0) {
      sessions = [
        {
          id: `s_${courseId}_0`,
          day: 'monday',
          startTime: '09:00',
          endTime: '10:15',
          room: room || undefined,
        },
      ];
    }

    const colorIdx = (startColorIndex + courses.length) % COURSE_COLORS.length;
    const color = COURSE_COLORS[colorIdx];

    const finalCode = code || name.slice(0, 10).toUpperCase();
    const finalName = name || finalCode;

    const course: Course = {
      id: courseId,
      code: finalCode,
      name: finalName,
      section: section || undefined,
      instructor: instructor || undefined,
      credits,
      color,
      sessions,
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
