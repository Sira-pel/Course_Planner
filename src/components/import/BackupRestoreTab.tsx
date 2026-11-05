import React, { useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ClipboardPaste, Database, FileJson, Upload } from 'lucide-react';
import { useScheduleStore } from '../../store/useScheduleStore';
import { backupReplaceMessage, countCourses, loadBackup } from '../../utils/backupRestore';
import { BackupRestoreDialog } from './BackupRestoreDialog';

interface BackupRestoreTabProps {
  onSuccess: () => void;
}

export const BackupRestoreTab: React.FC<BackupRestoreTabProps> = ({ onSuccess }) => {
  const importFullState = useScheduleStore((state) => state.importFullState);
  const plans = useScheduleStore((state) => state.plans);
  const [importJson, setImportJson] = useState('');
  const [readError, setReadError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const current = useMemo(
    () => ({ plans: plans.length, courses: countCourses(plans) }),
    [plans],
  );

  const loaded = useMemo(
    () => (importJson.trim() ? loadBackup(importJson) : null),
    [importJson],
  );
  const parseError = loaded && loaded.ok === false ? loaded.error : null;
  const incoming =
    loaded && loaded.ok
      ? { plans: loaded.backup.plans.length, courses: countCourses(loaded.backup.plans) }
      : null;
  const error = readError ?? parseError ?? restoreError;

  const readFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setImportJson(content);
        setReadError(null);
        setRestoreError(null);
      }
    };
    reader.onerror = () => setReadError('Couldn’t read that file. Try another .json file.');
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    readFile(e.target.files?.[0]);
    // Let the same file be chosen again after an error.
    e.target.value = '';
  };

  const handlePasteText = (text: string) => {
    if (!text.trim()) return;
    setImportJson(text);
    setReadError(null);
    setRestoreError(null);
  };

  const handlePasteFromClipboard = async () => {
    try {
      handlePasteText(await navigator.clipboard.readText());
    } catch {
      setReadError('Couldn’t read your clipboard. Copy the backup and press Ctrl+V here instead.');
    }
  };

  const handleClear = () => {
    setImportJson('');
    setReadError(null);
    setRestoreError(null);
  };

  const handleApplyImport = () => {
    if (!incoming) return;
    setConfirmMessage(backupReplaceMessage(current, incoming));
  };

  const handleConfirmRestore = () => {
    setConfirmMessage(null);
    const res = importFullState(importJson);
    if (res.success) {
      setImportSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } else {
      setRestoreError(res.error || 'This backup could not be read. Use a Uniplan JSON backup and try again.');
    }
  };

  return (
    <div className="space-y-3">
      <div
        role="note"
        className="flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-900/70 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200"
      >
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          Restoring replaces everything you have now:{' '}
          <strong>
            {current.plans} {current.plans === 1 ? 'plan' : 'plans'}, {current.courses}{' '}
            {current.courses === 1 ? 'course' : 'courses'} and your course pool
          </strong>
          . Save a backup first if you want a way back.
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div
        tabIndex={0}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text');
          if (text) {
            e.preventDefault();
            handlePasteText(text);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onClick={() => {
          if (!incoming) fileInputRef.current?.click();
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          readFile(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-2xl border-2 border-dashed p-6 sm:p-8 flex flex-col items-center justify-center text-center gap-3 up-modal-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          incoming ? '' : 'cursor-pointer'
        } ${
          dragging
            ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30'
            : `border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 ${
                incoming ? '' : 'hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20'
              }`
        }`}
      >
        <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          {incoming ? <FileJson className="w-6 h-6" /> : <Database className="w-6 h-6" />}
        </div>

        {incoming ? (
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Backup ready to restore</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              {incoming.plans} {incoming.plans === 1 ? 'plan' : 'plans'}, {incoming.courses}{' '}
              {incoming.courses === 1 ? 'course' : 'courses'}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Drop a Uniplan backup here</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              A <strong className="text-slate-700 dark:text-slate-200">.json</strong> file from Export, or paste its contents
            </p>
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {importSuccess && (
          <div role="status" className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Backup restored</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          {incoming ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleApplyImport();
                }}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                Restore backup
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors"
              >
                Choose another
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                Browse files
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handlePasteFromClipboard();
                }}
                className="px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-indigo-400 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                Paste JSON
              </button>
            </>
          )}
        </div>
      </div>

      <BackupRestoreDialog
        open={confirmMessage != null}
        message={confirmMessage ?? ''}
        onCancel={() => setConfirmMessage(null)}
        onConfirm={handleConfirmRestore}
      />
    </div>
  );
};
