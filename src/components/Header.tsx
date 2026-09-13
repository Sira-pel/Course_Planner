import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { detectPlanConflicts } from '../utils/timeUtils';
import { COURSE_COLORS, GHOST_PLAN_COLORS } from '../types/schedule';
import {
  Calendar,
  Layers,
  Plus,
  Sparkles,
  Download,
  Copy,
  Trash2,
  Edit2,
  Check,
  X,
  AlertTriangle,
  Sun,
  Moon,
  Undo2,
  Redo2,
  BookOpen,
  Keyboard,
  CheckCircle2,
  ChevronDown,
  FolderPlus,
  FolderKanban,
  Settings,
  Upload,
} from 'lucide-react';
import { parseIcsContent } from '../utils/icsImport';

interface HeaderProps {
  onOpenNewCourse: (initialMode?: 'form' | 'quick') => void;
  onOpenExport: () => void;
  onOpenCatalog: () => void;
  onOpenShortcuts: () => void;
  isPoolOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewCourse,
  onOpenExport,
  onOpenCatalog,
  onOpenShortcuts,
  isPoolOpen = true,
}) => {
  const {
    plans,
    activePlanId,
    ghostPlanIds,
    catalogCourses,
    showWeekends,
    startHour,
    endHour,
    theme,
    setActivePlan,
    createPlan,
    duplicatePlan,
    renamePlan,
    deletePlan,
    toggleGhostPlan,
    clearGhostPlans,
    setShowWeekends,
    setTimeRange,
    toggleTheme,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useScheduleStore();

  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [ghostMenuOpen, setGhostMenuOpen] = useState(false);
  const [plansMenuOpen, setPlansMenuOpen] = useState(false);
  const [newPlanInputName, setNewPlanInputName] = useState('');
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [planIdConfirmDelete, setPlanIdConfirmDelete] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const ghostDropdownRef = useRef<HTMLDivElement>(null);
  const plansDropdownRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  const activePlan = useMemo(() => plans.find((p) => p.id === activePlanId) || plans[0], [plans, activePlanId]);
  const conflicts = useMemo(() => (activePlan ? detectPlanConflicts(activePlan.courses) : []), [activePlan?.courses]);
  const totalCredits = useMemo(
    () => activePlan?.courses.reduce((sum, c) => sum + (c.credits || 0), 0) || 0,
    [activePlan?.courses]
  );

  // Next suggested plan name based on existing plan count
  const nextSuggestedName = useMemo(() => `Plan ${String.fromCharCode(65 + (plans.length % 26))}`, [plans.length]);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ghostDropdownRef.current && !ghostDropdownRef.current.contains(e.target as Node)) {
        setGhostMenuOpen(false);
      }
      if (plansDropdownRef.current && !plansDropdownRef.current.contains(e.target as Node)) {
        setPlansMenuOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleIcsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        try {
          const courses = parseIcsContent(content);
          if (courses.length > 0) {
            useScheduleStore.getState().bulkAddCourses(courses, activePlanId);
            showToast(`Imported ${courses.length} course(s) from .ics file.`, 'success');
          } else {
            showToast('No valid recurring or class events found in this .ics file.', 'error');
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          showToast(`Error parsing .ics file: ${msg}`, 'error');
        }
      }
    };
    reader.onerror = () => {
      showToast('Failed to read the selected .ics file.', 'error');
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleCreatePlan = (nameToUse?: string) => {
    const finalName = (nameToUse || newPlanInputName).trim() || nextSuggestedName;
    createPlan(finalName);
    setNewPlanInputName('');
    setPlansMenuOpen(false);
  };

  const handleDuplicatePlan = (sourcePlanId: string) => {
    duplicatePlan(sourcePlanId);
    setPlansMenuOpen(false);
  };

  const handleStartRename = (planId: string, currentName: string) => {
    setEditingPlanId(planId);
    setEditingName(currentName);
  };

  const handleSaveRename = () => {
    if (editingPlanId && editingName.trim()) {
      renamePlan(editingPlanId, editingName.trim());
    }
    setEditingPlanId(null);
  };

  return (
    <header className="flex flex-col gap-2.5 pb-2 w-full max-w-full">
      {/* Top Bar: Brand, Badges & Actions */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm w-full max-w-full">
        {/* Left: Brand & Badges */}
        <div className="flex items-center justify-between xl:justify-start gap-2 sm:gap-3 w-full xl:w-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shadow-xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                  Uniplan
                </span>
              </div>
              <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                Course & Schedule Planner
              </span>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block mx-1" />

          {/* Credits tally badge */}
          <div
            title="Total enrolled credit hours in active plan"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100/90 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs"
          >
            <span className="text-slate-600 dark:text-slate-300 font-normal">Enrolled:</span>
            <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
              {totalCredits} cr
            </span>
            <span className="hidden sm:inline text-slate-600 dark:text-slate-300">({activePlan?.courses.length || 0} classes)</span>
          </div>

          {/* Conflict Alert Banner / Pill */}
          {conflicts.length > 0 ? (
            <button
              type="button"
              id="conflict-alert-btn"
              onClick={() => setConflictModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors animate-pulse"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>{conflicts.length} Collision{conflicts.length > 1 ? 's' : ''}</span>
            </button>
          ) : (
            <div
              title="No overlapping courses found in current schedule"
              className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>0 Conflicts</span>
            </div>
          )}
        </div>

        {/* Right: Actions Row (Left: Undo/Redo, Right: Add Course + Tools) */}
        <div className="flex items-center justify-between gap-1.5 w-full xl:w-auto pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100 dark:border-slate-800/80">
          {/* Left inside action bar: Undo / Redo */}
          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-slate-50 dark:bg-slate-800/60">
            <button
              type="button"
              id="btn-undo"
              onClick={undo}
              disabled={!canUndo()}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              id="btn-redo"
              onClick={redo}
              disabled={!canRedo()}
              title="Redo (Ctrl+Shift+Z)"
              className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Right inside action bar: Add Course & Tools */}
          <div className="flex items-center gap-1.5">
            {/* Add Course */}
            <button
              type="button"
              id="btn-add-course"
              onClick={() => onOpenNewCourse('form')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Course</span>
            </button>

            {/* Course Pool / Scratchpad */}
            <button
              type="button"
              id="btn-open-catalog"
              onClick={onOpenCatalog}
              title="Shared Course Pool (Candidate sections & shopping cart)"
              className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                isPoolOpen
                  ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs'
                  : 'border-slate-300/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs'
              }`}
            >
              <BookOpen className={`w-3.5 h-3.5 ${isPoolOpen ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'}`} />
              <span className="hidden md:inline">Course Pool</span>
              {catalogCourses.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isPoolOpen
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                }`}>
                  {catalogCourses.length}
                </span>
              )}
            </button>

            {/* Export */}
            <button
              type="button"
              id="btn-export"
              onClick={onOpenExport}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
              title="Export schedule as PNG, PDF, ICS, or Text"
            >
              <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              <span className="hidden md:inline">Export</span>
            </button>

          {/* Hidden file input for .ics import */}
          <input
            type="file"
            accept=".ics,text/calendar"
            ref={fileInputRef}
            onChange={handleIcsUpload}
            className="hidden"
          />

          {/* Settings Menu */}
          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="p-1.5 rounded-lg border border-slate-300/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {isSettingsOpen && (
              <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2.5rem)] max-w-xs sm:w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                  {/* Calendar Time Bounds */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">
                      Time Range
                    </label>
                    <div className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-slate-50 dark:bg-slate-800/50">
                      <select
                        value={startHour}
                        onChange={(e) => setTimeRange(Number(e.target.value), endHour)}
                        className="bg-transparent text-xs font-mono font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                      >
                        {Array.from({ length: 8 }, (_, i) => i + 5).map(h => (
                          <option key={`start-${h}`} value={h}>{h}:00</option>
                        ))}
                      </select>
                      <span className="text-slate-400 text-xs">to</span>
                      <select
                        value={endHour}
                        onChange={(e) => setTimeRange(startHour, Number(e.target.value))}
                        className="bg-transparent text-xs font-mono font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer text-right"
                      >
                        {Array.from({ length: 9 }, (_, i) => i + 16).map(h => (
                          <option key={`end-${h}`} value={h}>{h}:00</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  {/* Weekends Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Show Weekends</span>
                    <button
                      type="button"
                      onClick={() => setShowWeekends(!showWeekends)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                        showWeekends ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          showWeekends ? 'translate-x-2' : '-translate-x-2'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      toggleTheme();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    {theme === 'dark' ? (
                      <>
                        <Sun className="w-4 h-4 text-amber-500" />
                        Light Mode
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4 text-slate-400" />
                        Dark Mode
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Upload className="w-4 h-4 text-slate-400" />
                    Import Calendar (.ics)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      onOpenExport();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Download className="w-4 h-4 text-slate-400" />
                    Export Schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      onOpenShortcuts();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Keyboard className="w-4 h-4 text-slate-400" />
                    Keyboard Shortcuts
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* Second Row: Plans Dropdown & Multi-Plan Ghost Comparison */}
      <div className="flex items-center justify-between gap-2.5 sm:gap-3 flex-wrap bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl px-3 sm:px-3.5 py-2 shadow-sm w-full max-w-full">
        {/* Left: Consolidated Plans Dropdown & Active Plan Summary */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Plans Dropdown */}
          <div className="relative" ref={plansDropdownRef}>
            <button
              type="button"
              id="btn-plans-dropdown"
              onClick={() => {
                setNewPlanInputName('');
                setEditingPlanId(null);
                setPlansMenuOpen(!plansMenuOpen);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                plansMenuOpen
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-300/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-2xs'
              }`}
              title="View, switch, manage, and create plans"
            >
              <FolderKanban className={`w-3.5 h-3.5 ${plansMenuOpen ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
              <span>Plans</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                plansMenuOpen
                  ? 'bg-indigo-700 text-white'
                  : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
              }`}>
                {plans.length}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
            </button>

            {/* Plans Dropdown Menu */}
            {plansMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-[calc(100vw-2.5rem)] max-w-xs sm:w-84 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-3 text-xs animate-in fade-in">
                {/* Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FolderKanban className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Schedule Plans
                  </span>
                  <span className="text-[10px] text-slate-600 dark:text-slate-300 font-mono">
                    {plans.length} total
                  </span>
                </div>

                {/* Existing Plans List */}
                <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5 mb-2.5">
                  <div className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 px-1 pb-1">
                    Select or Manage Plan:
                  </div>
                  {plans.map((plan, index) => {
                    const isActive = plan.id === activePlanId;
                    const isEditing = editingPlanId === plan.id;
                    const planCredits = plan.courses.reduce((sum, c) => sum + (c.credits || 0), 0);

                    if (isEditing) {
                      return (
                        <div
                          key={plan.id}
                          className="flex items-center gap-1.5 p-1.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800"
                        >
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename();
                              if (e.key === 'Escape') setEditingPlanId(null);
                            }}
                            autoFocus
                            className="flex-1 px-2 py-1 text-xs rounded bg-white text-slate-900 dark:bg-slate-900 dark:text-white border border-indigo-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleSaveRename}
                            className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPlanId(null)}
                            className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={plan.id}
                        onClick={() => {
                          setActivePlan(plan.id);
                          setPlansMenuOpen(false);
                        }}
                        className={`group flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all border ${
                          isActive
                            ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-800 text-indigo-950 dark:text-indigo-100 shadow-2xs'
                            : 'bg-white dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {/* Left: Indicator & Info */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                              isActive
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {isActive ? <Check className="w-2.5 h-2.5" /> : index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-semibold truncate text-xs ${isActive ? 'text-indigo-900 dark:text-indigo-200 font-bold' : ''}`}>
                                {plan.name}
                              </span>
                              {isActive && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-300 shrink-0">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-300 font-mono">
                              {plan.courses.length} courses • {planCredits} credits
                            </div>
                          </div>
                        </div>

                        {/* Right: Actions */}
                        <div
                          className="flex items-center gap-1 ml-2 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleStartRename(plan.id, plan.name)}
                            title="Rename Plan"
                            className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {plans.length > 1 && (
                            planIdConfirmDelete === plan.id ? (
                              <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900 animate-in fade-in">
                                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    deletePlan(plan.id);
                                    setPlanIdConfirmDelete(null);
                                  }}
                                  className="text-[10px] font-bold text-white bg-rose-600 px-1.5 py-0.5 rounded hover:bg-rose-700 transition-colors"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPlanIdConfirmDelete(null)}
                                  className="text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPlanIdConfirmDelete(plan.id)}
                                title="Delete Plan"
                                className="p-1 rounded text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Create New Plan Section */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 px-1 mb-1.5 flex items-center justify-between">
                    <span>Create New Plan</span>
                    <FolderPlus className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  </div>

                  {/* Name Input */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <input
                      type="text"
                      value={newPlanInputName}
                      onChange={(e) => setNewPlanInputName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreatePlan();
                        if (e.key === 'Escape') setPlansMenuOpen(false);
                      }}
                      placeholder={nextSuggestedName}
                      className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCreatePlan()}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors shrink-0"
                    >
                      Create
                    </button>
                  </div>

                  {/* Quick Presets */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCreatePlan(nextSuggestedName)}
                      className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition-colors border border-slate-200 dark:border-slate-700"
                    >
                      <Plus className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      <span>Blank Plan</span>
                    </button>
                    {activePlan && (
                      <button
                        type="button"
                        onClick={() => handleDuplicatePlan(activePlan.id)}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition-colors border border-slate-200 dark:border-slate-700 truncate"
                        title={`Clone ${activePlan.name}`}
                      >
                        <Copy className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                        <span className="truncate">Clone Active</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active Plan Name & Summary Pill */}
          <div className="flex items-center gap-2 pl-0.5 text-xs">
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              Current: <strong className="text-slate-900 dark:text-white font-bold">{activePlan?.name}</strong>
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-slate-700 shadow-2xs font-semibold">
              {activePlan?.courses.length} courses • {totalCredits} cr
            </span>
          </div>
        </div>

        {/* Multi-Plan Ghost Comparison Overlay Dropdown */}
        <div className="relative" ref={ghostDropdownRef}>
          <button
            type="button"
            id="btn-ghost-overlay"
            onClick={() => setGhostMenuOpen(!ghostMenuOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              ghostPlanIds.length > 0
                ? 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-800 shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-2xs'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            <span>Compare Plans</span>
            {ghostPlanIds.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-violet-600 text-white">
                {ghostPlanIds.length}
              </span>
            )}
            <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
          </button>

          {/* Ghost Dropdown Menu */}
          {ghostMenuOpen && (
            <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 w-[calc(100vw-2rem)] max-w-xs sm:w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-2.5 text-xs animate-in fade-in">
              <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-slate-100 dark:border-slate-800 px-1">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  <span className="font-bold text-slate-900 dark:text-white">Compare Plans</span>
                </div>
                {ghostPlanIds.length > 0 && (
                  <button
                    type="button"
                    onClick={clearGhostPlans}
                    className="text-[11px] text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white font-medium px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {plans.length <= 1 ? (
                <div className="p-3 bg-violet-50/70 dark:bg-violet-950/40 rounded-lg border border-violet-200/60 dark:border-violet-900/40 text-center space-y-2 mt-1">
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                    Overlay backup scenarios as translucent ghost blocks to spot time differences.
                  </p>
                  <div className="flex flex-col gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (!activePlanId) return;
                        const newPlanId = duplicatePlan(activePlanId);
                        toggleGhostPlan(newPlanId);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-[11px] transition-colors shadow-xs"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Duplicate to Plan B & Overlay
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newPlanId = createPlan();
                        toggleGhostPlan(newPlanId);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium text-[11px] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create Blank Plan & Overlay
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 px-1 mb-2">
                    Overlay backup scenarios as translucent ghost blocks to spot differences:
                  </p>

                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {plans.map((p, idx) => {
                      const isActive = p.id === activePlanId;
                      const isGhosted = ghostPlanIds.includes(p.id);
                      const ghostStyle = GHOST_PLAN_COLORS[idx % GHOST_PLAN_COLORS.length];

                      if (isActive) {
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-semibold"
                          >
                            <span className="truncate">{p.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                              Active
                            </span>
                          </div>
                        );
                      }

                      return (
                        <label
                          key={p.id}
                          className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isGhosted}
                              onChange={() => toggleGhostPlan(p.id)}
                              className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                            />
                            <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                              {p.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-600 dark:text-slate-300 font-mono">
                              {p.courses.length} classes
                            </span>
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: ghostStyle.dot }}
                            />
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        const newPlanId = createPlan();
                        toggleGhostPlan(newPlanId);
                      }}
                      className="text-[11px] text-violet-600 dark:text-violet-400 font-medium hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add another plan
                    </button>
                    {ghostPlanIds.length > 0 && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        {ghostPlanIds.length} active overlay{ghostPlanIds.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Collision Details Modal */}
      {conflictModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900/60 shadow-2xl max-w-md w-full p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Schedule Collision Detected
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConflictModalOpen(false)}
                className="p-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3 space-y-2.5">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                The following courses in <strong>{activePlan?.name}</strong> collide on the same day and time interval:
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {conflicts.map((c, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 text-xs"
                  >
                    <div className="font-bold text-rose-800 dark:text-rose-300 flex items-center justify-between">
                      <span>{c.courseCode1} vs {c.courseCode2}</span>
                      <span className="capitalize font-mono text-[11px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-900">
                        {c.day}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mt-1 font-mono text-[11px]">
                      Overlap window: {c.overlapStart} - {c.overlapEnd}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setConflictModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900"
              >
                Close & Adjust
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-medium ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                : toastMessage.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/90 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                : 'bg-slate-900 dark:bg-slate-800 text-white border-slate-700'
            }`}
          >
            <span>{toastMessage.text}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="opacity-70 hover:opacity-100 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
