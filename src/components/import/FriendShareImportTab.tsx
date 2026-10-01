import React, { useState, useMemo } from 'react';
import { SchedulePlan } from '../../types/schedule';
import { decodePlanFromSharePayload, extractSharePayloadFromUrl } from '../../utils/shareLink';
import { minutesToTime, timeToMinutes } from '../../utils/timeUtils';
import { Share2, Layers, Check, AlertCircle, ArrowRight } from 'lucide-react';

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
      {/* Informational Banner */}
      <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60">
        <div className="flex items-center gap-2 mb-1">
          <Share2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <h3 className="font-bold text-xs text-indigo-950 dark:text-indigo-200">
            Import Friend's Schedule Link
          </h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Paste the shareable link or code your friend sent you. You can compare it side-by-side as a ghost overlay against your own classes or save it into your plans.
        </p>
      </div>

      {/* Input area */}
      <div className="space-y-1.5 min-w-0">
        <label
          htmlFor="friend-share-link-input"
          className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
        >
          Paste Share Link or Code:
        </label>
        <textarea
          id="friend-share-link-input"
          value={pasteInput}
          onChange={(e) => handleParseInput(e.target.value)}
          placeholder="https://uniplan.app/#share=... or paste code directly"
          rows={3}
          className="w-full max-w-full min-w-0 text-base sm:text-xs font-mono p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none break-all whitespace-pre-wrap"
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
              className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
            >
              Plan Name in Your Workspace
            </label>
            <input
              id="friend-plan-name"
              type="text"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              className="mt-1 w-full min-w-0 text-base sm:text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
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
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {parsedPlan.courses.map((course) => (
              <div
                key={course.id}
                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-2 text-xs"
              >
                <div className="min-w-0 flex items-start gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                    style={{ backgroundColor: course.color }}
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
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                      {course.name}
                    </p>
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

          {/* Actions */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenAsActivePlan(currentPlanToUse)}
              className="w-full sm:w-auto px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors up-chrome-btn"
            >
              <Check className="w-3.5 h-3.5" />
              Open as Active Plan
            </button>
            <button
              type="button"
              onClick={() => onCompareWithSchedule(currentPlanToUse)}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 shadow-xs transition-colors up-chrome-btn"
            >
              <Layers className="w-3.5 h-3.5" />
              Compare with my Schedule
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
