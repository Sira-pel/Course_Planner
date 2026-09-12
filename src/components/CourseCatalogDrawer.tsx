import React, { useState } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { Course, DAYS_LIST } from '../types/schedule';
import { minutesToTime, timeToMinutes } from '../utils/timeUtils';
import {
  X,
  Plus,
  Trash2,
  Check,
  Search,
  BookOpen,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface CourseCatalogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewCourse: () => void;
}

export const CourseCatalogDrawer: React.FC<CourseCatalogDrawerProps> = ({
  isOpen,
  onClose,
  onOpenNewCourse,
}) => {
  const {
    plans,
    activePlanId,
    catalogCourses,
    removeFromCatalog,
    toggleCourseInPlan,
  } = useScheduleStore();

  const [searchQuery, setSearchQuery] = useState('');
  const activePlan = plans.find((p) => p.id === activePlanId) || plans[0];

  if (!isOpen) return null;

  const filteredCourses = catalogCourses.filter(
    (c) =>
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.instructor && c.instructor.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col p-6 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Course Scratchpad Pool
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Shared catalog for comparing alternative sections
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Add Button */}
        <div className="mt-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-600 dark:text-slate-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pool by code or professor..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenNewCourse();
            }}
            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors shrink-0"
            title="Create New Course"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Target Plan Indicator */}
        <div className="mt-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
          <span className="text-slate-600 dark:text-slate-300">
            Active Target Plan: <strong className="text-indigo-600 dark:text-indigo-400">{activePlan?.name}</strong>
          </span>
          <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
            {activePlan?.courses.length} enrolled
          </span>
        </div>

        {/* Course Pool List */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-2.5 pr-1">
          {filteredCourses.length === 0 ? (
            <div className="text-center py-12 px-4">
              <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                No courses found in scratchpad pool
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                Any course you create is automatically saved here so you can test it across different plans!
              </p>
            </div>
          ) : (
            filteredCourses.map((c) => {
              const isEnrolled = activePlan?.courses.some(
                (planC) => planC.code === c.code && (planC.section === c.section || !planC.section)
              );

              return (
                <div
                  key={c.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isEnrolled
                      ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                      <div>
                        <span className="font-extrabold text-xs text-slate-900 dark:text-white font-mono">
                          {c.section ? `${c.code}-${c.section}` : c.code}
                        </span>
                        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">
                          {c.name}
                        </h4>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCatalog(c.id)}
                      title="Remove from pool"
                      className="text-slate-600 hover:text-rose-500 transition-colors p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Sessions details */}
                  <div className="mt-2 text-[11px] font-mono text-slate-600 dark:text-slate-300 space-y-0.5">
                    {c.sessions.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="font-semibold capitalize text-slate-700 dark:text-slate-300">
                          {s.day.slice(0, 3)} {minutesToTime(timeToMinutes(s.startTime))} -{' '}
                          {minutesToTime(timeToMinutes(s.endTime))}
                        </span>
                        {s.room && <span className="font-sans text-[10px] opacity-75">{s.room}</span>}
                      </div>
                    ))}
                  </div>

                  {c.instructor && (
                    <div className="mt-1 text-[10px] text-slate-600 dark:text-slate-300">
                      Instructor: {c.instructor}
                    </div>
                  )}

                  {/* Toggle in Plan Button */}
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300">
                      {c.credits ? `${c.credits} credits` : ''}
                    </span>

                    <button
                      type="button"
                      onClick={() => toggleCourseInPlan(c.id, activePlanId)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        isEnrolled
                          ? 'bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                      }`}
                    >
                      {isEnrolled ? (
                        <>
                          <X className="w-3 h-3" />
                          <span>Remove from Plan</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          <span>Add to {activePlan?.name.split(' ')[0]}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors"
          >
            Close Pool
          </button>
        </div>
      </div>
    </div>
  );
};
