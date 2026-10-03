import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../utils/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-slate-900/95 dark:bg-slate-800/95 text-amber-300 dark:text-amber-200 px-3.5 py-2 text-xs font-medium shadow-lg border border-amber-500/30 backdrop-blur-md animate-fade-in"
    >
      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
      <span>Offline Mode — Running from local cache. All edits stay saved.</span>
    </div>
  );
};
