import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Search,
  CheckSquare,
  Square,
  Settings2,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Course, SchedulePlan } from '../../types/schedule';
import {
  readExcelFile,
  loadSheetData,
  parseExcelRowsToCourses,
  ColumnMapping,
  ColumnOption,
  ExcelWorkbookData,
} from '../../utils/excelImport';

interface ExcelImportTabProps {
  activePlan: SchedulePlan;
  onImportToPool: (courses: Course[]) => void;
  onImportToPlanAndPool: (courses: Course[], planId: string) => void;
  onSuccess: (count: number, destination: string) => void;
}

interface FieldDef {
  field: keyof ColumnMapping;
  label: string;
  required: boolean;
  hint: string;
}

const PRIMARY_FIELDS: FieldDef[] = [
  { field: 'code', label: 'Course Code / ID', required: true, hint: 'e.g. ICT 304, COSC 241' },
  { field: 'name', label: 'Course Name / Title', required: true, hint: 'e.g. Mobile App Dev' },
  { field: 'schedule', label: 'Day & Time Schedule', required: true, hint: 'e.g. (H) 01:45PM - 03:15PM TTH' },
  { field: 'section', label: 'Section', required: false, hint: 'e.g. 001, 101, A' },
  { field: 'instructor', label: 'Professor / Instructor', required: false, hint: 'e.g. Kabin Antony' },
  { field: 'credits', label: 'Credits', required: false, hint: 'e.g. 3, 4' },
  { field: 'room', label: 'Room / Location', required: false, hint: 'e.g. TBD, Hall 101' },
];

interface CourseRowProps {
  course: Course;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

const CourseRow = React.memo<CourseRowProps>(({ course: c, isSelected, onToggle }) => {
  const sessionSummary =
    c.sessions.length > 0
      ? `${c.sessions
          .map((s) => s.day.slice(0, 3).toUpperCase())
          .join('/')} ${c.sessions[0].startTime}-${c.sessions[0].endTime}`
      : 'Online / Async';

  return (
    <div
      onClick={() => onToggle(c.id)}
      className={`p-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-70'
      }`}
    >
      <button
        type="button"
        aria-label={`Select ${c.code}`}
        className="shrink-0 text-indigo-600 dark:text-indigo-400"
      >
        {isSelected ? (
          <CheckSquare className="w-4 h-4" />
        ) : (
          <Square className="w-4 h-4 text-slate-400 dark:text-slate-600" />
        )}
      </button>

      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: c.color }}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs text-slate-900 dark:text-white">
            {c.code}
            {c.section ? `-${c.section}` : ''}
          </span>
          <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
            {c.name}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 font-mono">
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
            {sessionSummary}
          </span>
          {c.instructor && <span>· {c.instructor}</span>}
          {c.sessions[0]?.room && <span>· {c.sessions[0].room}</span>}
          <span>· {c.credits} cr</span>
        </div>
      </div>
    </div>
  );
});
CourseRow.displayName = 'CourseRow';

