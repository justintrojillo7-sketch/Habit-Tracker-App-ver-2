import React, { useState } from 'react';
import {
  Cloud,
  Download,
  LogIn,
  LogOut,
  Plus,
  RotateCcw,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react';
import { CATEGORIES, DEFAULT_CATEGORY_COLOURS } from '../data/seedData';
import { useLifeHQ } from '../context/LifeHQContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { CategoryId, ThemePreference, WeekType } from '../types/lifehq';
import { addDays } from '../utils/dateUtils';
import {
  buildJSONBackup,
  downloadTextFile,
  exportLogsToCSV,
  exportOccurrencesToICS,
  parseICSEvents,
} from '../utils/ics';
import { expandEventsForRange } from '../utils/recurrence';

export const SettingsView: React.FC = () => {
  const {
    state,
    now,
    cloudUser,
    cloudSyncStatus,
    signInCloud,
    signOutCloud,
    updateSettings,
    importEvents,
    restoreState,
    resetDemoData,
    loadDemoSampleLogs,
    clearDemoLogs,
    showToast,
  } = useLifeHQ();

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const [holidayLabel, setHolidayLabel] = useState('');
  const [holidayStart, setHolidayStart] = useState('');
  const [holidayEnd, setHolidayEnd] = useState('');
  const [icsFeedback, setIcsFeedback] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const browserPushSupported =
    typeof window !== 'undefined' && 'Notification' in window;
  const browserPushPermission = browserPushSupported
    ? Notification.permission
    : 'unsupported';

  const handleToggleNotifications = async () => {
    const next = !state.settings.notificationsEnabled;
    if (next && browserPushSupported && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        // Fallback to in-app reminders cleanly
      }
    }
    updateSettings({ notificationsEnabled: next });
  };

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayLabel.trim() || !holidayStart || !holidayEnd) return;
    const startDate = holidayStart <= holidayEnd ? holidayStart : holidayEnd;
    const endDate = holidayStart <= holidayEnd ? holidayEnd : holidayStart;
    updateSettings({
      schoolHolidays: [
        ...state.settings.schoolHolidays,
        {
          id: `hol-${Date.now()}`,
          label: holidayLabel.trim(),
          startDate,
          endDate,
        },
      ],
    });
    setHolidayLabel('');
    setHolidayStart('');
    setHolidayEnd('');
  };

  const handleICSUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const { imported, skippedDuplicates } = parseICSEvents(text, state.events);
    if (imported.length > 0) {
      importEvents(imported);
    }
    setIcsFeedback(
      `Imported ${imported.length} event${imported.length === 1 ? '' : 's'} (${skippedDuplicates} duplicate${skippedDuplicates === 1 ? '' : 's'} skipped).`
    );
    e.target.value = '';
  };

  const handleExportICS = () => {
    const start = addDays(now.date, -7);
    const end = addDays(now.date, 90);
    const occs = expandEventsForRange(
      state.events,
      start,
      end,
      state.settings,
      state.activityRecords
    );
    const ics = exportOccurrencesToICS(occs);
    downloadTextFile('lifehq-calendar.ics', ics, 'text/calendar;charset=utf-8');
    showToast('ICS calendar exported');
  };

  const handleExportJSON = () => {
    downloadTextFile(
      `lifehq-backup-${now.date}.json`,
      buildJSONBackup(state),
      'application/json'
    );
    showToast('JSON backup exported');
  };

  const handleExportCSV = () => {
    downloadTextFile(
      `lifehq-time-logs-${now.date}.csv`,
      exportLogsToCSV(state.activityRecords),
      'text/csv;charset=utf-8'
    );
    showToast('CSV time logs exported');
  };

  const handleRestoreJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed.events || !parsed.settings) {
        showToast('Invalid LifeHQ backup file');
        return;
      }
      restoreState(parsed);
    } catch {
      showToast('Could not parse JSON backup');
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Cloud sync, appearance, Week A/B rotation, school holidays, and
          Apple Calendar ICS interoperability.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account & Cloud Persistence */}
        <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Cloud className="w-4 h-4" /> Sync &amp; Account
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {cloudUser
                  ? `Signed in as ${cloudUser.email}. Private Firestore sync is active (${cloudSyncStatus}).`
                  : 'Currently running in Local Device Mode (stored in this browser only — does not sync between devices until you sign in).'}
              </p>
            </div>
          </div>

          {cloudUser ? (
            <button
              onClick={signOutCloud}
              className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <LogOut className="w-4 h-4" /> Sign out of Google
            </button>
          ) : (
            <button
              onClick={signInCloud}
              className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            >
              <LogIn className="w-4 h-4" /> Sign in with Google to sync across
              devices
            </button>
          )}

          {/* PWA Install Option */}
          {!isInstalled && (isInstallable || isIOS) && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="text-xs">
                <p className="font-medium flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" /> Install LifeHQ on home
                  screen
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  Launch full-screen on iPhone, iPad, or Mac.
                </p>
              </div>
              {isInstallable ? (
                <button
                  onClick={install}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
                >
                  Install app
                </button>
              ) : (
                <button
                  onClick={() => setShowIOSGuide((v) => !v)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 whitespace-nowrap"
                >
                  iPhone guide
                </button>
              )}
            </div>
          )}

          {showIOSGuide && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300">
              In Safari on iPhone: tap the <strong>Share</strong> icon in the
              bottom bar, scroll down, and tap <strong>Add to Home Screen</strong>.
            </div>
          )}
        </section>

        {/* Appearance & Category Colours */}
        <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4">
          <h2 className="text-base font-semibold">Appearance &amp; Colours</h2>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Theme preference
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['system', 'light', 'dark'] as ThemePreference[]).map((t) => (
                <button
                  key={t}
                  onClick={() => updateSettings({ theme: t })}
                  className={`py-2 px-3 rounded-xl text-xs font-medium capitalize border transition ${
                    state.settings.theme === t
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500">
                Category colours
              </label>
              <button
                onClick={() =>
                  updateSettings({
                    categoryColours: { ...DEFAULT_CATEGORY_COLOURS },
                  })
                }
                className="text-xs text-slate-500 hover:underline"
              >
                Reset defaults
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {CATEGORIES.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
                >
                  <span>{c.label}</span>
                  <input
                    type="color"
                    value={state.settings.categoryColours[c.id]}
                    onChange={(e) =>
                      updateSettings({
                        categoryColours: {
                          ...state.settings.categoryColours,
                          [c.id as CategoryId]: e.target.value,
                        },
                      })
                    }
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  />
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Week A / Week B Anchor & School Holidays */}
        <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4">
          <h2 className="text-base font-semibold">
            Week A / B Rotation &amp; Holidays
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Default anchor: Monday 16 Nov 2026 = Week A. Suspending school
            holidays hides school blocks without shifting the A/B cycle.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Anchor Monday
              </label>
              <input
                type="date"
                value={state.settings.weekAnchorMonday}
                onChange={(e) =>
                  updateSettings({ weekAnchorMonday: e.target.value })
                }
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Anchor week
              </label>
              <select
                value={state.settings.weekAnchorType}
                onChange={(e) =>
                  updateSettings({
                    weekAnchorType: e.target.value as WeekType,
                  })
                }
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
              >
                <option value="A">Week A</option>
                <option value="B">Week B</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Target bedtime
              </label>
              <input
                type="time"
                value={state.settings.targetBedtime}
                onChange={(e) =>
                  updateSettings({ targetBedtime: e.target.value })
                }
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <h3 className="text-xs font-semibold">School Holidays</h3>
            {state.settings.schoolHolidays.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900"
              >
                <span>
                  <strong>{h.label}</strong> ·{' '}
                  <span className="font-mono tabular-nums">
                    {h.startDate} to {h.endDate}
                  </span>
                </span>
                <button
                  onClick={() =>
                    updateSettings({
                      schoolHolidays: state.settings.schoolHolidays.filter(
                        (item) => item.id !== h.id
                      ),
                    })
                  }
                  className="text-slate-400 hover:text-rose-600"
                  aria-label="Remove holiday"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <form
              onSubmit={handleAddHoliday}
              className="grid grid-cols-1 sm:grid-cols-4 gap-2"
            >
              <input
                type="text"
                placeholder="e.g. Christmas break"
                value={holidayLabel}
                onChange={(e) => setHolidayLabel(e.target.value)}
                className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
              />
              <input
                type="date"
                value={holidayStart}
                onChange={(e) => setHolidayStart(e.target.value)}
                className="px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
              />
              <input
                type="date"
                value={holidayEnd}
                onChange={(e) => setHolidayEnd(e.target.value)}
                className="px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>
          </div>
        </section>

        {/* Opt-In Reminders */}
        <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">
                Reminders &amp; Notifications
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Opt-in only. Browser push status:{' '}
                <span className="font-mono">{browserPushPermission}</span>.
                In-app reminders appear in the header bell when enabled.
              </p>
            </div>
            <button
              onClick={handleToggleNotifications}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                state.settings.notificationsEnabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              {state.settings.notificationsEnabled ? 'Enabled' : 'Enable'}
            </button>
          </div>

          <div className="space-y-2 pt-1">
            {(
              [
                { key: 'upcomingEvents', label: 'Upcoming events' },
                {
                  key: 'unconfirmedMinistry',
                  label: 'Unconfirmed ministry commitments',
                },
                { key: 'dailyHabits', label: 'Evening habit check-in' },
                { key: 'weeklyReview', label: 'Sunday weekly review prompt' },
                { key: 'goalDeadlines', label: 'Goals approaching target date' },
              ] as const
            ).map((opt) => (
              <label
                key={opt.key}
                className="flex items-center justify-between text-xs py-1 cursor-pointer"
              >
                <span>{opt.label}</span>
                <input
                  type="checkbox"
                  checked={state.settings.reminderOptions[opt.key]}
                  onChange={(e) =>
                    updateSettings({
                      reminderOptions: {
                        ...state.settings.reminderOptions,
                        [opt.key]: e.target.checked,
                      },
                    })
                  }
                  className="rounded"
                />
              </label>
            ))}
          </div>
        </section>

        {/* Apple Calendar & ICS Compatibility */}
        <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4">
          <h2 className="text-base font-semibold">
            Apple Calendar Compatibility (ICS)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            LifeHQ currently operates independently and never overwrites your
            Apple Calendar. Import an `.ics` export from Apple Calendar (with
            automatic UID and title/time deduplication) or export LifeHQ events
            for Apple Calendar.
          </p>

          <div className="flex flex-wrap gap-2.5">
            <label className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 cursor-pointer">
              <Upload className="w-4 h-4" /> Import .ics file
              <input
                type="file"
                accept=".ics,text/calendar"
                onChange={handleICSUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={handleExportICS}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Download className="w-4 h-4" /> Export .ics
            </button>
          </div>

          {icsFeedback && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              {icsFeedback}
            </p>
          )}

          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Future sync roadmap: an optional CalDAV / iCloud bridge or Apple
            Shortcuts EventKit connector can subscribe to LifeHQ&apos;s feed
            without risking duplicate Apple Calendar entries.
          </p>
        </section>

        {/* Data Export, Sample Logs & Reset */}
        <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4">
          <h2 className="text-base font-semibold">
            Backups, Exports &amp; Sample Data
          </h2>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportJSON}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <Download className="w-3.5 h-3.5" /> Export JSON backup
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <Download className="w-3.5 h-3.5" /> Export time logs CSV
            </button>
            <label className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
              <Upload className="w-3.5 h-3.5" /> Restore JSON
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleRestoreJSON}
                className="hidden"
              />
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
            <button
              onClick={loadDemoSampleLogs}
              className="px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Load tagged sample logs
            </button>
            <button
              onClick={clearDemoLogs}
              className="px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Clear sample logs
            </button>
            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset initial schedule
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    resetDemoData();
                    setConfirmReset(false);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white"
                >
                  Confirm reset
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="px-3 py-2 text-xs text-slate-500"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
