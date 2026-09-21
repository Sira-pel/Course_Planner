import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { useScheduleStore } from '../../store/useScheduleStore';
import { applyDomTheme, persistTheme } from '../../utils/theme';
import { isPointerClick, runThemeReveal } from '../../utils/themeTransition';
import { detectPlanConflicts } from '../../utils/timeUtils';
import {
  Plus,
  AlertTriangle,
  Sun,
  Moon,
  Undo2,
  Redo2,
  X,
} from 'lucide-react';
import { parseIcsContent } from '../../utils/icsImport';
import { useIsPhone } from '../../utils/usePoolLayout';
import { PlansMenu } from './PlansMenu';
import { CompareMenu } from './CompareMenu';
import { SettingsMenu } from './SettingsMenu';
import { ConflictModal } from './ConflictModal';
import { EASE_OUT, EASE_POP } from '../../utils/motion';

interface HeaderProps {
  onOpenNewCourse: (initialMode?: 'form' | 'quick') => void;
  onOpenExport: () => void;
  onOpenShortcuts: () => void;
  onOpenCatalog: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewCourse,
  onOpenExport,
  onOpenShortcuts,
  onOpenCatalog,
}) => {
  const {
    plans,
    activePlanId,
    ghostPlanIds,
    showWeekends,
    startHour,
    endHour,
    theme,
    setActivePlan,
    createPlan,
    duplicatePlan,
    renamePlan,
    deletePlan,
    toggleGhostPlan,
    clearGhostPlans,
    setShowWeekends,
    setTimeRange,
    setTheme,
    commitTheme,
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
      theme: state.theme,
      setActivePlan: state.setActivePlan,
      createPlan: state.createPlan,
      duplicatePlan: state.duplicatePlan,
      renamePlan: state.renamePlan,
      deletePlan: state.deletePlan,
      toggleGhostPlan: state.toggleGhostPlan,
      clearGhostPlans: state.clearGhostPlans,
      setShowWeekends: state.setShowWeekends,
      setTimeRange: state.setTimeRange,
      toggleTheme: state.toggleTheme,
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
  const [ghostMenuOpen, setGhostMenuOpen] = useState(false);
  const [plansMenuOpen, setPlansMenuOpen] = useState(false);
  const [newPlanInputName, setNewPlanInputName] = useState('');
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [planIdConfirmDelete, setPlanIdConfirmDelete] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const ghostDropdownRef = useRef<HTMLDivElement>(null);
  const plansDropdownRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  const activePlan = useMemo(() => plans.find((p) => p.id === activePlanId) || plans[0], [plans, activePlanId]);
  const conflicts = useMemo(() => (activePlan ? detectPlanConflicts(activePlan.courses) : []), [activePlan?.courses]);
  const totalCredits = useMemo(
    () => activePlan?.courses.reduce((sum, c) => sum + (c.credits || 0), 0) || 0,
    [activePlan?.courses]
  );
  const classCount = activePlan?.courses.length || 0;

  const nextSuggestedName = useMemo(() => `Plan ${String.fromCharCode(65 + (plans.length % 26))}`, [plans.length]);

  useEffect(() => {
    creditsMounted.current = true;
  }, []);

  const menuOpenTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.25, ease: EASE_OUT };
  const menuCloseTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.15, ease: EASE_OUT };
  const menuEnter = reduceMotion
    ? { opacity: 0 }
    : isPhone
      ? { opacity: 0, y: 16 }
      : { opacity: 0, scale: 0.97, y: 4 };
  const menuShown = reduceMotion
    ? { opacity: 1 }
    : isPhone
      ? { opacity: 1, y: 0 }
      : { opacity: 1, scale: 1, y: 0 };
  const menuLeave = reduceMotion
    ? { opacity: 0, transition: menuCloseTransition }
    : isPhone
      ? { opacity: 0, y: 8, transition: menuCloseTransition }
      : { opacity: 0, scale: 0.99, y: 0, transition: menuCloseTransition };

  const closeAllMenus = () => {
    setGhostMenuOpen(false);
    setPlansMenuOpen(false);
    setIsSettingsOpen(false);
  };

  const anyMenuOpen = isSettingsOpen || plansMenuOpen || ghostMenuOpen;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.up-menu')) return;
      if (ghostDropdownRef.current && !ghostDropdownRef.current.contains(e.target as Node)) {
        setGhostMenuOpen(false);
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
  }, []);

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
      setGhostMenuOpen(false);
      setPlansMenuOpen(false);
      setIsSettingsOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingPlanId, conflictModalOpen]);

  useEffect(() => {
    if (!isPhone || !anyMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('up-sheet-open');
    return () => {
      document.body.style.overflow = previous;
      document.body.classList.remove('up-sheet-open');
    };
  }, [isPhone, anyMenuOpen]);

  const handleIcsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        try {
          const courses = parseIcsContent(content);
          if (courses.length > 0) {
            useScheduleStore.getState().bulkAddCourses(courses, activePlanId);
            showToast(`Imported ${courses.length} course(s) from .ics file.`, 'success');
          } else {
            showToast('No valid recurring or class events found in this .ics file.', 'error');
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          showToast(`Error parsing .ics file: ${msg}`, 'error');
        }
      }
    };
    reader.onerror = () => {
      showToast('Failed to read the selected .ics file.', 'error');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // closeSettings stays false for #btn-theme and Settings Light/Dark so the sheet stays open.
  const handleToggleTheme = (event: React.MouseEvent<HTMLElement>, closeSettings: boolean) => {
    const goingToDark = theme !== 'dark';
    const next = goingToDark ? 'dark' : 'light';

    if (!isPointerClick(event) || reduceMotion) {
      if (closeSettings) setIsSettingsOpen(false);
      setTheme(next);
      return;
    }

    runThemeReveal({
      event,
      goingToDark,
      apply: () => {
        if (closeSettings) setIsSettingsOpen(false);
        applyDomTheme(next);
        persistTheme(next);
      },
      commit: () => {
        commitTheme(next);
      },
    });
  };

  const handleCreatePlan = (nameToUse?: string) => {
    const finalName = (nameToUse || newPlanInputName).trim() || nextSuggestedName;
    createPlan(finalName);
    setNewPlanInputName('');
    setPlansMenuOpen(false);
  };

  const handleDuplicatePlan = (sourcePlanId: string) => {
    duplicatePlan(sourcePlanId);
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
      <AnimatePresence>
        {isPhone && anyMenuOpen && (
          <motion.div
            key="sheet-backdrop"
            className="up-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: reduceMotion ? { duration: 0 } : { duration: 0.15, ease: EASE_OUT } }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT }}
            onClick={closeAllMenus}
          />
        )}
      </AnimatePresence>
      <div className="up-header-row up-header-row-primary">
        <div className="up-header-brand">
          <span className="up-grid-mark" aria-hidden="true">
            <span /><span /><span /><span /><span />
            <span /><span /><span /><span /><span />
          </span>
          <span className="font-bold text-[15px] sm:text-base tracking-tight leading-none" style={{ color: 'var(--up-ink)' }}>
            Uniplan
          </span>


          <div className="up-enrolled" title="Total enrolled credit hours in active plan">
            <span className="up-enrolled-label hidden sm:inline">Enrolled</span>
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
            <span className="hidden sm:inline up-enrolled-label" aria-hidden="true">
              ·
            </span>
            <span className="hidden sm:inline text-[12px] tabular-nums" style={{ color: 'var(--up-muted)' }}>
              {classCount} {classCount === 1 ? 'class' : 'classes'}
            </span>
          </div>

          <AnimatePresence initial={false}>
            {conflicts.length > 0 && (
              <motion.button
                type="button"
                id="conflict-alert-btn"
                key="conflict-mark"
                onClick={() => setConflictModalOpen(true)}
                className="up-conflict up-chrome-btn"
                aria-label={`${conflicts.length} ${conflicts.length === 1 ? 'collision' : 'collisions'}`}
                initial={reduceMotion ? { opacity: 0 } : { y: 8, x: 8, scale: 0.92, opacity: 0 }}
                animate={{ y: 0, x: 0, scale: 1, opacity: 1 }}
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: 0 } }
                    : { opacity: 0, scale: 0.99, y: 0, x: 0, transition: { duration: 0.15, ease: EASE_OUT } }
                }
                transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: EASE_POP }}
              >
                <AlertTriangle className="up-conflict-icon w-3.5 h-3.5" />
                <span className="font-mono tabular-nums">{conflicts.length}</span>
                <span className="hidden sm:inline">
                  {conflicts.length === 1 ? 'collision' : 'collisions'}
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

          <button
            type="button"
            id="btn-add-course"
            onClick={() => onOpenNewCourse('form')}
            aria-label="Add course"
            className="up-add-course up-chrome-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add course</span>
          </button>

          <input
            type="file"
            accept=".ics,text/calendar"
            ref={fileInputRef}
            onChange={handleIcsUpload}
            className="hidden"
          />

          <button
            type="button"
            id="btn-theme"
            onClick={(event) => handleToggleTheme(event, false)}
            className="up-icon-btn up-chrome-btn"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Dark mode"
            aria-pressed={theme === 'dark'}
          >
            <span className="up-theme-glyph" aria-hidden="true">
              <Sun className="up-theme-sun w-4 h-4" />
              <Moon className="up-theme-moon w-4 h-4" />
            </span>
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
            showWeekends={showWeekends}
            theme={theme}
            onToggleOpen={() => {
              setPlansMenuOpen(false);
              setGhostMenuOpen(false);
              setIsSettingsOpen((open) => !open);
            }}
            onSetTimeRange={setTimeRange}
            onSetShowWeekends={setShowWeekends}
            onOpenCatalog={() => {
              setIsSettingsOpen(false);
              onOpenCatalog();
            }}
            onToggleTheme={(event) => handleToggleTheme(event, false)}
            onImportIcsClick={() => {
              setIsSettingsOpen(false);
              fileInputRef.current?.click();
            }}
            onOpenExport={() => {
              setIsSettingsOpen(false);
              onOpenExport();
            }}
            onOpenShortcuts={() => {
              setIsSettingsOpen(false);
              onOpenShortcuts();
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
              setGhostMenuOpen(false);
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
            onCreate={handleCreatePlan}
            onDuplicateActive={() => {
              if (activePlan) handleDuplicatePlan(activePlan.id);
            }}
            onRequestDelete={setPlanIdConfirmDelete}
            onConfirmDelete={(planId) => {
              deletePlan(planId);
              setPlanIdConfirmDelete(null);
            }}
            onCancelDelete={() => setPlanIdConfirmDelete(null)}
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
          ghostMenuOpen={ghostMenuOpen}
          ghostDropdownRef={ghostDropdownRef}
          onToggleOpen={() => {
            setIsSettingsOpen(false);
            setPlansMenuOpen(false);
            setGhostMenuOpen((open) => !open);
          }}
          onToggleGhost={toggleGhostPlan}
          onClearGhosts={clearGhostPlans}
          onDuplicateAndOverlay={() => {
            if (!activePlanId) return;
            const newPlanId = duplicatePlan(activePlanId);
            toggleGhostPlan(newPlanId);
          }}
          onCreateAndOverlay={() => {
            const newPlanId = createPlan();
            toggleGhostPlan(newPlanId);
          }}
        />
      </div>

      <ConflictModal
        open={conflictModalOpen}
        conflicts={conflicts}
        activePlanName={activePlan?.name}
        reduceMotion={reduceMotion}
        onClose={() => setConflictModalOpen(false)}
      />

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            key="header-toast"
            className="fixed top-[7.25rem] right-5 z-50"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={
              reduceMotion
                ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, y: 12, transition: { duration: 0.15, ease: EASE_OUT } }
            }
            transition={reduceMotion ? { duration: 0 } : { duration: 0.4, ease: EASE_OUT }}
          >
            <div
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg shadow-lg border text-xs font-medium ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                  : toastMessage.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/90 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                  : 'bg-slate-900 dark:bg-slate-800 text-white border-slate-700'
              }`}
            >
              <span>{toastMessage.text}</span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="opacity-70 hover:opacity-100 p-0.5 up-chrome-btn"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
