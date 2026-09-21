import React, { useState, useMemo } from 'react';
import { PERSIST_SCHEMA_VERSION } from '../../store/persist';
import { useScheduleStore } from '../../store/useScheduleStore';
import { Course } from '../../types/schedule';
import { generateScheduleText, TextExportFormat } from '../../utils/textExport';
import { downloadIcsFile, downloadCourseIcsFile } from '../../utils/icsExport';
import { downloadScheduleImage, exportScheduleToImage } from '../../utils/imageExport';
import {
  X,
  Calendar,
  Image,
  FileText,
  Database,
} from 'lucide-react';
import { TextExportTab } from './TextExportTab';
import { IcsExportTab } from './IcsExportTab';
import { ImageExportTab } from './ImageExportTab';
import { BackupTab } from './BackupTab';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'text' | 'ics' | 'image' | 'backup';

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const {
    plans,
    activePlanId,
    catalogCourses,
    showWeekends,
    startHour,
    endHour,
    theme,
    semesterStart,
    semesterEnd,
    setSemesterDates,
    importFullState,
  } = useScheduleStore();
  const activePlan = useMemo(() => plans.find((p) => p.id === activePlanId) || plans[0], [plans, activePlanId]);

  const [activeTab, setActiveTab] = useState<TabType>('text');

  // Text Export State
  const [textFormat, setTextFormat] = useState<TextExportFormat>('standard');
  const [copiedText, setCopiedText] = useState(false);

  // Image Export State
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageTheme, setImageTheme] = useState<'light' | 'dark'>(theme);

  // Backup State
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  // Memoize generated text so it only recalculates when activePlan or textFormat changes
  const generatedText = useMemo(() => {
    if (!activePlan) return '';
    return generateScheduleText(activePlan, textFormat);
  }, [activePlan, textFormat]);

  if (!isOpen) return null;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch (e) {
      // Fallback
    }
  };

  const handleDownloadIcs = () => {
    downloadIcsFile(activePlan, semesterStart, semesterEnd);
  };

  const handleDownloadCourseIcs = (course: Course) => {
    downloadCourseIcsFile(activePlan, course, semesterStart, semesterEnd);
  };

  const handleGeneratePreviewImage = async () => {
    setGeneratingImage(true);
    try {
      const url = await exportScheduleToImage(activePlan, {
        theme: imageTheme,
        showWeekends,
        startHour,
        endHour,
      });
      setImagePreviewUrl(url);
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleDownloadImage = async () => {
    await downloadScheduleImage(activePlan, {
      theme: imageTheme,
      showWeekends,
      startHour,
      endHour,
    });
  };

  const handleDownloadBackup = () => {
    const backupData = {
      version: PERSIST_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      activePlanId,
      plans,
      catalogCourses,
      showWeekends,
      startHour,
      endHour,
      theme,
      semesterStart,
      semesterEnd,
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Uniplan_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setImportJson(content);
        setImportError(null);
      }
    };
    reader.onerror = () => {
      setImportError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleApplyImport = () => {
    setImportError(null);
    setImportSuccess(false);
    if (!importJson.trim()) {
      setImportError('Please paste or upload a valid JSON backup string');
      return;
    }
    const res = importFullState(importJson);
    if (res.success) {
      setImportSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setImportError(res.error || 'Failed to parse JSON backup');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-4 sm:p-6 my-auto max-h-[calc(100dvh-1.25rem)] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="min-w-0 pr-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
              Export Schedule & Backup
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
              Exporting: <strong className="text-indigo-600 dark:text-indigo-400">{activePlan.name}</strong> ({activePlan.courses.length} courses)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher - Responsive 2x2 grid on mobile, 4-col on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mt-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`py-2 sm:py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center ${
              activeTab === 'text'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Clean Text</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ics')}
            className={`py-2 sm:py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center ${
              activeTab === 'ics'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Google Cal (.ics)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('image');
              if (!imagePreviewUrl) handleGeneratePreviewImage();
            }}
            className={`py-2 sm:py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center ${
              activeTab === 'image'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Image className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">PNG Snapshot</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`py-2 sm:py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center ${
              activeTab === 'backup'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">JSON Backup</span>
          </button>
        </div>

        {/* Tab Body - Scrollable Container */}
        <div className="flex-1 overflow-y-auto min-h-0 pt-3 pr-0.5">
          {/* Tab 1: Clean Text (For Discord / WhatsApp / Advisors) */}
          {activeTab === 'text' && (
            <TextExportTab
              textFormat={textFormat}
              copiedText={copiedText}
              generatedText={generatedText}
              onFormat={setTextFormat}
              onCopy={handleCopyText}
            />
          )}

          {/* Tab 2: Google Calendar / Apple Calendar (.ics) */}
          {activeTab === 'ics' && (
            <IcsExportTab
              activePlan={activePlan}
              semesterStart={semesterStart}
              semesterEnd={semesterEnd}
              onSemesterStart={(start) => setSemesterDates(start, semesterEnd)}
              onSemesterEnd={(end) => setSemesterDates(semesterStart, end)}
              onDownloadIcs={handleDownloadIcs}
              onDownloadCourseIcs={handleDownloadCourseIcs}
            />
          )}

          {/* Tab 3: High-Res PNG Image */}
          {activeTab === 'image' && (
            <ImageExportTab
              imageTheme={imageTheme}
              imagePreviewUrl={imagePreviewUrl}
              generatingImage={generatingImage}
              onToggleTheme={() => {
                const next = imageTheme === 'light' ? 'dark' : 'light';
                setImageTheme(next);
              }}
              onRefresh={handleGeneratePreviewImage}
              onDownload={handleDownloadImage}
            />
          )}

          {/* Tab 4: JSON Backup & Restore */}
          {activeTab === 'backup' && (
            <BackupTab
              importJson={importJson}
              importError={importError}
              importSuccess={importSuccess}
              onImportJsonChange={setImportJson}
              onFileUpload={handleFileUpload}
              onDownloadBackup={handleDownloadBackup}
              onApplyImport={handleApplyImport}
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-center"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
