import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Course, ClassSession, DayOfWeek, DAYS_LIST, COURSE_COLORS } from '../types/schedule';
import { useScheduleStore } from '../store/useScheduleStore';
import { parseBulkCourses } from '../utils/textParser';
import { checkSessionCollision, timeToMinutes, minutesToTime } from '../utils/timeUtils';
import {
  X,
  Plus,
  Trash2,
  Check,
  Clock,
  Sparkles,
  Sliders,
  ClipboardPaste,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  CornerDownLeft,
  Pencil,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCourseId?: string | null;
  initialDay?: DayOfWeek;
  initialStartTime?: string;
  initialMode?: 'form' | 'quick';
}

interface EditableRecognizedItem {
  id: string;
  rawText: string;
  course: Course;
  selected: boolean;
  isEditing: boolean;
  hasError?: boolean;
  errorMessage?: string;
}

const SAMPLE_TEMPLATES = [
  'CS 101 Computer science MWF 09:00-10:15',
  'CS 101-001 Data Structures MWF 09:00-10:15',
  'ITM 380 (Cloud Computing) – Sec 001, (A) 8:30–10:00 MW, Vanndy You',
  'COSC 340 (Networking Essentials) – Sec 002, 10:15–11:45 MW, Math Sa',
  'CYBR 351 – Intro to Cyber – Sec 001, 1:45–3:15 MW, Prohim Tam',
  'COSC 331 (Operating Systems) – Sec 002, 1:45–3:15 TF, Phutphalla Kong',
];

