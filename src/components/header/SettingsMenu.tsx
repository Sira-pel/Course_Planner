import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { TargetAndTransition, Transition } from 'motion/react';
import {
  Download,
  Keyboard,
  Moon,
  RotateCcw,
  Settings,
  ShoppingBag,
  Sparkles,
  Sun,
  Upload,
} from 'lucide-react';

interface SettingsMenuProps {
  isPhone: boolean;
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
  onLoadDemo: () => void;
  onClearAll: () => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  isPhone,
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
  onLoadDemo,
  onClearAll,
}) => {
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  useEffect(() => {
    if (!isSettingsOpen) setIsConfirmingClear(false);
  }, [isSettingsOpen]);

  return (
    <div className="up-settings-anchor" ref={settingsRef}>
      <button
        type="button"
        id="btn-settings"
        onClick={onToggleOpen}
        className={`up-icon-btn up-chrome-btn ${isSettingsOpen ? 'is-open' : ''}`}
        title="Settings"
        aria-label="Settings"
        aria-haspopup="dialog"
        aria-expanded={isSettingsOpen}
      >
        <Settings className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            role="dialog"
            aria-label="Settings"
            initial={menuEnter}
            animate={menuShown}
            exit={menuLeave}
            transition={menuOpenTransition}
            style={{ transformOrigin: isPhone ? 'bottom center' : 'top right' }}
            className="up-menu up-settings up-scroll"
          >
            <div className="up-settings-controls">
              <div>
                <label className="up-settings-field-label" htmlFor="settings-start-hour">
                  Time range
                </label>
                <div className="up-settings-range">
                  <select
                    id="settings-start-hour"
                    value={startHour}
                    onChange={(e) => onSetTimeRange(Number(e.target.value), endHour)}
                    className="up-settings-select"
                    aria-label="Calendar start hour"
                  >
                    {Array.from({ length: 8 }, (_, i) => i + 5).map((h) => (
                      <option key={`start-${h}`} value={h}>{h}:00</option>
                    ))}
                  </select>
                  <span className="up-settings-range-sep">to</span>
                  <select
                    id="settings-end-hour"
                    value={endHour}
                    onChange={(e) => onSetTimeRange(startHour, Number(e.target.value))}
                    className="up-settings-select up-settings-select-end"
                    aria-label="Calendar end hour"
                  >
                    {Array.from({ length: 9 }, (_, i) => i + 16).map((h) => (
                      <option key={`end-${h}`} value={h}>{h}:00</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="up-settings-toggle-row">
                <span className="up-settings-toggle-label">Show weekends</span>
                <button
                  type="button"
                  onClick={() => onSetShowWeekends(!showWeekends)}
                  className={`up-settings-switch up-chrome-btn ${showWeekends ? 'is-on' : ''}`}
                  aria-pressed={showWeekends}
                  aria-label="Show weekends"
                >
                  <span aria-hidden="true" className="up-settings-switch-knob" />
                </button>
              </div>
            </div>

            <div className="up-settings-group">
              <button
                type="button"
                id="btn-open-catalog"
                onClick={onOpenCatalog}
                className="up-settings-item up-chrome-btn"
              >
                <ShoppingBag />
                Course pool
              </button>
              <button
                type="button"
                onClick={onToggleTheme}
                className="up-settings-item up-chrome-btn"
              >
                {theme === 'dark' ? <Sun /> : <Moon />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <button
                type="button"
                onClick={onImportIcsClick}
                className="up-settings-item up-chrome-btn"
              >
                <Upload />
                Import calendar (.ics)
              </button>
              <button
                type="button"
                onClick={onOpenExport}
                className="up-settings-item up-chrome-btn"
              >
                <Download />
                Export schedule
              </button>
              <button
                type="button"
                onClick={onOpenShortcuts}
                className="up-settings-item up-chrome-btn"
              >
                <Keyboard />
                Keyboard shortcuts
              </button>
            </div>

            <div className="up-settings-group">
              <button
                type="button"
                id="btn-load-demo"
                onClick={onLoadDemo}
                className="up-settings-item up-chrome-btn"
              >
                <Sparkles />
                Load demo
              </button>
              {isConfirmingClear ? (
                <div className="up-settings-confirm" role="group" aria-label="Confirm clear all">
                  <p>Clear all plans and the course pool?</p>
                  <div className="up-settings-confirm-actions">
                    <button
                      type="button"
                      id="btn-clear-all-confirm"
                      className="up-settings-confirm-yes up-chrome-btn"
                      onClick={onClearAll}
                    >
                      Yes, clear all
                    </button>
                    <button
                      type="button"
                      className="up-settings-confirm-no up-chrome-btn"
                      onClick={() => setIsConfirmingClear(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  id="btn-clear-all"
                  onClick={() => setIsConfirmingClear(true)}
                  className="up-settings-item is-danger up-chrome-btn"
                >
                  <RotateCcw />
                  Clear all
                </button>
              )}
            </div>

            <p className="up-settings-tip">
              Double-click a time slot on the week to add a class.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
