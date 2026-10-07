/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { useReducedMotion } from 'motion/react';
import { useScheduleStore } from './store/useScheduleStore';
import { Header } from './components/header/Header';
import { CalendarGrid } from './components/CalendarGrid';
import type { ExportTabType } from './components/export/ExportModal';
import type { ImportTabType } from './components/import/ImportModal';
import { CoursePoolSidebar } from './components/course-pool/CoursePoolSidebar';
import type { HelpTabType } from './components/HelpModal';
import { StorageWriteBanner } from './components/StorageWriteBanner';
import { DeferredDialog, DialogReplaceAppearContext, SuppressFocusRestoreContext } from './components/app/DeferredDialog';
import { MobileDock } from './components/app/MobileDock';
import { useAppShortcuts, type ShortcutSurface } from './components/app/useAppShortcuts';
import { OfflineIndicator } from './components/OfflineIndicator';
import { DayOfWeek, SchedulePlan } from './types/schedule';
import { applyDomTheme, persistTheme } from './utils/theme';
import { isThemeRevealing, runThemeReveal } from './utils/themeTransition';
import { extractSharePayloadFromUrl, decodePlanFromSharePayload } from './utils/shareLink';

// Start these with the app shell so the first open does not wait on a download.
function loadDialog<T>(loader: Promise<T>): Promise<T> {
  loader.catch(() => {});
  return loader;
}
const courseModalModule = loadDialog(import('./components/course-modal/CourseModal').then((m) => ({ default: m.CourseModal })));
const exportModalModule = loadDialog(import('./components/export/ExportModal').then((m) => ({ default: m.ExportModal })));
const importModalModule = loadDialog(import('./components/import/ImportModal').then((m) => ({ default: m.ImportModal })));
const helpModalModule = loadDialog(import('./components/HelpModal').then((m) => ({ default: m.HelpModal })));
const shareImportModalModule = loadDialog(import('./components/ShareImportModal').then((m) => ({ default: m.ShareImportModal })));
const CourseModal = lazy(() => courseModalModule);
const ExportModal = lazy(() => exportModalModule);
const ImportModal = lazy(() => importModalModule);
const HelpModal = lazy(() => helpModalModule);
const ShareImportModal = lazy(() => shareImportModalModule);
const PWAReloadPrompt = lazy(() => import('./components/pwa/PWAReloadPrompt').then((m) => ({ default: m.PWAReloadPrompt })));

