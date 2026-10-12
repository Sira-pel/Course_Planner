import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { useModalMotion } from '../../utils/motion';

interface BackupRestoreDialogProps {
  open: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function BackupRestoreDialog({ open, message, onCancel, onConfirm }: BackupRestoreDialogProps) {
  const { backdropProps, panelProps } = useModalMotion(open);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => cancelRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, onCancel]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="up-sheet-backdrop up-confirm-backdrop"
            {...backdropProps}
            onClick={onCancel}
          />
          <div className="up-confirm-dialog fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="backup-restore-title"
              className="pointer-events-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
              {...panelProps}
            >
              <h2 id="backup-restore-title" className="text-base font-semibold text-slate-900 dark:text-white">
                Replace your schedule?
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {message}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <button
                  ref={cancelRef}
                  type="button"
                  autoFocus
                  onClick={onCancel}
                  className="px-3 py-2 text-sm font-medium rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 up-chrome-btn"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="btn-backup-restore-confirm"
                  onClick={onConfirm}
                  className="px-3 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 up-chrome-btn"
                >
                  Replace
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
