import React, { memo, useMemo, useRef, useState, useEffect } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { nextMeasuredWidth } from './calendarMeasure';
import { CourseBlock } from './CourseBlock';
import { ClassSession, Course, DAYS_LIST, DayOfWeek, LayoutSession } from '../types/schedule';
import { checkSessionCollision, computeDayLayout, detectPlanConflicts, minutesToTime, timeToMinutes } from '../utils/timeUtils';
import { collectDaySessions, type DaySessionItem } from '../utils/collectDaySessions';
import { Clock } from 'lucide-react';

const DAY_INDEX_MAP: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function getTodayDayOfWeek(): DayOfWeek {
  return DAY_INDEX_MAP[new Date().getDay()];
}

/** Match computeDayLayout's end repair so the cover test uses the box that will be drawn. */
function sessionDrawnForOverlap(session: ClassSession): ClassSession {
  const start = timeToMinutes(session.startTime);
  const end = timeToMinutes(session.endTime);
  if (end > start) return session;
  return {
    ...session,
    endTime: minutesToTime(Math.min(1439, start + 30), false),
  };
}

function layoutComparedDay(items: DaySessionItem[]): LayoutSession[] {
  const activeLayout = computeDayLayout(items.filter((item) => !item.isGhost));
  const uncoveredGhosts: DaySessionItem[] = [];
  const coveredGhosts: LayoutSession[] = [];

  for (const ghost of items) {
    if (!ghost.isGhost) continue;
    const session = sessionDrawnForOverlap(ghost.session);
    const covering = activeLayout.filter((active) => checkSessionCollision(session, active.session));
    if (covering.length === 0) {
      uncoveredGhosts.push(session === ghost.session ? ghost : { ...ghost, session });
      continue;
    }
    const ghostEnd = timeToMinutes(session.endTime);
    const coverEnd = Math.max(...covering.map((active) => timeToMinutes(active.session.endTime)));
    coveredGhosts.push({
      ...ghost,
      session,
      colIndex: 0,
      totalCols: 1,
      coveredByActive: true,
      coveredExtendsBelow: ghostEnd > coverEnd,
    });
  }

  const freeGhostLayout = computeDayLayout(uncoveredGhosts);
  const chipsAtPlacement = new Map<string, number>();
  for (const covered of coveredGhosts) {
    const placement = `${covered.coveredExtendsBelow ? 'below' : 'corner'}|${covered.session.startTime}|${covered.session.endTime}`;
    const chipIndex = chipsAtPlacement.get(placement) ?? 0;
    chipsAtPlacement.set(placement, chipIndex + 1);
    covered.coveredChipIndex = chipIndex;
  }

  return activeLayout.concat(freeGhostLayout, coveredGhosts);
}

function getInitialCalendarWidth(): number {
  if (typeof window === 'undefined') return 1000;
  const w = window.innerWidth;
  if (w < 640) {
    // Mobile: workspace p-2.5 (20px) + grid border (2px)
    return Math.max(280, w - 22);
  }
  if (w < 1024) {
    // Tablet: workspace sm:p-4 (32px) + grid border (2px)
    return Math.max(400, w - 34);
  }
  // Desktop: max workspace 1720px, md:p-5 (40px total), gap-3 (12px), pool rail (48px), grid border (2px)
  const maxW = Math.min(1720, w);
  return Math.max(500, maxW - 40 - 12 - 48 - 2);
}

interface CalendarGridProps {
  onEditCourse: (courseId: string, planId?: string) => void;
  onAddCourseAtTime?: (day: DayOfWeek, time: string) => void;
  onOpenNewCourse?: (mode?: 'form' | 'quick') => void;
}

