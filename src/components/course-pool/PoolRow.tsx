import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Course } from '../../types/schedule';
import { displayCourseColor } from '../../utils/courseColorDisplay';
import { displayCourseTitle } from '../../utils/courseIdentity';
import { formatSessionLines } from '../../utils/poolGroups';
import { Plus, Trash2, Edit2, X, MoreHorizontal } from 'lucide-react';

export interface PoolRowProps {
  item: Course;
  /** `single` is a whole course card; `section` is one line inside an expanded group. */
  variant: 'single' | 'section';
  inActivePlan: boolean;
  conflict: Course | null;
  confirmDelete: boolean;
  activePlanName: string | undefined;
  onEdit: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  onAddToPlan: (id: string) => void;
  onRemoveFromPlan: (id: string) => void;
}

function RowMenu({
  label,
  onEdit,
  onRemove,
}: {
  label: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [pos, setPos] = useState<{ right: number; top?: number; bottom?: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  const close = (restoreFocus: boolean) => {
    setPos(null);
    if (restoreFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      close(true);
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setPos(null);
    };
    const dismiss = () => setPos(null);
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open]);

  const toggle = () => {
    if (open) return close(false);
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const right = window.innerWidth - rect.right;
    // Flip upward near the bottom edge so the menu is never cut off.
    setPos(
      rect.bottom + 110 > window.innerHeight
        ? { right, bottom: window.innerHeight - rect.top + 4 }
        : { right, top: rect.bottom + 4 }
    );
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${label}`}
        title="More actions"
        className="up-pool-kebab up-chrome-btn"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {pos &&
        createPortal(
          <div ref={menuRef} className="up-pool-rowmenu" role="menu" style={pos}>
            <button
              type="button"
              role="menuitem"
              className="up-pool-menu-item up-chrome-btn"
              onClick={() => {
                setPos(null);
                onEdit();
              }}
            >
              <Edit2 className="w-3.5 h-3.5 shrink-0" />
              <span>Edit course</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="up-pool-menu-item is-danger up-chrome-btn"
              onClick={() => {
                setPos(null);
                onRemove();
              }}
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>Remove from pool</span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
}

export const PoolRow = React.memo(function PoolRow({
  item,
  variant,
  inActivePlan,
  conflict,
  confirmDelete,
  activePlanName,
  onEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onAddToPlan,
  onRemoveFromPlan,
}: PoolRowProps) {
  const visibleTitle = displayCourseTitle(item);
  const lines = formatSessionLines(item.sessions);
  const rooms = new Set(item.sessions.map((s) => s.room).filter((r): r is string => !!r && !/^tbd$/i.test(r)));
  const room = rooms.size === 1 ? [...rooms][0] : '';
  const sectionLabel = item.section ? `Sec ${item.section}` : 'Section';

  const times = (
    <div className="up-pool-times font-mono up-pool-meta">
      {lines.length === 0 ? <span>No meeting times</span> : lines.map((line) => <span key={line}>{line}</span>)}
    </div>
  );

  const actions = confirmDelete ? (
    <div className="up-pool-confirm">
      <button
        type="button"
        onClick={() => onConfirmDelete(item.id)}
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
    <div className="up-pool-trail">
      {conflict && !inActivePlan && (
        <span className="up-pool-conflict-tag" title={`Overlaps with ${conflict.code}`}>
          Overlaps
        </span>
      )}
      <RowMenu
        label={`${item.code}${item.section ? ` section ${item.section}` : ''}`}
        onEdit={() => onEdit(item.id)}
        onRemove={() => onRequestDelete(item.id)}
      />
      {inActivePlan ? (
        <button
          type="button"
          onClick={() => onRemoveFromPlan(item.id)}
          className="up-pool-toggle is-remove up-chrome-btn"
          title={`Remove ${item.code} from ${activePlanName ?? 'plan'}`}
          aria-label={`Remove ${item.code}${item.section ? ` section ${item.section}` : ''} from plan`}
        >
          <X className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onAddToPlan(item.id)}
          className={`up-pool-toggle is-add up-chrome-btn${conflict ? ' is-conflict' : ''}`}
          title={conflict ? `Overlaps with ${conflict.code}. Add anyway` : `Add ${item.code} to ${activePlanName ?? 'plan'}`}
          aria-label={`Add ${item.code}${item.section ? ` section ${item.section}` : ''} to plan`}
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  if (variant === 'section') {
    return (
      <div className={`up-pool-section group${inActivePlan ? ' is-in-plan' : ''}${conflict && !inActivePlan ? ' is-conflict' : ''}`}>
        <div className="up-pool-body">
          <span className="up-pool-sec-no font-mono">{sectionLabel}</span>
          {times}
          {(item.instructor || room) && (
            <div className="up-pool-meta truncate">{[item.instructor, room].filter(Boolean).join(' · ')}</div>
          )}
        </div>
        {actions}
      </div>
    );
  }

  return (
    <div className={`up-pool-row group${inActivePlan ? ' is-in-plan' : ''}${conflict && !inActivePlan ? ' is-conflict' : ''}`}>
      <div className="up-pool-one">
        <span className="up-pool-swatch" style={{ backgroundColor: displayCourseColor(item.color).bg }} />
        <div className="up-pool-body" title={item.instructor || undefined}>
          <div className="up-pool-l1">
            <span className="up-pool-code truncate">{item.code}</span>
            {visibleTitle && <span className="up-pool-title-sm truncate">{visibleTitle}</span>}
          </div>
          <div className="up-pool-l2 font-mono up-pool-meta">
            {lines.length === 0 ? 'No meeting times' : lines.join(' · ')}
            {item.credits ? ` · ${item.credits} cr` : ''}
          </div>
        </div>
        {actions}
      </div>
    </div>
  );
});
