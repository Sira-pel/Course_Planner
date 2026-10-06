import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { useScheduleStore } from '../../store/useScheduleStore';
import type { Course, SchedulePlan } from '../../types/schedule';
import { X, FileSpreadsheet, Calendar, Database, Check, Share2 } from 'lucide-react';
import { EASE_OUT, EASE_SMOOTH } from '../../utils/motion';
import { useModalBackdropHandoff, useSkipContentEnter } from '../app/DeferredDialog';
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
    <ImportModalBody
      isOpen={isOpen}
      initialTab={initialTab}
      onClose={onClose}
    />
  );
};

const ImportModalBody: React.FC<{
  isOpen: boolean;
  initialTab: ImportTabType;
  onClose: () => void;
}> = ({
  isOpen,
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
  const backdropHandoff = useModalBackdropHandoff(isOpen);
  const skipContentEnter = useSkipContentEnter(isOpen);

  // Close modal when user presses Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const activePlan = useMemo(
    () => plans.find((p) => p.id === activePlanId) || plans[0],
    [plans, activePlanId]
  );

  const [activeTab, setActiveTab] = useState<ImportTabType>(initialTab);
  const contentRef = useRef<HTMLDivElement>(null);

  // Sync activeTab when opened with a new initialTab
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSuccessBanner(null);
    }
  }, [isOpen, initialTab]);

  // Reset scroll position to top whenever active tab changes to prevent scroll glitching
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

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

  const importTabs: { id: ImportTabType; label: string; mobileLabel: string; icon: React.ReactNode }[] = [
    { id: 'excel', label: 'Excel / CSV', mobileLabel: 'Excel', icon: <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'share', label: 'Friend Link', mobileLabel: 'Friend', icon: <Share2 className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'ics', label: 'Calendar (.ics)', mobileLabel: 'Calendar', icon: <Calendar className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'backup', label: 'JSON Backup', mobileLabel: 'Backup', icon: <Database className="w-3.5 h-3.5 shrink-0" /> },
  ];

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="import-modal-overlay"
          className="fixed inset-0 z-[100] course-modal-backdrop flex items-start sm:items-center justify-center p-2.5 sm:p-4 bg-black/60 md:backdrop-blur-xs overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          initial={{ opacity: backdropHandoff ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: EASE_SMOOTH }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
        initial={{ scale: 0.97, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.975, y: 4 }}
        transition={{ duration: 0.24, ease: EASE_SMOOTH }}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl sm:max-w-3xl w-full min-w-0 p-3 sm:p-5 my-auto max-h-[calc(100dvh-1.25rem)] sm:max-h-[90vh] flex flex-col overflow-hidden will-change-transform"
      >
        {/* Header - Compact on mobile */}
        <div className="flex items-center justify-between pb-2 sm:pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="min-w-0 pr-2">
            <h2 id="import-modal-title" className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
              Import Courses & Schedule
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              Plan: <strong className="text-indigo-600 dark:text-indigo-400">{activePlan.name}</strong> · Pool: <strong className="text-slate-700 dark:text-slate-200">{catalogCourses.length} courses</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 sm:p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors shrink-0 up-chrome-btn"
            aria-label="Close import dialog"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Tab Switcher - Single clean row on all screen sizes */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mt-2 sm:mt-2.5 shrink-0 relative overflow-hidden [scrollbar-width:none]">
          {importTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative py-1.5 px-1 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 text-center transition-all duration-200 ease-out z-10 ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline truncate">{tab.label}</span>
                <span className="inline sm:hidden truncate">{tab.mobileLabel}</span>
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
              transition={{ duration: 0.24, ease: EASE_OUT }}
              className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 shrink-0 overflow-hidden"
            >
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Successfully imported {successBanner.count} courses into {successBanner.destination}! Closing...
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Body - Instant synchronous switch with silky fast fade */}
        <div
          ref={contentRef}
          className="flex-1 min-h-0 pt-2 sm:pt-3 flex flex-col overflow-y-auto overflow-x-hidden up-scroll overscroll-contain pr-0.5 [scrollbar-gutter:stable]"
        >
          <motion.div
            key={activeTab}
            initial={skipContentEnter ? false : { opacity: 0.25 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: EASE_SMOOTH }}
            className="w-full flex-1 flex flex-col min-h-0 will-change-[opacity] transform-gpu"
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
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
