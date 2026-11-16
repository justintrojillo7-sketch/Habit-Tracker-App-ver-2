import React, { useEffect, useState } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  CheckCircle2,
  Compass,
  Moon,
  Pause,
  PieChart,
  Play,
  Settings,
  Square,
  Sun,
  Target,
  Timer,
  WifiOff,
} from 'lucide-react';
import { useLifeHQ } from '../context/LifeHQContext';
import { useOnlineStatus } from '../hooks/usePWAInstall';
import { NavSection } from '../types/lifehq';
import { formatStopwatch, getWeekType } from '../utils/dateUtils';

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'today', label: 'Today', icon: Compass },
  { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
  { id: 'track', label: 'Track', icon: Timer },
  { id: 'insights', label: 'Insights', icon: PieChart },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    state,
    activeSection,
    setActiveSection,
    isDark,
    updateSettings,
    now,
    toast,
    storageError,
    cloudUser,
    cloudSyncStatus,
    reminders,
    pauseTimer,
    resumeTimer,
    stopAndSaveTimer,
    getCategoryMeta,
  } = useLifeHQ();

  const isOnline = useOnlineStatus();
  const [showReminders, setShowReminders] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const t = state.activeTimer;
    if (!t) {
      setElapsedMs(0);
      return;
    }
    const calc = () =>
      t.accumulatedMs +
      (t.isRunning && t.startedAtMs ? Date.now() - t.startedAtMs : 0);
    setElapsedMs(calc());
    if (!t.isRunning) return;
    const id = setInterval(() => setElapsedMs(calc()), 1000);
    return () => clearInterval(id);
  }, [state.activeTimer]);

  const weekType = getWeekType(now.date, state.settings);

  const cycleTheme = () => {
    updateSettings({ theme: isDark ? 'light' : 'dark' });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8f9fb] dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111723] z-30">
        <div className="px-5 pt-6 pb-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 font-display font-bold text-sm">
                L
              </div>
              <span className="font-display font-semibold text-lg tracking-tight whitespace-nowrap">
                LifeHQ
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono tabular-nums">
              Week {weekType} · {now.time}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {state.settings.notificationsEnabled && (
              <button
                onClick={() => setShowReminders((v) => !v)}
                className="relative min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label="In-app reminders"
                title="Reminders"
              >
                <Bell className="w-4 h-4" />
                {reminders.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400" />
                )}
              </button>
            )}
            <button
              onClick={cycleTheme}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Toggle light or dark theme"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition duration-150 ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Active Persisted Timer in Sidebar */}
        {state.activeTimer && (
          <div className="m-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <span className="font-medium truncate">
                {getCategoryMeta(state.activeTimer.category).label}
              </span>
              <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatStopwatch(elapsedMs)}
              </span>
            </div>
            <p className="text-sm font-medium truncate mt-1">
              {state.activeTimer.title}
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={state.activeTimer.isRunning ? pauseTimer : resumeTimer}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                {state.activeTimer.isRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" /> Resume
                  </>
                )}
              </button>
              <button
                onClick={() => stopAndSaveTimer()}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 transition"
              >
                <Square className="w-3 h-3" /> Save
              </button>
            </div>
          </div>
        )}

        <div className="px-5 py-4 border-t border-slate-200/70 dark:border-slate-800/70 space-y-1">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {cloudUser
              ? cloudSyncStatus === 'syncing'
                ? 'Syncing to account…'
                : cloudSyncStatus === 'error'
                ? 'Sync error (saved locally)'
                : `Cloud sync · ${cloudUser.email ?? 'Signed in'}`
              : 'Local device storage'}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Less time managing life. More time living it.
          </p>
        </div>
      </aside>

      {/* Mobile Compact Header (h-12 = 48px, well inside 15% sticky cap with bottom nav) */}
      <header className="md:hidden sticky top-0 z-30 pt-safe h-12 bg-white/90 dark:bg-[#111723]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 flex items-center justify-between">
        <span className="font-display font-semibold text-base tracking-tight whitespace-nowrap shrink-0">
          LifeHQ
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums whitespace-nowrap">
          Week {weekType} · {now.time}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {state.settings.notificationsEnabled && (
            <button
              onClick={() => setShowReminders((v) => !v)}
              className="relative min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300"
              aria-label="Reminders"
            >
              <Bell className="w-4 h-4" />
              {reminders.length > 0 && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-600" />
              )}
            </button>
          )}
          <button
            onClick={cycleTheme}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace Canvas */}
      <main className="flex-1 md:pl-60 pb-24 md:pb-12">
        {!isOnline && (
          <div className="mx-4 md:mx-8 mt-4 px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              Offline mode — changes are stored locally on this device and will
              sync when back online.
            </span>
          </div>
        )}

        {storageError && (
          <div className="mx-4 md:mx-8 mt-4 px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs">
            {storageError}
          </div>
        )}

        {showReminders && state.settings.notificationsEnabled && (
          <div className="mx-4 md:mx-8 mt-4 p-4 rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">In-App Reminders</h3>
              <button
                onClick={() => setShowReminders(false)}
                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 px-2 py-1"
              >
                Close
              </button>
            </div>
            {reminders.length === 0 ? (
              <p className="text-xs text-slate-500">
                No active reminders right now.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {reminders.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div>
                      <p className="text-xs font-medium">{r.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {r.detail}
                      </p>
                    </div>
                    {r.actionSection && (
                      <button
                        onClick={() => {
                          setActiveSection(r.actionSection!);
                          setShowReminders(false);
                        }}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shrink-0"
                      >
                        Open
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
          {children}
        </div>
      </main>

      {/* Mobile Active Timer Bar (sits cleanly above bottom nav only while timer is active) */}
      {state.activeTimer && (
        <div className="md:hidden fixed bottom-[68px] inset-x-3 z-30 px-3.5 py-2 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-lg flex items-center justify-between gap-3">
          <button
            onClick={() => setActiveSection('track')}
            className="flex items-center gap-2.5 min-w-0 text-left min-h-[40px]"
          >
            <Timer className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">
                {state.activeTimer.title}
              </p>
              <p className="text-[11px] opacity-80 font-mono tabular-nums">
                {formatStopwatch(elapsedMs)}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={state.activeTimer.isRunning ? pauseTimer : resumeTimer}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-white/15 dark:bg-slate-900/10"
              aria-label="Pause or resume timer"
            >
              {state.activeTimer.isRunning ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => stopAndSaveTimer()}
              className="min-h-[40px] px-3 rounded-xl bg-white text-slate-900 dark:bg-slate-900 dark:text-white text-xs font-semibold"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 pb-safe bg-white/95 dark:bg-[#111723]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-6 h-16">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex flex-col items-center justify-center gap-1 min-h-[44px] text-[10px] font-medium transition ${
                  active
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.2]' : ''}`} />
                <span className="truncate max-w-full px-0.5">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};
