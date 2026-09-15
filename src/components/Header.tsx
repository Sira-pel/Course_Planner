import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useScheduleStore } from '../store/useScheduleStore';
import { detectPlanConflicts } from '../utils/timeUtils';
import { GHOST_PLAN_COLORS } from '../types/schedule';
import {
  Layers,
  Plus,
  Download,
  Copy,
  Trash2,
  Edit2,
  Check,
  X,
  AlertTriangle,
  Sun,
  Moon,
  Undo2,
  Redo2,
  Keyboard,
  ChevronDown,
  FolderPlus,
  FolderKanban,
  Settings,
  Upload,
  ShoppingBag,
} from 'lucide-react';
import { parseIcsContent } from '../utils/icsImport';

interface HeaderProps {
  onOpenNewCourse: (initialMode?: 'form' | 'quick') => void;
  onOpenExport: () => void;
  onOpenShortcuts: () => void;
  onOpenCatalog?: () => void;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_POP = [0.34, 1.36, 0.64, 1] as const;

function useIsPhone() {
  const [isPhone, setIsPhone] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false
  );

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const onChange = () => setIsPhone(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return isPhone;
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
    toggleTheme,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useScheduleStore();

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
            disabled={!canUndo()}
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
            disabled={!canRedo()}
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

          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              id="btn-settings"
              onClick={() => {
                setPlansMenuOpen(false);
                setGhostMenuOpen(false);
                setIsSettingsOpen((open) => !open);
              }}
              className={`up-icon-btn up-chrome-btn ${isSettingsOpen ? 'is-open' : ''}`}
              title="Settings"
              aria-label="Settings"
              aria-haspopup="menu"
              aria-expanded={isSettingsOpen}
            >
              <Settings className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {isSettingsOpen && (
                <motion.div
                  role="menu"
                  aria-label="Settings"
                  initial={menuEnter}
                  animate={menuShown}
                  exit={menuLeave}
                  transition={menuOpenTransition}
                  style={{ transformOrigin: isPhone ? 'bottom center' : 'top right' }}
                  className="up-menu absolute right-0 top-full mt-1.5 w-[calc(100vw-2.5rem)] max-w-xs sm:w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-[0_4px_12px_rgb(15_23_42/0.12)] z-50 overflow-hidden"
                >
                  <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                    <div>
                      <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">
                        Time range
                      </label>
                      <div className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 bg-slate-50 dark:bg-slate-800/50">
                        <select
                          value={startHour}
                          onChange={(e) => setTimeRange(Number(e.target.value), endHour)}
                          className="bg-transparent text-xs font-mono font-medium text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        >
                          {Array.from({ length: 8 }, (_, i) => i + 5).map((h) => (
                            <option key={`start-${h}`} value={h}>{h}:00</option>
                          ))}
                        </select>
                        <span className="text-slate-400 text-xs">to</span>
                        <select
                          value={endHour}
                          onChange={(e) => setTimeRange(startHour, Number(e.target.value))}
                          className="bg-transparent text-xs font-mono font-medium text-slate-700 dark:text-slate-300 cursor-pointer text-right focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        >
                          {Array.from({ length: 9 }, (_, i) => i + 16).map((h) => (
                            <option key={`end-${h}`} value={h}>{h}:00</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Show weekends</span>
                      <button
                        type="button"
                        onClick={() => setShowWeekends(!showWeekends)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full up-chrome-btn ${
                          showWeekends ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                        aria-pressed={showWeekends}
                        aria-label="Show weekends"
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ${
                            showWeekends ? 'translate-x-2' : '-translate-x-2'
                          }`}
                          style={{
                            transitionProperty: 'transform',
                            transitionDuration: reduceMotion ? '0ms' : '160ms',
                            transitionTimingFunction: 'var(--ease-out)',
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="py-1">
                    {onOpenCatalog && (
                      <button
                        type="button"
                        role="menuitem"
                        id="btn-open-catalog"
                        onClick={() => {
                          setIsSettingsOpen(false);
                          onOpenCatalog();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 up-chrome-btn"
                      >
                        <ShoppingBag className="w-4 h-4 text-slate-400" />
                        Course pool
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsSettingsOpen(false);
                        toggleTheme();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 up-chrome-btn"
                    >
                      {theme === 'dark' ? (
                        <>
                          <Sun className="w-4 h-4 text-slate-500" />
                          Light mode
                        </>
                      ) : (
                        <>
                          <Moon className="w-4 h-4 text-slate-400" />
                          Dark mode
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsSettingsOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 up-chrome-btn"
                    >
                      <Upload className="w-4 h-4 text-slate-400" />
                      Import calendar (.ics)
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsSettingsOpen(false);
                        onOpenExport();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 up-chrome-btn"
                    >
                      <Download className="w-4 h-4 text-slate-400" />
                      Export schedule
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsSettingsOpen(false);
                        onOpenShortcuts();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 up-chrome-btn"
                    >
                      <Keyboard className="w-4 h-4 text-slate-400" />
                      Keyboard shortcuts
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="up-header-row up-header-row-secondary">
        <div className="up-header-plan">
          <div className="relative" ref={plansDropdownRef}>
            <button
              type="button"
              id="btn-plans-dropdown"
              onClick={() => {
                setNewPlanInputName('');
                setEditingPlanId(null);
                setIsSettingsOpen(false);
                setGhostMenuOpen(false);
                setPlansMenuOpen((open) => !open);
              }}
              className={`up-text-trigger up-chrome-btn ${plansMenuOpen ? 'is-open' : ''}`}
              title="View, switch, manage, and create plans"
              aria-haspopup="true"
              aria-expanded={plansMenuOpen}
            >
              <FolderKanban className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Plans</span>
              <span className="sm:hidden truncate max-w-[46vw]">{activePlan?.name || 'Plans'}</span>
              <ChevronDown className={`up-chevron w-3 h-3 opacity-60 shrink-0 ${plansMenuOpen ? 'is-open' : ''}`} />
            </button>

            <AnimatePresence>
              {plansMenuOpen && (
                <motion.div
                  initial={menuEnter}
                  animate={menuShown}
                  exit={menuLeave}
                  transition={menuOpenTransition}
                  style={{ transformOrigin: isPhone ? 'bottom center' : 'top left' }}
                  className="up-menu absolute left-0 top-full mt-1.5 w-[calc(100vw-2.5rem)] max-w-xs sm:w-84 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-[0_4px_12px_rgb(15_23_42/0.12)] z-50 p-3 text-xs"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <FolderKanban className="w-3.5 h-3.5 text-slate-500" />
                      Schedule plans
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {plans.length} total
                    </span>
                  </div>

                  <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5 mb-2.5">
                    <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 px-1 pb-1">
                      Select or manage plan
                    </div>
                    {plans.map((plan, index) => {
                      const isActive = plan.id === activePlanId;
                      const isEditing = editingPlanId === plan.id;
                      const planCredits = plan.courses.reduce((sum, c) => sum + (c.credits || 0), 0);

                      if (isEditing) {
                        return (
                          <div
                            key={plan.id}
                            className="flex items-center gap-1.5 p-1.5 rounded-md bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800"
                          >
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename();
                                if (e.key === 'Escape') setEditingPlanId(null);
                              }}
                              autoFocus
                              className="flex-1 px-2 py-1 text-xs rounded bg-white text-slate-900 dark:bg-slate-900 dark:text-white border border-indigo-400 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                            />
                            <button
                              type="button"
                              onClick={handleSaveRename}
                              className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 up-chrome-btn"
                              title="Save"
                              aria-label="Save plan name"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPlanId(null)}
                              className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 up-chrome-btn"
                              title="Cancel"
                              aria-label="Cancel rename"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={plan.id}
                          onClick={() => {
                            setActivePlan(plan.id);
                            setPlansMenuOpen(false);
                          }}
                          className={`group flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer border ${
                            isActive
                              ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-800 text-indigo-950 dark:text-indigo-100'
                              : 'bg-white dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                                isActive
                                  ? 'bg-indigo-600 text-white font-bold'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {isActive ? <Check className="w-2.5 h-2.5" /> : index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`truncate text-xs ${isActive ? 'text-indigo-900 dark:text-indigo-200 font-bold' : 'font-medium'}`}>
                                  {plan.name}
                                </span>
                                {isActive && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-300 shrink-0">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                                {plan.courses.length} courses · {planCredits} cr
                              </div>
                            </div>
                          </div>

                          <div
                            className="flex items-center gap-1 ml-2 shrink-0 opacity-70 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleStartRename(plan.id, plan.name)}
                              title="Rename plan"
                              aria-label={`Rename ${plan.name}`}
                              className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 up-chrome-btn"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {plans.length > 1 && (
                              planIdConfirmDelete === plan.id ? (
                                <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">Delete?</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      deletePlan(plan.id);
                                      setPlanIdConfirmDelete(null);
                                    }}
                                    className="text-[10px] font-bold text-white bg-rose-600 px-1.5 py-0.5 rounded hover:bg-rose-700 up-chrome-btn"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPlanIdConfirmDelete(null)}
                                    className="text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setPlanIdConfirmDelete(plan.id)}
                                  title="Delete plan"
                                  aria-label={`Delete ${plan.name}`}
                                  className="p-1 rounded text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-700 up-chrome-btn"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 px-1 mb-1.5 flex items-center justify-between">
                      <span>Create new plan</span>
                      <FolderPlus className="w-3 h-3 text-slate-400" />
                    </div>

                    <div className="flex items-center gap-1.5 mb-2">
                      <input
                        type="text"
                        value={newPlanInputName}
                        onChange={(e) => setNewPlanInputName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreatePlan();
                          if (e.key === 'Escape') setPlansMenuOpen(false);
                        }}
                        placeholder={nextSuggestedName}
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                      />
                      <button
                        type="button"
                        onClick={() => handleCreatePlan()}
                        className="px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-medium text-xs shrink-0 up-chrome-btn"
                      >
                        Create
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCreatePlan(nextSuggestedName)}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-200 dark:border-slate-700 up-chrome-btn"
                      >
                        <Plus className="w-3 h-3 text-slate-500" />
                        <span>Blank plan</span>
                      </button>
                      {activePlan && (
                        <button
                          type="button"
                          onClick={() => handleDuplicatePlan(activePlan.id)}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-200 dark:border-slate-700 truncate up-chrome-btn"
                          title={`Clone ${activePlan.name}`}
                        >
                          <Copy className="w-3 h-3 text-slate-500" />
                          <span className="truncate">Clone active</span>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

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

        <div className="up-header-compare relative shrink-0" ref={ghostDropdownRef}>
          <button
            type="button"
            id="btn-ghost-overlay"
            onClick={() => {
              setIsSettingsOpen(false);
              setPlansMenuOpen(false);
              setGhostMenuOpen((open) => !open);
            }}
            className={`${isPhone ? 'up-icon-btn' : 'up-text-trigger'} up-chrome-btn ${ghostMenuOpen ? 'is-open' : ''}`}
            aria-label="Compare plans"
            aria-haspopup="true"
            aria-expanded={ghostMenuOpen}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Compare</span>
            {ghostPlanIds.length > 0 && (
              <span className="font-mono tabular-nums text-[11px]">
                {ghostPlanIds.length}
              </span>
            )}
            <ChevronDown className={`up-chevron w-3 h-3 opacity-60 hidden sm:block ${ghostMenuOpen ? 'is-open' : ''}`} />
          </button>

          <AnimatePresence>
            {ghostMenuOpen && (
              <motion.div
                initial={menuEnter}
                animate={menuShown}
                exit={menuLeave}
                transition={menuOpenTransition}
                style={{ transformOrigin: isPhone ? 'bottom center' : 'top right' }}
                className="up-menu absolute right-0 top-full mt-1.5 w-[calc(100vw-2rem)] max-w-xs sm:w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-[0_4px_12px_rgb(15_23_42/0.12)] z-50 p-2.5 text-xs"
              >
                <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-slate-200 dark:border-slate-800 px-1">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" style={{ color: 'var(--up-ink)' }} />
                    <span className="font-bold" style={{ color: 'var(--up-ink)' }}>Compare</span>
                  </div>
                  {ghostPlanIds.length > 0 && (
                    <button
                      type="button"
                      onClick={clearGhostPlans}
                      className="text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-medium px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 up-chrome-btn"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {plans.length <= 1 ? (
                  <div className="up-sheet-empty">
                    <p>
                      Overlay another plan as ghost blocks on this week to see where times collide.
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!activePlanId) return;
                          const newPlanId = duplicatePlan(activePlanId);
                          toggleGhostPlan(newPlanId);
                        }}
                        className="up-sheet-btn up-sheet-btn-primary up-chrome-btn"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Duplicate to Plan B and overlay
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newPlanId = createPlan();
                          toggleGhostPlan(newPlanId);
                        }}
                        className="up-sheet-btn up-sheet-btn-secondary up-chrome-btn"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create a blank plan and overlay
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1 mb-2">
                      Overlay backup scenarios as translucent ghost blocks to spot differences:
                    </p>

                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {plans.map((p, idx) => {
                        const isActive = p.id === activePlanId;
                        const isGhosted = ghostPlanIds.includes(p.id);
                        const ghostStyle = GHOST_PLAN_COLORS[idx % GHOST_PLAN_COLORS.length];

                        if (isActive) {
                          return (
                            <div
                              key={p.id}
                              className="flex items-center justify-between px-2 py-1.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-semibold"
                            >
                              <span className="truncate">{p.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                                Active
                              </span>
                            </div>
                          );
                        }

                        return (
                          <label
                            key={p.id}
                            className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isGhosted}
                                onChange={() => toggleGhostPlan(p.id)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                                {p.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                                {p.courses.length} classes
                              </span>
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: ghostStyle.dot }}
                              />
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          const newPlanId = createPlan();
                          toggleGhostPlan(newPlanId);
                        }}
                        className="text-[11px] text-slate-600 dark:text-slate-300 font-medium hover:text-slate-900 dark:hover:text-white flex items-center gap-1 up-chrome-btn"
                      >
                        <Plus className="w-3 h-3" />
                        Add another plan
                      </button>
                      {ghostPlanIds.length > 0 && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {ghostPlanIds.length} active overlay{ghostPlanIds.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {conflictModalOpen && (
          <motion.div
            key="conflict-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: reduceMotion ? { duration: 0 } : { duration: 0.15, ease: EASE_OUT } }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: EASE_OUT }}
            onClick={() => setConflictModalOpen(false)}
          >
            <div className="absolute inset-0 bg-slate-950/50" />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="conflict-modal-title"
              initial={reduceMotion ? false : { scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={reduceMotion ? undefined : { scale: 0.96, transition: { duration: 0.15, ease: EASE_OUT } }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: EASE_OUT }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-900/60 shadow-[0_8px_24px_rgb(15_23_42/0.18)] max-w-md w-full p-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                  <h3 id="conflict-modal-title" className="font-bold text-base text-slate-900 dark:text-white">
                    Schedule collision detected
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setConflictModalOpen(false)}
                  className="up-icon-btn up-chrome-btn"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-3 space-y-2.5">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  The following courses in <strong>{activePlan?.name}</strong> collide on the same day and time interval:
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {conflicts.map((c, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-md border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 text-xs"
                    >
                      <div className="font-bold text-rose-800 dark:text-rose-300 flex items-center justify-between">
                        <span>{c.courseCode1} vs {c.courseCode2}</span>
                        <span className="capitalize font-mono text-[11px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-900">
                          {c.day}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 mt-1 font-mono text-[11px]">
                        Overlap window: {c.overlapStart} - {c.overlapEnd}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setConflictModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 up-chrome-btn"
                >
                  Close and adjust
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            key="header-toast"
            className="fixed top-4 right-4 z-50"
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
