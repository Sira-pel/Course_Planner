import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Transition } from 'motion/react';
import { ChevronLeft, ChevronRight, Shuffle, X } from 'lucide-react';
import { useScheduleStore } from '../../store/useScheduleStore';
import { withUnusedCourseColors } from '../../utils/courseColor';
import { sectionSetKey } from '../../utils/courseIdentity';
import { prefixedId } from '../../utils/id';
import {
  loadGeneratorPrefs,
  saveGeneratorPrefs,
  type StoredGeneratorPrefs,
} from '../../utils/generatorPrefs';
import {
  SHEET_CLOSE_TRANSITION,
  SHEET_OPEN_TRANSITION,
  useModalMotion,
} from '../../utils/motion';
import { useIsPhone } from '../../utils/usePoolLayout';
import { timeToMinutes } from '../../utils/timeUtils';
import {
  creditBounds,
  groupCoursesByCode,
  MAX_CANDIDATES,
  nextGeneratedPlanName,
  startGeneratorSearch,
  type CourseGroup,
  type GeneratedPlan,
  type GeneratorResult,
  type GeneratorSearch,
} from '../../utils/planGenerator';
import { AnimatedBody } from '../app/AnimatedBody';
import { CoursesStep } from './CoursesStep';
import { GenerateStepHeader } from './GenerateStepHeader';
import { PreferencesStep, type BlockedDraft } from './PreferencesStep';
import { ResultsStep } from './ResultsStep';

interface GeneratorVisit {
  step: 1 | 2 | 3;
  query: string;
  picked: string[];
  pinned: string[];
  prefs: StoredGeneratorPrefs;
  moreOpen: boolean;
  blocked: BlockedDraft[];
  lockedIds: string[];
  excludedIds: string[];
  checked: number;
  result: GeneratorResult | null;
  previewId: string | null;
  dayOffNoticeDismissed: boolean;
  pinBeforeLock: Array<[string, boolean]>;
  blockSeq: number;
  running: boolean;
}

/** Survives closing the dialog, including when the dialog unmounts. Cleared on reload. */
let generatorVisit: GeneratorVisit | null = null;

function generatorVisitState(): GeneratorVisit {
  if (!generatorVisit) {
    generatorVisit = {
      step: 1,
      query: '',
      picked: [],
      pinned: [],
      prefs: loadGeneratorPrefs(),
      moreOpen: false,
      blocked: [],
      lockedIds: [],
      excludedIds: [],
      checked: 0,
      result: null,
      previewId: null,
      dayOffNoticeDismissed: false,
      pinBeforeLock: [],
      blockSeq: 0,
      running: false,
    };
  }
  return generatorVisit;
}

interface GeneratePlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (name: string) => void;
}

function matchesQuery(group: CourseGroup, query: string): boolean {
  if (!query) return true;
  const haystack = [
    group.code,
    group.name,
    ...group.sections.flatMap((section) => [section.section, section.instructor, section.name]),
  ].join(' ').toLowerCase();
  return haystack.includes(query);
}

function groupCredits(group: CourseGroup): { min: number; max: number } {
  const credits = group.sections.map((section) => (
    typeof section.credits === 'number' && Number.isFinite(section.credits) ? section.credits : 0
  ));
  if (credits.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...credits), max: Math.max(...credits) };
}

