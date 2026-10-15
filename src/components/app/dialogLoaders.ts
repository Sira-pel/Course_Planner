import type { ComponentType } from 'react';

type DialogModule<T> = { default: T };

export interface DialogLoader<T extends ComponentType<never>> {
  (): Promise<DialogModule<T>>;
  /** True while this loader's import is already in flight or cached. */
  started(): boolean;
}

/** Imports kicked off by the idle prefetch. Their failures must not reload the page. */
let idlePrefetchImports = 0;

export function isIdleDialogPrefetch(): boolean {
  return idlePrefetchImports > 0;
}

/**
 * One promise per dialog. An early tap, the idle prefetch, and React.lazy
 * all share it, so the download starts once and is not kicked off while the
 * shell is still evaluating.
 */
export function memoizedLoader<T extends ComponentType<never>>(
  load: () => Promise<DialogModule<T>>,
): DialogLoader<T> {
  let pending: Promise<DialogModule<T>> | undefined;
  const run = (() => {
    if (!pending) {
      const next = load();
      pending = next;
      next.catch(() => {
        if (pending === next) pending = undefined;
      });
    }
    return pending;
  }) as DialogLoader<T>;
  run.started = () => pending !== undefined;
  return run;
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
  for (const load of Object.values(DIALOG_LOADERS)) {
    // A tap already started this import. Leave it as a user-started load.
    if (load.started()) {
      void load().catch(() => {});
      continue;
    }
    idlePrefetchImports += 1;
    void load().then(
      () => {
        idlePrefetchImports -= 1;
      },
      () => {
        idlePrefetchImports -= 1;
      },
    );
  }
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
