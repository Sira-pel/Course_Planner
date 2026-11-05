import React from 'react';
import { Download } from 'lucide-react';

interface BackupTabProps {
  planCount: number;
  courseCount: number;
  onDownloadBackup: () => void;
}

export const BackupTab: React.FC<BackupTabProps> = ({ planCount, courseCount, onDownloadBackup }) => {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-5 flex flex-col items-center text-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
        <Download className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Save everything to one file</p>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-sm">
          {planCount} {planCount === 1 ? 'plan' : 'plans'}, {courseCount} {courseCount === 1 ? 'course' : 'courses'}, your course pool and preferences, in a single JSON file. Restore it from Import, on any device.
        </p>
      </div>
      <button
        type="button"
        onClick={onDownloadBackup}
        className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5"
      >
        <Download className="w-3.5 h-3.5" />
        Save backup
      </button>
    </div>
  );
};
