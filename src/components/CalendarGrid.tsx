import React, { memo, useMemo, useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useScheduleStore } from '../store/useScheduleStore';
import { useIsPhone } from '../utils/usePoolLayout';
import { nextMeasuredWidth } from './calendarMeasure';
import { CourseBlock } from './CourseBlock';
import { Course, DayOfWeek, LayoutSession } from '../types/schedule';
import { checkSessionCollision, computeDayLayout, detectPlanConflicts, minutesToTime, timeToMinutes } from '../utils/timeUtils';
import { calendarDayOrder, computeAutoFitRange, coursesForVisibleRange } from '../utils/calendarRange';
import { collectDaySessions } from '../utils/collectDaySessions';
import { Clock } from 'lucide-react';
import { EmptyStateCard } from './calendar/EmptyStateCard';

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

/** Axis label that fits a narrow phone gutter: "7 AM", not "7:00 AM". */
function formatAxisHour(hour: number): string {
  const h = hour >= 24 ? hour % 24 : hour;
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  if (h > 12) return `${h - 12} PM`;
  return `${h} AM`;
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
  onOpenImport?: () => void;
  onLoadDemo?: () => void;
}

export const CalendarGrid = memo(function CalendarGrid({
  onEditCourse,
  onAddCourseAtTime,
  onOpenNewCourse,
  onOpenImport,
  onLoadDemo,
}: CalendarGridProps) {
  const plans = useScheduleStore((state) => state.plans);
  const activePlanId = useScheduleStore((state) => state.activePlanId);
  const ghostPlanIds = useScheduleStore((state) => state.ghostPlanIds);
  const showWeekends = useScheduleStore((state) => state.showWeekends);
  const weekStart = useScheduleStore((state) => state.weekStart);
  const timeRangeMode = useScheduleStore((state) => state.timeRangeMode);
  const startHour = useScheduleStore((state) => state.startHour);
  const endHour = useScheduleStore((state) => state.endHour);
  const theme = useScheduleStore((state) => state.theme);
  const mobileCalendarView = useScheduleStore((state) => state.mobileCalendarView);
  const setMobileCalendarView = useScheduleStore((state) => state.setMobileCalendarView);
  const deleteCourse = useScheduleStore((state) => state.deleteCourse);
  const isPhone = useIsPhone();
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(getTodayDayOfWeek);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const welcomeDecided = useRef(false);

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

  // Offer the empty-plan welcome once per page load, after saved data is in.
  // A new plan created later in the same visit must not open it again.
  useEffect(() => {
    if (welcomeDecided.current) return;
    const decide = () => {
      if (welcomeDecided.current) return;
      welcomeDecided.current = true;
      const state = useScheduleStore.getState();
      const plan = state.plans.find((item) => item.id === state.activePlanId) || state.plans[0];
      if ((plan?.courses.length ?? 0) === 0) setWelcomeOpen(true);
    };
    if (useScheduleStore.persist.hasHydrated()) {
      decide();
      return;
    }
    return useScheduleStore.persist.onFinishHydration(decide);
  }, []);
  const ghostPlans = useMemo(() => {
    return plans.filter(p => ghostPlanIds.includes(p.id) && p.id !== activePlanId);
  }, [plans, ghostPlanIds, activePlanId]);

  const orderedDays = useMemo(
    () => calendarDayOrder(showWeekends, weekStart),
    [showWeekends, weekStart]
  );
  const days = useMemo(() => {
    if (!isPhone || mobileCalendarView !== 'day') return orderedDays;
    const selected = orderedDays.find((day) => day.id === selectedDay);
    return selected ? [selected] : orderedDays.slice(0, 1);
  }, [orderedDays, isPhone, mobileCalendarView, selectedDay]);

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

  // Auto fits the active plan and ghosts. Custom keeps the saved window and only expands
  // when a class would otherwise be cropped.
  const { effectiveStartHour, effectiveEndHour } = useMemo(() => {
    if (timeRangeMode === 'auto') {
      const fitted = computeAutoFitRange(coursesForVisibleRange(activePlan?.courses, ghostPlans));
      if (fitted) return { effectiveStartHour: fitted.startHour, effectiveEndHour: fitted.endHour };
    }

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
  }, [timeRangeMode, startHour, endHour, activePlan?.courses, ghostPlans]);

  // Total grid minutes and dimensions
  const numHours = Math.max(1, effectiveEndHour - effectiveStartHour);
  
  const HOUR_MIN_PX = isPhone && mobileCalendarView === 'week' ? 40 : 55;
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
      const layout = computeDayLayout(items);
      const phoneWeek = isPhone && mobileCalendarView === 'week';
      const cascaded = phoneWeek
        ? layout.map((item) => {
            if (item.isGhost || item.totalCols <= 1) return item;
            const sharesLaneWithGhost = layout.some(
              (other) => other.isGhost && checkSessionCollision(item.session, other.session)
            );
            if (sharesLaneWithGhost) return item;
            return { ...item, cascadeIndex: item.colIndex, colIndex: 0, totalCols: 1 };
          })
        : layout;
      map.set(dayObj.id, cascaded);
    });

    return map;
  }, [days, activePlan, ghostPlans, conflictingCourseIds, planIndexMap, isPhone, mobileCalendarView]);

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

  const gutterWidth = isPhone
    ? (containerWidth < 340 ? 42 : 48)
    : containerWidth < 400 ? 56 : containerWidth < 640 ? 60 : 64;
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
  const phoneWeek = isPhone && mobileCalendarView === 'week';
  const phoneDay = isPhone && mobileCalendarView === 'day';

  const swipeLock = useRef(0);
  const shiftDay = (direction: -1 | 1) => {
    const index = orderedDays.findIndex((day) => day.id === selectedDay);
    const next = orderedDays[index + direction];
    if (next) setSelectedDay(next.id);
  };

  const zoomToDay = (day: DayOfWeek) => {
    setSelectedDay(day);
    setMobileCalendarView('day');
  };

  return (
    <div
      ref={containerRef}
      id="calendar-grid-container"
      className="flex-1 flex flex-col min-w-0 w-full max-w-full bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200 dark:border-slate-800 overflow-hidden relative z-0 isolate"
    >
      {isPhone && mobileCalendarView === 'day' && (
        <div className="up-cal-switch-bar">
          <div className="up-day-strip" role="tablist" aria-label="Day">
            {orderedDays.map((day) => (
              <button
                key={day.id}
                type="button"
                role="tab"
                aria-selected={day.id === days[0]?.id}
                aria-label={day.full}
                className={`up-day-strip-btn up-chrome-btn${day.id === days[0]?.id ? ' is-selected' : ''}`}
                onClick={() => setSelectedDay(day.id)}
              >
                <span className={`up-phone-day-name${day.id === days[0]?.id ? ' is-today' : ''}`}>{day.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {welcomeOpen && (
        <EmptyStateCard
          onClose={() => setWelcomeOpen(false)}
          onQuickAdd={() => onOpenNewCourse?.('quick')}
          onImport={() => onOpenImport?.()}
          onLoadDemo={() => onLoadDemo?.()}
        />
      )}
      {/* Scrollable Container with sticky header for 100% pixel-perfect column alignment */}
      <motion.div
        className="flex flex-1 min-h-0 flex-col"
        data-day-swipe={isPhone && mobileCalendarView === 'day' ? 'true' : undefined}
        style={{ touchAction: isPhone && mobileCalendarView === 'day' ? 'pan-y' : undefined }}
        drag={isPhone && mobileCalendarView === 'day' ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        dragMomentum={false}
        onPanEnd={isPhone && mobileCalendarView === 'day' ? (_, info) => {
          const now = Date.now();
          if (now - swipeLock.current < 400 || Math.abs(info.offset.x) < 48) return;
          swipeLock.current = now;
          shiftDay(info.offset.x < 0 ? 1 : -1);
        } : undefined}
        onDragEnd={isPhone && mobileCalendarView === 'day' ? (_, info) => {
          const now = Date.now();
          if (now - swipeLock.current < 400 || Math.abs(info.offset.x) < 48) return;
          swipeLock.current = now;
          shiftDay(info.offset.x < 0 ? 1 : -1);
        } : undefined}
      >
      <div
        className={`up-scroll flex-1 overflow-y-auto ${
          needsHorizontalScroll ? 'overflow-x-auto' : 'overflow-x-hidden'
        } relative flex flex-col w-full max-w-full`}
      >
        <div
          className="flex flex-col flex-1 min-h-0 w-full"
          style={{ minWidth: minGridWidth ? `${minGridWidth}px` : '100%' }}
        >
          {/* Day headers. Phone day view already has the Mon–Fri strip, so this row is omitted. */}
          {!phoneDay && (
          <div className={`flex sticky top-0 z-30 w-full max-w-full ${
            phoneWeek
              ? 'up-phone-week-head'
              : 'border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shadow-2xs'
          }`}>
          {/* Top-left corner time label */}
          <div
            style={{ width: `${gutterWidth}px` }}
            className={`h-11 shrink-0 flex items-center justify-center select-none sticky left-0 z-40 ${
              phoneWeek
                ? 'up-phone-gutter'
                : 'border-r border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950'
            }`}
          >
            {!isPhone && <Clock className="w-3.5 h-3.5" />}
          </div>

          {/* Days header columns */}
          <div
            className={`flex-1 grid min-w-0 ${phoneWeek ? '' : 'divide-x divide-slate-200 dark:divide-slate-800'}`}
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
                  role={phoneWeek ? 'button' : undefined}
                  tabIndex={phoneWeek ? 0 : undefined}
                  onClick={phoneWeek ? () => zoomToDay(day.id) : undefined}
                  onKeyDown={phoneWeek ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      zoomToDay(day.id);
                    }
                  } : undefined}
                  title={day.full}
                  aria-label={
                    sessionCount > 0
                      ? `${day.full}, ${sessionCount} ${sessionCount === 1 ? 'class' : 'classes'}`
                      : day.full
                  }
                  className={`h-11 flex items-center select-none ${
                    phoneWeek
                      ? 'up-phone-day-cell justify-center'
                      : colWidth < 68
                      ? 'justify-center px-1'
                      : 'justify-between px-2 sm:px-3'
                  } ${
                    !phoneWeek && isToday ? 'bg-indigo-50/90 dark:bg-transparent border-b-2 border-indigo-600 dark:border-[var(--up-accent)]' : ''
                  }`}
                >
                  {phoneWeek ? (
                    <span className={`up-phone-day-name${isToday ? ' is-today' : ''}`}>{day.label}</span>
                  ) : (
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
                          ? 'text-indigo-700 dark:text-[var(--up-accent)]'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {responsiveDayFormat === 'short' && day.short}
                      {responsiveDayFormat === 'label' && day.label}
                      {responsiveDayFormat === 'full' && day.full}
                    </span>
                  </div>
                  )}

                  {/* Session count: words when the column is wide, a labeled dot when it is narrow */}
                  {!phoneWeek && sessionCount > 0 && colWidth >= 85 && (
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                      {sessionCount} {sessionCount === 1 ? 'class' : 'classes'}
                    </span>
                  )}
                  {!phoneWeek && sessionCount > 0 && colWidth < 85 && colWidth >= 52 && (
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
          )}

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
            className={`shrink-0 self-stretch select-none sticky left-0 z-20 ${
              isPhone
                ? `up-phone-time-gutter${phoneWeek ? ' is-week' : ''}`
                : 'border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'
            }`}
          >
            {hourMarks.map((hour, idx) => {
              const timeStr = isPhone || gutterWidth < 62
                ? formatAxisHour(hour)
                : minutesToTime(hour * 60, true);
              const topPct = (idx / numHours) * 100;
              const isFirst = idx === 0;
              const isLast = idx === numHours;

              return (
                <div
                  key={hour}
                  style={{ top: `${topPct}%` }}
                  className={`absolute select-none pointer-events-none whitespace-nowrap leading-none ${
                    isPhone
                      ? 'up-phone-hour'
                      : `right-1 sm:right-2 font-mono font-semibold text-slate-600 dark:text-slate-400 ${
                          colWidth < 68 ? 'text-[9px] sm:text-[9.5px]' : 'text-[10px]'
                        }`
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
                    isToday && !phoneWeek ? 'bg-indigo-500/[0.02] dark:bg-transparent' : ''
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
                      theme={theme}
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
      </motion.div>
    </div>
  );
});
