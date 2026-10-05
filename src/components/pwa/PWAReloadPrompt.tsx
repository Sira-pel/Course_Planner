import React, { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { RefreshCw, X } from 'lucide-react';

export const PWAReloadPrompt: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateFnRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    let mounted = true;
    let intervalId: number | undefined;

    const updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh() {
        if (mounted) {
          setNeedRefresh(true);
        }
      },
      onRegistered(r) {
        if (r && mounted) {
          intervalId = window.setInterval(() => {
            r.update();
          }, 60 * 60 * 1000);
        }
      },
      onRegisterError(error) {
        console.warn('SW registration error', error);
      },
    });

    updateFnRef.current = updateServiceWorker;

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  if (!needRefresh) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-slate-900/95 dark:bg-slate-800/95 text-white px-4 py-3 rounded-xl shadow-2xl border border-indigo-500/40 text-xs backdrop-blur-md animate-fade-in"
    >
      <div className="flex flex-col">
        <span className="font-semibold text-white">Update available</span>
        <span className="text-slate-300 text-[11px]">A newer version of Uniplan is ready.</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => updateFnRef.current?.(true)}
          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center gap-1 transition-colors shadow-xs"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Reload</span>
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="p-1 text-slate-400 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
