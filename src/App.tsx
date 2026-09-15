/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useScheduleStore } from './store/useScheduleStore';
import { Header } from './components/Header';
import { CalendarGrid } from './components/CalendarGrid';
import { CourseModal } from './components/CourseModal';
import { ExportModal } from './components/ExportModal';
import { CoursePoolSidebar } from './components/CoursePoolSidebar';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { DayOfWeek } from './types/schedule';
import { Sparkles, RotateCcw, HelpCircle, ShoppingBag, Plus } from 'lucide-react';

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
  const reduceMotion = useReducedMotion();

  // Dynamic butter-smooth GPU-accelerated docking for mobile floating action pill
  const pillRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let rafId: number | null = null;

    const updatePosition = () => {
      if (!pillRef.current || !footerRef.current) return;

      // Only active on phone mode (< 640px); tablet mode uses a stationary anchored pill
      if (window.innerWidth >= 640) {
        pillRef.current.style.transform = '';
        return;
      }

      // On mobile browsers (Safari/Chrome), dynamic address and navigation toolbars expand and collapse during scroll.
      // window.visualViewport.height provides the true, instantaneous visible height on screen in real time,
      // preventing coordinate drift where the pill drifted past the stopping position during touch gestures
      // or jumped when fast-scrolling back up due to toolbar state changes.
      const viewportHeight =
        typeof window !== 'undefined' && window.visualViewport
          ? window.visualViewport.height
          : window.innerHeight;

      const maxFooterHeight = footerRef.current.offsetHeight;
      const targetLift = maxFooterHeight + 12;

      // Calculate the exact distance from the bottom of the page content to the bottom of the visual viewport.
      const mainEl = footerRef.current.closest('main');
      const mainRect = mainEl?.getBoundingClientRect();

      const scrollEl = document.scrollingElement || document.documentElement;
      const maxScroll = Math.max(0, scrollEl.scrollHeight - viewportHeight);
      const currentScroll = window.scrollY || window.pageYOffset || scrollEl.scrollTop || 0;

      const remainingScroll = mainRect
        ? Math.max(0, mainRect.bottom - viewportHeight)
        : Math.max(0, maxScroll - currentScroll);

      // Smooth 1-to-1 upward lift that progresses seamlessly until reaching the end of the page,
      // resting at the exact final stopping position (targetLift) when reaching the bottom.
      // Strictly clamped so it can never exceed targetLift even during overscroll / rubber-banding.
      const lift = Math.max(0, Math.min(targetLift, targetLift - remainingScroll));

      // Apply 1-to-1 GPU hardware-accelerated translation upward
      pillRef.current.style.transform = `translate3d(0, ${-lift}px, 0)`;
    };

    const handleScrollOrResize = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        updatePosition();
        rafId = null;
      });
    };

    const handleImmediateUpdate = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    document.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener('touchstart', handleScrollOrResize, { passive: true });
    window.addEventListener('touchmove', handleScrollOrResize, { passive: true });
    window.addEventListener('touchend', handleImmediateUpdate, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    // Synchronize directly with mobile visual viewport events (address bar collapse/expand)
    const visualViewport = typeof window !== 'undefined' ? window.visualViewport : null;
    if (visualViewport) {
      visualViewport.addEventListener('resize', handleScrollOrResize, { passive: true });
      visualViewport.addEventListener('scroll', handleScrollOrResize, { passive: true });
    }

    // Observe footer intersection thresholds for instant trigger when scrolling into view
    const observer = new IntersectionObserver(
      () => {
        handleScrollOrResize();
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0] }
    );

    if (footerRef.current) {
      observer.observe(footerRef.current);
    }

    // Observe layout changes so dynamically added/removed content updates the pill smoothly
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleScrollOrResize();
      });
      if (footerRef.current) {
        resizeObserver.observe(footerRef.current);
      }
      if (document.body) {
        resizeObserver.observe(document.body);
      }
    }

    updatePosition();

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', handleScrollOrResize);
      document.removeEventListener('scroll', handleScrollOrResize, { capture: true });
      window.removeEventListener('touchstart', handleScrollOrResize);
      window.removeEventListener('touchmove', handleScrollOrResize);
      window.removeEventListener('touchend', handleImmediateUpdate);
      window.removeEventListener('resize', handleScrollOrResize);
      if (visualViewport) {
        visualViewport.removeEventListener('resize', handleScrollOrResize);
        visualViewport.removeEventListener('scroll', handleScrollOrResize);
      }
      observer.disconnect();
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
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
  ]);

  return (
    <>
    <div className="min-h-screen lg:h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-150 overflow-x-clip lg:overflow-hidden w-full max-w-full min-w-0">
      <main className="flex-1 max-w-[1720px] w-full min-w-0 mx-auto p-2.5 sm:p-4 md:p-5 flex flex-col gap-2.5 sm:gap-3 min-h-0 overflow-x-clip">
        {/* Header: brand, enrolled readout, plans, compare, settings */}
        <Header
          onOpenNewCourse={(mode) => handleOpenNewCourse('monday', '09:00', mode || 'form')}
          onOpenExport={handleOpenExport}
          onOpenShortcuts={handleOpenShortcuts}
          onOpenCatalog={() => setIsPoolCollapsed(false)}
        />

        {/* Workspace: Calendar Grid and Course Pool Sidebar */}
        <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 min-w-0 items-stretch">
          {/* Main Weekly Calendar Grid */}
          <div className="flex-1 min-w-0 max-w-full flex flex-col min-h-[550px] sm:min-h-[600px] lg:min-h-0 relative overflow-x-auto">
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
        <footer
          ref={footerRef}
          className="flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300 py-2 border-t border-slate-200/80 dark:border-slate-800/80 flex-wrap"
        >
          <div className="flex items-center gap-3">
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

    <div
      ref={pillRef}
      className="up-fab-cluster sm:hidden will-change-transform"
    >
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
    </>
  );
}