export const CalendarGrid = memo(function CalendarGrid({
  onEditCourse,
  onAddCourseAtTime,
  onOpenNewCourse,
}: CalendarGridProps) {
  const plans = useScheduleStore((state) => state.plans);
  const activePlanId = useScheduleStore((state) => state.activePlanId);
  const ghostPlanIds = useScheduleStore((state) => state.ghostPlanIds);
  const showWeekends = useScheduleStore((state) => state.showWeekends);
  const startHour = useScheduleStore((state) => state.startHour);
  const endHour = useScheduleStore((state) => state.endHour);
  const deleteCourse = useScheduleStore((state) => state.deleteCourse);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(getInitialCalendarWidth);

  // Width changes the gutter and day labels. Row height is a percentage, so
  // vertical resizes (mobile browser chrome) do not need a React update.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    let rafId = 0;
    const apply = (measured: number) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setContainerWidth((previous) => nextMeasuredWidth(previous, measured, 2));
      });
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          apply(entry.contentRect.width);
        }
      }
    });
    observer.observe(node);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  const activePlan = useMemo(() => plans.find(p => p.id === activePlanId) || plans[0], [plans, activePlanId]);
  const ghostPlans = useMemo(() => {
    return plans.filter(p => ghostPlanIds.includes(p.id) && p.id !== activePlanId);
  }, [plans, ghostPlanIds, activePlanId]);

  const days = useMemo(() => {
    return showWeekends
      ? DAYS_LIST
      : DAYS_LIST.filter(d => d.id !== 'saturday' && d.id !== 'sunday');
  }, [showWeekends]);

  // Conflict set for active plan
  const conflicts = useMemo(() => {
    return activePlan ? detectPlanConflicts(activePlan.courses) : [];
  }, [activePlan?.courses]);

  const conflictingCourseIds = useMemo(() => {
    const set = new Set<string>();
    conflicts.forEach(c => {
      set.add(c.courseId1);
      set.add(c.courseId2);
    });
    return set;
  }, [conflicts]);

  // Adaptive time boundaries: if any enrolled or ghost course has sessions outside startHour/endHour,
  // gracefully expand the visible hours so no class is cropped or squeezed to zero.
  const { effectiveStartHour, effectiveEndHour } = useMemo(() => {
    let minH = startHour;
    let maxH = endHour;

    const scanCourse = (c: Course) => {
      for (const s of c.sessions) {
        const sM = timeToMinutes(s.startTime);
        const eM = timeToMinutes(s.endTime);
        if (sM >= 0 && eM > sM) {
          minH = Math.min(minH, Math.floor(sM / 60));
          maxH = Math.max(maxH, Math.ceil(eM / 60));
        } else {
          if (sM > 0) minH = Math.min(minH, Math.floor(sM / 60));
          if (eM > 0) maxH = Math.max(maxH, Math.ceil(eM / 60));
        }
      }
    };

    if (activePlan?.courses) {
      for (const c of activePlan.courses) scanCourse(c);
    }
    for (const p of ghostPlans) {
      for (const c of p.courses) scanCourse(c);
    }

    return {
      effectiveStartHour: Math.max(0, minH),
      effectiveEndHour: Math.min(24, Math.max(minH + 1, maxH)),
    };
  }, [startHour, endHour, activePlan?.courses, ghostPlans]);

  // Total grid minutes and dimensions
  const numHours = Math.max(1, effectiveEndHour - effectiveStartHour);
  
  const HOUR_MIN_PX = 55;
  const totalMinutes = numHours * 60;
  const hourPct = 100 / numHours;

  const hourMarks = useMemo(() => {
    const arr: number[] = [];
    for (let h = effectiveStartHour; h <= effectiveEndHour; h++) {
      arr.push(h);
    }
    return arr;
  }, [effectiveStartHour, effectiveEndHour]);

  const hourSlots = useMemo(() => Array.from({ length: numHours }, (_, i) => i), [numHours]);

  const planIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    plans.forEach((p, idx) => map.set(p.id, idx));
    return map;
  }, [plans]);

  // Pre-calculate day layout sessions
  const dayLayoutMap = useMemo(() => {
    const map = new Map<DayOfWeek, LayoutSession[]>();

    days.forEach(dayObj => {
      const items = collectDaySessions(dayObj.id, activePlan, ghostPlans, conflictingCourseIds, planIndexMap);
      map.set(dayObj.id, layoutComparedDay(items));
    });

    return map;
  }, [days, activePlan, ghostPlans, conflictingCourseIds, planIndexMap]);

  // Day highlight: updates when midnight passes or tab becomes visible again
  const [currentDayOfWeek, setCurrentDayOfWeek] = useState<DayOfWeek>(getTodayDayOfWeek);
  useEffect(() => {
    const updateDay = () => {
      const today = getTodayDayOfWeek();
      setCurrentDayOfWeek((prev) => (prev !== today ? today : prev));
    };

    document.addEventListener('visibilitychange', updateDay);

    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = Math.max(1000, nextMidnight.getTime() - now.getTime() + 500);

    const timer = setTimeout(updateDay, Math.min(msUntilMidnight, 3600000));
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', updateDay);
    };
  }, [currentDayOfWeek]);

  const gutterWidth = containerWidth < 400 ? 56 : containerWidth < 640 ? 60 : 64;
  const minGridWidth = days.length > 5 ? gutterWidth + days.length * 64 : undefined;
  const effectiveGridWidth = minGridWidth ? Math.max(containerWidth, minGridWidth) : containerWidth;
  const colWidth = days.length > 0 ? (effectiveGridWidth - gutterWidth) / days.length : 120;

  // Responsive day formatting:
  // - Super small (< 68px col width): M, T, W, TH, F, SA, SU
  // - Small/Medium (68px - 135px col width): Mon, Tue, Wed, Thu, Fri, Sat, Sun
  // - Spacious (>= 135px col width): Monday, Tuesday, Wednesday, Thursday, Friday...
  const responsiveDayFormat: 'short' | 'label' | 'full' =
    colWidth < 68 ? 'short' : colWidth < 135 ? 'label' : 'full';

  const needsHorizontalScroll = Boolean(minGridWidth && containerWidth < minGridWidth);

  return (
    <div
      ref={containerRef}
      id="calendar-grid-container"
      className="flex-1 flex flex-col min-w-0 w-full max-w-full bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200 dark:border-slate-800 overflow-hidden relative z-0 isolate"
    >
      {/* Scrollable Container with sticky header for 100% pixel-perfect column alignment */}
      <div
        className={`up-scroll flex-1 overflow-y-auto ${
          needsHorizontalScroll ? 'overflow-x-auto' : 'overflow-x-hidden'
        } relative flex flex-col w-full max-w-full`}
      >
        <div
          className="flex flex-col flex-1 min-h-0 w-full"
          style={{ minWidth: minGridWidth ? `${minGridWidth}px` : '100%' }}
        >
          {/* Day Headers (Sticky at top of scroll area) */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 sticky top-0 z-30 shadow-2xs w-full max-w-full">
          {/* Top-left corner time label */}
          <div
            style={{ width: `${gutterWidth}px` }}
            className="h-11 shrink-0 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400 select-none bg-slate-100 dark:bg-slate-950 sticky left-0 z-40"
          >
            <Clock className="w-3.5 h-3.5" />
          </div>

          {/* Days header columns */}
          <div
            className="flex-1 grid divide-x divide-slate-200 dark:divide-slate-800 min-w-0"
            style={{
              gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
            }}
          >
            {days.map((day) => {
              const isToday = day.id === currentDayOfWeek;
              const sessionCount = (dayLayoutMap.get(day.id) || []).filter(s => !s.isGhost).length;

              return (
                <div
                  key={day.id}
                  id={`day-header-${day.id}`}
                  title={day.full}
                  aria-label={
                    sessionCount > 0
                      ? `${day.full}, ${sessionCount} ${sessionCount === 1 ? 'class' : 'classes'}`
                      : day.full
                  }
                  className={`h-11 flex items-center select-none ${
                    colWidth < 68 ? 'justify-center px-1' : 'justify-between px-2 sm:px-3'
                  } ${
                    isToday ? 'bg-indigo-50/90 dark:bg-slate-900 border-b-2 border-indigo-600 dark:border-slate-200' : ''
                  }`}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <span
                      className={`font-bold tracking-tight truncate ${
                        colWidth < 68
                          ? 'text-xs uppercase font-mono'
                          : colWidth < 135
                          ? 'text-xs sm:text-sm'
                          : 'text-sm'
                      } ${
                        isToday
                          ? 'text-indigo-700 dark:text-slate-50'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {responsiveDayFormat === 'short' && day.short}
                      {responsiveDayFormat === 'label' && day.label}
                      {responsiveDayFormat === 'full' && day.full}
                    </span>
                  </div>

                  {/* Session count: words when the column is wide, a labeled dot when it is narrow */}
                  {sessionCount > 0 && colWidth >= 85 && (
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                      {sessionCount} {sessionCount === 1 ? 'class' : 'classes'}
                    </span>
                  )}
                  {sessionCount > 0 && colWidth < 85 && colWidth >= 52 && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 shrink-0 ml-0.5"
                      role="img"
                      title={`${sessionCount} ${sessionCount === 1 ? 'class' : 'classes'}`}
                      aria-label={`${sessionCount} ${sessionCount === 1 ? 'class' : 'classes'}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Grid Area (Time rows & Day columns) */}
        <div
          className="flex w-full max-w-full relative flex-1 min-h-0"
          style={{ minHeight: `${numHours * HOUR_MIN_PX}px` }}
        >
          {/* Horizontal Hour Guidelines across all day columns */}
          <div
            className="absolute top-0 bottom-0 right-0 pointer-events-none z-0"
            style={{ left: `${gutterWidth}px` }}
          >
            {hourSlots.map((slotIdx) => (
              <div
                key={`hour-slot-${slotIdx}`}
                style={{
                  top: `${slotIdx * hourPct}%`,
                  height: `${hourPct}%`,
                }}
                className={`absolute left-0 right-0 ${
                  slotIdx === numHours - 1
                    ? ''
                    : 'border-b border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Subtle 30-minute dashed half-hour line */}
                <div className="w-full h-1/2 border-b border-dashed border-slate-200/60 dark:border-slate-800/60" />
              </div>
            ))}
          </div>

          {/* Time Gutter (Left Column) */}
          <div
            style={{ width: `${gutterWidth}px` }}
            className="shrink-0 self-stretch select-none border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 sticky left-0 z-20"
          >
            {hourMarks.map((hour, idx) => {
              const timeStr = containerWidth < 380
                ? (hour === 0 || hour === 24 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`)
                : minutesToTime(hour * 60, true);
              const topPct = (idx / numHours) * 100;
              const isFirst = idx === 0;
              const isLast = idx === numHours;

              return (
                <div
                  key={hour}
                  style={{ top: `${topPct}%` }}
                  className={`absolute right-1 sm:right-2 font-mono text-slate-600 dark:text-slate-400 select-none pointer-events-none whitespace-nowrap leading-none font-semibold ${
                    colWidth < 68 ? 'text-[9px] sm:text-[9.5px]' : 'text-[10px]'
                  } ${
                    isFirst
                      ? 'top-1.5 translate-y-0'
                      : isLast
                      ? '-translate-y-full'
                      : '-translate-y-1/2'
                  }`}
                >
                  {timeStr}
                </div>
              );
            })}
          </div>

          {/* Days Columns Grid (1:1 column match with sticky header) */}
          <div
            className="flex-1 grid divide-x divide-slate-200 dark:divide-slate-800 relative self-stretch min-w-0 z-10"
            style={{
              gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
            }}
          >
            {/* Render Each Day Column */}
            {days.map((day) => {
              const isToday = day.id === currentDayOfWeek;
              const sessions = dayLayoutMap.get(day.id) || [];

              return (
                <div
                  key={day.id}
                  id={`day-column-${day.id}`}
                  className={`relative h-full overflow-x-clip group/col ${
                    isToday ? 'bg-indigo-500/[0.02] dark:bg-white/[0.035]' : ''
                  }`}
                  onDoubleClick={(e) => {
                    if (!onAddCourseAtTime) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickY = e.clientY - rect.top;
                    const percent = Math.max(0, Math.min(1, clickY / rect.height));
                    const clickedMinutes = effectiveStartHour * 60 + percent * totalMinutes;
                    // Snap to nearest 30 mins, clamping between effectiveStartHour and max 23:30
                    const maxMinutes = Math.min(23 * 60 + 30, effectiveEndHour * 60 - 30);
                    const minMinutes = effectiveStartHour * 60;
                    const snappedM = Math.max(minMinutes, Math.min(maxMinutes, Math.round(clickedMinutes / 30) * 30));
                    const h = Math.min(23, Math.floor(snappedM / 60));
                    const m = snappedM % 60;
                    const timeFormatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    onAddCourseAtTime(day.id, timeFormatted);
                  }}
                >
                  {/* Course Sessions on this Day */}
                  {sessions.map((layoutItem) => (
                    <CourseBlock
                      key={`${layoutItem.planId}_${layoutItem.course.id}_${layoutItem.session.id}_${layoutItem.isGhost ? 'g' : 'a'}`}
                      layout={layoutItem}
                      startHour={effectiveStartHour}
                      totalMinutes={totalMinutes}
                      onEdit={onEditCourse}
                      onDelete={deleteCourse}
                    />
                  ))}

                  {/* Hover Empty State Quick-Add helper on hover (desktop only) */}
                  <div className="hidden md:flex absolute inset-0 opacity-0 group-hover/col:opacity-100 pointer-events-none transition-opacity flex-col justify-end p-2">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-white/95 dark:bg-slate-800/95 py-0.5 px-1.5 rounded shadow-xs w-max border border-slate-200/60 dark:border-slate-700/60">
                      Double-click to add
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
});
