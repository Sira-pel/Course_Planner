import React, { useState } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { Course, DAYS_LIST } from '../types/schedule';
import { minutesToTime, timeToMinutes, checkSessionCollision } from '../utils/timeUtils';
import {
  ChevronRight,
  ChevronLeft,
  ShoppingBag,
  Plus,
  Search,
  Check,
  Trash2,
  Edit2,
  Sparkles,
  AlertTriangle,
  Layers,
  X,
  ExternalLink,
} from 'lucide-react';

interface CoursePoolSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenNewCourse: (mode?: 'form' | 'quick') => void;
  onEditCourse: (courseId: string) => void;
}

export const CoursePoolSidebar: React.FC<CoursePoolSidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  onOpenNewCourse,
  onEditCourse,
}) => {
  const {
    plans,
    activePlanId,
    catalogCourses,
    removeFromCatalog,
    addCourseFromPool,
    removeCourseFromPlanByCatalog,
  } = useScheduleStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'in_plan' | 'not_in_plan'>('all');
  const [confirmDeleteCourseId, setConfirmDeleteCourseId] = useState<string | null>(null);

  const activePlan = plans.find((p) => p.id === activePlanId) || plans[0];

  // Helper to test if a catalog course is enrolled in the active plan
  const isEnrolledInActivePlan = (catalogItem: Course): boolean => {
    if (!activePlan) return false;
    return activePlan.courses.some(
      (c) =>
        c.code.trim().toUpperCase() === catalogItem.code.trim().toUpperCase() &&
        (c.section || '').trim().toUpperCase() === (catalogItem.section || '').trim().toUpperCase()
    );
  };

  // Helper to check for schedule conflicts with the active plan
  const findConflictInActivePlan = (catalogItem: Course): Course | null => {
    if (!activePlan) return null;
    // Don't show conflict with itself if already enrolled
    const activeNonSelfCourses = activePlan.courses.filter(
      (c) =>
        !(
          c.code.trim().toUpperCase() === catalogItem.code.trim().toUpperCase() &&
          (c.section || '').trim().toUpperCase() === (catalogItem.section || '').trim().toUpperCase()
        )
    );

    for (const poolSession of catalogItem.sessions) {
      for (const enrolled of activeNonSelfCourses) {
        for (const enrSession of enrolled.sessions) {
          if (checkSessionCollision(poolSession, enrSession)) {
            return enrolled;
          }
        }
      }
    }
    return null;
  };

  // Filtered pool list
  const filteredCourses = catalogCourses.filter((c) => {
    const matchesSearch =
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.section && c.section.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.instructor && c.instructor.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    const inPlan = isEnrolledInActivePlan(c);
    if (filterMode === 'in_plan') return inPlan;
    if (filterMode === 'not_in_plan') return !inPlan;
    return true;
  });

  const totalInPlan = catalogCourses.filter(isEnrolledInActivePlan).length;

  // Shared Course Pool Inner Content for both Desktop Sidebar and Mobile Bottom Sheet
  const renderPoolContent = (isMobileSheet = false) => (
    <div className="flex flex-col h-full min-h-0">
      {/* Top Header */}
      <div className="p-3 sm:p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                Course Pool
              </h2>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                {catalogCourses.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
              Semester scratchpad & candidate sections
            </p>
          </div>
        </div>

        {/* Close / Collapse Button */}
        <button
          type="button"
          id={isMobileSheet ? 'btn-close-mobile-course-pool' : 'btn-collapse-course-pool'}
          onClick={onToggleCollapse}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-slate-800 transition-colors shrink-0"
          title={isMobileSheet ? 'Close Course Pool' : 'Collapse Course Pool'}
        >
          {isMobileSheet ? (
            <X className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Active Plan Target Indicator */}
      <div className="px-3.5 py-2 bg-indigo-50/80 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between text-xs shrink-0">
        <span className="text-slate-700 dark:text-slate-300 truncate mr-2">
          Target: <strong className="text-indigo-700 dark:text-indigo-300 font-bold">{activePlan?.name}</strong>
        </span>
        <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 font-semibold shrink-0">
          {totalInPlan} enrolled
        </span>
      </div>

      {/* Controls: Search, Filter & Quick Add Buttons */}
      <div className="p-2.5 sm:p-3 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
        {/* Search Field */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search code, title, professor..."
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/70 focus:bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills & Add Actions */}
        <div className="flex items-center justify-between gap-1 text-[11px] flex-wrap sm:flex-nowrap">
          {/* Filters */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-lg border border-slate-200 dark:border-slate-700/60 flex-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2 py-1 rounded font-medium transition-colors whitespace-nowrap ${
                filterMode === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All ({catalogCourses.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('in_plan')}
              className={`px-2 py-1 rounded font-medium transition-colors whitespace-nowrap ${
                filterMode === 'in_plan'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              In Plan ({totalInPlan})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('not_in_plan')}
              className={`px-2 py-1 rounded font-medium transition-colors whitespace-nowrap ${
                filterMode === 'not_in_plan'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Available ({catalogCourses.length - totalInPlan})
            </button>
          </div>

          {/* Action Button */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (isMobileSheet) onToggleCollapse();
                onOpenNewCourse('form');
              }}
              className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-2xs flex items-center justify-center min-w-[32px] min-h-[32px]"
              title="Add course to schedule or pool"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Courses List */}
      <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2.5 min-h-0">
        {filteredCourses.length === 0 ? (
          <div className="text-center py-10 px-3">
            <ShoppingBag className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {searchQuery ? 'No matching courses in pool' : 'Course Pool is empty'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-[220px] mx-auto">
              {searchQuery
                ? 'Try clearing your search query or switching filters.'
                : 'Every course you create or paste is automatically saved here for 1-click reuse across plans!'}
            </p>
            <button
              type="button"
              onClick={() => {
                if (isMobileSheet) onToggleCollapse();
                onOpenNewCourse('form');
              }}
              className="mt-3 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Course</span>
            </button>
          </div>
        ) : (
          filteredCourses.map((item) => {
            const inActivePlan = isEnrolledInActivePlan(item);
            const conflict = !inActivePlan ? findConflictInActivePlan(item) : null;

            return (
              <div
                key={item.id}
                className={`p-3 rounded-xl border transition-all text-xs group ${
                  inActivePlan
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/80 shadow-2xs'
                    : 'bg-white dark:bg-slate-800/90 border-slate-200/90 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-600 shadow-xs hover:shadow-sm'
                }`}
              >
                {/* Card Header: Color, Code, Section, Credits & Action Buttons */}
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                      {item.code}
                    </span>
                    {item.section && (
                      <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                        Sec {item.section}
                      </span>
                    )}
                    {item.credits ? (
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        {item.credits} cr
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {confirmDeleteCourseId === item.id ? (
                      <div className="flex items-center gap-1 animate-in fade-in">
                        <button
                          type="button"
                          onClick={() => {
                            removeFromCatalog(item.id);
                            setConfirmDeleteCourseId(null);
                          }}
                          className="text-[10px] font-bold text-white bg-rose-600 px-2 py-1 rounded-md hover:bg-rose-700 shadow-xs"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteCourseId(null)}
                          className="text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      /* Edit and Delete Buttons: Always visible on touch/mobile, hoverable on desktop */
                      <div className="flex items-center gap-0.5 opacity-90 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => {
                            if (isMobileSheet) onToggleCollapse();
                            onEditCourse(item.id);
                          }}
                          title="Edit course"
                          className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteCourseId(item.id)}
                          title="Remove from pool"
                          className="text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Course Name */}
                <h3 className="font-medium text-slate-800 dark:text-slate-200 text-xs mt-0.5 leading-snug line-clamp-1">
                  {item.name}
                </h3>

                {/* Sessions summary */}
                <div className="mt-1.5 space-y-0.5 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                  {item.sessions.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="capitalize font-semibold text-slate-700 dark:text-slate-300">
                        {s.day.slice(0, 3)}{' '}
                        {minutesToTime(timeToMinutes(s.startTime))} - {minutesToTime(timeToMinutes(s.endTime))}
                      </span>
                      {s.room && (
                        <span className="font-sans text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[90px]">
                          {s.room}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Instructor */}
                {item.instructor && (
                  <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {item.instructor}
                  </div>
                )}

                {/* Conflict Warning */}
                {conflict && (
                  <div className="mt-1.5 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 text-[10px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span className="truncate">
                      Overlaps with <strong>{conflict.code}</strong>
                    </span>
                  </div>
                )}

                {/* Status Badges & 1-Click Action */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                  {inActivePlan ? (
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>In Plan</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => removeCourseFromPlanByCatalog(item.id, activePlanId)}
                        className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/60 rounded-lg transition-colors"
                        title="Remove this class from current timetable"
                      >
                        Remove from Plan
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addCourseFromPool(item.id, activePlanId)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white shadow-xs transition-all"
                      title={`Drop ${item.code} into ${activePlan?.name}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add to Plan</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer / Tip */}
      <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between shrink-0">
        <span>Adding creates independent copies</span>
        <button
          type="button"
          onClick={() => {
            if (isMobileSheet) onToggleCollapse();
            onOpenNewCourse('form');
          }}
          className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          + Add Course
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ---------------------------------------------------- */}
      {/* 1. DESKTOP VIEW (xl: 1280px and above side-by-side)  */}
      {/* ---------------------------------------------------- */}
      {isCollapsed ? (
        <aside
          id="course-pool-collapsed"
          onClick={onToggleCollapse}
          className="hidden xl:flex w-12 hover:w-13 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md flex-col items-center justify-start py-3.5 px-1.5 cursor-pointer select-none transition-all duration-200 hover:border-indigo-300 dark:hover:border-indigo-700 shrink-0 group"
          title="Click to expand Course Pool"
        >
          {/* Expand Arrow & Icon Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse();
              }}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-600 group-hover:text-white text-slate-600 dark:text-slate-300 transition-colors shadow-2xs mb-2"
              title="Expand Course Pool"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Icon & Count Badge */}
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              {catalogCourses.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1 min-w-[16px] h-4 rounded-full text-[9px] font-bold bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  {catalogCourses.length}
                </span>
              )}
            </div>
          </div>

          {/* Text Title (vertical on desktop) */}
          <div className="flex-1 flex items-center justify-center py-4">
            <span className="[writing-mode:vertical-rl] rotate-180 text-xs font-bold tracking-wider uppercase text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              Course Pool ({catalogCourses.length})
            </span>
          </div>

          {/* Status indicator: number in active plan */}
          <div className="text-[10px] font-mono text-center text-slate-600 dark:text-slate-300 mt-auto pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col items-center">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{totalInPlan}/{catalogCourses.length}</span>
            <span className="text-[8px] text-slate-400">in plan</span>
          </div>
        </aside>
      ) : (
        <aside
          id="course-pool-sidebar"
          className="hidden xl:flex w-80 lg:w-88 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-md flex-col shrink-0 overflow-hidden transition-all duration-200"
        >
          {renderPoolContent(false)}
        </aside>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. TABLET VIEW (md to xl: 768px - 1279px Slide Drawer) */}
      {/* ---------------------------------------------------- */}
      {!isCollapsed && (
        <div className="hidden md:flex xl:hidden fixed inset-0 z-50">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
            onClick={onToggleCollapse}
          />

          {/* Slide-Over Drawer */}
          <div
            className="relative z-10 ml-auto w-96 max-w-[90vw] h-full bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-right duration-250 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            {renderPoolContent(false)}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. MOBILE VIEW: Slide-Up Bottom Sheet Popup Modal   */}
      {/* ---------------------------------------------------- */}
      {!isCollapsed && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop overlay with blur */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
            onClick={onToggleCollapse}
          />

          {/* Slide-Up Bottom Sheet */}
          <div
            className="relative z-10 w-full max-h-[85vh] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Drag Handle */}
            <div
              className="w-full flex items-center justify-center pt-2.5 pb-1 cursor-pointer"
              onClick={onToggleCollapse}
            >
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Sheet Inner Content */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {renderPoolContent(true)}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
