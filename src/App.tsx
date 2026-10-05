/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useReducedMotion } from 'motion/react';
import { useScheduleStore } from './store/useScheduleStore';
import { Header } from './components/header/Header';
import { CalendarGrid } from './components/CalendarGrid';
import type { ExportTabType } from './components/export/ExportModal';
import type { ImportTabType } from './components/import/ImportModal';
import { CoursePoolSidebar } from './components/course-pool/CoursePoolSidebar';
import type { HelpTabType } from './components/HelpModal';
import { StorageWriteBanner } from './components/StorageWriteBanner';
import { MobileDock } from './components/app/MobileDock';
import { useAppShortcuts } from './components/app/useAppShortcuts';
import { OfflineIndicator } from './components/OfflineIndicator';
import { DayOfWeek, SchedulePlan } from './types/schedule';
import { applyDomTheme } from './utils/theme';
import { extractSharePayloadFromUrl, decodePlanFromSharePayload } from './utils/shareLink';

const CourseModal = lazy(() => import('./components/course-modal/CourseModal').then((m) => ({ default: m.CourseModal })));
const ExportModal = lazy(() => import('./components/export/ExportModal').then((m) => ({ default: m.ExportModal })));
const ImportModal = lazy(() => import('./components/import/ImportModal').then((m) => ({ default: m.ImportModal })));
const HelpModal = lazy(() => import('./components/HelpModal').then((m) => ({ default: m.HelpModal })));
const ShareImportModal = lazy(() => import('./components/ShareImportModal').then((m) => ({ default: m.ShareImportModal })));
const PWAReloadPrompt = lazy(() => import('./components/pwa/PWAReloadPrompt').then((m) => ({ default: m.PWAReloadPrompt })));

// A lazy component starts downloading when it is rendered. Keep dialogs out of
// the first render, then leave them mounted so their close animation can finish.
function useMountWhenOpened(open: boolean): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);
  return mounted;
}

function DeferredDialog({ mounted, children }: { mounted: boolean; children: React.ReactNode }) {
  if (!mounted) return null;
  return <Suspense fallback={null}>{children}</Suspense>;
}

