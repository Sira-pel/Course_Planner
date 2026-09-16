import React from 'react';
import { motion } from 'motion/react';
import type { Course } from '../../types/schedule';
import { minutesToTime, timeToMinutes } from '../../utils/timeUtils';
import { Check, Trash2, Edit2, AlertTriangle, X, Plus } from 'lucide-react';
import { EASE_OUT } from '../../utils/motion';

export interface PoolRowProps {
  item: Course;
  inActivePlan: boolean;
  conflict: Course | null;
  confirmDelete: boolean;
  stagger: boolean;
  index: number;
  reduceMotion: boolean | null;
  activePlanName: string | undefined;
  onEdit: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onAddToPlan: () => void;
  onRemoveFromPlan: () => void;
}

export const PoolRow: React.FC<PoolRowProps> = ({
  item,
  inActivePlan,
  conflict,
  confirmDelete,
  stagger,
  index,
  activePlanName,
  onEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onAddToPlan,
  onRemoveFromPlan,
}) => {
  return (
    <motion.div
      className="up-pool-row group"
      initial={stagger ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={
        stagger
          ? { duration: 0.2, ease: EASE_OUT, delay: index * 0.04 }
          : { duration: 0 }
      }
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="up-pool-swatch" style={{ backgroundColor: item.color }} />
          <span className="up-pool-code truncate">{item.code}</span>
          {item.section && (
            <span className="up-pool-meta font-mono">Sec {item.section}</span>
          )}
          {item.credits ? (
            <span className="up-pool-meta font-mono">{item.credits} cr</span>
          ) : null}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onConfirmDelete}
                className="up-pool-text-btn up-chrome-btn text-rose-600 dark:text-rose-400"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={onCancelDelete}
                className="up-icon-btn up-chrome-btn up-pool-icon-hit"
                aria-label="Cancel delete"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="up-pool-row-actions flex items-center gap-0.5">
              <button
                type="button"
                onClick={onEdit}
                title="Edit course"
                aria-label={`Edit ${item.code}`}
                className="up-icon-btn up-chrome-btn up-pool-icon-hit"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onRequestDelete}
                title="Remove from pool"
                aria-label={`Remove ${item.code} from pool`}
                className="up-icon-btn up-chrome-btn up-pool-icon-hit"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <h3 className="text-xs mt-0.5 leading-snug line-clamp-1" style={{ color: 'var(--up-ink)' }}>
        {item.name}
      </h3>

      <div className="mt-1.5 space-y-0.5 font-mono up-pool-meta">
        {item.sessions.map((s, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <span className="capitalize">
              {s.day.slice(0, 3)}{' '}
              {minutesToTime(timeToMinutes(s.startTime))} - {minutesToTime(timeToMinutes(s.endTime))}
            </span>
            {s.room && (
              <span className="font-sans truncate max-w-[90px]">{s.room}</span>
            )}
          </div>
        ))}
      </div>

      {item.instructor && (
        <div className="mt-1 up-pool-meta truncate">{item.instructor}</div>
      )}

      {conflict && (
        <div className="up-pool-conflict">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span className="truncate">
            Overlaps with <strong>{conflict.code}</strong>
          </span>
        </div>
      )}

      <div className="mt-2.5 pt-2 flex items-center justify-between gap-2" style={{ borderTop: '1px solid var(--up-line)' }}>
        {inActivePlan ? (
          <>
            <span className="up-pool-status">
              <Check className="w-3.5 h-3.5" />
              In plan
            </span>
            <button
              type="button"
              onClick={onRemoveFromPlan}
              className="up-pool-text-btn up-chrome-btn"
              title="Remove this class from the current timetable"
            >
              Remove from plan
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onAddToPlan}
            className="up-pool-add up-chrome-btn"
            title={`Add ${item.code} to ${activePlanName}`}
          >
            <Plus className="w-3.5 h-3.5" />
            Add to plan
          </button>
        )}
      </div>
    </motion.div>
  );
};
