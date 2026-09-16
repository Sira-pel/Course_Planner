import React, { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useScheduleStore } from '../store/useScheduleStore';
import { Course } from '../types/schedule';
import { minutesToTime, timeToMinutes, checkSessionCollision } from '../utils/timeUtils';
import { usePoolLayout } from '../utils/usePoolLayout';
import {
  ChevronRight,
  ShoppingBag,
  Plus,
  Search,
  Check,
  Trash2,
  Edit2,
  AlertTriangle,
  X,
} from 'lucide-react';

interface CoursePoolSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenNewCourse: (mode?: 'form' | 'quick') => void;
  onEditCourse: (courseId: string) => void;
}

type FilterMode = 'all' | 'in_plan' | 'not_in_plan';

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_POP = [0.34, 1.36, 0.64, 1] as const;

export const CoursePoolSidebar: React.FC<CoursePoolSidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  onOpenNewCourse,
  onEditCourse,
}) => {
  const {
    plans,
    activePlanId,
    catalogCourses,
    removeFromCatalog,
    addCourseFromPool,
    removeCourseFromPlanByCatalog,
  } = useScheduleStore();

  const reduceMotion = useReducedMotion();
  const layout = usePoolLayout();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [confirmDeleteCourseId, setConfirmDeleteCourseId] = useState<string | null>(null);

  const tabsRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const pillPaintedRef = useRef(false);
  const pillMetricsRef = useRef({ x: -1, w: -1 });
  const searchRef = useRef<HTMLInputElement>(null);
  const wasOverlayOpenRef = useRef(false);

  const activePlan = useMemo(() => plans.find((p) => p.id === activePlanId) || plans[0], [plans, activePlanId]);

  const activeCourseKeys = useMemo(() => {
    if (!activePlan) return new Set<string>();
    return new Set(
      activePlan.courses.map(
        (c) => `${c.code.trim().toUpperCase()}__${(c.section || '').trim().toUpperCase()}`
      )
    );
  }, [activePlan?.courses]);

  const isEnrolledInActivePlan = useCallback(
    (catalogItem: Course): boolean => {
      const key = `${catalogItem.code.trim().toUpperCase()}__${(catalogItem.section || '').trim().toUpperCase()}`;
      return activeCourseKeys.has(key);
    },
    [activeCourseKeys]
  );

  const findConflictInActivePlan = (catalogItem: Course): Course | null => {
    if (!activePlan) return null;
    const activeNonSelfCourses = activePlan.courses.filter(
      (c) =>
        !(
          c.code.trim().toUpperCase() === catalogItem.code.trim().toUpperCase() &&
          (c.section || '').trim().toUpperCase() === (catalogItem.section || '').trim().toUpperCase()
        )
    );

    for (const poolSession of catalogItem.sessions) {
      for (const enrolled of activeNonSelfCourses) {
        for (const enrSession of enrolled.sessions) {
          if (checkSessionCollision(poolSession, enrSession)) {
            return enrolled;
          }
        }
      }
    }
    return null;
  };

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

      const inPlan = isEnrolledInActivePlan(c);
      if (filterMode === 'in_plan') return inPlan;
      if (filterMode === 'not_in_plan') return !inPlan;
      return true;
    });
  }, [catalogCourses, searchQuery, filterMode, isEnrolledInActivePlan]);

  const totalInPlan = useMemo(() => {
    return catalogCourses.filter(isEnrolledInActivePlan).length;
  }, [catalogCourses, isEnrolledInActivePlan]);

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
  }, [reduceMotion, filterMode, catalogCourses.length, totalInPlan]);

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

  const renderPoolContent = (isMobileSheet: boolean) => (
    <div className="flex flex-col h-full min-h-0">
      <div className="up-pool-head">
        <div className="flex items-center gap-2.5 min-w-0">
          <ShoppingBag className="w-4 h-4 shrink-0" style={{ color: 'var(--up-ink)' }} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 id="course-pool-title" className="up-pool-title truncate">
                Course pool
              </h2>
              {countBadge}
            </div>
            <p className="up-pool-sub truncate">Sections saved for this semester</p>
          </div>
        </div>
        <button
          type="button"
          id={isMobileSheet ? 'btn-close-mobile-course-pool' : 'btn-collapse-course-pool'}
          onClick={onToggleCollapse}
          className="up-icon-btn up-chrome-btn up-pool-icon-hit shrink-0"
          title={isMobileSheet ? 'Close course pool' : 'Collapse course pool'}
          aria-label={isMobileSheet ? 'Close course pool' : 'Collapse course pool'}
        >
          {isMobileSheet ? <X className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      <div className="up-pool-readout">
        <span className="truncate">
          Target <strong>{activePlan?.name}</strong>
        </span>
        <span className="font-mono text-[11px] tabular-nums shrink-0">
          {totalInPlan} in plan
        </span>
      </div>

      <div className="up-pool-controls">
        <div className="up-pool-search-wrap">
          <Search className="w-3.5 h-3.5" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Escape' || searchQuery.trim() === '') return;
              e.stopPropagation();
              e.preventDefault();
              setSearchQuery('');
            }}
            placeholder="Search code, title, professor"
            className="up-pool-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="up-pool-search-clear up-chrome-btn"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="up-pool-filters">
          <div ref={tabsRef} className="up-pool-tabs" role="tablist" aria-label="Filter course pool">
            <span ref={pillRef} className="up-pool-tab-pill" aria-hidden="true" />
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === 'all'}
              onClick={() => setFilterMode('all')}
              className="up-pool-tab up-chrome-btn"
            >
              All ({catalogCourses.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === 'in_plan'}
              onClick={() => setFilterMode('in_plan')}
              className="up-pool-tab up-chrome-btn"
            >
              In plan ({totalInPlan})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === 'not_in_plan'}
              onClick={() => setFilterMode('not_in_plan')}
              className="up-pool-tab up-chrome-btn"
            >
              Available ({catalogCourses.length - totalInPlan})
            </button>
          </div>

          <button
            type="button"
            onClick={openNewCourse}
            className="up-pool-create up-chrome-btn"
            title="Create course"
            aria-label="Create course"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="up-pool-list">
        <motion.div
          className="up-pool-list-ink"
          initial={reduceMotion ? false : { opacity: 0, y: 12, filter: 'blur(var(--blur-ink))' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: EASE_OUT }}
        >
          {filteredCourses.length === 0 ? (
            <div className="up-pool-empty">
              <ShoppingBag className="w-6 h-6" style={{ color: 'var(--up-line)' }} />
              <p>{searchQuery ? 'No matching courses' : 'Course pool is empty'}</p>
              <span>
                {searchQuery
                  ? 'Clear search or switch filters.'
                  : 'Create a course to save it here.'}
              </span>
              <button
                type="button"
                onClick={openNewCourse}
                className="up-pool-add up-chrome-btn mt-1"
                style={{ width: 'auto', paddingInline: 16 }}
              >
                <Plus className="w-3.5 h-3.5" />
                Create course
              </button>
            </div>
          ) : (
            filteredCourses.map((item, index) => {
              const inActivePlan = isEnrolledInActivePlan(item);
              const conflict = !inActivePlan ? findConflictInActivePlan(item) : null;
              const stagger = !reduceMotion && index < 8;

              return (
                <motion.div
                  key={item.id}
                  className="up-pool-row group"
                  initial={stagger ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    stagger
                      ? { duration: 0.2, ease: EASE_OUT, delay: index * 0.04 }
                      : { duration: 0 }
                  }
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="up-pool-swatch" style={{ backgroundColor: item.color }} />
                      <span className="up-pool-code truncate">{item.code}</span>
                      {item.section && (
                        <span className="up-pool-meta font-mono">Sec {item.section}</span>
                      )}
                      {item.credits ? (
                        <span className="up-pool-meta font-mono">{item.credits} cr</span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      {confirmDeleteCourseId === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              removeFromCatalog(item.id);
                              setConfirmDeleteCourseId(null);
                            }}
                            className="up-pool-text-btn up-chrome-btn text-rose-600 dark:text-rose-400"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteCourseId(null)}
                            className="up-icon-btn up-chrome-btn up-pool-icon-hit"
                            aria-label="Cancel delete"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="up-pool-row-actions flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => onEditCourse(item.id)}
                            title="Edit course"
                            aria-label={`Edit ${item.code}`}
                            className="up-icon-btn up-chrome-btn up-pool-icon-hit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteCourseId(item.id)}
                            title="Remove from pool"
                            aria-label={`Remove ${item.code} from pool`}
                            className="up-icon-btn up-chrome-btn up-pool-icon-hit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="text-xs mt-0.5 leading-snug line-clamp-1" style={{ color: 'var(--up-ink)' }}>
                    {item.name}
                  </h3>

                  <div className="mt-1.5 space-y-0.5 font-mono up-pool-meta">
                    {item.sessions.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="capitalize">
                          {s.day.slice(0, 3)}{' '}
                          {minutesToTime(timeToMinutes(s.startTime))} - {minutesToTime(timeToMinutes(s.endTime))}
                        </span>
                        {s.room && (
                          <span className="font-sans truncate max-w-[90px]">{s.room}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {item.instructor && (
                    <div className="mt-1 up-pool-meta truncate">{item.instructor}</div>
                  )}

                  {conflict && (
                    <div className="up-pool-conflict">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        Overlaps with <strong>{conflict.code}</strong>
                      </span>
                    </div>
                  )}

                  <div className="mt-2.5 pt-2 flex items-center justify-between gap-2" style={{ borderTop: '1px solid var(--up-line)' }}>
                    {inActivePlan ? (
                      <>
                        <span className="up-pool-status">
                          <Check className="w-3.5 h-3.5" />
                          In plan
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCourseFromPlanByCatalog(item.id, activePlanId)}
                          className="up-pool-text-btn up-chrome-btn"
                          title="Remove this class from the current timetable"
                        >
                          Remove from plan
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addCourseFromPool(item.id, activePlanId)}
                        className="up-pool-add up-chrome-btn"
                        title={`Add ${item.code} to ${activePlan?.name}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add to plan
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
      </div>

      <div className="up-pool-foot">
        <span>Adding creates independent copies</span>
        <button
          type="button"
          onClick={openNewCourse}
          className="up-pool-text-btn up-chrome-btn"
        >
          Create course
        </button>
      </div>
    </div>
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
                {renderPoolContent(false)}
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
                {renderPoolContent(false)}
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
                  {renderPoolContent(true)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};
