import React, { useEffect, useState, Suspense, lazy } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { TargetAndTransition, Transition } from 'motion/react';
import {
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  Settings,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { ModalTabPill } from '../app/ModalTabPill';
import { ClearAllDialog } from './ClearAllDialog';
import { usePWAInstall } from '../../utils/usePWAInstall';
import type { ThemePreference } from '../../utils/theme';
import { EASE_OUT, SHEET_OPEN_TRANSITION, SHEET_CLOSE_TRANSITION, SHEET_BACKDROP_OPEN_TRANSITION, SHEET_BACKDROP_CLOSE_TRANSITION } from '../../utils/motion';

const PWAInstallModal = lazy(() => import('../pwa/PWAInstallModal').then((m) => ({ default: m.PWAInstallModal })));

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
  timeRangeMode: 'auto' | 'custom';
  weekStart: 'monday' | 'sunday';
  showWeekends: boolean;
  themePreference: ThemePreference;
  onToggleOpen: () => void;
  onSetTimeRange: (start: number, end: number) => void;
  onSetTimeRangeMode: (mode: 'auto' | 'custom') => void;
  onSetWeekStart: (weekStart: 'monday' | 'sunday') => void;
  onSetShowWeekends: (show: boolean) => void;
  onSetThemePreference: (preference: ThemePreference, event: React.MouseEvent<HTMLElement>) => void;
  onOpenShortcuts: () => void;
  onOpenHelp: () => void;
  onLoadDemo: () => void;
  onClearAll: () => void;
}

