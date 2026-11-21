import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Link2,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Trash2,
  Unlink,
} from 'lucide-react';
import { CATEGORIES } from '../data/seedData';
import { useLifeHQ } from '../context/LifeHQContext';
import {
  CategoryId,
  EventOccurrence,
  Habit,
  HabitLog,
  HabitLogStatus,
} from '../types/lifehq';
import {
  addDays,
  formatDisplayDate,
  formatShortDate,
  getMondayOfWeek,
  getMonthGridDates,
  isSchoolHoliday,
} from '../utils/dateUtils';
import {
  STARTER_HABIT_TEMPLATES,
  StarterHabitTemplate,
  calculateAggregateHabitSummary,
  findMatchingHabitForTemplate,
  formatHabitScheduleLabel,
  formatHabitStackText,
  formatHabitTargetLabel,
  formatPreferredWindow,
  getCreditForStatus,
  getEffectiveHabitLog,
  getLinkedEventsForHabit,
  isHabitScheduledOnDate,
  isHabitStarterEligible,
} from '../utils/habitUtils';
import { expandEventsForRange } from '../utils/recurrence';
import { HabitModal } from './HabitModal';
import { TwoMinuteStarterModal } from './TwoMinuteStarterModal';

type HabitsSubView = 'today' | 'upcoming' | 'calendar' | 'archived';

const QUICK_EXCUSE_CHIPS = [
  'Rest day',
  'Illness / recovery',
  'School holiday',
  'Cancelled commitment',
];

function stepMonth(dateStr: string, delta: number): string {
  const [y, m] = dateStr.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + delta, 1, 12, 0, 0));
  const ty = target.getUTCFullYear();
  const tm = String(target.getUTCMonth() + 1).padStart(2, '0');
  return `${ty}-${tm}-01`;
}

function formatCreditNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const STATUS_LABELS: Record<HabitLogStatus, string> = {
  done: 'Completed',
  partial: 'Partially completed',
  skipped: 'Skipped',
  excused: 'Excused (no penalty)',
  starter: 'Started small (2-min rule)',
};

function getPillarLinkMeta(category: CategoryId): {
  tab: 'faith' | 'fitness' | 'behold';
  label: string;
} | null {
  if (category === 'faith') return { tab: 'faith', label: 'Faith workspace' };
  if (category === 'fitness') return { tab: 'fitness', label: 'Fitness logger' };
  if (category === 'behold') return { tab: 'behold', label: 'Creative tracker' };
  return null;
}

