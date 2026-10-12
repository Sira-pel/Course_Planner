import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { TargetAndTransition, Transition } from 'motion/react';
import {
  Trash2,
  Pencil,
  Check,
  X,
  ChevronDown,
  FolderPlus,
  Folder,
  FolderKanban,
  MoreHorizontal,
  Share2,
} from 'lucide-react';
import type { SchedulePlan } from '../../types/schedule';
import { AnimatedBody } from '../app/AnimatedBody';
import { ModalTabPill } from '../app/ModalTabPill';
import { EASE_OUT, SHEET_OPEN_TRANSITION, SHEET_CLOSE_TRANSITION } from '../../utils/motion';

interface PlansMenuProps {
  isPhone: boolean;
  reduceMotion: boolean | null;
  menuEnter: TargetAndTransition;
  menuShown: TargetAndTransition;
  menuLeave: TargetAndTransition;
  menuOpenTransition: Transition;
  plans: SchedulePlan[];
  activePlanId: string;
  activePlan: SchedulePlan | undefined;
  plansMenuOpen: boolean;
  editingPlanId: string | null;
  editingName: string;
  newPlanInputName: string;
  nextSuggestedName: string;
  plansDropdownRef: React.RefObject<HTMLDivElement | null>;
  onToggleOpen: () => void;
  onSelectPlan: (planId: string) => void;
  onEditingNameChange: (value: string) => void;
  onNewPlanNameChange: (value: string) => void;
  onStartRename: (planId: string, currentName: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onNewPlan: (input: { name: string; mode: 'blank' | 'duplicate' }) => void;
  onDelete: (planId: string) => void;
  onSharePlan?: (plan: SchedulePlan) => void;
}

export const PlansMenu: React.FC<PlansMenuProps> = ({
  isPhone,
  menuEnter,
  menuShown,
  menuLeave,
  menuOpenTransition,
  plans,
  activePlanId,
  activePlan,
  plansMenuOpen,
  editingPlanId,
  editingName,
  newPlanInputName,
  nextSuggestedName,
  plansDropdownRef,
  onToggleOpen,
  onSelectPlan,
  onEditingNameChange,
  onNewPlanNameChange,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onNewPlan,
  onDelete,
  onSharePlan,
}) => {
  const reduceMotion = useReducedMotion();
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<'blank' | 'duplicate'>('blank');
  const [rowMenuPlanId, setRowMenuPlanId] = useState<string | null>(null);
  const rowMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const rowMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!plansMenuOpen) {
      setComposerOpen(false);
      setComposerMode('blank');
      setRowMenuPlanId(null);
    }
  }, [plansMenuOpen]);

  useEffect(() => {
    if (rowMenuPlanId && !plans.some((plan) => plan.id === rowMenuPlanId)) {
      setRowMenuPlanId(null);
    }
  }, [plans, rowMenuPlanId]);

  useEffect(() => {
    if (!rowMenuPlanId) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rowMenuRef.current?.contains(target)) return;
      if (rowMenuButtonRef.current?.contains(target)) return;
      setRowMenuPlanId(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setRowMenuPlanId(null);
    };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [rowMenuPlanId]);

  useLayoutEffect(() => {
    if (!rowMenuPlanId) return;
    const menu = rowMenuRef.current;
    const button = rowMenuButtonRef.current;
    if (!menu || !button) return;

    const place = () => {
      if (!button.isConnected) {
        setRowMenuPlanId(null);
        return;
      }
      const rect = button.getBoundingClientRect();
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      const gap = 4;
      let top = rect.bottom + gap;
      if (top + height > window.innerHeight - 8) {
        top = Math.max(8, rect.top - gap - height);
      }
      let left = rect.right - width;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      menu.style.top = `${top}px`;
      menu.style.left = `${left}px`;
      menu.style.visibility = 'visible';
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [rowMenuPlanId, plans.length]);

  const submitNewPlan = () => {
    onNewPlan({ name: newPlanInputName, mode: composerMode });
  };

  const sheetOpenTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SHEET_OPEN_TRANSITION;
  const sheetCloseTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SHEET_CLOSE_TRANSITION;

  React.useEffect(() => {
    if (!isPhone || !plansMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('up-sheet-open');
    return () => {
      document.body.style.overflow = previous;
      document.body.classList.remove('up-sheet-open');
    };
  }, [isPhone, plansMenuOpen]);

  const renderContent = () => (
    <>
      {!isPhone && (
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800">
          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <FolderKanban className="w-3.5 h-3.5 text-slate-500" />
            Schedule plans
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {plans.length} total
          </span>
        </div>
      )}

      <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5 mb-2.5">
        <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 px-1 pb-1">
          Select or manage plan
        </div>
        {plans.map((plan) => {
          const isActive = plan.id === activePlanId;
          const isEditing = editingPlanId === plan.id;
          const planCredits = plan.courses.reduce((sum, c) => sum + (c.credits || 0), 0);

          if (isEditing) {
            return (
              <div
                key={plan.id}
                className="flex items-center gap-1.5 p-1.5 rounded-md up-selected border"
              >
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => onEditingNameChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      onSaveRename();
                    }
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      onCancelRename();
                    }
                  }}
                  autoFocus
                  className="flex-1 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded px-1.5 py-0.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={onSaveRename}
                  className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded up-chrome-btn"
                  title="Save"
                  aria-label="Save plan name"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onCancelRename}
                  className="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded up-chrome-btn"
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
              className={`flex items-center justify-between px-2 py-1.5 rounded-md transition-colors cursor-pointer ${
                isActive
                  ? 'up-selected border'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
              }`}
              onClick={() => onSelectPlan(plan.id)}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isActive ? 'bg-current' : 'bg-slate-300 dark:bg-slate-600'
                }`} />
                <span className="truncate font-medium text-xs">
                  {plan.name}
                </span>
                <span className={`text-[10px] font-mono tabular-nums shrink-0 ${
                  isActive ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {planCredits} cr
                </span>
              </div>

              <button
                type="button"
                className="up-plan-row-btn up-chrome-btn"
                aria-haspopup="menu"
                aria-expanded={rowMenuPlanId === plan.id}
                aria-label={`Actions for ${plan.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  if (rowMenuPlanId === plan.id) {
                    setRowMenuPlanId(null);
                    return;
                  }
                  rowMenuButtonRef.current = event.currentTarget;
                  setRowMenuPlanId(plan.id);
                }}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <button
          type="button"
          onClick={() => setComposerOpen((open) => !open)}
          className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 up-chrome-btn"
          aria-expanded={composerOpen}
        >
          <FolderPlus className="w-3.5 h-3.5" />
          New plan
        </button>
        {composerOpen && (
          <AnimatedBody activeKey={`new-plan-${composerMode}`} contentClassName="space-y-2">
            <input
              type="text"
              value={newPlanInputName}
              onChange={(e) => onNewPlanNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNewPlan();
              }}
              placeholder={`New name (e.g. ${nextSuggestedName})`}
              aria-label="New plan name"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div
              role="tablist"
              aria-label="New plan type"
              className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg"
            >
              <button
                type="button"
                role="tab"
                aria-selected={composerMode === 'blank'}
                onClick={() => setComposerMode('blank')}
                className={`relative px-2 py-1.5 rounded-md text-[11px] font-semibold ${
                  composerMode === 'blank'
                    ? 'up-tab-on'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {composerMode === 'blank' && <ModalTabPill layoutId="new-plan-mode" />}
                <span className="relative z-10">Blank</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={composerMode === 'duplicate'}
                onClick={() => setComposerMode('duplicate')}
                disabled={!activePlan}
                title={activePlan ? `Duplicate "${activePlan.name}"` : undefined}
                className={`relative px-2 py-1.5 rounded-md text-[11px] font-semibold truncate disabled:opacity-40 ${
                  composerMode === 'duplicate'
                    ? 'up-tab-on'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {composerMode === 'duplicate' && <ModalTabPill layoutId="new-plan-mode" />}
                <span className="relative z-10 truncate">
                  {activePlan ? `Duplicate "${activePlan.name}"` : 'Duplicate'}
                </span>
              </button>
            </div>
            <button
              type="button"
              onClick={submitNewPlan}
              className="w-full px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium shadow-sm up-chrome-btn"
            >
              Create
            </button>
          </AnimatedBody>
        )}
      </div>
    </>
  );

  const menuPlan = plans.find((plan) => plan.id === rowMenuPlanId);
  const canDelete = plans.length > 1;
  const rowMenu = plansMenuOpen && menuPlan && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={rowMenuRef}
        role="menu"
        aria-label={`${menuPlan.name} actions`}
        className="up-plan-row-menu"
      >
        {onSharePlan && (
          <button
            type="button"
            role="menuitem"
            className="up-plan-row-item up-chrome-btn"
            onClick={() => {
              setRowMenuPlanId(null);
              onSharePlan(menuPlan);
            }}
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          className="up-plan-row-item up-chrome-btn"
          onClick={() => {
            setRowMenuPlanId(null);
            onStartRename(menuPlan.id, menuPlan.name);
          }}
        >
          <Pencil className="w-4 h-4" />
          Rename
        </button>
        {canDelete && <div className="up-plan-row-rule" role="separator" />}
        {canDelete && (
          <button
            type="button"
            role="menuitem"
            className="up-plan-row-item up-plan-row-item-danger up-chrome-btn"
            onClick={() => {
              setRowMenuPlanId(null);
              onDelete(menuPlan.id);
            }}
          >
            <Trash2 className="w-4 h-4" />
            Delete plan
          </button>
        )}
      </div>,
      document.body,
    )
    : null;

  return (
    <div className="up-plans-anchor relative" ref={plansDropdownRef}>
      <button
        type="button"
        id="btn-plans-dropdown"
        onClick={onToggleOpen}
        className={`up-text-trigger up-plan-trigger up-chrome-btn ${plansMenuOpen ? 'is-open' : ''}`}
        title={isPhone && activePlan?.name ? activePlan.name : 'View, switch, manage, and create plans'}
        aria-haspopup="true"
        aria-expanded={plansMenuOpen}
      >
        <Folder className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">Plans</span>
        <span className="up-plan-trigger-copy">
          <span className="up-plan-trigger-name">{activePlan?.name || 'Plans'}</span>
          <span className="up-plan-trigger-credits">
            {activePlan?.courses.reduce((sum, course) => sum + (course.credits || 0), 0) ?? 0} cr
          </span>
        </span>
        <ChevronDown className={`up-chevron w-3 h-3 opacity-60 shrink-0 ${plansMenuOpen ? 'is-open' : ''}`} />
      </button>

      {isPhone && typeof document !== 'undefined' ? (
        createPortal(
          <AnimatePresence>
            {plansMenuOpen && (
              <>
                <motion.div
                  key="plans-backdrop"
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
                  key="plans-sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Schedule plans"
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
                    aria-label="Close plans"
                  >
                    <span className="up-pool-handle" />
                  </button>
                  <div className="up-pool-head px-4">
                    <div className="flex items-center gap-2">
                      <FolderKanban className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      <h2 className="up-pool-title">Schedule plans</h2>
                    </div>
                    <button
                      type="button"
                      onClick={onToggleOpen}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 up-chrome-btn"
                      aria-label="Close plans"
                    >
                      <X className="w-4 h-4" />
                    </button>
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
          {plansMenuOpen && (
            <motion.div
              key="plans-dropdown"
              initial={menuEnter}
              animate={menuShown}
              exit={menuLeave}
              transition={menuOpenTransition}
              style={{ transformOrigin: 'top left' }}
              className="up-menu absolute left-0 top-full mt-1.5 w-[calc(100vw-2.5rem)] max-w-xs sm:w-84 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-[0_4px_12px_rgb(15_23_42/0.12)] z-50 p-3 text-xs"
            >
              {renderContent()}
            </motion.div>
          )}
        </AnimatePresence>
      )}
      {rowMenu}
    </div>
  );
};
