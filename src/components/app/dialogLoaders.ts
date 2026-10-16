import {
  createElement,
  lazy,
  type ComponentProps,
  type ComponentType,
  type LazyExoticComponent,
} from 'react';

type DialogModule<T> = { default: T };

export type RetryableLazyComponent<T extends ComponentType<any>> = ComponentType<ComponentProps<T>> & {
  /** Swap in a fresh React.lazy wrapper so the next render retries a failed import. */
  reset: () => void;
};

/**
 * React.lazy remembers a rejected import for good. Keep the failed lazy wrapper
 * in place so the error boundary catches the rejection once instead of looping,
 * and only swap in a fresh lazy component when reset() is called to retry.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  load: () => Promise<DialogModule<T>>,
): RetryableLazyComponent<T> {
  const make = (): LazyExoticComponent<T> => lazy(load);
  let Inner: LazyExoticComponent<T> = make();
  const Retryable = ((props: ComponentProps<T>) =>
    createElement(Inner as ComponentType<ComponentProps<T>>, props)) as RetryableLazyComponent<T>;
  Retryable.reset = () => {
    Inner = make();
  };
  return Retryable;
}

export interface DialogLoader<T extends ComponentType<any>> {
  (): Promise<DialogModule<T>>;
  /** True while this loader's import is already in flight or cached. */
  started(): boolean;
}

/** Imports kicked off by the idle prefetch. Their failures must not reload the page. */
let idlePrefetchImports = 0;

export function isIdleDialogPrefetch(): boolean {
  return idlePrefetchImports > 0;
}

/** Chrome keeps a failed dynamic import for that exact URL until the page reloads. */
function moduleUrlFromError(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/https?:\/\/\S+/);
  if (!match) return undefined;
  try {
    const url = new URL(match[0].replace(/[),.;]+$/, ''));
    url.searchParams.delete('retry');
    return url.href;
  } catch {
    return undefined;
  }
}

function withRetryQuery(url: string, attempt: number): string {
  const parsed = new URL(url);
  parsed.searchParams.set('retry', String(attempt));
  return parsed.href;
}

/** A failed retry must not surface as an uncaught rejection. Callers still observe `pending`. */
function importRetried(failedUrl: string, attempt: number): Promise<unknown> {
  const pending = import(/* @vite-ignore */ withRetryQuery(failedUrl, attempt));
  void pending.catch(() => {});
  return pending;
}

/**
 * One promise per dialog. An early tap, the idle prefetch, and React.lazy
 * all share it, so the download starts once and is not kicked off while the
 * shell is still evaluating.
 * A failed fetch is remembered by the browser for that URL, so the next call
 * after a rejection imports the same chunk with a new `retry` query.
 */
export function memoizedLoader<M, T extends ComponentType<any>>(
  load: () => Promise<M>,
  adapt: (mod: M) => DialogModule<T>,
): DialogLoader<T> {
  let pending: Promise<DialogModule<T>> | undefined;
  let attempt = 0;
  let failedUrl: string | undefined;
  const run = (() => {
    if (!pending) {
      const source: Promise<M> = attempt > 0 && failedUrl
        ? importRetried(failedUrl, attempt) as Promise<M>
        : load();
      const next = source.then(adapt).catch((error: unknown) => {
        const url = moduleUrlFromError(error);
        if (url) failedUrl = url;
        attempt += 1;
        if (pending === next) pending = undefined;
        throw error;
      });
      pending = next;
    }
    return pending;
  }) as DialogLoader<T>;
  run.started = () => pending !== undefined;
  return run;
}

export const loadCourseModal = memoizedLoader(
  () => import('../course-modal/CourseModal'),
  (mod) => ({ default: mod.CourseModal }),
);
export const loadExportModal = memoizedLoader(
  () => import('../export/ExportModal'),
  (mod) => ({ default: mod.ExportModal }),
);
export const loadImportModal = memoizedLoader(
  () => import('../import/ImportModal'),
  (mod) => ({ default: mod.ImportModal }),
);
export const loadHelpModal = memoizedLoader(
  () => import('../HelpModal'),
  (mod) => ({ default: mod.HelpModal }),
);
export const loadShareImportModal = memoizedLoader(
  () => import('../ShareImportModal'),
  (mod) => ({ default: mod.ShareImportModal }),
);
export const loadGenerateModal = memoizedLoader(
  () => import('../generate/GeneratePlansModal'),
  (mod) => ({ default: mod.GeneratePlansModal }),
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
  void DIALOG_LOADERS[name]().catch(() => {});
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
