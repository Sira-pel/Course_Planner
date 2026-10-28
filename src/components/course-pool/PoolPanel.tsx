import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Course } from '../../types/schedule';
import {
  ChevronRight,
  ShoppingBag,
  Plus,
  Search,
  Shuffle,
  Upload,
  X,
  Trash2,
  Eraser,
  MoreHorizontal,
} from 'lucide-react';
import { PoolRow } from './PoolRow';
import { PoolGroup } from './PoolGroup';
import { groupPoolCourses } from '../../utils/poolGroups';
import { EASE_OUT, EASE_POP } from '../../utils/motion';

export type FilterMode = 'all' | 'in_plan' | 'not_in_plan';

export interface PoolPanelProps {
  isMobileSheet: boolean;
  /** Lets the phone sheet be dragged down by its header. */
  headDragProps?: React.HTMLAttributes<HTMLDivElement>;
  searchQuery: string;
  filterMode: FilterMode;
  confirmDeleteCourseId: string | null;
  catalogCount: number;
  totalInPlan: number;
  filteredCourses: Course[];
  activePlanName: string | undefined;
  searchRef: React.Ref<HTMLInputElement>;
  tabsRef: React.Ref<HTMLDivElement>;
  pillRef: React.Ref<HTMLSpanElement>;
  reduceMotion: boolean | null;
  onSearchChange: (v: string) => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClearSearch: () => void;
  onFilterMode: (mode: FilterMode) => void;
  onToggleCollapse: () => void;
  onOpenNewCourse: () => void;
  onOpenImport?: () => void;
  onOpenGenerate?: () => void;
  onEditCourse: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  isEnrolled: (c: Course) => boolean;
  findConflict: (c: Course) => Course | null;
  onAddToPlan: (catalogId: string) => void;
  onRemoveFromPlan: (catalogId: string) => void;
  unusedInAnyPlanCount: number;
  usedInAnyPlanCount: number;
  onClearUnusedCatalogCourses: () => void;
  onClearPlan: () => void;
}

