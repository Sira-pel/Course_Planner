import React, { useState, useEffect } from 'react';
import { SchedulePlan } from '../types/schedule';
import { initAuth, googleSignIn, getAccessToken, logout } from '../utils/auth';
import { syncScheduleToGoogleCalendar } from '../utils/googleCalendarSync';
import { User } from 'firebase/auth';
import { Calendar, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface GoogleCalendarSyncProps {
  activePlan: SchedulePlan;
  semesterStart: string;
  semesterEnd: string;
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

  useEffect(() => {
    const unsubscribe = initAuth(
      (u) => {
        setUser(u);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setSyncError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setSyncError(err.message || 'Failed to sign in with Google');
    } finally {
      setIsLoggingIn(false);
    }
  };
  
  const handleLogout = async () => {
    await logout();
    setSyncSuccess(false);
  };

  const handleSync = async () => {
    setSyncError(null);
    setSyncSuccess(false);
    
    // Check if courses exist
    if (!activePlan.courses || activePlan.courses.length === 0) {
      setSyncError('Your schedule has no courses to sync.');
      return;
    }
    
    const sessionCount = activePlan.courses.reduce((acc, c) => acc + (c.sessions?.length || 0), 0);
    if (sessionCount === 0) {
      setSyncError('Your courses have no class sessions to sync.');
      return;
    }

    const confirmed = window.confirm(
      `This will create a new calendar in your Google account called "${activePlan.name} - Uniplan" and add your class sessions to it. Do you want to proceed?`
    );
    if (!confirmed) return;

    setIsSyncing(true);
    try {
      await syncScheduleToGoogleCalendar(activePlan, semesterStart, semesterEnd, (msg) => {
        setSyncProgress(msg);
      });
      setSyncSuccess(true);
      setSyncProgress('Successfully synced to Google Calendar!');
    } catch (err: any) {
      console.error('Sync failed:', err);
      setSyncError(err.message || 'Failed to sync to Google Calendar');
      
      // If unauthorized, token might be expired/revoked
      if (err.message?.includes('authenticated') || err.message?.includes('401')) {
        setNeedsAuth(true);
        setUser(null);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-700">
      <div className="flex flex-col mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Direct Google Calendar Sync
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          Automatically create a new calendar and preserve course colors natively through the Google Calendar API.
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
                  className="text-[10px] text-slate-500 hover:text-rose-500 text-left transition-colors w-max"
                >
                  Sign out
                </button>
              </div>

              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed shrink-0"
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

            {syncSuccess && (
              <div className="flex items-start gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  <strong>Success!</strong> A new calendar "{activePlan.name} - Uniplan" was created in your Google Calendar account. Check your calendar app!
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
      </div>
    </div>
  );
};
