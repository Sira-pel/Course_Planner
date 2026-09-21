import {
  classifyStorageWriteError,
  clearStorageWriteFailure,
  getStorageWriteError,
  reportStorageWriteFailure,
  storageWriteErrorMessage,
} from './storageWrite';
import type { StorageWriteFailureKind } from './storageWrite';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function installMemoryLocalStorage(length: number): void {
  const mem = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    get length() { return length; },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: mem, configurable: true });
}

installMemoryLocalStorage(3);

const quota = Object.assign(new Error('quota'), { name: 'QuotaExceededError', code: 22 });
assert(classifyStorageWriteError(quota) === 'quota', 'QuotaExceededError with existing keys is quota');

installMemoryLocalStorage(0);
assert(classifyStorageWriteError(quota) === 'private', 'QuotaExceededError with empty storage is private mode');

const security = Object.assign(new Error('blocked'), { name: 'SecurityError', code: 18 });
assert(classifyStorageWriteError(security) === 'private', 'SecurityError is private mode');

const firefox = Object.assign(new Error('quota'), { name: 'NS_ERROR_DOM_QUOTA_REACHED', code: 1014 });
installMemoryLocalStorage(2);
assert(classifyStorageWriteError(firefox) === 'quota', 'Firefox quota code is quota');

assert(classifyStorageWriteError(new Error('nope')) === 'generic', 'plain Error is generic');

const kinds: StorageWriteFailureKind[] = ['quota', 'private', 'generic'];
for (const kind of kinds) {
  assert(storageWriteErrorMessage(kind).length > 10, `${kind} has a user-facing message`);
}

clearStorageWriteFailure();
assert(getStorageWriteError() === null, 'warning starts empty');
reportStorageWriteFailure(quota);
assert(getStorageWriteError() === 'quota', 'report stores classified kind');
clearStorageWriteFailure();
assert(getStorageWriteError() === null, 'clear dismisses warning');

console.log('storageWrite tests passed');
