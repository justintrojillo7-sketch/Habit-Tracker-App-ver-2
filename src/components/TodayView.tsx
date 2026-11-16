import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarPlus,
  Check,
  Clock,
  Edit3,
  FastForward,
  MapPin,
  Play,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import { CATEGORIES } from '../data/seedData';
import { useLifeHQ } from '../context/LifeHQContext';
import { CategoryId, EventOccurrence } from '../types/lifehq';
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
import { EventModal } from './EventModal';

export const TodayView: React.FC = () => {
  const {
    state,
    now,
    setActiveSection,
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

    const devotionDays = new Set(
      state.habitLogs
        .filter(
          (l) =>
            l.habitId === 'habit-devotion' &&
            l.status === 'done' &&
            l.date >= monday &&
            l.date <= sunday
        )
        .map((l) => l.date)
    ).size;

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

  const actionableCount = todayOccurrences.filter(
    (o) => !o.isRoutineMarker
  ).length;
  const completedCount = todayOccurrences.filter(
    (o) => !o.isRoutineMarker && o.activityRecord?.status === 'completed'
  ).length;

  return (
    <div className="space-y-6">
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
                  {getIsoWeekday(today) === 5
                    ? ' (flexible on Youth nights)'
                    : ''}
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
          <button
            onClick={() => {
              setHabitStatus('habit-devotion', today, 'done', 'manual');
            }}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap transition"
          >
            <Check className="w-3.5 h-3.5" /> Record devotion
          </button>
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
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Weekly Snapshot */}
        <aside className="space-y-6">
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
                    {weekSnapshot.gymCount} / 4
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (weekSnapshot.gymCount / 4) * 100)}%`,
                      backgroundColor: getCategoryMeta('fitness').colour,
                    }}
                  />
                </div>
              </div>

              <div className="py-3">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    Behold hours logged
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {formatHoursDecimal(weekSnapshot.beholdMinutes)} / 5.0h
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (weekSnapshot.beholdMinutes / 300) * 100
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
                    Teaching preparation
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {weekSnapshot.teachingPrepCount} /{' '}
                    {Math.max(1, weekSnapshot.scheduledPrepCount)} blocks
                  </span>
                </div>
              </div>

              <div className="pt-3">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                  Upcoming ministry (next 7 days)
                </p>
                {weekSnapshot.upcomingMinistry.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No upcoming ministry items scheduled.
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
    </div>
  );
};
