import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { TargetAndTransition, Transition } from 'motion/react';
import {
  Trash2,
  Edit2,
  Check,
  X,
  ChevronDown,
  FolderPlus,
  FolderKanban,
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
  nextSuggestedName: string;
  planIdConfirmDelete: string | null;
  plansDropdownRef: React.RefObject<HTMLDivElement | null>;
  onToggleOpen: () => void;
  onSelectPlan: (planId: string) => void;
  onEditingNameChange: (value: string) => void;
  onStartRename: (planId: string, currentName: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onNewPlan: (input: { name: string; mode: 'blank' | 'duplicate' }) => void;
  onRequestDelete: (planId: string) => void;
  onConfirmDelete: (planId: string) => void;
  onCancelDelete: () => void;
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
  nextSuggestedName,
  planIdConfirmDelete,
  plansDropdownRef,
  onToggleOpen,
  onSelectPlan,
  onEditingNameChange,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onNewPlan,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onSharePlan,
}) => {
  const reduceMotion = useReducedMotion();
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<'blank' | 'duplicate'>('blank');
  const [newPlanName, setNewPlanName] = useState('');

  useEffect(() => {
    if (!plansMenuOpen) {
      setComposerOpen(false);
      setComposerMode('blank');
      setNewPlanName('');
    }
  }, [plansMenuOpen]);

  const submitNewPlan = () => {
    onNewPlan({ name: newPlanName, mode: composerMode });
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
                className="flex items-center gap-1.5 p-1.5 rounded-md bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800"
              >
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => onEditingNameChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSaveRename();
                    if (e.key === 'Escape') onCancelRename();
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

          if (planIdConfirmDelete === plan.id) {
            return (
              <div
                key={plan.id}
                className="flex items-center justify-between p-2 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50"
              >
                <span className="text-[11px] text-rose-700 dark:text-rose-300 font-medium truncate mr-1">
                  Delete "{plan.name}"?
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onConfirmDelete(plan.id)}
                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-semibold up-chrome-btn"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={onCancelDelete}
                    className="px-1.5 py-0.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-[10px] up-chrome-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={plan.id}
              className={`group flex items-center justify-between px-2 py-1.5 rounded-md transition-colors cursor-pointer ${
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80 text-indigo-900 dark:text-indigo-200'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
              }`}
              onClick={() => onSelectPlan(plan.id)}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isActive ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-slate-300 dark:bg-slate-600'
                }`} />
                <span className="truncate font-medium text-xs">
                  {plan.name}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums shrink-0">
                  {planCredits} cr
                </span>
              </div>

              <div
                className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 ml-1.5 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {onSharePlan && (
                  <button
                    type="button"
                    onClick={() => onSharePlan(plan)}
                    className="p-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors up-chrome-btn"
                    title={`Share ${plan.name}`}
                    aria-label={`Share ${plan.name}`}
                  >
                    <Share2 className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onStartRename(plan.id, plan.name)}
                  className="p-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors up-chrome-btn"
                  title="Rename plan"
                  aria-label={`Rename ${plan.name}`}
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                {plans.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRequestDelete(plan.id)}
                    className="p-1 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors up-chrome-btn"
                    title="Delete plan"
                    aria-label={`Delete ${plan.name}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
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
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNewPlan();
              }}
              placeholder={`New name (e.g. ${nextSuggestedName})`}
              aria-label="New plan name"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div
              role="radiogroup"
              aria-label="New plan type"
              className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg"
            >
              <button
                type="button"
                role="radio"
                aria-checked={composerMode === 'blank'}
                onClick={() => setComposerMode('blank')}
                className={`relative min-w-0 px-2 py-1.5 rounded-md text-[11px] font-semibold ${
                  composerMode === 'blank'
                    ? 'text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {composerMode === 'blank' && <ModalTabPill layoutId="new-plan-mode" />}
                <span className="relative z-10 block truncate">Blank</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={composerMode === 'duplicate'}
                onClick={() => setComposerMode('duplicate')}
                disabled={!activePlan}
                title={activePlan ? `Duplicate "${activePlan.name}"` : undefined}
                className={`relative min-w-0 px-2 py-1.5 rounded-md text-[11px] font-semibold disabled:opacity-40 ${
                  composerMode === 'duplicate'
                    ? 'text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {composerMode === 'duplicate' && <ModalTabPill layoutId="new-plan-mode" />}
                <span className="relative z-10 block truncate">
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

  return (
    <div className="relative" ref={plansDropdownRef}>
      <button
        type="button"
        id="btn-plans-dropdown"
        onClick={onToggleOpen}
        className={`up-text-trigger up-chrome-btn ${plansMenuOpen ? 'is-open' : ''}`}
        title="View, switch, manage, and create plans"
        aria-haspopup="true"
        aria-expanded={plansMenuOpen}
      >
        <FolderKanban className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Plans</span>
        <span className="sm:hidden truncate max-w-[46vw]">{activePlan?.name || 'Plans'}</span>
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
    </div>
  );
};
