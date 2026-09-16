import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { TargetAndTransition, Transition } from 'motion/react';
import {
  Plus,
  Copy,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronDown,
  FolderPlus,
  FolderKanban,
} from 'lucide-react';
import type { SchedulePlan } from '../../types/schedule';

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
  planIdConfirmDelete: string | null;
  plansDropdownRef: React.RefObject<HTMLDivElement | null>;
  onToggleOpen: () => void;
  onSelectPlan: (planId: string) => void;
  onEditingNameChange: (value: string) => void;
  onNewPlanNameChange: (value: string) => void;
  onStartRename: (planId: string, currentName: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onCreate: (name?: string) => void;
  onDuplicateActive: () => void;
  onRequestDelete: (planId: string) => void;
  onConfirmDelete: (planId: string) => void;
  onCancelDelete: () => void;
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
  planIdConfirmDelete,
  plansDropdownRef,
  onToggleOpen,
  onSelectPlan,
  onEditingNameChange,
  onNewPlanNameChange,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onCreate,
  onDuplicateActive,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}) => {
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

      <AnimatePresence>
        {plansMenuOpen && (
          <motion.div
            initial={menuEnter}
            animate={menuShown}
            exit={menuLeave}
            transition={menuOpenTransition}
            style={{ transformOrigin: isPhone ? 'bottom center' : 'top left' }}
            className="up-menu absolute left-0 top-full mt-1.5 w-[calc(100vw-2.5rem)] max-w-xs sm:w-84 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-[0_4px_12px_rgb(15_23_42/0.12)] z-50 p-3 text-xs"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-slate-500" />
                Schedule plans
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {plans.length} total
              </span>
            </div>

            <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5 mb-2.5">
              <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 px-1 pb-1">
                Select or manage plan
              </div>
              {plans.map((plan, index) => {
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
                        className="flex-1 px-2 py-1 text-xs rounded bg-white text-slate-900 dark:bg-slate-900 dark:text-white border border-indigo-400 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                      />
                      <button
                        type="button"
                        onClick={onSaveRename}
                        className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 up-chrome-btn"
                        title="Save"
                        aria-label="Save plan name"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={onCancelRename}
                        className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 up-chrome-btn"
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
                    onClick={() => onSelectPlan(plan.id)}
                    className={`group flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer border ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-800 text-indigo-950 dark:text-indigo-100'
                        : 'bg-white dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                          isActive
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {isActive ? <Check className="w-2.5 h-2.5" /> : index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`truncate text-xs ${isActive ? 'text-indigo-900 dark:text-indigo-200 font-bold' : 'font-medium'}`}>
                            {plan.name}
                          </span>
                          {isActive && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-300 shrink-0">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {plan.courses.length} courses · {planCredits} cr
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-1 ml-2 shrink-0 opacity-70 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onStartRename(plan.id, plan.name)}
                        title="Rename plan"
                        aria-label={`Rename ${plan.name}`}
                        className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 up-chrome-btn"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {plans.length > 1 && (
                        planIdConfirmDelete === plan.id ? (
                          <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">Delete?</span>
                            <button
                              type="button"
                              onClick={() => onConfirmDelete(plan.id)}
                              className="text-[10px] font-bold text-white bg-rose-600 px-1.5 py-0.5 rounded hover:bg-rose-700 up-chrome-btn"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={onCancelDelete}
                              className="text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onRequestDelete(plan.id)}
                            title="Delete plan"
                            aria-label={`Delete ${plan.name}`}
                            className="p-1 rounded text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-700 up-chrome-btn"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 px-1 mb-1.5 flex items-center justify-between">
                <span>Create new plan</span>
                <FolderPlus className="w-3 h-3 text-slate-400" />
              </div>

              <div className="flex items-center gap-1.5 mb-2">
                <input
                  type="text"
                  value={newPlanInputName}
                  onChange={(e) => onNewPlanNameChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onCreate();
                    if (e.key === 'Escape') onToggleOpen();
                  }}
                  placeholder={nextSuggestedName}
                  className="flex-1 px-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                />
                <button
                  type="button"
                  onClick={() => onCreate()}
                  className="px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-medium text-xs shrink-0 up-chrome-btn"
                >
                  Create
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onCreate(nextSuggestedName)}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-200 dark:border-slate-700 up-chrome-btn"
                >
                  <Plus className="w-3 h-3 text-slate-500" />
                  <span>Blank plan</span>
                </button>
                {activePlan && (
                  <button
                    type="button"
                    onClick={onDuplicateActive}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-200 dark:border-slate-700 truncate up-chrome-btn"
                    title={`Clone ${activePlan.name}`}
                  >
                    <Copy className="w-3 h-3 text-slate-500" />
                    <span className="truncate">Clone active</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
