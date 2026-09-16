import React from 'react';
import { Download } from 'lucide-react';
import { Course, SchedulePlan } from '../../types/schedule';
import { GoogleCalendarSync } from '../GoogleCalendarSync';

interface IcsExportTabProps {
  activePlan: SchedulePlan;
  semesterStart: string;
  semesterEnd: string;
  onSemesterStart: (v: string) => void;
  onSemesterEnd: (v: string) => void;
  onDownloadIcs: () => void;
  onDownloadCourseIcs: (course: Course) => void;
}

export const IcsExportTab: React.FC<IcsExportTabProps> = ({
  activePlan,
  semesterStart,
  semesterEnd,
  onSemesterStart,
  onSemesterEnd,
  onDownloadIcs,
  onDownloadCourseIcs,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] text-slate-600 dark:text-slate-300 mb-3">
          Generates standard <code>.ics</code> calendar files (RFC 5545 & RFC 7986) compatible with
          Google Calendar, Apple Calendar, and Outlook with weekly recurring class sessions.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Semester Start Date
            </label>
            <input
              type="date"
              value={semesterStart}
              onChange={(e) => onSemesterStart(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Semester End Date (Repeat Until)
            </label>
            <input
              type="date"
              value={semesterEnd}
              onChange={(e) => onSemesterEnd(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {activePlan.courses.length} courses ({activePlan.courses.reduce((acc, c) => acc + (c.sessions?.length || 0), 0)} weekly sessions)
          </div>
          <button
            type="button"
            onClick={onDownloadIcs}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .ics Calendar File</span>
          </button>
        </div>

        <GoogleCalendarSync activePlan={activePlan} semesterStart={semesterStart} semesterEnd={semesterEnd} />
        {/* Optional: Individual Course .ics Download */}
        {activePlan.courses.length > 1 && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Export Individual Course Calendars:
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                To import as separate colored calendars in Google Cal
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
              {activePlan.courses.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => onDownloadCourseIcs(course)}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors text-left group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: course.color }}
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 dark:text-white font-mono mr-1">
                        {course.code}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {course.name}
                      </span>
                    </div>
                  </div>
                  <Download className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0 ml-1.5" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
