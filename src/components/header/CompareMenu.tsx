import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { TargetAndTransition, Transition } from 'motion/react';
import { Layers, Plus, Copy, ChevronDown, Share2, UserPlus, X, Check } from 'lucide-react';
import { getPlanGhostColor } from '../../types/schedule';
import type { SchedulePlan } from '../../types/schedule';
import { EASE_OUT, SHEET_OPEN_TRANSITION, SHEET_CLOSE_TRANSITION } from '../../utils/motion';

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
  onOpenShare?: () => void;
  onImportFriendLink?: () => void;
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
  onOpenShare,
  onImportFriendLink,
}) => {
  const reduceMotion = useReducedMotion();

  const sheetOpenTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SHEET_OPEN_TRANSITION;
  const sheetCloseTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SHEET_CLOSE_TRANSITION;

  React.useEffect(() => {
    if (!isPhone || !ghostMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('up-sheet-open');
    return () => {
      document.body.style.overflow = previous;
      document.body.classList.remove('up-sheet-open');
    };
  }, [isPhone, ghostMenuOpen]);

  const renderContent = () => (
    <>
      {!isPhone && (
        <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-slate-200 dark:border-slate-800 px-1">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" style={{ color: 'var(--up-ink)' }} />
            <span className="font-bold" style={{ color: 'var(--up-ink)' }}>Compare plans</span>
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
      )}

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
            {plans.map((p) => {
              const isActive = p.id === activePlanId;
              const isGhosted = ghostPlanIds.includes(p.id);
              const ghostStyle = getPlanGhostColor(p.id, plans);

              if (isActive) {
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-2 py-1.5 rounded-md up-selected font-semibold"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="up-selected-mark w-4 h-4 rounded flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                      <span className="truncate text-xs">{p.name}</span>
                    </div>
                    <span className="up-selected-chip text-[10px] px-1.5 py-0.5 rounded">
                      Active
                    </span>
                  </div>
                );
              }

              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => onToggleGhost(p.id)}
                  role="checkbox"
                  aria-checked={isGhosted}
                  className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors up-chrome-btn ${
                    isGhosted
                      ? 'bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {isGhosted ? (
                      <span
                        className="w-4 h-4 rounded flex items-center justify-center text-white shrink-0 shadow-2xs transition-transform"
                        style={{ backgroundColor: ghostStyle.dot }}
                      >
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    ) : (
                      <span
                        className="w-4 h-4 rounded border-2 bg-white dark:bg-slate-900 shrink-0 transition-colors opacity-75"
                        style={{ borderColor: ghostStyle.dot }}
                      />
                    )}
                    <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                      {p.name}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${
                      isGhosted
                        ? 'font-medium bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {isGhosted && <Check className="w-2.5 h-2.5 stroke-[2.5]" />}
                    {isGhosted ? 'Showing' : 'Click to overlay'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 px-1">
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

      {(onOpenShare || onImportFriendLink) && (
        <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-1">
          {onOpenShare && (
            <button
              type="button"
              onClick={onOpenShare}
              className="w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center gap-2 up-chrome-btn transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span>Copy share link (Active Plan)</span>
            </button>
          )}
          {onImportFriendLink && (
            <button
              type="button"
              onClick={onImportFriendLink}
              className="w-full text-left px-2 py-1.5 rounded text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 up-chrome-btn transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span>Import friend's link to compare...</span>
            </button>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="up-header-compare relative shrink-0" ref={ghostDropdownRef}>
      <button
        type="button"
        id="btn-ghost-overlay"
        onClick={onToggleOpen}
        className={`${isPhone ? 'up-icon-btn' : 'up-text-trigger'} up-chrome-btn ${ghostMenuOpen ? 'is-open' : ''}`}
        title="Compare plans"
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

      {isPhone && typeof document !== 'undefined' ? (
        createPortal(
          <AnimatePresence>
            {ghostMenuOpen && (
              <>
                <motion.div
                  key="compare-backdrop"
                  className="up-sheet-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{
                    opacity: 0,
                    transition: reduceMotion ? { duration: 0 } : sheetCloseTransition,
                  }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: EASE_OUT }}
                  onClick={onToggleOpen}
                />
                <motion.div
                  key="compare-sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Compare plans"
                  className="up-mobile-sheet will-change-transform"
                  initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
                  animate={{ opacity: 1, y: 0 }}
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
                    onClick={onToggleOpen}
                    aria-label="Close compare"
                  >
                    <span className="up-pool-handle" />
                  </button>
                  <div className="up-pool-head px-4">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      <h2 className="up-pool-title">Compare plans</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {ghostPlanIds.length > 0 && (
                        <button
                          type="button"
                          onClick={onClearGhosts}
                          className="text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-medium px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 up-chrome-btn"
                        >
                          Clear all
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onToggleOpen}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 up-chrome-btn"
                        title="Close compare"
                        aria-label="Close compare"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="up-mobile-sheet-body up-scroll pt-2">
                    {renderContent()}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )
      ) : (
        <AnimatePresence>
          {ghostMenuOpen && (
            <motion.div
              key="compare-dropdown"
              initial={menuEnter}
              animate={menuShown}
              exit={menuLeave}
              transition={menuOpenTransition}
              style={{ transformOrigin: 'top right' }}
              className="up-menu absolute right-0 top-full mt-1.5 w-[calc(100vw-2rem)] max-w-xs sm:w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-[0_4px_12px_rgb(15_23_42/0.12)] z-50 p-2.5 text-xs"
            >
              {renderContent()}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};
