import React, { type FormEvent, type Ref, type RefObject } from 'react';
import { Check, ChevronDown, Clock, Plus, Trash2 } from 'lucide-react';
import { COURSE_COLORS, DAYS_LIST, DayOfWeek } from '../../types/schedule';
import { timeToMinutes } from '../../utils/timeUtils';
import {
  DURATION_CHIPS,
  MWF,
  TTH,
  type MeetingPattern,
  daysEqual,
  endAfterStart,
  formatDaysShort,
} from './meetingPatterns';

const inputClass =
  'course-input w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-0';

const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';

export interface CourseFormProps {
  incomingRef: Ref<HTMLDivElement>;
  code: string;
  name: string;
  section: string;
  instructor: string;
  credits: number;
  color: string;
  patterns: MeetingPattern[];
  detailsOpen: boolean;
  detailsSummary: string;
  shakeField: 'code' | 'name' | 'times' | null;
  isCustomColor: boolean;
  codeInputRef: RefObject<HTMLInputElement | null>;
  nameInputRef: RefObject<HTMLInputElement | null>;
  startTimeInputRef: RefObject<HTMLInputElement | null>;
  onCodeChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onSectionChange: (v: string) => void;
  onInstructorChange: (v: string) => void;
  onCreditsChange: (v: number) => void;
  onColorChange: (v: string) => void;
  onToggleDetails: () => void;
  onSubmit: (e?: FormEvent) => void;
  onAddPattern: () => void;
  onRemovePattern: (index: number) => void;
  onUpdatePattern: (index: number, patch: Partial<MeetingPattern>) => void;
  onTogglePatternDay: (index: number, day: DayOfWeek) => void;
  onApplyDayPreset: (index: number, preset: DayOfWeek[]) => void;
  onSetPatternDuration: (index: number, minutes: number) => void;
}

