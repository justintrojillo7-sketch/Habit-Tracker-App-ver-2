import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarPlus,
  Check,
  Clock,
  Dumbbell,
  Edit3,
  FastForward,
  Film,
  Link2,
  MapPin,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Unlink,
  Upload,
  X,
} from 'lucide-react';
import { CATEGORIES } from '../data/seedData';
import { useLifeHQ } from '../context/LifeHQContext';
import { CategoryId, EventOccurrence, Habit } from '../types/lifehq';
import {
  addDays,
  formatDisplayDate,
  formatDuration,
  formatHoursDecimal,
  formatShortDate,
  getGreeting,
  getIsoWeekday,
  getMondayOfWeek,
  getSundayOfWeek,
  getWeekType,
  isSchoolHoliday,
  timeToMinutes,
} from '../utils/dateUtils';
import { expandEventsForRange } from '../utils/recurrence';
import {
  calculateAggregateHabitSummary,
  formatHabitScheduleLabel,
  formatHabitStackText,
  formatHabitTargetLabel,
  formatPreferredWindow,
  getHabitAnchorDisplay,
  isHabitStarterEligible,
} from '../utils/habitUtils';
import {
  getActiveBeholdWeek,
  getDevotionForDate,
  getRebuildPhaseInfo,
  getSessionKeyForDateOrEvent,
  getWednesdayCardioPrescription,
  partitionBibleStudies,
} from '../utils/pillarUtils';
import { EventModal } from './EventModal';
import { HabitModal } from './HabitModal';
import { ImportBackupModal } from './ImportBackupModal';
import { TwoMinuteStarterModal } from './TwoMinuteStarterModal';

