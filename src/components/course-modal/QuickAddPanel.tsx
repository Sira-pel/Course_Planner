import React, { type Ref } from 'react';
import { AlertTriangle, ClipboardPaste, Pencil, Trash2 } from 'lucide-react';
import { Course, DAYS_LIST, DayOfWeek } from '../../types/schedule';
import { timeToMinutes } from '../../utils/timeUtils';
import {
  DURATION_CHIPS,
  SAMPLE_CHIPS,
  type EditableRecognizedItem,
  endAfterStart,
  formatDaysShort,
} from './meetingPatterns';

const inputClass =
  'course-input w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-0';

const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';

export interface QuickAddPanelProps {
  incomingRef: Ref<HTMLDivElement>;
  rawText: string;
  recognizedItems: EditableRecognizedItem[];
  selectedCount: number;
  potentialConflicts: { newCode: string; existingCode: string; day: string; time: string }[];
  pasteInputRef: Ref<HTMLTextAreaElement>;
  onRawTextChange: (v: string) => void;
  onPasteClipboard: () => void;
  onToggleSelect: (id: string) => void;
  onToggleEdit: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onUpdateItemCourse: (id: string, updates: Partial<Course>) => void;
  onUpdateItemSessionDays: (id: string, days: DayOfWeek[]) => void;
  onUpdateItemTimes: (id: string, startTime: string, endTime: string) => void;
}

