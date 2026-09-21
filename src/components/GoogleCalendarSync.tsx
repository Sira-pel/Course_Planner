import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { AlertCircle, Calendar, CheckCircle2, RefreshCw, X } from 'lucide-react';
import { SchedulePlan } from '../types/schedule';
import { getAccessToken, googleSignIn, initAuth, logout, mapFirebaseAuthError } from '../utils/auth';
import {
  isCalendarAbortError,
  isCalendarAuthError,
  syncScheduleToGoogleCalendar,
} from '../utils/googleCalendarSync';
import { uniplanCalendarSummary } from '../utils/calendarDates';

interface GoogleCalendarSyncProps {
  activePlan: SchedulePlan;
  semesterStart: string;
  semesterEnd: string;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export const GoogleCalendarSync: React.FC<GoogleCalendarSyncProps> = ({
  activePlan,
  semesterStart,
  semesterEnd,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const [reusedCalendar, setReusedCalendar] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const loginLockRef = useRef(false);
  const syncLockRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = initAuth(
        (u) => {
          if (!mountedRef.current) return;
          setUser(u);
          setNeedsAuth(false);
        },
        () => {
          if (!mountedRef.current) return;
          setUser(null);
          setNeedsAuth(true);
        }
      );
    } catch (error: unknown) {
      if (mountedRef.current) {
        setSyncError(mapFirebaseAuthError(error));
      }
    }

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      unsubscribe?.();
    };
  }, []);

  const handleLogin = async () => {
    if (loginLockRef.current || isLoggingIn) return;
    loginLockRef.current = true;
    setIsLoggingIn(true);
    setSyncError(null);
    try {
      const result = await googleSignIn();
      if (!mountedRef.current) return;
      setUser(result.user);
      setNeedsAuth(false);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setSyncError(mapFirebaseAuthError(err));
      setNeedsAuth(true);
      setUser(null);
    } finally {
      loginLockRef.current = false;
      if (mountedRef.current) setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    abortRef.current?.abort();
    await logout();
    if (!mountedRef.current) return;
    setSyncSuccess(false);
    setSkippedCount(0);
  };

  const handleCancelSync = () => {
    abortRef.current?.abort();
  };

  const handleSync = async () => {
    if (syncLockRef.current || isSyncing) return;

    setSyncError(null);
    setSyncSuccess(false);
    setSkippedCount(0);
    setReusedCalendar(false);

    if (!activePlan.courses || activePlan.courses.length === 0) {
      setSyncError('Your schedule has no courses to sync.');
      return;
    }

    const sessionCount = activePlan.courses.reduce((acc, c) => acc + (c.sessions?.length || 0), 0);
    if (sessionCount === 0) {
      setSyncError('Your courses have no class sessions to sync.');
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      setUser(null);
      setSyncError('Google Calendar access expired. Please sign in again.');
      return;
    }

    const calendarName = uniplanCalendarSummary(activePlan.name);
    const confirmed = window.confirm(
      `This will sync your class sessions to a Google calendar named "${calendarName}". If that calendar already exists, it will be reused (previous Uniplan events on it are replaced). Continue?`
    );
    if (!confirmed) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    syncLockRef.current = true;
    setIsSyncing(true);
    setSyncProgress('Starting sync...');
    try {
      const result = await syncScheduleToGoogleCalendar(
        activePlan,
        semesterStart,
        semesterEnd,
        (msg) => {
          if (mountedRef.current) setSyncProgress(msg);
        },
        controller.signal
      );
      if (!mountedRef.current) return;
      setSyncSuccess(true);
      setReusedCalendar(result.reused);
      setSkippedCount(result.skippedCount);
      setSyncProgress('Successfully synced to Google Calendar!');
    } catch (err: unknown) {
      if (isCalendarAbortError(err)) {
        if (mountedRef.current) {
          setSyncProgress('');
          setSyncError(null);
        }
        return;
      }
      if (!mountedRef.current) return;
      setSyncError(errorMessage(err, 'Failed to sync to Google Calendar'));
      if (isCalendarAuthError(err)) {
        setNeedsAuth(true);
        setUser(null);
      }
    } finally {
      syncLockRef.current = false;
      if (mountedRef.current) setIsSyncing(false);
    }
  };

  const calendarName = uniplanCalendarSummary(activePlan.name);

  return (
    <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-700">
      <div className="flex flex-col mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Direct Google Calendar Sync
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          Create or reuse a dedicated calendar named like "{calendarName}" and copy class sessions with native Google Calendar colors.
        </p>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        {needsAuth ? (
          <div className="flex flex-col items-center justify-center py-2 space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-300 text-center max-w-xs">
              Sign in with your Google account to sync your schedule directly.
            </p>
            <button
              type="button"
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="gsi-material-button bg-white text-[#3c4043] border border-[#dadce0] rounded hover:bg-[#f8f9fa] flex items-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ width: '240px', height: '40px', padding: '0 12px' }}
            >
              <div className="flex items-center justify-center w-full gap-3">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 shrink-0 block">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
                <span className="text-sm font-medium tracking-wide">
                  {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
                </span>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  Connected as {user?.email}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isSyncing}
                  className="text-[10px] text-slate-500 hover:text-rose-500 text-left transition-colors w-max disabled:opacity-50"
                >
                  Sign out
                </button>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isSyncing && (
                  <button
                    type="button"
                    onClick={handleCancelSync}
                    className="flex items-center justify-center gap-1 px-3 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{syncProgress || 'Syncing...'}</span>
                    </>
                  ) : (
                    <>
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Sync Schedule</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {syncSuccess && (
              <div className="flex items-start gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  <strong>Success!</strong>{' '}
                  {reusedCalendar
                    ? `Updated the existing "${calendarName}" calendar in your Google account.`
                    : `Created "${calendarName}" in your Google Calendar account.`}
                  {skippedCount > 0
                    ? ` Skipped ${skippedCount} session${skippedCount === 1 ? '' : 's'} with missing or invalid times.`
                    : ''}
                </p>
              </div>
            )}
          </div>
        )}

        {syncError && (
          <div className="mt-3 flex items-start gap-2 p-2.5 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 rounded-lg text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="flex-1">{syncError}</p>
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <span>Google Calendar Integration</span>
          <div className="flex gap-2">
            <a
              href="/privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline hover:text-slate-600 dark:hover:text-slate-300"
            >
              Privacy Policy
            </a>
            <span>•</span>
            <a
              href="/terms.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline hover:text-slate-600 dark:hover:text-slate-300"
            >
              Terms
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