export const CourseForm: React.FC<CourseFormProps> = ({
  incomingRef,
  code,
  name,
  section,
  instructor,
  credits,
  color,
  patterns,
  detailsOpen,
  detailsSummary,
  shakeField,
  isCustomColor,
  codeInputRef,
  nameInputRef,
  startTimeInputRef,
  onCodeChange,
  onNameChange,
  onSectionChange,
  onInstructorChange,
  onCreditsChange,
  onColorChange,
  onToggleDetails,
  onSubmit,
  onAddPattern,
  onRemovePattern,
  onUpdatePattern,
  onTogglePatternDay,
  onApplyDayPreset,
  onSetPatternDuration,
}) => {
  return (
    <div ref={incomingRef}>
      <form id="course-build-form" onSubmit={onSubmit} className="space-y-4 pr-0.5">
        <div className="grid grid-cols-12 gap-2.5">
          <div className="col-span-4 min-w-0">
            <label htmlFor="course-code" className={labelClass}>
              Code
            </label>
            <input
              id="course-code"
              ref={codeInputRef}
              type="text"
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  nameInputRef.current?.focus();
                }
              }}
              placeholder="e.g. CS 101"
              required
              autoComplete="off"
              className={`${inputClass} font-mono font-semibold course-field ${
                shakeField === 'code' ? 'is-error is-shaking' : ''
              }`}
            />
          </div>
          <div className="col-span-8 min-w-0">
            <label htmlFor="course-title" className={labelClass}>
              Title
            </label>
            <input
              id="course-title"
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  startTimeInputRef.current?.focus();
                }
              }}
              placeholder="Intro to CS"
              required
              className={`${inputClass} course-field ${shakeField === 'name' ? 'is-error is-shaking' : ''}`}
            />
          </div>
        </div>

        <div className={shakeField === 'times' ? 'course-field is-shaking rounded-lg' : ''}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              When
            </span>
            <button
              type="button"
              onClick={onAddPattern}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 inline-flex items-center gap-0.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Different time
            </button>
          </div>

          <div className="space-y-2.5">
            {patterns.map((pattern, index) => {
              const duration = timeToMinutes(pattern.endTime) - timeToMinutes(pattern.startTime);
              return (
                <div
                  key={pattern.id}
                  className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-3 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onApplyDayPreset(index, MWF)}
                        className={`px-2 py-1 text-[11px] font-mono font-semibold rounded-md transition-colors duration-[var(--dur-chrome)] ${
                          daysEqual(pattern.days, MWF)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                        }`}
                      >
                        MWF
                      </button>
                      <button
                        type="button"
                        onClick={() => onApplyDayPreset(index, TTH)}
                        className={`px-2 py-1 text-[11px] font-mono font-semibold rounded-md transition-colors duration-[var(--dur-chrome)] ${
                          daysEqual(pattern.days, TTH)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                        }`}
                      >
                        TTh
                      </button>
                    </div>
                    {patterns.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemovePattern(index)}
                        className="p-1 text-slate-400 hover:text-rose-500"
                        aria-label="Remove this meeting time"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex gap-1" role="group" aria-label="Meeting days">
                    {DAYS_LIST.map((d) => {
                      const on = pattern.days.includes(d.id);
                      const weekend = d.id === 'saturday' || d.id === 'sunday';
                      return (
                        <button
                          key={d.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => onTogglePatternDay(index, d.id)}
                          className={`course-day flex-1 rounded-md text-[11px] font-semibold ${
                            on
                              ? 'bg-indigo-600 text-white'
                              : `bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 ${
                                  weekend ? 'opacity-70' : ''
                                }`
                          }`}
                        >
                          {d.short === 'TH' ? 'Th' : d.short === 'SA' ? 'Sa' : d.short === 'SU' ? 'Su' : d.short}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-4 min-w-0">
                      <label className="sr-only" htmlFor={index === 0 ? 'course-start' : `meeting-start-${pattern.id}`}>
                        Start time
                      </label>
                      <input
                        id={index === 0 ? 'course-start' : `meeting-start-${pattern.id}`}
                        ref={index === 0 ? startTimeInputRef : undefined}
                        type="time"
                        required
                        value={pattern.startTime}
                        onChange={(e) => {
                          const startTime = e.target.value;
                          const endM = timeToMinutes(pattern.endTime);
                          const startM = timeToMinutes(startTime);
                          onUpdatePattern(index, {
                            startTime,
                            endTime: endM <= startM ? endAfterStart(startTime, 75) : pattern.endTime,
                          });
                        }}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    <div className="col-span-4 min-w-0">
                      <label className="sr-only" htmlFor={`meeting-end-${pattern.id}`}>
                        End time
                      </label>
                      <input
                        id={`meeting-end-${pattern.id}`}
                        type="time"
                        required
                        value={pattern.endTime}
                        onChange={(e) => onUpdatePattern(index, { endTime: e.target.value })}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    <div className="col-span-4 min-w-0">
                      <label className="sr-only" htmlFor={`meeting-room-${pattern.id}`}>
                        Room
                      </label>
                      <input
                        id={`meeting-room-${pattern.id}`}
                        type="text"
                        value={pattern.room}
                        onChange={(e) => onUpdatePattern(index, { room: e.target.value })}
                        placeholder="Room"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      {formatDaysShort(pattern.days)} {pattern.startTime}-{pattern.endTime}
                      {pattern.room.trim() ? ` · ${pattern.room.trim()}` : ''}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      {DURATION_CHIPS.map((chip) => (
                        <button
                          key={chip.label}
                          type="button"
                          onClick={() => onSetPatternDuration(index, chip.minutes)}
                          className={`px-2 py-0.5 text-[11px] font-mono rounded-md transition-colors duration-[var(--dur-chrome)] ${
                            duration === chip.minutes
                              ? 'bg-indigo-600 text-white font-semibold'
                              : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300'
                          }`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <button
            type="button"
            className="course-acc-trigger w-full flex items-center justify-between gap-2 py-1 text-left"
            aria-expanded={detailsOpen}
            onClick={onToggleDetails}
          >
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Details</span>
            <span className="flex items-center gap-2 min-w-0">
              {!detailsOpen && detailsSummary && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{detailsSummary}</span>
              )}
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <ChevronDown className="course-acc-chevron w-4 h-4 text-slate-400" />
            </span>
          </button>
          <div className={`course-acc ${detailsOpen ? 'is-open' : ''}`} inert={!detailsOpen}>
            <div className="course-acc-inner">
              <div className="course-acc-body pt-2 pb-2 space-y-3">
                <div className="grid grid-cols-12 gap-2.5">
                  <div className="col-span-3 min-w-0">
                    <label htmlFor="course-credits" className={labelClass}>
                      Credits
                    </label>
                    <input
                      id="course-credits"
                      type="number"
                      min="0"
                      max="20"
                      step="0.5"
                      value={credits}
                      onChange={(e) => onCreditsChange(parseFloat(e.target.value) || 0)}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div className="col-span-4 min-w-0">
                    <label htmlFor="course-section" className={labelClass}>
                      Section
                    </label>
                    <input
                      id="course-section"
                      type="text"
                      value={section}
                      onChange={(e) => onSectionChange(e.target.value)}
                      placeholder="01"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div className="col-span-5 min-w-0">
                    <label htmlFor="course-instructor" className={labelClass}>
                      Instructor
                    </label>
                    <input
                      id="course-instructor"
                      type="text"
                      value={instructor}
                      onChange={(e) => onInstructorChange(e.target.value)}
                      placeholder="Name"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <span className={labelClass}>Color</span>
                  <div className="flex items-center gap-2 flex-wrap px-2 py-2">
                    {COURSE_COLORS.map((swatch) => {
                      const selected = color.toLowerCase() === swatch.toLowerCase();
                      return (
                        <button
                          key={swatch}
                          type="button"
                          aria-label={`Use color ${swatch}`}
                          aria-pressed={selected}
                          onClick={() => onColorChange(swatch)}
                          className={`course-swatch w-6 h-6 rounded-full flex items-center justify-center ${
                            selected ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900' : ''
                          }`}
                          style={{ backgroundColor: swatch }}
                        >
                          {selected && <Check className="w-3 h-3 text-white" />}
                        </button>
                      );
                    })}
                    <label
                      title="Custom color"
                      className={`course-swatch relative w-6 h-6 rounded-full flex items-center justify-center cursor-pointer ${
                        isCustomColor
                          ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900'
                          : 'border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                      }`}
                      style={isCustomColor ? { backgroundColor: color } : undefined}
                    >
                      <input
                        type="color"
                        tabIndex={-1}
                        value={color.startsWith('#') && color.length === 7 ? color : '#6366F1'}
                        onChange={(e) => onColorChange(e.target.value)}
                        className="sr-only"
                        id="custom-course-color-mixer"
                      />
                      {isCustomColor ? (
                        <Check className="w-3 h-3 text-white" />
                      ) : (
                        <Plus className="w-3 h-3 text-slate-500" />
                      )}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
