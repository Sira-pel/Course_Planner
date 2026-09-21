import {
  initializeApp,
  getApps,
  getApp,
  FirebaseError,
  type FirebaseOptions,
} from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type Auth,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { clearAccessToken, getUsableAccessToken, rememberAccessToken } from './authToken';

export { clearAccessToken };

/**
 * Least privilege that still supports dedicated-calendar sync:
 * - calendar.app.created: create a secondary calendar and CRUD events only on
 *   calendars this app created (not the user's primary calendar or other apps).
 * - calendar.calendarlist.readonly: read calendar names/ids so we can reuse
 *   "{plan} - Uniplan" instead of creating a duplicate on every click.
 */
const CALENDAR_APP_CREATED_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
const CALENDAR_LIST_READONLY_SCOPE = 'https://www.googleapis.com/auth/calendar.calendarlist.readonly';

const KNOWN_AUTH_CODES = [
  'auth/popup-closed-by-user',
  'auth/popup-blocked',
  'auth/cancelled-popup-request',
] as const;

type KnownAuthCode = (typeof KNOWN_AUTH_CODES)[number];

let firebaseAuth: Auth | null = null;
let isSigningIn = false;
let inFlightSignIn: Promise<{ user: User; accessToken: string }> | null = null;

function toFirebaseOptions(config: typeof firebaseConfig): FirebaseOptions {
  const options: FirebaseOptions = {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  };
  if (config.measurementId) {
    options.measurementId = config.measurementId;
  }
  return options;
}

function getFirebaseAuth(): Auth {
  if (firebaseAuth) return firebaseAuth;
  const app = getApps().length > 0 ? getApp() : initializeApp(toFirebaseOptions(firebaseConfig));
  firebaseAuth = getAuth(app);
  return firebaseAuth;
}

function isKnownAuthCode(code: string): code is KnownAuthCode {
  return (KNOWN_AUTH_CODES as readonly string[]).includes(code);
}

function getErrorCode(error: unknown): string | null {
  if (error instanceof FirebaseError) return error.code;
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return null;
}

function messageForKnownAuthCode(code: KnownAuthCode): string {
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled. You can try again when you are ready.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in popup. Allow popups for this site and try again.';
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled because another sign-in was already in progress.';
    default: {
      const _never: never = code;
      throw new Error(`Unhandled auth error code: ${String(_never)}`);
    }
  }
}

export function mapFirebaseAuthError(error: unknown): string {
  const code = getErrorCode(error);
  if (code && isKnownAuthCode(code)) {
    return messageForKnownAuthCode(code);
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error during Google sign-in. Check your connection and try again.';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Failed to sign in with Google.';
}

function createCalendarProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope(CALENDAR_APP_CREATED_SCOPE);
  provider.addScope(CALENDAR_LIST_READONLY_SCOPE);
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

function readOauthExpireInSeconds(result: unknown): number | null {
  if (typeof result !== 'object' || result === null) return null;
  if (!('_tokenResponse' in result)) return null;
  const tokenResponse = (result as { _tokenResponse: unknown })._tokenResponse;
  if (typeof tokenResponse !== 'object' || tokenResponse === null) return null;
  if (!('oauthExpireIn' in tokenResponse)) return null;
  const expireIn = (tokenResponse as { oauthExpireIn: unknown }).oauthExpireIn;
  if (typeof expireIn !== 'number' || !Number.isFinite(expireIn) || expireIn <= 0) return null;
  return expireIn;
}

/**
 * Listen for Firebase session changes. A Firebase user without a usable
 * Calendar access token is treated as signed-out for Calendar sync.
 * Initializes Firebase on first call, not at module import.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
): Unsubscribe => {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      const token = getUsableAccessToken();
      if (token) {
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      clearAccessToken();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

async function runGoogleSignIn(): Promise<{ user: User; accessToken: string }> {
  isSigningIn = true;
  const auth = getFirebaseAuth();
  try {
    const result = await signInWithPopup(auth, createCalendarProvider());
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;
    if (!accessToken) {
      await auth.signOut();
      clearAccessToken();
      throw new Error(
        'Google did not grant Calendar access. Sign in again and allow calendar permissions.'
      );
    }

    const expireIn = readOauthExpireInSeconds(result);
    if (expireIn) {
      rememberAccessToken(accessToken, Math.max(0, expireIn * 1000 - 60_000));
    } else {
      rememberAccessToken(accessToken);
    }

    return { user: result.user, accessToken };
  } catch (error: unknown) {
    if (getUsableAccessToken() === null) {
      // Popup may have created a Firebase user without a Calendar token.
      try {
        if (auth.currentUser) await auth.signOut();
      } catch {
        // Keep the mapped sign-in error as the one we surface.
      }
      clearAccessToken();
    }
    throw new Error(mapFirebaseAuthError(error));
  } finally {
    isSigningIn = false;
  }
}

/** Must be called from a click or other user gesture. Overlapping clicks share one popup. */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  if (inFlightSignIn) return inFlightSignIn;
  inFlightSignIn = runGoogleSignIn().finally(() => {
    inFlightSignIn = null;
  });
  return inFlightSignIn;
};

export const getAccessToken = async (): Promise<string | null> => {
  return getUsableAccessToken();
};

export const logout = async (): Promise<void> => {
  clearAccessToken();
  if (!firebaseAuth) return;
  await firebaseAuth.signOut();
};
