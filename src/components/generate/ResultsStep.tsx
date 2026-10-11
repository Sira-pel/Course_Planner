import { Pin } from 'lucide-react';
import type { GeneratedPlan, GeneratorResult } from '../../utils/planGenerator';
import { MiniWeekPreview } from './MiniWeekPreview';

export function ResultsStep({
  running,
  checked,
  result,
  lunch,
  previewId,
  savedNames,
  planNames,
  onTogglePreview,
  onSave,
}: {
  running: boolean;
  checked: number;
  result: GeneratorResult | null;
  lunch: { start: number; end: number } | null;
  previewId: string | null;
  savedNames: Record<string, string>;
  planNames: string[];
  onTogglePreview: (id: string) => void;
  onSave: (plan: GeneratedPlan) => void;
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

  return (
    <div className="up-gen-step-body">
      {result.capped && (
        <p className="up-gen-hint">Stopped after 5,000 mixes so this stays responsive.</p>
      )}
      <div className="up-gen-results">
        {result.plans.map((plan, index) => {
          const saved = savedNames[plan.id];
          const savedLive = saved != null && planNames.includes(saved);
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
                  onClick={() => onSave(plan)}
                >
                  Save as plan
                </button>
                <button
                  type="button"
                  className="up-gen-outline up-chrome-btn"
                  aria-expanded={open}
                  onClick={() => onTogglePreview(plan.id)}
                >
                  {open ? 'Hide preview' : 'Preview'}
                </button>
              </div>
              {savedLive && <p className="up-gen-saved">Saved as {saved}</p>}
            </article>
          );
        })}
      </div>
    </div>
  );
}
