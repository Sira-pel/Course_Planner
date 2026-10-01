/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import type { DayOfWeek, SchedulePlan } from '../../types/schedule';
import { useScheduleStore } from '../../store/useScheduleStore';

export interface UseAppShortcutsArgs {
  plans: SchedulePlan[];
  activePlanId: string;
  isMoreOpen: boolean;
  isConfirmingClear: boolean;
  onOpenNewCourse: (day?: DayOfWeek, startTime?: string, mode?: 'form' | 'quick') => void;
  onOpenExport: () => void;
  onOpenImport?: () => void;
  onOpenShare?: () => void;
  onTogglePool?: () => void;
  onToggleTheme?: () => void;
  onOpenHelp?: (initialTab?: 'workflow' | 'shortcuts') => void;
  onOpenShortcuts?: () => void;
  onDuplicatePlan: (planId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSetActivePlan: (planId: string) => void;
  onSetMoreOpen: (open: boolean) => void;
  onSetConfirmingClear: (open: boolean) => void;
  onCloseCourseModal: () => void;
  onCloseExport: () => void;
  onCloseImport?: () => void;
  onCloseHelp?: () => void;
  onCloseShortcuts?: () => void;
  onCloseShareImport?: () => void;
  onCollapsePool: () => void;
}

function isKeyMatch(e: KeyboardEvent, combo: string): boolean {
  if (combo === '?') {
    return e.key === '?';
  }
  if (combo === 'Escape') {
    return e.key === 'Escape';
  }

  const parts = combo.toLowerCase().split('+').map((p) => p.trim());
  const hasAlt = parts.includes('alt');
  const hasCtrl = parts.includes('ctrl') || parts.includes('cmd');
  const hasShift = parts.includes('shift');
  const keyPart = parts.find((p) => !['alt', 'ctrl', 'cmd', 'shift'].includes(p));

  if (Boolean(e.altKey) !== hasAlt) return false;
  if (Boolean(e.ctrlKey || e.metaKey) !== hasCtrl) return false;
  if (Boolean(e.shiftKey) !== hasShift) return false;

  if (!keyPart) return true;

  const eventKey = e.key.toLowerCase();
  const eventCode = e.code.toLowerCase();

  return (
    eventKey === keyPart ||
    eventCode === `key${keyPart}` ||
    eventCode === `digit${keyPart}`
  );
}

function getBinding(actionId: string, defaultKey: string): string {
  const custom = useScheduleStore.getState().customShortcuts;
  return custom?.[actionId] || defaultKey;
}

export function useAppShortcuts(args: UseAppShortcutsArgs): void {
  const argsRef = useRef(args);
  useEffect(() => {
    argsRef.current = args;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const {
        plans,
        activePlanId,
        isMoreOpen,
        isConfirmingClear,
        onOpenNewCourse,
        onOpenExport,
        onOpenImport,
        onOpenShare,
        onTogglePool,
        onToggleTheme,
        onOpenHelp,
        onOpenShortcuts,
        onDuplicatePlan,
        onUndo,
        onRedo,
        onSetActivePlan,
        onSetMoreOpen,
        onSetConfirmingClear,
        onCloseCourseModal,
        onCloseExport,
        onCloseImport,
        onCloseHelp,
        onCloseShortcuts,
        onCloseShareImport,
        onCollapsePool,
      } = argsRef.current;

      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // Escape always closes any open modal or menu
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
        onCloseImport?.();
        onCloseHelp?.();
        onCloseShortcuts?.();
        onCloseShareImport?.();
        onCollapsePool();
        return;
      }

      // Check customizable shortcuts with Alt modifier
      // 1. Add Course
      const addCourseKey = getBinding('add_course', 'Alt+N');
      if (isKeyMatch(e, addCourseKey)) {
        e.preventDefault();
        onOpenNewCourse('monday', '09:00', 'form');
        return;
      }

      // 2. Quick Add Course
      const quickAddKey = getBinding('quick_add', 'Alt+K');
      if (isKeyMatch(e, quickAddKey)) {
        e.preventDefault();
        onOpenNewCourse('monday', '09:00', 'quick');
        return;
      }

      // 3. Export
      const exportKey = getBinding('export', 'Alt+E');
      if (isKeyMatch(e, exportKey)) {
        e.preventDefault();
        onOpenExport();
        return;
      }

      // 4. Import
      const importKey = getBinding('import', 'Alt+I');
      if (isKeyMatch(e, importKey)) {
        e.preventDefault();
        onOpenImport?.();
        return;
      }

      // 5. Share
      const shareKey = getBinding('share', 'Alt+S');
      if (isKeyMatch(e, shareKey)) {
        e.preventDefault();
        onOpenShare?.();
        return;
      }

      // 6. Course Pool
      const poolKey = getBinding('pool', 'Alt+P');
      if (isKeyMatch(e, poolKey)) {
        e.preventDefault();
        onTogglePool?.();
        return;
      }

      // 7. Duplicate Plan
      const duplicateKey = getBinding('duplicate_plan', 'Alt+D');
      if (isKeyMatch(e, duplicateKey)) {
        e.preventDefault();
        onDuplicatePlan(activePlanId);
        return;
      }

      // 8. Toggle Theme
      const themeKey = getBinding('theme', 'Alt+T');
      if (isKeyMatch(e, themeKey)) {
        e.preventDefault();
        onToggleTheme?.();
        return;
      }

      // 9. Help & Guide
      const helpKey = getBinding('help', 'Alt+H');
      if (isKeyMatch(e, helpKey)) {
        e.preventDefault();
        if (onOpenHelp) onOpenHelp('workflow');
        else onOpenShortcuts?.();
        return;
      }

      // 10. Help Cheatsheet / Shortcuts: '?'
      if (e.key === '?') {
        if (!isInputFocused) {
          e.preventDefault();
          if (onOpenHelp) onOpenHelp('shortcuts');
          else onOpenShortcuts?.();
          return;
        }
      }

      // If user is actively typing in a text field, do not trigger single-key or Ctrl navigation shortcuts
      if (isInputFocused) return;

      // Undo / Redo
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) onRedo();
          else onUndo();
          return;
        }
        if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          onRedo();
          return;
        }
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
  }, []);
}
