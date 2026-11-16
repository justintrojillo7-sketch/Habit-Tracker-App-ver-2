import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Pause,
  Play,
  Plus,
  SkipForward,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { CATEGORIES } from '../data/seedData';
import { useLifeHQ } from '../context/LifeHQContext';
import { CategoryId, HabitFrequency } from '../types/lifehq';
import {
  addDays,
  formatDuration,
  formatShortDate,
  formatStopwatch,
  getMondayOfWeek,
  getWeekDates,
  minutesToTime,
  timeToMinutes,
} from '../utils/dateUtils';

type TrackTab = 'timer' | 'habits' | 'history';

export const TrackView: React.FC = () => {
  const {
    state,
    now,
    getCategoryMeta,
    startTimer,
    pauseTimer,
    resumeTimer,
    discardTimer,
    stopAndSaveTimer,
    addManualLog,
    updateActivityRecord,
    deleteActivityRecord,
    setHabitStatus,
    toggleHabitPause,
    addHabit,
  } = useLifeHQ();

  const [tab, setTab] = useState<TrackTab>('timer');

  // Timer form state
  const [timerCategory, setTimerCategory] = useState<CategoryId>('behold');
  const [timerSubcategory, setTimerSubcategory] = useState('Editing');
  const [timerTitle, setTimerTitle] = useState('Video editing');
  const [timerProject, setTimerProject] = useState('Portfolio Film');
  const [timerNotes, setTimerNotes] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [stopAdjustOpen, setStopAdjustOpen] = useState(false);
  const [adjustedMinutes, setAdjustedMinutes] = useState<number>(15);

  // Manual log state
  const [manualCat, setManualCat] = useState<CategoryId>('rest');
  const [manualSubcat, setManualSubcat] = useState('Sleep');
  const [manualTitle, setManualTitle] = useState('');
  const [manualDate, setManualDate] = useState(now.date);
  const [manualStart, setManualStart] = useState('22:30');
  const [manualDuration, setManualDuration] = useState(450);
  const [manualProject, setManualProject] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  // History edit state
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingMins, setEditingMins] = useState<number>(60);

  // Add habit state
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitCat, setNewHabitCat] = useState<CategoryId>('personal');
  const [newHabitFreq, setNewHabitFreq] = useState<HabitFrequency>('weekly');
  const [newHabitTarget, setNewHabitTarget] = useState(3);

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

  const timerCatMeta =
    CATEGORIES.find((c) => c.id === timerCategory) ?? CATEGORIES[1];
  const manualCatMeta =
    CATEGORIES.find((c) => c.id === manualCat) ?? CATEGORIES[5];

  const handleStartTimer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!timerTitle.trim()) return;
    startTimer({
      category: timerCategory,
      subcategory: timerSubcategory,
      title: timerTitle.trim(),
      project: timerProject.trim(),
      notes: timerNotes.trim(),
    });
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || manualDuration <= 0) return;
    const endTime = minutesToTime(timeToMinutes(manualStart) + manualDuration);
    addManualLog({
      date: manualDate,
      startTime: manualStart,
      endTime,
      actualMinutes: manualDuration,
      status: 'completed',
      category: manualCat,
      subcategory: manualSubcat,
      title: manualTitle.trim(),
      project: manualProject.trim() || undefined,
      notes: manualNotes.trim() || undefined,
    });
    setManualTitle('');
    setManualNotes('');
  };

  const applyQuickPreset = (preset: {
    cat: CategoryId;
    sub: string;
    title: string;
    start: string;
    mins: number;
  }) => {
    setManualCat(preset.cat);
    setManualSubcat(preset.sub);
    setManualTitle(preset.title);
    setManualStart(preset.start);
    setManualDuration(preset.mins);
  };

  // Habit week dates & consistency calculations
  const weekMonday = getMondayOfWeek(now.date);
  const weekDates = useMemo(() => getWeekDates(weekMonday), [weekMonday]);
  const trailing14Dates = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(now.date, -13 + i)),
    [now.date]
  );

  const handleAddHabitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitTitle.trim()) return;
    addHabit({
      title: newHabitTitle.trim(),
      category: newHabitCat,
      frequency: newHabitFreq,
      weeklyTarget: newHabitTarget,
      paused: false,
    });
    setNewHabitTitle('');
    setShowAddHabit(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Segmented View Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Track &amp; Habits
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Live activity timer, manual time logs, and low-friction habit
            consistency.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 self-start">
          {(
            [
              { id: 'timer', label: 'Timer & Log' },
              { id: 'habits', label: 'Habits' },
              {
                id: 'history',
                label: `History (${state.activityRecords.length})`,
              },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                tab === t.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: TIMER & MANUAL LOGGING */}
      {tab === 'timer' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stopwatch Timer Card */}
          <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6">
            <h2 className="text-base font-semibold">Activity Timer</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Persists automatically across browser refreshes.
            </p>

            {state.activeTimer ? (
              <div className="space-y-5">
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 p-6 text-center">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {getCategoryMeta(state.activeTimer.category).label} ·{' '}
                    {state.activeTimer.subcategory}
                  </p>
                  <p className="text-lg font-semibold mt-1">
                    {state.activeTimer.title}
                  </p>
                  {state.activeTimer.project && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Project: {state.activeTimer.project}
                    </p>
                  )}
                  <p className="font-mono tabular-nums text-4xl sm:text-5xl font-semibold tracking-tight mt-4">
                    {formatStopwatch(elapsedMs)}
                  </p>
                </div>

                {!stopAdjustOpen ? (
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={
                        state.activeTimer.isRunning ? pauseTimer : resumeTimer
                      }
                      className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      {state.activeTimer.isRunning ? (
                        <>
                          <Pause className="w-4 h-4" /> Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" /> Resume
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setAdjustedMinutes(
                          Math.max(1, Math.round(elapsedMs / 60000))
                        );
                        setStopAdjustOpen(true);
                      }}
                      className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 transition"
                    >
                      <Square className="w-4 h-4" /> Stop &amp; Save
                    </button>
                    <button
                      onClick={discardTimer}
                      className="min-h-[44px] px-4 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    >
                      Discard
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                      Confirm or adjust recorded duration (minutes)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      value={adjustedMinutes}
                      onChange={(e) =>
                        setAdjustedMinutes(Number(e.target.value))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          stopAndSaveTimer(adjustedMinutes);
                          setStopAdjustOpen(false);
                        }}
                        className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        Save Time Entry
                      </button>
                      <button
                        onClick={() => setStopAdjustOpen(false)}
                        className="px-4 py-2.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleStartTimer} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Category
                    </label>
                    <select
                      value={timerCategory}
                      onChange={(e) => {
                        const c = e.target.value as CategoryId;
                        setTimerCategory(c);
                        const meta = CATEGORIES.find((m) => m.id === c);
                        if (meta) setTimerSubcategory(meta.subcategories[0]);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Activity
                    </label>
                    <select
                      value={timerSubcategory}
                      onChange={(e) => setTimerSubcategory(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                    >
                      {timerCatMeta.subcategories.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Session title
                  </label>
                  <input
                    type="text"
                    required
                    value={timerTitle}
                    onChange={(e) => setTimerTitle(e.target.value)}
                    placeholder="e.g. Video editing, Marking Year 8..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Project (optional)
                    </label>
                    <input
                      type="text"
                      value={timerProject}
                      onChange={(e) => setTimerProject(e.target.value)}
                      placeholder="Portfolio Film"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Notes (optional)
                    </label>
                    <input
                      type="text"
                      value={timerNotes}
                      onChange={(e) => setTimerNotes(e.target.value)}
                      placeholder="Assembly cut..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition"
                >
                  <Play className="w-4 h-4" /> Start Timer
                </button>
              </form>
            )}
          </section>

          {/* Manual Activity & Quick Lifestyle Logging */}
          <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6">
            <h2 className="text-base font-semibold">Manual Time Entry</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Log activities completed without a timer, including sleep, meals,
              commuting, and downtime.
            </p>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {[
                {
                  label: 'Sleep 7.5h',
                  cat: 'rest' as CategoryId,
                  sub: 'Sleep',
                  title: 'Overnight sleep',
                  start: '00:00',
                  mins: 450,
                },
                {
                  label: 'Commute 35m',
                  cat: 'personal' as CategoryId,
                  sub: 'Commuting',
                  title: 'School commute',
                  start: '08:00',
                  mins: 35,
                },
                {
                  label: 'Meals 45m',
                  cat: 'personal' as CategoryId,
                  sub: 'Meals',
                  title: 'Meals',
                  start: '18:00',
                  mins: 45,
                },
                {
                  label: 'Behold Edit 90m',
                  cat: 'behold' as CategoryId,
                  sub: 'Editing',
                  title: 'Video editing',
                  start: '17:15',
                  mins: 90,
                },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyQuickPreset(p)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Category
                  </label>
                  <select
                    value={manualCat}
                    onChange={(e) => {
                      const c = e.target.value as CategoryId;
                      setManualCat(c);
                      const meta = CATEGORIES.find((m) => m.id === c);
                      if (meta) setManualSubcat(meta.subcategories[0]);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Subcategory
                  </label>
                  <select
                    value={manualSubcat}
                    onChange={(e) => setManualSubcat(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                  >
                    {manualCatMeta.subcategories.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="What did you complete?"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Start
                  </label>
                  <input
                    type="time"
                    value={manualStart}
                    onChange={(e) => setManualStart(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Minutes
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={manualDuration}
                    onChange={(e) => setManualDuration(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={manualProject}
                  onChange={(e) => setManualProject(e.target.value)}
                  placeholder="Project (optional)"
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                />
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <Clock className="w-4 h-4" /> Log Completed Activity
              </button>
            </form>
          </section>
        </div>
      )}

      {/* TAB 2: LOW-FRICTION HABIT TRACKER */}
      {tab === 'habits' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Excused skips and paused habits never penalise your consistency.
              Confirmed calendar blocks fulfil linked habits automatically.
            </p>
            <button
              onClick={() => setShowAddHabit((v) => !v)}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> New habit
            </button>
          </div>

          {showAddHabit && (
            <form
              onSubmit={handleAddHabitSubmit}
              className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200 dark:border-slate-800 p-4 grid grid-cols-1 sm:grid-cols-4 gap-3"
            >
              <input
                type="text"
                required
                value={newHabitTitle}
                onChange={(e) => setNewHabitTitle(e.target.value)}
                placeholder="Habit title"
                className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
              <select
                value={newHabitCat}
                onChange={(e) => setNewHabitCat(e.target.value as CategoryId)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <select
                  value={newHabitFreq}
                  onChange={(e) =>
                    setNewHabitFreq(e.target.value as HabitFrequency)
                  }
                  className="flex-1 px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="custom">Custom</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={newHabitTarget}
                  onChange={(e) => setNewHabitTarget(Number(e.target.value))}
                  className="w-16 px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                >
                  Add
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.habits.map((habit) => {
              const cat = getCategoryMeta(habit.category);
              const todayLog = state.habitLogs.find(
                (l) => l.habitId === habit.id && l.date === now.date
              );
              const weekDone = weekDates.filter((d) =>
                state.habitLogs.some(
                  (l) =>
                    l.habitId === habit.id && l.date === d && l.status === 'done'
                )
              ).length;
              const weekSkipped = weekDates.filter((d) =>
                state.habitLogs.some(
                  (l) =>
                    l.habitId === habit.id &&
                    l.date === d &&
                    l.status === 'skipped'
                )
              ).length;

              const eligibleTarget = habit.paused
                ? 0
                : Math.max(1, habit.weeklyTarget - weekSkipped);
              const consistency = habit.paused
                ? null
                : Math.min(100, Math.round((weekDone / eligibleTarget) * 100));

              return (
                <div
                  key={habit.id}
                  className={`rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4 ${
                    habit.paused ? 'opacity-65' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        <span
                          className="inline-block w-2 h-2 rounded-sm mr-1.5"
                          style={{ backgroundColor: cat.colour }}
                        />
                        {cat.label} · {habit.frequency} · Target{' '}
                        <span className="font-mono tabular-nums">
                          {habit.weeklyTarget}/wk
                        </span>
                      </p>
                      <h3 className="text-base font-semibold mt-0.5">
                        {habit.title}
                      </h3>
                      {habit.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {habit.notes}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => toggleHabitPause(habit.id)}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      {habit.paused ? 'Resume' : 'Pause'}
                    </button>
                  </div>

                  {/* 14-day gentle visual strip */}
                  <div className="flex items-center justify-between gap-1">
                    {trailing14Dates.map((d) => {
                      const log = state.habitLogs.find(
                        (l) => l.habitId === habit.id && l.date === d
                      );
                      const isToday = d === now.date;
                      return (
                        <button
                          key={d}
                          disabled={habit.paused}
                          onClick={() => {
                            if (!log) setHabitStatus(habit.id, d, 'done');
                            else if (log.status === 'done')
                              setHabitStatus(habit.id, d, 'skipped');
                            else setHabitStatus(habit.id, d, 'clear');
                          }}
                          title={`${formatShortDate(d)} — ${
                            log ? log.status : 'not logged'
                          } (tap to cycle)`}
                          className={`flex-1 h-7 rounded-md text-[10px] font-mono transition flex items-center justify-center ${
                            log?.status === 'done'
                              ? 'text-white font-semibold'
                              : log?.status === 'skipped'
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                              : 'bg-slate-100 dark:bg-slate-800/70 text-slate-400'
                          } ${isToday ? 'ring-1 ring-slate-900 dark:ring-slate-200' : ''}`}
                          style={
                            log?.status === 'done'
                              ? { backgroundColor: cat.colour }
                              : undefined
                          }
                        >
                          {log?.status === 'done'
                            ? '✓'
                            : log?.status === 'skipped'
                            ? '–'
                            : d.slice(-2)}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                      This week: {weekDone}/{habit.weeklyTarget}
                      {consistency !== null && ` · ${consistency}% consistency`}
                      {habit.paused && ' · Paused'}
                    </div>

                    {!habit.paused && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() =>
                            setHabitStatus(
                              habit.id,
                              now.date,
                              todayLog?.status === 'done' ? 'clear' : 'done'
                            )
                          }
                          className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition ${
                            todayLog?.status === 'done'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {todayLog?.status === 'done' ? 'Done' : 'Check in'}
                        </button>
                        <button
                          onClick={() =>
                            setHabitStatus(
                              habit.id,
                              now.date,
                              todayLog?.status === 'skipped' ? 'clear' : 'skipped'
                            )
                          }
                          className={`min-h-[36px] px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition ${
                            todayLog?.status === 'skipped'
                              ? 'bg-slate-200 dark:bg-slate-700'
                              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <SkipForward className="w-3.5 h-3.5" /> Skip day
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: RECORDED ACTIVITY HISTORY */}
      {tab === 'history' && (
        <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5">
          {state.activityRecords.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm font-medium">No recorded time logs yet</p>
              <p className="text-xs text-slate-500">
                Confirm a scheduled event on Today, use the timer, or log an
                activity manually.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {state.activityRecords
                .slice()
                .sort((a, b) =>
                  `${b.date}${b.startTime}`.localeCompare(
                    `${a.date}${a.startTime}`
                  )
                )
                .map((rec) => {
                  const cat = getCategoryMeta(rec.category);
                  const isEditing = editingRecordId === rec.id;
                  return (
                    <div
                      key={rec.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <span
                            className="w-2 h-2 rounded-sm"
                            style={{ backgroundColor: cat.colour }}
                          />
                          <span className="font-mono tabular-nums">
                            {formatShortDate(rec.date)} · {rec.startTime}–
                            {rec.endTime}
                          </span>
                          <span>·</span>
                          <span>
                            {cat.label} / {rec.subcategory}
                          </span>
                          <span>·</span>
                          <span className="capitalize">{rec.sourceType}</span>
                          {rec.isDemoData && (
                            <span className="text-amber-700 dark:text-amber-300 font-medium">
                              · Sample data
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold mt-0.5">
                          {rec.title}
                          {rec.project ? ` — ${rec.project}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={1440}
                              value={editingMins}
                              onChange={(e) =>
                                setEditingMins(Number(e.target.value))
                              }
                              className="w-20 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                            />
                            <button
                              onClick={() => {
                                updateActivityRecord(rec.id, {
                                  actualMinutes: editingMins,
                                });
                                setEditingRecordId(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingRecordId(null)}
                              className="p-1 text-slate-400"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingRecordId(rec.id);
                                setEditingMins(rec.actualMinutes);
                              }}
                              className="font-mono tabular-nums text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                            >
                              {formatDuration(rec.actualMinutes)}
                            </button>
                            <button
                              onClick={() => deleteActivityRecord(rec.id)}
                              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600"
                              aria-label="Delete log"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
