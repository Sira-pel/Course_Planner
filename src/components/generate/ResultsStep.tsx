import { Pin, X } from 'lucide-react';
import type { Course } from '../../types/schedule';
import { sectionSetKey } from '../../utils/courseIdentity';
import type { GeneratedPlan, GeneratorResult } from '../../utils/planGenerator';
import { MiniWeekPreview } from './MiniWeekPreview';

export function ResultsStep({
  running,
  checked,
  result,
  lunch,
  previewId,
  plans,
  onTogglePreview,
  onSave,
  onOpen,
  noticeDismissed,
  onDismissNotice,
}: {
  running: boolean;
  checked: number;
  result: GeneratorResult | null;
  lunch: { start: number; end: number } | null;
  previewId: string | null;
  plans: { id: string; name: string; courses: Course[] }[];
  onTogglePreview: (id: string) => void;
  onSave: (plan: GeneratedPlan) => void;
  onOpen: (planId: string) => void;
  noticeDismissed: boolean;
  onDismissNotice: () => void;
}) {
  if (running || !result) {
    return (
      <div className="up-gen-step-body">
        <p className="up-gen-status" role="status" aria-live="polite">
          Checking course and section mixes…
        </p>
        <p className="up-gen-hint">{checked.toLocaleString()} checked</p>
      </div>
    );
  }

  if (result.plans.length === 0) {
    return (
      <div className="up-gen-step-body">
        <div className="up-gen-reason" role="status">
          <h3>Nothing fits</h3>
          <p>{result.emptyReason || 'No clash-free mix fits these courses and filters.'}</p>
        </div>
      </div>
    );
  }

  const notices = result.dayOffNotices;
  const savedByKey = new Map<string, { id: string; name: string }>();
  for (const plan of plans) {
    savedByKey.set(sectionSetKey(plan.courses), { id: plan.id, name: plan.name });
  }

  return (
    <div className="up-gen-step-body">
      {notices.length > 0 && !noticeDismissed && (
        <div className="up-gen-notice" role="status">
          <div className="up-gen-notice-copy">
            {notices.map((notice) => (
              <p key={notice}>{notice}</p>
            ))}
          </div>
          <button
            type="button"
            className="up-icon-btn up-chrome-btn up-pool-icon-hit"
            aria-label="Dismiss day off notice"
            onClick={onDismissNotice}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {result.capped && (
        <p className="up-gen-hint">Stopped after 5,000 mixes so this stays responsive.</p>
      )}
      <div className="up-gen-results">
        {result.plans.map((plan, index) => {
          const savedPlan = savedByKey.get(sectionSetKey(plan.courses));
          const open = previewId === plan.id;
          return (
            <article key={plan.id} className="up-gen-card">
              <header className="up-gen-card-head">
                <h3>Option {index + 1}</h3>
                {index === 0 && <span className="up-gen-best">Best fit</span>}
              </header>
              <MiniWeekPreview courses={plan.courses} lunch={lunch} tall={open} />
              <p className="up-gen-mix">
                {plan.pinnedCodes.length > 0 && (
                  <>
                    <Pin className="up-gen-mix-pin" aria-hidden="true" />
                    <span>{plan.pinnedCodes.join(', ')}</span>
                  </>
                )}
                {plan.includedCodes.length > 0 && (
                  <span>
                    {plan.pinnedCodes.length > 0 ? ' · ' : ''}
                    {plan.includedCodes.join(', ')}
                  </span>
                )}
              </p>
              {plan.skippedCodes.length > 0 && (
                <p className="up-gen-skipped">{plan.skippedCodes.join(', ')}</p>
              )}
              {plan.tags.length > 0 && (
                <ul className="up-gen-tags">
                  {plan.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              )}
              {open && (
                <ul className="up-gen-preview-list">
                  {plan.courses.flatMap((course) => (course.sessions || []).map((session) => (
                    <li key={session.id}>
                      <span>{session.day.slice(0, 3)}</span>
                      <span>{session.startTime}–{session.endTime}</span>
                      <span>{course.code}{course.section ? `-${course.section}` : ''}</span>
                    </li>
                  )))}
                </ul>
              )}
              <div className="up-gen-card-actions">
                <button
                  type="button"
                  className="up-gen-primary up-chrome-btn"
                  disabled={savedPlan != null}
                  onClick={() => onSave(plan)}
                >
                  {savedPlan ? 'Saved ✓' : 'Save as plan'}
                </button>
                {savedPlan && (
                  <button
                    type="button"
                    className="up-gen-open up-chrome-btn"
                    onClick={() => onOpen(savedPlan.id)}
                  >
                    Open
                  </button>
                )}
                <button
                  type="button"
                  className="up-gen-outline up-chrome-btn"
                  aria-expanded={open}
                  onClick={() => onTogglePreview(plan.id)}
                >
                  {open ? 'Hide preview' : 'Preview'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
