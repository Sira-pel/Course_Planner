import React, { useId } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import type { Course } from '../../types/schedule';
import { displayCourseColor } from '../../utils/courseColorDisplay';
import { displayCourseTitle } from '../../utils/courseIdentity';

export interface PoolGroupProps {
  courses: Course[];
  inPlanCount: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const PoolGroup = React.memo(function PoolGroup({
  courses,
  inPlanCount,
  expanded,
  onToggle,
  children,
}: PoolGroupProps) {
  const groupId = useId();
  const first = courses[0];
  // Each section keeps its own color, so show every distinct one (a few at most).
  const colors = [...new Set(courses.map((c) => displayCourseColor(c.color).bg))].slice(0, 3);
  const title = courses.map(displayCourseTitle).find(Boolean) ?? '';
  const credits = first.credits ? `${first.credits} cr · ` : '';
  return (
    <div className={`up-pool-row up-pool-group${inPlanCount > 0 ? ' is-in-plan' : ''}`}>
      <button
        type="button"
        className="up-pool-group-head up-chrome-btn"
        aria-expanded={expanded}
        aria-controls={expanded ? groupId : undefined}
        onClick={onToggle}
      >
        <ChevronRight className={`up-pool-chevron w-4 h-4${expanded ? ' is-open' : ''}`} aria-hidden="true" />
        <span className="up-pool-swatches" aria-hidden="true">
          {colors.map((bg) => (
            <span key={bg} className="up-pool-swatch" style={{ backgroundColor: bg }} />
          ))}
        </span>
        <span className="up-pool-body">
          <span className="up-pool-l1">
            <span className="up-pool-code truncate">{first.code}</span>
            {title && <span className="up-pool-title-sm truncate">{title}</span>}
          </span>
          <span className="up-pool-l2 font-mono up-pool-meta">
            {credits}
            {courses.length} sections
          </span>
        </span>
        {inPlanCount > 0 && (
          <span className="up-pool-group-count font-mono" title={`${inPlanCount} in plan`}>
            <Check className="w-3 h-3" aria-hidden="true" />
            {inPlanCount}
          </span>
        )}
      </button>
      {expanded && (
        <div id={groupId} className="up-pool-sections">
          {children}
        </div>
      )}
    </div>
  );
});