export const QuickAddPanel: React.FC<QuickAddPanelProps> = ({
  incomingRef,
  rawText,
  recognizedItems,
  selectedCount,
  potentialConflicts,
  pasteInputRef,
  onRawTextChange,
  onPasteClipboard,
  onToggleSelect,
  onToggleEdit,
  onDeleteItem,
  onUpdateItemCourse,
  onUpdateItemSessionDays,
  onUpdateItemTimes,
}) => {
  return (
    <div ref={incomingRef} className="space-y-3 pr-0.5">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="course-paste" className={labelClass + ' mb-0'}>
            One course per line
          </label>
          <span className="text-[11px] font-mono text-slate-400">
            {rawText.split('\n').filter((l) => l.trim().length > 0).length || 0} lines
          </span>
        </div>
        <div className="relative">
          <textarea
            id="course-paste"
            ref={pasteInputRef}
            value={rawText}
            onChange={(e) => onRawTextChange(e.target.value)}
            rows={5}
            placeholder={'CS 101 Computer science MWF 09:00-10:15\nITM 380 Cloud Computing MW 8:30-10:00'}
            className={`${inputClass} min-h-32 resize-none font-mono text-[13px] leading-relaxed pr-24`}
          />
          <button
            type="button"
            onClick={onPasteClipboard}
            className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400"
          >
            <ClipboardPaste className="w-3 h-3" />
            Paste
          </button>
        </div>
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400">Examples</span>
          {SAMPLE_CHIPS.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => onRawTextChange(rawText.trim() ? `${rawText}\n${sample.text}` : sample.text)}
              className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {recognizedItems.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600 dark:text-slate-300">{selectedCount} ready</span>
            {potentialConflicts.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-3 h-3" />
                {potentialConflicts.length} overlap{potentialConflicts.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {recognizedItems.map((item, idx) => {
              const c = item.course;
              const session0 = c.sessions[0] || {
                startTime: '09:00',
                endTime: '10:15',
                day: 'monday' as DayOfWeek,
              };
              const currentDays = c.sessions.map((s) => s.day);
              const duration = timeToMinutes(session0.endTime) - timeToMinutes(session0.startTime);

              return (
                <div
                  key={item.id}
                  className={`course-row rounded-lg border ${
                    item.hasError
                      ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                      : item.selected
                        ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                        : 'bg-transparent border-slate-200/80 dark:border-slate-800 opacity-60'
                  }`}
                  style={{ ['--i' as string]: Math.min(idx, 7) }}
                >
                  <div className="px-2.5 py-2 flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => onToggleSelect(item.id)}
                        className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus-visible:ring-indigo-500"
                      />
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-semibold text-xs text-slate-900 dark:text-white">
                            {c.code}
                          </span>
                          <span className="text-xs text-slate-600 dark:text-slate-300 truncate">{c.name}</span>
                        </span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {formatDaysShort(currentDays)} {session0.startTime}-{session0.endTime}
                          {item.hasError ? ` · ${item.errorMessage}` : ''}
                        </span>
                      </span>
                    </label>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleEdit(item.id)}
                        className={`p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 ${
                          item.isEditing ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600' : ''
                        }`}
                        aria-label={item.isEditing ? 'Collapse course' : 'Edit course'}
                      >
                        {item.hasError ? (
                          <span className="px-1.5 text-[11px] font-semibold text-rose-600">Fix</span>
                        ) : (
                          <Pencil className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteItem(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"
                        aria-label="Discard this course"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className={`course-acc ${item.isEditing ? 'is-open' : ''}`} inert={!item.isEditing}>
                    <div className="course-acc-inner">
                      <div className="course-acc-body px-2.5 pb-2.5 space-y-2.5 border-t border-slate-200/80 dark:border-slate-700 pt-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={labelClass}>Code</label>
                            <input
                              type="text"
                              value={c.code}
                              onChange={(e) => onUpdateItemCourse(item.id, { code: e.target.value.toUpperCase() })}
                              className={`${inputClass} font-mono font-semibold`}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Title</label>
                            <input
                              type="text"
                              value={c.name}
                              onChange={(e) => onUpdateItemCourse(item.id, { name: e.target.value })}
                              className={inputClass}
                            />
                          </div>
                        </div>

                        <div className="flex gap-1" role="group" aria-label="Meeting days">
                          {DAYS_LIST.map((d) => {
                            const isSelected = currentDays.includes(d.id);
                            return (
                              <button
                                key={d.id}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => {
                                  const newDays = isSelected
                                    ? currentDays.filter((cd) => cd !== d.id)
                                    : [...currentDays, d.id];
                                  onUpdateItemSessionDays(item.id, newDays);
                                }}
                                className={`course-day flex-1 rounded-md text-[11px] font-semibold ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                {d.short === 'TH' ? 'Th' : d.short === 'SA' ? 'Sa' : d.short === 'SU' ? 'Su' : d.short}
                              </button>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <input
                            type="time"
                            aria-label="Start time"
                            value={session0.startTime}
                            onChange={(e) => onUpdateItemTimes(item.id, e.target.value, session0.endTime)}
                            className={`${inputClass} font-mono`}
                          />
                          <input
                            type="time"
                            aria-label="End time"
                            value={session0.endTime}
                            onChange={(e) => onUpdateItemTimes(item.id, session0.startTime, e.target.value)}
                            className={`${inputClass} font-mono`}
                          />
                          <input
                            type="text"
                            aria-label="Section"
                            value={c.section || ''}
                            onChange={(e) => onUpdateItemCourse(item.id, { section: e.target.value })}
                            placeholder="Section"
                            className={`${inputClass} font-mono`}
                          />
                          <input
                            type="text"
                            aria-label="Instructor"
                            value={c.instructor || ''}
                            onChange={(e) => onUpdateItemCourse(item.id, { instructor: e.target.value })}
                            placeholder="Instructor"
                            className={inputClass}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            {DURATION_CHIPS.map((chip) => (
                              <button
                                key={chip.label}
                                type="button"
                                onClick={() => {
                                  onUpdateItemTimes(
                                    item.id,
                                    session0.startTime,
                                    endAfterStart(session0.startTime || '09:00', chip.minutes)
                                  );
                                }}
                                className={`px-2 py-0.5 text-[11px] font-mono rounded-md ${
                                  duration === chip.minutes
                                    ? 'bg-indigo-600 text-white font-semibold'
                                    : 'text-slate-500 hover:text-indigo-600'
                                }`}
                              >
                                {chip.label}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => onToggleEdit(item.id)}
                            className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
