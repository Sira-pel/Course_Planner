import type { Course, DayOfWeek } from '../../types/schedule';
import { DAYS_LIST } from '../../types/schedule';
import { displayCourseColor } from '../../utils/courseColorDisplay';
import { timeToMinutes } from '../../utils/timeUtils';

const WEEKDAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

interface PreviewBlock {
  key: string;
  day: DayOfWeek;
  start: number;
  end: number;
  color: string;
  label: string;
}

export function MiniWeekPreview({
  courses,
  lunch,
  tall = false,
}: {
  courses: Course[];
  lunch: { start: number; end: number } | null;
  tall?: boolean;
}) {
  const blocks: PreviewBlock[] = [];
  for (const course of courses) {
    const color = displayCourseColor(course.color).bg;
    for (const session of course.sessions || []) {
      const start = timeToMinutes(session.startTime);
      const end = timeToMinutes(session.endTime);
      if (end <= start) continue;
      blocks.push({
        key: session.id,
        day: session.day,
        start,
        end,
        color,
        label: `${course.code} ${session.startTime}–${session.endTime}`,
      });
    }
  }

  const used = new Set(blocks.map((block) => block.day));
  const days = DAYS_LIST.filter((day) => {
    if (WEEKDAYS.includes(day.id)) return true;
    return used.has(day.id);
  });

  let rangeStart = Infinity;
  let rangeEnd = -Infinity;
  for (const block of blocks) {
    rangeStart = Math.min(rangeStart, block.start);
    rangeEnd = Math.max(rangeEnd, block.end);
  }
  if (lunch && lunch.end > lunch.start) {
    rangeStart = Math.min(rangeStart, lunch.start);
    rangeEnd = Math.max(rangeEnd, lunch.end);
  }
  if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd <= rangeStart) {
    rangeStart = 8 * 60;
    rangeEnd = 18 * 60;
  }
  rangeStart = Math.max(0, rangeStart - 20);
  rangeEnd = Math.min(24 * 60, rangeEnd + 20);
  if (rangeEnd - rangeStart < 180) {
    const mid = (rangeStart + rangeEnd) / 2;
    rangeStart = Math.max(0, mid - 90);
    rangeEnd = Math.min(24 * 60, rangeStart + 180);
  }
  const span = rangeEnd - rangeStart;

  const lunchTop = lunch && lunch.end > lunch.start
    ? ((Math.max(lunch.start, rangeStart) - rangeStart) / span) * 100
    : null;
  const lunchHeight = lunch && lunch.end > lunch.start
    ? ((Math.min(lunch.end, rangeEnd) - Math.max(lunch.start, rangeStart)) / span) * 100
    : null;

  return (
    <div className="up-gen-week" aria-hidden="true">
      <div
        className="up-gen-week-days"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {days.map((day) => (
          <span key={day.id}>{day.short}</span>
        ))}
      </div>
      <div className={`up-gen-week-grid ${tall ? 'is-tall' : ''}`}>
        {lunchTop != null && lunchHeight != null && lunchHeight > 0 && (
          <div
            className="up-gen-hatch"
            style={{ top: `${lunchTop}%`, height: `${lunchHeight}%` }}
          />
        )}
        <div
          className="up-gen-week-cols"
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
        >
          {days.map((day) => (
            <div key={day.id} className="up-gen-week-col">
              {blocks.filter((block) => block.day === day.id).map((block) => {
                const top = ((block.start - rangeStart) / span) * 100;
                const height = Math.max(6, ((block.end - block.start) / span) * 100);
                return (
                  <span
                    key={block.key}
                    className="up-gen-week-block"
                    title={block.label}
                    style={{
                      top: `${top}%`,
                      height: `${height}%`,
                      background: block.color,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
