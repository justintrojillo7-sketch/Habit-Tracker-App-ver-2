import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  Plus,
  X,
} from 'lucide-react';
import { useLifeHQ } from '../context/LifeHQContext';
import { EventOccurrence, WeekType } from '../types/lifehq';
import {
  addDays,
  formatDisplayDate,
  formatShortDate,
  getIsoWeekday,
  getMondayOfWeek,
  getMonthGridDates,
  getWeekDates,
  getWeekType,
  isSchoolHoliday,
} from '../utils/dateUtils';
import { expandEventsForRange } from '../utils/recurrence';
import { EventModal } from './EventModal';

type CalendarMode = 'day' | 'week' | 'fortnight' | 'month' | 'agenda';

export const CalendarView: React.FC = () => {
  const {
    state,
    now,
    getCategoryMeta,
    updateSettings,
    editOccurrenceException,
    confirmOccurrence,
    startTimer,
  } = useLifeHQ();

  const [viewMode, setViewMode] = useState<CalendarMode>('week');
  const [focusDate, setFocusDate] = useState<string>(now.date);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultDate, setModalDefaultDate] = useState<string>(now.date);
  const [editingOcc, setEditingOcc] = useState<EventOccurrence | null>(null);
  const [selectedOcc, setSelectedOcc] = useState<EventOccurrence | null>(null);
  const [draggedOcc, setDraggedOcc] = useState<EventOccurrence | null>(null);

  const activeMonday = getMondayOfWeek(focusDate);
  const weekType = getWeekType(focusDate, state.settings);

  const range = useMemo(() => {
    if (viewMode === 'day') return { start: focusDate, end: focusDate };
    if (viewMode === 'week')
      return { start: activeMonday, end: addDays(activeMonday, 6) };
    if (viewMode === 'fortnight')
      return { start: activeMonday, end: addDays(activeMonday, 13) };
    if (viewMode === 'agenda')
      return { start: focusDate, end: addDays(focusDate, 20) };
    const [y, m] = focusDate.split('-').map(Number);
    const grid = getMonthGridDates(y, m - 1);
    return { start: grid[0], end: grid[grid.length - 1] };
  }, [viewMode, focusDate, activeMonday]);

  const occurrences = useMemo(
    () =>
      expandEventsForRange(
        state.events,
        range.start,
        range.end,
        state.settings,
        state.activityRecords
      ),
    [state.events, range, state.settings, state.activityRecords]
  );

  const occurrencesByDate = useMemo(() => {
    const map = new Map<string, EventOccurrence[]>();
    for (const occ of occurrences) {
      if (occ.isRoutineMarker && viewMode !== 'day') continue;
      const list = map.get(occ.date) ?? [];
      list.push(occ);
      map.set(occ.date, list);
    }
    return map;
  }, [occurrences, viewMode]);

  const stepNavigation = (direction: -1 | 1) => {
    if (viewMode === 'day') setFocusDate((d) => addDays(d, direction));
    else if (viewMode === 'week') setFocusDate((d) => addDays(d, direction * 7));
    else if (viewMode === 'fortnight')
      setFocusDate((d) => addDays(d, direction * 14));
    else if (viewMode === 'agenda')
      setFocusDate((d) => addDays(d, direction * 14));
    else {
      const [y, m] = focusDate.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1 + direction, 1, 12, 0, 0));
      setFocusDate(
        `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(
          2,
          '0'
        )}-01`
      );
    }
  };

  const toggleWeekOverride = (monday: string) => {
    const current = getWeekType(monday, state.settings);
    const next: WeekType = current === 'A' ? 'B' : 'A';
    updateSettings({
      weekOverrides: {
        ...state.settings.weekOverrides,
        [monday]: next,
      },
    });
  };

  const handleDropOnDate = (targetDate: string) => {
    if (!draggedOcc || draggedOcc.date === targetDate) {
      setDraggedOcc(null);
      return;
    }
    editOccurrenceException(draggedOcc.eventId, draggedOcc.originalDate, {
      date: targetDate,
    });
    setDraggedOcc(null);
  };

  const headerTitle = useMemo(() => {
    if (viewMode === 'day') return formatDisplayDate(focusDate);
    if (viewMode === 'month')
      return formatDisplayDate(focusDate, { month: 'long', year: 'numeric' });
    return `${formatShortDate(range.start)} – ${formatShortDate(range.end)}`;
  }, [viewMode, focusDate, range]);

  const renderEventChip = (occ: EventOccurrence, compact = false) => {
    const cat = getCategoryMeta(occ.category);
    const isCancelled = occ.activityRecord?.status === 'cancelled';
    const isDone = occ.activityRecord?.status === 'completed';

    return (
      <div
        key={occ.occurrenceKey}
        draggable
        onDragStart={() => setDraggedOcc(occ)}
        onClick={() => setSelectedOcc(occ)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setSelectedOcc(occ);
        }}
        className={`group cursor-pointer rounded-xl border p-2 text-left transition ${
          isCancelled
            ? 'opacity-50 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40'
            : occ.commitmentStatus === 'tentative'
            ? 'border-dashed border-amber-400/80 dark:border-amber-600/70 bg-amber-50/40 dark:bg-amber-950/20'
            : occ.commitmentStatus === 'proposed'
            ? 'border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#192233] hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ backgroundColor: cat.colour }}
            />
            <span className="font-mono tabular-nums truncate">
              {occ.startTime}
              {!compact ? `–${occ.endTime}` : ''}
            </span>
          </div>
          {isDone && (
            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
        </div>
        <p
          className={`text-xs font-medium mt-0.5 leading-snug ${
            compact ? 'truncate' : 'line-clamp-2'
          } ${isCancelled ? 'line-through' : ''}`}
        >
          {occ.title}
        </p>
        {!compact && (occ.linkedRoleBadge || occ.commitmentStatus !== 'confirmed') && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {occ.linkedRoleBadge
              ? `Role: ${occ.linkedRoleBadge}`
              : occ.commitmentStatus === 'tentative'
              ? 'Tentative'
              : 'Proposed'}
          </p>
        )}
      </div>
    );
  };

  const renderWeekGrid = (dates: string[], labelPrefix?: string) => {
    const monday = dates[0];
    const wType = getWeekType(monday, state.settings);
    const isOverridden = Boolean(state.settings.weekOverrides?.[monday]);
    return (
      <div key={monday} className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold">
              {labelPrefix ? `${labelPrefix} · ` : ''}Week {wType}
            </span>
            <span className="text-slate-400 font-mono tabular-nums">
              w/c {formatShortDate(monday)}
            </span>
            {isOverridden && (
              <span className="text-amber-700 dark:text-amber-300">
                (manual override)
              </span>
            )}
          </div>
          <button
            onClick={() => toggleWeekOverride(monday)}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Switch to Week {wType === 'A' ? 'B' : 'A'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
          {dates.map((d) => {
            const dayOccs = occurrencesByDate.get(d) ?? [];
            const isToday = d === now.date;
            const holiday = isSchoolHoliday(d, state.settings.schoolHolidays);
            return (
              <div
                key={d}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropOnDate(d)}
                className={`rounded-2xl border p-3 min-h-[160px] flex flex-col gap-2 transition ${
                  isToday
                    ? 'border-slate-900 dark:border-slate-200 bg-white dark:bg-[#141b29]'
                    : 'border-slate-200/80 dark:border-slate-800/80 bg-white/75 dark:bg-[#141b29]/75'
                }`}
              >
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      setFocusDate(d);
                      setViewMode('day');
                    }}
                    className="text-left hover:underline"
                  >
                    <span className="text-xs font-semibold block">
                      {formatDisplayDate(d, { weekday: 'short' })}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {formatDisplayDate(d, { day: 'numeric', month: 'short' })}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingOcc(null);
                      setModalDefaultDate(d);
                      setModalOpen(true);
                    }}
                    className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Add event on this day"
                    aria-label={`Add event on ${d}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {holiday && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                    Holiday: {holiday.label}
                  </p>
                )}

                <div className="space-y-1.5 flex-1">
                  {dayOccs.length === 0 ? (
                    <p className="text-[11px] text-slate-400 pt-2">No events</p>
                  ) : (
                    dayOccs.map((occ) => renderEventChip(occ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => stepNavigation(-1)}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setFocusDate(now.date)}
              className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              Today
            </button>
            <button
              onClick={() => stepNavigation(1)}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
              {headerTitle}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Week {weekType} · Drag events between days to reschedule
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 overflow-x-auto">
            {(
              ['day', 'week', 'fortnight', 'month', 'agenda'] as CalendarMode[]
            ).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition ${
                  viewMode === mode
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setEditingOcc(null);
              setModalDefaultDate(focusDate);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Add event
          </button>
        </div>
      </div>

      {/* Day View */}
      {viewMode === 'day' && (
        <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {formatDisplayDate(focusDate)} · Week {weekType}
            </p>
            <button
              onClick={() => toggleWeekOverride(activeMonday)}
              className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline"
            >
              Override week to {weekType === 'A' ? 'B' : 'A'}
            </button>
          </div>
          {(occurrencesByDate.get(focusDate) ?? []).length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              No events scheduled for this day.
            </p>
          ) : (
            <div className="space-y-2">
              {(occurrencesByDate.get(focusDate) ?? []).map((occ) =>
                renderEventChip(occ)
              )}
            </div>
          )}
        </div>
      )}

      {/* Week View */}
      {viewMode === 'week' && renderWeekGrid(getWeekDates(activeMonday))}

      {/* Fortnight View */}
      {viewMode === 'fortnight' && (
        <div className="space-y-6">
          {renderWeekGrid(getWeekDates(activeMonday), 'Week 1')}
          {renderWeekGrid(
            getWeekDates(addDays(activeMonday, 7)),
            'Week 2'
          )}
        </div>
      )}

      {/* Month View */}
      {viewMode === 'month' && (() => {
        const [y, m] = focusDate.split('-').map(Number);
        const grid = getMonthGridDates(y, m - 1);
        const currentMonthPrefix = `${y}-${String(m).padStart(2, '0')}`;
        return (
          <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 text-center py-2.5">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/80">
              {grid.map((d) => {
                const inMonth = d.startsWith(currentMonthPrefix);
                const dayOccs = occurrencesByDate.get(d) ?? [];
                const isToday = d === now.date;
                const isMon = getIsoWeekday(d) === 1;
                return (
                  <div
                    key={d}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropOnDate(d)}
                    className={`min-h-[108px] p-1.5 sm:p-2 ${
                      !inMonth ? 'opacity-40 bg-slate-50/60 dark:bg-slate-950/30' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <button
                        onClick={() => {
                          setFocusDate(d);
                          setViewMode('day');
                        }}
                        className={`text-xs font-mono tabular-nums px-1.5 py-0.5 rounded-md ${
                          isToday
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {Number(d.split('-')[2])}
                      </button>
                      {isMon && (
                        <span className="text-[10px] font-semibold text-slate-400">
                          {getWeekType(d, state.settings)}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {dayOccs.slice(0, 3).map((occ) => renderEventChip(occ, true))}
                      {dayOccs.length > 3 && (
                        <button
                          onClick={() => {
                            setFocusDate(d);
                            setViewMode('day');
                          }}
                          className="text-[10px] font-medium text-slate-500 hover:underline px-1"
                        >
                          +{dayOccs.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Agenda View */}
      {viewMode === 'agenda' && (
        <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 divide-y divide-slate-100 dark:divide-slate-800/80">
          {Array.from({ length: 21 }, (_, idx) => addDays(focusDate, idx)).map(
            (d) => {
              const dayOccs = occurrencesByDate.get(d) ?? [];
              if (dayOccs.length === 0) return null;
              return (
                <div key={d} className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">
                      {formatDisplayDate(d, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">
                      Week {getWeekType(d, state.settings)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {dayOccs.map((occ) => renderEventChip(occ))}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}

      {/* Selected Occurrence Quick-Action Sheet */}
      {selectedOcc && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#141b29] border border-slate-200 dark:border-slate-800 p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {getCategoryMeta(selectedOcc.category).label} ·{' '}
                  <span className="capitalize">
                    {selectedOcc.commitmentStatus}
                  </span>
                </p>
                <h3 className="text-lg font-semibold mt-0.5">
                  {selectedOcc.title}
                </h3>
                <p className="text-xs font-mono tabular-nums text-slate-500 mt-1">
                  {formatShortDate(selectedOcc.date)} · {selectedOcc.startTime}–
                  {selectedOcc.endTime}
                </p>
              </div>
              <button
                onClick={() => setSelectedOcc(null)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedOcc.linkedRoleBadge && (
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Linked responsibility: {selectedOcc.linkedRoleBadge}
              </p>
            )}
            {selectedOcc.notes && (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {selectedOcc.notes}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => {
                  confirmOccurrence(selectedOcc, 'completed');
                  setSelectedOcc(null);
                }}
                className="min-h-[42px] px-3 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Mark completed
              </button>
              <button
                onClick={() => {
                  startTimer({
                    category: selectedOcc.category,
                    subcategory: selectedOcc.subcategory,
                    title: selectedOcc.title,
                    linkedEventId: selectedOcc.eventId,
                    linkedOccurrenceDate: selectedOcc.originalDate,
                  });
                  setSelectedOcc(null);
                }}
                className="min-h-[42px] px-3 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 inline-flex items-center justify-center gap-1.5"
              >
                <Clock className="w-4 h-4" /> Start timer
              </button>
              {selectedOcc.commitmentStatus !== 'confirmed' && (
                <button
                  onClick={() => {
                    editOccurrenceException(
                      selectedOcc.eventId,
                      selectedOcc.originalDate,
                      { commitmentStatus: 'confirmed' }
                    );
                    setSelectedOcc(null);
                  }}
                  className="min-h-[42px] px-3 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Confirm occurrence
                </button>
              )}
              <button
                onClick={() => {
                  confirmOccurrence(selectedOcc, 'cancelled');
                  setSelectedOcc(null);
                }}
                className="min-h-[42px] px-3 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel occurrence
              </button>
              <button
                onClick={() => {
                  setEditingOcc(selectedOcc);
                  setSelectedOcc(null);
                  setModalOpen(true);
                }}
                className="col-span-2 min-h-[42px] px-3 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 inline-flex items-center justify-center gap-1.5"
              >
                <Edit3 className="w-4 h-4" /> Edit occurrence or series
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <EventModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          defaultDate={modalDefaultDate}
          editingOccurrence={editingOcc}
        />
      )}
    </div>
  );
};
