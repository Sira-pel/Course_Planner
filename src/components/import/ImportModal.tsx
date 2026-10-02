import React, { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { useScheduleStore } from '../../store/useScheduleStore';
import type { Course, SchedulePlan } from '../../types/schedule';
import { X, FileSpreadsheet, Calendar, Database, Check, Share2 } from 'lucide-react';
import { EASE_OUT } from '../../utils/motion';
import { ExcelImportTab } from './ExcelImportTab';
import { IcsImportTab } from './IcsImportTab';
import { BackupRestoreTab } from './BackupRestoreTab';
import { FriendShareImportTab } from './FriendShareImportTab';

export type ImportTabType = 'excel' | 'share' | 'ics' | 'backup';

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
  return (
    <AnimatePresence>
      {isOpen && <ImportModalBody initialTab={initialTab} onClose={onClose} />}
    </AnimatePresence>
  );
};

const ImportModalBody: React.FC<{ initialTab: ImportTabType; onClose: () => void }> = ({
  initialTab,
  onClose,
}) => {
  const { plans, activePlanId, catalogCourses, bulkAddToCatalog, bulkAddCourses, importPlan } =
    useScheduleStore(
      useShallow((state) => ({
        plans: state.plans,
        activePlanId: state.activePlanId,
        catalogCourses: state.catalogCourses,
        bulkAddToCatalog: state.bulkAddToCatalog,
        bulkAddCourses: state.bulkAddCourses,
        importPlan: state.importPlan,
      }))
    );

  // Close modal when user presses Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

  const importTabs: { id: ImportTabType; label: string; icon: React.ReactNode }[] = [
    { id: 'excel', label: 'Excel / CSV', icon: <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'share', label: 'Friend Link', icon: <Share2 className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'ics', label: 'Calendar (.ics)', icon: <Calendar className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'backup', label: 'JSON Backup', icon: <Database className="w-3.5 h-3.5 shrink-0" /> },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 4 }}
        transition={{ duration: 0.22, ease: EASE_OUT }}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl sm:max-w-3xl w-full min-w-0 p-4 sm:p-6 my-auto max-h-[calc(100dvh-1.25rem)] sm:max-h-[90vh] flex flex-col overflow-hidden will-change-transform"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="min-w-0 pr-2">
            <h2 id="import-modal-title" className="text-base font-bold text-slate-900 dark:text-white truncate">
              Import Courses & Schedule
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
              Active Plan: <strong className="text-indigo-600 dark:text-indigo-400">{activePlan.name}</strong> · Saved in Pool: <strong className="text-slate-700 dark:text-slate-200">{catalogCourses.length} courses</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors shrink-0 up-chrome-btn"
            aria-label="Close import dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher - Responsive 4-col grid with smooth sliding pill */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mt-3 shrink-0 relative">
          {importTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative py-2 sm:py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 text-center transition-colors duration-150 z-10 ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="activeImportTabPill"
                    className="absolute inset-0 bg-white dark:bg-slate-900 rounded-lg shadow-xs -z-10"
                    transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                  />
                )}
                {tab.icon}
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Success toast overlay if imported */}
        <AnimatePresence>
          {successBanner && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 shrink-0 overflow-hidden"
            >
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Successfully imported {successBanner.count} courses into {successBanner.destination}! Closing...
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Body - Scrollable Container with Smooth Cross-fade */}
        <div className="flex-1 overflow-y-auto min-h-0 pt-3 pr-0.5">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: EASE_OUT }}
              className="min-h-full"
            >
              {activeTab === 'excel' && (
                <ExcelImportTab
                  activePlan={activePlan}
                  onImportToPool={handleImportToPool}
                  onImportToPlanAndPool={handleImportToPlanAndPool}
                  onSuccess={handleSuccess}
                />
              )}

              {activeTab === 'share' && (
                <FriendShareImportTab
                  onCompareWithSchedule={(plan) => {
                    importPlan(plan, true);
                    onClose();
                  }}
                  onOpenAsActivePlan={(plan) => {
                    importPlan(plan, false);
                    onClose();
                  }}
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
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-center up-chrome-btn active:scale-95"
          >
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
