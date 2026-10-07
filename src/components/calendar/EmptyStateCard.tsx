import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CalendarPlus, ChevronRight, ClipboardPaste, FileText, Sparkles, X } from 'lucide-react';
import { SAMPLE_PLANS } from '../../data/sampleSemester';
import { useScheduleStore } from '../../store/useScheduleStore';

interface EmptyStateCardProps {
  onClose: () => void;
  onQuickAdd: () => void;
  onImport: () => void;
  onLoadDemo: () => void;
}

const DEMO_COURSES = SAMPLE_PLANS.reduce((sum, plan) => sum + plan.courses.length, 0);
const DEMO_PLANS = SAMPLE_PLANS.length;

export function EmptyStateCard({ onClose, onQuickAdd, onImport, onLoadDemo }: EmptyStateCardProps) {
  const quickAddKeys = useScheduleStore((state) => state.customShortcuts.quick_add || 'Alt+K')
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const choose = (action: () => void) => {
    onClose();
    action();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="up-welcome-backdrop" onClick={onClose}>
      <div
        className="up-welcome"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          id="btn-welcome-close"
          className="up-welcome-close up-chrome-btn"
          aria-label="Close"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="up-welcome-mark-hero" aria-hidden>
          <CalendarPlus className="w-5 h-5" />
        </div>
        <h2 id="welcome-title">Plan your week</h2>
        <p className="up-welcome-lead">
          <span className="up-welcome-lead-phone">
            Add your classes to see your week, spot conflicts, and compare backup plans.
          </span>
          <span className="up-welcome-lead-desk">
            Add your classes to see them on a weekly calendar, spot time conflicts, and compare backup plans before registration.
          </span>
        </p>

        <div className="up-welcome-options">
          <button
            type="button"
            className="up-welcome-option up-welcome-option-quick up-chrome-btn"
            onClick={() => choose(onQuickAdd)}
          >
            <span className="up-welcome-mark up-welcome-mark-quick" aria-hidden>
              <ClipboardPaste className="w-4 h-4" />
            </span>
            <span className="up-welcome-option-copy">
              <span className="up-welcome-option-title">Paste from your portal</span>
              <span className="up-welcome-option-short">
                <span className="up-welcome-em">Quick add</span>
                {' · copy your class list'}
              </span>
              <span className="up-welcome-option-long">
                Copy your class list from the registration site and paste it. We’ll read the times.
              </span>
            </span>
            <span className="up-welcome-option-foot">
              <span className="up-welcome-em">Quick add</span>
              <span className="up-welcome-keys">
                {quickAddKeys.map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </span>
            </span>
            <ChevronRight className="up-welcome-chevron" aria-hidden />
          </button>

          <button
            type="button"
            className="up-welcome-option up-chrome-btn"
            onClick={() => choose(onImport)}
          >
            <span className="up-welcome-mark up-welcome-mark-file" aria-hidden>
              <FileText className="w-4 h-4" />
            </span>
            <span className="up-welcome-option-copy">
              <span className="up-welcome-option-title">Import a file</span>
              <span className="up-welcome-option-short">Excel, CSV or calendar (.ics)</span>
              <span className="up-welcome-option-long">
                Bring in a schedule you exported from Excel, a CSV, or a calendar file.
              </span>
            </span>
            <span className="up-welcome-option-foot">
              <span className="up-welcome-badges">
                <span>XLSX</span>
                <span>CSV</span>
                <span>.ics</span>
              </span>
            </span>
            <ChevronRight className="up-welcome-chevron" aria-hidden />
          </button>

          <button
            type="button"
            className="up-welcome-option up-chrome-btn"
            onClick={() => choose(onLoadDemo)}
          >
            <span className="up-welcome-mark up-welcome-mark-demo" aria-hidden>
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="up-welcome-option-copy">
              <span className="up-welcome-option-title">Try the demo semester</span>
              <span className="up-welcome-option-short">Sample courses and a second plan</span>
              <span className="up-welcome-option-long">
                Explore with sample courses, conflicts, and a second plan. Clear it anytime.
              </span>
            </span>
            <span className="up-welcome-option-foot">
              <span className="up-welcome-meta">{DEMO_COURSES} courses · {DEMO_PLANS} plans</span>
            </span>
            <ChevronRight className="up-welcome-chevron" aria-hidden />
          </button>
        </div>

        <p className="up-welcome-foot">
          <Sparkles className="w-3.5 h-3.5" aria-hidden />
          <span className="up-welcome-foot-phone">Or double-tap any slot to add a class</span>
          <span className="up-welcome-foot-desk">Or double-click any slot to add a class</span>
        </p>
      </div>
    </div>,
    document.body,
  );
}
