import React, { Suspense, lazy } from 'react';
import { Download } from 'lucide-react';
import { SchedulePlan } from '../../types/schedule';

const GoogleCalendarSync = lazy(() => import('../GoogleCalendarSync'));

interface IcsExportTabProps {
  activePlan: SchedulePlan;
  semesterStart: string;
  semesterEnd: string;
  onSemesterStart: (v: string) => void;
  onSemesterEnd: (v: string) => void;
  onDownloadIcs: () => void;
}

export const IcsExportTab: React.FC<IcsExportTabProps> = ({
  activePlan,
  semesterStart,
  semesterEnd,
  onSemesterStart,
  onSemesterEnd,
  onDownloadIcs,
}) => {
  return (
    <div className="space-y-4">
      {/* Date Range Configuration */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Semester Start Date
          </label>
          <input
            type="date"
            value={semesterStart}
            onChange={(e) => onSemesterStart(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
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
            className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Main Download Action */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          {activePlan.courses.length} courses ({activePlan.courses.reduce((acc, c) => acc + (c.sessions?.length || 0), 0)} weekly sessions)
        </div>
        <button
          type="button"
          onClick={onDownloadIcs}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all up-chrome-btn active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download .ics Calendar File</span>
        </button>
      </div>

      {/* Secondary: Direct Google Calendar Sync */}
      <Suspense fallback={<p className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">Loading Google Calendar sync...</p>}>
        <GoogleCalendarSync activePlan={activePlan} semesterStart={semesterStart} semesterEnd={semesterEnd} />
      </Suspense>
    </div>
  );
};
