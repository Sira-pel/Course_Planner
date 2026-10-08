import React, { useState, useRef, useEffect, useMemo, Suspense, lazy, memo } from 'react';
import { flushSync } from 'react-dom';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition, type Transition } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { useScheduleStore } from '../../store/useScheduleStore';
import type { ExportTabType } from '../export/ExportModal';
import { applyDomTheme, persistTheme, type ThemePreference } from '../../utils/theme';
import { revealingTheme, runThemeReveal } from '../../utils/themeTransition';
import { ImportExportMenu } from './ImportExportMenu';
import { countConflictPairs, detectPlanConflicts } from '../../utils/timeUtils';
import {
  Plus,
  AlertTriangle,
  Undo2,
  Redo2,
} from 'lucide-react';
import { useIsPhone } from '../../utils/usePoolLayout';
import type { SchedulePlan } from '../../types/schedule';
import type { ToastType } from '../app/AppToast';
import { PlansMenu } from './PlansMenu';
import { CompareMenu } from './CompareMenu';
import { SettingsMenu } from './SettingsMenu';
import { EASE_OUT, EASE_POP, EASE_SMOOTH, SHEET_OPEN_TRANSITION, SHEET_CLOSE_TRANSITION, MENU_OPEN_TRANSITION, MENU_CLOSE_TRANSITION } from '../../utils/motion';

const ConflictModal = lazy(() => import('./ConflictModal').then((m) => ({ default: m.ConflictModal })));

interface HeaderProps {
  onOpenNewCourse: (initialMode?: 'form' | 'quick') => void;
  onOpenExport: (tab?: ExportTabType, focus?: 'google') => void;
  onOpenImport?: (tab?: 'excel' | 'share' | 'ics' | 'backup') => void;
  onOpenShortcuts: () => void;
  onOpenHelp: () => void;
  onOpenCatalog: () => void;
  onOpenShare?: (plan?: SchedulePlan) => void;
  onOpenImportShare?: () => void;
  showToast: (text: string, type?: ToastType) => void;
  importExportOpen: boolean;
  onImportExportOpenChange: (open: boolean) => void;
  compareOpen: boolean;
  onCompareOpenChange: (open: boolean) => void;
}

