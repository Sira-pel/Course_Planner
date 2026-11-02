import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  X,
  Compass,
  ShoppingBag,
  Upload,
  Download,
  Calendar,
  FileSpreadsheet,
  Copy,
  Layers,
  ArrowRight,
  Keyboard,
  RotateCcw,
  Edit3,
  Share2,
} from 'lucide-react';
import { useScheduleStore } from '../store/useScheduleStore';
import { SHORTCUT_DEFINITIONS, formatShortcutKeys } from '../types/shortcuts';
import { useModalMotion } from '../utils/motion';
import { AnimatedBody } from './app/AnimatedBody';
import { ModalTabPill } from './app/ModalTabPill';

export type HelpTabType = 'workflow' | 'transfer' | 'shortcuts';

const shortcutCategories = ['general', 'courses', 'navigation', 'tools'] as const;
const shortcutCategoryLabels: Record<(typeof shortcutCategories)[number], string> = {
  general: 'General',
  courses: 'Courses',
  navigation: 'Navigation',
  tools: 'Tools',
};

interface HelpModalProps {
  isOpen: boolean;
  initialTab?: HelpTabType;
  onClose: () => void;
  onOpenImport?: (tab?: 'excel' | 'share' | 'ics' | 'backup') => void;
  onOpenExport?: () => void;
  onOpenCatalog?: () => void;
  onTabChange?: (tab: HelpTabType) => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  initialTab = 'workflow',
  onClose,
  onOpenImport,
  onOpenExport,
  onOpenCatalog,
  onTabChange,
}) => {
  const customShortcuts = useScheduleStore((state) => state.customShortcuts);
  const setCustomShortcut = useScheduleStore((state) => state.setCustomShortcut);
  const resetCustomShortcuts = useScheduleStore((state) => state.resetCustomShortcuts);

  const [activeTab, setActiveTab] = useState<HelpTabType>(initialTab);
  const contentRef = useRef<HTMLDivElement>(null);
  const { backdropProps, panelProps, contentProps } = useModalMotion(isOpen);

  // Reset scroll position to top whenever active tab changes to prevent scroll glitching
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(null);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  const selectTab = (tab: HelpTabType) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  useEffect(() => {
    if (!isOpen) return;
    selectTab(initialTab);
  }, [initialTab, isOpen]);

  // Inline key combination recorder
  useEffect(() => {
    if (!editingShortcutId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (['Alt', 'Control', 'Shift', 'Meta'].includes(e.key)) return;

      if (e.key === 'Escape') {
        setEditingShortcutId(null);
        return;
      }

      const parts: string[] = [];
      if (e.altKey) parts.push('Alt');
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('Cmd');

      let mainKey = e.key.toUpperCase();
      if (e.code.startsWith('Key')) {
        mainKey = e.code.replace('Key', '');
      } else if (e.code.startsWith('Digit')) {
        mainKey = e.code.replace('Digit', '');
      }

      parts.push(mainKey);
      const combo = parts.join('+');

      setCustomShortcut(editingShortcutId, combo);
      setEditingShortcutId(null);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [editingShortcutId, setCustomShortcut]);

  const helpTabs: { id: HelpTabType; label: string; icon: React.ReactNode }[] = [
    { id: 'workflow', label: 'Start', icon: <Compass className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'transfer', label: 'Import/Export', icon: <Upload className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard className="w-3.5 h-3.5 shrink-0" /> },
  ];

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = helpTabs.findIndex((tab) => tab.id === activeTab);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % helpTabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + helpTabs.length) % helpTabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = helpTabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextId = helpTabs[nextIndex].id;
    selectTab(nextId);
    document.getElementById(`help-tab-${nextId}`)?.focus({ preventScroll: true });
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] course-modal-backdrop flex items-start sm:items-center justify-center p-2.5 sm:p-4 bg-black/60 md:backdrop-blur-xs overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          {...backdropProps}
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            {...panelProps}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl sm:max-w-3xl w-full min-w-0 p-4 sm:p-6 my-auto h-auto max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden will-change-transform"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="help-modal-title"
                    className="text-base font-bold text-slate-900 dark:text-white truncate"
                  >
                    Help
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    Plan, compare, share.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors shrink-0 up-chrome-btn"
                aria-label="Close help"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab switcher */}
            <div
              role="tablist"
              aria-label="Help topics"
              className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mt-3 shrink-0 relative"
            >
              {helpTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`help-tab-${tab.id}`}
                    type="button"
                    onClick={() => selectTab(tab.id)}
                    onKeyDown={handleTabKeyDown}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`help-panel-${tab.id}`}
                    tabIndex={isActive ? 0 : -1}
                    className={`relative min-w-0 w-full py-2 px-1 sm:px-3 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 text-center z-10 transition-colors duration-[var(--dur-chrome)] ease-[var(--ease-out)] ${
                      isActive
                        ? 'up-tab-on'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {isActive && <ModalTabPill layoutId="help-modal-tab" />}
                    <span className="relative z-10 flex min-w-0 items-center justify-center gap-1.5">
                      <span className="hidden sm:inline-flex">{tab.icon}</span>
                      <span className="truncate">{tab.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content Body with smooth cross-fade */}
            <AnimatedBody
              activeKey={activeTab}
              scrollRef={contentRef}
              className="min-h-0 max-h-[calc(100dvh-16rem)] sm:max-h-[calc(85vh-10rem)] overflow-y-auto overflow-x-hidden text-xs sm:text-[13px] up-scroll overscroll-contain [overflow-anchor:none] [scrollbar-gutter:stable]"
              contentClassName="py-4 sm:py-5 pb-8"
            >
              <motion.div
                key={activeTab}
                {...contentProps}
                id={`help-panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`help-tab-${activeTab}`}
                className="w-full will-change-[opacity]"
              >
                  {activeTab === 'shortcuts' && (
                    <div className="space-y-4 sm:space-y-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-slate-600 dark:text-slate-300">
                          Alt shortcuts help avoid browser and system conflicts.
                        </p>
                        {Object.keys(customShortcuts).length > 0 && (
                          <button
                            type="button"
                            onClick={resetCustomShortcuts}
                            className="px-3 py-2 text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg flex items-center gap-1.5 transition-colors shrink-0 up-chrome-btn active:scale-95"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset all
                          </button>
                        )}
                      </div>

                      <div className="space-y-4 sm:space-y-5">
                        {shortcutCategories.map((category) => {
                          const shortcuts = SHORTCUT_DEFINITIONS.filter((s) => s.category === category);
                          if (shortcuts.length === 0) return null;

                          return (
                            <section key={category} aria-labelledby={`shortcut-category-${category}`}>
                              <h3
                                id={`shortcut-category-${category}`}
                                className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2"
                              >
                                {shortcutCategoryLabels[category]}
                              </h3>
                              <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
                                {shortcuts.map((s) => {
                                  const currentBinding = customShortcuts[s.id] || s.defaultKey;
                                  const isEditing = editingShortcutId === s.id;
                                  const keyChips = formatShortcutKeys(currentBinding, isMac);

                                  return (
                                    <div key={s.id} className="flex items-center justify-between gap-3 py-2.5 sm:py-3">
                                      <div className="min-w-0 flex-1">
                                        <span className="font-semibold text-slate-900 dark:text-white">{s.name}</span>
                                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 leading-relaxed">
                                          {s.description}
                                        </p>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        {isEditing ? (
                                          <span className="px-2.5 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 rounded-lg animate-pulse border border-indigo-200 dark:border-indigo-700">
                                            Press keys... (Esc to cancel)
                                          </span>
                                        ) : (
                                          <div className="flex items-center gap-1">
                                            {keyChips.map((chip, idx) => (
                                              <kbd
                                                key={idx}
                                                className="px-2 py-1 rounded font-mono font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs text-xs"
                                              >
                                                {chip}
                                              </kbd>
                                            ))}
                                          </div>
                                        )}

                                        {s.isCustomizable && !isEditing && (
                                          <button
                                            type="button"
                                            onClick={() => setEditingShortcutId(s.id)}
                                            className="w-8 h-8 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors up-chrome-btn active:scale-90 flex items-center justify-center"
                                            title="Rebind shortcut"
                                            aria-label={`Rebind ${s.name}`}
                                          >
                                            <Edit3 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {activeTab === 'workflow' && (
                    <div className="space-y-5">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Plan your week</h3>
                        <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                          Add classes, compare options, then share.
                        </p>
                      </div>

                      <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
                        {[
                          { number: '1', title: 'Add', description: 'Double-click a slot, or use Add course.' },
                          { number: '2', title: 'Compare', description: 'Overlay another plan to weigh options.' },
                          { number: '3', title: 'Share', description: 'Send a link, calendar file, or image.' },
                        ].map(({ number, title, description }) => (
                          <div key={number} className="flex gap-3 py-3">
                            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {number}
                            </span>
                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                              <strong className="font-semibold text-slate-900 dark:text-slate-100">{title}.</strong> {description}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <ShoppingBag className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                            <strong className="font-semibold text-slate-900 dark:text-slate-100">Course pool.</strong> Keep options aside. They stay off the calendar, so they never clash. Tap + to add one, or Generate clash-free plans.
                          </p>
                        </div>
                        {onOpenCatalog && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenCatalog();
                            }}
                            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors up-chrome-btn active:scale-95 shrink-0 self-start"
                          >
                            Open pool <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 text-slate-500 dark:text-slate-400">
                        <span>
                          Undo any change with <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-xs">Ctrl+Z</kbd>.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            selectTab('shortcuts');
                            document.getElementById('help-tab-shortcuts')?.focus({ preventScroll: true });
                          }}
                          className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline inline-flex items-center gap-1 up-chrome-btn"
                        >
                          Shortcuts <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'transfer' && (
                    <div className="space-y-5">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Import and export</h3>
                        <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                          Move schedules in and out.
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">Import</h4>
                          {onOpenImport && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenImport('excel');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors up-chrome-btn active:scale-95 shrink-0"
                            >
                              Open import <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
                          <div className="flex items-start gap-3 py-3">
                            <FileSpreadsheet className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                            <p className="text-slate-700 dark:text-slate-300"><strong className="text-slate-900 dark:text-slate-100">Spreadsheet.</strong> Excel or CSV with times and rooms.</p>
                          </div>
                          <div className="flex items-start gap-3 py-3">
                            <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                            <p className="text-slate-700 dark:text-slate-300"><strong className="text-slate-900 dark:text-slate-100">Calendar.</strong> An .ics file of recurring classes.</p>
                          </div>
                          <div className="flex items-start gap-3 py-3">
                            <Share2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                            <p className="text-slate-700 dark:text-slate-300"><strong className="text-slate-900 dark:text-slate-100">Share link.</strong> A classmate’s plan.</p>
                          </div>
                          <div className="flex items-start gap-3 py-3">
                            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                            <p className="text-slate-700 dark:text-slate-300"><strong className="text-slate-900 dark:text-slate-100">Backup.</strong> Restore plans and the pool.</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">Export</h4>
                          {onOpenExport && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenExport();
                              }}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors up-chrome-btn active:scale-95 shrink-0"
                            >
                              Open export <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
                          <div className="flex items-start gap-3 py-3">
                            <Copy className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                            <p className="text-slate-700 dark:text-slate-300"><strong className="text-slate-900 dark:text-slate-100">Text.</strong> Paste into chat or notes.</p>
                          </div>
                          <div className="flex items-start gap-3 py-3">
                            <Share2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                            <p className="text-slate-700 dark:text-slate-300"><strong className="text-slate-900 dark:text-slate-100">Share link.</strong> Opens without an account.</p>
                          </div>
                          <div className="flex items-start gap-3 py-3">
                            <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                            <p className="text-slate-700 dark:text-slate-300"><strong className="text-slate-900 dark:text-slate-100">Calendar.</strong> Apple, Outlook, or Google.</p>
                          </div>
                          <div className="flex items-start gap-3 py-3">
                            <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                            <p className="text-slate-700 dark:text-slate-300"><strong className="text-slate-900 dark:text-slate-100">Image.</strong> A picture of your week.</p>
                          </div>
                          <div className="flex items-start gap-3 py-3">
                            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                            <p className="text-slate-700 dark:text-slate-300"><strong className="text-slate-900 dark:text-slate-100">Backup.</strong> Save plans, colors, and the pool.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
            </AnimatedBody>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
