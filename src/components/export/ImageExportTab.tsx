import React from 'react';
import { Download, Sparkles } from 'lucide-react';

interface ImageExportTabProps {
  imageTheme: 'light' | 'dark';
  imagePreviewUrl: string | null;
  generatingImage: boolean;
  onToggleTheme: () => void;
  onRefresh: () => void;
  onDownload: () => void;
}

export const ImageExportTab: React.FC<ImageExportTabProps> = ({
  imageTheme,
  imagePreviewUrl,
  generatingImage,
  onToggleTheme,
  onRefresh,
  onDownload,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Theme:</span>
          <button
            type="button"
            onClick={onToggleTheme}
            className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            {imageTheme === 'dark' ? 'Dark Background' : 'Light Background'}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="px-2 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Refresh
          </button>
        </div>

        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download High-Res PNG</span>
        </button>
      </div>

      {/* Preview container */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 p-2 flex items-center justify-center min-h-[180px] sm:min-h-[220px]">
        {generatingImage ? (
          <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 animate-spin text-indigo-600" />
            Generating crisp 2x retina schedule image...
          </div>
        ) : imagePreviewUrl ? (
          <img
            src={imagePreviewUrl}
            alt="Schedule Preview"
            className="max-h-52 sm:max-h-60 w-auto rounded shadow-xs border border-slate-200 dark:border-slate-800 object-contain"
          />
        ) : (
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold"
          >
            Click to Generate Snapshot Preview
          </button>
        )}
      </div>
      <p className="text-[11px] text-slate-600 dark:text-slate-300">
        High-DPI rendering is perfectly sized for lockscreens, printing, or sending to classmates.
      </p>
    </div>
  );
};
