import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { TargetAndTransition, Transition } from 'motion/react';
import {
  Download,
  Sun,
  Moon,
  Keyboard,
  Settings,
  Upload,
  ShoppingBag,
} from 'lucide-react';

interface SettingsMenuProps {
  isPhone: boolean;
  reduceMotion: boolean | null;
  menuEnter: TargetAndTransition;
  menuShown: TargetAndTransition;
  menuLeave: TargetAndTransition;
  menuOpenTransition: Transition;
  isSettingsOpen: boolean;
  settingsRef: React.RefObject<HTMLDivElement | null>;
  startHour: number;
  endHour: number;
  showWeekends: boolean;
  theme: 'light' | 'dark';
  onToggleOpen: () => void;
  onSetTimeRange: (start: number, end: number) => void;
  onSetShowWeekends: (show: boolean) => void;
  onOpenCatalog: () => void;
  onToggleTheme: (event: React.MouseEvent<HTMLElement>) => void;
  onImportIcsClick: () => void;
  onOpenExport: () => void;
  onOpenShortcuts: () => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  isPhone,
  reduceMotion,
  menuEnter,
  menuShown,
  menuLeave,
  menuOpenTransition,
  isSettingsOpen,
  settingsRef,
  startHour,
  endHour,
  showWeekends,
  theme,
  onToggleOpen,
  onSetTimeRange,
  onSetShowWeekends,
  onOpenCatalog,
  onToggleTheme,
  onImportIcsClick,
  onOpenExport,
  onOpenShortcuts,
}) => {
  return (
    <div className="relative" ref={settingsRef}>
      <button
        type="button"
        id="btn-settings"
        onClick={onToggleOpen}
        className={`up-icon-btn up-chrome-btn ${isSettingsOpen ? 'is-open' : ''}`}
        title="Settings"
        aria-label="Settings"
        aria-haspopup="menu"
        aria-expanded={isSettingsOpen}
      >
        <Settings className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            role="menu"
            aria-label="Settings"
            initial={menuEnter}
            animate={menuShown}
            exit={menuLeave}
            transition={menuOpenTransition}
            style={{ transformOrigin: isPhone ? 'bottom center' : 'top right' }}
            className="up-menu absolute right-0 top-full mt-1.5 w-[calc(100vw-2.5rem)] max-w-xs sm:w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-[0_4px_12px_rgb(15_23_42/0.12)] z-50 overflow-hidden"
          >
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">
                  Time range
                </label>
                <div className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 bg-slate-50 dark:bg-slate-800/50">
                  <select
                    value={startHour}
                    onChange={(e) => onSetTimeRange(Number(e.target.value), endHour)}
                    className="bg-transparent text-xs font-mono font-medium text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    {Array.from({ length: 8 }, (_, i) => i + 5).map((h) => (
                      <option key={`start-${h}`} value={h}>{h}:00</option>
                    ))}
                  </select>
                  <span className="text-slate-400 text-xs">to</span>
                  <select
                    value={endHour}
                    onChange={(e) => onSetTimeRange(startHour, Number(e.target.value))}
                    className="bg-transparent text-xs font-mono font-medium text-slate-700 dark:text-slate-300 cursor-pointer text-right focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    {Array.from({ length: 9 }, (_, i) => i + 16).map((h) => (
                      <option key={`end-${h}`} value={h}>{h}:00</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Show weekends</span>
                <button
                  type="button"
                  onClick={() => onSetShowWeekends(!showWeekends)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full up-chrome-btn ${
                    showWeekends ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                  aria-pressed={showWeekends}
                  aria-label="Show weekends"
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ${
                      showWeekends ? 'translate-x-2' : '-translate-x-2'
                    }`}
                    style={{
                      transitionProperty: 'transform',
                      transitionDuration: reduceMotion ? '0ms' : '160ms',
                      transitionTimingFunction: 'var(--ease-out)',
                    }}
                  />
                </button>
              </div>
            </div>

            <div className="py-1">
              <button
                type="button"
                role="menuitem"
                id="btn-open-catalog"
                onClick={onOpenCatalog}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 up-chrome-btn"
              >
                <ShoppingBag className="w-4 h-4 text-slate-400" />
                Course pool
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={onToggleTheme}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 up-chrome-btn"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4 text-slate-500" />
                    Light mode
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-slate-400" />
                    Dark mode
                  </>
                )}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={onImportIcsClick}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 up-chrome-btn"
              >
                <Upload className="w-4 h-4 text-slate-400" />
                Import calendar (.ics)
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={onOpenExport}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 up-chrome-btn"
              >
                <Download className="w-4 h-4 text-slate-400" />
                Export schedule
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={onOpenShortcuts}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 up-chrome-btn"
              >
                <Keyboard className="w-4 h-4 text-slate-400" />
                Keyboard shortcuts
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
