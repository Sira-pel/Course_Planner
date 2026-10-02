import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  HelpCircle,
  X,
  Compass,
  ShoppingBag,
  Upload,
  Download,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  Copy,
  Layers,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Keyboard,
  RotateCcw,
  Edit3,
  Share2,
} from 'lucide-react';
import { useScheduleStore } from '../store/useScheduleStore';
import { SHORTCUT_DEFINITIONS, formatShortcutKeys } from '../types/shortcuts';
import { EASE_OUT } from '../utils/motion';

export type HelpTabType = 'workflow' | 'shortcuts' | 'pool' | 'import' | 'export';

interface HelpModalProps {
  isOpen: boolean;
  initialTab?: HelpTabType;
  onClose: () => void;
  onOpenImport?: (tab?: 'excel' | 'share' | 'ics' | 'backup') => void;
  onOpenExport?: () => void;
  onOpenCatalog?: () => void;
  onOpenShortcuts?: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  initialTab = 'workflow',
  onClose,
  onOpenImport,
  onOpenExport,
  onOpenCatalog,
  onOpenShortcuts,
}) => {
  const customShortcuts = useScheduleStore((state) => state.customShortcuts);
  const setCustomShortcut = useScheduleStore((state) => state.setCustomShortcut);
  const resetCustomShortcuts = useScheduleStore((state) => state.resetCustomShortcuts);

  const [activeTab, setActiveTab] = useState<HelpTabType>(initialTab);
  const contentRef = useRef<HTMLDivElement>(null);

  // Reset scroll position to top whenever active tab changes to prevent scroll glitching
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(null);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  useEffect(() => {
    setActiveTab(initialTab);
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
    { id: 'workflow', label: 'Workflow', icon: <Compass className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'pool', label: 'Course Pool', icon: <ShoppingBag className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'import', label: 'Import Files', icon: <Upload className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'export', label: 'Export & Sync', icon: <Download className="w-3.5 h-3.5 shrink-0" /> },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl sm:max-w-3xl w-full min-w-0 p-4 sm:p-6 my-auto max-h-[calc(100dvh-1.25rem)] sm:max-h-[90vh] flex flex-col overflow-hidden will-change-transform"
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
                    Help & Quick Guide
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    Everything you need to master your university schedule in 2 minutes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors shrink-0 up-chrome-btn"
                aria-label="Close help guide"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Switcher with sliding pill */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mt-3 shrink-0 relative [scrollbar-width:none]">
              {helpTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 text-center transition-colors duration-150 z-10 ${
                      isActive
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="activeHelpTabPill"
                        className="absolute inset-0 bg-white dark:bg-slate-900 rounded-lg shadow-xs -z-10"
                        transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                      />
                    )}
                    {tab.icon}
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content Body with smooth cross-fade */}
            <div
              ref={contentRef}
              className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-4 text-xs up-scroll overscroll-contain [overflow-anchor:none]"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: EASE_OUT }}
                  className="w-full"
                >
                  {activeTab === 'shortcuts' && (
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60">
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-indigo-950 dark:text-indigo-200 text-xs">
                            Clash-Free Keyboard Shortcuts
                          </p>
                          <p className="text-indigo-900/80 dark:text-indigo-300 text-[11px] mt-0.5 leading-relaxed">
                            Built with an Alt-based modifier scheme so shortcuts never clash with browser search bars or system tabs.
                          </p>
                        </div>
                        {Object.keys(customShortcuts).length > 0 && (
                          <button
                            type="button"
                            onClick={resetCustomShortcuts}
                            className="px-2.5 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/60 rounded-lg flex items-center gap-1.5 transition-colors shrink-0 up-chrome-btn active:scale-95"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Reset all
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        {SHORTCUT_DEFINITIONS.map((s) => {
                          const currentBinding = customShortcuts[s.id] || s.defaultKey;
                          const isEditing = editingShortcutId === s.id;
                          const keyChips = formatShortcutKeys(currentBinding, isMac);

                          return (
                            <div
                              key={s.id}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-xs gap-3"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900 dark:text-white truncate">
                                    {s.name}
                                  </span>
                                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                                    {s.category}
                                  </span>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-[11px] truncate mt-0.5">
                                  {s.description}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {isEditing ? (
                                  <span className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/80 rounded-lg animate-pulse border border-indigo-300 dark:border-indigo-700">
                                    Press keys... (Esc to cancel)
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    {keyChips.map((chip, idx) => (
                                      <kbd
                                        key={idx}
                                        className="px-2 py-0.8 rounded font-mono font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs text-[11px]"
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
                                    className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors up-chrome-btn active:scale-90"
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
                    </div>
                  )}
                  {activeTab === 'workflow' && (
                    <div className="space-y-3.5">
                      <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60">
                        <p className="font-semibold text-indigo-950 dark:text-indigo-200 text-xs">
                          What is Uniplan?
                        </p>
                        <p className="text-indigo-900/80 dark:text-indigo-300 text-[11px] mt-0.5 leading-relaxed">
                          A high-speed university schedule planner built to help you test schedule variations, spot class time collisions before registration day, and export ready-to-use calendars.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Recommended 4-Step Workflow
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[11px] flex items-center justify-center font-bold">1</span>
                                <span>Add or Import Classes</span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed text-[11px]">
                                Click <strong>Add course</strong>, double-click any calendar slot, or drop your university course list via <strong>Import</strong>.
                              </p>
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[11px] flex items-center justify-center font-bold">2</span>
                                <span>Adjust on the Grid</span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed text-[11px]">
                                Click any course block to edit meeting days, times, instructors, or color tags. Double-click empty slots to place a class instantly.
                              </p>
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[11px] flex items-center justify-center font-bold">3</span>
                                <span>Compare & In-Grid Edit</span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed text-[11px]">
                                Compare alternative plans or a friend's schedule side-by-side. You can <strong>click and edit ghost course blocks directly on the calendar</strong> and target your main plan or comparison plan when adding from the Course Pool.
                              </p>
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[11px] flex items-center justify-center font-bold">4</span>
                                <span>Share Link & Clean Export</span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed text-[11px]">
                                Generate an instant <strong>Shareable Friend Link</strong> so classmates can compare schedules in their browser without accounts, copy <strong>Clean Text</strong> for Discord/WhatsApp, download <code>.ics</code> calendars, or export PNG images.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[10px]">Ctrl+Z</kbd> anytime to undo accidental changes.</span>
                        <button
                          type="button"
                          onClick={() => setActiveTab('shortcuts')}
                          className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline inline-flex items-center gap-1 up-chrome-btn"
                        >
                          Shortcuts list <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'pool' && (
                    <div className="space-y-3.5">
                      <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/60">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <p className="font-semibold text-amber-950 dark:text-amber-200 text-xs">
                            The Course Pool: Think of it as your "Staging Bench"
                          </p>
                        </div>
                        <p className="text-amber-900/80 dark:text-amber-300 text-[11px] mt-1 leading-relaxed">
                          Not every course you are considering belongs on your weekly timetable right now. The <strong>Course Pool</strong> is a holding drawer for alternative sections, backup electives, and wishlists.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>No Calendar Clutter</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                            Courses stored in the Pool do <strong>not</strong> show up on your week view and will <strong>never</strong> trigger false conflict alerts.
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>1-Click Activation</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                            Click the <strong>+</strong> button on any pool course card to instantly place it on your current plan's weekly schedule.
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>Shared Across Plans</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                            Your Course Pool stays with you when switching between Plan A, Plan B, or Plan C, making it easy to swap different combinations.
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>Import Destination</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                            When importing a large department spreadsheet, choose <strong>"Import to Pool"</strong> so you can pick classes at your own pace without flooding the grid.
                          </p>
                        </div>
                      </div>

                      {onOpenCatalog && (
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenCatalog();
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors up-chrome-btn active:scale-95"
                          >
                            Open Course Pool drawer <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'import' && (
                    <div className="space-y-3.5">
                      <p className="text-slate-600 dark:text-slate-300 text-xs">
                        You do not need to manually type in every course. Uniplan supports 4 flexible import options:
                      </p>

                      <div className="space-y-2.5">
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                                Excel & CSV Spreadsheets (.xlsx, .csv)
                              </h4>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Most popular</span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-1 leading-relaxed">
                              Drop any course table downloaded from your university portal. Uniplan automatically detects columns: <strong>Course Code, Title, Day, Start/End Time, Room, and Instructor</strong>.
                            </p>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                            <Share2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                                Friend's Share Link or Code
                              </h4>
                              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">New</span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-1 leading-relaxed">
                              Paste a shareable link or code sent by a classmate. Preview course cards and credit hours, then choose to either <strong>overlay it as a ghost schedule</strong> or <strong>open it as your own active plan</strong>.
                            </p>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                              iCalendar Files (.ics)
                            </h4>
                            <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-1 leading-relaxed">
                              Download your official schedule from Canvas, Blackboard, Banner, or Google Calendar as an <code>.ics</code> file and drop it here. Weekly recurring classes will load automatically.
                            </p>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                              Uniplan Backup (.json)
                            </h4>
                            <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-1 leading-relaxed">
                              Transfer all your plans, custom color themes, and pool catalog to a different laptop or browser session seamlessly.
                            </p>
                          </div>
                        </div>
                      </div>

                      {onOpenImport && (
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenImport('excel');
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors up-chrome-btn active:scale-95"
                          >
                            Open Import dialog <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'export' && (
                    <div className="space-y-3.5">
                      <p className="text-slate-600 dark:text-slate-300 text-xs">
                        Take your finalized schedule anywhere with zero friction:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                            <Copy className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            <span>Clean Text & Markdown Agenda</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-1 leading-relaxed">
                            Formatted plain text or markdown schedule you can copy-paste straight into WhatsApp/Discord class groups, Notion, or personal notes.
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                            <Share2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span>Shareable Friend Link</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-1 leading-relaxed">
                            Generates a URL with your schedule encoded into it. Friends can open it to overlay your classes over theirs with zero login required.
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span>iCalendar (.ics)</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-1 leading-relaxed">
                            1-click import into Apple Calendar (iPhone/Mac), Microsoft Outlook, or Google Calendar with all repeat rules intact.
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>HD Image (PNG Snapshot)</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-1 leading-relaxed">
                            Download a clean, high-resolution rendering formatted for phone lockscreens, tablet wallpapers, or physical printing.
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 sm:col-span-2">
                          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                            <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <span>Full JSON Backup</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-1 leading-relaxed">
                            Export your complete planner state including all plans, color preferences, and course pool drawer to restore anytime.
                          </p>
                        </div>
                      </div>

                      {onOpenExport && (
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenExport();
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors up-chrome-btn active:scale-95"
                          >
                            Open Export dialog <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
              <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center sm:text-left">
                Uniplan · Free and open client-side planner
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs text-center up-chrome-btn active:scale-95"
              >
                Close Guide
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
