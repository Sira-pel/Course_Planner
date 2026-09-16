import React from 'react';
import { Copy, Check } from 'lucide-react';
import { TextExportFormat } from '../../utils/textExport';

interface TextExportTabProps {
  textFormat: TextExportFormat;
  copiedText: boolean;
  generatedText: string;
  onFormat: (f: TextExportFormat) => void;
  onCopy: () => void;
}

export const TextExportTab: React.FC<TextExportTabProps> = ({
  textFormat,
  copiedText,
  generatedText,
  onFormat,
  onCopy,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => onFormat('standard')}
            className={`flex-1 sm:flex-none px-2.5 py-1 rounded-md font-medium transition-colors text-center ${
              textFormat === 'standard'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Standard
          </button>
          <button
            type="button"
            onClick={() => onFormat('compact')}
            className={`flex-1 sm:flex-none px-2.5 py-1 rounded-md font-medium transition-colors text-center ${
              textFormat === 'compact'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Compact
          </button>
          <button
            type="button"
            onClick={() => onFormat('by-day')}
            className={`flex-1 sm:flex-none px-2.5 py-1 rounded-md font-medium transition-colors text-center ${
              textFormat === 'by-day'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Day-by-Day
          </button>
        </div>

        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
        >
          {copiedText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedText ? 'Copied to Clipboard!' : 'Copy as Text'}</span>
        </button>
      </div>

      <pre className="p-3 font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
        {generatedText}
      </pre>
      <p className="text-[11px] text-slate-600 dark:text-slate-300">
        Formatted without emojis for universal compatibility with chat apps, SMS, and advisors.
      </p>
    </div>
  );
};
