import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
  holdGeneratorSearch,
  mergeSearchResults,
  nextShownCount,
  persistedGeneratorStep,
  readGeneratorSearch,
  readGeneratorSession,
  reopenGeneratorStep,
  stampPickedCourses,
  withCourseFreshness,
  writeGeneratorSession,
} from '../../utils/generatorSession';
import {
  SHEET_CLOSE_TRANSITION,
  SHEET_OPEN_TRANSITION,
  useModalMotion,
} from '../../utils/motion';
import { useSheetDrag } from '../../utils/useSheetDrag';
import { useIsPhone } from '../../utils/usePoolLayout';
import { timeToMinutes } from '../../utils/timeUtils';
import { settledGeneratorSelection } from '../../utils/generatorSelection';
import { shouldClearVisiblePicks } from '../../utils/visiblePicks';
import {
  creditBounds,
  groupCoursesByCode,
  MAX_CANDIDATES,
  MAX_EVALUATIONS,
  MAX_RESULTS,
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
  const sheetDrag = useSheetDrag(onClose);
  const { backdropProps, panelProps, contentProps } = useModalMotion(isOpen);
  const catalogCourses = useScheduleStore((state) => state.catalogCourses);
  const importPlan = useScheduleStore((state) => state.importPlan);
  const setActivePlan = useScheduleStore((state) => state.setActivePlan);
  const plans = useScheduleStore((state) => state.plans);

  const [sessionSeed] = useState(() => {
    const stored = readGeneratorSession();
    if (!stored) return null;
    const next = withCourseFreshness(stored, useScheduleStore.getState().catalogCourses);
    if (next !== stored) writeGeneratorSession(next);
    return next;
  });
  const [step, setStep] = useState<1 | 2 | 3>(() => reopenGeneratorStep(sessionSeed));
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(() => new Set(sessionSeed?.picked ?? []));
  const [pinned, setPinned] = useState<Set<string>>(() => new Set(sessionSeed?.pinned ?? []));
  const [prefs, setPrefs] = useState<StoredGeneratorPrefs>(() => loadGeneratorPrefs());
  const [moreOpen, setMoreOpen] = useState(false);
  const [blocked, setBlocked] = useState<BlockedDraft[]>(() => sessionSeed?.blocked ?? []);
  const [lockedIds, setLockedIds] = useState<string[]>(() => sessionSeed?.lockedIds ?? []);
  const [excludedIds, setExcludedIds] = useState<string[]>(() => sessionSeed?.excludedIds ?? []);
  const [running, setRunning] = useState(false);
  const [checked, setChecked] = useState(0);
  const [result, setResult] = useState<GeneratorResult | null>(() => sessionSeed?.result ?? null);
  const [previewId, setPreviewId] = useState<string | null>(() => sessionSeed?.previewId ?? null);
  const [shownCount, setShownCount] = useState(() => sessionSeed?.shownCount ?? MAX_RESULTS);
  const [courseStamp, setCourseStamp] = useState<string | null>(() => sessionSeed?.courseStamp ?? null);
  const [outdated, setOutdated] = useState(() => sessionSeed?.outdated ?? false);
  const [dayOffNoticeDismissed, setDayOffNoticeDismissed] = useState(false);
  const blockSeq = useRef(0);
  const cancelRef = useRef<(() => void) | null>(null);
  const pinBeforeLock = useRef<Map<string, boolean>>(new Map());
  const searchRef = useRef<GeneratorSearch | null>(readGeneratorSearch());
  const resultRef = useRef(result);
  const shownCountRef = useRef(shownCount);
  const previewIdRef = useRef(previewId);
  const stepRef = useRef(step);
  resultRef.current = result;
  shownCountRef.current = shownCount;
  previewIdRef.current = previewId;
  stepRef.current = step;

  const groups = useMemo(() => groupCoursesByCode(catalogCourses), [catalogCourses]);
  const poolKeys = useMemo(() => new Set(groups.map((group) => group.key)), [groups]);
  // Saved picks must not be erased before the store has loaded, so only a loaded pool prunes.
  const poolLoaded = useSyncExternalStore(
    (onChange) => useScheduleStore.persist.onFinishHydration(onChange),
    () => useScheduleStore.persist.hasHydrated(),
    () => true,
  );
  const selection = useMemo(
    () => settledGeneratorSelection(picked, pinned, poolKeys, poolLoaded),
    [picked, pinned, poolKeys, poolLoaded],
  );
  useEffect(() => {
    if (!poolLoaded) return;
    if (selection.picked.length !== picked.size) setPicked(new Set(selection.picked));
    if (selection.pinned.length !== pinned.size) setPinned(new Set(selection.pinned));
  }, [poolLoaded, selection, picked.size, pinned.size]);
  const activePicked = useMemo(() => new Set(selection.picked), [selection]);
  const activePinned = useMemo(() => new Set(selection.pinned), [selection]);
  const filteredGroups = useMemo(
    () => groups.filter((group) => matchesQuery(group, query.trim().toLowerCase())),
    [groups, query],
  );
  const pickedGroups = useMemo(
    () => groups.filter((group) => activePicked.has(group.key)),
    [groups, activePicked],
  );

  const courseMin = selection.courseMin;
  const courseMax = selection.courseMax;
  const courseCount = Math.min(courseMax, Math.max(courseMin, prefs.courseCount));
  const pinnedCreditMin = pickedGroups
    .filter((group) => activePinned.has(group.key))
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
    const draft = {
      step: persistedGeneratorStep(step, result),
      picked: selection.picked,
      pinned: selection.pinned,
      lockedIds,
      excludedIds,
      blocked,
      result,
      previewId,
      shownCount,
      courseStamp,
      outdated,
    };
    const next = withCourseFreshness(draft, catalogCourses);
    writeGeneratorSession(next);
    if (next.outdated !== outdated) setOutdated(next.outdated);
  }, [
    step,
    picked,
    pinned,
    lockedIds,
    excludedIds,
    blocked,
    result,
    previewId,
    shownCount,
    courseStamp,
    outdated,
    catalogCourses,
  ]);

  useEffect(() => {
    if (!courseStamp) return;
    const changed = stampPickedCourses(catalogCourses, selection.picked) !== courseStamp;
    if (!changed) return;
    cancelRef.current?.();
    cancelRef.current = null;
    setRunning(false);
    if (resultRef.current) {
      setOutdated(true);
      return;
    }
    searchRef.current = null;
    holdGeneratorSearch(null);
    setCourseStamp(null);
    setStep(2);
  }, [catalogCourses, courseStamp, selection.picked]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      return;
    }
    cancelRef.current?.();
    cancelRef.current = null;
    setRunning(false);
    if (!resultRef.current && stepRef.current === 3) {
      searchRef.current = null;
      holdGeneratorSearch(null);
      setCourseStamp(null);
      setStep(2);
    }
  }, [isOpen]);

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

  useEffect(() => () => cancelRef.current?.(), []);

  const clearResults = () => {
    cancelRef.current?.();
    cancelRef.current = null;
    searchRef.current = null;
    holdGeneratorSearch(null);
    resultRef.current = null;
    previewIdRef.current = null;
    shownCountRef.current = MAX_RESULTS;
    setRunning(false);
    setResult(null);
    setPreviewId(null);
    setOutdated(false);
    setCourseStamp(null);
    setShownCount(MAX_RESULTS);
  };

  const paintSearch = (search: GeneratorSearch, revealNew: boolean) => {
    const next = search.result();
    const merged = mergeSearchResults(resultRef.current, next, shownCountRef.current, revealNew);
    if (merged.shownCount !== shownCountRef.current) {
      shownCountRef.current = merged.shownCount;
      setShownCount(merged.shownCount);
    }
    const painted = merged.plans === next.plans ? next : { ...next, plans: merged.plans };
    resultRef.current = painted;
    setResult(painted);
    setChecked(search.evaluated);
  };

  const runSearch = (search: GeneratorSearch, mode: 'fresh' | 'deeper') => {
    let timer = 0;
    let frame = 0;
    let cancelled = false;
    let lastPaint = 0;
    const tick = () => {
      if (cancelled) return;
      const started = performance.now();
      while (!search.done && performance.now() - started < 12) search.advance(60);
      if (cancelled) return;
      setChecked(search.evaluated);
      const now = performance.now();
      if (search.done || (mode === 'deeper' && now - lastPaint >= 100)) {
        paintSearch(search, mode === 'deeper');
        lastPaint = now;
      }
      if (search.done) {
        setRunning(false);
        cancelRef.current = null;
        return;
      }
      timer = window.setTimeout(tick, 0);
    };
    cancelRef.current = () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
    // Paint the progress indicator before the first slice of work.
    frame = window.requestAnimationFrame(() => {
      timer = window.setTimeout(tick, 0);
    });
  };

  const patchPrefs = (patch: Partial<StoredGeneratorPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveGeneratorPrefs(next);
      return next;
    });
    clearResults();
  };

  const liveKeys = (keys: Set<string>) => {
    const next = new Set<string>();
    for (const item of keys) if (poolKeys.has(item)) next.add(item);
    return next;
  };

  const togglePicked = (key: string) => {
    setPicked((prev) => {
      const next = liveKeys(prev);
      if (next.has(key)) {
        next.delete(key);
        setPinned((pins) => {
          if (!pins.has(key)) return pins;
          const copy = liveKeys(pins);
          copy.delete(key);
          return copy;
        });
      } else if (next.size < MAX_CANDIDATES) {
        next.add(key);
      }
      return next;
    });
    clearResults();
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
      pinBeforeLock.current.set(groupKey, activePinned.has(groupKey));
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
    if (before === undefined || !activePicked.has(groupKey)) return;
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
    clearResults();
    if (activePinned.has(key)) {
      if (lockedGroupKeys.has(key)) return;
      setPinned((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      return;
    }
    if (!activePicked.has(key) && selection.atCap) return;
    if (!activePicked.has(key)) {
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
    clearResults();
    if (shouldClearVisiblePicks(visible, activePicked)) {
      setPicked((prev) => {
        const next = liveKeys(prev);
        for (const key of visible) next.delete(key);
        return next;
      });
      setPinned((prev) => {
        const next = liveKeys(prev);
        for (const key of visible) next.delete(key);
        return next;
      });
      return;
    }
    setPicked((prev) => {
      const next = liveKeys(prev);
      for (const key of visible) {
        if (next.size >= MAX_CANDIDATES) break;
        next.add(key);
      }
      return next;
    });
  };

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
    clearResults();
    setStep(3);
    setDayOffNoticeDismissed(false);
    setChecked(0);
    const stamp = stampPickedCourses(catalogCourses, selection.picked);
    setCourseStamp(stamp);
    setShownCount(MAX_RESULTS);
    shownCountRef.current = MAX_RESULTS;
    setRunning(true);

    const lunchStart = timeToMinutes(prefs.lunchStart);
    const lunchEnd = timeToMinutes(prefs.lunchEnd);
    const classStart = prefs.classHoursEnabled && prefs.classStart ? timeToMinutes(prefs.classStart) : null;
    const classEnd = prefs.classHoursEnabled && prefs.classEnd ? timeToMinutes(prefs.classEnd) : null;
    const search: GeneratorSearch = startGeneratorSearch({
      groups: pickedGroups,
      pinnedKeys: selection.pinned,
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
        dailyCap: prefs.dailyCapEnabled ? prefs.dailyCourseCap : null,
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
    searchRef.current = search;
    holdGeneratorSearch(search);
    runSearch(search, 'fresh');
  };

  const handleShowMore = () => {
    setShownCount((count) => {
      const next = nextShownCount(count, resultRef.current?.plans.length ?? count);
      shownCountRef.current = next;
      return next;
    });
  };

  const handleSearchDeeper = () => {
    const search = searchRef.current;
    if (!search || running || outdated) return;
    if (search.capped || search.done) search.raiseLimit(MAX_EVALUATIONS);
    if (search.done) return;
    setRunning(true);
    runSearch(search, 'deeper');
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
    if (next === 2 && selection.pickedCount < 2) return;
    if (next !== 3) stopSearch();
    setStep(next);
  };

  const lunch = prefs.lunchEnabled
    ? { start: timeToMinutes(prefs.lunchStart), end: timeToMinutes(prefs.lunchEnd) }
    : null;
  const visibleCount = result ? Math.min(shownCount, result.plans.length) : 0;
  const liveSearch = searchRef.current;
  const canSearchDeeper = Boolean(
    result
    && !outdated
    && !running
    && liveSearch
    && (liveSearch.capped || !liveSearch.done)
  );

  const footer = (
    <div className="up-gen-foot">
      {step === 1 && (
        <>
          <span className="up-gen-foot-meta">{selection.pickedCount} picked · {selection.pinnedCount} pinned</span>
          <button
            type="button"
            className="up-gen-primary up-chrome-btn"
            disabled={selection.pickedCount < 2}
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
              : result && result.plans.length > 0
                ? `top ${visibleCount}`
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
        canPreferences={selection.pickedCount >= 2}
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
              picked={activePicked}
              pinned={activePinned}
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
              pickedCount={selection.pickedCount}
              pinnedCount={selection.pinnedCount}
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
              onMore={(open) => {
                setMoreOpen(open);
                if (!open || prefs.classHoursEnabled) return;
                patchPrefs({
                  classHoursEnabled: true,
                  classStart: prefs.classStart ?? '10:00',
                  classEnd: prefs.classEnd ?? '15:00',
                });
              }}
              onAddBlocked={() => {
                blockSeq.current += 1;
                setBlocked((prev) => [...prev, {
                  id: `block_${blockSeq.current}`,
                  day: 'monday',
                  start: '09:00',
                  end: '10:00',
                }]);
                clearResults();
              }}
              onChangeBlocked={(id, patch) => {
                setBlocked((prev) => prev.map((block) => (block.id === id ? { ...block, ...patch } : block)));
                clearResults();
              }}
              onRemoveBlocked={(id) => {
                setBlocked((prev) => prev.filter((block) => block.id !== id));
                clearResults();
              }}
              onLock={(id) => {
                const group = groupForSection(id);
                setLockedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
                setExcludedIds((prev) => prev.filter((item) => item !== id));
                if (group) rememberAndPin(group.key);
                clearResults();
              }}
              onUnlock={(id) => {
                const group = groupForSection(id);
                const next = lockedIds.filter((item) => item !== id);
                setLockedIds(next);
                if (group) restoreIfReleased(group.key, next);
                clearResults();
              }}
              onExclude={(id) => {
                const group = groupForSection(id);
                const nextLocks = lockedIds.filter((item) => item !== id);
                setExcludedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
                setLockedIds(nextLocks);
                if (group) restoreIfReleased(group.key, nextLocks);
                clearResults();
              }}
              onUnexclude={(id) => {
                setExcludedIds((prev) => prev.filter((item) => item !== id));
                clearResults();
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
              onTogglePreview={(id) => {
                setPreviewId((prev) => {
                  const next = prev === id ? null : id;
                  previewIdRef.current = next;
                  return next;
                });
              }}
              onSave={handleSave}
              onOpen={handleOpenSaved}
              noticeDismissed={dayOffNoticeDismissed}
              onDismissNotice={() => setDayOffNoticeDismissed(true)}
              shownCount={shownCount}
              outdated={outdated}
              canSearchDeeper={canSearchDeeper}
              onShowMore={handleShowMore}
              onSearchDeeper={handleSearchDeeper}
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
            {...sheetDrag.sheetProps}
          >
            <button type="button" className="up-pool-handle-hit" {...sheetDrag.handleProps} onClick={onClose} aria-label="Close generate plans">
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