export const GeneratePlansModal: React.FC<GeneratePlansModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const isPhone = useIsPhone();
  const reduceMotion = useReducedMotion();
  const { backdropProps, panelProps, contentProps } = useModalMotion(isOpen);
  const catalogCourses = useScheduleStore((state) => state.catalogCourses);
  const importPlan = useScheduleStore((state) => state.importPlan);
  const setActivePlan = useScheduleStore((state) => state.setActivePlan);
  const plans = useScheduleStore((state) => state.plans);

  const visit = generatorVisitState();
  const [step, setStep] = useState<1 | 2 | 3>(visit.step);
  const [query, setQuery] = useState(visit.query);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(visit.picked));
  const [pinned, setPinned] = useState<Set<string>>(() => new Set(visit.pinned));
  const [prefs, setPrefs] = useState<StoredGeneratorPrefs>(visit.prefs);
  const [moreOpen, setMoreOpen] = useState(visit.moreOpen);
  const [blocked, setBlocked] = useState<BlockedDraft[]>(visit.blocked);
  const [lockedIds, setLockedIds] = useState<string[]>(visit.lockedIds);
  const [excludedIds, setExcludedIds] = useState<string[]>(visit.excludedIds);
  const [running, setRunning] = useState(visit.running);
  const [checked, setChecked] = useState(visit.checked);
  const [result, setResult] = useState<GeneratorResult | null>(visit.result);
  const [previewId, setPreviewId] = useState<string | null>(visit.previewId);
  const [dayOffNoticeDismissed, setDayOffNoticeDismissed] = useState(visit.dayOffNoticeDismissed);
  const blockSeq = useRef(visit.blockSeq);
  const cancelRef = useRef<(() => void) | null>(null);
  const pinBeforeLock = useRef<Map<string, boolean>>(new Map(visit.pinBeforeLock));
  const resultRef = useRef(result);
  resultRef.current = result;

  const groups = useMemo(() => groupCoursesByCode(catalogCourses), [catalogCourses]);
  const filteredGroups = useMemo(
    () => groups.filter((group) => matchesQuery(group, query.trim().toLowerCase())),
    [groups, query],
  );
  const pickedGroups = useMemo(
    () => groups.filter((group) => picked.has(group.key)),
    [groups, picked],
  );

  const courseMin = Math.max(2, pinned.size);
  const courseMax = Math.max(courseMin, picked.size);
  const courseCount = Math.min(courseMax, Math.max(courseMin, prefs.courseCount));
  const pinnedCreditMin = pickedGroups
    .filter((group) => pinned.has(group.key))
    .reduce((sum, group) => sum + groupCredits(group).min, 0);
  const pickedCreditMax = pickedGroups.reduce((sum, group) => sum + groupCredits(group).max, 0);
  const creditMinBound = Math.max(pinnedCreditMin, 1);
  const creditMaxBound = Math.max(pickedCreditMax, creditMinBound);
  const creditTarget = Math.min(creditMaxBound, Math.max(creditMinBound, prefs.creditTarget));
  const creditWindow = creditBounds(creditTarget, pinnedCreditMin);
  const creditWindowLabel = creditWindow.min === creditWindow.max
    ? `Plans totaling ${creditWindow.max} credits`
    : `Plans between ${creditWindow.min} and ${creditWindow.max} credits`;

  useEffect(() => {
    if (isOpen) return;
    const pending = cancelRef.current != null;
    cancelRef.current?.();
    cancelRef.current = null;
    if (!pending) return;
    setRunning(false);
    if (!resultRef.current) setStep(2);
  }, [isOpen]);

  useEffect(() => {
    const current = generatorVisitState();
    current.step = step;
    current.query = query;
    current.picked = [...picked];
    current.pinned = [...pinned];
    current.prefs = prefs;
    current.moreOpen = moreOpen;
    current.blocked = blocked;
    current.lockedIds = lockedIds;
    current.excludedIds = excludedIds;
    current.checked = checked;
    current.result = result;
    current.previewId = previewId;
    current.dayOffNoticeDismissed = dayOffNoticeDismissed;
    current.pinBeforeLock = [...pinBeforeLock.current];
    current.blockSeq = blockSeq.current;
    current.running = running;
  }, [
    step,
    query,
    picked,
    pinned,
    prefs,
    moreOpen,
    blocked,
    lockedIds,
    excludedIds,
    checked,
    result,
    previewId,
    dayOffNoticeDismissed,
    running,
  ]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const modified = event.ctrlKey || event.metaKey;
      if (!modified || event.altKey) return;
      const undo = key === 'z' && !event.shiftKey;
      const redo = key === 'y' || (key === 'z' && event.shiftKey);
      if (!undo && !redo) return;
      event.preventDefault();
      event.stopPropagation();
      if (undo) useScheduleStore.getState().undo();
      else useScheduleStore.getState().redo();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  useEffect(() => {
    if (!isPhone || !isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('up-sheet-open');
    return () => {
      document.body.style.overflow = previous;
      document.body.classList.remove('up-sheet-open');
    };
  }, [isPhone, isOpen]);

  useEffect(() => () => {
    cancelRef.current?.();
    cancelRef.current = null;
    const current = generatorVisit;
    if (!current?.running) return;
    current.running = false;
    if (!current.result) current.step = 2;
  }, []);

  const patchPrefs = (patch: Partial<StoredGeneratorPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveGeneratorPrefs(next);
      return next;
    });
    setResult(null);
  };

  const togglePicked = (key: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setPinned((pins) => {
          if (!pins.has(key)) return pins;
          const copy = new Set(pins);
          copy.delete(key);
          return copy;
        });
      } else if (next.size < MAX_CANDIDATES) {
        next.add(key);
      }
      return next;
    });
    setResult(null);
  };

  const lockedGroupKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const group of groups) {
      if (group.sections.some((section) => lockedIds.includes(section.id))) keys.add(group.key);
    }
    return keys;
  }, [groups, lockedIds]);

  const groupForSection = (id: string) => groups.find((group) => group.sections.some((section) => section.id === id));

  const rememberAndPin = (groupKey: string) => {
    if (!pinBeforeLock.current.has(groupKey)) {
      pinBeforeLock.current.set(groupKey, pinned.has(groupKey));
    }
    setPicked((prev) => {
      if (prev.has(groupKey)) return prev;
      const next = new Set(prev);
      next.add(groupKey);
      return next;
    });
    setPinned((prev) => {
      if (prev.has(groupKey)) return prev;
      const next = new Set(prev);
      next.add(groupKey);
      return next;
    });
  };

  const restoreIfReleased = (groupKey: string, nextLockedIds: string[]) => {
    const group = groups.find((item) => item.key === groupKey);
    if (!group) return;
    const stillLocked = nextLockedIds.some((lockId) => group.sections.some((section) => section.id === lockId));
    if (stillLocked) return;
    const before = pinBeforeLock.current.get(groupKey);
    pinBeforeLock.current.delete(groupKey);
    if (before === undefined || !picked.has(groupKey)) return;
    setPinned((prev) => {
      const has = prev.has(groupKey);
      if (before === has) return prev;
      const next = new Set(prev);
      if (before) next.add(groupKey);
      else next.delete(groupKey);
      return next;
    });
  };

  const togglePin = (key: string) => {
    setResult(null);
    if (pinned.has(key)) {
      if (lockedGroupKeys.has(key)) return;
      setPinned((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      return;
    }
    if (!picked.has(key) && picked.size >= MAX_CANDIDATES) return;
    if (!picked.has(key)) {
      setPicked((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    }
    setPinned((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    const visible = filteredGroups.map((group) => group.key);
    const allOn = visible.length > 0 && visible.every((key) => picked.has(key));
    setResult(null);
    if (allOn) {
      setPicked((prev) => {
        const next = new Set(prev);
        for (const key of visible) next.delete(key);
        return next;
      });
      setPinned((prev) => {
        const next = new Set(prev);
        for (const key of visible) next.delete(key);
        return next;
      });
      return;
    }
    setPicked((prev) => {
      const next = new Set(prev);
      for (const key of visible) {
        if (next.size >= MAX_CANDIDATES) break;
        next.add(key);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!useScheduleStore.persist.hasHydrated()) return;
    const keys = new Set(groups.map((group) => group.key));
    setPicked((prev) => {
      const next = new Set([...prev].filter((key) => keys.has(key)));
      return next.size === prev.size ? prev : next;
    });
    setPinned((prev) => {
      const next = new Set([...prev].filter((key) => keys.has(key)));
      return next.size === prev.size ? prev : next;
    });
    for (const key of [...pinBeforeLock.current.keys()]) {
      if (!keys.has(key)) pinBeforeLock.current.delete(key);
    }
  }, [groups]);

  const pickedSectionIds = useMemo(
    () => new Set(pickedGroups.flatMap((group) => group.sections.map((section) => section.id))),
    [pickedGroups],
  );

  useEffect(() => {
    setLockedIds((prev) => {
      const next = prev.filter((id) => pickedSectionIds.has(id));
      if (next.length === prev.length) return prev;
      for (const id of prev) {
        if (next.includes(id)) continue;
        const group = groups.find((item) => item.sections.some((section) => section.id === id));
        if (!group) continue;
        const stillLocked = next.some((lockId) => group.sections.some((section) => section.id === lockId));
        if (!stillLocked) pinBeforeLock.current.delete(group.key);
      }
      return next;
    });
    setExcludedIds((prev) => {
      const next = prev.filter((id) => pickedSectionIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [pickedSectionIds, groups]);

  const stopSearch = () => {
    cancelRef.current?.();
    cancelRef.current = null;
    setRunning(false);
  };

  const handleGenerate = () => {
    stopSearch();
    setStep(3);
    setPreviewId(null);
    setDayOffNoticeDismissed(false);
    setChecked(0);
    setResult(null);
    setRunning(true);

    const lunchStart = timeToMinutes(prefs.lunchStart);
    const lunchEnd = timeToMinutes(prefs.lunchEnd);
    const classStart = prefs.classStart ? timeToMinutes(prefs.classStart) : null;
    const classEnd = prefs.classEnd ? timeToMinutes(prefs.classEnd) : null;
    const search: GeneratorSearch = startGeneratorSearch({
      groups: pickedGroups,
      pinnedKeys: [...pinned],
      preferences: {
        mode: prefs.mode,
        courseCount,
        creditMin: creditWindow.min,
        creditMax: creditWindow.max,
        gapsEnabled: prefs.gapsEnabled,
        gapLimit: prefs.gapLimit,
        lunchEnabled: prefs.lunchEnabled,
        lunchStart,
        lunchEnd,
        lunchMinutes: prefs.lunchMinutes,
        daysOff: prefs.daysOff,
        classStart,
        classEnd,
        blocked: blocked.map((block) => ({
          day: block.day,
          startMinutes: timeToMinutes(block.start),
          endMinutes: timeToMinutes(block.end),
        })),
        lockedSectionIds: lockedIds,
        excludedSectionIds: excludedIds,
      },
    });

    let timer = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const started = performance.now();
      while (!search.done && performance.now() - started < 12) search.advance(60);
      if (cancelled) return;
      if (search.done) {
        setChecked(search.evaluated);
        setResult(search.result());
        setRunning(false);
        cancelRef.current = null;
        return;
      }
      setChecked(search.evaluated);
      timer = window.setTimeout(tick, 0);
    };
    cancelRef.current = () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    timer = window.setTimeout(tick, 0);
  };

  const handleSave = (plan: GeneratedPlan) => {
    const state = useScheduleStore.getState();
    const wanted = sectionSetKey(plan.courses);
    const already = state.plans.some((item) => sectionSetKey(item.courses) === wanted);
    if (already) return;
    const name = nextGeneratedPlanName(state.plans);
    const copies = withUnusedCourseColors(plan.courses.map((course) => {
      const id = prefixedId('c');
      return {
        ...course,
        id,
        sessions: (course.sessions || []).map((session, index) => ({
          ...session,
          id: `s_${id}_${index}`,
        })),
      };
    }), []);
    importPlan({ id: prefixedId('plan'), name, courses: copies }, false);
    onSaved?.(name);
  };

  const handleOpenSaved = (planId: string) => {
    setActivePlan(planId);
    onClose();
  };

  const goStep = (next: 1 | 2 | 3) => {
    if (next === 3 && !result && !running) return;
    if (next === 2 && picked.size < 2) return;
    if (next !== 3) stopSearch();
    setStep(next);
  };

  const lunch = prefs.lunchEnabled
    ? { start: timeToMinutes(prefs.lunchStart), end: timeToMinutes(prefs.lunchEnd) }
    : null;

  const footer = (
    <div className="up-gen-foot">
      {step === 1 && (
        <>
          <span className="up-gen-foot-meta">{picked.size} picked · {pinned.size} pinned</span>
          <button
            type="button"
            className="up-gen-primary up-chrome-btn"
            disabled={picked.size < 2}
            onClick={() => setStep(2)}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}
      {step === 2 && (
        <>
          <button type="button" className="up-gen-quiet up-chrome-btn" onClick={() => setStep(1)}>
            <ChevronLeft className="w-4 h-4" />
            Courses
          </button>
          <button type="button" className="up-gen-primary up-chrome-btn" onClick={handleGenerate}>
            Generate
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}
      {step === 3 && (
        <>
          <button
            type="button"
            className="up-gen-quiet up-chrome-btn"
            onClick={() => {
              stopSearch();
              setStep(2);
            }}
          >
            <ChevronLeft className="w-4 h-4" />
            Preferences
          </button>
          <span className="up-gen-foot-meta">
            {running
              ? `Checking ${checked.toLocaleString()}…`
              : result
                ? result.plans.length > 0
                  ? `${result.validCount.toLocaleString()} clash-free · top ${result.plans.length}`
                  : '0 clash-free'
                : ''}
          </span>
        </>
      )}
    </div>
  );

  const body = (
    <>
      <div className="up-gen-head">
        <div className="min-w-0">
          <h2 id="generate-plans-title" className="up-gen-title">
            <Shuffle className="w-4 h-4 shrink-0" aria-hidden="true" />
            Generate plans
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="up-icon-btn up-chrome-btn up-pool-icon-hit"
          aria-label="Close generate plans"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <GenerateStepHeader
        step={step}
        canPreferences={picked.size >= 2}
        canResults={step === 3 || result != null}
        onStep={goStep}
      />
      <AnimatedBody
        activeKey={`generate-step-${step}`}
        className="up-gen-scroll up-scroll"
        contentClassName="up-gen-scroll-inner"
      >
        <motion.div key={step} {...contentProps} className="will-change-[opacity]">
          {step === 1 && (
            <CoursesStep
              groups={filteredGroups}
              query={query}
              picked={picked}
              pinned={pinned}
              onQuery={setQuery}
              onToggle={togglePicked}
              onTogglePin={togglePin}
              onSelectAll={selectAll}
              lockedKeys={lockedGroupKeys}
            />
          )}
          {step === 2 && (
            <PreferencesStep
              prefs={prefs}
              pickedCount={picked.size}
              pinnedCount={pinned.size}
              courseCount={courseCount}
              courseMin={courseMin}
              courseMax={courseMax}
              creditTarget={creditTarget}
              creditMinBound={creditMinBound}
              creditMaxBound={creditMaxBound}
              creditWindowLabel={creditWindowLabel}
              groups={pickedGroups}
              blocked={blocked}
              lockedIds={lockedIds}
              excludedIds={excludedIds}
              moreOpen={moreOpen}
              onPrefs={patchPrefs}
              onCourseCount={(value) => patchPrefs({ courseCount: value })}
              onCreditTarget={(value) => patchPrefs({ creditTarget: value })}
              onMore={setMoreOpen}
              onAddBlocked={() => {
                blockSeq.current += 1;
                setBlocked((prev) => [...prev, {
                  id: `block_${blockSeq.current}`,
                  day: 'monday',
                  start: '09:00',
                  end: '10:00',
                }]);
                setResult(null);
              }}
              onChangeBlocked={(id, patch) => {
                setBlocked((prev) => prev.map((block) => (block.id === id ? { ...block, ...patch } : block)));
                setResult(null);
              }}
              onRemoveBlocked={(id) => {
                setBlocked((prev) => prev.filter((block) => block.id !== id));
                setResult(null);
              }}
              onLock={(id) => {
                const group = groupForSection(id);
                setLockedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
                setExcludedIds((prev) => prev.filter((item) => item !== id));
                if (group) rememberAndPin(group.key);
                setResult(null);
              }}
              onUnlock={(id) => {
                const group = groupForSection(id);
                const next = lockedIds.filter((item) => item !== id);
                setLockedIds(next);
                if (group) restoreIfReleased(group.key, next);
                setResult(null);
              }}
              onExclude={(id) => {
                const group = groupForSection(id);
                const nextLocks = lockedIds.filter((item) => item !== id);
                setExcludedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
                setLockedIds(nextLocks);
                if (group) restoreIfReleased(group.key, nextLocks);
                setResult(null);
              }}
              onUnexclude={(id) => {
                setExcludedIds((prev) => prev.filter((item) => item !== id));
                setResult(null);
              }}
            />
          )}
          {step === 3 && (
            <ResultsStep
              running={running}
              checked={checked}
              result={result}
              lunch={lunch}
              previewId={previewId}
              plans={plans}
              onTogglePreview={(id) => setPreviewId((prev) => (prev === id ? null : id))}
              onSave={handleSave}
              onOpen={handleOpenSaved}
              noticeDismissed={dayOffNoticeDismissed}
              onDismissNotice={() => setDayOffNoticeDismissed(true)}
            />
          )}
        </motion.div>
      </AnimatedBody>
      {footer}
    </>
  );

  if (typeof document === 'undefined') return null;

  const sheetOpen: Transition = reduceMotion ? { duration: 0 } : SHEET_OPEN_TRANSITION;
  const sheetClose: Transition = reduceMotion ? { duration: 0 } : SHEET_CLOSE_TRANSITION;

  return createPortal(
    <AnimatePresence>
      {isOpen && (isPhone ? (
        <React.Fragment key="generate-phone">
          <motion.div
            className="up-sheet-backdrop up-generate-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: sheetClose }}
            transition={sheetOpen}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="generate-plans-title"
            className="up-mobile-sheet up-generate-sheet will-change-transform"
            initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { y: '100%', transition: sheetClose }}
            transition={sheetOpen}
          >
            <button type="button" className="up-pool-handle-hit" onClick={onClose} aria-label="Close generate plans">
              <span className="up-pool-handle" />
            </button>
            <div className="up-gen-sheet-body">{body}</div>
          </motion.div>
        </React.Fragment>
      ) : (
        <motion.div
          key="generate-desktop"
          className="fixed inset-0 z-[100] course-modal-backdrop flex items-center justify-center p-4 bg-black/60 md:backdrop-blur-xs"
          {...backdropProps}
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="generate-plans-title"
            {...panelProps}
            className="up-gen-panel will-change-transform"
          >
            {body}
          </motion.div>
        </motion.div>
      ))}
    </AnimatePresence>,
    document.body,
  );
};