export const Header = memo(function Header({
  onOpenNewCourse,
  onOpenExport,
  onOpenImport,
  onOpenShortcuts,
  onOpenHelp,
  onOpenCatalog,
  onOpenShare,
  onOpenImportShare,
  showToast,
  importExportOpen,
  onImportExportOpenChange,
  compareOpen,
  onCompareOpenChange,
}: HeaderProps) {
  const {
    plans,
    activePlanId,
    ghostPlanIds,
    showWeekends,
    startHour,
    endHour,
    timeRangeMode,
    weekStart,
    themePreference,
    setActivePlan,
    createPlan,
    duplicatePlan,
    renamePlan,
    deletePlan,
    toggleGhostPlan,
    clearGhostPlans,
    setShowWeekends,
    setTimeRange,
    setTimeRangeMode,
    setWeekStart,
    setThemePreference,
    mobileCalendarView,
    setMobileCalendarView,
    undo,
    redo,
    canUndo,
    canRedo,
    resetToBlank,
    resetToSample,
  } = useScheduleStore(
    useShallow((state) => ({
      plans: state.plans,
      activePlanId: state.activePlanId,
      ghostPlanIds: state.ghostPlanIds,
      showWeekends: state.showWeekends,
      startHour: state.startHour,
      endHour: state.endHour,
      timeRangeMode: state.timeRangeMode,
      weekStart: state.weekStart,
      themePreference: state.themePreference,
      setActivePlan: state.setActivePlan,
      createPlan: state.createPlan,
      duplicatePlan: state.duplicatePlan,
      renamePlan: state.renamePlan,
      deletePlan: state.deletePlan,
      toggleGhostPlan: state.toggleGhostPlan,
      clearGhostPlans: state.clearGhostPlans,
      setShowWeekends: state.setShowWeekends,
      setTimeRange: state.setTimeRange,
      setTimeRangeMode: state.setTimeRangeMode,
      setWeekStart: state.setWeekStart,
      setThemePreference: state.setThemePreference,
      mobileCalendarView: state.mobileCalendarView,
      setMobileCalendarView: state.setMobileCalendarView,
      undo: state.undo,
      redo: state.redo,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      resetToBlank: state.resetToBlank,
      resetToSample: state.resetToSample,
    }))
  );

  const reduceMotion = useReducedMotion();
  const isPhone = useIsPhone();
  const creditsMounted = useRef(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [plansMenuOpen, setPlansMenuOpen] = useState(false);
  const [newPlanInputName, setNewPlanInputName] = useState('');
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictModalMounted, setConflictModalMounted] = useState(false);

  useEffect(() => {
    if (conflictModalOpen) setConflictModalMounted(true);
  }, [conflictModalOpen]);
  const [planIdConfirmDelete, setPlanIdConfirmDelete] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const lastSettingsToggleAt = useRef<number>(0);
  const ghostDropdownRef = useRef<HTMLDivElement>(null);
  const plansDropdownRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const activePlan = useMemo(() => plans.find((p) => p.id === activePlanId) || plans[0], [plans, activePlanId]);
  const conflicts = useMemo(() => (activePlan ? detectPlanConflicts(activePlan.courses) : []), [activePlan?.courses]);
  const conflictCount = useMemo(() => countConflictPairs(conflicts), [conflicts]);
  const totalCredits = useMemo(
    () => activePlan?.courses.reduce((sum, c) => sum + (c.credits || 0), 0) || 0,
    [activePlan?.courses]
  );
  const classCount = activePlan?.courses.length || 0;

  const nextSuggestedName = useMemo(() => `Plan ${String.fromCharCode(65 + (plans.length % 26))}`, [plans.length]);

  useEffect(() => {
    creditsMounted.current = true;
  }, []);

  const sheetOpenTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SHEET_OPEN_TRANSITION;
  const sheetCloseTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SHEET_CLOSE_TRANSITION;

  const desktopMenuOpenTransition: Transition = reduceMotion
    ? { duration: 0 }
    : MENU_OPEN_TRANSITION;
  const desktopMenuCloseTransition: Transition = reduceMotion
    ? { duration: 0 }
    : MENU_CLOSE_TRANSITION;

  const menuOpenTransition: Transition = isPhone ? sheetOpenTransition : desktopMenuOpenTransition;
  const menuCloseTransition: Transition = isPhone ? sheetCloseTransition : desktopMenuCloseTransition;

  const menuEnter: TargetAndTransition = reduceMotion
    ? { opacity: 0 }
    : isPhone
      ? { y: '100%' }
      : { opacity: 0, scale: 0.97, y: -4 };
  const menuShown: TargetAndTransition = reduceMotion
    ? { opacity: 1 }
    : isPhone
      ? { y: 0 }
      : { opacity: 1, scale: 1, y: 0 };
  const menuLeave: TargetAndTransition = reduceMotion
    ? { opacity: 0, transition: menuCloseTransition }
    : isPhone
      ? { y: '100%', transition: menuCloseTransition }
      : { opacity: 0, scale: 0.975, y: -3, transition: menuCloseTransition };

  useEffect(() => {
    if (!compareOpen) return;
    setPlansMenuOpen(false);
    setIsSettingsOpen(false);
    onImportExportOpenChange(false);
  }, [compareOpen, onImportExportOpenChange]);

  const closeAllMenus = () => {
    onCompareOpenChange(false);
    setPlansMenuOpen(false);
    setIsSettingsOpen(false);
    onImportExportOpenChange(false);
  };

  const anyMenuOpen = isSettingsOpen || plansMenuOpen || compareOpen;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (isPhone) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('.up-menu') || target?.closest('.up-settings-anchor')) return;
      if (document.documentElement.classList.contains('is-theme-revealing')) return;
      if (ghostDropdownRef.current && !ghostDropdownRef.current.contains(e.target as Node)) {
        onCompareOpenChange(false);
      }
      if (plansDropdownRef.current && !plansDropdownRef.current.contains(e.target as Node)) {
        setPlansMenuOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPhone]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (editingPlanId) {
        setEditingPlanId(null);
        return;
      }
      if (conflictModalOpen) {
        setConflictModalOpen(false);
        return;
      }
      onCompareOpenChange(false);
      setPlansMenuOpen(false);
      setIsSettingsOpen(false);
      onImportExportOpenChange(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingPlanId, conflictModalOpen]);

  const handleAppearance = (preference: ThemePreference, event: React.MouseEvent<HTMLElement>) => {
    const resolved = preference === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : preference;
    const current = revealingTheme() ?? useScheduleStore.getState().theme;
    if (resolved === current) return;
    runThemeReveal({
      event,
      goingToDark: resolved === 'dark',
      apply: () => {
        applyDomTheme(resolved);
        persistTheme(preference);
        flushSync(() => {
          setThemePreference(preference);
        });
      },
      commit: () => {},
    });
  };

  const announcePlan = (planId: string, fallback: string) => {
    const created = useScheduleStore.getState().plans.find((plan) => plan.id === planId);
    showToast(`Switched to "${created?.name || fallback}"`, 'info');
  };

  const handleNewPlan = ({ name, mode }: { name: string; mode: 'blank' | 'duplicate' }) => {
    const typed = name.trim();
    if (mode === 'duplicate') {
      if (!activePlan) return;
      const newId = duplicatePlan(activePlan.id, typed || undefined);
      announcePlan(newId, typed || `${activePlan.name} (Copy)`);
    } else {
      const finalName = typed || nextSuggestedName;
      const newId = createPlan(finalName);
      announcePlan(newId, finalName);
    }
    setNewPlanInputName('');
    setPlansMenuOpen(false);
  };

  const handleStartRename = (planId: string, currentName: string) => {
    setEditingPlanId(planId);
    setEditingName(currentName);
  };

  const handleSaveRename = () => {
    if (editingPlanId && editingName.trim()) {
      renamePlan(editingPlanId, editingName.trim());
    }
    setEditingPlanId(null);
  };

  return (
    <header className="up-header">
      <div className="up-header-row up-header-row-primary">
        <div className="up-header-brand">
          <span className="up-grid-mark" aria-hidden="true">
            <span /><span /><span /><span /><span />
            <span /><span /><span /><span /><span />
          </span>
          <span className="font-bold text-[15px] sm:text-base tracking-tight leading-none" style={{ color: 'var(--up-ink)' }}>
            Uniplan
          </span>


          <div className="up-enrolled" title={`Total enrolled: ${totalCredits} credit hours · ${classCount} ${classCount === 1 ? 'class' : 'classes'}`}>
            <span className="up-enrolled-label hidden lg:inline">Enrolled</span>
            <span className="font-mono text-[12px] tabular-nums leading-none">
              <span className="up-credit-stage" aria-live="polite">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={totalCredits}
                    className="up-credit-digit inline-block"
                    initial={creditsMounted.current && !reduceMotion ? { y: 8, opacity: 0 } : false}
                    animate={{ y: 0, opacity: 1 }}
                    exit={
                      reduceMotion
                        ? { opacity: 0, transition: { duration: 0 } }
                        : { y: -8, opacity: 0, transition: { duration: 0.15, ease: EASE_OUT } }
                    }
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: EASE_POP }}
                  >
                    {totalCredits}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="up-enrolled-label"> cr</span>
            </span>
            <span className="hidden md:inline up-enrolled-label" aria-hidden="true">
              ·
            </span>
            <span className="hidden md:inline text-[12px] tabular-nums" style={{ color: 'var(--up-muted)' }}>
              {classCount} {classCount === 1 ? 'class' : 'classes'}
            </span>
          </div>

          <AnimatePresence initial={false}>
            {conflictCount > 0 && (
              <motion.button
                type="button"
                id="conflict-alert-btn"
                key="conflict-mark"
                onClick={() => setConflictModalOpen(true)}
                className="up-conflict up-chrome-btn"
                title={`${conflictCount} schedule ${conflictCount === 1 ? 'conflict' : 'conflicts'}`}
                aria-label={`${conflictCount} ${conflictCount === 1 ? 'conflict' : 'conflicts'}`}
                initial={reduceMotion ? { opacity: 0 } : { y: 6, scale: 0.94, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: 0 } }
                    : { opacity: 0, scale: 0.99, y: 0, transition: { duration: 0.15, ease: EASE_OUT } }
                }
                transition={reduceMotion ? { duration: 0 } : { duration: 0.4, ease: EASE_POP }}
              >
                <AlertTriangle className="up-conflict-icon w-3.5 h-3.5 shrink-0" />
                <span className="inline-flex items-baseline gap-1 leading-none tabular-nums font-semibold">
                  <span>{conflictCount}</span>
                  <span className="hidden lg:inline font-normal">
                    {conflictCount === 1 ? 'conflict' : 'conflicts'}
                  </span>
                </span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className="up-header-actions">
          <button
            type="button"
            id="btn-undo"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            className="up-icon-btn up-chrome-btn"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            id="btn-redo"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            className="up-icon-btn up-chrome-btn"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <ImportExportMenu
            isPhone={isPhone}
            menuEnter={menuEnter}
            menuShown={menuShown}
            menuLeave={menuLeave}
            menuOpenTransition={menuOpenTransition}
            open={importExportOpen}
            onOpenChange={(open) => {
              if (open) {
                setPlansMenuOpen(false);
                onCompareOpenChange(false);
                setIsSettingsOpen(false);
              }
              onImportExportOpenChange(open);
            }}
            onOpenImport={(tab) => {
              setIsSettingsOpen(false);
              onOpenImport?.(tab);
            }}
            onOpenExport={(tab, focus) => {
              setIsSettingsOpen(false);
              onOpenExport(tab, focus);
            }}
          />

          <button
            type="button"
            id="btn-add-course"
            onClick={() => onOpenNewCourse('form')}
            aria-label="Add course"
            className="up-add-course up-chrome-btn"
            title="Add course"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Add course</span>
          </button>

          <SettingsMenu
            isPhone={isPhone}
            menuEnter={menuEnter}
            menuShown={menuShown}
            menuLeave={menuLeave}
            menuOpenTransition={menuOpenTransition}
            isSettingsOpen={isSettingsOpen}
            settingsRef={settingsRef}
            startHour={startHour}
            endHour={endHour}
            timeRangeMode={timeRangeMode}
            weekStart={weekStart}
            showWeekends={showWeekends}
            themePreference={themePreference}
            onToggleOpen={() => {
              setPlansMenuOpen(false);
              onCompareOpenChange(false);
              onImportExportOpenChange(false);
              setIsSettingsOpen((open) => !open);
            }}
            onSetTimeRange={setTimeRange}
            onSetTimeRangeMode={setTimeRangeMode}
            onSetWeekStart={setWeekStart}
            onSetShowWeekends={setShowWeekends}
            onSetThemePreference={handleAppearance}
            onOpenShortcuts={() => {
              setIsSettingsOpen(false);
              onOpenShortcuts();
            }}
            onOpenHelp={() => {
              setIsSettingsOpen(false);
              onOpenHelp();
            }}
            onLoadDemo={() => {
              resetToSample();
              showToast('Loaded the demo semester.', 'success');
              setIsSettingsOpen(false);
            }}
            onClearAll={() => {
              resetToBlank();
              showToast('Cleared plans and the course pool.', 'info');
              setIsSettingsOpen(false);
            }}
          />
        </div>
      </div>

      <div className="up-header-row up-header-row-secondary">
        <div className="up-header-plan">
          <PlansMenu
            isPhone={isPhone}
            reduceMotion={reduceMotion}
            menuEnter={menuEnter}
            menuShown={menuShown}
            menuLeave={menuLeave}
            menuOpenTransition={menuOpenTransition}
            plans={plans}
            activePlanId={activePlanId}
            activePlan={activePlan}
            plansMenuOpen={plansMenuOpen}
            editingPlanId={editingPlanId}
            editingName={editingName}
            newPlanInputName={newPlanInputName}
            nextSuggestedName={nextSuggestedName}
            planIdConfirmDelete={planIdConfirmDelete}
            plansDropdownRef={plansDropdownRef}
            onToggleOpen={() => {
              setNewPlanInputName('');
              setEditingPlanId(null);
              setIsSettingsOpen(false);
              onCompareOpenChange(false);
              setPlansMenuOpen((open) => !open);
            }}
            onSelectPlan={(planId) => {
              setActivePlan(planId);
              setPlansMenuOpen(false);
            }}
            onEditingNameChange={setEditingName}
            onNewPlanNameChange={setNewPlanInputName}
            onStartRename={handleStartRename}
            onSaveRename={handleSaveRename}
            onCancelRename={() => setEditingPlanId(null)}
            onNewPlan={handleNewPlan}
            onRequestDelete={setPlanIdConfirmDelete}
            onConfirmDelete={(planId) => {
              deletePlan(planId);
              setPlanIdConfirmDelete(null);
            }}
            onCancelDelete={() => setPlanIdConfirmDelete(null)}
            onSharePlan={(plan) => onOpenShare?.(plan)}
          />

          <div className="hidden sm:flex items-center gap-1.5 min-w-0 text-xs text-slate-600 dark:text-slate-400 flex-1">
            <span className="text-slate-900 dark:text-white font-normal truncate">
              {activePlan?.name}
            </span>
            <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums shrink-0">
              {classCount} {classCount === 1 ? 'course' : 'courses'}
            </span>
          </div>
        </div>

        {isPhone && (
          <div className="up-cal-toggle up-header-view-toggle" role="group" aria-label="Calendar view">
            {(['week', 'day'] as const).map((view) => (
              <button
                key={view}
                type="button"
                className="up-cal-toggle-btn up-chrome-btn"
                aria-pressed={mobileCalendarView === view}
                onClick={() => setMobileCalendarView(view)}
              >
                {view === 'week' ? 'Week' : 'Day'}
              </button>
            ))}
          </div>
        )}

        <CompareMenu
          isPhone={isPhone}
          reduceMotion={reduceMotion}
          menuEnter={menuEnter}
          menuShown={menuShown}
          menuLeave={menuLeave}
          menuOpenTransition={menuOpenTransition}
          plans={plans}
          activePlanId={activePlanId}
          ghostPlanIds={ghostPlanIds}
          ghostMenuOpen={compareOpen}
          ghostDropdownRef={ghostDropdownRef}
          onToggleOpen={() => {
            setIsSettingsOpen(false);
            setPlansMenuOpen(false);
            onImportExportOpenChange(false);
            onCompareOpenChange(!compareOpen);
          }}
          onToggleGhost={toggleGhostPlan}
          onClearGhosts={clearGhostPlans}
          onDuplicateAndOverlay={() => {
            if (!activePlanId) return;
            const newPlanId = duplicatePlan(activePlanId);
            toggleGhostPlan(newPlanId);
            announcePlan(newPlanId, 'copy');
          }}
          onCreateAndOverlay={() => {
            const newPlanId = createPlan();
            toggleGhostPlan(newPlanId);
            announcePlan(newPlanId, 'new plan');
          }}
          onOpenShare={() => onOpenShare?.()}
          onImportFriendLink={() => onOpenImportShare?.()}
        />
      </div>

      {conflictModalMounted && (
        <Suspense fallback={null}>
          <ConflictModal
            open={conflictModalOpen}
            conflicts={conflicts}
            activePlanName={activePlan?.name}
            reduceMotion={reduceMotion}
            onClose={() => setConflictModalOpen(false)}
          />
        </Suspense>
      )}

    </header>
  );
});
