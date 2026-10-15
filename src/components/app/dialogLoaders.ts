import type { ComponentType } from 'react';

type DialogModule<T> = { default: T };

/**
 * One promise per dialog. An early tap, the idle prefetch, and React.lazy
 * all share it, so the download starts once and is not kicked off while the
 * shell is still evaluating.
 */
export function memoizedLoader<T extends ComponentType<never>>(
  load: () => Promise<DialogModule<T>>,
): () => Promise<DialogModule<T>> {
  let pending: Promise<DialogModule<T>> | undefined;
  return () => {
    if (!pending) {
      const next = load();
      pending = next;
      next.catch(() => {
        if (pending === next) pending = undefined;
      });
    }
    return pending;
  };
}

export const loadCourseModal = memoizedLoader(() =>
  import('../course-modal/CourseModal').then((m) => ({ default: m.CourseModal })),
);
export const loadExportModal = memoizedLoader(() =>
  import('../export/ExportModal').then((m) => ({ default: m.ExportModal })),
);
export const loadImportModal = memoizedLoader(() =>
  import('../import/ImportModal').then((m) => ({ default: m.ImportModal })),
);
export const loadHelpModal = memoizedLoader(() =>
  import('../HelpModal').then((m) => ({ default: m.HelpModal })),
);
export const loadShareImportModal = memoizedLoader(() =>
  import('../ShareImportModal').then((m) => ({ default: m.ShareImportModal })),
);
export const loadGenerateModal = memoizedLoader(() =>
  import('../generate/GeneratePlansModal').then((m) => ({ default: m.GeneratePlansModal })),
);

const DIALOG_LOADERS = {
  course: loadCourseModal,
  export: loadExportModal,
  import: loadImportModal,
  help: loadHelpModal,
  share: loadShareImportModal,
  generate: loadGenerateModal,
} as const;

export type DialogPrefetchName = keyof typeof DIALOG_LOADERS;

export function prefetchDialog(name: DialogPrefetchName): void {
  void DIALOG_LOADERS[name]();
}

export function prefetchAllDialogs(): void {
  for (const load of Object.values(DIALOG_LOADERS)) void load();
}

/** pointerdown on [data-dialog="course"] (space-separated names allowed). */
export function prefetchDialogsFromPointer(event: Event): void {
  const node = event.target instanceof Element ? event.target : null;
  const hit = node?.closest('[data-dialog]');
  if (!(hit instanceof HTMLElement)) return;
  const names = hit.dataset.dialog?.split(/\s+/) ?? [];
  for (const name of names) {
    if (name in DIALOG_LOADERS) prefetchDialog(name as DialogPrefetchName);
  }
}

/** After first paint. requestIdleCallback, or setTimeout where it is missing. */
export function scheduleIdle(task: () => void): () => void {
  const ric = window.requestIdleCallback;
  if (typeof ric === 'function') {
    const id = ric(() => task());
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, 1);
  return () => window.clearTimeout(id);
}