export const TodayView: React.FC = () => {
  const {
    state,
    now,
    legacyBackupInfo,
    setActiveSection,
    openPillar,
    getCategoryMeta,
    confirmOccurrence,
    clearOccurrenceConfirmation,
    startTimer,
    addPriority,
    togglePriority,
    updatePriority,
    postponePriority,
    deletePriority,
    setHabitStatus,
    clearStarterAttempt,
    updateHabitStack,
  } = useLifeHQ();

  const [newPriorityText, setNewPriorityText] = useState('');
  const [newPriorityCat, setNewPriorityCat] = useState<CategoryId>('teaching');
  const [showAddPriority, setShowAddPriority] = useState(false);
  const [editingPriorityId, setEditingPriorityId] = useState<string | null>(null);
  const [editingPriorityText, setEditingPriorityText] = useState('');
  const [durationEditKey, setDurationEditKey] = useState<string | null>(null);
  const [durationEditMins, setDurationEditMins] = useState<number>(60);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOcc, setEditingOcc] = useState<EventOccurrence | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<EventOccurrence | null>(null);
  const [habitExcuseTargetId, setHabitExcuseTargetId] = useState<string | null>(null);
  const [habitExcuseNote, setHabitExcuseNote] = useState('');
  const [starterHabit, setStarterHabit] = useState<Habit | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [autoLoadLegacy, setAutoLoadLegacy] = useState(false);
  const [importBannerDismissed, setImportBannerDismissed] = useState(false);

  const today = now.date;
  const weekType = getWeekType(today, state.settings);
  const holiday = isSchoolHoliday(today, state.settings.schoolHolidays);

  const todayOccurrences = useMemo(
    () =>
      expandEventsForRange(
        state.events,
        today,
        today,
        state.settings,
        state.activityRecords
      ),
    [state.events, today, state.settings, state.activityRecords]
  );

  const { currentActivity, nextActivity } = useMemo(() => {
    const actionable = todayOccurrences.filter((o) => !o.isRoutineMarker);
    const curr = actionable.find(
      (o) =>
        timeToMinutes(o.startTime) <= now.minutes &&
        timeToMinutes(o.endTime) > now.minutes &&
        o.activityRecord?.status !== 'cancelled' &&
        o.activityRecord?.status !== 'skipped'
    );
    const nxt = actionable.find(
      (o) =>
        timeToMinutes(o.startTime) > now.minutes &&
        o.activityRecord?.status !== 'cancelled' &&
        o.activityRecord?.status !== 'skipped'
    );
    return { currentActivity: curr, nextActivity: nxt };
  }, [todayOccurrences, now.minutes]);

  const todaysPriorities = useMemo(
    () => state.priorities.filter((p) => p.date === today),
    [state.priorities, today]
  );
  const unfinishedPastPriorities = useMemo(
    () => state.priorities.filter((p) => p.date < today && !p.completed),
    [state.priorities, today]
  );

  const monday = getMondayOfWeek(today);
  const sunday = getSundayOfWeek(today);

  const weekSnapshot = useMemo(() => {
    const weekRecords = state.activityRecords.filter(
      (r) => r.date >= monday && r.date <= sunday
    );
    const gymCount = weekRecords.filter(
      (r) =>
        r.category === 'fitness' &&
        (r.status === 'completed' || r.status === 'partial')
    ).length;
    const beholdMinutes = weekRecords
      .filter((r) => r.category === 'behold')
      .reduce((acc, r) => acc + r.actualMinutes, 0);

    const faithHabitIds = new Set(
      state.habits.filter((h) => h.category === 'faith').map((h) => h.id)
    );
    const devotionDateSet = new Set<string>([
      ...state.habitLogs
        .filter(
          (l) =>
            faithHabitIds.has(l.habitId) &&
            l.status === 'done' &&
            l.date >= monday &&
            l.date <= sunday
        )
        .map((l) => l.date),
      ...state.devotionEntries
        .filter((d) => d.date >= monday && d.date <= sunday)
        .map((d) => d.date),
    ]);
    const devotionDays = devotionDateSet.size;

    const upcomingMinistry = expandEventsForRange(
      state.events,
      today,
      addDays(today, 7),
      state.settings,
      state.activityRecords
    ).filter(
      (o) =>
        o.category === 'faith' &&
        o.subcategory !== 'Devotion' &&
        o.activityRecord?.status !== 'cancelled'
    );

    const teachingPrepCount = weekRecords.filter(
      (r) =>
        r.category === 'teaching' &&
        r.subcategory === 'Lesson planning' &&
        (r.status === 'completed' || r.status === 'partial')
    ).length;

    const scheduledPrepCount = expandEventsForRange(
      state.events,
      monday,
      sunday,
      state.settings,
      state.activityRecords
    ).filter(
      (o) =>
        o.category === 'teaching' &&
        o.subcategory === 'Lesson planning' &&
        o.activityRecord?.status !== 'cancelled'
    ).length;

    return {
      gymCount,
      beholdMinutes,
      devotionDays,
      upcomingMinistry,
      teachingPrepCount,
      scheduledPrepCount,
    };
  }, [state, monday, sunday, today]);

  const habitSummary = useMemo(
    () =>
      calculateAggregateHabitSummary(
        state.habits,
        today,
        state.habitLogs,
        state.events,
        state.settings,
        state.activityRecords
      ),
    [
      state.habits,
      today,
      state.habitLogs,
      state.events,
      state.settings,
      state.activityRecords,
    ]
  );

  const todayHabits = useMemo(
    () =>
      state.habits.filter((h) => {
        if (h.paused || h.archived) return false;
        return habitSummary.statsById.get(h.id)?.showOnToday ?? false;
      }),
    [state.habits, habitSummary.statsById]
  );

  // Group today's habits by stack anchor so stacked habits appear together on Today
  const todayHabitGroups = useMemo(() => {
    const anchorGroups = new Map<
      string,
      {
        key: string;
        anchorLabel: string;
        anchorTime?: string;
        habits: Habit[];
      }
    >();
    const standalone: Habit[] = [];

    for (const h of todayHabits) {
      const anchor = getHabitAnchorDisplay(h, state.events);
      if (anchor) {
        const existing = anchorGroups.get(anchor.key);
        if (existing) {
          existing.habits.push(h);
        } else {
          anchorGroups.set(anchor.key, {
            key: anchor.key,
            anchorLabel: anchor.label,
            anchorTime: anchor.event?.startTime,
            habits: [h],
          });
        }
      } else {
        standalone.push(h);
      }
    }

    const orderedGroups = Array.from(anchorGroups.values()).sort((a, b) =>
      (a.anchorTime ?? '99:99').localeCompare(b.anchorTime ?? '99:99')
    );

    return { orderedGroups, standalone };
  }, [todayHabits, state.events]);

  // Habits stacked directly onto today's timeline events (excluding paused/archived)
  const stackedHabitsByEventId = useMemo(() => {
    const map = new Map<string, Habit[]>();
    for (const h of state.habits) {
      if (h.paused || h.archived || !h.stackAnchorEventId) continue;
      const list = map.get(h.stackAnchorEventId) ?? [];
      list.push(h);
      map.set(h.stackAnchorEventId, list);
    }
    return map;
  }, [state.habits]);

  const handleCarryForward = () => {
    const slots = Math.max(0, 3 - todaysPriorities.length);
    unfinishedPastPriorities.slice(0, slots).forEach((p) => {
      updatePriority(p.id, { date: today });
    });
  };

  const handleAddPrioritySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPriorityText.trim()) return;
    addPriority(newPriorityText, newPriorityCat, today);
    setNewPriorityText('');
    setShowAddPriority(false);
  };

  const pillarsToday = useMemo(() => {
    const isoDay = getIsoWeekday(today);
    const morningDevotion = getDevotionForDate(
      state.devotionEntries,
      today,
      'morning'
    );
    const eveningDevotion = getDevotionForDate(
      state.devotionEntries,
      today,
      'evening'
    );
    const { active: activeStudy } = partitionBibleStudies(state.bibleStudies);

    const rebuildPhase = getRebuildPhaseInfo(
      state.fitnessConfig.rebuildStartDate,
      today,
      state.fitnessConfig.lastReviewDate
    );
    const workoutKey =
      isoDay === 1 || isoDay === 4 || isoDay === 5 || isoDay === 6
        ? getSessionKeyForDateOrEvent(undefined, isoDay)
        : null;
    const workoutPlan = workoutKey
      ? state.fitnessConfig.workoutPlan.find((p) => p.key === workoutKey)
      : undefined;
    const workoutLog = workoutKey
      ? state.workoutLogs.find(
          (w) => w.sessionKey === workoutKey && w.date === today
        )
      : undefined;
    const wedCardioPlan =
      isoDay === 3
        ? getWednesdayCardioPrescription(today, state.settings)
        : null;
    const wedCardioLog =
      isoDay === 3
        ? state.cardioLogs.find((c) => c.date === today)
        : undefined;
    const proteinGrams = state.fitnessConfig.dailyProteinLogs[today];

    const activeBeholdWeek = getActiveBeholdWeek(state.beholdWeeks);
    const beholdDoneShots = activeBeholdWeek
      ? activeBeholdWeek.shotList.filter((s) => s.completed).length
      : 0;
    const beholdTotalShots = activeBeholdWeek
      ? activeBeholdWeek.shotList.length
      : 0;

    return {
      isoDay,
      morningDevotion,
      eveningDevotion,
      activeStudy,
      rebuildPhase,
      workoutPlan,
      workoutLog,
      wedCardioPlan,
      wedCardioLog,
      proteinGrams,
      activeBeholdWeek,
      beholdDoneShots,
      beholdTotalShots,
      beholdScheduledToday: isoDay === 2 || isoDay === 4 || isoDay === 6,
    };
  }, [
    today,
    state.devotionEntries,
    state.bibleStudies,
    state.fitnessConfig,
    state.workoutLogs,
    state.cardioLogs,
    state.settings,
    state.beholdWeeks,
  ]);

  const actionableCount = todayOccurrences.filter(
    (o) => !o.isRoutineMarker
  ).length;
  const completedCount = todayOccurrences.filter(
    (o) => !o.isRoutineMarker && o.activityRecord?.status === 'completed'
  ).length;

  const isWorkspaceEmpty =
    state.events.length === 0 &&
    state.habits.length === 0 &&
    state.goals.length === 0 &&
    state.activityRecords.length === 0;

  const showEmptyImportBanner =
    isWorkspaceEmpty &&
    !state.migrationMeta?.personalImportCompletedAt &&
    !importBannerDismissed;

  const pendingFaithHabit = useMemo(
    () =>
      todayHabits.find(
        (h) =>
          h.category === 'faith' &&
          habitSummary.statsById.get(h.id)?.todayLog?.status !== 'done'
      ) ?? null,
    [todayHabits, habitSummary.statsById]
  );

  return (
    <div className="space-y-6">
      {showEmptyImportBanner && (
        <section className="rounded-2xl bg-slate-900 text-white dark:bg-[#182235] border border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">
              Empty workspace — import your saved backup or setup
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              {legacyBackupInfo.exists
                ? `Detected legacy local browser data on this device (${legacyBackupInfo.eventCount} events, ${legacyBackupInfo.habitCount} habits, ${legacyBackupInfo.goalCount} goals). Preview before importing into your account.`
                : 'Starting fresh. If you exported a LifeHQ JSON backup earlier, you can preview and import it safely into your account.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {legacyBackupInfo.exists && (
              <button
                type="button"
                onClick={() => {
                  setAutoLoadLegacy(true);
                  setImportModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100"
              >
                <Upload className="w-3.5 h-3.5" /> Import browser setup
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setAutoLoadLegacy(false);
                setImportModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-600 hover:bg-slate-800"
            >
              <Upload className="w-3.5 h-3.5" /> Import JSON backup
            </button>
            <button
              type="button"
              onClick={() => setImportBannerDismissed(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-white"
              aria-label="Dismiss import prompt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* Header Command Banner */}
      <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              <span>Week {weekType}</span>
              <span aria-hidden="true"> · </span>
              <span>{formatDisplayDate(today)}</span>
              {holiday && (
                <>
                  <span aria-hidden="true"> · </span>
                  <span className="text-amber-700 dark:text-amber-300">
                    School holiday ({holiday.label})
                  </span>
                </>
              )}
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
              {getGreeting(now.minutes)}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 tabular-nums">
              {actionableCount} scheduled blocks today · {completedCount}{' '}
              confirmed completed
            </p>
          </div>

          {/* Current / Next Focus Box */}
          <div className="lg:min-w-[290px] rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 p-4">
            {currentActivity ? (
              <>
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  Happening now
                </p>
                <p className="font-semibold text-sm mt-1 truncate">
                  {currentActivity.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                  {currentActivity.startTime}–{currentActivity.endTime}
                  {currentActivity.location ? ` · ${currentActivity.location}` : ''}
                </p>
              </>
            ) : nextActivity ? (
              <>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Up next
                </p>
                <p className="font-semibold text-sm mt-1 truncate">
                  {nextActivity.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                  {nextActivity.startTime}–{nextActivity.endTime}
                  {nextActivity.location ? ` · ${nextActivity.location}` : ''}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Evening
                </p>
                <p className="text-sm font-semibold mt-1">
                  No remaining scheduled blocks
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                  Target bedtime {state.settings.targetBedtime}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSection('track')}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 whitespace-nowrap transition"
          >
            <Play className="w-3.5 h-3.5" /> Start activity
          </button>
          <button
            onClick={() => setActiveSection('track')}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap transition"
          >
            <Clock className="w-3.5 h-3.5" /> Log completed
          </button>
          <button
            onClick={() => {
              setEditingOcc(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap transition"
          >
            <CalendarPlus className="w-3.5 h-3.5" /> Add event
          </button>
          <button
            onClick={() => setShowAddPriority(true)}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap transition"
          >
            <Plus className="w-3.5 h-3.5" /> Add priority
          </button>
          {pendingFaithHabit ? (
            <button
              onClick={() => {
                setHabitStatus(pendingFaithHabit.id, today, 'done', 'manual');
              }}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap transition"
            >
              <Check className="w-3.5 h-3.5" /> Log {pendingFaithHabit.title}
            </button>
          ) : (
            <button
              onClick={() => openPillar('faith')}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap transition"
            >
              <BookOpen className="w-3.5 h-3.5" /> Faith workspace
            </button>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column: Priorities & Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Daily Priorities (up to 3) */}
          <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base font-semibold">
                  Today&apos;s Priorities
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Up to three key tasks for today.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {unfinishedPastPriorities.length > 0 &&
                  todaysPriorities.length < 3 && (
                    <button
                      onClick={handleCarryForward}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap transition"
                    >
                      Carry forward ({unfinishedPastPriorities.length})
                    </button>
                  )}
                {todaysPriorities.length < 3 && (
                  <button
                    onClick={() => setShowAddPriority((v) => !v)}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                    aria-label="Add priority"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {showAddPriority && (
              <form
                onSubmit={handleAddPrioritySubmit}
                className="mb-3 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2"
              >
                <input
                  type="text"
                  maxLength={200}
                  value={newPriorityText}
                  onChange={(e) => setNewPriorityText(e.target.value)}
                  placeholder="What matters most today?"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                  autoFocus
                />
                <select
                  value={newPriorityCat}
                  onChange={(e) =>
                    setNewPriorityCat(e.target.value as CategoryId)
                  }
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold"
                >
                  Add
                </button>
              </form>
            )}

            {todaysPriorities.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                No priorities set for today. Add up to three to stay focused.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {todaysPriorities.slice(0, 3).map((p) => {
                  const cat = getCategoryMeta(p.category);
                  const isEditing = editingPriorityId === p.id;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          onClick={() => togglePriority(p.id)}
                          className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition ${
                            p.completed
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 dark:border-slate-600 hover:border-slate-500'
                          }`}
                          aria-label="Toggle priority completion"
                        >
                          {p.completed && <Check className="w-3.5 h-3.5" />}
                        </button>
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: cat.colour }}
                          aria-hidden="true"
                        />
                        {isEditing ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (editingPriorityText.trim()) {
                                updatePriority(p.id, {
                                  title: editingPriorityText.trim(),
                                });
                              }
                              setEditingPriorityId(null);
                            }}
                            className="flex-1 flex gap-2"
                          >
                            <input
                              value={editingPriorityText}
                              onChange={(e) =>
                                setEditingPriorityText(e.target.value)
                              }
                              className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                              autoFocus
                            />
                            <button
                              type="submit"
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                            >
                              Save
                            </button>
                          </form>
                        ) : (
                          <span
                            className={`text-sm truncate ${
                              p.completed
                                ? 'line-through text-slate-400 dark:text-slate-500'
                                : 'font-medium'
                            }`}
                          >
                            {p.title}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => {
                            setEditingPriorityId(p.id);
                            setEditingPriorityText(p.title);
                          }}
                          title="Edit"
                          aria-label="Edit priority"
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => postponePriority(p.id)}
                          title="Postpone to tomorrow"
                          aria-label="Postpone priority"
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        >
                          <FastForward className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deletePriority(p.id)}
                          title="Replace / remove"
                          aria-label="Remove priority"
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Today's Scheduled Habits */}
          <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base font-semibold">Today&apos;s Habits</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  {habitSummary.todayScheduledCount > 0
                    ? `${
                        Number.isInteger(habitSummary.todayCredits)
                          ? habitSummary.todayCredits
                          : habitSummary.todayCredits.toFixed(1)
                      } / ${habitSummary.todayScheduledCount} completed`
                    : 'No unexcused habits due today'}
                  {habitSummary.weeklyPct !== null
                    ? ` · ${habitSummary.weeklyPct}% 7d consistency`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('habits')}
                className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline inline-flex items-center gap-1 whitespace-nowrap"
              >
                Manage habits <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {todayHabits.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                All caught up for today, or open Habits to schedule a new system.
              </p>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const renderTodayHabitRow = (habit: Habit) => {
                    const cat = getCategoryMeta(habit.category);
                    const st = habitSummary.statsById.get(habit.id);
                    const log = st?.todayLog ?? null;
                    const starterAttempt = st?.todayStarterAttempt ?? null;
                    const targetLabel = formatHabitTargetLabel(habit);
                    const stackText = formatHabitStackText(habit, state.events);
                    const preferredWindow = formatPreferredWindow(habit);
                    const starterEligible = isHabitStarterEligible(habit, log);
                    const isExcusing = habitExcuseTargetId === habit.id;

                    return (
                      <div
                        key={habit.id}
                        className="py-3 first:pt-1 last:pb-1 space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                              <span
                                className="w-2 h-2 rounded-sm shrink-0"
                                style={{ backgroundColor: cat.colour }}
                                aria-hidden="true"
                              />
                              <span>{cat.label}</span>
                              <span aria-hidden="true">·</span>
                              <span>{formatHabitScheduleLabel(habit)}</span>
                              {targetLabel && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">
                                    {targetLabel}
                                  </span>
                                </>
                              )}
                              {preferredWindow && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">
                                    {preferredWindow}
                                  </span>
                                </>
                              )}
                              {log?.source === 'calendar' && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                    Calendar linked
                                  </span>
                                </>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                              <p className="text-sm font-medium truncate">
                                {habit.title}
                              </p>
                              <button
                                type="button"
                                onClick={() => setEditingHabit(habit)}
                                className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 inline-flex items-center gap-1"
                                title="Edit habit & stack"
                              >
                                <Edit3 className="w-3 h-3" /> Edit
                              </button>
                            </div>

                            {stackText && (
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 inline-flex items-center gap-1.5 flex-wrap">
                                <Link2 className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{stackText}</span>
                                <button
                                  type="button"
                                  onClick={() => updateHabitStack(habit.id, null)}
                                  className="text-[11px] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-0.5 ml-1"
                                  title="Remove stack link"
                                >
                                  <Unlink className="w-3 h-3" /> Unlink
                                </button>
                              </p>
                            )}

                            {habit.twoMinuteRule && !log && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                2-min starter: {habit.twoMinuteRule}
                              </p>
                            )}

                            {starterAttempt && log?.status !== 'done' && (
                              <p className="text-xs text-amber-700 dark:text-amber-300 font-medium mt-0.5 flex items-center gap-2 flex-wrap">
                                <span>
                                  Started small today
                                  {starterAttempt.notes
                                    ? ` · ${starterAttempt.notes}`
                                    : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => clearStarterAttempt(habit.id, today)}
                                  className="text-[11px] font-normal text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                                >
                                  Clear start
                                </button>
                              </p>
                            )}

                            {log && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {log.status === 'done' && 'Completed'}
                                {log.status === 'partial' && 'Partially completed'}
                                {log.status === 'skipped' && 'Skipped'}
                                {log.status === 'excused' && 'Excused (no penalty)'}
                                {log.notes ? ` · ${log.notes}` : ''}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            {starterEligible && (
                              <button
                                type="button"
                                onClick={() => setStarterHabit(habit)}
                                className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                              >
                                <Sparkles className="w-3.5 h-3.5" /> Start Small
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setHabitStatus(
                                  habit.id,
                                  today,
                                  log?.status === 'done' ? 'clear' : 'done'
                                )
                              }
                              className={`inline-flex items-center gap-1 min-h-[36px] px-3 rounded-lg text-xs font-semibold transition ${
                                log?.status === 'done'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              {log?.status === 'done' ? 'Done' : 'Complete'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setHabitStatus(
                                  habit.id,
                                  today,
                                  log?.status === 'partial' ? 'clear' : 'partial'
                                )
                              }
                              className={`min-h-[36px] px-2.5 rounded-lg text-xs font-medium transition ${
                                log?.status === 'partial'
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              Partial
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setHabitStatus(
                                  habit.id,
                                  today,
                                  log?.status === 'skipped' ? 'clear' : 'skipped'
                                )
                              }
                              className={`min-h-[36px] px-2 rounded-lg text-xs font-medium transition ${
                                log?.status === 'skipped'
                                  ? 'bg-slate-700 text-white'
                                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                              title="Skip today"
                            >
                              <SkipForward className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (isExcusing) {
                                  setHabitExcuseTargetId(null);
                                } else {
                                  setHabitExcuseTargetId(habit.id);
                                  setHabitExcuseNote(log?.notes ?? '');
                                }
                              }}
                              className={`min-h-[36px] px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition ${
                                log?.status === 'excused'
                                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                              title="Excuse with note (no penalty)"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" /> Excuse
                            </button>
                          </div>
                        </div>

                        {isExcusing && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              setHabitStatus(
                                habit.id,
                                today,
                                'excused',
                                'manual',
                                habitExcuseNote || 'Rest / excused'
                              );
                              setHabitExcuseTargetId(null);
                              setHabitExcuseNote('');
                            }}
                            className="flex flex-col sm:flex-row gap-2 pt-1"
                          >
                            <input
                              type="text"
                              maxLength={200}
                              value={habitExcuseNote}
                              onChange={(e) => setHabitExcuseNote(e.target.value)}
                              placeholder="Reason (rest day, illness, holiday, cancelled)..."
                              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                              autoFocus
                            />
                            <div className="flex gap-1.5">
                              <button
                                type="submit"
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                              >
                                Save excuse
                              </button>
                              <button
                                type="button"
                                onClick={() => setHabitExcuseTargetId(null)}
                                className="px-2.5 py-1.5 text-xs text-slate-500"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    );
                  };

                  return (
                    <>
                      {todayHabitGroups.orderedGroups.map((grp) => (
                        <div
                          key={grp.key}
                          className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/35 px-3.5 py-2.5"
                        >
                          <div className="flex items-center justify-between gap-2 pb-2 mb-1 border-b border-slate-200/70 dark:border-slate-800/80">
                            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                              <Link2 className="w-3.5 h-3.5 text-slate-400" />
                              Stacked after {grp.anchorLabel}
                            </p>
                            {grp.anchorTime && (
                              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                Anchor {grp.anchorTime}
                              </span>
                            )}
                          </div>
                          <div className="divide-y divide-slate-200/60 dark:divide-slate-800/70">
                            {grp.habits.map(renderTodayHabitRow)}
                          </div>
                        </div>
                      ))}

                      {todayHabitGroups.standalone.length > 0 && (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                          {todayHabitGroups.standalone.map(renderTodayHabitRow)}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </section>

          {/* Today's Chronological Timeline */}
          <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-semibold">Today&apos;s Timeline</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Scheduled events count as actual time only after confirmation.
                </p>
              </div>
              <button
                onClick={() => setActiveSection('calendar')}
                className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline inline-flex items-center gap-1 whitespace-nowrap"
              >
                Calendar <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {todayOccurrences.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                No events scheduled for today.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {todayOccurrences.map((occ) => {
                  const cat = getCategoryMeta(occ.category);
                  const rec = occ.activityRecord;
                  const isCancelled = rec?.status === 'cancelled';
                  const isSkipped = rec?.status === 'skipped';
                  const isCompleted = rec?.status === 'completed';

                  return (
                    <div
                      key={occ.occurrenceKey}
                      className={`py-3.5 first:pt-1 last:pb-1 transition ${
                        isCancelled || isSkipped ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {/* Clean unboxed metadata row (zero pills) */}
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: cat.colour }}
                              aria-hidden="true"
                            />
                            <span className="font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300">
                              {occ.startTime}–{occ.endTime}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{cat.label}</span>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">
                              {occ.commitmentStatus}
                            </span>
                            {occ.linkedRoleBadge && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  Role: {occ.linkedRoleBadge}
                                </span>
                              </>
                            )}
                          </div>

                          <h3
                            className={`text-sm font-semibold mt-1 ${
                              isCancelled ? 'line-through' : ''
                            }`}
                          >
                            {occ.title}
                          </h3>

                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {occ.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {occ.location}
                              </span>
                            )}
                            {occ.durationUnconfirmed && (
                              <span className="text-amber-700 dark:text-amber-400">
                                Duration to confirm
                              </span>
                            )}
                            {rec && (
                              <span
                                className={`font-medium ${
                                  isCompleted
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                {rec.status === 'completed' &&
                                  `Completed (${formatDuration(rec.actualMinutes)})`}
                                {rec.status === 'partial' &&
                                  `Partially completed (${formatDuration(rec.actualMinutes)})`}
                                {rec.status === 'skipped' && 'Skipped'}
                                {rec.status === 'cancelled' &&
                                  'Cancelled (excluded from metrics)'}
                                {rec.status === 'rescheduled' && 'Rescheduled'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick Actions */}
                        {!occ.isRoutineMarker && (
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            {!rec ? (
                              <>
                                <button
                                  onClick={() =>
                                    confirmOccurrence(occ, 'completed')
                                  }
                                  className="inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 whitespace-nowrap transition"
                                >
                                  <Check className="w-3.5 h-3.5" /> Complete
                                </button>
                                <button
                                  onClick={() =>
                                    startTimer({
                                      category: occ.category,
                                      subcategory: occ.subcategory,
                                      title: occ.title,
                                      linkedEventId: occ.eventId,
                                      linkedOccurrenceDate: occ.originalDate,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap transition"
                                  title="Start timer"
                                >
                                  <Play className="w-3.5 h-3.5" /> Timer
                                </button>
                                <button
                                  onClick={() =>
                                    confirmOccurrence(occ, 'skipped')
                                  }
                                  className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap transition"
                                >
                                  Skip
                                </button>
                                <button
                                  onClick={() =>
                                    confirmOccurrence(occ, 'cancelled')
                                  }
                                  className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap transition"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => setRescheduleTarget(occ)}
                                  className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap transition"
                                >
                                  Reschedule
                                </button>
                              </>
                            ) : (
                              <>
                                {(rec.status === 'completed' ||
                                  rec.status === 'partial') && (
                                  <button
                                    onClick={() => {
                                      setDurationEditKey(occ.occurrenceKey);
                                      setDurationEditMins(rec.actualMinutes);
                                    }}
                                    className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap transition"
                                  >
                                    Edit duration
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    clearOccurrenceConfirmation(
                                      occ.eventId,
                                      occ.originalDate
                                    )
                                  }
                                  className="inline-flex items-center gap-1 min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap transition"
                                  title="Undo status"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" /> Undo
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                setEditingOcc(occ);
                                setModalOpen(true);
                              }}
                              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              title="Edit event"
                              aria-label="Edit event"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Inline Duration Correction */}
                      {durationEditKey === occ.occurrenceKey && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                          <label className="text-xs text-slate-500">
                            Actual minutes:
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={1440}
                            value={durationEditMins}
                            onChange={(e) =>
                              setDurationEditMins(Number(e.target.value))
                            }
                            className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                          />
                          <button
                            onClick={() => {
                              confirmOccurrence(
                                occ,
                                'completed',
                                durationEditMins
                              );
                              setDurationEditKey(null);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setDurationEditKey(null)}
                            className="px-2.5 py-1.5 text-xs text-slate-500"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {/* Stacked Habits Attached After This Anchor */}
                      {(() => {
                        const attachedHabits =
                          stackedHabitsByEventId.get(occ.eventId) ?? [];
                        if (attachedHabits.length === 0) return null;
                        return (
                          <div className="mt-2.5 ml-2 pl-3 border-l-2 border-slate-200 dark:border-slate-700 space-y-2">
                            {attachedHabits.map((sh) => {
                              const shCat = getCategoryMeta(sh.category);
                              const shStats = habitSummary.statsById.get(sh.id);
                              const shLog = shStats?.todayLog ?? null;
                              const shStarter =
                                shStats?.todayStarterAttempt ?? null;
                              const shWindow = formatPreferredWindow(sh);
                              const shEligible = isHabitStarterEligible(
                                sh,
                                shLog
                              );
                              return (
                                <div
                                  key={sh.id}
                                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                      <Link2 className="w-3 h-3 shrink-0" />
                                      <span>Stacked after this</span>
                                      {shWindow && (
                                        <>
                                          <span>·</span>
                                          <span className="font-mono tabular-nums">
                                            {shWindow}
                                          </span>
                                        </>
                                      )}
                                      {shLog?.status === 'done' && (
                                        <>
                                          <span>·</span>
                                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                            Completed
                                          </span>
                                        </>
                                      )}
                                      {shStarter && shLog?.status !== 'done' && (
                                        <>
                                          <span>·</span>
                                          <span className="text-amber-700 dark:text-amber-300 font-medium">
                                            Started small
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    <p className="text-xs font-medium mt-0.5 flex items-center gap-1.5">
                                      <span
                                        className="w-2 h-2 rounded-sm shrink-0"
                                        style={{
                                          backgroundColor: shCat.colour,
                                        }}
                                      />
                                      <span className="truncate">
                                        {sh.title}
                                        {sh.stackAction
                                          ? ` — ${sh.stackAction}`
                                          : ''}
                                      </span>
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {shEligible && (
                                      <button
                                        type="button"
                                        onClick={() => setStarterHabit(sh)}
                                        className="min-h-[32px] px-2.5 rounded-lg text-[11px] font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center gap-1"
                                      >
                                        <Sparkles className="w-3 h-3" /> Start
                                        Small
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setHabitStatus(
                                          sh.id,
                                          today,
                                          shLog?.status === 'done'
                                            ? 'clear'
                                            : 'done'
                                        )
                                      }
                                      className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 ${
                                        shLog?.status === 'done'
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                      }`}
                                    >
                                      <Check className="w-3 h-3" />
                                      {shLog?.status === 'done'
                                        ? 'Done'
                                        : 'Complete'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Development Pillars & Weekly Snapshot */}
        <aside className="space-y-6">
          <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base font-semibold">
                  Today&apos;s Development Pillars
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Daily anchors for Faith, Fitness, and Creative craft.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openPillar('faith')}
                className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline inline-flex items-center gap-1 whitespace-nowrap"
              >
                Pillars <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {/* Faith Pillar */}
              <div className="py-3 first:pt-1 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: getCategoryMeta('faith').colour }}
                      aria-hidden="true"
                    />
                    <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                    Faith &amp; Scripture
                  </span>
                  <button
                    type="button"
                    onClick={() => openPillar('faith')}
                    className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline inline-flex items-center gap-1"
                  >
                    Open workspace <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {pillarsToday.isoDay <= 5
                    ? `Morning devotion: ${
                        pillarsToday.morningDevotion
                          ? pillarsToday.morningDevotion.shortOrMoved
                            ? 'Moved / shortened'
                            : 'Recorded'
                          : 'Remaining'
                      }`
                    : 'Weekend pattern · Morning flexible'}
                  {' · '}
                  <span>
                    Evening reading:{' '}
                    {pillarsToday.eveningDevotion
                      ? pillarsToday.eveningDevotion.shortOrMoved
                        ? 'Moved / short'
                        : 'Recorded'
                      : 'Pending'}
                  </span>
                </p>
                {pillarsToday.activeStudy && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Active study: {pillarsToday.activeStudy.book}
                    {pillarsToday.activeStudy.passage
                      ? ` (${pillarsToday.activeStudy.passage})`
                      : ''}
                  </p>
                )}
              </div>

              {/* Fitness Pillar */}
              <div className="py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: getCategoryMeta('fitness').colour }}
                      aria-hidden="true"
                    />
                    <Dumbbell className="w-3.5 h-3.5 text-slate-500" />
                    Fitness &amp; Athletic Focus
                  </span>
                  <button
                    type="button"
                    onClick={() => openPillar('fitness')}
                    className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline inline-flex items-center gap-1"
                  >
                    Open logger <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                {pillarsToday.workoutPlan ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Today: <strong>{pillarsToday.workoutPlan.title}</strong> ·{' '}
                    {pillarsToday.workoutLog
                      ? 'Workout logged'
                      : `${pillarsToday.workoutPlan.exercises.length} exercises queued`}
                  </p>
                ) : pillarsToday.wedCardioPlan ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {pillarsToday.wedCardioPlan.title} ·{' '}
                    {pillarsToday.wedCardioLog
                      ? pillarsToday.wedCardioLog.cardioType === 'skipped'
                        ? 'Skipped gently (fatigue)'
                        : pillarsToday.wedCardioLog.cardioType === 'low_impact'
                        ? 'Low-impact recovery logged'
                        : 'Cardio logged'
                      : 'Midweek cardio slot'}
                  </p>
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Recovery / mobility day · {pillarsToday.rebuildPhase.label}
                  </p>
                )}
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  {pillarsToday.proteinGrams !== undefined
                    ? `Protein today: ${pillarsToday.proteinGrams}g`
                    : `Target ${state.fitnessConfig.proteinTargetMin}–${state.fitnessConfig.proteinTargetMax}g/day`}
                  {state.fitnessConfig.volleyballCompetitiveMode
                    ? ' · In-season sport mode'
                    : ''}
                </p>
              </div>

              {/* Creative Craft Pillar */}
              <div className="py-3 last:pb-1 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: getCategoryMeta('behold').colour }}
                      aria-hidden="true"
                    />
                    <Film className="w-3.5 h-3.5 text-slate-500" />
                    Creative Craft &amp; Projects
                  </span>
                  <button
                    type="button"
                    onClick={() => openPillar('behold')}
                    className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline inline-flex items-center gap-1"
                  >
                    Open tracker <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                {pillarsToday.activeBeholdWeek ? (
                  <>
                    <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                      Week {pillarsToday.activeBeholdWeek.weekNumber}:{' '}
                      {pillarsToday.activeBeholdWeek.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      Steps {pillarsToday.beholdDoneShots}/{pillarsToday.beholdTotalShots}
                      {pillarsToday.beholdScheduledToday
                        ? ' · Craft block scheduled today'
                        : ' · Active module'}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Open Creative Craft tracker to add or review practice modules.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5">
            <h2 className="text-base font-semibold">Weekly Snapshot</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {formatShortDate(monday)} – {formatShortDate(sunday)}
            </p>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              <div className="py-3 first:pt-0">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    Gym sessions
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {state.fitnessConfig.workoutPlan.length > 0
                      ? `${weekSnapshot.gymCount} / ${state.fitnessConfig.workoutPlan.length}`
                      : `${weekSnapshot.gymCount} logged`}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (weekSnapshot.gymCount /
                          Math.max(
                            1,
                            state.fitnessConfig.workoutPlan.length || 4
                          )) *
                          100
                      )}%`,
                      backgroundColor: getCategoryMeta('fitness').colour,
                    }}
                  />
                </div>
              </div>

              <div className="py-3">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    {getCategoryMeta('behold').label} logged
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {formatHoursDecimal(weekSnapshot.beholdMinutes)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        weekSnapshot.beholdMinutes > 0
                          ? Math.max(12, (weekSnapshot.beholdMinutes / 300) * 100)
                          : 0
                      )}%`,
                      backgroundColor: getCategoryMeta('behold').colour,
                    }}
                  />
                </div>
              </div>

              <div className="py-3">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    Devotional days
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {weekSnapshot.devotionDays} / 7
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (weekSnapshot.devotionDays / 7) * 100)}%`,
                      backgroundColor: getCategoryMeta('faith').colour,
                    }}
                  />
                </div>
              </div>

              <div className="py-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    Work &amp; prep blocks
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {weekSnapshot.scheduledPrepCount > 0
                      ? `${weekSnapshot.teachingPrepCount} / ${weekSnapshot.scheduledPrepCount} blocks`
                      : `${weekSnapshot.teachingPrepCount} logged`}
                  </span>
                </div>
              </div>

              <div className="pt-3">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                  Upcoming faith &amp; service (next 7 days)
                </p>
                {weekSnapshot.upcomingMinistry.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No upcoming faith items scheduled.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {weekSnapshot.upcomingMinistry.map((m) => (
                      <div
                        key={m.occurrenceKey}
                        className="text-xs flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {m.title}
                            {m.linkedRoleBadge ? ` (${m.linkedRoleBadge})` : ''}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                            {formatShortDate(m.date)} · {m.startTime}
                          </p>
                        </div>
                        <span
                          className={`text-[11px] capitalize shrink-0 ${
                            m.commitmentStatus === 'tentative'
                              ? 'text-amber-700 dark:text-amber-400 font-medium'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {m.commitmentStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* Reschedule Shortcut Confirmation Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200 dark:border-slate-800 p-5 shadow-xl">
            <h3 className="text-base font-semibold">Reschedule activity</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Choose whether to mark this occurrence rescheduled or open the
              event editor to pick a new date and time.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => {
                  setEditingOcc(rescheduleTarget);
                  setRescheduleTarget(null);
                  setModalOpen(true);
                }}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              >
                Pick new date &amp; time
              </button>
              <button
                onClick={() => {
                  confirmOccurrence(rescheduleTarget, 'rescheduled');
                  setRescheduleTarget(null);
                }}
                className="w-full py-2.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700"
              >
                Mark rescheduled without moving
              </button>
              <button
                onClick={() => setRescheduleTarget(null)}
                className="w-full py-2 text-xs text-slate-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <EventModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          defaultDate={today}
          editingOccurrence={editingOcc}
        />
      )}

      {starterHabit && (
        <TwoMinuteStarterModal
          isOpen={Boolean(starterHabit)}
          onClose={() => setStarterHabit(null)}
          habit={starterHabit}
          date={today}
        />
      )}

      {editingHabit && (
        <HabitModal
          isOpen={Boolean(editingHabit)}
          onClose={() => setEditingHabit(null)}
          editingHabit={editingHabit}
        />
      )}

      <ImportBackupModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        autoLoadLegacy={autoLoadLegacy}
      />
    </div>
  );
};
