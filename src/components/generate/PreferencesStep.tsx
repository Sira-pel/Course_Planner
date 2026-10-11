import { ChevronDown, Plus, X } from 'lucide-react';
import type { DayOfWeek } from '../../types/schedule';
import { DAYS_LIST } from '../../types/schedule';
import { AnimatedBody } from '../app/AnimatedBody';
import { ModalTabPill } from '../app/ModalTabPill';
import type { GapLimit, StoredGeneratorPrefs } from '../../utils/generatorPrefs';
import type { CourseGroup } from '../../utils/planGenerator';

export interface BlockedDraft {
  id: string;
  day: DayOfWeek;
  start: string;
  end: string;
}

const GAP_OPTIONS: { id: GapLimit; label: string }[] = [
  { id: 30, label: '30m' },
  { id: 60, label: '1h' },
  { id: 120, label: '2h' },
];

function gapPhrase(limit: GapLimit): string {
  if (limit === 30) return '30m';
  if (limit === 60) return '1h';
  return '2h';
}

function Stepper({
  value,
  min,
  max,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="up-gen-stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="up-gen-stepper-btn up-chrome-btn"
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <span className="up-gen-stepper-value">{value}</span>
      <button
        type="button"
        className="up-gen-stepper-btn up-chrome-btn"
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

function GenSwitch({
  on,
  label,
  onToggle,
}: {
  on: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="up-gen-switch-hit up-chrome-btn"
      aria-pressed={on}
      aria-label={label}
      onClick={onToggle}
    >
      <span className={`up-settings-switch ${on ? 'is-on' : ''}`} aria-hidden="true">
        <span className="up-settings-switch-knob" />
      </span>
    </button>
  );
}

function sectionLabel(group: CourseGroup, sectionId: string): string {
  const section = group.sections.find((item) => item.id === sectionId);
  if (!section) return group.code;
  const sec = section.section ? ` · ${section.section}` : '';
  return `${group.code}${sec}`;
}

export function PreferencesStep({
  prefs,
  pickedCount,
  pinnedCount,
  courseCount,
  courseMin,
  courseMax,
  creditTarget,
  creditMinBound,
  creditMaxBound,
  creditWindowLabel,
  groups,
  blocked,
  lockedIds,
  excludedIds,
  moreOpen,
  onPrefs,
  onCourseCount,
  onCreditTarget,
  onMore,
  onAddBlocked,
  onChangeBlocked,
  onRemoveBlocked,
  onLock,
  onUnlock,
  onExclude,
  onUnexclude,
}: {
  prefs: StoredGeneratorPrefs;
  pickedCount: number;
  pinnedCount: number;
  courseCount: number;
  courseMin: number;
  courseMax: number;
  creditTarget: number;
  creditMinBound: number;
  creditMaxBound: number;
  creditWindowLabel: string;
  groups: CourseGroup[];
  blocked: BlockedDraft[];
  lockedIds: string[];
  excludedIds: string[];
  moreOpen: boolean;
  onPrefs: (patch: Partial<StoredGeneratorPrefs>) => void;
  onCourseCount: (value: number) => void;
  onCreditTarget: (value: number) => void;
  onMore: (open: boolean) => void;
  onAddBlocked: () => void;
  onChangeBlocked: (id: string, patch: Partial<BlockedDraft>) => void;
  onRemoveBlocked: (id: string) => void;
  onLock: (id: string) => void;
  onUnlock: (id: string) => void;
  onExclude: (id: string) => void;
  onUnexclude: (id: string) => void;
}) {
  const extra = Math.max(0, courseCount - pinnedCount);
  const other = Math.max(0, pickedCount - pinnedCount);
  const perPlanHint = prefs.mode === 'credits'
    ? creditWindowLabel
    : pinnedCount === 0
      ? `${courseCount} courses from your ${pickedCount} picks`
      : extra === 0
        ? `${pinnedCount} pinned ${pinnedCount === 1 ? 'course' : 'courses'}`
        : `${pinnedCount} pinned + ${extra} from your other ${other} picks`;

  const sections = groups.flatMap((group) => group.sections.map((section) => ({
    id: section.id,
    label: sectionLabel(group, section.id),
  })));
  const lockChoices = sections.filter((section) => !lockedIds.includes(section.id) && !excludedIds.includes(section.id));
  const excludeChoices = sections.filter((section) => !excludedIds.includes(section.id) && !lockedIds.includes(section.id));

  return (
    <div className="up-gen-step-body">
      <section className="up-gen-pref">
        <div className="up-gen-pref-copy">
          <h3>Per plan</h3>
          <p>{perPlanHint}</p>
        </div>
        <div className="up-gen-pref-controls">
          <div className="up-segment up-segment-2 up-gen-segment" role="tablist" aria-label="Plan size">
            {(['courses', 'credits'] as const).map((mode) => {
              const on = prefs.mode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className="up-segment-btn up-chrome-btn"
                  onClick={() => onPrefs({ mode })}
                >
                  {on && <ModalTabPill layoutId="generate-per-plan" />}
                  <span className="relative z-10">{mode === 'courses' ? 'Courses' : 'Credits'}</span>
                </button>
              );
            })}
          </div>
          {prefs.mode === 'courses' ? (
            <Stepper
              value={courseCount}
              min={courseMin}
              max={courseMax}
              label="Courses per plan"
              onChange={onCourseCount}
            />
          ) : (
            <Stepper
              value={creditTarget}
              min={Math.max(1, creditMinBound)}
              max={Math.max(creditMinBound, creditMaxBound)}
              label="Credit target"
              onChange={onCreditTarget}
            />
          )}
        </div>
      </section>

      <section className="up-gen-pref">
        <div className="up-gen-pref-copy">
          <h3>Keep gaps short</h3>
          <p>{prefs.gapsEnabled ? `Prefer ≤ ${gapPhrase(prefs.gapLimit)} between classes` : 'Gaps will not change the ranking'}</p>
        </div>
        <div className="up-gen-pref-controls">
          <div className="up-segment up-gen-segment" role="tablist" aria-label="Gap limit">
            {GAP_OPTIONS.map((option) => {
              const on = prefs.gapLimit === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className="up-segment-btn up-chrome-btn"
                  onClick={() => onPrefs({ gapLimit: option.id })}
                >
                  {on && <ModalTabPill layoutId="generate-gap" />}
                  <span className="relative z-10">{option.label}</span>
                </button>
              );
            })}
          </div>
          <GenSwitch
            on={prefs.gapsEnabled}
            label="Keep gaps short"
            onToggle={() => onPrefs({ gapsEnabled: !prefs.gapsEnabled })}
          />
        </div>
      </section>

      <section className="up-gen-pref">
        <div className="up-gen-pref-copy">
          <h3>Lunch break</h3>
          <p>Keep 45 min free in this window</p>
        </div>
        <div className="up-gen-pref-controls">
          <div className="up-gen-time-pair">
            <input
              type="time"
              aria-label="Lunch window start"
              value={prefs.lunchStart}
              onChange={(event) => onPrefs({ lunchStart: event.target.value })}
              className="up-gen-time"
            />
            <span aria-hidden="true">–</span>
            <input
              type="time"
              aria-label="Lunch window end"
              value={prefs.lunchEnd}
              onChange={(event) => onPrefs({ lunchEnd: event.target.value })}
              className="up-gen-time"
            />
          </div>
          <GenSwitch
            on={prefs.lunchEnabled}
            label="Lunch break"
            onToggle={() => onPrefs({ lunchEnabled: !prefs.lunchEnabled })}
          />
        </div>
      </section>

      <div className="up-gen-more">
        <button
          type="button"
          className="up-gen-more-btn up-chrome-btn"
          aria-expanded={moreOpen}
          onClick={() => onMore(!moreOpen)}
        >
          <span>More options</span>
          <ChevronDown className={`up-chevron w-3.5 h-3.5 ${moreOpen ? 'is-open' : ''}`} />
        </button>
        {!moreOpen && (
          <p className="up-gen-hint">Day off · start/end · blocked times · lock/exclude</p>
        )}
        <AnimatedBody activeKey={moreOpen ? 'open' : 'closed'} contentClassName="up-gen-more-body">
          {moreOpen && (
            <div className="up-gen-more-stack">
              <div>
                <h3>Day off</h3>
                <p className="up-gen-hint">Prefer no class on these days.</p>
                <div className="up-gen-chips">
                  {DAYS_LIST.map((day) => {
                    const on = prefs.daysOff.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        aria-pressed={on}
                        className={`up-gen-chip up-chrome-btn ${on ? 'is-on' : ''}`}
                        onClick={() => {
                          const daysOff = on
                            ? prefs.daysOff.filter((item) => item !== day.id)
                            : [...prefs.daysOff, day.id];
                          onPrefs({ daysOff });
                        }}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3>Classes between</h3>
                <p className="up-gen-hint">Meetings outside this window rank lower.</p>
                <div className="up-gen-time-pair">
                  <input
                    type="time"
                    aria-label="Earliest class"
                    value={prefs.classStart ?? ''}
                    onChange={(event) => onPrefs({ classStart: event.target.value || null })}
                    className="up-gen-time"
                  />
                  <span aria-hidden="true">–</span>
                  <input
                    type="time"
                    aria-label="Latest class"
                    value={prefs.classEnd ?? ''}
                    onChange={(event) => onPrefs({ classEnd: event.target.value || null })}
                    className="up-gen-time"
                  />
                </div>
              </div>

              <div>
                <div className="up-gen-inline-head">
                  <h3>Blocked times</h3>
                  <button type="button" className="up-gen-outline up-chrome-btn" onClick={onAddBlocked}>
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
                <p className="up-gen-hint">Sections that overlap these times are left out.</p>
                <div className="up-gen-block-list">
                  {blocked.map((block) => (
                    <div key={block.id} className="up-gen-block-row">
                      <select
                        aria-label="Blocked day"
                        value={block.day}
                        onChange={(event) => onChangeBlocked(block.id, { day: event.target.value as DayOfWeek })}
                        className="up-gen-select"
                      >
                        {DAYS_LIST.map((day) => (
                          <option key={day.id} value={day.id}>{day.label}</option>
                        ))}
                      </select>
                      <input
                        type="time"
                        aria-label="Blocked start"
                        value={block.start}
                        onChange={(event) => onChangeBlocked(block.id, { start: event.target.value })}
                        className="up-gen-time"
                      />
                      <input
                        type="time"
                        aria-label="Blocked end"
                        value={block.end}
                        onChange={(event) => onChangeBlocked(block.id, { end: event.target.value })}
                        className="up-gen-time"
                      />
                      <button
                        type="button"
                        className="up-icon-btn up-chrome-btn up-pool-icon-hit"
                        aria-label="Remove blocked time"
                        onClick={() => onRemoveBlocked(block.id)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3>Lock a section</h3>
                <p className="up-gen-hint">Only this section of the course can be used.</p>
                <select
                  aria-label="Lock a section"
                  className="up-gen-select"
                  value=""
                  onChange={(event) => {
                    if (event.target.value) onLock(event.target.value);
                  }}
                >
                  <option value="">Choose a section</option>
                  {lockChoices.map((section) => (
                    <option key={section.id} value={section.id}>{section.label}</option>
                  ))}
                </select>
                <div className="up-gen-chips">
                  {lockedIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className="up-gen-chip is-on up-chrome-btn"
                      onClick={() => onUnlock(id)}
                    >
                      {sections.find((section) => section.id === id)?.label ?? 'Section'}
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3>Exclude a section</h3>
                <p className="up-gen-hint">This section is left out of every plan.</p>
                <select
                  aria-label="Exclude a section"
                  className="up-gen-select"
                  value=""
                  onChange={(event) => {
                    if (event.target.value) onExclude(event.target.value);
                  }}
                >
                  <option value="">Choose a section</option>
                  {excludeChoices.map((section) => (
                    <option key={section.id} value={section.id}>{section.label}</option>
                  ))}
                </select>
                <div className="up-gen-chips">
                  {excludedIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className="up-gen-chip is-on up-chrome-btn"
                      onClick={() => onUnexclude(id)}
                    >
                      {sections.find((section) => section.id === id)?.label ?? 'Section'}
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </AnimatedBody>
      </div>
    </div>
  );
}
