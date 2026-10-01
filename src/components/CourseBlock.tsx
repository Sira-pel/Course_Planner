import React, { memo } from 'react';
import { LayoutSession, GHOST_PLAN_COLORS } from '../types/schedule';
import { getContrastTextColor, minutesToTime, timeToMinutes } from '../utils/timeUtils';
import { AlertTriangle, Edit2, Trash2, MapPin, User } from 'lucide-react';

interface CourseBlockProps {
  layout: LayoutSession;
  startHour: number;
  totalMinutes: number;
  onEdit: (courseId: string, planId?: string) => void;
  onDelete: (courseId: string, planId?: string) => void;
}

export const CourseBlock = memo(function CourseBlock({
  layout,
  startHour,
  totalMinutes,
  onEdit,
  onDelete,
}: CourseBlockProps) {
  const { session, course, isGhost, ghostIndex = 0, planName, planId, colIndex, totalCols, hasConflict } = layout;

  const startMin = timeToMinutes(session.startTime);
  const endMin = timeToMinutes(session.endTime);
  const gridStartMin = startHour * 60;
  const gridEndMin = gridStartMin + totalMinutes;

  // Safe clamping to avoid overflow out of day column
  const renderStartMin = Math.max(gridStartMin, Math.min(gridEndMin - 15, startMin));
  const renderEndMin = Math.min(gridEndMin, Math.max(renderStartMin + 20, endMin));

  // Percentage positioning inside day column
  const topPercent = Math.max(0, Math.min(97.5, ((renderStartMin - gridStartMin) / totalMinutes) * 100));
  const heightPercent = Math.max(2.5, Math.min(100 - topPercent, ((renderEndMin - renderStartMin) / totalMinutes) * 100));

  // Width & left positioning for side-by-side overlaps
  const safeTotalCols = Math.max(1, totalCols);
  const safeColIndex = Math.max(0, Math.min(safeTotalCols - 1, colIndex));
  const widthPercent = 100 / safeTotalCols;
  const leftPercent = safeColIndex * widthPercent;

  const durationMin = Math.max(15, endMin - startMin);
  const isShortBlock = durationMin < 50;
  const isMediumBlock = durationMin >= 50 && durationMin < 80;

  // Ghost block styling
  if (isGhost) {
    const ghostStyle = GHOST_PLAN_COLORS[ghostIndex % GHOST_PLAN_COLORS.length];
    return (
      <div
        id={`ghost-block-${course.id}-${session.id}`}
        onClick={() => {
          onEdit(course.id, planId);
        }}
        className={`group absolute rounded-lg border-2 border-dashed ${ghostStyle.border} ${ghostStyle.bg} backdrop-blur-[2px] transition-[box-shadow,filter] duration-150 cursor-pointer hover:shadow-md hover:brightness-105 p-2 overflow-hidden select-none z-10 active:scale-95`}
        style={{
          top: `${topPercent}%`,
          height: `calc(${heightPercent}% - 2px)`,
          left: `calc(${leftPercent}% + 1px)`,
          width: `calc(${widthPercent}% - 2px)`,
        }}
        title={`[Comparing: ${planName}] ${course.code} - ${course.name} (Click to edit in ${planName})`}
      >
        {/* Top row: Code + Section and Quick Actions / Plan Badge */}
        <div className="flex items-start justify-between gap-1 leading-none">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-extrabold text-xs tracking-tight truncate text-slate-800 dark:text-slate-100">
              {course.section ? `${course.code}-${course.section}` : course.code}
            </span>
            {hasConflict && (
              <span
                title="Schedule Collision Detected"
                className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded shadow-xs shrink-0"
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                Conflict
              </span>
            )}
          </div>

          {/* Plan badge (visible when not hovered, cleanly hides on hover to make room for actions) */}
          <span
            className={`group-hover:hidden inline-flex items-center text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase truncate max-w-[85px] shrink-0 ${ghostStyle.text} bg-white/90 dark:bg-slate-900/90 shadow-2xs border border-current/20`}
            title={planName}
          >
            {planName}
          </span>

          {/* Hover Action Buttons - identical in style, sizing and behavior to normal course blocks */}
          <div className="hidden group-hover:flex items-center gap-1 shrink-0 -mr-0.5 -mt-0.5 bg-slate-900/80 dark:bg-black/80 backdrop-blur-xs rounded px-1 py-0.5 shadow-xs">
            <button
              type="button"
              id={`btn-edit-ghost-${course.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(course.id, planId);
              }}
              title={`Edit Course in ${planName}`}
              className="p-0.5 text-white hover:text-amber-200 transition-colors"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              id={`btn-delete-ghost-${course.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(course.id, planId);
              }}
              title={`Remove Course from ${planName}`}
              className="p-0.5 text-white hover:text-red-200 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Course Name */}
        {!isShortBlock && (
          <div className="text-xs font-semibold truncate mt-1 leading-tight text-slate-700 dark:text-slate-200">
            {course.name}
          </div>
        )}

        {/* Time & Details */}
        <div className="text-[10.5px] font-mono mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-tight text-slate-600 dark:text-slate-400">
          <span>
            {minutesToTime(startMin)} - {minutesToTime(endMin)}
          </span>
          {session.room && !isShortBlock && (
            <span className="inline-flex items-center gap-0.5 truncate font-sans">
              <MapPin className="w-2.5 h-2.5 shrink-0 opacity-80" />
              {session.room}
            </span>
          )}
        </div>

        {/* Plan attribution footer (always visible when height permits) */}
        {!isShortBlock && (
          <div className="text-[10px] font-medium truncate mt-1 flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: ghostStyle.dot }}
            />
            <span className="truncate">{planName}</span>
          </div>
        )}
      </div>
    );
  }

  // Active Plan Course Block
  const contrastText = getContrastTextColor(course.color);
  const isLightText = contrastText === 'text-white';
  const subtitleColor = isLightText ? 'text-white/85' : 'text-slate-900/80';
  const subtextColor = isLightText ? 'text-white/75' : 'text-slate-900/70';

  return (
    <div
      id={`course-block-${course.id}-${session.id}`}
      onClick={() => onEdit(course.id, planId)}
      className={`group absolute rounded-lg transition-[box-shadow,filter,border-color] duration-150 cursor-pointer select-none p-2 overflow-hidden shadow-xs hover:shadow-md hover:z-30 hover:brightness-[1.04] ${
        hasConflict
          ? 'ring-2 ring-inset ring-red-500 animate-pulse'
          : 'border border-black/15 dark:border-white/20 hover:border-black/30 dark:hover:border-white/40'
      }`}
      style={{
        backgroundColor: course.color,
        top: `${topPercent}%`,
        height: `calc(${heightPercent}% - 2px)`,
        left: `calc(${leftPercent}% + 1px)`,
        width: `calc(${widthPercent}% - 2px)`,
        zIndex: 20 + colIndex,
      }}
    >
      {/* Top row: Code + Section and Quick Actions */}
      <div className="flex items-start justify-between gap-1 leading-none">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`font-extrabold text-xs tracking-tight truncate ${contrastText}`}>
            {course.section ? `${course.code}-${course.section}` : course.code}
          </span>
          {hasConflict && (
            <span
              title="Schedule Collision Detected"
              className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded shadow-xs shrink-0"
            >
              <AlertTriangle className="w-2.5 h-2.5" />
              Conflict
            </span>
          )}
        </div>

        {/* Hover Action Buttons */}
        <div className="hidden group-hover:flex items-center gap-1 shrink-0 -mr-0.5 -mt-0.5 bg-black/20 backdrop-blur-xs rounded px-1 py-0.5">
          <button
            type="button"
            id={`btn-edit-${course.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(course.id, planId);
            }}
            title="Edit Course"
            className="p-0.5 text-white hover:text-amber-200 transition-colors"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            type="button"
            id={`btn-delete-${course.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(course.id, planId);
            }}
            title="Remove from Plan"
            className="p-0.5 text-white hover:text-red-200 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Course Name */}
      {!isShortBlock && (
        <div className={`text-xs font-semibold truncate mt-1 leading-tight ${subtitleColor}`}>
          {course.name}
        </div>
      )}

      {/* Time & Details */}
      <div className={`text-[10.5px] font-mono mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-tight ${subtextColor}`}>
        <span>
          {minutesToTime(startMin)} - {minutesToTime(endMin)}
        </span>
        {session.room && !isShortBlock && (
          <span className="inline-flex items-center gap-0.5 truncate font-sans">
            <MapPin className="w-2.5 h-2.5 shrink-0 opacity-80" />
            {session.room}
          </span>
        )}
      </div>

      {/* Instructor if room permits */}
      {!isShortBlock && !isMediumBlock && course.instructor && (
        <div className={`text-[10px] font-medium truncate mt-1 inline-flex items-center gap-0.5 ${subtextColor}`}>
          <User className="w-2.5 h-2.5 shrink-0 opacity-80" />
          {course.instructor}
        </div>
      )}
    </div>
  );
});
