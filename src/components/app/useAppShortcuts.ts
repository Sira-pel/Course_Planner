/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import type { DayOfWeek, SchedulePlan } from '../../types/schedule';

export interface UseAppShortcutsArgs {
  plans: SchedulePlan[];
  activePlanId: string;
  isMoreOpen: boolean;
  isConfirmingClear: boolean;
  onOpenNewCourse: (day?: DayOfWeek, startTime?: string, mode?: 'form' | 'quick') => void;
  onOpenExport: () => void;
  onOpenShortcuts: () => void;
  onDuplicatePlan: (planId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSetActivePlan: (planId: string) => void;
  onSetMoreOpen: (open: boolean) => void;
  onSetConfirmingClear: (open: boolean) => void;
  onCloseCourseModal: () => void;
  onCloseExport: () => void;
  onCloseShortcuts: () => void;
  onCollapsePool: () => void;
}

export function useAppShortcuts({
  plans,
  activePlanId,
  isMoreOpen,
  isConfirmingClear,
  onOpenNewCourse,
  onOpenExport,
  onOpenShortcuts,
  onDuplicatePlan,
  onUndo,
  onRedo,
  onSetActivePlan,
  onSetMoreOpen,
  onSetConfirmingClear,
  onCloseCourseModal,
  onCloseExport,
  onCloseShortcuts,
  onCollapsePool,
}: UseAppShortcutsArgs): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input or textarea
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // Escape always closes any open modal. If pool search has text, the
      // input handler clears it and stops this listener.
      if (e.key === 'Escape') {
        if (
          target instanceof HTMLInputElement &&
          target.classList.contains('up-pool-input') &&
          target.value.trim() !== ''
        ) {
          return;
        }
        if (isMoreOpen) {
          if (isConfirmingClear) onSetConfirmingClear(false);
          else onSetMoreOpen(false);
          return;
        }
        onCloseCourseModal();
        onCloseExport();
        onCloseShortcuts();
        onCollapsePool();
        return;
      }

      // If user is actively typing in a text field, do not trigger single-key or Ctrl shortcuts (except undo in text)
      if (isInputFocused) return;

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          onOpenNewCourse('monday', '09:00', 'form');
        } else if (e.key.toLowerCase() === 'k') {
          e.preventDefault();
          onOpenNewCourse('monday', '09:00', 'quick');
        } else if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          onDuplicatePlan(activePlanId);
        } else if (e.key.toLowerCase() === 'e') {
          e.preventDefault();
          onOpenExport();
        } else if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            onRedo();
          } else {
            onUndo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          onRedo();
        }
        return;
      }

      // Help cheatsheet: '?'
      if (e.key === '?') {
        e.preventDefault();
        onOpenShortcuts();
        return;
      }

      // Quick key 'A' for add course
      if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onOpenNewCourse('monday', '09:00', 'form');
        return;
      }

      // Number keys 1-9 to switch plans
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= plans.length) {
        e.preventDefault();
        onSetActivePlan(plans[num - 1].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activePlanId,
    plans,
    onOpenNewCourse,
    onOpenExport,
    onOpenShortcuts,
    onDuplicatePlan,
    onUndo,
    onRedo,
    onSetActivePlan,
    isMoreOpen,
    isConfirmingClear,
    onSetMoreOpen,
    onSetConfirmingClear,
    onCloseCourseModal,
    onCloseExport,
    onCloseShortcuts,
    onCollapsePool,
  ]);
}
