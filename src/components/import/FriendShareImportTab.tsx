import React, { useState, useMemo } from 'react';
import { SchedulePlan } from '../../types/schedule';
import { displayCourseColor } from '../../utils/courseColorDisplay';
import { displayCourseTitle } from '../../utils/courseIdentity';
import { decodePlanFromSharePayload, extractSharePayloadFromUrl } from '../../utils/shareLink';
import { minutesToTime, timeToMinutes } from '../../utils/timeUtils';
import { Layers, Check, AlertCircle, ArrowRight } from 'lucide-react';

interface FriendShareImportTabProps {
  onCompareWithSchedule: (plan: SchedulePlan) => void;
  onOpenAsActivePlan: (plan: SchedulePlan) => void;
}

export const FriendShareImportTab: React.FC<FriendShareImportTabProps> = ({
  onCompareWithSchedule,
  onOpenAsActivePlan,
}) => {
  const [pasteInput, setPasteInput] = useState('');
  const [parsedPlan, setParsedPlan] = useState<SchedulePlan | null>(null);
  const [planName, setPlanName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const totalCredits = useMemo(
    () => parsedPlan?.courses.reduce((sum, c) => sum + (c.credits || 0), 0) || 0,
    [parsedPlan]
  );

  const currentPlanToUse: SchedulePlan | null = parsedPlan
    ? { ...parsedPlan, name: planName.trim() || parsedPlan.name }
    : null;

  return (
    <div className="space-y-4 min-w-0">
      {/* Input area */}
      <div className="space-y-1.5 min-w-0">
        <label
          htmlFor="friend-share-link-input"
          className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
        >
          Paste a share link or code
        </label>
        <textarea
          id="friend-share-link-input"
          value={pasteInput}
          onChange={(e) => handleParseInput(e.target.value)}
          placeholder="https://uniplan.app/#share=…"
          rows={3}
          className="w-full max-w-full min-w-0 text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder:text-[11px] sm:placeholder:text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 resize-none break-all whitespace-pre-wrap transition-shadow"
        />
        {errorMessage && (
          <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium mt-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Plan Preview when valid */}
      {parsedPlan && currentPlanToUse && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3.5 animate-in fade-in min-w-0">
          {/* Plan Name */}
          <div className="min-w-0">
            <label
              htmlFor="friend-plan-name"
              className="text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              Plan Name in Your Workspace
            </label>
            <input
              id="friend-plan-name"
              type="text"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              className="mt-1 w-full min-w-0 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 transition-shadow"
            />
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span className="font-bold text-indigo-600 dark:text-indigo-400">
              {parsedPlan.courses.length} courses
            </span>
            <span>·</span>
            <span>{totalCredits} total credits</span>
          </div>

          {/* Course Preview */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 up-scroll overscroll-contain">
            {parsedPlan.courses.map((course) => (
              <div
                key={course.id}
                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-2 text-xs"
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
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          ({course.section})
                        </span>
                      )}
                      {displayCourseTitle(course) && (
                        <span className="text-slate-600 dark:text-slate-300 truncate">
                          {displayCourseTitle(course)}
                        </span>
                      )}
                    </div>
                    {course.instructor && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {course.instructor}
                      </p>
                    )}
                  </div>
                </div>
                <span className="font-mono text-slate-400 font-semibold shrink-0">
                  {course.credits} cr
                </span>
              </div>
            ))}
          </div>

          {/* Choices */}
          <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onCompareWithSchedule(currentPlanToUse)}
              className="text-left rounded-xl border border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800/60 p-3 transition-colors"
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
                <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Overlay on my schedule
              </span>
              <span className="block text-xs text-slate-600 dark:text-slate-300 mt-1">
                Shows their classes faded over yours. Nothing is saved.
              </span>
            </button>
            <button
              type="button"
              onClick={() => onOpenAsActivePlan(currentPlanToUse)}
              className="text-left rounded-xl border border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-950 p-3 transition-colors"
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900 dark:text-indigo-100">
                <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Save as new plan
              </span>
              <span className="block text-xs text-slate-600 dark:text-slate-300 mt-1">
                Adds &ldquo;{currentPlanToUse.name}&rdquo; and opens it. Your other plans stay as they are.
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