export const PoolPanel: React.FC<PoolPanelProps> = ({
  isMobileSheet,
  headDragProps,
  searchQuery,
  filterMode,
  confirmDeleteCourseId,
  catalogCount,
  totalInPlan,
  filteredCourses,
  activePlanName,
  searchRef,
  tabsRef,
  pillRef,
  reduceMotion,
  onSearchChange,
  onSearchKeyDown,
  onClearSearch,
  onFilterMode,
  onToggleCollapse,
  onOpenNewCourse,
  onOpenImport,
  onOpenGenerate,
  onEditCourse,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  isEnrolled,
  findConflict,
  onAddToPlan,
  onRemoveFromPlan,
  unusedInAnyPlanCount,
  usedInAnyPlanCount,
  onClearUnusedCatalogCourses,
  onClearPlan,
}) => {
  const [isConfirmingClearPool, setIsConfirmingClearPool] = useState(false);
  const [isConfirmingClearPlan, setIsConfirmingClearPlan] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedOverride, setExpandedOverride] = useState<Record<string, boolean>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const searching = searchQuery.trim() !== '';

  const groups = useMemo(() => groupPoolCourses(filteredCourses), [filteredCourses]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setMenuOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (totalInPlan === 0) setIsConfirmingClearPlan(false);
  }, [totalInPlan]);
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="up-pool-head" {...headDragProps}>
        <div className="flex items-center gap-2.5 min-w-0">
          <ShoppingBag className="w-4 h-4 shrink-0" style={{ color: 'var(--up-ink)' }} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 id="course-pool-title" className="up-pool-title truncate">
                Course pool
              </h2>
              <AnimatePresence initial={false} mode="popLayout">
                {catalogCount > 0 && (
                  <motion.span
                    key={catalogCount}
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
                    {catalogCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
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

      <div className="up-pool-readout flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-2 min-w-0 flex-1"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="text-[11px] shrink-0" style={{ color: 'var(--up-muted)' }}>Adding to:</span>
          <strong className="truncate text-xs">{activePlanName}</strong>
          <span
            className={`up-pool-in-plan-badge shrink-0 ${totalInPlan > 0 ? 'is-active' : 'is-zero'}`}
            title={`${totalInPlan} course section${totalInPlan === 1 ? '' : 's'} currently enrolled in ${activePlanName || 'the active plan'}`}
          >
            <strong>{totalInPlan}</strong>
            <span>in plan</span>
          </span>
        </div>
        {totalInPlan > 0 && (
          <button
            type="button"
            id="btn-pool-clear-plan"
            onClick={() => setIsConfirmingClearPlan((prev) => !prev)}
            aria-expanded={isConfirmingClearPlan}
            className="up-pool-text-btn up-chrome-btn shrink-0"
            title="Remove every section from this plan. The pool is not changed"
          >
            <Eraser className="w-3.5 h-3.5 mr-1" />
            Clear
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isConfirmingClearPlan && totalInPlan > 0 && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="overflow-hidden shrink-0"
          >
            <div className="up-pool-confirm-card">
              <p>
                Remove {totalInPlan} {totalInPlan === 1 ? 'section' : 'sections'} from {activePlanName || 'this plan'}?
              </p>
              <span>Your pool stays as it is. You can undo this (Ctrl+Z).</span>
              <div className="flex items-center gap-1.5 mt-2">
                <button
                  type="button"
                  id="btn-confirm-clear-plan"
                  onClick={() => {
                    onClearPlan();
                    setIsConfirmingClearPlan(false);
                  }}
                  className="flex-1 py-1 px-2.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors up-chrome-btn"
                >
                  Clear plan
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingClearPlan(false)}
                  className="up-pool-text-btn up-chrome-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="up-pool-controls">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="up-pool-search-wrap basis-full min-w-0">
            <Search className="w-3.5 h-3.5" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search code, title, professor"
              className="up-pool-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={onClearSearch}
                className="up-pool-search-clear up-chrome-btn"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {onOpenImport && (
              <button
                type="button"
                id="btn-pool-import"
                data-dialog="import"
                onClick={onOpenImport}
                className="up-pool-create up-chrome-btn"
                title="Import courses (Excel / CSV / Calendar)"
                aria-label="Import courses"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import</span>
              </button>
            )}
            <button
              type="button"
              id="btn-pool-add-course"
              data-dialog="course"
              onClick={onOpenNewCourse}
              className="up-pool-create up-chrome-btn"
              title="New course"
              aria-label="New course"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
            {onOpenGenerate && (
              <button
                type="button"
                id="btn-pool-generate"
                data-dialog="generate"
                onClick={onOpenGenerate}
                disabled={catalogCount < 2}
                className="up-pool-generate up-chrome-btn"
                title={catalogCount < 2 ? 'Add at least two courses to generate plans' : 'Generate plans from your course pool'}
                aria-label="Generate plans"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Generate</span>
              </button>
            )}
            <div className="up-pool-menu-wrap" ref={menuRef}>
              <button
                type="button"
                id="btn-pool-menu"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="up-pool-more up-chrome-btn"
                title="More pool actions"
                aria-label="More pool actions"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {menuOpen && (
                <div className="up-pool-menu" role="menu" aria-label="Pool actions">
                  <button
                    type="button"
                    id="btn-pool-clear-unused"
                    role="menuitem"
                    disabled={unusedInAnyPlanCount === 0}
                    onClick={() => {
                      setMenuOpen(false);
                      setIsConfirmingClearPool(true);
                    }}
                    className="up-pool-menu-item up-chrome-btn"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      <strong>Clear unused courses</strong>
                      <small>
                        {unusedInAnyPlanCount > 0
                          ? `${unusedInAnyPlanCount} not used in any plan`
                          : 'All courses are used in your plans'}
                      </small>
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="up-pool-filters w-full">
          <div ref={tabsRef} className="up-pool-tabs w-full" role="tablist" aria-label="Filter course pool">
            <span ref={pillRef} className="up-pool-tab-pill" aria-hidden="true" />
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === 'all'}
              onClick={() => onFilterMode('all')}
              className="up-pool-tab up-chrome-btn"
              title="All courses in pool"
            >
              All
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === 'in_plan'}
              onClick={() => onFilterMode('in_plan')}
              className="up-pool-tab up-chrome-btn"
              title="Courses in active plan"
            >
              In plan
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === 'not_in_plan'}
              onClick={() => onFilterMode('not_in_plan')}
              className="up-pool-tab up-chrome-btn"
              title="Courses not in active plan"
            >
              Available
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isConfirmingClearPool && unusedInAnyPlanCount > 0 && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className="overflow-hidden"
            >
              <div className="p-2.5 rounded-lg border border-rose-300 dark:border-rose-900/80 bg-rose-50/90 dark:bg-rose-950/50 text-xs">
                <div className="flex items-center justify-between font-semibold text-rose-800 dark:text-rose-200">
                  <span>Clear {unusedInAnyPlanCount} unused {unusedInAnyPlanCount === 1 ? 'course' : 'courses'}?</span>
                  <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400">
                    Keep {usedInAnyPlanCount} in plans
                  </span>
                </div>
                <p className="text-[11px] text-rose-700/90 dark:text-rose-300/80 mt-1 leading-snug">
                  Removes all courses from the pool that are not used in any plan. You can undo this action anytime (Ctrl+Z).
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <button
                    type="button"
                    id="btn-confirm-clear-pool"
                    onClick={() => {
                      onClearUnusedCatalogCourses();
                      setIsConfirmingClearPool(false);
                    }}
                    className="flex-1 py-1 px-2.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs transition-colors up-chrome-btn"
                  >
                    Clear {unusedInAnyPlanCount} {unusedInAnyPlanCount === 1 ? 'course' : 'courses'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClearPool(false)}
                    className="py-1 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors up-chrome-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="up-pool-list">
        <div className="up-pool-list-ink">
          {filteredCourses.length === 0 ? (
            <div className="up-pool-empty">
              <ShoppingBag className="w-6 h-6" style={{ color: 'var(--up-line)' }} />
              <p>
                {searchQuery
                  ? 'No matching courses'
                  : filterMode === 'in_plan'
                  ? `No courses in ${activePlanName || 'this plan'}`
                  : filterMode === 'not_in_plan'
                  ? 'All courses in pool are in this plan'
                  : 'Course pool is empty'}
              </p>
              <span>
                {searchQuery
                  ? 'Clear search or switch filters.'
                  : filterMode === 'in_plan'
                  ? 'Switch to All or Available to add courses to this plan.'
                  : filterMode === 'not_in_plan'
                  ? 'All sections in the pool have been added to this plan.'
                  : 'Create a course or import an Excel spreadsheet.'}
              </span>
              {!searchQuery && filterMode === 'all' && catalogCount < 2 && (
                <span>Add at least two courses to generate a plan.</span>
              )}
              <div className="flex items-center gap-2 mt-1">
                {(!filterMode || filterMode === 'all') && (
                  <>
                    <button
                      type="button"
                      data-dialog="course"
                      onClick={onOpenNewCourse}
                      className="up-pool-add up-chrome-btn"
                      style={{ width: 'auto', paddingInline: 14 }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create course
                    </button>
                    {onOpenImport && (
                      <button
                        type="button"
                        data-dialog="import"
                        onClick={onOpenImport}
                        className="up-pool-add up-chrome-btn"
                        style={{ width: 'auto', paddingInline: 14 }}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Import Excel
                      </button>
                    )}
                  </>
                )}
                {filterMode !== 'all' && !searchQuery && (
                  <button
                    type="button"
                    onClick={() => onFilterMode('all')}
                    className="up-pool-add up-chrome-btn"
                    style={{ width: 'auto', paddingInline: 14 }}
                  >
                    View all courses
                  </button>
                )}
              </div>
            </div>
          ) : (
            groups.map((group) => {
              const renderRow = (item: typeof filteredCourses[number], variant: 'single' | 'section') => (
                <PoolRow
                  key={item.id}
                  item={item}
                  variant={variant}
                  inActivePlan={isEnrolled(item)}
                  conflict={findConflict(item)}
                  confirmDelete={confirmDeleteCourseId === item.id}
                  activePlanName={activePlanName}
                  onEdit={onEditCourse}
                  onRequestDelete={onRequestDelete}
                  onConfirmDelete={onConfirmDelete}
                  onCancelDelete={onCancelDelete}
                  onAddToPlan={onAddToPlan}
                  onRemoveFromPlan={onRemoveFromPlan}
                />
              );

              if (group.courses.length === 1) return renderRow(group.courses[0], 'single');

              const inPlanCount = group.courses.filter(isEnrolled).length;
              const expanded = expandedOverride[group.key] ?? (searching || inPlanCount > 0);
              return (
                <PoolGroup
                  key={group.key}
                  groupId={`pool-group-${group.key.replace(/[^A-Z0-9]+/g, '-')}`}
                  courses={group.courses}
                  inPlanCount={inPlanCount}
                  expanded={expanded}
                  onToggle={() => setExpandedOverride((prev) => ({ ...prev, [group.key]: !expanded }))}
                >
                  {group.courses.map((item) => renderRow(item, 'section'))}
                </PoolGroup>
              );
            })
          )}
        </div>
      </div>

      <div className="up-pool-foot">
        <span>Adding copies the course into your plan. Saving it updates the pool.</span>
      </div>
    </div>
  );
};
