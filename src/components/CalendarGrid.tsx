import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { CourseBlock } from './CourseBlock';
import { DAYS_LIST, DayOfWeek, LayoutSession } from '../types/schedule';
import { computeDayLayout, detectPlanConflicts, minutesToTime, timeToMinutes } from '../utils/timeUtils';
import { Plus, Clock } from 'lucide-react';

interface CalendarGridProps {
  onEditCourse: (courseId: string) => void;
  onAddCourseAtTime?: (day: DayOfWeek, time: string) => void;
  onOpenNewCourse?: (mode?: 'form' | 'quick') => void;
  onOpenCatalog?: () => void;
  isPoolOpen?: boolean;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  onEditCourse,
  onAddCourseAtTime,
  onOpenNewCourse,
  onOpenCatalog,
  isPoolOpen = false,
}) => {
  const plans = useScheduleStore((state) => state.plans);
  const activePlanId = useScheduleStore((state) => state.activePlanId);
  const ghostPlanIds = useScheduleStore((state) => state.ghostPlanIds);
  const showWeekends = useScheduleStore((state) => state.showWeekends);
  const startHour = useScheduleStore((state) => state.startHour);
  const endHour = useScheduleStore((state) => state.endHour);
  const deleteCourse = useScheduleStore((state) => state.deleteCourse);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState(() => ({
    width: typeof window !== 'undefined' ? Math.min(1200, window.innerWidth) : 1000,
    height: 800,
  }));

  // Track calendar dimensions responsively (supports window resizes and sidebar expand/collapse)
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Initial size
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setContainerDimensions({ width: rect.width, height: rect.height });
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 || h > 0) {
          setContainerDimensions((prev) => {
            if (Math.abs(prev.width - w) < 1 && Math.abs(prev.height - h) < 1) {
              return prev;
            }
            return { width: w, height: h };
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const activePlan = plans.find(p => p.id === activePlanId) || plans[0];
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
  }, [activePlan]);

  const conflictingCourseIds = useMemo(() => {
    const set = new Set<string>();
    conflicts.forEach(c => {
      set.add(c.courseId1);
      set.add(c.courseId2);
    });
    return set;
  }, [conflicts]);

  const { width: containerWidth, height: containerHeight } = containerDimensions;

  // Total grid minutes and dimensions
  const numHours = Math.max(1, endHour - startHour);
  
  // Calculate a responsive hour height. 
  // We subtract ~44px for the header from the container height.
  // We use a high max-cap (150px) so the table can stretch to fill tall screens (making it longer),
  // but a healthy minimum (55px) so it doesn't get unreadably squished on tiny screens.
  const availableGridHeight = Math.max(600, containerHeight - 44);
  const idealHourHeight = Math.floor(availableGridHeight / numHours);
  const HOUR_HEIGHT = Math.max(55, Math.min(150, idealHourHeight)); 
  
  const totalMinutes = numHours * 60;
  const totalGridHeight = numHours * HOUR_HEIGHT;

  const hourMarks = useMemo(() => {
    const arr: number[] = [];
    for (let h = startHour; h <= endHour; h++) {
      arr.push(h);
    }
    return arr;
  }, [startHour, endHour]);

  // Pre-calculate day layout sessions
  const dayLayoutMap = useMemo(() => {
    const map = new Map<DayOfWeek, LayoutSession[]>();

    days.forEach(dayObj => {
      const itemsToLayout: {
        session: (typeof activePlan.courses)[0]['sessions'][0];
        course: (typeof activePlan.courses)[0];
        planId: string;
        planName: string;
        isGhost: boolean;
        ghostIndex?: number;
        hasConflict: boolean;
      }[] = [];

      // 1. Active plan sessions
      if (activePlan) {
        activePlan.courses.forEach(course => {
          course.sessions
            .filter(s => s.day === dayObj.id)
            .forEach(session => {
              itemsToLayout.push({
                session,
                course,
                planId: activePlan.id,
                planName: activePlan.name,
                isGhost: false,
                hasConflict: conflictingCourseIds.has(course.id),
              });
            });
        });
      }

      // 2. Ghost plans sessions
      ghostPlans.forEach((ghostPlan, gIdx) => {
        ghostPlan.courses.forEach(course => {
          course.sessions
            .filter(s => s.day === dayObj.id)
            .forEach(session => {
              itemsToLayout.push({
                session,
                course,
                planId: ghostPlan.id,
                planName: ghostPlan.name,
                isGhost: true,
                ghostIndex: gIdx,
                hasConflict: false,
              });
            });
        });
      });

      const layout = computeDayLayout(itemsToLayout);
      map.set(dayObj.id, layout);
    });

    return map;
  }, [days, activePlan, ghostPlans, conflictingCourseIds]);

  // Current day and time highlight (updates every 60s)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const currentDayOfWeek: DayOfWeek | null = useMemo(() => {
    const jsDay = now.getDay();
    const map: Record<number, DayOfWeek> = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };
    return map[jsDay] || null;
  }, [now]);

  const currentMinutesFromGridStart = (now.getHours() * 60 + now.getMinutes()) - (startHour * 60);
  const showNowLine = currentMinutesFromGridStart >= 0 && currentMinutesFromGridStart <= totalMinutes;
  const nowPercent = (currentMinutesFromGridStart / totalMinutes) * 100;

  const gutterWidth = containerWidth < 400 ? 56 : containerWidth < 640 ? 60 : 64;
  const colWidth = days.length > 0 ? (containerWidth - gutterWidth) / days.length : 120;

  // Responsive day formatting:
  // - Super small (< 68px col width): M, T, W, TH, F, SA, SU
  // - Small/Medium (68px - 135px col width): Mon, Tue, Wed, Thu, Fri, Sat, Sun
  // - Spacious (>= 135px col width): Monday, Tuesday, Wednesday, Thursday, Friday...
  const responsiveDayFormat: 'short' | 'label' | 'full' =
    colWidth < 68 ? 'short' : colWidth < 135 ? 'label' : 'full';

  return (
    <div
      ref={containerRef}
      id="calendar-grid-container"
      className="flex-1 flex flex-col min-w-0 w-full max-w-full bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-200/90 dark:border-slate-800 overflow-hidden"
    >
      {/* Scrollable Container with sticky header for 100% pixel-perfect column alignment */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col w-full max-w-full touch-pan-y">
        {/* Day Headers (Sticky at top of scroll area) */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xs sticky top-0 z-30 shadow-2xs w-full max-w-full">
          {/* Top-left corner time label */}
          <div
            style={{ width: `${gutterWidth}px` }}
            className="h-11 shrink-0 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400 select-none bg-slate-100/70 dark:bg-slate-950/70"
          >
            <Clock className="w-3.5 h-3.5" />
          </div>

          {/* Days header columns */}
          <div
            className="flex-1 grid divide-x divide-slate-200 dark:divide-slate-800 min-w-0"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
          >
            {days.map((day) => {
              const isToday = day.id === currentDayOfWeek;
              const sessionCount = (dayLayoutMap.get(day.id) || []).filter(s => !s.isGhost).length;

              return (
                <div
                  key={day.id}
                  id={`day-header-${day.id}`}
                  title={day.full}
                  className={`h-11 flex items-center select-none transition-colors ${
                    colWidth < 68 ? 'justify-center px-1' : 'justify-between px-2 sm:px-3'
                  } ${
                    isToday ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-b-2 border-indigo-600' : ''
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
                          ? 'text-indigo-700 dark:text-indigo-300'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {responsiveDayFormat === 'short' && day.short}
                      {responsiveDayFormat === 'label' && day.label}
                      {responsiveDayFormat === 'full' && day.full}
                    </span>
                  </div>

                  {/* Session count pill or mini dot */}
                  {sessionCount > 0 && colWidth >= 85 && (
                    <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full bg-slate-200/90 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300/60 dark:border-slate-700 shrink-0 shadow-2xs">
                      {sessionCount}
                    </span>
                  )}
                  {sessionCount > 0 && colWidth < 85 && colWidth >= 52 && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 shrink-0 ml-0.5"
                      title={`${sessionCount} class${sessionCount > 1 ? 'es' : ''}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Grid Area (Time rows & Day columns) */}
        <div
          className="flex w-full max-w-full relative flex-1"
          style={{ height: `${totalGridHeight}px`, minHeight: `${totalGridHeight}px` }}
        >
          {/* Time Gutter (Left Column) */}
          <div
            style={{ width: `${gutterWidth}px`, height: `${totalGridHeight}px` }}
            className="shrink-0 select-none border-r border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/60 relative"
          >
            {hourMarks.map((hour, idx) => {
              const timeStr = containerWidth < 380
                ? (hour === 0 || hour === 24 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`)
                : minutesToTime(hour * 60, true);
              const topPx = idx * HOUR_HEIGHT;
              const isFirst = idx === 0;
              const isLast = idx === numHours;

              return (
                <div
                  key={hour}
                  style={{ top: `${topPx}px` }}
                  className={`absolute right-1 sm:right-2 font-mono text-slate-600 dark:text-slate-400 select-none pointer-events-none whitespace-nowrap leading-none font-semibold ${
                    colWidth < 68 ? 'text-[9px] sm:text-[9.5px]' : 'text-[10px]'
                  } ${
                    isFirst
                      ? 'top-1.5 translate-y-0'
                      : isLast
                      ? '-translate-y-full -mt-1.5'
                      : '-translate-y-1/2'
                  }`}
                >
                  {timeStr}
                </div>
              );
            })}
          </div>

          {/* Days Columns Grid */}
          <div
            className="flex-1 grid divide-x divide-slate-200 dark:divide-slate-800 relative"
            style={{
              gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
              height: `${totalGridHeight}px`,
            }}
          >
            {/* Horizontal Hour Lines Background */}
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: numHours }).map((_, slotIdx) => (
                <div
                  key={`hour-slot-${slotIdx}`}
                  style={{
                    top: `${slotIdx * HOUR_HEIGHT}px`,
                    height: `${HOUR_HEIGHT}px`,
                  }}
                  className="absolute left-0 right-0 border-b border-slate-200/90 dark:border-slate-800/80"
                >
                  {/* Subtle 30-minute dashed half-hour line */}
                  <div className="w-full h-1/2 border-b border-dashed border-slate-200/50 dark:border-slate-800/40" />
                </div>
              ))}
            </div>

            {/* Render Each Day Column */}
            {days.map((day) => {
              const isToday = day.id === currentDayOfWeek;
              const sessions = dayLayoutMap.get(day.id) || [];

              return (
                <div
                  key={day.id}
                  id={`day-column-${day.id}`}
                  className={`relative h-full transition-colors group/col ${
                    isToday ? 'bg-indigo-500/[0.02] dark:bg-indigo-500/[0.03]' : ''
                  }`}
                  onDoubleClick={(e) => {
                    if (!onAddCourseAtTime) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickY = e.clientY - rect.top;
                    const percent = Math.max(0, Math.min(1, clickY / rect.height));
                    const clickedMinutes = startHour * 60 + percent * totalMinutes;
                    // Snap to nearest 30 mins
                    const snappedM = Math.round(clickedMinutes / 30) * 30;
                    const h = Math.floor(snappedM / 60);
                    const m = snappedM % 60;
                    const timeFormatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    onAddCourseAtTime(day.id, timeFormatted);
                  }}
                >
                  {/* Current Time Indicator on today's column */}
                  {isToday && showNowLine && (
                    <div
                      className="absolute left-0 right-0 z-40 flex items-center pointer-events-none"
                      style={{ top: `${nowPercent}%` }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shadow-xs" />
                      <div className="flex-1 border-t-2 border-red-500 shadow-xs" />
                    </div>
                  )}

                  {/* Course Sessions on this Day */}
                  {sessions.map((layoutItem) => (
                    <CourseBlock
                      key={`${layoutItem.course.id}_${layoutItem.session.id}_${layoutItem.isGhost ? 'g' : 'a'}`}
                      layout={layoutItem}
                      startHour={startHour}
                      totalMinutes={totalMinutes}
                      onEdit={onEditCourse}
                      onDelete={(cId) => deleteCourse(cId)}
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
  );
};
