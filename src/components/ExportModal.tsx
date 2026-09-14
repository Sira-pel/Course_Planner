import React, { useState, useMemo } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { Course } from '../types/schedule';
import { generateScheduleText, TextExportFormat } from '../utils/textExport';
import { downloadIcsFile, downloadCourseIcsFile, getColorEmoji } from '../utils/icsExport';
import { parseIcsContent } from '../utils/icsImport';
import { downloadScheduleImage, exportScheduleToImage } from '../utils/imageExport';
import {
  X,
  Copy,
  Check,
  Calendar,
  Image,
  FileText,
  Database,
  Download,
  Upload,
  Sparkles,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'text' | 'ics' | 'image' | 'backup';

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const { plans, activePlanId, catalogCourses, showWeekends, startHour, endHour, theme, importFullState } =
    useScheduleStore();
  const activePlan = useMemo(() => plans.find((p) => p.id === activePlanId) || plans[0], [plans, activePlanId]);

  const [activeTab, setActiveTab] = useState<TabType>('text');

  // Text Export State
  const [textFormat, setTextFormat] = useState<TextExportFormat>('standard');
  const [copiedText, setCopiedText] = useState(false);

  // ICS Export State
  const [semesterStart, setSemesterStart] = useState('2026-09-01');
  const [semesterEnd, setSemesterEnd] = useState('2026-12-18');
  const [includeColorEmoji, setIncludeColorEmoji] = useState(true);

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
    downloadIcsFile(activePlan, semesterStart, semesterEnd, { includeColorEmoji });
  };

  const handleDownloadCourseIcs = (course: Course) => {
    downloadCourseIcsFile(activePlan, course, semesterStart, semesterEnd, { includeColorEmoji });
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
      version: 1,
      exportedAt: new Date().toISOString(),
      activePlanId,
      plans,
      catalogCourses,
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
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setTextFormat('standard')}
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
                    onClick={() => setTextFormat('compact')}
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
                    onClick={() => setTextFormat('by-day')}
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
                  onClick={handleCopyText}
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
          )}

          {/* Tab 2: Google Calendar / Apple Calendar (.ics) */}
          {activeTab === 'ics' && (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mb-3">
                  Generates standard <code>.ics</code> calendar files (RFC 5545 & RFC 7986) compatible with
                  Google Calendar, Apple Calendar, and Outlook with weekly recurring class sessions.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Semester Start Date
                    </label>
                    <input
                      type="date"
                      value={semesterStart}
                      onChange={(e) => setSemesterStart(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Semester End Date (Repeat Until)
                    </label>
                    <input
                      type="date"
                      value={semesterEnd}
                      onChange={(e) => setSemesterEnd(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Color Preservation Section */}
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
                        <span>Google Calendar Color Preservation</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        Google Calendar imports all events under the target calendar's single default color. Uniplan embeds matching color badges (🔵, 🟢, 🟡) directly in event titles and includes RFC 7986 / Apple / Outlook color properties so courses stay color-differentiated.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={includeColorEmoji}
                        onChange={(e) => setIncludeColorEmoji(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {/* Live Event Title Preview */}
                  {activePlan.courses.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                        Imported Event Title Preview:
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                        {activePlan.courses.map((course) => {
                          const badge = includeColorEmoji ? getColorEmoji(course.color) : null;
                          const codeSec = course.section ? `${course.code}-${course.section}` : course.code;
                          return (
                            <div
                              key={course.id}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-2xs"
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: course.color }}
                              />
                              <span className="font-mono font-medium">
                                {badge ? `${badge} ` : ''}{codeSec}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                                {course.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-3">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {activePlan.courses.length} courses ({activePlan.courses.reduce((acc, c) => acc + (c.sessions?.length || 0), 0)} weekly sessions)
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadIcs}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .ics Calendar File</span>
                  </button>
                </div>

                {/* Optional: Individual Course .ics Download */}
                {activePlan.courses.length > 1 && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Export Individual Course Calendars:
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        To import as separate colored calendars in Google Cal
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                      {activePlan.courses.map((course) => (
                        <button
                          key={course.id}
                          type="button"
                          onClick={() => handleDownloadCourseIcs(course)}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors text-left group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: course.color }}
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-900 dark:text-white font-mono mr-1">
                                {course.code}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {course.name}
                              </span>
                            </div>
                          </div>
                          <Download className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0 ml-1.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: High-Res PNG Image */}
          {activeTab === 'image' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Theme:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = imageTheme === 'light' ? 'dark' : 'light';
                      setImageTheme(next);
                    }}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    {imageTheme === 'dark' ? 'Dark Background' : 'Light Background'}
                  </button>
                  <button
                    type="button"
                    onClick={handleGeneratePreviewImage}
                    className="px-2 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Refresh
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadImage}
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
                    onClick={handleGeneratePreviewImage}
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
          )}

          {/* Tab 4: JSON Backup & Restore */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Backup All Plans & Pool
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Export all your plans, courses, and scratchpad pool into a single transferable JSON file.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white shadow-xs transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save Backup</span>
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-900 dark:text-white">
                    Restore from Backup JSON
                  </label>
                  <label className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
                    <span>Upload .json file</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <textarea
                  rows={3}
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder="Paste backup JSON content here or click Upload above..."
                  className="w-full p-2.5 font-mono text-[11px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />

                {importError && (
                  <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-900">
                    {importError}
                  </div>
                )}

                {importSuccess && (
                  <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs border border-emerald-200 dark:border-emerald-900 flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    Successfully restored backup!
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleApplyImport}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Restore Data</span>
                  </button>
                </div>
              </div>
            </div>
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
