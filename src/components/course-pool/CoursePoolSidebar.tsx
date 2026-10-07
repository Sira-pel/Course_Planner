import React, { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef, useDeferredValue } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { useScheduleStore } from '../../store/useScheduleStore';
import { Course, DayOfWeek } from '../../types/schedule';
import { timeToMinutes } from '../../utils/timeUtils';
import { usePoolLayout } from '../../utils/usePoolLayout';
import { courseIdentityKey, sameCourseIdentity } from '../../utils/courseIdentity';
import { ShoppingBag } from 'lucide-react';
import { PoolPanel, type FilterMode } from './PoolPanel';
import { EASE_OUT, EASE_POP, EASE_SMOOTH, SHEET_OPEN_TRANSITION, SHEET_CLOSE_TRANSITION, SHEET_BACKDROP_OPEN_TRANSITION, SHEET_BACKDROP_CLOSE_TRANSITION } from '../../utils/motion';

interface CoursePoolSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenNewCourse: (mode?: 'form' | 'quick') => void;
  onOpenImport?: () => void;
  onEditCourse: (courseId: string) => void;
}

export const CoursePoolSidebar = React.memo(function CoursePoolSidebar({
  isCollapsed,
  onToggleCollapse,
  onOpenNewCourse,
  onOpenImport,
  onEditCourse,
}: CoursePoolSidebarProps) {
  const {
    plans,
    activePlanId,
    catalogCourses,
    removeFromCatalog,
    addCourseFromPool,
    removeCourseFromPlanByCatalog,
    clearUnusedCatalogCourses,
  } = useScheduleStore(
    useShallow((state) => ({
      plans: state.plans,
      activePlanId: state.activePlanId,
      catalogCourses: state.catalogCourses,
      removeFromCatalog: state.removeFromCatalog,
      addCourseFromPool: state.addCourseFromPool,
      removeCourseFromPlanByCatalog: state.removeCourseFromPlanByCatalog,
      clearUnusedCatalogCourses: state.clearUnusedCatalogCourses,
    }))
  );

  const reduceMotion = useReducedMotion();
  const layout = usePoolLayout();
  // Held here so a layout-branch remount of PoolPanel does not clear search/filter/confirm.
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [confirmDeleteCourseId, setConfirmDeleteCourseId] = useState<string | null>(null);

  const tabsRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const pillPaintedRef = useRef(false);
  const pillMetricsRef = useRef({ x: -1, w: -1 });
  const searchRef = useRef<HTMLInputElement>(null);
  const wasOverlayOpenRef = useRef(false);
  const desktopRootRef = useRef<HTMLDivElement>(null);

  const activePlan = useMemo(() => plans.find((p) => p.id === activePlanId) || plans[0], [plans, activePlanId]);

  const activeCourseKeys = useMemo(() => {
    if (!activePlan) return new Set<string>();
    return new Set(activePlan.courses.map((c) => courseIdentityKey(c.code, c.section)));
  }, [activePlan]);

  const activePlanDirectIds = useMemo(() => {
    if (!activePlan) return new Set<string>();
    return new Set(activePlan.courses.map((c) => c.id));
  }, [activePlan]);

  const isEnrolledInActivePlan = useCallback(
    (catalogItem: Course): boolean => {
      if (!activePlan) return false;
      if (activeCourseKeys.has(courseIdentityKey(catalogItem.code, catalogItem.section))) {
        return true;
      }
      return activePlanDirectIds.has(catalogItem.id);
    },
    [activePlan, activeCourseKeys, activePlanDirectIds]
  );

  const activeSessionsByDay = useMemo(() => {
    const map = new Map<DayOfWeek, Array<{ start: number; end: number; course: Course }>>();
    if (!activePlan) return map;
    for (const c of activePlan.courses) {
      for (const s of c.sessions) {
        const start = timeToMinutes(s.startTime);
        const end = timeToMinutes(s.endTime);
        if (end <= start) continue;
        const list = map.get(s.day);
        if (list) {
          list.push({ start, end, course: c });
        } else {
          map.set(s.day, [{ start, end, course: c }]);
        }
      }
    }
    return map;
  }, [activePlan]);

  const findConflictInActivePlan = useCallback(
    (catalogItem: Course): Course | null => {
      if (!activePlan || activeSessionsByDay.size === 0) return null;

      for (const poolSession of catalogItem.sessions) {
        const candidates = activeSessionsByDay.get(poolSession.day);
        if (!candidates) continue;
        const sStart = timeToMinutes(poolSession.startTime);
        const sEnd = timeToMinutes(poolSession.endTime);
        if (sEnd <= sStart) continue;

        for (const enrolled of candidates) {
          if (sameCourseIdentity(enrolled.course, catalogItem)) continue;
          if (sStart < enrolled.end && enrolled.start < sEnd) {
            return enrolled.course;
          }
        }
      }
      return null;
    },
    [activePlan, activeSessionsByDay]
  );

  const filteredCourses = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return catalogCourses.filter((c) => {
      const matchesSearch =
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.section && c.section.toLowerCase().includes(q)) ||
        (c.instructor && c.instructor.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      const inPlan = isEnrolledInActivePlan(c);
      if (filterMode === 'in_plan') return inPlan;
      if (filterMode === 'not_in_plan') return !inPlan;
      return true;
    });
  }, [catalogCourses, deferredSearchQuery, filterMode, isEnrolledInActivePlan]);

  const totalInPlan = useMemo(() => {
    return activePlan ? activePlan.courses.length : 0;
  }, [activePlan]);

  const usedInAnyPlanCount = useMemo(() => {
    const usedKeys = new Set<string>();
    const usedIds = new Set<string>();
    for (const p of plans) {
      for (const c of p.courses) {
        usedKeys.add(courseIdentityKey(c.code, c.section));
        usedIds.add(c.id);
      }
    }

    return catalogCourses.filter((cat) => {
      if (usedKeys.has(courseIdentityKey(cat.code, cat.section))) return true;
      return usedIds.has(cat.id);
    }).length;
  }, [plans, catalogCourses]);

  const unusedInAnyPlanCount = catalogCourses.length - usedInAnyPlanCount;

  const panelOpenTransition: Transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: EASE_OUT };
  const panelCloseTransition: Transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.12, ease: EASE_OUT };

  const sheetOpenTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SHEET_OPEN_TRANSITION;
  const sheetCloseTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SHEET_CLOSE_TRANSITION;

  useEffect(() => {
    pillPaintedRef.current = false;
    pillMetricsRef.current = { x: -1, w: -1 };
  }, [isCollapsed, layout]);

  const updatePill = useCallback(() => {
    const root = tabsRef.current;
    const pill = pillRef.current;
    if (!root || !pill) return;
    const active = root.querySelector('[aria-selected="true"]');
    if (!(active instanceof HTMLElement)) return;
    const x = active.offsetLeft;
    const w = active.offsetWidth;
    const prev = pillMetricsRef.current;
    if (pillPaintedRef.current && prev.x === x && prev.w === w) return;
    pillMetricsRef.current = { x, w };
    const jump = !pillPaintedRef.current || !!reduceMotion;
    pill.style.transition = jump
      ? 'none'
      : 'transform var(--dur-chrome) var(--ease-out), width var(--dur-chrome) var(--ease-out)';
    pill.style.transform = `translateX(${x}px)`;
    pill.style.width = `${w}px`;
    pillPaintedRef.current = true;
  }, [reduceMotion, filterMode]);

  useLayoutEffect(() => {
    updatePill();
    const root = tabsRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updatePill);
    });
    observer.observe(root);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [updatePill, isCollapsed, layout]);

  useEffect(() => {
    if (isCollapsed || layout === 'desktop') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (layout === 'phone') {
      document.body.setAttribute('data-up-pool-open', '');
    }
    return () => {
      document.body.style.overflow = previous;
      document.body.removeAttribute('data-up-pool-open');
    };
  }, [isCollapsed, layout]);

  useEffect(() => {
    const overlayOpen = !isCollapsed && layout !== 'desktop';
    if (overlayOpen) {
      wasOverlayOpenRef.current = true;
      return;
    }
    if (!wasOverlayOpenRef.current) return;
    wasOverlayOpenRef.current = false;
    const trigger =
      document.getElementById('course-pool-collapsed') ??
      document.getElementById('btn-mobile-pool-pill');
    if (trigger instanceof HTMLElement) trigger.focus();
  }, [isCollapsed, layout]);

  useEffect(() => {
    if (isCollapsed || layout !== 'desktop') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;
        // If an open modal or dialog is currently present, let that dialog handle Escape first
        if (
          document.querySelector('[role="dialog"]') ||
          document.querySelector('.course-modal-backdrop') ||
          document.querySelector('.course-modal-sheet')
        ) {
          return;
        }
        // If search input has text and is focused, let handleSearchKeyDown clear search first
        if (searchQuery.trim() !== '' && document.activeElement === searchRef.current) {
          return;
        }
        onToggleCollapse();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCollapsed, layout, onToggleCollapse, searchQuery]);

  const openNewCourse = () => {
    onOpenNewCourse('form');
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Escape' || searchQuery.trim() === '') return;
    e.stopPropagation();
    e.preventDefault();
    setSearchQuery('');
  };

  const handleConfirmDelete = useCallback((id: string) => {
    removeFromCatalog(id);
    setConfirmDeleteCourseId(null);
  }, [removeFromCatalog]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteCourseId(null);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleAddToPlan = useCallback(
    (catalogId: string) => {
      if (!activePlan) return;
      addCourseFromPool(catalogId, activePlan.id);
    },
    [addCourseFromPool, activePlan]
  );

  const handleRemoveFromPlan = useCallback(
    (catalogId: string) => {
      if (!activePlan) return;
      removeCourseFromPlanByCatalog(catalogId, activePlan.id);
    },
    [removeCourseFromPlanByCatalog, activePlan]
  );

  const countBadge = (
    <AnimatePresence initial={false} mode="popLayout">
      {catalogCourses.length > 0 && (
        <motion.span
          key={catalogCourses.length}
          className="up-pool-badge"
          initial={reduceMotion ? false : { y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={
            reduceMotion
              ? { opacity: 0, transition: { duration: 0 } }
              : { y: -8, opacity: 0, transition: { duration: 0.16, ease: EASE_SMOOTH } }
          }
          transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: EASE_SMOOTH }}
        >
          {catalogCourses.length}
        </motion.span>
      )}
    </AnimatePresence>
  );

  const renderPoolPanel = (isMobileSheet: boolean) => (
    <PoolPanel
      isMobileSheet={isMobileSheet}
      searchQuery={searchQuery}
      filterMode={filterMode}
      confirmDeleteCourseId={confirmDeleteCourseId}
      catalogCount={catalogCourses.length}
      totalInPlan={totalInPlan}
      filteredCourses={filteredCourses}
      activePlanName={activePlan?.name}
      searchRef={searchRef}
      tabsRef={tabsRef}
      pillRef={pillRef}
      reduceMotion={reduceMotion}
      onSearchChange={setSearchQuery}
      onSearchKeyDown={handleSearchKeyDown}
      onClearSearch={handleClearSearch}
      onFilterMode={setFilterMode}
      onToggleCollapse={onToggleCollapse}
      onOpenNewCourse={openNewCourse}
      onOpenImport={onOpenImport}
      onEditCourse={onEditCourse}
      onRequestDelete={setConfirmDeleteCourseId}
      onConfirmDelete={handleConfirmDelete}
      onCancelDelete={handleCancelDelete}
      isEnrolled={isEnrolledInActivePlan}
      findConflict={findConflictInActivePlan}
      onAddToPlan={handleAddToPlan}
      onRemoveFromPlan={handleRemoveFromPlan}
      unusedInAnyPlanCount={unusedInAnyPlanCount}
      usedInAnyPlanCount={usedInAnyPlanCount}
      onClearUnusedCatalogCourses={clearUnusedCatalogCourses}
    />
  );

  const backdropOpenTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SHEET_BACKDROP_OPEN_TRANSITION;
  const backdropCloseTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SHEET_BACKDROP_CLOSE_TRANSITION;

  const overlayBackdrop = (key: string) => (
    <motion.div
      key={key}
      className="up-sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        transition: backdropCloseTransition,
      }}
      transition={backdropOpenTransition}
      onClick={onToggleCollapse}
    />
  );

  return (
    <>
      {layout === 'desktop' && (
        <div ref={desktopRootRef} className={`up-pool-desktop${isCollapsed ? '' : ' is-open'}`}>
          <button
            type="button"
            id="course-pool-collapsed"
            onClick={onToggleCollapse}
            className="up-pool-rail up-chrome-btn"
            title="Open course pool"
            aria-label="Open course pool"
            tabIndex={isCollapsed ? 0 : -1}
            aria-hidden={!isCollapsed}
          >
            <span className="up-pool-rail-mark">
              <ShoppingBag className="w-4 h-4" />
              {catalogCourses.length > 0 && (
                <span className="up-pool-rail-count">{catalogCourses.length}</span>
              )}
            </span>
            <span className="up-pool-rail-label">Course pool</span>
          </button>
          <AnimatePresence presenceAffectsLayout={false}>
            {!isCollapsed && (
              <motion.aside
                key="pool-desktop-panel"
                id="course-pool-sidebar"
                className="up-pool-panel"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: 0 } }
                    : { opacity: 0, x: 12, transition: panelCloseTransition }
                }
                transition={panelOpenTransition}
              >
                {renderPoolPanel(false)}
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      )}

      {layout === 'tablet' && isCollapsed && (
        <button
          type="button"
          id="course-pool-collapsed"
          onClick={onToggleCollapse}
          className="up-pool-dock up-chrome-btn"
          title="Open course pool"
          aria-label="Open course pool"
        >
          <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left">Course pool</span>
          {countBadge}
        </button>
      )}

      {layout === 'tablet' &&
        createPortal(
          <AnimatePresence>
            {!isCollapsed && overlayBackdrop('pool-tablet-backdrop')}
            {!isCollapsed && (
              <motion.aside
                key="pool-tablet-drawer"
                id="course-pool-sidebar"
                role="dialog"
                aria-modal="true"
                aria-labelledby="course-pool-title"
                className="up-pool-drawer will-change-transform"
                initial={reduceMotion ? { opacity: 0 } : { x: '100%' }}
                animate={{ opacity: 1, x: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: 0 } }
                    : { x: '100%', transition: sheetCloseTransition }
                }
                transition={sheetOpenTransition}
              >
                {renderPoolPanel(false)}
              </motion.aside>
            )}
          </AnimatePresence>,
          document.body
        )}

      {layout === 'phone' &&
        createPortal(
          <AnimatePresence>
            {!isCollapsed && overlayBackdrop('pool-phone-backdrop')}
            {!isCollapsed && (
              <motion.div
                key="pool-phone-sheet"
                id="course-pool-sidebar"
                role="dialog"
                aria-modal="true"
                aria-labelledby="course-pool-title"
                className="up-pool-sheet"
                initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
                animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: 0 } }
                    : { y: '100%', transition: sheetCloseTransition }
                }
                transition={sheetOpenTransition}
              >
                <button
                  type="button"
                  className="up-pool-handle-hit"
                  onClick={onToggleCollapse}
                  aria-label="Close course pool"
                >
                  <span className="up-pool-handle" />
                </button>
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  {renderPoolPanel(true)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
});
