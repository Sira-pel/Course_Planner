import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { SchedulePlan } from '../types/schedule';
import { displayCourseColor } from '../utils/courseColorDisplay';
import { displayCourseTitle } from '../utils/courseIdentity';
import { decodePlanFromSharePayload, extractSharePayloadFromUrl } from '../utils/shareLink';
import { minutesToTime, timeToMinutes } from '../utils/timeUtils';
import { Layers, Check, X, Share2, AlertCircle, ArrowRight } from 'lucide-react';
import { useModalMotion } from '../utils/motion';

interface ShareImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sharedPlan: SchedulePlan | null;
  onCompareWithSchedule: (plan: SchedulePlan) => void;
  onOpenAsActivePlan: (plan: SchedulePlan) => void;
  initialManualPaste?: boolean;
}

export const ShareImportModal: React.FC<ShareImportModalProps> = ({
  isOpen,
  onClose,
  sharedPlan,
  onCompareWithSchedule,
  onOpenAsActivePlan,
  initialManualPaste = false,
}) => {
  const [pasteInput, setPasteInput] = useState('');
  const [parsedPlan, setParsedPlan] = useState<SchedulePlan | null>(sharedPlan);
  const [planName, setPlanName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (sharedPlan) {
      setParsedPlan(sharedPlan);
      setPlanName(sharedPlan.name);
      setErrorMessage(null);
    } else {
      setParsedPlan(null);
      setPlanName('');
      setPasteInput('');
      setErrorMessage(null);
    }
  }, [sharedPlan, isOpen]);

  const handleParseInput = (raw: string) => {
    setPasteInput(raw);
    setErrorMessage(null);
    if (!raw.trim()) {
      setParsedPlan(null);
      return;
    }

    const payload = extractSharePayloadFromUrl(raw);
    if (!payload) {
      setErrorMessage('Could not find a valid Uniplan share link in your input.');
      setParsedPlan(null);
      return;
    }

    const res = decodePlanFromSharePayload(payload);
    if (res.success && res.plan) {
      setParsedPlan(res.plan);
      setPlanName(res.plan.name);
    } else {
      setErrorMessage(res.error || 'Failed to decode shared plan.');
      setParsedPlan(null);
    }
  };

  const { backdropProps, panelProps } = useModalMotion(isOpen);

  const totalCredits = useMemo(
    () => parsedPlan?.courses.reduce((sum, c) => sum + (c.credits || 0), 0) || 0,
    [parsedPlan]
  );

  const currentPlanToUse: SchedulePlan | null = parsedPlan
    ? { ...parsedPlan, name: planName.trim() || parsedPlan.name }
    : null;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] course-modal-backdrop flex items-start sm:items-center justify-center p-2.5 sm:p-4 bg-black/60 md:backdrop-blur-xs overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          {...backdropProps}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-import-modal-title"
            {...panelProps}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full min-w-0 p-4 sm:p-6 my-auto max-h-[calc(100dvh-1.25rem)] sm:max-h-[90vh] flex flex-col overflow-hidden will-change-transform"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Share2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="share-import-modal-title"
                    className="text-base font-bold text-slate-900 dark:text-white truncate"
                  >
                    {parsedPlan ? "Friend's Schedule" : 'Import Shared Schedule'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    Compare or add a friend's plan in your browser
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 up-chrome-btn"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-4 min-h-0 text-xs up-scroll overscroll-contain">
              {(!sharedPlan || initialManualPaste) && !parsedPlan && (
                <div className="space-y-2 min-w-0">
                  <label htmlFor="share-link-input" className="font-semibold text-slate-700 dark:text-slate-300">
                    Paste your friend's share link or code:
                  </label>
                  <textarea
                    id="share-link-input"
                    value={pasteInput}
                    onChange={(e) => handleParseInput(e.target.value)}
                    placeholder="https://...#share=... or paste code directly"
                    rows={3}
                    className="w-full max-w-full min-w-0 text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-[11px] sm:placeholder:text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none break-all whitespace-pre-wrap"
                  />
                  {errorMessage && (
                    <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                </div>
              )}

              {parsedPlan && (
                <div className="space-y-3.5 min-w-0">
                  {/* Plan Name Editable Input */}
                  <div className="min-w-0">
                    <label htmlFor="friend-plan-name" className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Plan Name
                    </label>
                    <input
                      id="friend-plan-name"
                      type="text"
                      value={planName}
                      onChange={(e) => setPlanName(e.target.value)}
                      className="mt-1 w-full min-w-0 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Summary Stats */}
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60">
                    <span className="font-mono font-semibold text-indigo-700 dark:text-indigo-300 text-xs">
                      {parsedPlan.courses.length} {parsedPlan.courses.length === 1 ? 'course' : 'courses'}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="font-mono text-slate-600 dark:text-slate-300 text-xs">
                      {totalCredits} credit hours
                    </span>
                  </div>

                  {/* Courses Preview List */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Enrolled Classes ({parsedPlan.courses.length})
                    </span>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {parsedPlan.courses.map((course) => (
                        <div
                          key={course.id}
                          className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-start justify-between gap-2"
                        >
                          <div className="min-w-0 flex items-start gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                              style={{ backgroundColor: displayCourseColor(course.color).bg }}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                                  {course.code}
                                </span>
                                {course.section && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                    Sec {course.section}
                                  </span>
                                )}
                              </div>
                              {displayCourseTitle(course) && (
                                <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                                  {displayCourseTitle(course)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono text-right shrink-0">
                            {course.sessions.map((s, idx) => (
                              <div key={idx}>
                                <span className="capitalize">{s.day.slice(0, 3)}</span>{' '}
                                {minutesToTime(timeToMinutes(s.startTime))} - {minutesToTime(timeToMinutes(s.endTime))}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-center up-chrome-btn active:scale-95"
              >
                Cancel
              </button>

              {currentPlanToUse && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAsActivePlan(currentPlanToUse);
                      onClose();
                    }}
                    className="w-full sm:w-auto px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 up-chrome-btn active:scale-95"
                    title="Add to plans and make it your active plan"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Open as Active Plan
                  </button>
                  <button
                    type="button"
                    id="btn-compare-friend-schedule"
                    onClick={() => {
                      onCompareWithSchedule(currentPlanToUse);
                      onClose();
                    }}
                    className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 shadow-xs up-chrome-btn active:scale-95"
                    title="Overlay alongside your active schedule to compare times"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Compare with my Schedule
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
