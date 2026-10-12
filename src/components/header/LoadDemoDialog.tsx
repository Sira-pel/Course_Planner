import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { useModalMotion } from '../../utils/motion';

interface LoadDemoDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LoadDemoDialog({ open, onCancel, onConfirm }: LoadDemoDialogProps) {
  const { backdropProps, panelProps } = useModalMotion(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
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
              aria-labelledby="load-demo-title"
              className="pointer-events-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
              {...panelProps}
            >
              <h2 id="load-demo-title" className="text-base font-semibold text-slate-900 dark:text-white">
                Load the demo semester?
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                This replaces your plans and the course pool with the sample semester. You can undo it.
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-3 py-2 text-sm font-medium rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 up-chrome-btn"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="btn-load-demo-confirm"
                  onClick={onConfirm}
                  className="px-3 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 up-chrome-btn"
                >
                  Load demo
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
