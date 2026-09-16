import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { TargetAndTransition, Transition } from 'motion/react';
import { Layers, Plus, Copy, ChevronDown } from 'lucide-react';
import { GHOST_PLAN_COLORS } from '../../types/schedule';
import type { SchedulePlan } from '../../types/schedule';

interface CompareMenuProps {
  isPhone: boolean;
  reduceMotion: boolean | null;
  menuEnter: TargetAndTransition;
  menuShown: TargetAndTransition;
  menuLeave: TargetAndTransition;
  menuOpenTransition: Transition;
  plans: SchedulePlan[];
  activePlanId: string;
  ghostPlanIds: string[];
  ghostMenuOpen: boolean;
  ghostDropdownRef: React.RefObject<HTMLDivElement | null>;
  onToggleOpen: () => void;
  onToggleGhost: (planId: string) => void;
  onClearGhosts: () => void;
  onDuplicateAndOverlay: () => void;
  onCreateAndOverlay: () => void;
}

export const CompareMenu: React.FC<CompareMenuProps> = ({
  isPhone,
  menuEnter,
  menuShown,
  menuLeave,
  menuOpenTransition,
  plans,
  activePlanId,
  ghostPlanIds,
  ghostMenuOpen,
  ghostDropdownRef,
  onToggleOpen,
  onToggleGhost,
  onClearGhosts,
  onDuplicateAndOverlay,
  onCreateAndOverlay,
}) => {
  return (
    <div className="up-header-compare relative shrink-0" ref={ghostDropdownRef}>
      <button
        type="button"
        id="btn-ghost-overlay"
        onClick={onToggleOpen}
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
                  onClick={onClearGhosts}
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
                    onClick={onDuplicateAndOverlay}
                    className="up-sheet-btn up-sheet-btn-primary up-chrome-btn"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Duplicate to Plan B and overlay
                  </button>
                  <button
                    type="button"
                    onClick={onCreateAndOverlay}
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
                            onChange={() => onToggleGhost(p.id)}
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
                    onClick={onCreateAndOverlay}
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
  );
};