function shortcutSurfaceForCourseMode(mode: 'form' | 'quick', editing: boolean): ShortcutSurface | null {
  switch (mode) {
    case 'quick':
      return 'course-quick';
    case 'form':
      return editing ? null : 'course-form';
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

function shortcutSurfaceForExportTab(tab: ExportTabType): ShortcutSurface | null {
  switch (tab) {
    case 'text':
      return 'export';
    case 'share':
      return 'share';
    case 'ics':
    case 'image':
    case 'backup':
      return null;
    default: {
      const exhaustive: never = tab;
      return exhaustive;
    }
  }
}

function shortcutSurfaceForHelpTab(tab: HelpTabType): ShortcutSurface | null {
  switch (tab) {
    case 'workflow':
      return 'help';
    case 'shortcuts':
      return 'shortcuts';
    case 'pool':
    case 'import':
    case 'export':
      return null;
    default: {
      const exhaustive: never = tab;
      return exhaustive;
    }
  }
}

function isOpenShortcutSurface(
  surface: ShortcutSurface,
  state: {
    shortcutSurface: ShortcutSurface | null;
    isCourseModalOpen: boolean;
    editingCourseId: string | null;
    isExportOpen: boolean;
    isImportOpen: boolean;
    isHelpOpen: boolean;
    isPoolCollapsed: boolean;
    isAnyModalOpen: boolean;
  },
): boolean {
  switch (surface) {
    case 'course-form':
      return state.isCourseModalOpen && !state.editingCourseId && state.shortcutSurface === 'course-form';
    case 'course-quick':
      return state.isCourseModalOpen && state.shortcutSurface === 'course-quick';
    case 'export':
      return state.isExportOpen && state.shortcutSurface === 'export';
    case 'share':
      return state.isExportOpen && state.shortcutSurface === 'share';
    case 'import':
      return state.isImportOpen;
    case 'help':
      return state.isHelpOpen && state.shortcutSurface === 'help';
    case 'shortcuts':
      return state.isHelpOpen && state.shortcutSurface === 'shortcuts';
    case 'pool':
      return !state.isPoolCollapsed && !state.isAnyModalOpen;
    default: {
      const exhaustive: never = surface;
      return exhaustive;
    }
  }
}

export default function App() {
  const activePlanId = useScheduleStore((state) => state.activePlanId);
  const catalogCount = useScheduleStore((state) => state.catalogCourses.length);
  const setActivePlan = useScheduleStore((state) => state.setActivePlan);
  const duplicatePlan = useScheduleStore((state) => state.duplicatePlan);
  const importPlan = useScheduleStore((state) => state.importPlan);
  const commitTheme = useScheduleStore((state) => state.commitTheme);
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
  const [sharedPlan, setSharedPlan] = useState<SchedulePlan | null>(null);
  const [initialManualPaste, setInitialManualPaste] = useState(false);

  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [instantDismiss, setInstantDismiss] = useState(false);
  const [replaceAppear, setReplaceAppear] = useState(false);
  const [shortcutSurface, setShortcutSurface] = useState<ShortcutSurface | null>(null);
  const [courseSession, setCourseSession] = useState(0);
  const [exportSession, setExportSession] = useState(0);
  const [helpSession, setHelpSession] = useState(0);
  const suppressFocusRestoreRef = useRef(false);
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
    // Seamless native-style splash dismiss once the first frame has painted on GPU
    const dismissSplash = () => {
      const revealApp = () => {
        document.documentElement.classList.remove('up-preload');
        document.documentElement.classList.add('up-ready');
      };
      const splash = document.getElementById('app-launch-splash');
      if (!splash) {
        revealApp();
        return;
      }
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      splash.classList.add('is-hidden');
      window.setTimeout(() => {
        splash.remove();
        revealApp();
      }, reduce ? 0 : 320);
    };

    // Double requestAnimationFrame ensures React has committed DOM and browser has completed first composite
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dismissSplash();
      });
    });

    applyDomTheme(useScheduleStore.getState().theme);
    const unsub = useScheduleStore.subscribe((state, previous) => {
      if (state.theme !== previous.theme) applyDomTheme(state.theme);
    });
    return () => {
      unsub();
    };
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
      setShortcutSurface(shortcutSurfaceForCourseMode(mode, false));
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
    setShortcutSurface(null);
    setIsCourseModalOpen(true);
  }, []);

  const handleOpenExport = useCallback((tab: ExportTabType = 'text') => {
    setIsPoolCollapsed(true);
    setExportInitialTab(tab);
    setShortcutSurface(shortcutSurfaceForExportTab(tab));
    setIsExportOpen(true);
  }, []);

  // Listen for #share=<payload> and native quick shortcut hashes in URL on mount and on hash change
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      if (!hash) return;
      if (hash.includes('share=')) {
        const payload = extractSharePayloadFromUrl(hash);
        if (payload) {
          const res = decodePlanFromSharePayload(payload);
          if (res.success && res.plan) {
            setSharedPlan(res.plan);
            setInitialManualPaste(false);
            setIsShareImportOpen(true);
          }
        }
      } else if (hash === '#add') {
        handleOpenNewCourse('monday', '09:00', 'form');
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } else if (hash === '#pool') {
        setIsPoolCollapsed(false);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } else if (hash === '#export') {
        handleOpenExport('share');
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [handleOpenNewCourse, handleOpenExport]);

  const handleOpenShareModal = useCallback((plan?: SchedulePlan) => {
    if (plan && plan.id !== activePlanId) {
      setActivePlan(plan.id);
    }
    handleOpenExport('share');
  }, [activePlanId, handleOpenExport, setActivePlan]);

  const handleOpenImport = useCallback((tab: ImportTabType = 'excel') => {
    setIsPoolCollapsed(true);
    setImportInitialTab(tab);
    setShortcutSurface('import');
    setIsImportOpen(true);
  }, []);

  const handleOpenHelp = useCallback((tab: HelpTabType = 'workflow') => {
    setIsPoolCollapsed(true);
    setHelpInitialTab(tab);
    setShortcutSurface(shortcutSurfaceForHelpTab(tab));
    setIsHelpOpen(true);
  }, []);

  const handleCourseModeChange = useCallback((mode: 'form' | 'quick', editing: boolean) => {
    setShortcutSurface(shortcutSurfaceForCourseMode(mode, editing));
  }, []);

  const handleExportTabChange = useCallback((tab: ExportTabType) => {
    setShortcutSurface(shortcutSurfaceForExportTab(tab));
  }, []);

  const handleHelpTabChange = useCallback((tab: HelpTabType) => {
    setShortcutSurface(shortcutSurfaceForHelpTab(tab));
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

  useEffect(() => {
    if (!instantDismiss) return;
    const id = requestAnimationFrame(() => setInstantDismiss(false));
    return () => cancelAnimationFrame(id);
  }, [instantDismiss]);

  useEffect(() => {
    if (!replaceAppear) return;
    const id = requestAnimationFrame(() => setReplaceAppear(false));
    return () => cancelAnimationFrame(id);
  }, [replaceAppear]);

  // Passive cleanups run before this, so a course dialog removed in the same commit still sees the flag.
  useEffect(() => {
    suppressFocusRestoreRef.current = false;
  });

  const handleModalShortcut = useCallback((surface: ShortcutSurface) => {
    const closeDialogs = () => {
      setIsCourseModalOpen(false);
      setIsExportOpen(false);
      setIsImportOpen(false);
      setIsHelpOpen(false);
      setIsShareImportOpen(false);
    };

    const current = {
      shortcutSurface,
      isCourseModalOpen,
      editingCourseId,
      isExportOpen,
      isImportOpen,
      isHelpOpen,
      isPoolCollapsed,
      isAnyModalOpen,
    };

    if (isOpenShortcutSurface(surface, current)) {
      setReplaceAppear(false);
      setShortcutSurface(null);
      if (surface === 'pool') setIsPoolCollapsed(true);
      else closeDialogs();
      return;
    }

    const replacingDialog = isAnyModalOpen && surface !== 'pool';
    if (isCourseModalOpen) suppressFocusRestoreRef.current = true;
    setInstantDismiss(isAnyModalOpen);
    setReplaceAppear(replacingDialog);
    closeDialogs();
    if (surface !== 'pool') setIsPoolCollapsed(true);

    const remountIfOpen = (open: boolean, bump: () => void) => {
      if (open) bump();
    };

    switch (surface) {
      case 'course-form':
        remountIfOpen(isCourseModalOpen, () => setCourseSession((session) => session + 1));
        handleOpenNewCourse('monday', '09:00', 'form');
        break;
      case 'course-quick':
        remountIfOpen(isCourseModalOpen, () => setCourseSession((session) => session + 1));
        handleOpenNewCourse('monday', '09:00', 'quick');
        break;
      case 'export':
        remountIfOpen(isExportOpen, () => setExportSession((session) => session + 1));
        handleOpenExport('text');
        break;
      case 'share':
        remountIfOpen(isExportOpen, () => setExportSession((session) => session + 1));
        handleOpenExport('share');
        break;
      case 'import':
        handleOpenImport('excel');
        break;
      case 'help':
        remountIfOpen(isHelpOpen, () => setHelpSession((session) => session + 1));
        handleOpenHelp('workflow');
        break;
      case 'shortcuts':
        remountIfOpen(isHelpOpen, () => setHelpSession((session) => session + 1));
        handleOpenHelp('shortcuts');
        break;
      case 'pool':
        setReplaceAppear(false);
        setShortcutSurface(null);
        setIsPoolCollapsed(false);
        break;
      default: {
        const exhaustive: never = surface;
        return exhaustive;
      }
    }
  }, [
    editingCourseId,
    handleOpenExport,
    handleOpenHelp,
    handleOpenImport,
    handleOpenNewCourse,
    isAnyModalOpen,
    isCourseModalOpen,
    isExportOpen,
    isHelpOpen,
    isImportOpen,
    isPoolCollapsed,
    shortcutSurface,
  ]);

  const handleShortcutToggleTheme = useCallback(() => {
    if (isThemeRevealing()) return;
    const currentTheme = useScheduleStore.getState().theme;
    const goingToDark = currentTheme !== 'dark';
    const next = goingToDark ? 'dark' : 'light';

    const event = {
      clientX: window.innerWidth / 2,
      clientY: window.innerHeight / 2,
      currentTarget: null,
    };

    runThemeReveal({
      event,
      goingToDark,
      apply: () => {
        applyDomTheme(next);
        persistTheme(next);
      },
      commit: () => {
        commitTheme(next);
      },
    });
  }, [commitTheme]);

  useAppShortcuts({
    activePlanId,
    isMoreOpen,
    isConfirmingClear,
    isAnyModalOpen,
    onModalShortcut: handleModalShortcut,
    onToggleTheme: handleShortcutToggleTheme,
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
        <div className="up-workspace-body flex-1 flex flex-col gap-3 min-h-0 min-w-0 items-stretch">
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

      <SuppressFocusRestoreContext.Provider value={suppressFocusRestoreRef}>
      <DialogReplaceAppearContext.Provider value={replaceAppear}>
      <DeferredDialog key={`course-${courseSession}`} open={isCourseModalOpen} onClose={handleCloseCourseModal} instantDismiss={instantDismiss}>
        <CourseModal
          isOpen={isCourseModalOpen}
          onClose={handleCloseCourseModal}
          editingCourseId={editingCourseId}
          targetPlanId={editingCoursePlanId}
          initialDay={modalInitialDay}
          initialStartTime={modalInitialStartTime}
          initialMode={modalInitialMode}
          onModeChange={handleCourseModeChange}
        />
      </DeferredDialog>

      <DeferredDialog key={`export-${exportSession}`} open={isExportOpen} onClose={handleCloseExport} instantDismiss={instantDismiss}>
        <ExportModal
          isOpen={isExportOpen}
          initialTab={exportInitialTab}
          onClose={handleCloseExport}
          onTabChange={handleExportTabChange}
        />
      </DeferredDialog>

      <DeferredDialog open={isImportOpen} onClose={handleCloseImport} instantDismiss={instantDismiss}>
        <ImportModal
          isOpen={isImportOpen}
          initialTab={importInitialTab}
          onClose={handleCloseImport}
        />
      </DeferredDialog>

      <DeferredDialog key={`help-${helpSession}`} open={isHelpOpen} onClose={handleCloseHelp} instantDismiss={instantDismiss}>
        <HelpModal
          isOpen={isHelpOpen}
          initialTab={helpInitialTab}
          onClose={handleCloseHelp}
          onOpenImport={handleOpenImport}
          onOpenExport={() => handleOpenExport('text')}
          onOpenCatalog={() => setIsPoolCollapsed(false)}
          onOpenShortcuts={handleOpenShortcuts}
          onTabChange={handleHelpTabChange}
        />
      </DeferredDialog>

      <DeferredDialog open={isShareImportOpen} onClose={() => setIsShareImportOpen(false)} instantDismiss={instantDismiss}>
        <ShareImportModal
          isOpen={isShareImportOpen}
          onClose={() => setIsShareImportOpen(false)}
          sharedPlan={sharedPlan}
          onCompareWithSchedule={handleCompareWithSharedPlan}
          onOpenAsActivePlan={handleOpenSharedPlanAsActive}
          initialManualPaste={initialManualPaste}
        />
      </DeferredDialog>
      </DialogReplaceAppearContext.Provider>
      </SuppressFocusRestoreContext.Provider>

      <Suspense fallback={null}>
        <PWAReloadPrompt />
      </Suspense>

      <OfflineIndicator />
    </div>
  );
}
