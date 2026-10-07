import React, { useState, useRef, useMemo } from 'react';
import {
  Calendar,
  Upload,
  CheckCircle2,
  AlertCircle,
  Search,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';
import type { Course, SchedulePlan } from '../../types/schedule';
import { displayCourseTitle } from '../../utils/courseIdentity';
import { parseIcsContent } from '../../utils/icsImport';

interface IcsImportTabProps {
  activePlan: SchedulePlan;
  onImportToPool: (courses: Course[]) => void;
  onImportToPlanAndPool: (courses: Course[], planId: string) => void;
  onSuccess: (count: number, destination: string) => void;
}

export const IcsImportTab: React.FC<IcsImportTabProps> = ({
  activePlan,
  onImportToPool,
  onImportToPlanAndPool,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [parsedCourses, setParsedCourses] = useState<Course[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [alsoAddToActivePlan, setAlsoAddToActivePlan] = useState(true);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setErrorMessage(null);
    setIsLoading(true);

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('File exceeds size limit (15MB).');
      setIsLoading(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        try {
          const courses = parseIcsContent(content);
          if (courses.length === 0) {
            setErrorMessage('No recurring class events or timed sessions found in this .ics file.');
            setIsLoading(false);
            return;
          }

          setFileName(file.name);
          setFileSize(
            file.size > 1024 * 1024
              ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
              : `${Math.round(file.size / 1024)} KB`
          );
          setParsedCourses(courses);
          setSelectedCourseIds(new Set(courses.map((c) => c.id)));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown parsing error';
          setErrorMessage(`Failed to parse iCalendar file: ${msg}`);
        }
      }
      setIsLoading(false);
    };

    reader.onerror = () => {
      setErrorMessage('Failed to read the selected file.');
      setIsLoading(false);
    };

    reader.readAsText(file);
  };

  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return parsedCourses;
    const q = searchQuery.toLowerCase().trim();
    return parsedCourses.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.instructor && c.instructor.toLowerCase().includes(q))
    );
  }, [parsedCourses, searchQuery]);

  const handleToggleSelectCourse = (id: string) => {
    const next = new Set(selectedCourseIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCourseIds(next);
  };

  const handleSelectAll = () => {
    setSelectedCourseIds(new Set(parsedCourses.map((c) => c.id)));
  };

  const handleDeselectAll = () => {
    setSelectedCourseIds(new Set());
  };

  const handleImport = () => {
    if (selectedCourseIds.size === 0) return;
    const toImport = parsedCourses.filter((c) => selectedCourseIds.has(c.id));

    if (alsoAddToActivePlan) {
      onImportToPlanAndPool(toImport, activePlan.id);
      onSuccess(toImport.length, `Course Pool & ${activePlan.name}`);
    } else {
      onImportToPool(toImport);
      onSuccess(toImport.length, 'Course Pool');
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-2.5">
      {parsedCourses.length === 0 ? (
        <div>
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-slate-50 dark:bg-slate-800/40 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 rounded-2xl p-6 sm:p-8 text-center cursor-pointer up-modal-card flex flex-col items-center justify-center gap-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".ics,text/calendar"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Calendar className="w-6 h-6" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Drop your .ics Calendar file here
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Supports Google Calendar, Canvas, Blackboard, Apple Calendar, and Outlook exports
              </p>
            </div>
            <button
              type="button"
              className="mt-1 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Browse .ics Files
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 gap-3">
          {/* File summary pill - Compact on mobile */}
          <div className="p-2 sm:p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[150px] sm:max-w-xs" title={fileName || ''}>
                    {fileName}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0 hidden xs:inline">
                    {fileSize}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setParsedCourses([]);
                setFileName(null);
                setSelectedCourseIds(new Set());
              }}
              className="text-[11px] text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 px-1.5 py-1 font-semibold transition-colors shrink-0"
              title="Change File"
            >
              Change
            </button>
          </div>

          {/* Search & Bulk Select Bar */}
          <div className="space-y-1 shrink-0">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search courses..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 up-modal-card"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-xs px-0.5 text-slate-600 dark:text-slate-300">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {filteredCourses.length} {filteredCourses.length === 1 ? 'course' : 'courses'} found
              </span>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Select all
                </button>
                <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Deselect all
                </button>
              </div>
            </div>
          </div>

          {/* Parsed courses list - Only this scrolls */}
          <div
            data-fill-scroll
            className="border border-slate-200 dark:border-slate-800 rounded-xl min-h-36 flex-1 overflow-x-hidden overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900 up-scroll overscroll-contain"
          >
            {filteredCourses.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-600 dark:text-slate-300">
                No courses match the current filter.
              </div>
            ) : (
              filteredCourses.map((c) => {
                const isSelected = selectedCourseIds.has(c.id);
                const sessionSummary =
                  c.sessions.length > 0
                    ? `${c.sessions
                        .map((s) => s.day.slice(0, 3).toUpperCase())
                        .join('/')} ${c.sessions[0].startTime}-${c.sessions[0].endTime}`
                    : 'Online / Async';

                return (
                  <div
                    key={c.id}
                    onClick={() => handleToggleSelectCourse(c.id)}
                    className={`py-2 px-2.5 sm:p-2.5 flex items-center gap-2.5 sm:gap-3 cursor-pointer transition-colors ${
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
                        {displayCourseTitle(c) && (
                          <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
                            {displayCourseTitle(c)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 font-mono">
                        <span>{sessionSummary}</span>
                        {c.sessions[0]?.room && <span>· {c.sessions[0].room}</span>}
                        {c.instructor && <span>· {c.instructor}</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Destination options & Import action - Compact Single-row on all screen sizes */}
          <div className="pt-1 pb-0.5 shrink-0">
            <div className="p-2 sm:p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-2 shadow-xs">
              <label className="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none min-w-0">
                <input
                  type="checkbox"
                  checked={alsoAddToActivePlan}
                  onChange={(e) => setAlsoAddToActivePlan(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 shrink-0"
                />
                <span className="truncate text-[11px] sm:text-xs">
                  <span className="hidden sm:inline">Also enroll in </span>
                  <span className="sm:hidden">Add to </span>
                  <strong>{activePlan.name}</strong>
                </span>
              </label>

              <button
                type="button"
                disabled={selectedCourseIds.size === 0}
                onClick={handleImport}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs font-semibold text-white shadow-xs up-modal-card flex items-center justify-center gap-1.5 shrink-0 ${
                  selectedCourseIds.size > 0
                    ? 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 active:scale-95'
                    : 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  Import {selectedCourseIds.size} Course{selectedCourseIds.size === 1 ? '' : 's'}
                </span>
                <span className="sm:hidden">
                  Import ({selectedCourseIds.size})
                </span>
              </button>
            </div>
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
