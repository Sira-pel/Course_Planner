/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import type { SchedulePlan } from '../../types/schedule';
import { useScheduleStore } from '../../store/useScheduleStore';

export type ShortcutSurface =
  | 'course-form'
  | 'course-quick'
  | 'export'
  | 'share'
  | 'import'
  | 'help'
  | 'shortcuts'
  | 'pool';

export interface UseAppShortcutsArgs {
  plans?: SchedulePlan[];
  activePlanId: string;
  isMoreOpen: boolean;
  isConfirmingClear: boolean;
  isAnyModalOpen?: boolean;
  onModalShortcut: (surface: ShortcutSurface) => void;
  onToggleTheme?: () => void;
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
        activePlanId,
        isMoreOpen,
        isConfirmingClear,
        isAnyModalOpen,
        onModalShortcut,
        onToggleTheme,
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

      const runModalShortcut = (surface: ShortcutSurface) => {
        e.preventDefault();
        if (e.repeat) return;
        onModalShortcut(surface);
      };

      // Check customizable shortcuts with Alt modifier
      // 1. Add Course
      const addCourseKey = getBinding('add_course', 'Alt+N');
      if (isKeyMatch(e, addCourseKey)) {
        runModalShortcut('course-form');
        return;
      }

      // 2. Quick Add Course
      const quickAddKey = getBinding('quick_add', 'Alt+K');
      if (isKeyMatch(e, quickAddKey)) {
        runModalShortcut('course-quick');
        return;
      }

      // 3. Export
      const exportKey = getBinding('export', 'Alt+E');
      if (isKeyMatch(e, exportKey)) {
        runModalShortcut('export');
        return;
      }

      // 4. Import
      const importKey = getBinding('import', 'Alt+I');
      if (isKeyMatch(e, importKey)) {
        runModalShortcut('import');
        return;
      }

      // 5. Share
      const shareKey = getBinding('share', 'Alt+S');
      if (isKeyMatch(e, shareKey)) {
        runModalShortcut('share');
        return;
      }

      // 6. Course Pool
      const poolKey = getBinding('pool', 'Alt+P');
      if (isKeyMatch(e, poolKey)) {
        runModalShortcut('pool');
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

      // 9. Help
      const helpKey = getBinding('help', 'Alt+H');
      if (isKeyMatch(e, helpKey)) {
        runModalShortcut('help');
        return;
      }

      // 10. Help Cheatsheet / Shortcuts: '?'
      if (e.key === '?') {
        if (!isInputFocused) {
          runModalShortcut('shortcuts');
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

      // Number keys 1-9 to switch plans (only when no modal is open and without modifiers)
      if (!isAnyModalOpen && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const num = parseInt(e.key, 10);
        const currentPlans = useScheduleStore.getState().plans;
        if (!isNaN(num) && num >= 1 && num <= currentPlans.length) {
          e.preventDefault();
          onSetActivePlan(currentPlans[num - 1].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