export const CourseModal: React.FC<CourseModalProps> = ({
  isOpen,
  onClose,
  editingCourseId,
  initialDay = 'monday',
  initialStartTime = '09:00',
  initialMode = 'form',
}) => {
  const {
    plans,
    activePlanId,
    catalogCourses,
    addCourse,
    bulkAddCourses,
    updateCourse,
    updateCatalogCourse,
    deleteCourse,
    removeFromCatalog,
    getNextColor,
  } = useScheduleStore();

  const activePlan = plans.find((p) => p.id === activePlanId) || plans[0];

  const existingCourse = editingCourseId
    ? activePlan?.courses.find((c) => c.id === editingCourseId) ||
      catalogCourses.find((c) => c.id === editingCourseId)
    : null;

  // Active Mode: 'form' (standard manual inputs) or 'quick' (smart bulk text parser)
  const [mode, setMode] = useState<'form' | 'quick'>('form');

  // Input element refs for rapid keyboard focus jumping
  const codeInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const startTimeInputRef = useRef<HTMLInputElement>(null);
  const endTimeInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [instructor, setInstructor] = useState('');
  const [credits, setCredits] = useState<number>(3);
  const [color, setColor] = useState(COURSE_COLORS[0]);
  const [sessions, setSessions] = useState<ClassSession[]>([
    {
      id: `s_${Date.now()}`,
      day: initialDay,
      startTime: initialStartTime,
      endTime: '10:15',
      room: '',
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Quick-Add Text State (empty by default)
  const [rawText, setRawText] = useState('');

  // Editable recognized items state
  const [recognizedItems, setRecognizedItems] = useState<EditableRecognizedItem[]>([]);

  // Synchronize recognized items whenever rawText changes
  useEffect(() => {
    if (!rawText.trim()) {
      setRecognizedItems([]);
      return;
    }

    const parsed = parseBulkCourses(rawText, activePlan?.courses.length || 0);
    const newItems: EditableRecognizedItem[] = parsed.map((res, idx) => {
      if (res.success && res.course) {
        return {
          id: res.course.id || `rec_${idx}_${Date.now()}`,
          rawText: res.rawText,
          course: res.course,
          selected: true,
          isEditing: false,
        };
      }
      // Fallback draft course for failed lines so user can fix them easily
      const fallbackCourse: Course = {
        id: `rec_fail_${idx}_${Date.now()}`,
        code: 'COURSE 101',
        name: res.rawText.slice(0, 40) || 'Custom Course',
        credits: 3,
        color: COURSE_COLORS[idx % COURSE_COLORS.length],
        sessions: [
          {
            id: `s_fail_${idx}`,
            day: 'monday',
            startTime: '09:00',
            endTime: '10:15',
          },
        ],
      };
      return {
        id: fallbackCourse.id,
        rawText: res.rawText,
        course: fallbackCourse,
        selected: false,
        isEditing: false,
        hasError: true,
        errorMessage: res.error || 'Check formatting',
      };
    });

    setRecognizedItems(newItems);
  }, [rawText, activePlan]);

  const selectedCourses = useMemo(() => {
    return recognizedItems.filter((item) => item.selected && !item.hasError).map((item) => item.course);
  }, [recognizedItems]);

  // Collisions detection for Quick-Add mode
  const potentialConflicts = useMemo(() => {
    if (!activePlan || selectedCourses.length === 0) return [];
    const collisionList: { newCode: string; existingCode: string; day: string; time: string }[] = [];

    selectedCourses.forEach((newC) => {
      activePlan.courses.forEach((existC) => {
        newC.sessions.forEach((s1) => {
          existC.sessions.forEach((s2) => {
            if (checkSessionCollision(s1, s2)) {
              collisionList.push({
                newCode: newC.code,
                existingCode: existC.code,
                day: s1.day,
                time: `${s1.startTime} - ${s1.endTime}`,
              });
            }
          });
        });
      });
    });

    return collisionList;
  }, [selectedCourses, activePlan]);

  // Handlers for modifying recognized courses in place
  const handleToggleSelectItem = (id: string) => {
    setRecognizedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleToggleEditItem = (id: string) => {
    setRecognizedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isEditing: !item.isEditing } : item))
    );
  };

  const handleDeleteItem = (id: string) => {
    setRecognizedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateItemCourse = (id: string, updates: Partial<Course>) => {
    setRecognizedItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              hasError: false,
              selected: true,
              course: { ...item.course, ...updates },
            }
          : item
      )
    );
  };

  const handleUpdateItemSessionDays = (id: string, days: DayOfWeek[]) => {
    setRecognizedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const baseSession = item.course.sessions[0] || {
          startTime: '09:00',
          endTime: '10:15',
          room: '',
        };
        const newDays = days.length > 0 ? days : ['monday' as DayOfWeek];
        const newSessions: ClassSession[] = newDays.map((d, idx) => ({
          id: `s_${item.id}_${idx}`,
          day: d,
          startTime: baseSession.startTime,
          endTime: baseSession.endTime,
          room: baseSession.room,
        }));
        return {
          ...item,
          hasError: false,
          selected: true,
          course: { ...item.course, sessions: newSessions },
        };
      })
    );
  };

  const handleUpdateItemTimes = (id: string, startTime: string, endTime: string) => {
    setRecognizedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          hasError: false,
          course: {
            ...item.course,
            sessions: item.course.sessions.map((s) => ({
              ...s,
              startTime: startTime || s.startTime,
              endTime: endTime || s.endTime,
            })),
          },
        };
      })
    );
  };

  // Initialize or reset when modal opens
  useEffect(() => {
    setIsConfirmingDelete(false);
    if (existingCourse) {
      setMode('form');
      setCode(existingCourse.code);
      setName(existingCourse.name);
      setSection(existingCourse.section || '');
      setInstructor(existingCourse.instructor || '');
      setCredits(existingCourse.credits || 0);
      setColor(existingCourse.color);
      setSessions(
        existingCourse.sessions.length > 0
          ? existingCourse.sessions
          : [{ id: `s_${Date.now()}`, day: initialDay, startTime: initialStartTime, endTime: '10:15', room: '' }]
      );
    } else {
      setMode(initialMode);
      setCode('');
      setName('');
      setSection('');
      setInstructor('');
      setCredits(3);
      setColor(getNextColor(activePlanId));
      setSessions([
        { id: `s_${Date.now()}`, day: initialDay, startTime: initialStartTime, endTime: '10:15', room: '' },
      ]);
    }
    setError(null);
  }, [existingCourse, isOpen, initialDay, initialStartTime, initialMode, activePlanId, getNextColor]);

  if (!isOpen) return null;

  // Session handlers
  const handleAddSession = () => {
    const last = sessions[sessions.length - 1];
    setSessions([
      ...sessions,
      {
        id: `s_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        day: last ? (last.day === 'monday' ? 'wednesday' : last.day === 'tuesday' ? 'thursday' : 'friday') : 'monday',
        startTime: last ? last.startTime : '09:00',
        endTime: last ? last.endTime : '10:15',
        room: last ? last.room : '',
      },
    ]);
  };

  // Quick multi-day presets (e.g. MWF or TTh with same time and room)
  const handleApplyDayPreset = (preset: 'MWF' | 'TTh' | 'MTWThF') => {
    const base = sessions[0] || {
      startTime: initialStartTime,
      endTime: '10:15',
      room: '',
    };

    let targetDays: DayOfWeek[] = [];
    if (preset === 'MWF') targetDays = ['monday', 'wednesday', 'friday'];
    if (preset === 'TTh') targetDays = ['tuesday', 'thursday'];
    if (preset === 'MTWThF') targetDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

    setSessions(
      targetDays.map((day, idx) => ({
        id: `s_${Date.now()}_${idx}`,
        day,
        startTime: base.startTime,
        endTime: base.endTime,
        room: base.room,
      }))
    );
  };

  const handleRemoveSession = (index: number) => {
    if (sessions.length <= 1) {
      setError('A course must have at least one meeting session.');
      return;
    }
    setSessions(sessions.filter((_, i) => i !== index));
  };

  const handleSessionChange = (index: number, field: keyof ClassSession, value: string) => {
    setSessions(
      sessions.map((s, i) => {
        if (i !== index) return s;
        const updated = { ...s, [field]: value };
        // If changing start time and end time was default or invalid, auto-adjust end time by 75 mins
        if (field === 'startTime' && value) {
          const startM = timeToMinutes(value);
          const currentEndM = timeToMinutes(s.endTime);
          if (currentEndM <= startM) {
            updated.endTime = minutesToTime(startM + 75, false);
          }
        }
        return updated;
      })
    );
    setError(null);
  };

  const handleSetSessionDuration = (index: number, durationMinutes: number) => {
    setSessions(
      sessions.map((s, i) => {
        if (i !== index) return s;
        const startM = timeToMinutes(s.startTime || '09:00');
        return {
          ...s,
          endTime: minutesToTime(startM + durationMinutes, false),
        };
      })
    );
  };

  // Submit standard form
  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();

    if (!trimmedCode) {
      setError('Course code is required (e.g. CS101, MATH 201).');
      codeInputRef.current?.focus();
      return;
    }
    if (!trimmedName) {
      setError('Course name is required.');
      nameInputRef.current?.focus();
      return;
    }

    // Validate sessions
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      const startM = timeToMinutes(s.startTime);
      const endM = timeToMinutes(s.endTime);
      if (startM >= endM) {
        setError(`Session ${i + 1} has invalid times: Start time must be before end time.`);
        return;
      }
    }

    const courseData: Course = {
      id: existingCourse ? existingCourse.id : `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code: trimmedCode,
      name: trimmedName,
      section: section.trim() || undefined,
      instructor: instructor.trim() || undefined,
      credits: Number(credits) || 0,
      color,
      sessions,
    };

    if (existingCourse) {
      if (existingCourse.id.startsWith('cat_')) {
        updateCatalogCourse(courseData);
      } else {
        updateCourse(courseData, activePlanId);
      }
    } else {
      addCourse(courseData, activePlanId);
    }

    onClose();
  };

  // Quick-Add Submit with edited courses
  const handleQuickAddSubmit = () => {
    if (selectedCourses.length === 0) {
      setError('No valid courses selected. Check lines or customize below.');
      return;
    }
    bulkAddCourses(selectedCourses, activePlanId);
    onClose();
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText((prev) => (prev.trim() ? `${prev}\n${text}` : text));
      }
    } catch {
      // Clipboard permissions or not supported
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto"
      onKeyDown={(e) => {
        // Global modal shortcut: Ctrl/Cmd + Enter submits form instantly
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          if (mode === 'form') {
            handleFormSubmit();
          } else {
            handleQuickAddSubmit();
          }
        }
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-4 sm:p-6 my-auto max-h-[calc(100dvh-1.25rem)] sm:max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {existingCourse ? 'Edit Course' : 'Add Course'}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
              {activePlan?.name || 'Active Plan'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs (Only when adding a new course) */}
        {!existingCourse && (
          <div className="mt-3 flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/70 dark:border-slate-700/60 shrink-0">
            <button
              type="button"
              id="tab-mode-form"
              onClick={() => {
                setMode('form');
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === 'form'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Standard Form</span>
            </button>
            <button
              type="button"
              id="tab-mode-quick"
              onClick={() => {
                setMode('quick');
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === 'quick'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Quick Paste (Text)</span>
            </button>
          </div>
        )}

        {/* Error message banner */}
        {error && (
          <div className="mt-2.5 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs shrink-0">
            {error}
          </div>
        )}

        {/* ========================================================= */}
        {/* MODE 1: STANDARD FORM                                     */}
        {/* ========================================================= */}
        {mode === 'form' ? (
          <form onSubmit={handleFormSubmit} className="mt-3 flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 py-1">
            {/* Row 1: Code & Title */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Course Code *
                </label>
                <div className="relative">
                  <input
                    ref={codeInputRef}
                    type="text"
                    tabIndex={1}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        nameInputRef.current?.focus();
                      }
                    }}
                    placeholder="e.g. CS 101"
                    autoFocus
                    required
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono hidden sm:inline select-none pointer-events-none">
                    ↵
                  </span>
                </div>
              </div>
              <div className="sm:col-span-8">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Course Title *
                </label>
                <div className="relative">
                  <input
                    ref={nameInputRef}
                    type="text"
                    tabIndex={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        startTimeInputRef.current?.focus();
                      }
                    }}
                    placeholder="e.g. Intro to Computer Science"
                    required
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono hidden sm:inline select-none pointer-events-none">
                    ↵ time
                  </span>
                </div>
              </div>
            </div>

            {/* Row 2: Course Metadata (Credits, Section, Instructor) */}
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Credits
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  tabIndex={3}
                  value={credits}
                  onChange={(e) => setCredits(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Section (Opt.)
                </label>
                <input
                  type="text"
                  tabIndex={4}
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="01, L1"
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1 truncate">
                  Instructor (Opt.)
                </label>
                <input
                  type="text"
                  tabIndex={5}
                  value={instructor}
                  onChange={(e) => setInstructor(e.target.value)}
                  placeholder="Prof. Turing"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Row 3: Color Palette (Clean & Compact) */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Color Accent
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {COURSE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    tabIndex={-1}
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110 ${
                      color.toLowerCase() === c.toLowerCase()
                        ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 scale-105'
                        : 'opacity-85 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                    title={`Select color ${c}`}
                  >
                    {color.toLowerCase() === c.toLowerCase() && <Check className="w-3.5 h-3.5 text-white drop-shadow-xs" />}
                  </button>
                ))}

                {/* Custom Color Mixer */}
                <label
                  title="Mix custom color"
                  className={`relative w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-110 ${
                    !COURSE_COLORS.some((c) => c.toLowerCase() === color.toLowerCase())
                      ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900'
                      : 'border border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-500 bg-white dark:bg-slate-800'
                  }`}
                  style={
                    !COURSE_COLORS.some((c) => c.toLowerCase() === color.toLowerCase())
                      ? { backgroundColor: color }
                      : undefined
                  }
                >
                  <input
                    type="color"
                    tabIndex={-1}
                    value={color.startsWith('#') && color.length === 7 ? color : '#6366F1'}
                    onChange={(e) => setColor(e.target.value)}
                    className="sr-only"
                    id="custom-course-color-mixer"
                  />
                  {!COURSE_COLORS.some((c) => c.toLowerCase() === color.toLowerCase()) ? (
                    <Check className="w-3.5 h-3.5 text-white drop-shadow-xs" />
                  ) : (
                    <Plus className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  )}
                </label>
              </div>
            </div>

            {/* Row 4: Schedule & Meeting Time */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  Schedule & Meeting Time
                </label>

                {/* Fast Day Pattern Presets */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400">Presets:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyDayPreset('MWF')}
                    className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                    title="Set to Monday, Wednesday, Friday"
                  >
                    MWF
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDayPreset('TTh')}
                    className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                    title="Set to Tuesday, Thursday"
                  >
                    TTh
                  </button>
                  <button
                    type="button"
                    onClick={handleAddSession}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold inline-flex items-center gap-0.5 hover:underline ml-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Session</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-0.5">
                {sessions.map((session, index) => (
                  <div
                    key={session.id || index}
                    className="p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Session #{index + 1}
                      </span>

                      {/* Quick Duration Preset Chips */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-slate-400">Duration:</span>
                        {[
                          { label: '30m', minutes: 30 },
                          { label: '50m', minutes: 50 },
                          { label: '60m', minutes: 60 },
                          { label: '75m', minutes: 75 },
                          { label: '90m', minutes: 90 },
                          { label: '2h', minutes: 120 },
                          { label: '3h', minutes: 180 },
                        ].map((preset) => {
                          const currentDur = timeToMinutes(session.endTime) - timeToMinutes(session.startTime);
                          const isActive = currentDur === preset.minutes;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => handleSetSessionDuration(index, preset.minutes)}
                              className={`px-1.5 py-0.5 text-[9px] font-mono rounded transition-colors ${
                                isActive
                                  ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-400 border border-slate-200 dark:border-slate-600'
                              }`}
                              title={`Set session duration to ${preset.label}`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}

                        {sessions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSession(index)}
                            className="text-slate-400 hover:text-rose-500 transition-colors p-0.5 ml-1"
                            title="Remove this session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Day Selection */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {DAYS_LIST.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => handleSessionChange(index, 'day', d.id)}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                            session.day === d.id
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-white dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200/60 dark:border-slate-600/50'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>

                    {/* Time Range & Room with Direct Tabbing */}
                    <div className="grid grid-cols-3 gap-2 pt-0.5">
                      <div>
                        <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-0.5">Start Time</span>
                        <input
                          ref={index === 0 ? startTimeInputRef : undefined}
                          type="time"
                          tabIndex={6}
                          value={session.startTime}
                          onChange={(e) => handleSessionChange(index, 'startTime', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (index === 0) endTimeInputRef.current?.focus();
                            }
                          }}
                          className="w-full px-2 py-1 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-0.5">End Time</span>
                        <input
                          ref={index === 0 ? endTimeInputRef : undefined}
                          type="time"
                          tabIndex={7}
                          value={session.endTime}
                          onChange={(e) => handleSessionChange(index, 'endTime', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleFormSubmit();
                            }
                          }}
                          className="w-full px-2 py-1 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-0.5">Room (Opt.)</span>
                        <input
                          type="text"
                          tabIndex={8}
                          value={session.room || ''}
                          onChange={(e) => handleSessionChange(index, 'room', e.target.value)}
                          placeholder="Hall 101"
                          className="w-full px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Keyboard Navigation Tip */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-1">
              <span className="flex items-center gap-1">
                <CornerDownLeft className="w-3 h-3 text-indigo-500" />
                Press <strong className="font-mono text-slate-600 dark:text-slate-400">Enter ↵</strong> to jump: Code → Title → Schedule
              </span>
              <span className="font-mono">
                <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px]">Ctrl+Enter</kbd> to save
              </span>
            </div>
            </div>

            {/* Form Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              {existingCourse ? (
                isConfirmingDelete ? (
                  <div className="flex items-center gap-1.5 animate-in fade-in">
                    <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">Delete?</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (existingCourse.id.startsWith('cat_')) {
                          removeFromCatalog(existingCourse.id);
                        } else {
                          deleteCourse(existingCourse.id, activePlanId);
                        }
                        onClose();
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors shadow-xs"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(false)}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                )
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-save-course"
                  tabIndex={9}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                >
                  {existingCourse ? 'Save Changes' : 'Add to Plan'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* ========================================================= */
          /* MODE 2: QUICK PASTE (TEXT) PARSER WITH INLINE EDITOR      */
          /* ========================================================= */
          <div className="mt-3 flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 py-1">
            {/* Quick Helper Banner */}
            <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-950 dark:text-indigo-200">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Paste syllabus lines or portal text:</span>
                </div>
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 transition-colors"
                >
                  <ClipboardPaste className="w-3 h-3" />
                  Paste from Clipboard
                </button>
              </div>

              {/* Sample Templates */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Try example:</span>
                {SAMPLE_TEMPLATES.map((sample, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => setRawText((prev) => (prev.trim() ? `${prev}\n${sample}` : sample))}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 transition-colors"
                  >
                    + {sample.split(' ')[0]} {sample.split(' ')[1]}
                  </button>
                ))}
              </div>
            </div>

            {/* Raw Text Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Course Lines (1 line per course)
                </label>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  {rawText.split('\n').filter((l) => l.trim().length > 0).length} lines detected
                </span>
              </div>
              <textarea
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  setError(null);
                }}
                rows={3}
                placeholder="CS 101 Computer science MWF 09:00-10:15&#10;CS 101-001 Data Structures MWF 09:00-10:15&#10;ITM 380 (Cloud Computing) – Sec 001, (A) 8:30–10:00 MW, Vanndy You"
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Live Interactive Recognized Courses List */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Recognized Courses ({selectedCourses.length} selected):
                </span>
                {potentialConflicts.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900/60">
                    <AlertTriangle className="w-3 h-3" />
                    {potentialConflicts.length} Collision{potentialConflicts.length > 1 ? 's' : ''} detected
                  </span>
                )}
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {recognizedItems.length === 0 ? (
                  <div className="py-6 text-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs">
                    Type or paste course lines above, or click an example to preview
                  </div>
                ) : (
                  recognizedItems.map((item) => {
                    const c = item.course;
                    const session0 = c.sessions[0] || {
                      startTime: '09:00',
                      endTime: '10:15',
                      day: 'monday' as DayOfWeek,
                    };

                    const currentDays = c.sessions.map((s) => s.day);

                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border transition-all ${
                          item.hasError
                            ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                            : item.selected
                            ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 shadow-2xs'
                            : 'bg-slate-100/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800 opacity-60'
                        }`}
                      >
                        {/* Course Card Header */}
                        <div className="p-2.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => handleToggleSelectItem(item.id)}
                              className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              title="Include/Exclude this course"
                            />

                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: c.color }}
                            />

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                                  {c.code}
                                </span>
                                <span className="text-xs text-slate-700 dark:text-slate-300 truncate">
                                  {c.name}
                                </span>
                                {c.section && (
                                  <span className="px-1 py-0.2 rounded text-[10px] font-mono bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    Sec {c.section}
                                  </span>
                                )}
                              </div>

                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {c.sessions.map((s, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 rounded font-semibold uppercase"
                                  >
                                    {s.day.substring(0, 3)} {s.startTime}-{s.endTime}
                                  </span>
                                ))}
                                {c.instructor && <span className="truncate">• {c.instructor}</span>}
                              </div>
                            </div>
                          </div>

                          {/* Actions: Edit, Delete, Fix */}
                          <div className="flex items-center gap-1 shrink-0">
                            {item.hasError ? (
                              <button
                                type="button"
                                onClick={() => handleToggleEditItem(item.id)}
                                className="px-2 py-0.5 text-[10px] font-semibold bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors"
                              >
                                Fix & Add
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleEditItem(item.id)}
                                className={`p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors ${
                                  item.isEditing ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600' : ''
                                }`}
                                title="Edit course details"
                              >
                                {item.isEditing ? <ChevronUp className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                              title="Discard this course"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Inline Expandable Mini-Editor */}
                        {item.isEditing && (
                          <div className="p-3 border-t border-slate-200/80 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 space-y-2.5 animate-in fade-in rounded-b-xl">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                                  Course Code
                                </label>
                                <input
                                  type="text"
                                  value={c.code}
                                  onChange={(e) => handleUpdateItemCourse(item.id, { code: e.target.value.toUpperCase() })}
                                  className="w-full px-2 py-1 text-xs font-mono font-bold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                                  Course Title
                                </label>
                                <input
                                  type="text"
                                  value={c.name}
                                  onChange={(e) => handleUpdateItemCourse(item.id, { name: e.target.value })}
                                  className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                              </div>
                            </div>

                            {/* Day Selection Toggle Pills */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Meeting Days
                              </label>
                              <div className="flex items-center gap-1 flex-wrap">
                                {DAYS_LIST.map((d) => {
                                  const isSelected = currentDays.includes(d.id);
                                  return (
                                    <button
                                      key={d.id}
                                      type="button"
                                      onClick={() => {
                                        const newDays = isSelected
                                          ? currentDays.filter((cd) => cd !== d.id)
                                          : [...currentDays, d.id];
                                        handleUpdateItemSessionDays(item.id, newDays);
                                      }}
                                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                        isSelected
                                          ? 'bg-indigo-600 text-white shadow-2xs'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 border border-slate-200 dark:border-slate-700'
                                      }`}
                                    >
                                      {d.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Time & Section & Instructor */}
                            <div className="grid grid-cols-4 gap-2">
                              <div>
                                <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Start Time</label>
                                <input
                                  type="time"
                                  value={session0.startTime}
                                  onChange={(e) => handleUpdateItemTimes(item.id, e.target.value, session0.endTime)}
                                  className="w-full px-1.5 py-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 font-medium mb-0.5">End Time</label>
                                <input
                                  type="time"
                                  value={session0.endTime}
                                  onChange={(e) => handleUpdateItemTimes(item.id, session0.startTime, e.target.value)}
                                  className="w-full px-1.5 py-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Section</label>
                                <input
                                  type="text"
                                  value={c.section || ''}
                                  onChange={(e) => handleUpdateItemCourse(item.id, { section: e.target.value })}
                                  placeholder="001"
                                  className="w-full px-1.5 py-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 font-medium mb-0.5 truncate">Instructor</label>
                                <input
                                  type="text"
                                  value={c.instructor || ''}
                                  onChange={(e) => handleUpdateItemCourse(item.id, { instructor: e.target.value })}
                                  placeholder="Name"
                                  className="w-full px-1.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                              </div>
                            </div>

                            {/* Quick Duration Buttons for inline editor */}
                            <div className="flex items-center gap-1 flex-wrap pt-0.5">
                              <span className="text-[10px] text-slate-400">Duration:</span>
                              {[
                                { label: '30m', minutes: 30 },
                                { label: '50m', minutes: 50 },
                                { label: '60m', minutes: 60 },
                                { label: '75m', minutes: 75 },
                                { label: '90m', minutes: 90 },
                                { label: '2h', minutes: 120 },
                                { label: '3h', minutes: 180 },
                              ].map((preset) => {
                                const currentDur = timeToMinutes(session0.endTime) - timeToMinutes(session0.startTime);
                                const isActive = currentDur === preset.minutes;
                                return (
                                  <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => {
                                      const startM = timeToMinutes(session0.startTime || '09:00');
                                      handleUpdateItemTimes(
                                        item.id,
                                        session0.startTime,
                                        minutesToTime(startM + preset.minutes, false)
                                      );
                                    }}
                                    className={`px-1.5 py-0.5 text-[9px] font-mono rounded transition-colors ${
                                      isActive
                                        ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-400 border border-slate-200 dark:border-slate-700'
                                    }`}
                                  >
                                    {preset.label}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Color Selector */}
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-1.5">
                                {COURSE_COLORS.slice(0, 7).map((clr) => (
                                  <button
                                    key={clr}
                                    type="button"
                                    onClick={() => handleUpdateItemCourse(item.id, { color: clr })}
                                    className={`w-4 h-4 rounded-full transition-transform ${
                                      c.color === clr ? 'scale-125 ring-2 ring-indigo-500' : 'opacity-70 hover:opacity-100'
                                    }`}
                                    style={{ backgroundColor: clr }}
                                  />
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleToggleEditItem(item.id)}
                                className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

            {/* Quick Add Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-add-all-quick"
                onClick={handleQuickAddSubmit}
                disabled={selectedCourses.length === 0}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:pointer-events-none text-white shadow-xs transition-colors inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add {selectedCourses.length} Course{selectedCourses.length !== 1 ? 's' : ''} to Plan</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


