import { Check, Pin, Search } from 'lucide-react';
import type { CourseGroup } from '../../utils/planGenerator';
import { MAX_CANDIDATES } from '../../utils/planGenerator';
import { displayCourseColor } from '../../utils/courseColorDisplay';

export function CoursesStep({
  groups,
  query,
  picked,
  pinned,
  lockedKeys,
  onQuery,
  onToggle,
  onTogglePin,
  onSelectAll,
}: {
  groups: CourseGroup[];
  query: string;
  picked: Set<string>;
  pinned: Set<string>;
  lockedKeys: Set<string>;
  onQuery: (value: string) => void;
  onToggle: (key: string) => void;
  onTogglePin: (key: string) => void;
  onSelectAll: () => void;
}) {
  const atCap = picked.size >= MAX_CANDIDATES;
  return (
    <div className="up-gen-step-body">
      <div className="up-gen-search-row">
        <div className="up-pool-search-wrap flex-1 min-w-0">
          <Search className="w-3.5 h-3.5" />
          <input
            type="text"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search your pool"
            aria-label="Search your pool"
            className="up-pool-input up-gen-input"
          />
        </div>
        <button
          type="button"
          className="up-gen-outline up-chrome-btn"
          onClick={onSelectAll}
          disabled={groups.length === 0}
        >
          Select all
        </button>
      </div>
      <p className="up-gen-hint">
        Tick candidates (max {MAX_CANDIDATES}). Tap the pin to make one a must-take.
      </p>
      {atCap && <p className="up-gen-hint">{MAX_CANDIDATES} course maximum.</p>}

      <div className="up-gen-course-list">
        {groups.length === 0 ? (
          <p className="up-gen-empty">
            {query.trim()
              ? 'No courses match that search.'
              : 'Your course pool is empty. Add courses to your pool or import an Excel schedule first.'}
          </p>
        ) : (
          groups.map((group) => {
            const on = picked.has(group.key);
            const must = pinned.has(group.key);
            const locked = lockedKeys.has(group.key);
            const sectionLabel = `${group.sections.length} ${group.sections.length === 1 ? 'section' : 'sections'}`;
            return (
              <div key={group.key} className={`up-gen-course ${on ? 'is-on' : ''}`}>
                <span
                  className="up-gen-bar"
                  style={{ background: displayCourseColor(group.color).bg }}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className="up-gen-course-main up-chrome-btn"
                  aria-pressed={on}
                  onClick={() => onToggle(group.key)}
                >
                  <span className="up-gen-check" aria-hidden="true">
                    {on && <Check className="w-3 h-3" strokeWidth={2.75} />}
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="up-gen-course-title">
                      {group.code}
                      {group.name ? ` ${group.name}` : ''}
                    </span>
                    <span className="up-gen-course-meta">
                      {sectionLabel}
                      {must ? ' · must-take' : ''}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="up-gen-pin up-chrome-btn"
                  aria-pressed={must}
                  aria-disabled={locked && must}
                  aria-label={must ? `Unpin ${group.code}` : `Pin ${group.code} as a must-take`}
                  title={locked && must ? 'A locked section keeps this as a must-take' : must ? 'Unpin must-take' : 'Pin as a must-take'}
                  onClick={() => onTogglePin(group.key)}
                >
                  <Pin className="w-3.5 h-3.5" fill={must ? 'currentColor' : 'none'} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