export const HabitsView: React.FC = () => {
  const {
    state,
    now,
    getCategoryMeta,
    openPillar,
    setHabitStatus,
    clearStarterAttempt,
    updateHabitStack,
    toggleHabitPause,
    toggleHabitArchive,
    upsertHabit,
    deleteHabit,
    showToast,
  } = useLifeHQ();

  const [subView, setSubView] = useState<HabitsSubView>('today');
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all');
  const [showAllActiveOnToday, setShowAllActiveOnToday] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [templateToCustomise, setTemplateToCustomise] =
    useState<StarterHabitTemplate | null>(null);
  const [starterHabit, setStarterHabit] = useState<Habit | null>(null);

  // Inline log editor popover/panel state (shared across Today, Cards grid, Upcoming, Calendar)
  const [logEditor, setLogEditor] = useState<{
    habitId: string;
    date: string;
    status: HabitLogStatus;
    notes: string;
    actualValue: string;
  } | null>(null);

  // Inline delete confirm state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // History Calendar sub-view state
  const [calMonthDate, setCalMonthDate] = useState<string>(
    `${now.date.slice(0, 7)}-01`
  );
  const [selectedCalDate, setSelectedCalDate] = useState<string>(now.date);
  const [calHabitFilter, setCalHabitFilter] = useState<string>('all');

  const today = now.date;

  // Aggregate stats (last 30 days + current week)
  const summary = useMemo(
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

  // 28-day Mon-Sun trailing grid dates for mini habit cards
  const trailing28MonSun = useMemo(() => {
    const currentMonday = getMondayOfWeek(today);
    const startMonday = addDays(currentMonday, -21);
    return Array.from({ length: 28 }, (_, i) => addDays(startMonday, i));
  }, [today]);

  // Occurrences map covering 28-day mini grid + upcoming 7 days
  const recentAndUpcomingOccMap = useMemo(() => {
    const start = trailing28MonSun[0];
    const end = addDays(today, 6);
    const occs = expandEventsForRange(
      state.events,
      start,
      end,
      state.settings,
      state.activityRecords
    );
    const map = new Map<string, EventOccurrence[]>();
    for (const o of occs) {
      const list = map.get(o.date) ?? [];
      list.push(o);
      map.set(o.date, list);
    }
    return map;
  }, [
    state.events,
    trailing28MonSun,
    today,
    state.settings,
    state.activityRecords,
  ]);

  // Occurrences map for selected History Calendar month grid
  const calGridDates = useMemo(() => {
    const [y, m] = calMonthDate.split('-').map(Number);
    return getMonthGridDates(y, m - 1);
  }, [calMonthDate]);

  const calOccMap = useMemo(() => {
    const start = calGridDates[0];
    const end = calGridDates[calGridDates.length - 1];
    const occs = expandEventsForRange(
      state.events,
      start,
      end,
      state.settings,
      state.activityRecords
    );
    const map = new Map<string, EventOccurrence[]>();
    for (const o of occs) {
      const list = map.get(o.date) ?? [];
      list.push(o);
      map.set(o.date, list);
    }
    return map;
  }, [state.events, calGridDates, state.settings, state.activityRecords]);

  const activeHabits = useMemo(
    () => state.habits.filter((h) => !h.archived),
    [state.habits]
  );
  const archivedHabits = useMemo(
    () => state.habits.filter((h) => Boolean(h.archived)),
    [state.habits]
  );

  const filteredActiveHabits = useMemo(() => {
    if (categoryFilter === 'all') return activeHabits;
    return activeHabits.filter((h) => h.category === categoryFilter);
  }, [activeHabits, categoryFilter]);

  const todayCheckInHabits = useMemo(() => {
    return activeHabits.filter((h) => {
      if (h.paused) return false;
      if (showAllActiveOnToday) return true;
      const st = summary.statsById.get(h.id);
      return st?.showOnToday ?? true;
    });
  }, [activeHabits, showAllActiveOnToday, summary.statsById]);

  const upcomingDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(today, i)),
    [today]
  );

  const openNewHabitModal = () => {
    setEditingHabit(null);
    setTemplateToCustomise(null);
    setModalOpen(true);
  };

  const openEditHabitModal = (habit: Habit) => {
    setTemplateToCustomise(null);
    setEditingHabit(habit);
    setModalOpen(true);
  };

  const addStarterFromTemplate = (tpl: StarterHabitTemplate) => {
    const existing = findMatchingHabitForTemplate(tpl, state.habits);
    if (existing) {
      if (existing.archived) {
        toggleHabitArchive(existing.id);
      } else {
        showToast(`"${existing.title}" already exists`);
      }
      return;
    }
    const existingEventIds = new Set(state.events.map((e) => e.id));
    const validLinkedIds = tpl.linkedEventIds.filter((id) =>
      existingEventIds.has(id)
    );
    const created: Habit = {
      id: `habit-${tpl.templateKey}-${Date.now().toString(36)}`,
      title: tpl.title,
      category: tpl.category,
      frequency: tpl.frequency,
      weeklyTarget: tpl.weeklyTarget,
      daysOfWeek: tpl.daysOfWeek,
      ...(tpl.targetMinutes ? { targetMinutes: tpl.targetMinutes } : {}),
      ...(tpl.targetQuantity ? { targetQuantity: tpl.targetQuantity } : {}),
      ...(tpl.targetUnit ? { targetUnit: tpl.targetUnit } : {}),
      cue: tpl.cue,
      twoMinuteRule: tpl.twoMinuteRule,
      ...(tpl.stackAnchorEventId && existingEventIds.has(tpl.stackAnchorEventId)
        ? { stackAnchorEventId: tpl.stackAnchorEventId }
        : {}),
      ...(tpl.stackAnchorLabel ? { stackAnchorLabel: tpl.stackAnchorLabel } : {}),
      ...(tpl.stackAction ? { stackAction: tpl.stackAction } : {}),
      ...(tpl.preferredWindowStart
        ? { preferredWindowStart: tpl.preferredWindowStart }
        : {}),
      ...(tpl.preferredWindowEnd
        ? { preferredWindowEnd: tpl.preferredWindowEnd }
        : {}),
      ...(validLinkedIds.length > 0 ? { linkedEventIds: validLinkedIds } : {}),
      templateKey: tpl.templateKey,
      createdAt: today,
      paused: false,
      notes: tpl.notes,
    };
    upsertHabit(created, validLinkedIds);
  };

  const missingStarterCount = useMemo(
    () =>
      STARTER_HABIT_TEMPLATES.filter(
        (tpl) => !findMatchingHabitForTemplate(tpl, state.habits)
      ).length,
    [state.habits]
  );

  const handleAddAllMissingStarters = () => {
    let added = 0;
    for (const tpl of STARTER_HABIT_TEMPLATES) {
      const existing = findMatchingHabitForTemplate(tpl, state.habits);
      if (!existing) {
        addStarterFromTemplate(tpl);
        added++;
      }
    }
    if (added === 0) {
      showToast('All starter habits are already present');
    }
  };

  const openLogEditor = (
    habit: Habit,
    date: string,
    currentLog: HabitLog | null,
    presetStatus?: HabitLogStatus
  ) => {
    setLogEditor({
      habitId: habit.id,
      date,
      status: presetStatus ?? currentLog?.status ?? 'done',
      notes: currentLog?.notes ?? '',
      actualValue:
        currentLog?.actualValue !== undefined
          ? String(currentLog.actualValue)
          : habit.targetMinutes
          ? String(habit.targetMinutes)
          : habit.targetQuantity
          ? String(habit.targetQuantity)
          : '',
    });
  };

  const handleSaveLogEditor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logEditor) return;
    const numericVal = logEditor.actualValue.trim()
      ? Number(logEditor.actualValue)
      : undefined;
    setHabitStatus(
      logEditor.habitId,
      logEditor.date,
      logEditor.status,
      'manual',
      logEditor.notes,
      numericVal !== undefined && !Number.isNaN(numericVal)
        ? numericVal
        : undefined
    );
    setLogEditor(null);
  };

  const renderLogEditorInline = (habit: Habit) => {
    if (!logEditor || logEditor.habitId !== habit.id) return null;
    return (
      <form
        onSubmit={handleSaveLogEditor}
        className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            Log for {formatShortDate(logEditor.date)}
          </span>
          <button
            type="button"
            onClick={() => {
              setHabitStatus(habit.id, logEditor.date, 'clear');
              setLogEditor(null);
            }}
            className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
          >
            Clear entry
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {(
            [
              { id: 'done', label: 'Completed' },
              { id: 'partial', label: 'Partial' },
              { id: 'skipped', label: 'Skipped' },
              { id: 'excused', label: 'Excused' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() =>
                setLogEditor((prev) => (prev ? { ...prev, status: opt.id } : prev))
              }
              className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                logEditor.status === opt.id
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {logEditor.status === 'excused' && (
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_EXCUSE_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() =>
                  setLogEditor((prev) => (prev ? { ...prev, notes: chip } : prev))
                }
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {(habit.targetMinutes || habit.targetQuantity) &&
            (logEditor.status === 'done' || logEditor.status === 'partial') && (
              <div className="sm:w-36">
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={logEditor.actualValue}
                  onChange={(e) =>
                    setLogEditor((prev) =>
                      prev ? { ...prev, actualValue: e.target.value } : prev
                    )
                  }
                  placeholder={
                    habit.targetMinutes
                      ? 'Minutes'
                      : habit.targetUnit || 'Amount'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                />
              </div>
            )}
          <input
            type="text"
            maxLength={500}
            value={logEditor.notes}
            onChange={(e) =>
              setLogEditor((prev) =>
                prev ? { ...prev, notes: e.target.value } : prev
              )
            }
            placeholder={
              logEditor.status === 'excused'
                ? 'Reason (rest day, illness, cancelled event)...'
                : 'Optional note...'
            }
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
          />
          <div className="flex gap-1.5">
            <button
              type="submit"
              className="min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setLogEditor(null)}
              className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Habits</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Fair consistency based on scheduled opportunities — excused rest,
            illness, holidays, and cancelled sessions never penalise you.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTemplates((v) => !v)}
            className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium border transition ${
              showTemplates
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                : 'bg-white dark:bg-[#141b29] border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Starter templates
            {missingStarterCount > 0 && ` (${missingStarterCount})`}
          </button>
          <button
            type="button"
            onClick={openNewHabitModal}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" /> New habit
          </button>
        </div>
      </div>

      {/* Consistency Summary Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Today&apos;s progress
          </p>
          <p className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {summary.todayScheduledCount > 0
              ? `${formatCreditNumber(summary.todayCredits)} / ${summary.todayScheduledCount}`
              : 'Rest day'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
            {summary.todayPct !== null
              ? `${summary.todayPct}% completed today`
              : 'No unexcused items due'}
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            7-day consistency
          </p>
          <p className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {summary.weeklyPct !== null ? `${summary.weeklyPct}%` : '—'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Scheduled non-excused days
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            30-day consistency
          </p>
          <p className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {summary.consistency30dPct !== null
              ? `${summary.consistency30dPct}%`
              : '—'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Rolling 30-day score
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Habit library
          </p>
          <p className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {summary.activeCount}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
            Active · {summary.archivedCount} archived
          </p>
        </div>
      </section>

      {/* Starter Templates Drawer */}
      {showTemplates && (
        <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Starter Habit Templates</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pre-configured with cues, two-minute starters, and calendar links.
                Duplicates are automatically prevented.
              </p>
            </div>
            {missingStarterCount > 0 && (
              <button
                type="button"
                onClick={handleAddAllMissingStarters}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 self-start sm:self-auto"
              >
                Add missing ({missingStarterCount})
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {STARTER_HABIT_TEMPLATES.map((tpl) => {
              const cat = getCategoryMeta(tpl.category);
              const existing = findMatchingHabitForTemplate(tpl, state.habits);
              const isArchived = Boolean(existing?.archived);
              return (
                <div
                  key={tpl.templateKey}
                  className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 flex flex-col justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: cat.colour }}
                      />
                      <span>{cat.label}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">
                        {tpl.frequency === 'daily'
                          ? 'Daily'
                          : tpl.frequency === 'custom'
                          ? 'Sundays'
                          : `${tpl.weeklyTarget}×/wk`}
                      </span>
                      {tpl.targetMinutes && (
                        <>
                          <span>·</span>
                          <span className="font-mono tabular-nums">
                            {tpl.targetMinutes}m
                          </span>
                        </>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold">{tpl.title}</h3>
                    {tpl.stackAnchorLabel && tpl.stackAction && (
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        After {tpl.stackAnchorLabel}, I will {tpl.stackAction}
                        {tpl.preferredWindowStart && tpl.preferredWindowEnd
                          ? ` (${tpl.preferredWindowStart}–${tpl.preferredWindowEnd})`
                          : ''}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cue: {tpl.cue}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      2-min starter: {tpl.twoMinuteRule}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                    {existing ? (
                      <>
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          {isArchived ? 'In archive' : 'Active'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isArchived ? (
                            <button
                              type="button"
                              onClick={() => toggleHabitArchive(existing.id)}
                              className="min-h-[34px] px-3 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openEditHabitModal(existing)}
                              className="min-h-[34px] px-3 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingHabit(null);
                            setTemplateToCustomise(tpl);
                            setModalOpen(true);
                          }}
                          className="min-h-[34px] px-3 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
                        >
                          Customise
                        </button>
                        <button
                          type="button"
                          onClick={() => addStarterFromTemplate(tpl)}
                          className="min-h-[34px] px-3 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        >
                          Add starter
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Sub-view Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Habits views"
          className="inline-flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 overflow-x-auto max-w-full"
        >
          {(
            [
              { id: 'today', label: 'Today & Active' },
              { id: 'upcoming', label: 'Upcoming (7d)' },
              { id: 'calendar', label: 'History Calendar' },
              {
                id: 'archived',
                label: `Archived (${archivedHabits.length})`,
              },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={subView === t.id}
              onClick={() => setSubView(t.id)}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                subView === t.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {subView === 'today' && (
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                categoryFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-white dark:bg-[#141b29] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              All
            </button>
            {CATEGORIES.map((c) => {
              const meta = getCategoryMeta(c.id);
              const active = categoryFilter === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryFilter(c.id)}
                  className={`inline-flex items-center gap-1.5 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    active
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-white dark:bg-[#141b29] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ backgroundColor: meta.colour }}
                  />
                  {meta.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* SUBVIEW 1: TODAY & ACTIVE HABITS */}
      {subView === 'today' && (
        <div className="space-y-6">
          {/* Today's Single-Tap Check-In List */}
          <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-semibold">
                  Today&apos;s Habit Check-In
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDisplayDate(today)} · Tap once to complete, or mark
                  partial, skipped, or excused.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAllActiveOnToday((v) => !v)}
                className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline"
              >
                {showAllActiveOnToday
                  ? 'Show due today only'
                  : 'Show all active habits'}
              </button>
            </div>

            {todayCheckInHabits.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <p className="text-sm font-medium">
                  No habits due today
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enjoy your rest day, or switch to &ldquo;Show all active
                  habits&rdquo; to log ahead.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {todayCheckInHabits.map((habit) => {
                  const cat = getCategoryMeta(habit.category);
                  const st = summary.statsById.get(habit.id);
                  const log = st?.todayLog ?? null;
                  const starterAttempt = st?.todayStarterAttempt ?? null;
                  const targetLabel = formatHabitTargetLabel(habit);
                  const stackText = formatHabitStackText(habit, state.events);
                  const preferredWindow = formatPreferredWindow(habit);
                  const starterEligible = isHabitStarterEligible(habit, log);
                  const linkedOccs = st?.todaySchedule.linkedOccurrences ?? [];

                  return (
                    <div key={habit.id} className="py-3.5 first:pt-1 last:pb-1">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: cat.colour }}
                            />
                            <span>{cat.label}</span>
                            <span>·</span>
                            <span>{formatHabitScheduleLabel(habit)}</span>
                            {targetLabel && (
                              <>
                                <span>·</span>
                                <span className="font-mono tabular-nums">
                                  {targetLabel}
                                </span>
                              </>
                            )}
                            {preferredWindow && (
                              <>
                                <span>·</span>
                                <span className="font-mono tabular-nums">
                                  {preferredWindow}
                                </span>
                              </>
                            )}
                            {log?.source === 'calendar' && (
                              <>
                                <span>·</span>
                                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                  Synced from calendar
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
                            <h3 className="text-sm font-semibold">
                              {habit.title}
                            </h3>
                            {log && (
                              <span
                                className={`text-xs font-medium ${
                                  log.status === 'done'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : log.status === 'partial'
                                    ? 'text-amber-700 dark:text-amber-300'
                                    : log.status === 'excused'
                                    ? 'text-slate-600 dark:text-slate-300'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {STATUS_LABELS[log.status]}
                                {log.notes ? ` — ${log.notes}` : ''}
                              </span>
                            )}
                            {starterAttempt && log?.status !== 'done' && (
                              <span className="text-xs font-medium text-amber-700 dark:text-amber-300 inline-flex items-center gap-1.5">
                                Started small today
                                <button
                                  type="button"
                                  onClick={() => clearStarterAttempt(habit.id, today)}
                                  className="text-[11px] font-normal text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                                >
                                  Clear
                                </button>
                              </span>
                            )}
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

                          {(habit.twoMinuteRule ||
                            linkedOccs.length > 0 ||
                            getPillarLinkMeta(habit.category)) && (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {(habit.twoMinuteRule || linkedOccs.length > 0) && (
                                <span>
                                  {linkedOccs.length > 0
                                    ? `Calendar today: ${linkedOccs
                                        .map((o) => `${o.title} (${o.startTime})`)
                                        .join(', ')}`
                                    : `2-min starter: ${habit.twoMinuteRule}`}
                                </span>
                              )}
                              {(() => {
                                const pMeta = getPillarLinkMeta(habit.category);
                                if (!pMeta) return null;
                                return (
                                  <button
                                    type="button"
                                    onClick={() => openPillar(pMeta.tab)}
                                    className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200 hover:underline"
                                  >
                                    Open {pMeta.label}{' '}
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                );
                              })()}
                            </div>
                          )}
                        </div>

                        {/* Single-Tap Status Actions */}
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {starterEligible && (
                            <button
                              type="button"
                              onClick={() => setStarterHabit(habit)}
                              className="min-h-[38px] px-3 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center gap-1 transition"
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
                            className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1 transition ${
                              log?.status === 'done'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            {log?.status === 'done' ? 'Completed' : 'Complete'}
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
                            className={`min-h-[38px] px-2.5 rounded-xl text-xs font-medium transition ${
                              log?.status === 'partial'
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
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
                            className={`min-h-[38px] px-2.5 rounded-xl text-xs font-medium inline-flex items-center gap-1 transition ${
                              log?.status === 'skipped'
                                ? 'bg-slate-700 text-white dark:bg-slate-600'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <SkipForward className="w-3.5 h-3.5" /> Skip
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openLogEditor(habit, today, log, 'excused')
                            }
                            className={`min-h-[38px] px-2.5 rounded-xl text-xs font-medium inline-flex items-center gap-1 transition ${
                              log?.status === 'excused'
                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            title="Excuse with optional note (no penalty)"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" /> Excuse
                          </button>

                          <button
                            type="button"
                            onClick={() => openLogEditor(habit, today, log)}
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Add note or value"
                            aria-label="Add note or edit log"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {renderLogEditorInline(habit)}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Active Habits Consistency Cards */}
          {filteredActiveHabits.length === 0 ? (
            <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-8 text-center space-y-3">
              <p className="text-sm font-medium">
                {activeHabits.length === 0
                  ? 'No active habits yet'
                  : 'No habits in this category'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create a custom habit or add one from Starter Templates above.
              </p>
            </section>
          ) : (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredActiveHabits.map((habit) => {
                const cat = getCategoryMeta(habit.category);
                const st = summary.statsById.get(habit.id);
                const linkedEvents = getLinkedEventsForHabit(
                  habit,
                  state.events
                );
                const targetLabel = formatHabitTargetLabel(habit);

                return (
                  <article
                    key={habit.id}
                    className={`rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 flex flex-col justify-between gap-4 ${
                      habit.paused ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: cat.colour }}
                            />
                            <span>{cat.label}</span>
                            <span>·</span>
                            <span>{formatHabitScheduleLabel(habit)}</span>
                            {targetLabel && (
                              <>
                                <span>·</span>
                                <span className="font-mono tabular-nums">
                                  {targetLabel}
                                </span>
                              </>
                            )}
                            {habit.paused && (
                              <>
                                <span>·</span>
                                <span className="text-amber-700 dark:text-amber-400 font-medium">
                                  Paused
                                </span>
                              </>
                            )}
                          </div>
                          <h3 className="text-base font-semibold mt-1">
                            {habit.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditHabitModal(habit)}
                            className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Edit habit"
                            aria-label="Edit habit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleHabitPause(habit.id)}
                            className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title={habit.paused ? 'Resume habit' : 'Pause habit'}
                            aria-label={
                              habit.paused ? 'Resume habit' : 'Pause habit'
                            }
                          >
                            {habit.paused ? (
                              <Play className="w-3.5 h-3.5" />
                            ) : (
                              <Pause className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleHabitArchive(habit.id)}
                            className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Archive habit"
                            aria-label="Archive habit"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {(() => {
                        const stackText = formatHabitStackText(
                          habit,
                          state.events
                        );
                        const preferredWindow = formatPreferredWindow(habit);
                        const starterEligible = isHabitStarterEligible(
                          habit,
                          st?.todayLog ?? null
                        );
                        return (
                          <>
                            {(stackText ||
                              preferredWindow ||
                              habit.cue ||
                              habit.twoMinuteRule ||
                              habit.notes) && (
                              <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                {(stackText || preferredWindow) && (
                                  <p className="text-slate-700 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                                    <Link2 className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>
                                      {stackText ?? 'Preferred window'}
                                      {preferredWindow
                                        ? ` (${preferredWindow})`
                                        : ''}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateHabitStack(habit.id, null)
                                      }
                                      className="text-[11px] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-0.5 ml-1"
                                      title="Remove stack link"
                                    >
                                      <Unlink className="w-3 h-3" /> Unlink
                                    </button>
                                  </p>
                                )}
                                {habit.cue && <p>Cue: {habit.cue}</p>}
                                {habit.twoMinuteRule && (
                                  <div className="flex items-center justify-between gap-2 pt-0.5">
                                    <p>2-min starter: {habit.twoMinuteRule}</p>
                                    {starterEligible && (
                                      <button
                                        type="button"
                                        onClick={() => setStarterHabit(habit)}
                                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
                                      >
                                        <Sparkles className="w-3 h-3" /> Start
                                        Small
                                      </button>
                                    )}
                                  </div>
                                )}
                                {!habit.cue &&
                                  !habit.twoMinuteRule &&
                                  habit.notes && <p>{habit.notes}</p>}
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {linkedEvents.length > 0 && (
                        <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <Link2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            Linked to{' '}
                            {linkedEvents.length === 1
                              ? linkedEvents[0].title
                              : `${linkedEvents.length} calendar activities`}
                          </span>
                        </p>
                      )}
                    </div>

                    {/* 28-Day Mon-Sun Mini Calendar Strip */}
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-7 gap-1 text-[10px] text-slate-400 text-center font-medium">
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, idx) => (
                          <span key={idx}>{d}</span>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {trailing28MonSun.map((d) => {
                          const isFuture = d > today;
                          const sched = isHabitScheduledOnDate(
                            habit,
                            d,
                            state.events,
                            state.settings,
                            recentAndUpcomingOccMap
                          );
                          const log = getEffectiveHabitLog(
                            habit,
                            d,
                            state.habitLogs,
                            sched.linkedOccurrences
                          );
                          const isTodayCell = d === today;
                          const isExcused = log?.status === 'excused';
                          const isDone = log?.status === 'done';
                          const isPartial = log?.status === 'partial';
                          const isSkipped = log?.status === 'skipped';

                          return (
                            <button
                              key={d}
                              type="button"
                              disabled={habit.paused || isFuture}
                              onClick={() => openLogEditor(habit, d, log)}
                              title={`${formatShortDate(d)} · ${
                                log
                                  ? STATUS_LABELS[log.status]
                                  : isFuture
                                  ? sched.scheduled
                                    ? 'Upcoming scheduled'
                                    : 'Upcoming'
                                  : sched.scheduled
                                  ? 'Scheduled (unlogged)'
                                  : sched.reason
                              }${log?.notes ? ` — ${log.notes}` : ''}`}
                              className={`h-7 rounded-md text-[10px] font-mono tabular-nums flex items-center justify-center transition ${
                                isFuture
                                  ? 'bg-slate-50 dark:bg-slate-900/30 text-slate-300 dark:text-slate-700 cursor-default'
                                  : isDone
                                  ? 'text-white font-semibold'
                                  : isPartial
                                  ? 'text-slate-900 dark:text-white font-semibold border'
                                  : isExcused
                                  ? 'bg-slate-100 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600'
                                  : isSkipped
                                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                  : sched.scheduled
                                  ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                  : 'bg-slate-50/70 dark:bg-slate-900/40 text-slate-400 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                              } ${
                                isTodayCell
                                  ? 'ring-1.5 ring-slate-900 dark:ring-slate-100'
                                  : ''
                              }`}
                              style={
                                isDone
                                  ? { backgroundColor: cat.colour }
                                  : isPartial
                                  ? {
                                      backgroundColor: `${cat.colour}30`,
                                      borderColor: cat.colour,
                                    }
                                  : undefined
                              }
                            >
                              {isDone
                                ? '✓'
                                : isPartial
                                ? '◐'
                                : isExcused
                                ? 'E'
                                : isSkipped
                                ? '–'
                                : d.slice(-2)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Consistency Metrics + Secondary Streak + Inline Delete */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-700 dark:text-slate-200">
                          <span>
                            7d:{' '}
                            <strong>
                              {st?.consistency7d !== null &&
                              st?.consistency7d !== undefined
                                ? `${st.consistency7d}%`
                                : '—'}
                            </strong>
                          </span>
                          <span>
                            30d:{' '}
                            <strong>
                              {st?.consistency30d !== null &&
                              st?.consistency30d !== undefined
                                ? `${st.consistency30d}%`
                                : '—'}
                            </strong>
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            Wk {formatCreditNumber(st?.weekCredits ?? 0)}/
                            {st?.weekEffectiveTarget ?? habit.weeklyTarget}
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {(st?.starterAttempts7d ?? 0) > 0
                            ? `${st?.starterAttempts7d} small start${
                                (st?.starterAttempts7d ?? 0) > 1 ? 's' : ''
                              } (7d) · `
                            : ''}
                          Streak {st?.currentStreak ?? 0} · Best{' '}
                          {st?.longestStreak ?? 0}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            Tap any day cell to log, excuse, or add a note
                          </span>
                          {(() => {
                            const pMeta = getPillarLinkMeta(habit.category);
                            if (!pMeta) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => openPillar(pMeta.tab)}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:underline"
                              >
                                Open {pMeta.label} <ArrowRight className="w-3 h-3" />
                              </button>
                            );
                          })()}
                        </div>
                        {confirmDeleteId === habit.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                deleteHabit(habit.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-rose-600 text-white"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-[11px] text-slate-500"
                            >
                              Keep
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(habit.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                            title="Delete habit"
                            aria-label="Delete habit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {renderLogEditorInline(habit)}
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </div>
      )}

      {/* SUBVIEW 2: UPCOMING HABITS (NEXT 7 DAYS) */}
      {subView === 'upcoming' && (
        <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 divide-y divide-slate-100 dark:divide-slate-800/80">
          {upcomingDays.map((d, idx) => {
            const holiday = isSchoolHoliday(d, state.settings.schoolHolidays);
            const dayHabits = activeHabits
              .filter((h) => !h.paused)
              .map((h) => {
                const sched = isHabitScheduledOnDate(
                  h,
                  d,
                  state.events,
                  state.settings,
                  recentAndUpcomingOccMap
                );
                const log = getEffectiveHabitLog(
                  h,
                  d,
                  state.habitLogs,
                  sched.linkedOccurrences
                );
                return { habit: h, sched, log };
              })
              .filter(
                (item) =>
                  item.sched.scheduled ||
                  item.sched.linkedOccurrences.length > 0 ||
                  Boolean(item.log)
              );

            const flexibleWeekly = activeHabits
              .filter((h) => !h.paused && h.frequency === 'weekly')
              .filter((h) => {
                const sched = isHabitScheduledOnDate(
                  h,
                  d,
                  state.events,
                  state.settings,
                  recentAndUpcomingOccMap
                );
                return !sched.scheduled && sched.flexibleWeeklyDue;
              });

            return (
              <div key={d} className="p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">
                      {idx === 0
                        ? 'Today'
                        : idx === 1
                        ? 'Tomorrow'
                        : formatDisplayDate(d, {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'short',
                          })}
                    </h3>
                    <span className="text-xs font-mono tabular-nums text-slate-400">
                      {formatShortDate(d)}
                    </span>
                    {holiday && (
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        · {holiday.label}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {dayHabits.length} scheduled
                  </span>
                </div>

                {dayHabits.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No fixed habits scheduled on this day.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dayHabits.map(({ habit, sched, log }) => {
                      const cat = getCategoryMeta(habit.category);
                      return (
                        <div
                          key={`${d}-${habit.id}`}
                          className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-900/40"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span
                                  className="w-2 h-2 rounded-sm shrink-0"
                                  style={{ backgroundColor: cat.colour }}
                                />
                                <span>{cat.label}</span>
                                <span>·</span>
                                <span>{sched.reason}</span>
                                {log && (
                                  <>
                                    <span>·</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">
                                      {STATUS_LABELS[log.status]}
                                    </span>
                                  </>
                                )}
                              </div>
                              <p className="text-sm font-semibold mt-0.5">
                                {habit.title}
                              </p>
                              {sched.linkedOccurrences.length > 0 && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                                  Linked:{' '}
                                  {sched.linkedOccurrences
                                    .map((o) => `${o.title} (${o.startTime})`)
                                    .join(', ')}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  openLogEditor(habit, d, log, 'excused')
                                }
                                className="min-h-[34px] px-2.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 inline-flex items-center gap-1"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                {log?.status === 'excused'
                                  ? 'Excused'
                                  : 'Pre-excuse'}
                              </button>
                              {d <= today && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setHabitStatus(
                                      habit.id,
                                      d,
                                      log?.status === 'done' ? 'clear' : 'done'
                                    )
                                  }
                                  className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold ${
                                    log?.status === 'done'
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                  }`}
                                >
                                  {log?.status === 'done' ? 'Done' : 'Complete'}
                                </button>
                              )}
                            </div>
                          </div>
                          {logEditor?.habitId === habit.id &&
                            logEditor.date === d &&
                            renderLogEditorInline(habit)}
                        </div>
                      );
                    })}
                  </div>
                )}

                {flexibleWeekly.length > 0 && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Flexible weekly targets available:{' '}
                    {flexibleWeekly.map((h) => h.title).join(' · ')}
                  </p>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* SUBVIEW 3: CALENDAR-STYLE HABIT HISTORY */}
      {subView === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <section className="lg:col-span-2 rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 overflow-hidden">
            <div className="p-4 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCalMonthDate((d) => stepMonth(d, -1))}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCalMonthDate(`${today.slice(0, 7)}-01`);
                    setSelectedCalDate(today);
                  }}
                  className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setCalMonthDate((d) => stepMonth(d, 1))}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <h2 className="text-sm sm:text-base font-semibold ml-1.5">
                  {formatDisplayDate(calMonthDate, {
                    month: 'long',
                    year: 'numeric',
                  })}
                </h2>
              </div>

              <select
                value={calHabitFilter}
                onChange={(e) => setCalHabitFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                aria-label="Filter habit history"
              >
                <option value="all">All active habits</option>
                {state.habits.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.title}
                    {h.archived ? ' (Archived)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-200/80 dark:border-slate-800/80 text-xs font-medium text-slate-500 dark:text-slate-400 text-center py-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/80">
              {calGridDates.map((d) => {
                const inMonth = d.startsWith(calMonthDate.slice(0, 7));
                const isSelected = d === selectedCalDate;
                const isTodayCell = d === today;
                const holiday = isSchoolHoliday(d, state.settings.schoolHolidays);

                const targetHabits =
                  calHabitFilter === 'all'
                    ? activeHabits.filter((h) => !h.paused)
                    : state.habits.filter((h) => h.id === calHabitFilter);

                let doneCredits = 0;
                let scheduledCount = 0;
                let excusedCount = 0;
                let singleStatus: HabitLogStatus | null = null;
                let singleColour: string | undefined;

                for (const h of targetHabits) {
                  const sched = isHabitScheduledOnDate(
                    h,
                    d,
                    state.events,
                    state.settings,
                    calOccMap
                  );
                  const log = getEffectiveHabitLog(
                    h,
                    d,
                    state.habitLogs,
                    sched.linkedOccurrences
                  );
                  if (targetHabits.length === 1) {
                    singleStatus = log?.status ?? null;
                    singleColour = getCategoryMeta(h.category).colour;
                  }
                  if (log?.status === 'excused') {
                    excusedCount++;
                  } else {
                    doneCredits += getCreditForStatus(log?.status);
                    if (
                      sched.scheduled ||
                      log?.status === 'done' ||
                      log?.status === 'partial' ||
                      log?.status === 'skipped'
                    ) {
                      scheduledCount++;
                    }
                  }
                }

                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedCalDate(d)}
                    className={`min-h-[68px] sm:min-h-[82px] p-1.5 sm:p-2 text-left flex flex-col justify-between transition ${
                      !inMonth
                        ? 'opacity-40 bg-slate-50/50 dark:bg-slate-950/30'
                        : ''
                    } ${
                      isSelected
                        ? 'bg-slate-100/80 dark:bg-slate-800/60 ring-1 ring-inset ring-slate-900/25 dark:ring-slate-100/25'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono tabular-nums ${
                          isTodayCell
                            ? 'bg-rose-500 text-white font-semibold'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {Number(d.split('-')[2])}
                      </span>
                      {holiday && (
                        <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400">
                          Hol
                        </span>
                      )}
                    </div>

                    <div className="mt-1">
                      {targetHabits.length === 1 ? (
                        singleStatus ? (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              singleStatus === 'done'
                                ? 'text-white'
                                : singleStatus === 'partial'
                                ? 'text-slate-900 dark:text-white'
                                : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                            style={
                              singleStatus === 'done'
                                ? { backgroundColor: singleColour }
                                : singleStatus === 'partial'
                                ? { backgroundColor: `${singleColour}35` }
                                : undefined
                            }
                          >
                            {singleStatus === 'done'
                              ? 'Done'
                              : singleStatus === 'partial'
                              ? 'Partial'
                              : singleStatus === 'excused'
                              ? 'Excused'
                              : 'Skipped'}
                          </span>
                        ) : null
                      ) : scheduledCount > 0 ? (
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
                            {formatCreditNumber(doneCredits)}/{scheduledCount}
                          </span>
                          <div className="h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (doneCredits / scheduledCount) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : excusedCount > 0 ? (
                        <span className="text-[10px] text-slate-400">
                          Excused
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Selected Date Detail Panel */}
          <aside className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4 self-start">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {formatShortDate(selectedCalDate)}
              </p>
              <h3 className="text-base font-semibold mt-0.5">
                Day Habit Log
              </h3>
            </div>

            {state.habits.length === 0 ? (
              <p className="text-xs text-slate-500">No habits configured.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {(calHabitFilter === 'all'
                  ? activeHabits
                  : state.habits.filter((h) => h.id === calHabitFilter)
                ).map((h) => {
                  const cat = getCategoryMeta(h.category);
                  const sched = isHabitScheduledOnDate(
                    h,
                    selectedCalDate,
                    state.events,
                    state.settings,
                    calOccMap
                  );
                  const log = getEffectiveHabitLog(
                    h,
                    selectedCalDate,
                    state.habitLogs,
                    sched.linkedOccurrences
                  );
                  return (
                    <div
                      key={h.id}
                      className="py-3 first:pt-0 last:pb-0 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span
                              className="w-2 h-2 rounded-sm shrink-0"
                              style={{ backgroundColor: cat.colour }}
                            />
                            <span>{cat.label}</span>
                            <span>·</span>
                            <span>
                              {sched.scheduled ? 'Scheduled' : sched.reason}
                            </span>
                          </div>
                          <p className="text-sm font-medium truncate">
                            {h.title}
                          </p>
                          {log && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                              {STATUS_LABELS[log.status]}
                              {log.notes ? ` — ${log.notes}` : ''}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => openLogEditor(h, selectedCalDate, log)}
                          className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 shrink-0"
                        >
                          {log ? 'Edit' : 'Log'}
                        </button>
                      </div>

                      {logEditor?.habitId === h.id &&
                        logEditor.date === selectedCalDate &&
                        renderLogEditorInline(h)}
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      )}

      {/* SUBVIEW 4: ARCHIVED HABITS */}
      {subView === 'archived' && (
        <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5">
          {archivedHabits.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <CalendarIcon className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-sm font-medium">No archived habits</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Archiving a habit keeps its completion history safely stored
                without counting against current consistency.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {archivedHabits.map((h) => {
                const cat = getCategoryMeta(h.category);
                const logsCount = state.habitLogs.filter(
                  (l) => l.habitId === h.id
                ).length;
                return (
                  <div
                    key={h.id}
                    className="py-4 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: cat.colour }}
                        />
                        <span>{cat.label}</span>
                        <span>·</span>
                        <span>{formatHabitScheduleLabel(h)}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">
                          {logsCount} historical logs
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold mt-0.5">{h.title}</h3>
                      {h.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {h.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleHabitArchive(h.id)}
                        className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      >
                        <ArchiveRestore className="w-3.5 h-3.5" /> Restore
                      </button>

                      {confirmDeleteId === h.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              deleteHabit(h.id);
                              setConfirmDeleteId(null);
                            }}
                            className="min-h-[36px] px-3 rounded-xl text-xs font-semibold bg-rose-600 text-white"
                          >
                            Confirm delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-xs text-slate-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(h.id)}
                          className="min-h-[36px] px-3 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {modalOpen && (
        <HabitModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingHabit(null);
            setTemplateToCustomise(null);
          }}
          editingHabit={editingHabit}
          initialTemplate={templateToCustomise}
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
    </div>
  );
};
