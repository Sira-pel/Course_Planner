import React, { useState } from 'react';
import { Database, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useScheduleStore } from '../../store/useScheduleStore';

interface BackupRestoreTabProps {
  onSuccess: () => void;
}

export const BackupRestoreTab: React.FC<BackupRestoreTabProps> = ({ onSuccess }) => {
  const importFullState = useScheduleStore((state) => state.importFullState);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setImportJson(content);
        setImportError(null);
      }
    };
    reader.onerror = () => {
      setImportError('Failed to read file');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleApplyImport = () => {
    setImportError(null);
    setImportSuccess(false);
    if (!importJson.trim()) {
      setImportError('Please paste or upload a valid JSON backup');
      return;
    }
    const res = importFullState(importJson);
    if (res.success) {
      setImportSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } else {
      setImportError(res.error || 'Failed to parse JSON backup');
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-indigo-500" />
            Restore Complete State from Backup (.json)
          </h4>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
            Upload or paste a Uniplan backup JSON file to restore all plans, courses, course pool, and preferences.
          </p>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Upload backup file
          </label>
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleFileUpload}
            className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-950/60 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900 transition-colors cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Or paste backup JSON code
          </label>
          <textarea
            value={importJson}
            onChange={(e) => {
              setImportJson(e.target.value);
              setImportError(null);
            }}
            placeholder='{"version": 1, "exportedAt": "...", "plans": [...] }'
            rows={5}
            className="w-full min-w-0 p-2.5 text-base sm:text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 break-all whitespace-pre-wrap"
          />
        </div>

        {importError && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{importError}</span>
          </div>
        )}

        {importSuccess && (
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Backup successfully restored! Refreshing schedule...</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleApplyImport}
          className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5"
        >
          <Upload className="w-3.5 h-3.5" />
          Apply Backup & Restore
        </button>
      </div>
    </div>
  );
};
