import React from 'react';
import type { Course } from '../../types/schedule';
import { displayCourseColor } from '../../utils/courseColorDisplay';
import { displayCourseTitle } from '../../utils/courseIdentity';
import { formatSessionLines } from '../../utils/poolGroups';
import { Plus, Trash2, Edit2, X } from 'lucide-react';

export interface PoolRowProps {
  item: Course;
  /** `single` is a whole course card; `section` is one line inside an expanded group. */
  variant: 'single' | 'section';
  inActivePlan: boolean;
  conflict: Course | null;
  confirmDelete: boolean;
  activePlanName: string | undefined;
  onEdit: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  onAddToPlan: (id: string) => void;
  onRemoveFromPlan: (id: string) => void;
}

export const PoolRow = React.memo(function PoolRow({
  item,
  variant,
  inActivePlan,
  conflict,
  confirmDelete,
  activePlanName,
  onEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onAddToPlan,
  onRemoveFromPlan,
}: PoolRowProps) {
  const visibleTitle = displayCourseTitle(item);
  const lines = formatSessionLines(item.sessions);
  const rooms = new Set(item.sessions.map((s) => s.room).filter((r): r is string => !!r && !/^tbd$/i.test(r)));
  const room = rooms.size === 1 ? [...rooms][0] : '';
  const sectionLabel = item.section ? `Sec ${item.section}` : 'Section';

  const times = (
    <div className="up-pool-times font-mono up-pool-meta">
      {lines.length === 0 ? <span>No meeting times</span> : lines.map((line) => <span key={line}>{line}</span>)}
    </div>
  );

  const actions = confirmDelete ? (
    <div className="up-pool-confirm">
      <button
        type="button"
        onClick={() => onConfirmDelete(item.id)}
        className="up-pool-text-btn up-chrome-btn text-rose-600 dark:text-rose-400"
      >
        Delete
      </button>
      <button
        type="button"
        onClick={onCancelDelete}
        className="up-icon-btn up-chrome-btn up-pool-icon-hit"
        aria-label="Cancel delete"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  ) : (
    <div className="up-pool-trail">
      {conflict && !inActivePlan && (
        <span className="up-pool-conflict-tag" title={`Overlaps with ${conflict.code}`}>
          Overlaps
        </span>
      )}
      <div className="up-pool-row-actions">
        <button
          type="button"
          onClick={() => onEdit(item.id)}
          title="Edit course"
          aria-label={`Edit ${item.code}${item.section ? ` section ${item.section}` : ''}`}
          className="up-icon-btn up-chrome-btn up-pool-icon-hit"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onRequestDelete(item.id)}
          title="Remove from pool"
          aria-label={`Remove ${item.code}${item.section ? ` section ${item.section}` : ''} from pool`}
          className="up-icon-btn up-chrome-btn up-pool-icon-hit"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {inActivePlan ? (
        <button
          type="button"
          onClick={() => onRemoveFromPlan(item.id)}
          className="up-pool-toggle is-remove up-chrome-btn"
          title={`Remove ${item.code} from ${activePlanName ?? 'plan'}`}
          aria-label={`Remove ${item.code}${item.section ? ` section ${item.section}` : ''} from plan`}
        >
          <X className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onAddToPlan(item.id)}
          className={`up-pool-toggle is-add up-chrome-btn${conflict ? ' is-conflict' : ''}`}
          title={conflict ? `Overlaps with ${conflict.code}. Add anyway` : `Add ${item.code} to ${activePlanName ?? 'plan'}`}
          aria-label={`Add ${item.code}${item.section ? ` section ${item.section}` : ''} to plan`}
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  if (variant === 'section') {
    return (
      <div className={`up-pool-section group${inActivePlan ? ' is-in-plan' : ''}${conflict && !inActivePlan ? ' is-conflict' : ''}`}>
        <div className="up-pool-body">
          <span className="up-pool-sec-no font-mono">{sectionLabel}</span>
          {times}
          {(item.instructor || room) && (
            <div className="up-pool-meta truncate">{[item.instructor, room].filter(Boolean).join(' · ')}</div>
          )}
        </div>
        {actions}
      </div>
    );
  }

  return (
    <div className={`up-pool-row group${inActivePlan ? ' is-in-plan' : ''}${conflict && !inActivePlan ? ' is-conflict' : ''}`}>
      <div className="up-pool-one">
        <span className="up-pool-swatch" style={{ backgroundColor: displayCourseColor(item.color).bg }} />
        <div className="up-pool-body" title={item.instructor || undefined}>
          <div className="up-pool-l1">
            <span className="up-pool-code truncate">{item.code}</span>
            {visibleTitle && <span className="up-pool-title-sm truncate">{visibleTitle}</span>}
          </div>
          <div className="up-pool-l2 font-mono up-pool-meta">
            {lines.length === 0 ? 'No meeting times' : lines.join(' · ')}
            {item.credits ? ` · ${item.credits} cr` : ''}
          </div>
        </div>
        {actions}
      </div>
    </div>
  );
});
