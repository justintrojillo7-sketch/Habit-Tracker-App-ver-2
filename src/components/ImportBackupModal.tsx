import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  HardDrive,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useLifeHQ } from '../context/LifeHQContext';
import {
  analyzeImportPreview,
  applyImportMerge,
  ImportMergeMode,
  parseImportPayload,
} from '../services/importMerge';
import { loadLegacyLocalBackup } from '../services/storage';
import { AppState } from '../types/lifehq';
import { buildJSONBackup, downloadTextFile } from '../utils/ics';

interface ImportBackupModalProps {
  open: boolean;
  onClose: () => void;
  autoLoadLegacy?: boolean;
}

export const ImportBackupModal: React.FC<ImportBackupModalProps> = ({
  open,
  onClose,
  autoLoadLegacy = false,
}) => {
  const {
    state,
    now,
    legacyBackupInfo,
    refreshLegacyBackupInfo,
    clearDetectedLegacyBackup,
    applyImportedWorkspace,
    showToast,
  } = useLifeHQ();

  const [incomingState, setIncomingState] = useState<AppState | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMergeMode>('merge-safe');
  const [includeSettings, setIncludeSettings] = useState<boolean>(true);
  const [confirmReplaceAll, setConfirmReplaceAll] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [importCompleted, setImportCompleted] = useState<boolean>(false);

  const loadLegacyForPreview = () => {
    setParseError(null);
    const legacy = loadLegacyLocalBackup();
    if (!legacy) {
      setParseError(
        'No readable legacy browser data was found on this device.'
      );
      return;
    }
    setIncomingState(legacy);
    setSourceLabel('Legacy browser setup (lifehq_state_v1)');
    setImportCompleted(false);
    setConfirmReplaceAll(false);
  };

  useEffect(() => {
    if (!open) return;
    refreshLegacyBackupInfo();
    setParseError(null);
    setImportCompleted(false);
    setConfirmReplaceAll(false);
    setMode('merge-safe');
    setIncludeSettings(true);

    if (autoLoadLegacy) {
      const legacy = loadLegacyLocalBackup();
      if (legacy) {
        setIncomingState(legacy);
        setSourceLabel('Legacy browser setup (lifehq_state_v1)');
        return;
      }
    }
    setIncomingState(null);
    setSourceLabel('');
  }, [open, autoLoadLegacy, refreshLegacyBackupInfo]);

  const preview = useMemo(() => {
    if (!incomingState) return null;
    return analyzeImportPreview(state, incomingState);
  }, [state, incomingState]);

  if (!open) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setImportCompleted(false);
    setConfirmReplaceAll(false);
    try {
      const text = await file.text();
      const res = parseImportPayload(text);
      if (!res.ok) {
        setIncomingState(null);
        setParseError(res.error);
      } else {
        setIncomingState(res.state);
        setSourceLabel(`${file.name} (${res.formatLabel})`);
      }
    } catch {
      setIncomingState(null);
      setParseError('Could not read the selected file.');
    }
    e.target.value = '';
  };

  const handleRunImport = async () => {
    if (!incomingState) return;
    if (mode === 'replace-all' && !confirmReplaceAll) return;
    setImporting(true);
    try {
      const nextState = applyImportMerge(state, incomingState, {
        mode,
        includeSettings,
        sourceLabel: sourceLabel || 'JSON backup',
      });
      const ok = await applyImportedWorkspace(nextState, mode);
      if (ok) {
        setImportCompleted(true);
      }
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadVerificationBackup = () => {
    downloadTextFile(
      `lifehq-verified-cloud-backup-${now.date}.json`,
      buildJSONBackup(state),
      'application/json'
    );
    showToast('Verification JSON backup downloaded');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-backup-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="import-backup-title"
              className="text-lg font-semibold tracking-tight"
            >
              Import Saved Backup / Personal Setup
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Private to your signed-in account. Preview contents and deduplicate
              before syncing to Firestore.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close import modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step 1: Source picker */}
        {!importCompleted && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 cursor-pointer transition">
              <Upload className="w-4 h-4 text-slate-600 dark:text-slate-300 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold">Upload .json backup file</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Supports LifeHQ JSON exports and raw backup snapshots.
                </p>
              </div>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {legacyBackupInfo.exists ? (
              <button
                type="button"
                onClick={loadLegacyForPreview}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-left transition"
              >
                <HardDrive className="w-4 h-4 text-slate-600 dark:text-slate-300 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold">
                    Inspect browser setup on this device
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {legacyBackupInfo.eventCount} events ·{' '}
                    {legacyBackupInfo.habitCount} habits ·{' '}
                    {legacyBackupInfo.goalCount} goals
                  </p>
                </div>
              </button>
            ) : (
              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-left opacity-75">
                <HardDrive className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    No legacy browser backup detected
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Use a saved .json export file from your earlier device.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {parseError && (
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-200">
            {parseError}
          </div>
        )}

        {/* Step 2: Pre-Import Preview & Merge Options */}
        {incomingState && preview && !importCompleted && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                  <FileJson className="w-4 h-4 text-slate-500" />
                  Preview: {sourceLabel}
                </span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  {preview.totalIncomingItems} items detected
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {[
                  {
                    label: 'Calendar events',
                    inc: preview.counts.events,
                    cur: preview.currentCounts.events,
                  },
                  {
                    label: 'Habits / Logs',
                    inc: `${preview.counts.habits} / ${preview.counts.habitLogs}`,
                    cur: `${preview.currentCounts.habits} / ${preview.currentCounts.habitLogs}`,
                  },
                  {
                    label: 'Goals / Priorities',
                    inc: `${preview.counts.goals} / ${preview.counts.priorities}`,
                    cur: `${preview.currentCounts.goals} / ${preview.currentCounts.priorities}`,
                  },
                  {
                    label: 'Time records',
                    inc: preview.counts.activityRecords,
                    cur: preview.currentCounts.activityRecords,
                  },
                  {
                    label: 'Faith (Dev / Study)',
                    inc: `${preview.counts.devotionEntries} / ${preview.counts.bibleStudies}`,
                    cur: `${preview.currentCounts.devotionEntries} / ${preview.currentCounts.bibleStudies}`,
                  },
                  {
                    label: 'Fitness & Creative',
                    inc: `${preview.counts.workoutPlans}p · ${preview.counts.workoutLogs}w · ${preview.counts.beholdWeeks}m`,
                    cur: `${preview.currentCounts.workoutPlans}p · ${preview.currentCounts.workoutLogs}w · ${preview.currentCounts.beholdWeeks}m`,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="rounded-lg bg-white dark:bg-[#141b29] border border-slate-200/70 dark:border-slate-800 px-2.5 py-2"
                  >
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {row.label}
                    </p>
                    <p className="font-mono font-semibold text-xs mt-0.5 tabular-nums">
                      +{row.inc}{' '}
                      <span className="font-normal text-slate-400">
                        (have {row.cur})
                      </span>
                    </p>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 pt-1 border-t border-slate-200/70 dark:border-slate-800">
                <p>
                  <strong>Week A/B anchor:</strong> {preview.weekAnchorMonday}{' '}
                  (Week {preview.weekAnchorType}) ·{' '}
                  {preview.holidaysSummary.length} holiday period
                  {preview.holidaysSummary.length === 1 ? '' : 's'}
                </p>
                {(preview.duplicateIdsCount > 0 ||
                  preview.duplicateSignatureCount > 0) && (
                  <p className="text-amber-700 dark:text-amber-300">
                    Matching items already in your account:{' '}
                    {preview.duplicateIdsCount} by ID,{' '}
                    {preview.duplicateSignatureCount} by title/time signature.
                    Duplicates are automatically handled according to your merge
                    mode below.
                  </p>
                )}
                {preview.sampleTitles.events.length > 0 && (
                  <p className="truncate text-slate-500 dark:text-slate-400">
                    Sample events: {preview.sampleTitles.events.join(', ')}
                  </p>
                )}
                {preview.sampleTitles.habits.length > 0 && (
                  <p className="truncate text-slate-500 dark:text-slate-400">
                    Sample habits: {preview.sampleTitles.habits.join(', ')}
                  </p>
                )}
              </div>
            </div>

            {/* Merge Strategy */}
            <div className="space-y-2">
              <p className="text-xs font-semibold">Import mode</p>
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === 'merge-safe'}
                  onChange={() => setMode('merge-safe')}
                  className="mt-0.5"
                />
                <div className="text-xs">
                  <p className="font-semibold">
                    Merge safely (Recommended)
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Preserves all existing cloud records and appends only new,
                    non-duplicate items.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === 'merge-overwrite'}
                  onChange={() => setMode('merge-overwrite')}
                  className="mt-0.5"
                />
                <div className="text-xs">
                  <p className="font-semibold">Merge &amp; update matching items</p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Updates matching IDs or title/time items from the backup while
                    keeping unrelated cloud records.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-200/80 dark:border-rose-900/60 cursor-pointer">
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === 'replace-all'}
                  onChange={() => setMode('replace-all')}
                  className="mt-0.5"
                />
                <div className="text-xs">
                  <p className="font-semibold text-rose-700 dark:text-rose-300">
                    Replace entire workspace
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Removes existing cloud items in your account and replaces them
                    with this backup.
                  </p>
                </div>
              </label>

              {mode === 'replace-all' && (
                <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmReplaceAll}
                    onChange={(e) => setConfirmReplaceAll(e.target.checked)}
                  />
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Confirm replacing all existing cloud records for this account
                  </span>
                </label>
              )}

              {mode !== 'replace-all' && (
                <label className="flex items-center gap-2 pt-1 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSettings}
                    onChange={(e) => setIncludeSettings(e.target.checked)}
                  />
                  <span>
                    Include Week A/B anchor, school holidays, and fitness config
                  </span>
                </label>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={importing}
                className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRunImport()}
                disabled={
                  importing || (mode === 'replace-all' && !confirmReplaceAll)
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing to account…</span>
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5" />
                    <span>Import to my account</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Post-import verification & optional cleanup */}
        {importCompleted && (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Import synced to your private Firestore workspace</span>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Your workspace now holds {state.events.length} events,{' '}
                {state.habits.length} habits, {state.goals.length} goals,{' '}
                {state.activityRecords.length} activity records,{' '}
                {state.bibleStudies.length} Bible studies, and{' '}
                {state.beholdWeeks.length} practice modules.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadVerificationBackup}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <Download className="w-3.5 h-3.5" /> Download verification JSON
              </button>

              {legacyBackupInfo.exists && (
                <button
                  type="button"
                  onClick={clearDetectedLegacyBackup}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear legacy browser data
                  on this device
                </button>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
