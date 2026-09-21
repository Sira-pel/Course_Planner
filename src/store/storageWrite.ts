export type StorageWriteFailureKind = 'quota' | 'private' | 'generic';

let current: StorageWriteFailureKind | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function isQuotaLikeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, code } = error as { name?: string; code?: number };
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
  );
}

function isSecurityLikeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, code } = error as { name?: string; code?: number };
  return name === 'SecurityError' || code === 18;
}

function storageLooksUnavailable(): boolean {
  try {
    return typeof localStorage === 'undefined' || localStorage.length === 0;
  } catch {
    return true;
  }
}

export function classifyStorageWriteError(error: unknown): StorageWriteFailureKind {
  if (isSecurityLikeError(error)) return 'private';
  if (isQuotaLikeError(error)) {
    return storageLooksUnavailable() ? 'private' : 'quota';
  }
  return 'generic';
}

export function getStorageWriteError(): StorageWriteFailureKind | null {
  return current;
}

export function subscribeStorageWriteError(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function reportStorageWriteFailure(error: unknown): void {
  current = classifyStorageWriteError(error);
  emit();
}

export function clearStorageWriteFailure(): void {
  if (current === null) return;
  current = null;
  emit();
}

export function storageWriteErrorMessage(kind: StorageWriteFailureKind): string {
  switch (kind) {
    case 'quota':
      return 'Couldn’t save your schedule — this browser is out of storage space. Export a backup or free some space.';
    case 'private':
      return 'Couldn’t save your schedule — this browser is blocking storage (private/incognito). Export a backup before you close the tab.';
    case 'generic':
      return 'Couldn’t save your schedule to this browser. Changes may be lost if you refresh.';
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}
