import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapFirebaseAuthError } from './auth';
import { clearAccessToken, getUsableAccessToken, rememberAccessToken } from './authToken';
import { getAccessToken } from './auth';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(
  mapFirebaseAuthError({ code: 'auth/popup-closed-by-user' }) ===
    'Sign-in was cancelled. You can try again when you are ready.',
  'popup-closed maps to a user-facing message'
);
assert(
  mapFirebaseAuthError({ code: 'auth/popup-blocked' }).includes('blocked'),
  'popup-blocked maps to a user-facing message'
);
assert(
  mapFirebaseAuthError({ code: 'auth/cancelled-popup-request' }).includes('already in progress'),
  'cancelled-popup-request maps to a user-facing message'
);
assert(
  mapFirebaseAuthError({ code: 'auth/network-request-failed' }).includes('Network error'),
  'network failure maps to a user-facing message'
);
assert(
  mapFirebaseAuthError(new Error('Google did not grant Calendar access. Sign in again and allow calendar permissions.')) ===
    'Google did not grant Calendar access. Sign in again and allow calendar permissions.',
  'plain Error message is preserved'
);
assert(mapFirebaseAuthError('nope') === 'Failed to sign in with Google.', 'unknown value gets a fallback');

clearAccessToken();
assert(getUsableAccessToken() === null, 'no token by default');
assert((await getAccessToken()) === null, 'getAccessToken is null without a cache');

rememberAccessToken('ya29.test-token');
assert(getUsableAccessToken() === 'ya29.test-token', 'stored token is usable');
assert((await getAccessToken()) === 'ya29.test-token', 'getAccessToken returns the cache');

rememberAccessToken('expired', 0);
assert(getUsableAccessToken() === null, 'expired token is treated as missing');
assert((await getAccessToken()) === null, 'getAccessToken returns null after expiry');

clearAccessToken();
assert(getUsableAccessToken() === null, 'clearAccessToken drops the cache');

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'auth.ts'), 'utf8');
assert(!src.includes('catch (error: any)'), 'auth.ts does not use any on errors');
assert(src.includes('calendar.app.created'), 'auth requests calendar.app.created');
assert(!/^initializeApp\(/m.test(src.split('function getFirebaseAuth')[0]), 'Firebase is not initialized at module scope');
assert(src.includes('inFlightSignIn'), 'overlapping sign-in clicks share one popup');
assert(src.includes('getUsableAccessToken()'), 'initAuth requires a real Calendar token before success');

console.log('auth tests passed');
