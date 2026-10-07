import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { EASE_OUT } from '../../utils/motion';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
  planId?: string;
}

export function AppToast({
  message,
  onDismiss,
}: {
  message: ToastMessage | null;
  onDismiss: () => void;
}) {
  const reduceMotion = useReducedMotion();
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {message && (
        <motion.div
          key="header-toast"
          role="status"
          aria-live="polite"
          className="up-app-toast fixed top-[7.25rem] right-5 max-w-[min(24rem,calc(100vw-2.5rem))]"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={
            reduceMotion
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, y: 12, transition: { duration: 0.15, ease: EASE_OUT } }
          }
          transition={reduceMotion ? { duration: 0 } : { duration: 0.4, ease: EASE_OUT }}
        >
          <div
            className={`flex items-start gap-2.5 px-4 py-2.5 rounded-lg shadow-lg border text-xs font-medium ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                : message.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/90 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                  : 'bg-slate-900 dark:bg-slate-800 text-white border-slate-700'
            }`}
          >
            <span className="min-w-0 break-words">{message.text}</span>
            <button
              type="button"
              onClick={onDismiss}
              className="shrink-0 opacity-70 hover:opacity-100 p-0.5 up-chrome-btn"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
