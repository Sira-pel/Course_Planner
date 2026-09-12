import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'Ctrl + N', desc: 'Open Add Course dialog' },
  { key: 'Ctrl + K', desc: 'Open Smart Quick-Add text parser' },
  { key: '1, 2, 3...', desc: 'Quick-switch to Plan A, B, C (when not typing)' },
  { key: 'Ctrl + D', desc: 'Duplicate current schedule plan' },
  { key: 'Ctrl + Z', desc: 'Undo previous action' },
  { key: 'Ctrl + Shift + Z', desc: 'Redo previously undone action' },
  { key: 'Ctrl + E', desc: 'Open Export menu (Text, .ics, PNG)' },
  { key: '?', desc: 'Show keyboard shortcuts guide' },
  { key: 'Escape', desc: 'Close any active modal dialog' },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Keyboard Shortcuts
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Speed through course registration week
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-2">
          {SHORTCUTS.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 text-xs"
            >
              <span className="text-slate-700 dark:text-slate-300">{s.desc}</span>
              <kbd className="px-2 py-1 rounded font-mono font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-2xs text-[11px]">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
