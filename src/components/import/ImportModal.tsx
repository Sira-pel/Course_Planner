import React, { useState, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScheduleStore } from '../../store/useScheduleStore';
import type { Course } from '../../types/schedule';
import { X, FileSpreadsheet, Calendar, Database, Check } from 'lucide-react';
import { ExcelImportTab } from './ExcelImportTab';
import { IcsImportTab } from './IcsImportTab';
import { BackupRestoreTab } from './BackupRestoreTab';

export type ImportTabType = 'excel' | 'ics' | 'backup';

interface ImportModalProps {
  isOpen: boolean;
  initialTab?: ImportTabType;
  onClose: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  initialTab = 'excel',
  onClose,
}) => {
  if (!isOpen) return null;
  return <ImportModalBody initialTab={initialTab} onClose={onClose} />;
};

const ImportModalBody: React.FC<{ initialTab: ImportTabType; onClose: () => void }> = ({
  initialTab,
  onClose,
}) => {
  const { plans, activePlanId, catalogCourses, bulkAddToCatalog, bulkAddCourses } =
    useScheduleStore(
      useShallow((state) => ({
        plans: state.plans,
        activePlanId: state.activePlanId,
        catalogCourses: state.catalogCourses,
        bulkAddToCatalog: state.bulkAddToCatalog,
        bulkAddCourses: state.bulkAddCourses,
      }))
    );

  const activePlan = useMemo(
    () => plans.find((p) => p.id === activePlanId) || plans[0],
    [plans, activePlanId]
  );

  const [activeTab, setActiveTab] = useState<ImportTabType>(initialTab);
  const [successBanner, setSuccessBanner] = useState<{ count: number; destination: string } | null>(
    null
  );

  const handleImportToPool = (courses: Course[]) => {
    bulkAddToCatalog(courses);
  };

  const handleImportToPlanAndPool = (courses: Course[], planId: string) => {
    bulkAddCourses(courses, planId);
  };

  const handleSuccess = (count: number, destination: string) => {
    setSuccessBanner({ count, destination });
    setTimeout(() => {
      onClose();
    }, 1400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl sm:max-w-3xl w-full p-4 sm:p-6 my-auto max-h-[calc(100dvh-1.25rem)] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="min-w-0 pr-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
              Import Courses & Schedule
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
              Active Plan: <strong className="text-indigo-600 dark:text-indigo-400">{activePlan.name}</strong> · Saved in Pool: <strong className="text-slate-700 dark:text-slate-200">{catalogCourses.length} courses</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors shrink-0"
            aria-label="Close import dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher - Responsive 3-col grid */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mt-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('excel')}
            className={`py-2 sm:py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center ${
              activeTab === 'excel'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Excel / CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ics')}
            className={`py-2 sm:py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center ${
              activeTab === 'ics'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Calendar (.ics)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`py-2 sm:py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center ${
              activeTab === 'backup'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">JSON Backup</span>
          </button>
        </div>

        {/* Success toast overlay if imported */}
        {successBanner && (
          <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 animate-in fade-in shrink-0">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Successfully imported {successBanner.count} courses into {successBanner.destination}! Closing...
            </span>
          </div>
        )}

        {/* Tab Body - Scrollable Container */}
        <div className="flex-1 overflow-y-auto min-h-0 pt-3 pr-0.5">
          {activeTab === 'excel' && (
            <ExcelImportTab
              activePlan={activePlan}
              onImportToPool={handleImportToPool}
              onImportToPlanAndPool={handleImportToPlanAndPool}
              onSuccess={handleSuccess}
            />
          )}

          {activeTab === 'ics' && (
            <IcsImportTab
              activePlan={activePlan}
              onImportToPool={handleImportToPool}
              onImportToPlanAndPool={handleImportToPlanAndPool}
              onSuccess={handleSuccess}
            />
          )}

          {activeTab === 'backup' && (
            <BackupRestoreTab onSuccess={onClose} />
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-center"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
