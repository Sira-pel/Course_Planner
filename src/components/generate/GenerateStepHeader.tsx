import { Check } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Courses' },
  { id: 2, label: 'Preferences' },
  { id: 3, label: 'Results' },
] as const;

export function GenerateStepHeader({
  step,
  canPreferences,
  canResults,
  onStep,
}: {
  step: 1 | 2 | 3;
  canPreferences: boolean;
  canResults: boolean;
  onStep: (step: 1 | 2 | 3) => void;
}) {
  return (
    <div className="up-gen-steps" role="tablist" aria-label="Generate plans steps">
      {STEPS.map((item, index) => {
        const done = step > item.id;
        const current = step === item.id;
        const enabled = item.id === 1
          || (item.id === 2 && canPreferences)
          || (item.id === 3 && canResults)
          || current;
        return (
          <div key={item.id} className="up-gen-step-wrap">
            {index > 0 && <span className="up-gen-step-line" aria-hidden="true" />}
            <button
              type="button"
              role="tab"
              id={`generate-step-${item.id}`}
              aria-selected={current}
              aria-current={current ? 'step' : undefined}
              disabled={!enabled}
              className={`up-gen-step up-chrome-btn ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}
              onClick={() => onStep(item.id)}
            >
              <span className="up-gen-dot" aria-hidden="true">
                {done ? <Check className="w-3 h-3" strokeWidth={2.5} /> : item.id}
              </span>
              <span>{item.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
