import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Course } from '../../types/schedule';
import {
  ChevronRight,
  ShoppingBag,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { PoolRow } from './PoolRow';
import { EASE_OUT, EASE_POP } from '../../utils/motion';

export type FilterMode = 'all' | 'in_plan' | 'not_in_plan';

export interface PoolPanelProps {
  isMobileSheet: boolean;
  searchQuery: string;
  filterMode: FilterMode;
  confirmDeleteCourseId: string | null;
  catalogCount: number;
  totalInPlan: number;
  filteredCourses: Course[];
  activePlanName: string | undefined;
  activePlanId: string;
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
  onEditCourse: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  isEnrolled: (c: Course) => boolean;
  findConflict: (c: Course) => Course | null;
  onAddToPlan: (catalogId: string) => void;
  onRemoveFromPlan: (catalogId: string) => void;
}

export const PoolPanel: React.FC<PoolPanelProps> = ({
  isMobileSheet,
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
  onEditCourse,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  isEnrolled,
  findConflict,
  onAddToPlan,
  onRemoveFromPlan,
}) => {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="up-pool-head">
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
          Target <strong>{activePlanName}</strong>
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
              onClick={() => onFilterMode('all')}
              className="up-pool-tab up-chrome-btn"
            >
              All ({catalogCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === 'in_plan'}
              onClick={() => onFilterMode('in_plan')}
              className="up-pool-tab up-chrome-btn"
            >
              In plan ({totalInPlan})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === 'not_in_plan'}
              onClick={() => onFilterMode('not_in_plan')}
              className="up-pool-tab up-chrome-btn"
            >
              Available ({catalogCount - totalInPlan})
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenNewCourse}
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
                onClick={onOpenNewCourse}
                className="up-pool-add up-chrome-btn mt-1"
                style={{ width: 'auto', paddingInline: 16 }}
              >
                <Plus className="w-3.5 h-3.5" />
                Create course
              </button>
            </div>
          ) : (
            filteredCourses.map((item, index) => {
              const inActivePlan = isEnrolled(item);
              const conflict = !inActivePlan ? findConflict(item) : null;
              const stagger = !reduceMotion && index < 8;

              return (
                <PoolRow
                  key={item.id}
                  item={item}
                  inActivePlan={inActivePlan}
                  conflict={conflict}
                  confirmDelete={confirmDeleteCourseId === item.id}
                  stagger={stagger}
                  index={index}
                  reduceMotion={reduceMotion}
                  activePlanName={activePlanName}
                  onEdit={() => onEditCourse(item.id)}
                  onRequestDelete={() => onRequestDelete(item.id)}
                  onConfirmDelete={() => onConfirmDelete(item.id)}
                  onCancelDelete={onCancelDelete}
                  onAddToPlan={() => onAddToPlan(item.id)}
                  onRemoveFromPlan={() => onRemoveFromPlan(item.id)}
                />
              );
            })
          )}
        </motion.div>
      </div>

      <div className="up-pool-foot">
        <span>Adding creates independent copies</span>
        <button
          type="button"
          onClick={onOpenNewCourse}
          className="up-pool-text-btn up-chrome-btn"
        >
          Create course
        </button>
      </div>
    </div>
  );
};
