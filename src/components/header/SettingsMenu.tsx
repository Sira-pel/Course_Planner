import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { TargetAndTransition, Transition } from 'motion/react';
import {
  CheckCircle2,
  Download,
  HelpCircle,
  Keyboard,
  Moon,
  RotateCcw,
  Settings,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Sun,
  Upload,
} from 'lucide-react';
import { usePWAInstall } from '../../utils/usePWAInstall';
import { PWAInstallModal } from '../pwa/PWAInstallModal';

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
  onOpenImport?: (tab?: 'excel' | 'share' | 'ics' | 'backup') => void;
  onOpenExport: () => void;
  onOpenShortcuts: () => void;
  onOpenHelp: () => void;
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
  onOpenImport,
  onOpenExport,
  onOpenShortcuts,
  onOpenHelp,
  onLoadDemo,
  onClearAll,
}) => {
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  useEffect(() => {
    if (!isSettingsOpen) setIsConfirmingClear(false);
  }, [isSettingsOpen]);

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (!outcome) {
        setShowInstallGuide(true);
      }
    } else {
      setShowInstallGuide(true);
    }
  };

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
                      <option key={`start-${h}`} value={h} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{h}:00</option>
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
                      <option key={`end-${h}`} value={h} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{h}:00</option>
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
              {!isInstalled ? (
                <button
                  type="button"
                  id="btn-install-app"
                  onClick={handleInstallClick}
                  className="up-settings-item up-chrome-btn text-indigo-600 dark:text-indigo-400 font-semibold"
                >
                  <Smartphone />
                  <span>Install Uniplan app</span>
                </button>
              ) : (
                <div className="up-settings-item text-slate-500 dark:text-slate-400 pointer-events-none opacity-80 select-none">
                  <CheckCircle2 className="text-emerald-500" />
                  <span>App installed</span>
                </div>
              )}
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
                <Sun className="hidden dark:block" />
                <Moon className="block dark:hidden" />
                <span className="hidden dark:inline">Light mode</span>
                <span className="inline dark:hidden">Dark mode</span>
              </button>
              <button
                type="button"
                id="btn-open-import"
                onClick={() => {
                  if (onOpenImport) onOpenImport('excel');
                  else onImportIcsClick();
                }}
                className="up-settings-item up-chrome-btn"
              >
                <Upload />
                Import
              </button>
              <button
                type="button"
                onClick={onOpenExport}
                className="up-settings-item up-chrome-btn"
              >
                <Download />
                Export
              </button>
              <button
                type="button"
                id="btn-open-help"
                onClick={onOpenHelp}
                className="up-settings-item up-chrome-btn"
              >
                <HelpCircle />
                Help & Shortcuts
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

      <PWAInstallModal
        isOpen={showInstallGuide}
        onClose={() => setShowInstallGuide(false)}
        isIOS={isIOS}
      />
    </div>
  );
};
