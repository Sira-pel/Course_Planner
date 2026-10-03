import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from '../utils/useOnlineStatus';
import { EASE_OUT, EASE_SMOOTH } from '../utils/motion';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [isDismissed, setIsDismissed] = useState(false);

  // Reset dismissal state whenever connection is restored
  useEffect(() => {
    if (isOnline) {
      setIsDismissed(false);
    }
  }, [isOnline]);

  const showToast = !isOnline && !isDismissed;

  return (
    <AnimatePresence>
      {showToast && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.24, ease: EASE_SMOOTH }}
          className="fixed bottom-20 sm:bottom-4 left-4 right-4 sm:right-auto z-50 flex items-center justify-between sm:justify-start gap-2.5 rounded-xl bg-slate-900/95 dark:bg-slate-800/95 text-amber-300 dark:text-amber-200 px-3.5 py-2.5 sm:py-2 text-xs font-medium shadow-xl border border-amber-500/30 backdrop-blur-md max-w-md pointer-events-auto"
        >
          <div className="flex items-center gap-2 min-w-0">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate sm:whitespace-normal">
              Offline Mode — Running locally. All edits are saved.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Close offline warning"
            className="p-1 -mr-1 rounded-lg text-amber-300/70 hover:text-amber-200 hover:bg-amber-400/10 active:scale-95 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