const START_HOURS = Array.from({ length: 8 }, (_, i) => i + 5);
const END_HOURS = Array.from({ length: 9 }, (_, i) => i + 16);

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
  timeRangeMode,
  weekStart,
  showWeekends,
  themePreference,
  onToggleOpen,
  onSetTimeRange,
  onSetTimeRangeMode,
  onSetWeekStart,
  onSetShowWeekends,
  onSetThemePreference,
  onOpenShortcuts,
  onOpenHelp,
  onLoadDemo,
  onClearAll,
}) => {
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const reduceMotion = useReducedMotion();

  const sheetOpenTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SHEET_OPEN_TRANSITION;
  const sheetCloseTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SHEET_CLOSE_TRANSITION;
  const backdropOpenTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SHEET_BACKDROP_OPEN_TRANSITION;
  const backdropCloseTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SHEET_BACKDROP_CLOSE_TRANSITION;

  useEffect(() => {
    if (!isSettingsOpen) setIsConfirmingClear(false);
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!isPhone || !isSettingsOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('up-sheet-open');
    return () => {
      document.body.style.overflow = previous;
      document.body.classList.remove('up-sheet-open');
    };
  }, [isPhone, isSettingsOpen]);

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

  const renderContent = () => (
    <>
      <div className="up-settings-controls">
        <div>
          <span className="up-settings-field-label" id="settings-appearance-label">Appearance</span>
          <div className="up-segment" role="group" aria-labelledby="settings-appearance-label">
            {(['light', 'dark', 'system'] as const).map((preference) => (
              <button
                key={preference}
                type="button"
                id={preference === 'system' ? 'btn-appearance-system' : undefined}
                className="up-segment-btn up-chrome-btn"
                aria-pressed={themePreference === preference}
                onClick={(event) => onSetThemePreference(preference, event)}
              >
                {themePreference === preference && <ModalTabPill layoutId="settings-appearance" />}
                <span className="relative">{preference === 'light' ? 'Light' : preference === 'dark' ? 'Dark' : 'System'}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="up-settings-field-label" id="settings-range-mode-label">Hours</span>
          <div className="up-segment up-segment-2" role="group" aria-labelledby="settings-range-mode-label">
            {(['auto', 'custom'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className="up-segment-btn up-chrome-btn"
                aria-pressed={timeRangeMode === mode}
                onClick={() => onSetTimeRangeMode(mode)}
              >
                {timeRangeMode === mode && <ModalTabPill layoutId="settings-hours" />}
                <span className="relative">{mode === 'auto' ? 'Auto-fit' : 'Custom'}</span>
              </button>
            ))}
          </div>
          {timeRangeMode === 'auto' ? (
            <p className="up-settings-hint">Hours follow your classes, with a little padding.</p>
          ) : (
            <div className="up-settings-range mt-2">
            <select
              id="settings-start-hour"
              value={startHour}
              onChange={(e) => onSetTimeRange(Number(e.target.value), endHour)}
              className="up-settings-select"
              aria-label="Calendar start hour"
            >
              {START_HOURS.map((h) => (
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
              {END_HOURS.map((h) => (
                <option key={`end-${h}`} value={h} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{h}:00</option>
              ))}
            </select>
            </div>
          )}
        </div>

        <div>
          <span className="up-settings-field-label" id="settings-week-start-label">Week start</span>
          <div className="up-segment up-segment-2" role="group" aria-labelledby="settings-week-start-label">
            {(['monday', 'sunday'] as const).map((day) => (
              <button
                key={day}
                type="button"
                className="up-segment-btn up-chrome-btn"
                aria-pressed={weekStart === day}
                onClick={() => onSetWeekStart(day)}
              >
                {weekStart === day && <ModalTabPill layoutId="settings-week-start" />}
                <span className="relative">{day === 'monday' ? 'Monday' : 'Sunday'}</span>
              </button>
            ))}
          </div>
          <p className="up-settings-hint">Applies when weekends are shown.</p>
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
          id="btn-open-help"
          onClick={onOpenHelp}
          className="up-settings-item up-chrome-btn"
        >
          <HelpCircle />
          Help
        </button>
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
        <button
          type="button"
          id="btn-clear-all"
          onClick={() => setIsConfirmingClear(true)}
          className="up-settings-item is-danger up-chrome-btn"
        >
          <RotateCcw />
          Clear all
        </button>
      </div>

      <p className="up-settings-tip">
        Double-click a time slot on the week to add a class.
      </p>
    </>
  );

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

      {isPhone && typeof document !== 'undefined' ? (
        createPortal(
          <AnimatePresence>
            {isSettingsOpen && (
              <>
                <motion.div
                  key="settings-backdrop"
                  className="up-sheet-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{
                    opacity: 0,
                    transition: backdropCloseTransition,
                  }}
                  transition={backdropOpenTransition}
                  onClick={onToggleOpen}
                />
                <motion.div
                  key="settings-sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Settings"
                  className="up-mobile-sheet up-settings will-change-transform"
                  initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
                  animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
                  exit={
                    reduceMotion
                      ? { opacity: 0, transition: { duration: 0 } }
                      : { y: '100%', transition: sheetCloseTransition }
                  }
                  transition={sheetOpenTransition}
                >
                  <button
                    type="button"
                    className="up-pool-handle-hit"
                    onClick={onToggleOpen}
                    aria-label="Close settings"
                  >
                    <span className="up-pool-handle" />
                  </button>
                  <div className="up-pool-head px-4">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      <h2 className="up-pool-title">Settings</h2>
                    </div>
                    <button
                      type="button"
                      onClick={onToggleOpen}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 up-chrome-btn"
                      aria-label="Close settings"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="up-mobile-sheet-body up-scroll">
                    {renderContent()}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )
      ) : (
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              key="settings-dropdown"
              role="dialog"
              aria-label="Settings"
              initial={menuEnter}
              animate={menuShown}
              exit={menuLeave}
              transition={menuOpenTransition}
              style={{ transformOrigin: 'top right' }}
              className="up-menu up-settings up-scroll"
            >
              {renderContent()}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <ClearAllDialog
        open={isConfirmingClear}
        onCancel={() => setIsConfirmingClear(false)}
        onConfirm={onClearAll}
      />

      <Suspense fallback={null}>
        <PWAInstallModal
          isOpen={showInstallGuide}
          onClose={() => setShowInstallGuide(false)}
          isIOS={isIOS}
        />
      </Suspense>
    </div>
  );
};
