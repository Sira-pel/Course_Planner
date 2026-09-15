/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useScheduleStore } from './store/useScheduleStore';
import { Header } from './components/Header';
import { CalendarGrid } from './components/CalendarGrid';
import { CourseModal } from './components/CourseModal';
import { ExportModal } from './components/ExportModal';
import { CoursePoolSidebar } from './components/CoursePoolSidebar';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { DayOfWeek } from './types/schedule';
import { Sparkles, RotateCcw, HelpCircle, ShoppingBag, Plus, MoreVertical } from 'lucide-react';

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_POP = [0.34, 1.36, 0.64, 1] as const;

export default function App() {
  const {
    plans,
    activePlanId,
    catalogCourses,
    theme,
    setActivePlan,
    duplicatePlan,
    undo,
    redo,
    resetToBlank,
    resetToSample,
  } = useScheduleStore();

  // Modals & Sidebar state
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [modalInitialDay, setModalInitialDay] = useState<DayOfWeek>('monday');
  const [modalInitialStartTime, setModalInitialStartTime] = useState<string>('09:00');
  const [modalInitialMode, setModalInitialMode] = useState<'form' | 'quick'>('form');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPoolCollapsed, setIsPoolCollapsed] = useState(true);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const menuOpenTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.25, ease: EASE_OUT };
  const menuCloseTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.15, ease: EASE_OUT };

  const closeMoreMenu = useCallback(() => {
    setIsMoreOpen(false);
    setIsConfirmingClear(false);
  }, []);

  // Sync theme with DOM documentElement and colorScheme
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
      }
    }
  }, [theme]);

  // Handler for opening new course modal
  const handleOpenNewCourse = useCallback(
    (day: DayOfWeek = 'monday', startTime: string = '09:00', mode: 'form' | 'quick' = 'form') => {
      setIsPoolCollapsed(true);
      setEditingCourseId(null);
      setModalInitialDay(day);
      setModalInitialStartTime(startTime);
      setModalInitialMode(mode);
      setIsCourseModalOpen(true);
    },
    []
  );

  // Handler for editing an existing course
  const handleEditCourse = useCallback((courseId: string) => {
    setIsPoolCollapsed(true);
    setEditingCourseId(courseId);
    setModalInitialMode('form');
    setIsCourseModalOpen(true);
  }, []);

  const handleOpenExport = useCallback(() => {
    setIsPoolCollapsed(true);
    setIsExportOpen(true);
  }, []);

  const handleOpenShortcuts = useCallback(() => {
    setIsPoolCollapsed(true);
    setIsShortcutsOpen(true);
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input or textarea
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // Escape always closes any open modal. If pool search has text, the
      // input handler clears it and stops this listener.
      if (e.key === 'Escape') {
        if (
          target instanceof HTMLInputElement &&
          target.classList.contains('up-pool-input') &&
          target.value.trim() !== ''
        ) {
          return;
        }
        if (isMoreOpen) {
          if (isConfirmingClear) setIsConfirmingClear(false);
          else setIsMoreOpen(false);
          return;
        }
        setIsCourseModalOpen(false);
        setIsExportOpen(false);
        setIsShortcutsOpen(false);
        setIsPoolCollapsed(true);
        return;
      }

      // If user is actively typing in a text field, do not trigger single-key or Ctrl shortcuts (except undo in text)
      if (isInputFocused) return;

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          handleOpenNewCourse('monday', '09:00', 'form');
        } else if (e.key.toLowerCase() === 'k') {
          e.preventDefault();
          handleOpenNewCourse('monday', '09:00', 'quick');
        } else if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          duplicatePlan(activePlanId);
        } else if (e.key.toLowerCase() === 'e') {
          e.preventDefault();
          handleOpenExport();
        } else if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redo();
        }
        return;
      }

      // Help cheatsheet: '?'
      if (e.key === '?') {
        e.preventDefault();
        handleOpenShortcuts();
        return;
      }

      // Quick key 'A' for add course
      if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleOpenNewCourse('monday', '09:00', 'form');
        return;
      }

      // Number keys 1-9 to switch plans
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= plans.length) {
        e.preventDefault();
        setActivePlan(plans[num - 1].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activePlanId,
    plans,
    handleOpenNewCourse,
    handleOpenExport,
    handleOpenShortcuts,
    duplicatePlan,
    undo,
    redo,
    setActivePlan,
    isMoreOpen,
    isConfirmingClear,
  ]);

  useEffect(() => {
    if (!isMoreOpen) return;
    document.body.classList.add('up-sheet-open');
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.classList.remove('up-sheet-open');
      document.body.style.overflow = previous;
    };
  }, [isMoreOpen]);

  return (
    <div className="up-app min-h-screen lg:h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-150 overflow-x-clip lg:overflow-hidden w-full max-w-full min-w-0">
      <main className="up-workspace flex-1 max-w-[1720px] w-full min-w-0 mx-auto p-2.5 sm:p-4 md:p-5 flex flex-col gap-2.5 sm:gap-3 min-h-0 overflow-x-clip">
        {/* Header: brand, enrolled readout, plans, compare, settings */}
        <Header
          onOpenNewCourse={(mode) => handleOpenNewCourse('monday', '09:00', mode || 'form')}
          onOpenExport={handleOpenExport}
          onOpenShortcuts={handleOpenShortcuts}
          onOpenCatalog={() => setIsPoolCollapsed(false)}
        />

        {/* Workspace: Calendar Grid and Course Pool Sidebar */}
        <div className="up-workspace-body flex-1 flex flex-col lg:flex-row gap-3 min-h-0 min-w-0 items-stretch lg:overflow-visible">
          {/* Main Weekly Calendar Grid */}
          <div className="up-calendar-slot flex-1 min-w-0 max-w-full flex flex-col min-h-0 sm:min-h-[600px] lg:min-h-0 relative overflow-x-auto">
            <CalendarGrid
              onEditCourse={handleEditCourse}
              onAddCourseAtTime={(day, time) => handleOpenNewCourse(day, time, 'form')}
              onOpenNewCourse={(mode) => handleOpenNewCourse('monday', '09:00', mode || 'form')}
            />
          </div>

          {/* Course Pool Sidebar on the right (bottom on mobile, drawer on tablet) */}
          <CoursePoolSidebar
            isCollapsed={isPoolCollapsed}
            onToggleCollapse={() => setIsPoolCollapsed((prev) => !prev)}
            onOpenNewCourse={(mode) => handleOpenNewCourse('monday', '09:00', mode || 'form')}
            onEditCourse={handleEditCourse}
          />
        </div>

        {/* Bottom Utility Bar */}
        <footer className="up-footer flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300 py-2 border-t border-slate-200/80 dark:border-slate-800/80 flex-wrap">
          <div className="up-footer-tip flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Tip: Double-click any time slot on the calendar to instantly add a class.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpenShortcuts}
              className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Shortcuts</span>
            </button>
            <span>•</span>
            {isConfirmingClear ? (
              <div className="inline-flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/80 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900 animate-in fade-in">
                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">Clear all plans & pool?</span>
                <button
                  type="button"
                  onClick={() => {
                    resetToBlank();
                    setIsConfirmingClear(false);
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors"
                >
                  Yes, Clear All
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingClear(false)}
                  className="px-1 text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmingClear(true)}
                  className="inline-flex items-center gap-1 hover:text-rose-500 transition-colors"
                  title="Clear all courses and start with a blank schedule"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear All</span>
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => {
                    resetToSample();
                  }}
                  className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  title="Load example courses and schedule plans"
                >
                  <span>Load Demo</span>
                </button>
              </div>
            )}
          </div>
        </footer>
      </main>

      <div className="up-fab-cluster">
        <button
          type="button"
          id="btn-mobile-more"
          onClick={() => {
            setIsConfirmingClear(false);
            setIsMoreOpen((open) => !open);
          }}
          className={`up-fab-more up-chrome-btn ${isMoreOpen ? 'is-open' : ''}`}
          title="More actions"
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={isMoreOpen}
        >
          <MoreVertical className="w-5 h-5" />
        </button>
        <button
          type="button"
          id="btn-mobile-pool-pill"
          onClick={() => setIsPoolCollapsed((prev) => !prev)}
          className="up-fab-secondary up-chrome-btn"
          title="Open course pool"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Pool</span>
          <AnimatePresence initial={false} mode="popLayout">
            {catalogCourses.length > 0 && (
              <motion.span
                key={catalogCourses.length}
                className="up-fab-count"
                initial={reduceMotion ? false : { y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: 0 } }
                    : { y: -8, opacity: 0, transition: { duration: 0.15, ease: EASE_OUT } }
                }
                transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: EASE_POP }}
              >
                {catalogCourses.length}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <button
          type="button"
          id="btn-mobile-add-course-pill"
          onClick={() => handleOpenNewCourse('monday', '09:00', 'form')}
          className="up-fab-primary up-chrome-btn"
          title="Add course"
        >
          <Plus className="w-4 h-4" />
          <span>Add course</span>
        </button>
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isMoreOpen && (
              <motion.div
                key="more-backdrop"
                className="up-sheet-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                  transition: reduceMotion ? { duration: 0 } : menuCloseTransition,
                }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT }}
                onClick={closeMoreMenu}
              />
            )}
            {isMoreOpen && (
              <motion.div
                key="more-menu"
                role="menu"
                aria-label="More actions"
                className="up-menu up-more-menu"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: 0 } }
                    : { opacity: 0, y: 8, transition: menuCloseTransition }
                }
                transition={menuOpenTransition}
              >
                {isConfirmingClear ? (
                  <div className="up-sheet-empty">
                    <p>Clear all plans and pool?</p>
                    <button
                      type="button"
                      className="up-sheet-btn up-sheet-btn-primary up-chrome-btn"
                      onClick={() => {
                        resetToBlank();
                        closeMoreMenu();
                      }}
                    >
                      Yes, clear all
                    </button>
                    <button
                      type="button"
                      className="up-sheet-btn up-sheet-btn-secondary up-chrome-btn"
                      onClick={() => setIsConfirmingClear(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className="up-more-item up-chrome-btn"
                      onClick={() => {
                        closeMoreMenu();
                        resetToSample();
                      }}
                    >
                      <Sparkles className="w-4 h-4" />
                      Load demo
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="up-more-item up-chrome-btn"
                      onClick={() => {
                        closeMoreMenu();
                        handleOpenShortcuts();
                      }}
                    >
                      <HelpCircle className="w-4 h-4" />
                      Shortcuts
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="up-more-item up-more-item-danger up-chrome-btn"
                      onClick={() => setIsConfirmingClear(true)}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Clear all
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Modal Dialogs */}
      <CourseModal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        editingCourseId={editingCourseId}
        initialDay={modalInitialDay}
        initialStartTime={modalInitialStartTime}
        initialMode={modalInitialMode}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
