import React, { useMemo, useState } from 'react';
import { Calendar, Link2, Search, Trash2, X } from 'lucide-react';
import { CATEGORIES } from '../data/seedData';
import { useLifeHQ } from '../context/LifeHQContext';
import { CategoryId, Habit, HabitFrequency } from '../types/lifehq';
import { StarterHabitTemplate } from '../utils/habitUtils';

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingHabit?: Habit | null;
  initialTemplate?: StarterHabitTemplate | null;
}

type ScheduleMode = 'daily' | 'weekdays' | 'weekly';
type TargetMode = 'none' | 'duration' | 'quantity';

const WEEKDAY_BUTTONS = [
  { iso: 1, label: 'Mon' },
  { iso: 2, label: 'Tue' },
  { iso: 3, label: 'Wed' },
  { iso: 4, label: 'Thu' },
  { iso: 5, label: 'Fri' },
  { iso: 6, label: 'Sat' },
  { iso: 7, label: 'Sun' },
];

function deriveScheduleMode(freq?: HabitFrequency): ScheduleMode {
  if (freq === 'daily') return 'daily';
  if (freq === 'custom') return 'weekdays';
  if (freq === 'weekly') return 'weekly';
  return 'daily';
}

function deriveTargetMode(
  targetMinutes?: number,
  targetQuantity?: number
): TargetMode {
  if (targetMinutes && targetMinutes > 0) return 'duration';
  if (targetQuantity && targetQuantity > 0) return 'quantity';
  return 'none';
}

