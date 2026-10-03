import { AlertTriangle, X } from 'lucide-react';
import React, { useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  clearStorageWriteFailure,
  getStorageWriteError,
  storageWriteErrorMessage,
  subscribeStorageWriteError,
} from '../store/storageWrite';
import { EASE_OUT, EASE_SMOOTH } from '../utils/motion';

export const StorageWriteBanner: React.FC = () => {
  const kind = useSyncExternalStore(
    subscribeStorageWriteError,
    getStorageWriteError,
    () => null
  );

  return (
    <AnimatePresence>
      {kind !== null && (
        <motion.div
          role="alert"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.24, ease: EASE_SMOOTH }}
          className="shrink-0 overflow-hidden bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-100"
        >
          <div className="px-3 py-2 max-w-[1720px] mx-auto flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="flex-1 text-xs font-medium leading-snug">
              {storageWriteErrorMessage(kind)}
            </p>
            <button
              type="button"
              onClick={clearStorageWriteFailure}
              className="p-0.5 rounded text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 up-chrome-btn"
              aria-label="Dismiss storage warning"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
