import React from 'react';
import { Check, Download, Upload } from 'lucide-react';

interface BackupTabProps {
  importJson: string;
  importError: string | null;
  importSuccess: boolean;
  onImportJsonChange: (v: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownloadBackup: () => void;
  onApplyImport: () => void;
}

export const BackupTab: React.FC<BackupTabProps> = ({
  importJson,
  importError,
  importSuccess,
  onImportJsonChange,
  onFileUpload,
  onDownloadBackup,
  onApplyImport,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
            Backup All Plans & Pool
          </h4>
          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            Export all your plans, courses, and scratchpad pool into a single transferable JSON file.
          </p>
        </div>
        <button
          type="button"
          onClick={onDownloadBackup}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white shadow-xs transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Save Backup</span>
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-900 dark:text-white">
            Restore from Backup JSON
          </label>
          <label className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
            <span>Upload .json file</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={onFileUpload}
              className="hidden"
            />
          </label>
        </div>
        <textarea
          rows={3}
          value={importJson}
          onChange={(e) => onImportJsonChange(e.target.value)}
          placeholder="Paste backup JSON content here or click Upload above..."
          className="w-full p-2.5 font-mono text-[11px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />

        {importError && (
          <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-900">
            {importError}
          </div>
        )}

        {importSuccess && (
          <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs border border-emerald-200 dark:border-emerald-900 flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            Successfully restored backup!
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onApplyImport}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Restore Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
