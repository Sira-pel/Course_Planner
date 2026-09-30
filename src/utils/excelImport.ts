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
 * Sanitizes cell input to prevent formula injection and escape HTML.
 */
export function sanitizeString(val: unknown, maxLen = 140): string {
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
 * Regex patterns for content-based classification
 */
// Course code e.g. ICT 304, INS 407, ITEC 101, CLD 371, COSC 241, CS 101, MATH 201A, BIO-102
const COURSE_CODE_REGEX = /^[A-Za-z]{2,5}\s*[-_]?\s*\d{2,4}[A-Za-z]?$/;

// Section e.g. 001, 002, 101, 01, A, B, L01
const SECTION_REGEX = /^\d{1,4}[A-Za-z]?$|^[A-Za-z]\d{0,2}$/i;

// Day tokens in schedules: MWF, TTH, TUTH, MTH, WF, MW, TF, TR, etc.
const DAY_TOKEN_REGEX = /\b(MWF|TTH|TUTH|MTH|MOTH|WF|MW|TF|TR|TUFR|WEFR|MTWTHF|MTWRF|MON(?:DAY)?|TUE(?:SDAY)?|WED(?:NESDAY)?|THU(?:RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?|TH|SU|M|T|W|R|F|S)\b/gi;

/**
 * Parses schedule strings that contain both day and time, e.g.:
 * "(H) 01:45PM - 03:15PM TTH"
 * "(E) 03:30PM - 05:00PM MW"
 * "(O) 8:30AM - 10:30AM MWF"
 * "(AA) 08:30AM - 10:00AM TF"
 * "(L) 12:00PM - 01:30PM WF"
 * "09:00 - 10:15 MWF"
 * "TR 1:30 PM - 3:00 PM"
 */
export function parseScheduleString(raw: unknown): {
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
} | null {
  if (raw === null || raw === undefined) return null;
  let str = sanitizeString(raw, 100);
  if (!str) return null;

  // 1. Strip parenthesized slot code or letter prefixes e.g. "(H)", "(EE)", "(1)", "(AA)"
  str = str.replace(/^\([A-Za-z0-9]+\)\s*/, '');
  str = str.replace(/\s*\([A-Za-z0-9]+\)$/, '');

  // 2. Extract day tokens
  const dayTokens: string[] = [];
  const cleanedForTime = str.replace(DAY_TOKEN_REGEX, (match) => {
    dayTokens.push(match);
    return '';
  });

  const parsedDays = normalizeDays(dayTokens);

  // 3. Extract time range from the remaining string
  // Remove brackets, cleanup extra spaces
  const cleanTimeStr = cleanedForTime.replace(/[()]/g, '').trim();
  const timeResult = parseTimeRange(cleanTimeStr);

  if (timeResult) {
    return {
      days: parsedDays.length > 0 ? parsedDays : ['monday'],
      startTime: timeResult.start,
      endTime: timeResult.end,
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
    raw: true,
  });

  return {
    workbook,
    sheets: workbook.SheetNames,
  };
}

/**
 * Clamps the sheet's !ref range to only rows and columns that contain actual non-empty data.
 * This prevents spreadsheets with formatted empty cells out to row 1,048,576 or column XFD (16,384)
 * from allocating millions of empty array entries and freezing the UI when rendering column options.
 */
export function clampSheetRange(sheet: XLSX.WorkSheet, maxAllowedCols = 50, maxAllowedRows = 5000): void {
  if (!sheet) return;

  let minR = Infinity, maxR = -1;
  let minC = Infinity, maxC = -1;
  let hasCells = false;

  for (const key of Object.keys(sheet)) {
    if (key.charCodeAt(0) === 33) continue; // skip '!ref', '!merges', '!cols', etc.
    const cellVal = sheet[key];
    if (!cellVal) continue;

    // Check if cell has actual content (value, formatted text, or formula)
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
    if (cell.r < minR) minR = cell.r;
    if (cell.r > maxR) maxR = cell.r;
    if (cell.c < minC) minC = cell.c;
    if (cell.c > maxC) maxC = cell.c;
  }

  if (hasCells) {
    const startRow = Math.max(0, minR);
    const startCol = Math.max(0, minC);
    const endRow = Math.min(maxR, maxAllowedRows - 1);
    const endCol = Math.min(maxC, maxAllowedCols - 1);
    sheet['!ref'] = XLSX.utils.encode_range({
      s: { r: startRow, c: startCol },
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

  // Pre-clamp range so sheet_to_json does not expand 16,384 columns or millions of empty rows
  clampSheetRange(sheet);

  // Convert sheet to 2D array of values, skipping pure blank rows
  const rawRows: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
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

  // Find max column index across all rows that actually contains non-empty text
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

  // Bound columns to actual data range (max 50 columns)
  const maxCols = Math.min(Math.max(maxColIndexWithData + 1, 1), 50);

  // Normalize rows so they only contain up to maxCols elements
  const trimmedRows = rawRows.map((row) => {
    const trimmed = row.slice(0, maxCols);
    while (trimmed.length < maxCols) {
      trimmed.push('');
    }
    return trimmed;
  });

  const sampleScanRows = Math.min(trimmedRows.length, 35);

  // Detect if Row 0 or Row 1 has column headers
  let headerRowIndex = -1;
  const HEADER_KEYWORDS = ['course', 'code', 'subject', 'title', 'name', 'section', 'instructor', 'professor', 'day', 'time', 'room', 'credit'];

  for (let r = 0; r < Math.min(trimmedRows.length, 5); r++) {
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

  // Determine data start row: if header row found, data starts at header + 1.
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

  // Build ColumnOption descriptors for each column
  const columns: ColumnOption[] = [];
  for (let c = 0; c < maxCols; c++) {
    const letter = getColumnLetter(c);
    const key = `col_${c}`;

    // Header text if present
    const rawHeader = headerRowIndex >= 0 && trimmedRows[headerRowIndex] ? sanitizeString(trimmedRows[headerRowIndex][c], 40) : '';

    // Collect up to 3 sample values from data rows
    const samples: string[] = [];
    for (let r = dataStartRow; r < sampleScanRows && samples.length < 3; r++) {
      const row = trimmedRows[r];
      if (!row) continue;
      const val = sanitizeString(row[c], 30);
      if (val && !samples.includes(val)) {
        samples.push(val);
      }
    }

    // Format readable dropdown label
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

  // Content-based intelligent column detection
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
    instructor: '',
    credits: '',
    room: '',
  };
}

/**
 * Automatically detects which column corresponds to each course field
 * using deep content analysis of the data rows.
 */
export function autoDetectColumns(
  rawRows: (string | number | undefined)[][],
  dataStartRow: number,
  columns: ColumnOption[]
): ColumnMapping {
  const mapping = getEmptyMapping();
  if (columns.length === 0 || rawRows.length === 0) return mapping;

  const scanEnd = Math.min(rawRows.length, dataStartRow + 30);
  const totalSampleRows = Math.max(1, scanEnd - dataStartRow);

  // Scores for each column for each field
  interface ColumnScores {
    colKey: string;
    codeScore: number;
    sectionScore: number;
    nameScore: number;
    scheduleScore: number;
    instructorScore: number;
    creditsScore: number;
    roomScore: number;
  }

  const scores: ColumnScores[] = columns.map((col) => {
    let codeMatches = 0;
    let sectionMatches = 0;
    let nameMatches = 0;
    let scheduleMatches = 0;
    let instructorMatches = 0;
    let creditsMatches = 0;
    let roomMatches = 0;

    for (let r = dataStartRow; r < scanEnd; r++) {
      const row = rawRows[r];
      if (!row) continue;
      const rawVal = row[col.index];
      const val = sanitizeString(rawVal);
      if (!val) continue;

      // 1. Course Code: e.g. "ICT 304", "INS 407", "COSC 241", "ITEC 101"
      if (COURSE_CODE_REGEX.test(val)) {
        codeMatches++;
      }

      // 2. Section: e.g. "001", "002", "101", "01"
      if (SECTION_REGEX.test(val) && val.length <= 4 && !/^[A-Za-z]{2,}/.test(val)) {
        sectionMatches++;
      }

      // 3. Course Title / Name: longer string with spaces, letters, e.g. "Mobile App Cross-Platform Development II"
      if (
        val.length > 8 &&
        val.includes(' ') &&
        !/\d{1,2}:\d{2}/.test(val) &&
        !/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(val)
      ) {
        nameMatches++;
      }

      // 4. Schedule (Day + Time combined): e.g. "(H) 01:45PM - 03:15PM TTH", "08:30AM - 10:00AM MW"
      if (
        /\d{1,2}:\d{2}/.test(val) &&
        /(?:MWF|TTH|TF|WF|MW|TR|TUFR|MTH|MTWRF|MON|TUE|WED|THU|FRI)/i.test(val)
      ) {
        scheduleMatches++;
      } else if (/\d{1,2}:\d{2}\s*(?:AM|PM)?\s*[-–~to]\s*\d{1,2}:\d{2}/i.test(val)) {
        scheduleMatches += 0.7;
      }

      // 5. Instructor / Professor: personal names, 2-3 capitalized words, e.g. "Bonpagna Kann", "Kabin Antony"
      if (
        /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(val) ||
        val === 'TBC' ||
        val === 'Staff' ||
        val === 'TBA'
      ) {
        instructorMatches++;
      }

      // 6. Credits: single digit number 1 to 6
      const num = Number(val);
      if (!isNaN(num) && num >= 1 && num <= 6 && Number.isInteger(num)) {
        creditsMatches++;
      }

      // 7. Room / Location: e.g. "TBD", "TBA", "Hall 101", "Room 204"
      if (
        val === 'TBD' ||
        val === 'TBA' ||
        /^Room|Hall|Bldg|Lab/i.test(val) ||
        /\b[A-Za-z]{1,3}\s*\d{3}\b/.test(val)
      ) {
        roomMatches++;
      }
    }

    return {
      colKey: col.key,
      codeScore: codeMatches / totalSampleRows,
      sectionScore: sectionMatches / totalSampleRows,
      nameScore: nameMatches / totalSampleRows,
      scheduleScore: scheduleMatches / totalSampleRows,
      instructorScore: instructorMatches / totalSampleRows,
      creditsScore: creditsMatches / totalSampleRows,
      roomScore: roomMatches / totalSampleRows,
    };
  });

  const assignedColumns = new Set<string>();

  // 1. Pick Schedule Column
  const bestSchedule = [...scores].sort((a, b) => b.scheduleScore - a.scheduleScore)[0];
  if (bestSchedule && bestSchedule.scheduleScore >= 0.25) {
    mapping.schedule = bestSchedule.colKey;
    assignedColumns.add(bestSchedule.colKey);
  }

  // 2. Pick Course Code Column
  const bestCode = [...scores]
    .filter((s) => !assignedColumns.has(s.colKey))
    .sort((a, b) => b.codeScore - a.codeScore)[0];
  if (bestCode && bestCode.codeScore >= 0.25) {
    mapping.code = bestCode.colKey;
    assignedColumns.add(bestCode.colKey);
  }

  // 3. Pick Course Name / Title Column
  const bestName = [...scores]
    .filter((s) => !assignedColumns.has(s.colKey))
    .sort((a, b) => b.nameScore - a.nameScore)[0];
  if (bestName && bestName.nameScore >= 0.25) {
    mapping.name = bestName.colKey;
    assignedColumns.add(bestName.colKey);
  }

  // 4. Pick Section Column
  const bestSection = [...scores]
    .filter((s) => !assignedColumns.has(s.colKey))
    .sort((a, b) => b.sectionScore - a.sectionScore)[0];
  if (bestSection && bestSection.sectionScore >= 0.25) {
    mapping.section = bestSection.colKey;
    assignedColumns.add(bestSection.colKey);
  }

  // 5. Pick Instructor Column
  const bestInstructor = [...scores]
    .filter((s) => !assignedColumns.has(s.colKey))
    .sort((a, b) => b.instructorScore - a.instructorScore)[0];
  if (bestInstructor && bestInstructor.instructorScore >= 0.25) {
    mapping.instructor = bestInstructor.colKey;
    assignedColumns.add(bestInstructor.colKey);
  }

  // 6. Pick Credits Column
  const bestCredits = [...scores]
    .filter((s) => !assignedColumns.has(s.colKey))
    .sort((a, b) => b.creditsScore - a.creditsScore)[0];
  if (bestCredits && bestCredits.creditsScore >= 0.25) {
    mapping.credits = bestCredits.colKey;
    assignedColumns.add(bestCredits.colKey);
  }

  // 7. Pick Room Column
  const bestRoom = [...scores]
    .filter((s) => !assignedColumns.has(s.colKey))
    .sort((a, b) => b.roomScore - a.roomScore)[0];
  if (bestRoom && bestRoom.roomScore >= 0.25) {
    mapping.room = bestRoom.colKey;
    assignedColumns.add(bestRoom.colKey);
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

  // Helper to extract cell value from a column key (e.g. "col_1" -> index 1)
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

    const code = getCell(row, mapping.code);
    const name = getCell(row, mapping.name);
    const section = getCell(row, mapping.section);
    const instructor = getCell(row, mapping.instructor);
    const creditsStr = getCell(row, mapping.credits);
    const room = getCell(row, mapping.room);

    // If neither code nor name is present, skip row
    if (!code && !name) {
      skippedRows++;
      continue;
    }

    // Credits
    let credits = 3;
    if (creditsStr) {
      const parsedNum = parseFloat(creditsStr);
      if (!isNaN(parsedNum) && parsedNum >= 0 && parsedNum <= 12) {
        credits = parsedNum;
      }
    }

    // Schedule Parsing: try combined schedule column first
    let sessions: ClassSession[] = [];
    const safeTag = (code || name || 'item').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    const courseId = `c_r${r}_${safeTag}`;

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

    // If no sessions yet, check separate days and time columns
    if (sessions.length === 0 && (mapping.days || mapping.time)) {
      const daysRaw = getCell(row, mapping.days);
      const timeRaw = getCell(row, mapping.time);

      const dayTokens = daysRaw ? daysRaw.split(/[\s,;/]+/).filter(Boolean) : [];
      const parsedDays = dayTokens.length > 0 ? normalizeDays(dayTokens) : (['monday'] as DayOfWeek[]);

      let startTime = '09:00';
      let endTime = '10:15';

      if (timeRaw) {
        const timeParsed = parseTimeRange(timeRaw);
        if (timeParsed) {
          startTime = timeParsed.start;
          endTime = timeParsed.end;
        }
      }

      sessions = parsedDays.map((day, sIdx) => ({
        id: `s_${courseId}_${sIdx}`,
        day,
        startTime,
        endTime,
        room: room || undefined,
      }));
    }

    // If still no sessions (e.g. online or async or unmapped schedule), create fallback online session
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

    const course: Course = {
      id: courseId,
      code: code || name.slice(0, 10).toUpperCase(),
      name: name || code,
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
