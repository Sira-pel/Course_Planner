/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { useReducedMotion } from 'motion/react';
import { useScheduleStore } from './store/useScheduleStore';
import { Header } from './components/Header';
import { CalendarGrid } from './components/CalendarGrid';
import { CourseModal } from './components/CourseModal';
import { ExportModal } from './components/ExportModal';
import { CoursePoolSidebar } from './components/CoursePoolSidebar';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { StorageWriteBanner } from './components/StorageWriteBanner';
import { MobileDock } from './components/app/MobileDock';
import { useAppShortcuts } from './components/app/useAppShortcuts';
import { DayOfWeek } from './types/schedule';

export default function App() {
  const {
    plans,
    activePlanId,
    catalogCourses,
    setActivePlan,
    duplicatePlan,
    undo,
    redo,
    resetToBlank,
    resetToSample,
  } = useScheduleStore();

  // Modals & Sidebar state
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [modalInitialDay, setModalInitialDay] = useState<DayOfWeek>('monday');
  const [modalInitialStartTime, setModalInitialStartTime] = useState<string>('09:00');
  const [modalInitialMode, setModalInitialMode] = useState<'form' | 'quick'>('form');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPoolCollapsed, setIsPoolCollapsed] = useState(true);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const closeMoreMenu = useCallback(() => {
    setIsMoreOpen(false);
    setIsConfirmingClear(false);
  }, []);

  const handleCloseCourseModal = useCallback(() => setIsCourseModalOpen(false), []);
  const handleCloseExport = useCallback(() => setIsExportOpen(false), []);
  const handleCloseShortcuts = useCallback(() => setIsShortcutsOpen(false), []);
  const handleCollapsePool = useCallback(() => setIsPoolCollapsed(true), []);

  // Handler for opening new course modal
  const handleOpenNewCourse = useCallback(
    (day: DayOfWeek = 'monday', startTime: string = '09:00', mode: 'form' | 'quick' = 'form') => {
      setIsPoolCollapsed(true);
      setEditingCourseId(null);
      setModalInitialDay(day);
      setModalInitialStartTime(startTime);
      setModalInitialMode(mode);
      setIsCourseModalOpen(true);
    },
    []
  );

  // Handler for editing an existing course
  const handleEditCourse = useCallback((courseId: string) => {
    setIsPoolCollapsed(true);
    setEditingCourseId(courseId);
    setModalInitialMode('form');
    setIsCourseModalOpen(true);
  }, []);

  const handleOpenExport = useCallback(() => {
    setIsPoolCollapsed(true);
    setIsExportOpen(true);
  }, []);

  const handleOpenShortcuts = useCallback(() => {
    setIsPoolCollapsed(true);
    setIsShortcutsOpen(true);
  }, []);

  const handleToggleMore = useCallback(() => {
    setIsConfirmingClear(false);
    setIsMoreOpen((open) => !open);
  }, []);

  const handleRequestClear = useCallback(() => {
    setIsConfirmingClear(true);
  }, []);

  const handleCancelClear = useCallback(() => {
    setIsConfirmingClear(false);
  }, []);

  const handleConfirmClearDock = useCallback(() => {
    resetToBlank();
    closeMoreMenu();
  }, [resetToBlank, closeMoreMenu]);

  const handleLoadDemo = useCallback(() => {
    resetToSample();
  }, [resetToSample]);

  const handleTogglePool = useCallback(() => {
    setIsPoolCollapsed((prev) => !prev);
  }, []);

  const handleOpenCatalog = useCallback(() => {
    setIsPoolCollapsed(false);
  }, []);

  const handleOpenNewCourseFromHeader = useCallback(
    (mode?: 'form' | 'quick') => handleOpenNewCourse('monday', '09:00', mode || 'form'),
    [handleOpenNewCourse]
  );

  const handleAddCourseAtTime = useCallback(
    (day: DayOfWeek, time: string) => handleOpenNewCourse(day, time, 'form'),
    [handleOpenNewCourse]
  );

  const handleAddCourseDefault = useCallback(() => {
    handleOpenNewCourse('monday', '09:00', 'form');
  }, [handleOpenNewCourse]);

  useAppShortcuts({
    plans,
    activePlanId,
    isMoreOpen,
    isConfirmingClear,
    onOpenNewCourse: handleOpenNewCourse,
    onOpenExport: handleOpenExport,
    onOpenShortcuts: handleOpenShortcuts,
    onDuplicatePlan: duplicatePlan,
    onUndo: undo,
    onRedo: redo,
    onSetActivePlan: setActivePlan,
    onSetMoreOpen: setIsMoreOpen,
    onSetConfirmingClear: setIsConfirmingClear,
    onCloseCourseModal: handleCloseCourseModal,
    onCloseExport: handleCloseExport,
    onCloseShortcuts: handleCloseShortcuts,
    onCollapsePool: handleCollapsePool,
  });

  return (
    <div className="up-app bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col w-full max-w-full min-w-0">
      <StorageWriteBanner />
      <main className="up-workspace flex-1 max-w-[1720px] w-full min-w-0 mx-auto p-2.5 sm:p-4 md:p-5 flex flex-col gap-2.5 sm:gap-3 min-h-0 overflow-x-clip">
        {/* Header: brand, enrolled readout, plans, compare, settings */}
        <Header
          onOpenNewCourse={handleOpenNewCourseFromHeader}
          onOpenExport={handleOpenExport}
          onOpenShortcuts={handleOpenShortcuts}
          onOpenCatalog={handleOpenCatalog}
        />

        {/* Workspace: Calendar Grid and Course Pool Sidebar */}
        <div className="up-workspace-body flex-1 flex flex-col lg:flex-row gap-3 min-h-0 min-w-0 items-stretch">
          {/* Main Weekly Calendar Grid */}
          <div className="up-calendar-slot flex-1 min-w-0 max-w-full flex flex-col min-h-0 relative overflow-x-auto">
            <CalendarGrid
              onEditCourse={handleEditCourse}
              onAddCourseAtTime={handleAddCourseAtTime}
              onOpenNewCourse={handleOpenNewCourseFromHeader}
            />
          </div>

          {/* Course Pool Sidebar on the right (bottom on mobile, drawer on tablet) */}
          <CoursePoolSidebar
            isCollapsed={isPoolCollapsed}
            onToggleCollapse={handleTogglePool}
            onOpenNewCourse={handleOpenNewCourseFromHeader}
            onEditCourse={handleEditCourse}
          />
        </div>
      </main>

      <MobileDock
        isMoreOpen={isMoreOpen}
        isConfirmingClear={isConfirmingClear}
        catalogCount={catalogCourses.length}
        reduceMotion={reduceMotion}
        onToggleMore={handleToggleMore}
        onTogglePool={handleTogglePool}
        onAddCourse={handleAddCourseDefault}
        onLoadDemo={handleLoadDemo}
        onOpenShortcuts={handleOpenShortcuts}
        onRequestClear={handleRequestClear}
        onConfirmClear={handleConfirmClearDock}
        onCancelClear={handleCancelClear}
        onCloseMoreMenu={closeMoreMenu}
      />

      {/* Modal Dialogs */}
      <CourseModal
        isOpen={isCourseModalOpen}
        onClose={handleCloseCourseModal}
        editingCourseId={editingCourseId}
        initialDay={modalInitialDay}
        initialStartTime={modalInitialStartTime}
        initialMode={modalInitialMode}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={handleCloseExport}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={handleCloseShortcuts}
      />
    </div>
  );
}
