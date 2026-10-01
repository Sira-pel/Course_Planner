import React, { useState, useMemo, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
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
  Share2,
  Check,
  Copy,
} from 'lucide-react';
import { encodePlanToShareUrl } from '../../utils/shareLink';
import { TextExportTab } from './TextExportTab';
import { IcsExportTab } from './IcsExportTab';
import { ImageExportTab } from './ImageExportTab';
import { BackupTab } from './BackupTab';
import { FriendShareImportTab } from '../import/FriendShareImportTab';

export type ExportTabType = 'text' | 'share' | 'ics' | 'image' | 'backup';

interface ExportModalProps {
  isOpen: boolean;
  initialTab?: ExportTabType;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, initialTab = 'text', onClose }) => {
  if (!isOpen) return null;
  return <ExportModalBody initialTab={initialTab} onClose={onClose} />;
};

const ExportModalBody: React.FC<{ initialTab?: ExportTabType; onClose: () => void }> = ({ initialTab = 'text', onClose }) => {
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
    importPlan,
  } = useScheduleStore(
    useShallow((state) => ({
      plans: state.plans,
      activePlanId: state.activePlanId,
      catalogCourses: state.catalogCourses,
      showWeekends: state.showWeekends,
      startHour: state.startHour,
      endHour: state.endHour,
      theme: state.theme,
      semesterStart: state.semesterStart,
      semesterEnd: state.semesterEnd,
      setSemesterDates: state.setSemesterDates,
      importFullState: state.importFullState,
      importPlan: state.importPlan,
    }))
  );
  const activePlan = useMemo(() => plans.find((p) => p.id === activePlanId) || plans[0], [plans, activePlanId]);

  // Close modal when user presses Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const [activeTab, setActiveTab] = useState<ExportTabType>(initialTab);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const shareUrl = useMemo(() => (activePlan ? encodePlanToShareUrl(activePlan) : ''), [activePlan]);

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShareUrl(true);
      setTimeout(() => setCopiedShareUrl(false), 2000);
    } catch {
      // Fallback
    }
  };

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
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full min-w-0 p-4 sm:p-6 my-auto max-h-[calc(100dvh-1.25rem)] sm:max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="min-w-0 pr-2">
            <h2 id="export-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
              Export Schedule & Backup
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
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

        {/* Tab Switcher - 2-col on mobile portrait, 5-col on landscape/tablets, flex row on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-5 md:flex md:items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mt-3 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            title="Clean Text"
            className={`py-2 sm:py-1.5 px-2 md:px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center min-w-0 md:flex-1 md:min-w-max md:shrink-0 ${
              activeTab === 'text'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate md:whitespace-nowrap">Clean Text</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('share')}
            title="Share Link"
            className={`py-2 sm:py-1.5 px-2 md:px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center min-w-0 md:flex-1 md:min-w-max md:shrink-0 ${
              activeTab === 'share'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate md:whitespace-nowrap">Share Link</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ics')}
            title="Google Calendar (.ics)"
            className={`py-2 sm:py-1.5 px-2 md:px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center min-w-0 md:flex-1 md:min-w-max md:shrink-0 ${
              activeTab === 'ics'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="md:hidden truncate">Google Cal (.ics)</span>
            <span className="hidden md:inline md:whitespace-nowrap">Google Calendar (.ics)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('image');
              if (!imagePreviewUrl) handleGeneratePreviewImage();
            }}
            title="PNG Snapshot"
            className={`py-2 sm:py-1.5 px-2 md:px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center min-w-0 md:flex-1 md:min-w-max md:shrink-0 ${
              activeTab === 'image'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Image className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate md:whitespace-nowrap">PNG Snapshot</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            title="JSON Backup"
            className={`col-span-2 sm:col-span-1 py-2 sm:py-1.5 px-2 md:px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center min-w-0 md:flex-1 md:min-w-max md:shrink-0 ${
              activeTab === 'backup'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate md:whitespace-nowrap">JSON Backup</span>
          </button>
        </div>

        {/* Tab Body - Scrollable Container */}
        <div className="flex-1 overflow-y-auto min-h-0 pt-3 pr-1 sm:pr-2">
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

          {/* Tab 2: Share Link (Send to friends or paste friend link) */}
          {activeTab === 'share' && (
            <div className="space-y-4 min-w-0">
              <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Share2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <h3 className="font-bold text-xs text-indigo-950 dark:text-indigo-200">
                    Shareable Friend Comparison Link
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Send this link to classmates or friends. When they open it, Uniplan lets them compare your schedule side-by-side as a ghost overlay or save it to their plans. No account or backend required!
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2.5 min-w-0">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Your Shareable Schedule Link
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 min-w-0 px-3 py-2 text-base sm:text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 select-all focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleCopyShareUrl}
                    className="w-full sm:w-auto px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-xs up-chrome-btn"
                  >
                    {copiedShareUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-700 dark:text-slate-300">
                    How it works:
                  </div>
                  <div>• Your active schedule (<strong>{activePlan?.name}</strong>) is encoded safely into the link.</div>
                  <div>• Your friend opens the link and sees their schedule and yours superimposed in different colors.</div>
                  <div>• Both of you can adjust course times in real time to resolve conflicts together!</div>
                </div>
              </div>

              {/* Friend's Share Link Input Space */}
              <div className="min-w-0">
                <FriendShareImportTab
                  onCompareWithSchedule={(plan) => {
                    importPlan(plan, true);
                    onClose();
                  }}
                  onOpenAsActivePlan={(plan) => {
                    importPlan(plan, false);
                    onClose();
                  }}
                />
              </div>
            </div>
          )}

          {/* Tab 3: Google Calendar / Apple Calendar (.ics) */}
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