export const ExcelImportTab: React.FC<ExcelImportTabProps> = ({
  activePlan,
  onImportToPool,
  onImportToPlanAndPool,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Workbook data
  const [workbookRef, setWorkbookRef] = useState<XLSX.WorkBook | null>(null);
  const [sheetData, setSheetData] = useState<ExcelWorkbookData | null>(null);
  const [activeMapping, setActiveMapping] = useState<ColumnMapping | null>(null);
  const [showColumnSetup, setShowColumnSetup] = useState(false);

  // Selection & options
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [alsoAddToActivePlan, setAlsoAddToActivePlan] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setIsLoading(true);

    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage('File exceeds maximum size limit (20MB).');
      setIsLoading(false);
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const { workbook, sheets } = readExcelFile(arrayBuffer);

      if (sheets.length === 0) {
        setErrorMessage('The uploaded workbook contains no readable sheets.');
        setIsLoading(false);
        return;
      }

      setFileName(file.name);
      setFileSize(
        file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(file.size / 1024)} KB`
      );
      setWorkbookRef(workbook);

      // Load first sheet by default
      const defaultSheet = sheets[0];
      const parsedSheet = loadSheetData(workbook, defaultSheet);
      setSheetData(parsedSheet);
      setActiveMapping(parsedSheet.detectedMapping);

      // Parse with auto-detected columns
      const result = parseExcelRowsToCourses(
        parsedSheet.rawRows,
        parsedSheet.dataStartRow,
        parsedSheet.detectedMapping
      );

      // Auto-select all parsed courses initially
      setSelectedCourseIds(new Set(result.courses.map((c) => c.id)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setErrorMessage(`Failed to read Excel file: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSheetChange = (newSheet: string) => {
    if (!workbookRef) return;
    const parsedSheet = loadSheetData(workbookRef, newSheet);
    setSheetData(parsedSheet);
    setActiveMapping(parsedSheet.detectedMapping);
    const result = parseExcelRowsToCourses(
      parsedSheet.rawRows,
      parsedSheet.dataStartRow,
      parsedSheet.detectedMapping
    );
    setSelectedCourseIds(new Set(result.courses.map((c) => c.id)));
  };

  const handleMappingChange = useCallback((field: keyof ColumnMapping, colKey: string) => {
    setActiveMapping((prev) => (prev ? { ...prev, [field]: colKey } : null));
  }, []);

  // Re-parse whenever raw rows, data start row, or mapping changes
  const parsedResult = useMemo(() => {
    if (!sheetData || !activeMapping) return null;
    return parseExcelRowsToCourses(sheetData.rawRows, sheetData.dataStartRow, activeMapping);
  }, [sheetData, activeMapping]);

  const allCourses = useMemo(() => parsedResult?.courses || [], [parsedResult]);

  // Keep selection synchronized if courses are re-parsed
  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return allCourses;
    const q = searchQuery.toLowerCase().trim();
    return allCourses.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.section && c.section.toLowerCase().includes(q)) ||
        (c.instructor && c.instructor.toLowerCase().includes(q))
    );
  }, [allCourses, searchQuery]);

  const handleToggleSelectCourse = useCallback((id: string) => {
    setSelectedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedCourseIds(new Set(allCourses.map((c) => c.id)));
  }, [allCourses]);

  const handleDeselectAll = useCallback(() => {
    setSelectedCourseIds(new Set());
  }, []);

  const handleImport = () => {
    if (selectedCourseIds.size === 0) return;
    setIsImporting(true);

    const toImport = allCourses.filter((c) => selectedCourseIds.has(c.id));

    if (alsoAddToActivePlan) {
      onImportToPlanAndPool(toImport, activePlan.id);
      onSuccess(toImport.length, `Course Pool & ${activePlan.name}`);
    } else {
      onImportToPool(toImport);
      onSuccess(toImport.length, 'Course Pool');
    }

    setIsImporting(false);
  };

  const handleDownloadSampleTemplate = () => {
    const sampleRows = [
      {
        Dept: 'IT',
        'Course Code': 'ICT 304',
        Section: '001',
        'Course Title': 'Mobile App Cross-Platform Development II',
        Credits: 3,
        Instructor: 'Kabin Antony',
        Schedule: '(H) 01:45PM - 03:15PM TTH',
        Room: 'TBD',
      },
      {
        Dept: 'IT',
        'Course Code': 'COSC 241',
        Section: '001',
        'Course Title': 'Computing Science Fundamentals',
        Credits: 3,
        Instructor: 'Kabin Antony',
        Schedule: '(E) 03:30PM - 05:00PM MW',
        Room: 'TBD',
      },
      {
        Dept: 'IT',
        'Course Code': 'ITEC 101',
        Section: '101',
        'Course Title': 'Introduction to Information Technology',
        Credits: 3,
        Instructor: 'Jesse Lee Orndorff',
        Schedule: '(O) 8:30AM - 10:30AM MWF',
        Room: 'TBD',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Course Schedule');
    XLSX.writeFile(wb, 'Uniplan_Course_Template.xlsx');
  };

  return (
    <div className="space-y-4">
      {/* File Upload Dropzone */}
      {!sheetData ? (
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-slate-50 dark:bg-slate-800/40 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileSpreadsheet className="w-6 h-6" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Upload your school's Excel or CSV schedule file
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              Supports <strong className="text-slate-700 dark:text-slate-200">.xlsx</strong>,{' '}
              <strong className="text-slate-700 dark:text-slate-200">.xls</strong>, and{' '}
              <strong className="text-slate-700 dark:text-slate-200">.csv</strong> spreadsheets
            </p>
          </div>
          <button
            type="button"
            className="mt-1 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            Browse Files
          </button>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 w-full max-w-xs mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <Info className="w-3.5 h-3.5" />
            <span>Need a template?</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadSampleTemplate();
              }}
              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline inline-flex items-center gap-0.5 ml-1"
            >
              Download Sample
            </button>
          </div>
        </div>
      ) : (
        /* Workspace when file is loaded */
        <div className="space-y-3">
          {/* File summary pill & sheet switcher */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-xs">
                    {fileName}
                  </span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                    {fileSize}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  {allCourses.length} course sections detected ({selectedCourseIds.size} selected)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {sheetData.sheets.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <label htmlFor="sheet-select" className="text-xs text-slate-600 dark:text-slate-300 shrink-0">
                    Sheet:
                  </label>
                  <select
                    id="sheet-select"
                    value={sheetData.currentSheet}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="text-xs font-semibold px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    {sheetData.sheets.map((s) => (
                      <option key={s} value={s} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowColumnSetup((prev) => !prev)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md border flex items-center gap-1 transition-colors ${
                  showColumnSetup
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-400'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Column Mapping</span>
                {showColumnSetup ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSheetData(null);
                  setWorkbookRef(null);
                  setFileName(null);
                  setSelectedCourseIds(new Set());
                }}
                className="text-xs text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 px-2 py-1 font-semibold"
              >
                Change file
              </button>
            </div>
          </div>

          {/* Column Mapping Setup Panel - toggled with display style for instant reveal */}
          {activeMapping && (
            <div
              className={`p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3 ${
                showColumnSetup ? 'block' : 'hidden'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5 text-indigo-500" />
                    Configure Column Mapping
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Auto-detected based on your spreadsheet contents. You can adjust which column maps to each field.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {PRIMARY_FIELDS.map((f) => {
                  const currentVal = activeMapping[f.field] || '';
                  return (
                    <div
                      key={f.field}
                      className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                          {f.label} {f.required && <span className="text-rose-500">*</span>}
                        </span>
                        <span className="text-[10px] text-slate-500">{f.hint}</span>
                      </div>
                      <select
                        value={currentVal}
                        onChange={(e) => handleMappingChange(f.field, e.target.value)}
                        className="text-xs px-2 py-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 w-full truncate font-mono"
                      >
                        <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">(None / Skip)</option>
                        {sheetData.columns.map((col) => (
                          <option key={col.key} value={col.key} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {col.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search, Filter & Bulk Select Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search courses, professors, sections..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                Select all ({allCourses.length})
              </button>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                Deselect all
              </button>
            </div>
          </div>

          {/* Parsed Course List with interactive checkboxes */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-64 sm:max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
            {filteredCourses.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-800 dark:text-slate-200">No courses parsed</p>
                <p className="mt-1">
                  Click <strong>Column Mapping</strong> above to check or adjust which column maps to Course Code and Schedule.
                </p>
              </div>
            ) : (
              filteredCourses.map((c) => (
                <CourseRow
                  key={c.id}
                  course={c}
                  isSelected={selectedCourseIds.has(c.id)}
                  onToggle={handleToggleSelectCourse}
                />
              ))
            )}
          </div>

          {/* Action Footer */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={alsoAddToActivePlan}
                onChange={(e) => setAlsoAddToActivePlan(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
              />
              <span>
                Also enroll selected courses into active plan: <strong>{activePlan.name}</strong>
              </span>
            </label>

            <button
              type="button"
              disabled={selectedCourseIds.size === 0 || isImporting}
              onClick={handleImport}
              className={`px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 ${
                selectedCourseIds.size > 0 && !isImporting
                  ? 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600'
                  : 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Import {selectedCourseIds.size} Course{selectedCourseIds.size === 1 ? '' : 's'} to Course Pool
              </span>
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2 text-rose-700 dark:text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
