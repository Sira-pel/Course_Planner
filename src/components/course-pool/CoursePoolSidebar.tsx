import React, { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { useScheduleStore } from '../../store/useScheduleStore';
import { Course, DayOfWeek } from '../../types/schedule';
import { timeToMinutes } from '../../utils/timeUtils';
import { usePoolLayout } from '../../utils/usePoolLayout';
import { courseIdentityKey, sameCourseIdentity } from '../../utils/courseIdentity';
import { ShoppingBag } from 'lucide-react';
import { PoolPanel, type FilterMode } from './PoolPanel';
import { EASE_OUT, EASE_POP } from '../../utils/motion';

interface CoursePoolSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenNewCourse: (mode?: 'form' | 'quick') => void;
  onOpenImport?: () => void;
  onEditCourse: (courseId: string) => void;
}

export const CoursePoolSidebar: React.FC<CoursePoolSidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  onOpenNewCourse,
  onOpenImport,
  onEditCourse,
}) => {
  const {
    plans,
    activePlanId,
    ghostPlanIds,
    catalogCourses,
    removeFromCatalog,
    addCourseFromPool,
    removeCourseFromPlanByCatalog,
    clearUnusedCatalogCourses,
  } = useScheduleStore(
    useShallow((state) => ({
      plans: state.plans,
      activePlanId: state.activePlanId,
      ghostPlanIds: state.ghostPlanIds,
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
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [confirmDeleteCourseId, setConfirmDeleteCourseId] = useState<string | null>(null);
  const [targetPlanId, setTargetPlanId] = useState<string>(activePlanId);

  const tabsRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const pillPaintedRef = useRef(false);
  const pillMetricsRef = useRef({ x: -1, w: -1 });
  const searchRef = useRef<HTMLInputElement>(null);
  const wasOverlayOpenRef = useRef(false);

  useEffect(() => {
    if (!plans.some((p) => p.id === targetPlanId)) {
      setTargetPlanId(activePlanId);
    }
  }, [plans, activePlanId, targetPlanId]);

  const activePlan = useMemo(() => plans.find((p) => p.id === activePlanId) || plans[0], [plans, activePlanId]);
  const targetPlan = useMemo(
    () => plans.find((p) => p.id === targetPlanId) || activePlan,
    [plans, targetPlanId, activePlan]
  );

  const targetCourseKeys = useMemo(() => {
    if (!targetPlan) return new Set<string>();
    return new Set(targetPlan.courses.map((c) => courseIdentityKey(c.code, c.section)));
  }, [targetPlan]);

  const targetPlanDirectIds = useMemo(() => {
    if (!targetPlan) return new Set<string>();
    return new Set(targetPlan.courses.map((c) => c.id));
  }, [targetPlan]);

  const isEnrolledInTargetPlan = useCallback(
    (catalogItem: Course): boolean => {
      if (!targetPlan) return false;
      if (targetCourseKeys.has(courseIdentityKey(catalogItem.code, catalogItem.section))) {
        return true;
      }
      return targetPlanDirectIds.has(catalogItem.id);
    },
    [targetPlan, targetCourseKeys, targetPlanDirectIds]
  );

  const targetSessionsByDay = useMemo(() => {
    const map = new Map<DayOfWeek, Array<{ start: number; end: number; course: Course }>>();
    if (!targetPlan) return map;
    for (const c of targetPlan.courses) {
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
  }, [targetPlan]);

  const findConflictInTargetPlan = useCallback(
    (catalogItem: Course): Course | null => {
      if (!targetPlan || targetSessionsByDay.size === 0) return null;

      for (const poolSession of catalogItem.sessions) {
        const candidates = targetSessionsByDay.get(poolSession.day);
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
    [targetPlan, targetSessionsByDay]
  );

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalogCourses.filter((c) => {
      const matchesSearch =
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.section && c.section.toLowerCase().includes(q)) ||
        (c.instructor && c.instructor.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      const inPlan = isEnrolledInTargetPlan(c);
      if (filterMode === 'in_plan') return inPlan;
      if (filterMode === 'not_in_plan') return !inPlan;
      return true;
    });
  }, [catalogCourses, searchQuery, filterMode, isEnrolledInTargetPlan]);

  const totalInPlan = useMemo(() => {
    return targetPlan ? targetPlan.courses.length : 0;
  }, [targetPlan]);

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

  const panelOpenTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.25, ease: EASE_OUT };
  const panelCloseTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.15, ease: EASE_OUT };

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
    if (!pillPaintedRef.current) {
      void pill.offsetWidth;
      pillPaintedRef.current = true;
      if (!reduceMotion) {
        pill.style.transition =
          'transform var(--dur-chrome) var(--ease-out), width var(--dur-chrome) var(--ease-out)';
      }
    }
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
      searchRef.current?.focus();
      return;
    }
    if (!wasOverlayOpenRef.current) return;
    wasOverlayOpenRef.current = false;
    const trigger =
      document.getElementById('course-pool-collapsed') ??
      document.getElementById('btn-mobile-pool-pill');
    if (trigger instanceof HTMLElement) trigger.focus();
  }, [isCollapsed, layout]);

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
    (catalogId: string) => addCourseFromPool(catalogId, targetPlan.id),
    [addCourseFromPool, targetPlan.id]
  );

  const handleRemoveFromPlan = useCallback(
    (catalogId: string) => removeCourseFromPlanByCatalog(catalogId, targetPlan.id),
    [removeCourseFromPlanByCatalog, targetPlan.id]
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
              : { y: -8, opacity: 0, transition: { duration: 0.15, ease: EASE_OUT } }
          }
          transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: EASE_POP }}
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
      activePlanName={targetPlan?.name}
      activePlanId={activePlanId}
      plans={plans}
      ghostPlanIds={ghostPlanIds}
      targetPlanId={targetPlanId}
      onSelectTargetPlan={setTargetPlanId}
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
      isEnrolled={isEnrolledInTargetPlan}
      findConflict={findConflictInTargetPlan}
      onAddToPlan={handleAddToPlan}
      onRemoveFromPlan={handleRemoveFromPlan}
      unusedInAnyPlanCount={unusedInAnyPlanCount}
      usedInAnyPlanCount={usedInAnyPlanCount}
      onClearUnusedCatalogCourses={clearUnusedCatalogCourses}
    />
  );

  const overlayBackdrop = (key: string) => (
    <motion.div
      key={key}
      className="up-sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        transition: reduceMotion ? { duration: 0 } : panelCloseTransition,
      }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT }}
      onClick={onToggleCollapse}
    />
  );

  return (
    <>
      {layout === 'desktop' && (
        <div className="up-pool-desktop">
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
            </span>
            {catalogCourses.length > 0 && (
              <span className="up-pool-rail-count">{catalogCourses.length}</span>
            )}
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
                className="up-pool-drawer"
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
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: 0 } }
                    : { opacity: 0, y: 8, transition: panelCloseTransition }
                }
                transition={panelOpenTransition}
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
};
