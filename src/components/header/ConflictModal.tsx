import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import type { Conflict } from '../../types/schedule';
import { formatConflictPairTitle, formatConflictPairWhen, groupConflictsByPair } from '../../utils/timeUtils';
import { EASE_SMOOTH } from '../../utils/motion';

interface ConflictModalProps {
  open: boolean;
  conflicts: Conflict[];
  activePlanName: string | undefined;
  reduceMotion: boolean | null;
  onClose: () => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  open,
  conflicts,
  activePlanName,
  reduceMotion,
  onClose,
}) => {
  if (typeof document === 'undefined') return null;

  const groups = groupConflictsByPair(conflicts);
  const pairCount = groups.length;
  const pairLabel =
    pairCount === 0
      ? 'Schedule collision detected'
      : `${pairCount} ${pairCount === 1 ? 'conflict' : 'conflicts'}`;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="conflict-modal"
          className="fixed inset-0 z-[100] course-modal-backdrop flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: reduceMotion ? { duration: 0 } : { duration: 0.16, ease: EASE_SMOOTH } }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: EASE_SMOOTH }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-slate-950/65" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="conflict-modal-title"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.975, y: 4, transition: { duration: 0.16, ease: EASE_SMOOTH } }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: EASE_SMOOTH }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-900/60 shadow-[0_8px_24px_rgb(15_23_42/0.18)] max-w-md w-full min-w-0 p-5 will-change-transform"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 id="conflict-modal-title" className="font-bold text-base text-slate-900 dark:text-white">
                  {pairLabel}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="up-icon-btn up-chrome-btn"
                title="Close"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3 space-y-2.5">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                These courses in <strong>{activePlanName}</strong> overlap. Each pair is listed once, with every day it collides.
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {groups.map((group) => (
                  <div
                    key={group.key}
                    className="p-3 rounded-md border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 text-xs"
                  >
                    <div className="font-bold text-rose-800 dark:text-rose-300">
                      {formatConflictPairTitle(group)}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mt-1 font-mono text-[11px]">
                      {formatConflictPairWhen(group)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 text-xs font-medium rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 up-chrome-btn text-center"
              >
                Close and adjust
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
