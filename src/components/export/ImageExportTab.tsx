import React from 'react';
import { Download, Loader2 } from 'lucide-react';

interface ImageExportTabProps {
  imageTheme: 'light' | 'dark';
  imagePreviewUrl: string | null;
  generatingImage: boolean;
  onSetTheme: (theme: 'light' | 'dark') => void;
  onRefresh: () => void;
  onDownload: () => void;
}

export const ImageExportTab: React.FC<ImageExportTabProps> = ({
  imageTheme,
  imagePreviewUrl,
  generatingImage,
  onSetTheme,
  onRefresh,
  onDownload,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div
          role="radiogroup"
          aria-label="Image background"
          className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs self-start"
        >
          {(['light', 'dark'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={imageTheme === value}
              onClick={() => onSetTheme(value)}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                imageTheme === value
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {value === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download PNG</span>
        </button>
      </div>

      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 p-2 flex items-center justify-center min-h-[220px] sm:min-h-[280px]">
        {generatingImage ? (
          <div role="status" className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            Generating preview…
          </div>
        ) : imagePreviewUrl ? (
          <img
            src={imagePreviewUrl}
            alt="Schedule preview"
            className="max-h-72 sm:max-h-80 w-auto rounded shadow-xs border border-slate-200 dark:border-slate-800 object-contain"
          />
        ) : (
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold"
          >
            Generate preview
          </button>
        )}
      </div>
    </div>
  );
};
