import React, { useMemo, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { CATEGORIES } from '../data/seedData';
import {
  CalendarEvent,
  CategoryId,
  CommitmentStatus,
  EventOccurrence,
  RecurrenceType,
} from '../types/lifehq';
import { useLifeHQ } from '../context/LifeHQContext';
import { getAvailableWindowFrom } from '../utils/calendarLayout';
import {
  formatDuration,
  getIsoWeekday,
  minutesToTime,
  timeToMinutes,
} from '../utils/dateUtils';
import { expandEventsForRange } from '../utils/recurrence';
import { findOverlappingOccurrences } from '../utils/pillarUtils';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  editingOccurrence?: EventOccurrence | null;
}

const WEEKDAY_LABELS = [
  { iso: 1, label: 'Mon' },
  { iso: 2, label: 'Tue' },
  { iso: 3, label: 'Wed' },
  { iso: 4, label: 'Thu' },
  { iso: 5, label: 'Fri' },
  { iso: 6, label: 'Sat' },
  { iso: 7, label: 'Sun' },
];

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  defaultDate,
  defaultStartTime = '17:00',
  defaultEndTime,
  editingOccurrence,
}) => {
  const { state, upsertEvent, deleteEvent, editOccurrenceException } =
    useLifeHQ();

  const masterEvent = editingOccurrence
    ? state.events.find((e) => e.id === editingOccurrence.eventId)
    : undefined;

  const isRecurringMaster = Boolean(
    masterEvent && masterEvent.recurrence !== 'once'
  );

  const computedDefaultEnd =
    defaultEndTime ??
    minutesToTime(Math.min(23 * 60 + 59, timeToMinutes(defaultStartTime) + 60));

  const [editScope, setEditScope] = useState<'occurrence' | 'series'>(
    isRecurringMaster ? 'occurrence' : 'series'
  );
  const [title, setTitle] = useState(editingOccurrence?.title ?? '');
  const [category, setCategory] = useState<CategoryId>(
    editingOccurrence?.category ?? 'personal'
  );
  const [subcategory, setSubcategory] = useState(
    editingOccurrence?.subcategory ?? CATEGORIES[4].subcategories[0]
  );
  const [date, setDate] = useState(editingOccurrence?.date ?? defaultDate);
  const [startTime, setStartTime] = useState(
    editingOccurrence?.startTime ?? defaultStartTime
  );
  const [endTime, setEndTime] = useState(
    editingOccurrence?.endTime ?? computedDefaultEnd
  );
  const [commitmentStatus, setCommitmentStatus] = useState<CommitmentStatus>(
    editingOccurrence?.commitmentStatus ?? 'confirmed'
  );
  const [recurrence, setRecurrence] = useState<RecurrenceType>(
    masterEvent?.recurrence ?? 'once'
  );
  const [weekAB, setWeekAB] = useState<'A' | 'B' | 'both'>(
    masterEvent?.weekAB ?? 'both'
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    masterEvent?.daysOfWeek ?? [getIsoWeekday(defaultDate)]
  );
  const [nth, setNth] = useState<number>(masterEvent?.nth ?? 3);
  const [weekday, setWeekday] = useState<number>(masterEvent?.weekday ?? 7);
  const [customIntervalDays, setCustomIntervalDays] = useState<number>(
    masterEvent?.customIntervalDays ?? 7
  );
  const [location, setLocation] = useState(editingOccurrence?.location ?? '');
  const [notes, setNotes] = useState(editingOccurrence?.notes ?? '');
  const [reminderMinutes, setReminderMinutes] = useState<number>(
    editingOccurrence?.reminderMinutes ?? 15
  );
  const [isSchoolTimetable, setIsSchoolTimetable] = useState(
    Boolean(masterEvent?.isSchoolTimetable)
  );
  const [linkedHabitId, setLinkedHabitId] = useState<string>(
    () =>
      masterEvent?.linkedHabitId ??
      (masterEvent
        ? state.habits.find((h) => h.linkedEventIds?.includes(masterEvent.id))
            ?.id ?? ''
        : '')
  );
  const [validationErr, setValidationErr] = useState<string | null>(null);

  const dayOccsForSelectedDate = useMemo(() => {
    if (!date) return [];
    return expandEventsForRange(
      state.events,
      date,
      date,
      state.settings,
      state.activityRecords
    );
  }, [date, state.events, state.settings, state.activityRecords]);

  const availableWindow = useMemo(() => {
    if (!date || !startTime) return null;
    const filtered = dayOccsForSelectedDate.filter(
      (occ) => occ.occurrenceKey !== editingOccurrence?.occurrenceKey
    );
    return getAvailableWindowFrom(filtered, timeToMinutes(startTime));
  }, [date, startTime, dayOccsForSelectedDate, editingOccurrence?.occurrenceKey]);

  const overlapMatches = useMemo(() => {
    if (!date || !startTime || !endTime || endTime <= startTime) return [];
    return findOverlappingOccurrences(
      startTime,
      endTime,
      dayOccsForSelectedDate,
      editingOccurrence?.occurrenceKey
    );
  }, [
    date,
    startTime,
    endTime,
    dayOccsForSelectedDate,
    editingOccurrence?.occurrenceKey,
  ]);

  if (!isOpen) return null;

  const currentCatMeta =
    CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[4];

  const handleCategoryChange = (newCat: CategoryId) => {
    setCategory(newCat);
    const meta = CATEGORIES.find((c) => c.id === newCat);
    if (meta && !meta.subcategories.includes(subcategory)) {
      setSubcategory(meta.subcategories[0]);
    }
  };

  const toggleDay = (iso: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(iso)
        ? prev.filter((d) => d !== iso)
        : [...prev, iso].sort()
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setValidationErr('Please enter an event title.');
      return;
    }
    if (endTime <= startTime) {
      setValidationErr('End time must be after start time.');
      return;
    }
    setValidationErr(null);

    if (editingOccurrence && isRecurringMaster && editScope === 'occurrence') {
      editOccurrenceException(
        editingOccurrence.eventId,
        editingOccurrence.originalDate,
        {
          title: title.trim(),
          category,
          subcategory,
          date,
          startTime,
          endTime,
          commitmentStatus,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
        }
      );
      onClose();
      return;
    }

    const eventPayload: CalendarEvent = {
      ...(masterEvent ?? {}),
      id: masterEvent?.id ?? `ev-${Date.now()}`,
      title: title.trim(),
      category,
      subcategory,
      startDate: masterEvent?.startDate ?? date,
      startTime,
      endTime,
      recurrence,
      weekAB,
      daysOfWeek:
        recurrence === 'weekly' || recurrence === 'fortnightly'
          ? daysOfWeek
          : undefined,
      nth: recurrence === 'nthWeekday' ? nth : undefined,
      weekday: recurrence === 'nthWeekday' ? weekday : undefined,
      customIntervalDays:
        recurrence === 'custom' ? customIntervalDays : undefined,
      commitmentStatus,
      source: masterEvent?.source ?? 'personal',
      isSchoolTimetable,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      reminderMinutes,
      linkedHabitId: linkedHabitId || undefined,
    };

    upsertEvent(eventPayload);
    onClose();
  };

  const handleDelete = () => {
    if (!editingOccurrence) return;
    if (isRecurringMaster && editScope === 'occurrence') {
      editOccurrenceException(
        editingOccurrence.eventId,
        editingOccurrence.originalDate,
        { deleted: true }
      );
    } else {
      deleteEvent(editingOccurrence.eventId);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editingOccurrence ? 'Edit Event' : 'New Calendar Event'}
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#141b29] border border-slate-200 dark:border-slate-800 shadow-xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {editingOccurrence ? 'Edit Event' : 'New Calendar Event'}
          </h2>
          <button
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isRecurringMaster && editingOccurrence && (
          <div className="mb-4 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 flex gap-1">
            <button
              type="button"
              onClick={() => setEditScope('occurrence')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition ${
                editScope === 'occurrence'
                  ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white'
                  : 'text-slate-500'
              }`}
            >
              This occurrence ({editingOccurrence.originalDate})
            </button>
            <button
              type="button"
              onClick={() => setEditScope('series')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition ${
                editScope === 'series'
                  ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white'
                  : 'text-slate-500'
              }`}
            >
              Entire series
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {validationErr && (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              {validationErr}
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Title
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Deep work session, Training, Community gathering..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) =>
                  handleCategoryChange(e.target.value as CategoryId)
                }
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
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Subcategory
              </label>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              >
                {currentCatMeta.subcategories.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Start
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                End
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono"
              />
            </div>
          </div>

          {!editingOccurrence && availableWindow && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-mono tabular-nums">
                {availableWindow.summaryText}
              </span>
              {availableWindow.nextCommitment &&
                availableWindow.availableMinutes >= 10 &&
                endTime !== availableWindow.untilTime && (
                  <button
                    type="button"
                    onClick={() => setEndTime(availableWindow.untilTime)}
                    className="font-medium text-slate-900 dark:text-white underline underline-offset-2 hover:opacity-80"
                  >
                    Use until {availableWindow.untilTime}
                  </button>
                )}
            </div>
          )}

          {overlapMatches.length > 0 && (
            <div
              role="status"
              className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Schedule overlap detected ({overlapMatches.length})
                </p>
                <p className="mt-0.5 opacity-90">
                  Overlaps{' '}
                  {overlapMatches
                    .slice(0, 2)
                    .map(
                      (m) =>
                        `${m.occurrence.title} (${m.occurrence.startTime}–${m.occurrence.endTime}, ${formatDuration(m.overlapMinutes)})`
                    )
                    .join(' and ')}
                  . Adjust times or save if intentional.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Commitment status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                ['confirmed', 'tentative', 'proposed'] as CommitmentStatus[]
              ).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setCommitmentStatus(st)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium capitalize border transition ${
                    commitmentStatus === st
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {(!isRecurringMaster || editScope === 'series') && (
            <div className="space-y-3 pt-2 border-t border-slate-200/70 dark:border-slate-800">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Recurrence
                  </label>
                  <select
                    value={recurrence}
                    onChange={(e) =>
                      setRecurrence(e.target.value as RecurrenceType)
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                  >
                    <option value="once">One-off event</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="fortnightly">Fortnightly</option>
                    <option value="monthly">Monthly (same date)</option>
                    <option value="nthWeekday">Nth weekday of month</option>
                    <option value="wednesdayBeforeThirdSunday">
                      Wed before 3rd Sunday
                    </option>
                    <option value="custom">Custom interval (days)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Week A / B rule
                  </label>
                  <select
                    value={weekAB}
                    onChange={(e) =>
                      setWeekAB(e.target.value as 'A' | 'B' | 'both')
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                  >
                    <option value="both">Both Week A &amp; B</option>
                    <option value="A">Week A only</option>
                    <option value="B">Week B only</option>
                  </select>
                </div>
              </div>

              {(recurrence === 'weekly' || recurrence === 'fortnightly') && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    Repeat on weekdays
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAY_LABELS.map((d) => (
                      <button
                        key={d.iso}
                        type="button"
                        onClick={() => toggleDay(d.iso)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          daysOfWeek.includes(d.iso)
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recurrence === 'nthWeekday' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Occurrence (1–5)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={nth}
                      onChange={(e) => setNth(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Weekday
                    </label>
                    <select
                      value={weekday}
                      onChange={(e) => setWeekday(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                    >
                      {WEEKDAY_LABELS.map((d) => (
                        <option key={d.iso} value={d.iso}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {recurrence === 'custom' && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Repeat every N days
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={customIntervalDays}
                    onChange={(e) =>
                      setCustomIntervalDays(Number(e.target.value))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={isSchoolTimetable}
                  onChange={(e) => setIsSchoolTimetable(e.target.checked)}
                  className="rounded"
                />
                Suspend automatically during school holidays
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Location (optional)
              </label>
              <input
                type="text"
                maxLength={200}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="School, Gym, Studio..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Reminder (mins before)
              </label>
              <input
                type="number"
                min={0}
                max={10080}
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Link habit (optional — completing this activity fulfils the habit)
            </label>
            <select
              value={linkedHabitId}
              onChange={(e) => setLinkedHabitId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
            >
              <option value="">None</option>
              {state.habits
                .filter((h) => !h.archived)
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.title}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {editingOccurrence ? (
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
              >
                <Trash2 className="w-4 h-4" />
                {isRecurringMaster && editScope === 'occurrence'
                  ? 'Remove this occurrence'
                  : 'Delete event'}
              </button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