export const HabitModal: React.FC<HabitModalProps> = ({
  isOpen,
  onClose,
  editingHabit,
  initialTemplate,
}) => {
  const { state, now, getCategoryMeta, upsertHabit, deleteHabit } =
    useLifeHQ();

  const sourceHabit = editingHabit ?? undefined;
  const sourceTemplate = !editingHabit ? initialTemplate ?? undefined : undefined;

  const initialLinkedIds = useMemo(() => {
    const ids = new Set<string>();
    if (sourceHabit) {
      sourceHabit.linkedEventIds?.forEach((id) => ids.add(id));
      state.events.forEach((ev) => {
        if (ev.linkedHabitId === sourceHabit.id) ids.add(ev.id);
      });
    } else if (sourceTemplate) {
      const existingEventIds = new Set(state.events.map((e) => e.id));
      sourceTemplate.linkedEventIds.forEach((id) => {
        if (existingEventIds.has(id)) ids.add(id);
      });
    }
    return Array.from(ids);
  }, [sourceHabit, sourceTemplate, state.events]);

  const [title, setTitle] = useState(
    sourceHabit?.title ?? sourceTemplate?.title ?? ''
  );
  const [category, setCategory] = useState<CategoryId>(
    sourceHabit?.category ?? sourceTemplate?.category ?? 'personal'
  );
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(
    deriveScheduleMode(sourceHabit?.frequency ?? sourceTemplate?.frequency)
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    sourceHabit?.daysOfWeek ??
      sourceTemplate?.daysOfWeek ??
      [1, 2, 3, 4, 5, 6, 7]
  );
  const [weeklyTarget, setWeeklyTarget] = useState<number>(
    sourceHabit?.weeklyTarget ?? sourceTemplate?.weeklyTarget ?? 4
  );

  const [targetMode, setTargetMode] = useState<TargetMode>(
    deriveTargetMode(
      sourceHabit?.targetMinutes ?? sourceTemplate?.targetMinutes,
      sourceHabit?.targetQuantity ?? sourceTemplate?.targetQuantity
    )
  );
  const [targetMinutes, setTargetMinutes] = useState<number>(
    sourceHabit?.targetMinutes ?? sourceTemplate?.targetMinutes ?? 20
  );
  const [targetQuantity, setTargetQuantity] = useState<number>(
    sourceHabit?.targetQuantity ?? sourceTemplate?.targetQuantity ?? 10
  );
  const [targetUnit, setTargetUnit] = useState<string>(
    sourceHabit?.targetUnit ?? sourceTemplate?.targetUnit ?? 'pages'
  );

  const [cue, setCue] = useState(
    sourceHabit?.cue ?? sourceTemplate?.cue ?? ''
  );
  const [twoMinuteRule, setTwoMinuteRule] = useState(
    sourceHabit?.twoMinuteRule ?? sourceTemplate?.twoMinuteRule ?? ''
  );
  const [stackAnchorEventId, setStackAnchorEventId] = useState<string>(
    sourceHabit?.stackAnchorEventId ?? sourceTemplate?.stackAnchorEventId ?? ''
  );
  const [stackAnchorLabel, setStackAnchorLabel] = useState<string>(
    sourceHabit?.stackAnchorLabel ?? sourceTemplate?.stackAnchorLabel ?? ''
  );
  const [stackAction, setStackAction] = useState<string>(
    sourceHabit?.stackAction ?? sourceTemplate?.stackAction ?? ''
  );
  const [preferredWindowStart, setPreferredWindowStart] = useState<string>(
    sourceHabit?.preferredWindowStart ??
      sourceTemplate?.preferredWindowStart ??
      ''
  );
  const [preferredWindowEnd, setPreferredWindowEnd] = useState<string>(
    sourceHabit?.preferredWindowEnd ?? sourceTemplate?.preferredWindowEnd ?? ''
  );
  const [useCustomAnchor, setUseCustomAnchor] = useState<boolean>(
    Boolean(
      !(
        sourceHabit?.stackAnchorEventId ?? sourceTemplate?.stackAnchorEventId
      ) &&
        (sourceHabit?.stackAnchorLabel ?? sourceTemplate?.stackAnchorLabel)
    )
  );
  const [notes, setNotes] = useState(
    sourceHabit?.notes ?? sourceTemplate?.notes ?? ''
  );
  const [linkedEventIds, setLinkedEventIds] =
    useState<string[]>(initialLinkedIds);
  const [eventQuery, setEventQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [validationErr, setValidationErr] = useState<string | null>(null);

  const routineAnchorEvents = useMemo(
    () =>
      state.events
        .filter((ev) => ev.isRoutineMarker)
        .slice()
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [state.events]
  );

  const calendarAnchorEvents = useMemo(
    () =>
      state.events
        .filter((ev) => !ev.isRoutineMarker)
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title)),
    [state.events]
  );

  const sortedEvents = useMemo(() => {
    const q = eventQuery.trim().toLowerCase();
    return state.events
      .filter((ev) => !ev.isRoutineMarker)
      .filter(
        (ev) =>
          !q ||
          ev.title.toLowerCase().includes(q) ||
          ev.subcategory.toLowerCase().includes(q)
      )
      .slice()
      .sort((a, b) => {
        const aLinked = linkedEventIds.includes(a.id) ? 0 : 1;
        const bLinked = linkedEventIds.includes(b.id) ? 0 : 1;
        if (aLinked !== bLinked) return aLinked - bLinked;
        const aCatMatch = a.category === category ? 0 : 1;
        const bCatMatch = b.category === category ? 0 : 1;
        if (aCatMatch !== bCatMatch) return aCatMatch - bCatMatch;
        return a.title.localeCompare(b.title);
      });
  }, [state.events, eventQuery, linkedEventIds, category]);

  if (!isOpen) return null;

  const toggleWeekday = (iso: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(iso)
        ? prev.filter((d) => d !== iso)
        : [...prev, iso].sort((a, b) => a - b)
    );
  };

  const toggleLinkedEvent = (eventId: string) => {
    setLinkedEventIds((prev) =>
      prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setValidationErr('Please enter a habit title.');
      return;
    }

    if (scheduleMode === 'weekdays' && daysOfWeek.length === 0) {
      setValidationErr('Select at least one weekday for this habit.');
      return;
    }

    if (targetMode === 'duration' && (!targetMinutes || targetMinutes < 1)) {
      setValidationErr('Target duration must be at least 1 minute.');
      return;
    }

    if (targetMode === 'quantity' && (!targetQuantity || targetQuantity < 1)) {
      setValidationErr('Target quantity must be at least 1.');
      return;
    }

    if (
      preferredWindowStart &&
      preferredWindowEnd &&
      preferredWindowEnd <= preferredWindowStart
    ) {
      setValidationErr('Preferred window end time must be after start time.');
      return;
    }

    setValidationErr(null);

    const sortedDays = daysOfWeek.slice().sort((a, b) => a - b);
    let frequency: HabitFrequency = 'daily';
    let computedWeeklyTarget = 7;
    let computedDays: number[] | undefined = [1, 2, 3, 4, 5, 6, 7];

    if (scheduleMode === 'daily') {
      frequency = 'daily';
      computedWeeklyTarget = 7;
      computedDays = [1, 2, 3, 4, 5, 6, 7];
    } else if (scheduleMode === 'weekdays') {
      frequency = 'custom';
      computedDays = sortedDays;
      computedWeeklyTarget = Math.max(1, sortedDays.length);
    } else {
      frequency = 'weekly';
      computedWeeklyTarget = Math.max(1, Math.min(14, Math.round(weeklyTarget)));
      computedDays = sortedDays.length > 0 && sortedDays.length < 7 ? sortedDays : undefined;
    }

    const habitPayload: Habit = {
      id:
        sourceHabit?.id ??
        `habit-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      title: title.trim().slice(0, 160),
      category,
      frequency,
      weeklyTarget: computedWeeklyTarget,
      ...(computedDays ? { daysOfWeek: computedDays } : {}),
      ...(targetMode === 'duration'
        ? { targetMinutes: Math.min(1440, Math.round(targetMinutes)) }
        : {}),
      ...(targetMode === 'quantity'
        ? {
            targetQuantity: Math.min(10000, Math.round(targetQuantity)),
            ...(targetUnit.trim()
              ? { targetUnit: targetUnit.trim().slice(0, 40) }
              : {}),
          }
        : {}),
      ...(cue.trim() ? { cue: cue.trim().slice(0, 200) } : {}),
      ...(twoMinuteRule.trim()
        ? { twoMinuteRule: twoMinuteRule.trim().slice(0, 200) }
        : {}),
      ...(!useCustomAnchor && stackAnchorEventId
        ? { stackAnchorEventId }
        : {}),
      ...(stackAnchorLabel.trim()
        ? { stackAnchorLabel: stackAnchorLabel.trim().slice(0, 160) }
        : {}),
      ...(stackAction.trim()
        ? { stackAction: stackAction.trim().slice(0, 200) }
        : {}),
      ...(preferredWindowStart ? { preferredWindowStart } : {}),
      ...(preferredWindowEnd ? { preferredWindowEnd } : {}),
      ...(linkedEventIds.length > 0 ? { linkedEventIds } : {}),
      ...(sourceHabit?.templateKey
        ? { templateKey: sourceHabit.templateKey }
        : sourceTemplate?.templateKey
        ? { templateKey: sourceTemplate.templateKey }
        : {}),
      createdAt: sourceHabit?.createdAt ?? now.date,
      paused: sourceHabit?.paused ?? false,
      ...(sourceHabit?.archived ? { archived: true } : {}),
      ...(notes.trim() ? { notes: notes.trim().slice(0, 500) } : {}),
    };

    upsertHabit(habitPayload, linkedEventIds);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={sourceHabit ? 'Edit Habit' : 'New Habit'}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#141b29] border border-slate-200 dark:border-slate-800 shadow-xl p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">
              {sourceHabit
                ? 'Edit Habit'
                : sourceTemplate
                ? 'Customise Starter Habit'
                : 'New Habit'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Make it obvious, easy to start, and linked to your real calendar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {validationErr && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              {validationErr}
            </p>
          )}

          {/* Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Habit title
              </label>
              <input
                type="text"
                required
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Morning Scripture and devotion"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryId)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Schedule Mode */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Schedule
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900">
              {(
                [
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekdays', label: 'Selected days' },
                  { id: 'weekly', label: 'Weekly target' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setScheduleMode(m.id);
                    if (m.id === 'weekdays' && daysOfWeek.length === 0) {
                      setDaysOfWeek([1, 3, 5]);
                    }
                  }}
                  className={`min-h-[36px] px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                    scheduleMode === m.id
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {scheduleMode === 'weekdays' && (
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                  Only selected weekdays count as scheduled opportunities.
                </p>
                <div className="grid grid-cols-7 gap-1.5">
                  {WEEKDAY_BUTTONS.map((d) => {
                    const active = daysOfWeek.includes(d.iso);
                    return (
                      <button
                        key={d.iso}
                        type="button"
                        onClick={() => toggleWeekday(d.iso)}
                        className={`min-h-[38px] rounded-xl text-xs font-medium border transition ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {scheduleMode === 'weekly' && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-600 dark:text-slate-300">
                    Sessions per week:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={weeklyTarget}
                    onChange={(e) => setWeeklyTarget(Number(e.target.value))}
                    className="w-20 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                    Preferred days (optional — or leave unselected for flexible
                    timing):
                  </p>
                  <div className="grid grid-cols-7 gap-1.5">
                    {WEEKDAY_BUTTONS.map((d) => {
                      const active =
                        daysOfWeek.length < 7 && daysOfWeek.includes(d.iso);
                      return (
                        <button
                          key={d.iso}
                          type="button"
                          onClick={() => {
                            if (daysOfWeek.length === 7) {
                              setDaysOfWeek([d.iso]);
                            } else {
                              toggleWeekday(d.iso);
                            }
                          }}
                          className={`min-h-[36px] rounded-xl text-xs font-medium border transition ${
                            active
                              ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Target Duration / Quantity */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Target measure (optional)
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900">
              {(
                [
                  { id: 'none', label: 'Simple check-in' },
                  { id: 'duration', label: 'Duration (min)' },
                  { id: 'quantity', label: 'Quantity' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTargetMode(t.id)}
                  className={`min-h-[36px] px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                    targetMode === t.id
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {targetMode === 'duration' && (
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-600 dark:text-slate-300">
                  Target duration (minutes):
                </label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={targetMinutes}
                  onChange={(e) => setTargetMinutes(Number(e.target.value))}
                  className="w-24 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono tabular-nums"
                />
              </div>
            )}

            {targetMode === 'quantity' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Target amount
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={targetQuantity}
                    onChange={(e) => setTargetQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Unit (e.g. pages, sets, lessons)
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={targetUnit}
                    onChange={(e) => setTargetUnit(e.target.value)}
                    placeholder="pages"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Habit Stacking (Optional) */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Habit stacking (optional)
                </label>
                <p className="text-[11px] text-slate-400">
                  Attach this habit after a daily routine or scheduled activity. Completing the anchor will never auto-complete the habit.
                </p>
              </div>
              {(stackAnchorEventId ||
                stackAnchorLabel ||
                stackAction ||
                preferredWindowStart ||
                preferredWindowEnd) && (
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomAnchor(false);
                    setStackAnchorEventId('');
                    setStackAnchorLabel('');
                    setStackAction('');
                    setPreferredWindowStart('');
                    setPreferredWindowEnd('');
                  }}
                  className="text-[11px] font-medium text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 shrink-0"
                >
                  Remove stack
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  Anchor routine or activity
                </label>
                <select
                  value={
                    useCustomAnchor
                      ? '__custom__'
                      : stackAnchorEventId || ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setUseCustomAnchor(false);
                      setStackAnchorEventId('');
                      setStackAnchorLabel('');
                    } else if (val === '__custom__') {
                      setUseCustomAnchor(true);
                      setStackAnchorEventId('');
                    } else {
                      setUseCustomAnchor(false);
                      setStackAnchorEventId(val);
                      const ev = state.events.find((x) => x.id === val);
                      if (ev) {
                        setStackAnchorLabel(ev.title);
                      }
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                >
                  <option value="">None (standalone habit)</option>
                  <option value="__custom__">Custom anchor / routine…</option>
                  {routineAnchorEvents.length > 0 && (
                    <optgroup label="Daily routine anchors">
                      {routineAnchorEvents.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.title} ({ev.startTime})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {calendarAnchorEvents.length > 0 && (
                    <optgroup label="Calendar activities">
                      {calendarAnchorEvents.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.title} ({ev.startTime})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {(useCustomAnchor || stackAnchorEventId) && (
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    After&hellip; (anchor phrasing)
                  </label>
                  <input
                    type="text"
                    maxLength={160}
                    value={stackAnchorLabel}
                    onChange={(e) => setStackAnchorLabel(e.target.value)}
                    placeholder="e.g. waking up, finishing lunch, arriving home"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                I will&hellip; (clear stacked action)
              </label>
              <input
                type="text"
                maxLength={200}
                value={stackAction}
                onChange={(e) => setStackAction(e.target.value)}
                placeholder="e.g. read Scripture for 10 minutes"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 items-end">
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  Window start (optional)
                </label>
                <input
                  type="time"
                  value={preferredWindowStart}
                  onChange={(e) => setPreferredWindowStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  Window end (optional)
                </label>
                <input
                  type="time"
                  value={preferredWindowEnd}
                  onChange={(e) => setPreferredWindowEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                />
              </div>
              {(preferredWindowStart || preferredWindowEnd) && (
                <button
                  type="button"
                  onClick={() => {
                    setPreferredWindowStart('');
                    setPreferredWindowEnd('');
                  }}
                  className="min-h-[36px] px-3 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 justify-self-start"
                >
                  Clear window
                </button>
              )}
            </div>

            {(stackAnchorLabel.trim() || stackAction.trim()) && (
              <p className="rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-200">
                <span className="text-slate-400 mr-1.5">Stack preview:</span>
                {stackAnchorLabel.trim() && stackAction.trim()
                  ? `After ${stackAnchorLabel.trim()}, I will ${stackAction.trim()}.`
                  : stackAnchorLabel.trim()
                  ? `Stacked after ${stackAnchorLabel.trim()}.`
                  : stackAction.trim()}
                {preferredWindowStart || preferredWindowEnd
                  ? ` (${
                      preferredWindowStart && preferredWindowEnd
                        ? `${preferredWindowStart}–${preferredWindowEnd}`
                        : preferredWindowStart
                        ? `From ${preferredWindowStart}`
                        : `By ${preferredWindowEnd}`
                    })`
                  : ''}
              </p>
            )}
          </div>

          {/* Atomic Habits Cue & 2-Minute Starter Mode */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Two-minute starter action (enables &ldquo;Start Small&rdquo;)
              </label>
              <input
                type="text"
                maxLength={200}
                value={twoMinuteRule}
                onChange={(e) => setTwoMinuteRule(e.target.value)}
                placeholder="e.g. Open project workspace for 2 minutes, Put on training shoes..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Cue / Implementation intention (optional)
              </label>
              <input
                type="text"
                maxLength={200}
                value={cue}
                onChange={(e) => setCue(e.target.value)}
                placeholder="When and where will you do this?"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Notes (optional)
              </label>
              <textarea
                rows={2}
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Helpful context or boundaries..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>
          </div>

          {/* Link to Calendar Activities */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <Link2 className="w-3.5 h-3.5" />
                Link to existing calendar activities ({linkedEventIds.length})
              </label>
              <span className="text-[11px] text-slate-400">
                No duplicates or double-counted time
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={eventQuery}
                onChange={(e) => setEventQuery(e.target.value)}
                placeholder="Filter calendar activities..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
              />
            </div>

            <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40">
              {sortedEvents.length === 0 ? (
                <p className="p-3 text-xs text-slate-500">
                  No matching calendar activities found.
                </p>
              ) : (
                sortedEvents.map((ev) => {
                  const checked = linkedEventIds.includes(ev.id);
                  const evCat = getCategoryMeta(ev.category);
                  const otherHabit =
                    ev.linkedHabitId && ev.linkedHabitId !== sourceHabit?.id
                      ? state.habits.find((h) => h.id === ev.linkedHabitId)
                      : undefined;
                  return (
                    <label
                      key={ev.id}
                      className="flex items-center justify-between gap-2.5 px-3 py-2 cursor-pointer hover:bg-white dark:hover:bg-slate-800/60 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleLinkedEvent(ev.id)}
                          className="rounded shrink-0"
                        />
                        <span
                          className="w-2 h-2 rounded-sm shrink-0"
                          style={{ backgroundColor: evCat.colour }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">
                            {ev.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
                            {ev.startTime}–{ev.endTime} · {ev.recurrence}
                            {otherHabit
                              ? ` · Linked to ${otherHabit.title}`
                              : ''}
                          </p>
                        </div>
                      </div>
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            {sourceHabit ? (
              confirmDelete ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      deleteHabit(sourceHabit.id);
                      onClose();
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700"
                  >
                    Confirm delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-2 text-xs text-slate-500"
                  >
                    Keep
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete habit
                </button>
              )
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90"
              >
                Save habit
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
