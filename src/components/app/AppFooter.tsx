/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, RotateCcw, HelpCircle } from 'lucide-react';

export interface AppFooterProps {
  isConfirmingClear: boolean;
  onRequestClear: () => void;
  onConfirmClear: () => void;
  onCancelClear: () => void;
  onLoadDemo: () => void;
  onOpenShortcuts: () => void;
}

export function AppFooter({
  isConfirmingClear,
  onRequestClear,
  onConfirmClear,
  onCancelClear,
  onLoadDemo,
  onOpenShortcuts,
}: AppFooterProps) {
  return (
    <footer className="up-footer flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300 py-2 border-t border-slate-200/80 dark:border-slate-800/80 flex-wrap">
      <div className="up-footer-tip flex items-center gap-3">
        <span className="flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          Tip: Double-click any time slot on the calendar to instantly add a class.
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenShortcuts}
          className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Shortcuts</span>
        </button>
        <span>•</span>
        {isConfirmingClear ? (
          <div className="inline-flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/80 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900 animate-in fade-in">
            <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">Clear all plans & pool?</span>
            <button
              type="button"
              onClick={onConfirmClear}
              className="px-2 py-0.5 text-[10px] font-bold bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors"
            >
              Yes, Clear All
            </button>
            <button
              type="button"
              onClick={onCancelClear}
              className="px-1 text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={onRequestClear}
              className="inline-flex items-center gap-1 hover:text-rose-500 transition-colors"
              title="Clear all courses and start with a blank schedule"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear All</span>
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={onLoadDemo}
              className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title="Load example courses and schedule plans"
            >
              <span>Load Demo</span>
            </button>
          </div>
        )}
      </div>
    </footer>
  );
}
