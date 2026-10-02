import React from 'react';
import { Download } from 'lucide-react';

interface BackupTabProps {
  onDownloadBackup: () => void;
}

export const BackupTab: React.FC<BackupTabProps> = ({ onDownloadBackup }) => {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
            Backup All Plans & Pool
          </h4>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
            Export all plans, courses, and scratchpad pool into a single transferable JSON file.
          </p>
        </div>
        <button
          type="button"
          onClick={onDownloadBackup}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white shadow-xs transition-colors shrink-0 up-chrome-btn active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Save Backup</span>
        </button>
      </div>
    </div>
  );
};