export default function App() {
  const plans = useScheduleStore((state) => state.plans);
  const activePlanId = useScheduleStore((state) => state.activePlanId);
  const catalogCount = useScheduleStore((state) => state.catalogCourses.length);
  const setActivePlan = useScheduleStore((state) => state.setActivePlan);
  const duplicatePlan = useScheduleStore((state) => state.duplicatePlan);
  const importPlan = useScheduleStore((state) => state.importPlan);
  const toggleTheme = useScheduleStore((state) => state.toggleTheme);
  const undo = useScheduleStore((state) => state.undo);
  const redo = useScheduleStore((state) => state.redo);
  const resetToBlank = useScheduleStore((state) => state.resetToBlank);
  const resetToSample = useScheduleStore((state) => state.resetToSample);

  // Modals & Sidebar state
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCoursePlanId, setEditingCoursePlanId] = useState<string | null>(null);
  const [modalInitialDay, setModalInitialDay] = useState<DayOfWeek>('monday');
  const [modalInitialStartTime, setModalInitialStartTime] = useState<string>('09:00');
  const [modalInitialMode, setModalInitialMode] = useState<'form' | 'quick'>('form');

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportInitialTab, setExportInitialTab] = useState<ExportTabType>('share');

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importInitialTab, setImportInitialTab] = useState<ImportTabType>('excel');

  const [isPoolCollapsed, setIsPoolCollapsed] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpInitialTab, setHelpInitialTab] = useState<HelpTabType>('workflow');

  const [isShareImportOpen, setIsShareImportOpen] = useState(false);
  const courseModalMounted = useMountWhenOpened(isCourseModalOpen);
  const exportModalMounted = useMountWhenOpened(isExportOpen);
  const importModalMounted = useMountWhenOpened(isImportOpen);
  const helpModalMounted = useMountWhenOpened(isHelpOpen);
  const shareImportMounted = useMountWhenOpened(isShareImportOpen);
  const [sharedPlan, setSharedPlan] = useState<SchedulePlan | null>(null);
  const [initialManualPaste, setInitialManualPaste] = useState(false);

  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const closeMoreMenu = useCallback(() => {
    setIsMoreOpen(false);
    setIsConfirmingClear(false);
  }, []);

  const handleCloseCourseModal = useCallback(() => setIsCourseModalOpen(false), []);
  const handleCloseExport = useCallback(() => setIsExportOpen(false), []);
  const handleCloseImport = useCallback(() => setIsImportOpen(false), []);
  const handleCloseHelp = useCallback(() => setIsHelpOpen(false), []);
  const handleCollapsePool = useCallback(() => setIsPoolCollapsed(true), []);

  useEffect(() => {
    // Wait for the initial frame paint to complete before revealing the app,
    // ensuring a silky-smooth crossfade from the PWA splash screen without hitching.
    const raf = requestAnimationFrame(() => {
      document.documentElement.classList.add('up-ready');
    });
    applyDomTheme(useScheduleStore.getState().theme);
    const unsub = useScheduleStore.subscribe((state, previous) => {
      if (state.theme !== previous.theme) applyDomTheme(state.theme);
    });
    return () => {
      cancelAnimationFrame(raf);
      unsub();
    };
  }, []);

  // Listen for #share=<payload> in URL on mount and on hash change
  useEffect(() => {
    const checkHash = () => {
      const payload = extractSharePayloadFromUrl(window.location.hash);
      if (payload) {
        const res = decodePlanFromSharePayload(payload);
        if (res.success && res.plan) {
          setSharedPlan(res.plan);
          setInitialManualPaste(false);
          setIsShareImportOpen(true);
        }
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // Handlers for Shared Plan import
  const handleCompareWithSharedPlan = useCallback(
    (plan: SchedulePlan) => {
      importPlan(plan, true);
      setIsShareImportOpen(false);
      setSharedPlan(null);
      if (window.location.hash.includes('share=')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    },
    [importPlan]
  );

  const handleOpenSharedPlanAsActive = useCallback(
    (plan: SchedulePlan) => {
      importPlan(plan, false);
      setIsShareImportOpen(false);
      setSharedPlan(null);
      if (window.location.hash.includes('share=')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    },
    [importPlan]
  );

  const handleOpenImportShare = useCallback(() => {
    setSharedPlan(null);
    setInitialManualPaste(true);
    setIsShareImportOpen(true);
  }, []);

  // Handler for opening new course modal
  const handleOpenNewCourse = useCallback(
    (day: DayOfWeek = 'monday', startTime: string = '09:00', mode: 'form' | 'quick' = 'form', targetPlanId?: string) => {
      setIsPoolCollapsed(true);
      setEditingCourseId(null);
      setEditingCoursePlanId(targetPlanId || null);
      setModalInitialDay(day);
      setModalInitialStartTime(startTime);
      setModalInitialMode(mode);
      setIsCourseModalOpen(true);
    },
    []
  );

  const handleAddCourseAtTime = useCallback((day: DayOfWeek, time: string) => {
    handleOpenNewCourse(day, time, 'form');
  }, [handleOpenNewCourse]);

  const handleOpenCalendarCourse = useCallback((mode?: 'form' | 'quick') => {
    handleOpenNewCourse('monday', '09:00', mode ?? 'form');
  }, [handleOpenNewCourse]);

  // Handler for editing an existing course
  const handleEditCourse = useCallback((courseId: string, planId?: string) => {
    setIsPoolCollapsed(true);
    setEditingCourseId(courseId);
    setEditingCoursePlanId(planId || null);
    setModalInitialMode('form');
    setIsCourseModalOpen(true);
  }, []);

  const handleOpenExport = useCallback((tab: ExportTabType = 'text') => {
    setIsPoolCollapsed(true);
    setExportInitialTab(tab);
    setIsExportOpen(true);
  }, []);

  const handleOpenShareModal = useCallback((plan?: SchedulePlan) => {
    if (plan && plan.id !== activePlanId) {
      setActivePlan(plan.id);
    }
    handleOpenExport('share');
  }, [activePlanId, handleOpenExport, setActivePlan]);

  const handleOpenImport = useCallback((tab: ImportTabType = 'excel') => {
    setIsPoolCollapsed(true);
    setImportInitialTab(tab);
    setIsImportOpen(true);
  }, []);

  const handleOpenHelp = useCallback((tab: HelpTabType = 'workflow') => {
    setIsPoolCollapsed(true);
    setHelpInitialTab(tab);
    setIsHelpOpen(true);
  }, []);

  const handleOpenShortcuts = useCallback(() => {
    handleOpenHelp('shortcuts');
  }, [handleOpenHelp]);

  const handleToggleMore = useCallback(() => {
    setIsConfirmingClear(false);
    setIsMoreOpen((open) => !open);
  }, []);

  const handleRequestClear = useCallback(() => {
    setIsConfirmingClear(true);
  }, []);

  const handleCancelClear = useCallback(() => {
    setIsConfirmingClear(false);
  }, []);

  const handleConfirmClearDock = useCallback(() => {
    resetToBlank();
    closeMoreMenu();
  }, [resetToBlank, closeMoreMenu]);

  const handleLoadDemo = useCallback(() => {
    resetToSample();
  }, [resetToSample]);

  const isAnyModalOpen =
    isCourseModalOpen || isExportOpen || isImportOpen || isHelpOpen || isShareImportOpen;

  useAppShortcuts({
    plans,
    activePlanId,
    isMoreOpen,
    isConfirmingClear,
    isAnyModalOpen,
    onOpenNewCourse: handleOpenNewCourse,
    onOpenExport: () => handleOpenExport('text'),
    onOpenImport: () => handleOpenImport('excel'),
    onOpenShare: handleOpenShareModal,
    onTogglePool: () => setIsPoolCollapsed((prev) => !prev),
    onToggleTheme: toggleTheme,
    onOpenHelp: handleOpenHelp,
    onOpenShortcuts: handleOpenShortcuts,
    onDuplicatePlan: duplicatePlan,
    onUndo: undo,
    onRedo: redo,
    onSetActivePlan: setActivePlan,
    onSetMoreOpen: setIsMoreOpen,
    onSetConfirmingClear: setIsConfirmingClear,
    onCloseCourseModal: handleCloseCourseModal,
    onCloseExport: handleCloseExport,
    onCloseImport: handleCloseImport,
    onCloseHelp: handleCloseHelp,
    onCloseShareImport: () => setIsShareImportOpen(false),
    onCollapsePool: handleCollapsePool,
  });

  return (
    <div className="up-app bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col w-full max-w-full min-w-0">
      <StorageWriteBanner />
      <main className="up-workspace flex-1 max-w-[1720px] w-full min-w-0 mx-auto p-2.5 sm:p-4 md:p-5 flex flex-col gap-2.5 sm:gap-3 min-h-0 overflow-x-clip">
        {/* Header: brand, enrolled readout, plans, compare, settings */}
        <Header
          onOpenNewCourse={(mode) => handleOpenNewCourse('monday', '09:00', mode || 'form')}
          onOpenExport={() => handleOpenExport('text')}
          onOpenImport={handleOpenImport}
          onOpenShortcuts={handleOpenShortcuts}
          onOpenHelp={() => handleOpenHelp('workflow')}
          onOpenCatalog={() => setIsPoolCollapsed(false)}
          onOpenShare={handleOpenShareModal}
          onOpenImportShare={handleOpenImportShare}
        />

        {/* Workspace: Calendar Grid and Course Pool Sidebar */}
        <div className="up-workspace-body flex-1 flex flex-col lg:flex-row gap-3 min-h-0 min-w-0 items-stretch">
          {/* Main Weekly Calendar Grid */}
          <div className="up-calendar-slot flex-1 min-w-0 max-w-full flex flex-col min-h-0 relative overflow-hidden">
            <CalendarGrid
              onEditCourse={handleEditCourse}
              onAddCourseAtTime={handleAddCourseAtTime}
              onOpenNewCourse={handleOpenCalendarCourse}
            />
          </div>

          {/* Course Pool Sidebar on the right (bottom on mobile, drawer on tablet) */}
          <CoursePoolSidebar
            isCollapsed={isPoolCollapsed}
            onToggleCollapse={() => setIsPoolCollapsed((prev) => !prev)}
            onOpenNewCourse={(mode) => handleOpenNewCourse('monday', '09:00', mode || 'form')}
            onOpenImport={() => handleOpenImport('excel')}
            onEditCourse={handleEditCourse}
          />
        </div>
      </main>

      <MobileDock
        isMoreOpen={isMoreOpen}
        isConfirmingClear={isConfirmingClear}
        catalogCount={catalogCount}
        reduceMotion={reduceMotion}
        onToggleMore={handleToggleMore}
        onTogglePool={() => setIsPoolCollapsed((prev) => !prev)}
        onAddCourse={() => handleOpenNewCourse('monday', '09:00', 'form')}
        onLoadDemo={handleLoadDemo}
        onOpenShortcuts={handleOpenShortcuts}
        onOpenHelp={() => handleOpenHelp('workflow')}
        onRequestClear={handleRequestClear}
        onConfirmClear={handleConfirmClearDock}
        onCancelClear={handleCancelClear}
        onCloseMoreMenu={closeMoreMenu}
      />

      <DeferredDialog mounted={courseModalMounted}>
        <CourseModal
          isOpen={isCourseModalOpen}
          onClose={handleCloseCourseModal}
          editingCourseId={editingCourseId}
          targetPlanId={editingCoursePlanId}
          initialDay={modalInitialDay}
          initialStartTime={modalInitialStartTime}
          initialMode={modalInitialMode}
        />
      </DeferredDialog>

      <DeferredDialog mounted={exportModalMounted}>
        <ExportModal
          isOpen={isExportOpen}
          initialTab={exportInitialTab}
          onClose={handleCloseExport}
        />
      </DeferredDialog>

      <DeferredDialog mounted={importModalMounted}>
        <ImportModal
          isOpen={isImportOpen}
          initialTab={importInitialTab}
          onClose={handleCloseImport}
        />
      </DeferredDialog>

      <DeferredDialog mounted={helpModalMounted}>
        <HelpModal
          isOpen={isHelpOpen}
          initialTab={helpInitialTab}
          onClose={handleCloseHelp}
          onOpenImport={handleOpenImport}
          onOpenExport={() => handleOpenExport('text')}
          onOpenCatalog={() => setIsPoolCollapsed(false)}
          onOpenShortcuts={handleOpenShortcuts}
        />
      </DeferredDialog>

      <DeferredDialog mounted={shareImportMounted}>
        <ShareImportModal
          isOpen={isShareImportOpen}
          onClose={() => setIsShareImportOpen(false)}
          sharedPlan={sharedPlan}
          onCompareWithSchedule={handleCompareWithSharedPlan}
          onOpenAsActivePlan={handleOpenSharedPlanAsActive}
          initialManualPaste={initialManualPaste}
        />
      </DeferredDialog>

      <Suspense fallback={null}>
        <PWAReloadPrompt />
      </Suspense>

      <OfflineIndicator />
    </div>
  );
}
