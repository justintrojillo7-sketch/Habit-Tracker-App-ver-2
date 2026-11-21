import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  MapPin,
  Plus,
  X,
} from 'lucide-react';
import { useLifeHQ } from '../context/LifeHQContext';
import { EventOccurrence, WeekType } from '../types/lifehq';
import {
  calculateFreeSchoolMinutes,
  calculateOccupiedMinutes,
  getAvailableWindowFrom,
  isFreeSchoolPeriod,
  layoutDayEvents,
  PositionedOccurrence,
  snapTimeSlotRange,
} from '../utils/calendarLayout';
import {
  addDays,
  formatDisplayDate,
  formatDuration,
  formatShortDate,
  getIsoWeekday,
  getMondayOfWeek,
  getMonthGridDates,
  getWeekDates,
  getWeekType,
  isSchoolHoliday,
  minutesToTime,
} from '../utils/dateUtils';
import { expandEventsForRange } from '../utils/recurrence';
import { EventModal } from './EventModal';

type CalendarMode = 'day' | 'week' | 'month' | 'list';

const VALID_MODES: CalendarMode[] = ['day', 'week', 'month', 'list'];
const DESKTOP_VIEW_STORAGE_KEY = 'lifehq_cal_view_desktop';
const MOBILE_VIEW_STORAGE_KEY = 'lifehq_cal_view_mobile';

const HOUR_HEIGHT = 96; // px per hour (1.6px per minute so 10-25m blocks never clip)
const TOTAL_GRID_HEIGHT = 24 * HOUR_HEIGHT;
const DEFAULT_SCROLL_MINUTES = 6 * 60 + 45; // 06:45 so 07:00 starts cleanly at top

function readStoredMode(key: string, fallback: CalendarMode): CalendarMode {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw && VALID_MODES.includes(raw as CalendarMode)) {
      return raw as CalendarMode;
    }
  } catch {
    // ignore storage access issues
  }
  return fallback;
}

function writeStoredMode(key: string, mode: CalendarMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, mode);
  } catch {
    // ignore storage access issues
  }
}

function getIsDesktopViewport(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(min-width: 768px)').matches;
}

function stepMonthClamped(dateStr: string, deltaMonths: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const firstOfTarget = new Date(Date.UTC(y, m - 1 + deltaMonths, 1, 12, 0, 0));
  const targetYear = firstOfTarget.getUTCFullYear();
  const targetMonth = firstOfTarget.getUTCMonth();
  const daysInTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0, 12, 0, 0)
  ).getUTCDate();
  const clampedDay = Math.min(d, daysInTargetMonth);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(
    clampedDay
  ).padStart(2, '0')}`;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

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

  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    getIsDesktopViewport()
  );
  const [viewMode, setViewMode] = useState<CalendarMode>(() => {
    const desktop = getIsDesktopViewport();
    return desktop
      ? readStoredMode(DESKTOP_VIEW_STORAGE_KEY, 'week')
      : readStoredMode(MOBILE_VIEW_STORAGE_KEY, 'day');
  });

  const [focusDate, setFocusDate] = useState<string>(now.date);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultDate, setModalDefaultDate] = useState<string>(now.date);
  const [modalDefaultStartTime, setModalDefaultStartTime] =
    useState<string>('09:00');
  const [modalDefaultEndTime, setModalDefaultEndTime] =
    useState<string>('10:00');
  const [editingOcc, setEditingOcc] = useState<EventOccurrence | null>(null);
  const [selectedOcc, setSelectedOcc] = useState<EventOccurrence | null>(null);
  const [draggedOcc, setDraggedOcc] = useState<EventOccurrence | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [hoverSlot, setHoverSlot] = useState<{
    date: string;
    minutes: number;
  } | null>(null);

  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const hasAutoScrolledRef = useRef(false);

  // Sync preferred view independently across mobile / desktop breakpoints
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => {
      const nextDesktop = e.matches;
      setIsDesktop(nextDesktop);
      setViewMode(
        nextDesktop
          ? readStoredMode(DESKTOP_VIEW_STORAGE_KEY, 'week')
          : readStoredMode(MOBILE_VIEW_STORAGE_KEY, 'day')
      );
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  // Scroll timeline to daytime start on mount or switching into timeline views
  useEffect(() => {
    if (viewMode !== 'day' && viewMode !== 'week') {
      hasAutoScrolledRef.current = false;
      return;
    }
    if (hasAutoScrolledRef.current) return;
    const el = timelineScrollRef.current;
    if (!el) return;
    el.scrollTop = (DEFAULT_SCROLL_MINUTES / 60) * HOUR_HEIGHT;
    hasAutoScrolledRef.current = true;
  }, [viewMode]);

  const handleSelectViewMode = (mode: CalendarMode) => {
    setViewMode(mode);
    writeStoredMode(
      isDesktop ? DESKTOP_VIEW_STORAGE_KEY : MOBILE_VIEW_STORAGE_KEY,
      mode
    );
  };

  const activeMonday = getMondayOfWeek(focusDate);
  const weekType = getWeekType(focusDate, state.settings);
  const isOverridden = Boolean(state.settings.weekOverrides?.[activeMonday]);
  const focusHoliday = isSchoolHoliday(
    focusDate,
    state.settings.schoolHolidays
  );

  const range = useMemo(() => {
    if (viewMode === 'day') return { start: focusDate, end: focusDate };
    if (viewMode === 'week')
      return { start: activeMonday, end: addDays(activeMonday, 6) };
    if (viewMode === 'list')
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
      if (occ.isRoutineMarker && viewMode !== 'day' && viewMode !== 'week') {
        continue;
      }
      const list = map.get(occ.date) ?? [];
      list.push(occ);
      map.set(occ.date, list);
    }
    return map;
  }, [occurrences, viewMode]);

  const occupiedMinutes = useMemo(
    () => calculateOccupiedMinutes(occurrences),
    [occurrences]
  );

  const freeSchoolMinutes = useMemo(
    () => calculateFreeSchoolMinutes(occurrences),
    [occurrences]
  );

  const stepNavigation = (direction: -1 | 1) => {
    if (viewMode === 'day') setFocusDate((d) => addDays(d, direction));
    else if (viewMode === 'week') setFocusDate((d) => addDays(d, direction * 7));
    else if (viewMode === 'list')
      setFocusDate((d) => addDays(d, direction * 14));
    else setFocusDate((d) => stepMonthClamped(d, direction));
  };

  const handleJumpToday = () => {
    setFocusDate(now.date);
    if (viewMode === 'day' || viewMode === 'week') {
      const el = timelineScrollRef.current;
      if (el) {
        const targetMinutes = Math.max(
          0,
          Math.min(now.minutes - 120, DEFAULT_SCROLL_MINUTES)
        );
        el.scrollTo({
          top: (targetMinutes / 60) * HOUR_HEIGHT,
          behavior: 'smooth',
        });
      }
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

  const openNewEventModal = (
    date: string,
    startTime = '09:00',
    endTime = '10:00'
  ) => {
    setEditingOcc(null);
    setModalDefaultDate(date);
    setModalDefaultStartTime(startTime);
    setModalDefaultEndTime(endTime);
    setModalOpen(true);
  };

  const handleDropOnDate = (targetDate: string) => {
    setDragOverDate(null);
    if (!draggedOcc || draggedOcc.date === targetDate) {
      setDraggedOcc(null);
      return;
    }
    editOccurrenceException(draggedOcc.eventId, draggedOcc.originalDate, {
      date: targetDate,
    });
    setDraggedOcc(null);
  };

  const handleTimelineColumnClick = (
    e: React.MouseEvent<HTMLDivElement>,
    date: string
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = Math.max(
      0,
      Math.min(TOTAL_GRID_HEIGHT - 1, e.clientY - rect.top)
    );
    const rawMinutes = (offsetY / HOUR_HEIGHT) * 60;
    const snappedStart = Math.max(
      0,
      Math.min(23 * 60 + 45, Math.floor(rawMinutes / 15) * 15)
    );
    const dayOccs = occurrencesByDate.get(date) ?? [];
    const availableInfo = getAvailableWindowFrom(dayOccs, snappedStart);
    const { startTime, endTime } = snapTimeSlotRange(
      rawMinutes,
      15,
      60,
      availableInfo.availableMinutes
    );
    openNewEventModal(date, startTime, endTime);
  };

  const handleTimelineColumnMove = (
    e: React.MouseEvent<HTMLDivElement>,
    date: string
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = Math.max(
      0,
      Math.min(TOTAL_GRID_HEIGHT - 1, e.clientY - rect.top)
    );
    const rawMinutes = (offsetY / HOUR_HEIGHT) * 60;
    const snapped = Math.max(
      0,
      Math.min(23 * 60 + 45, Math.floor(rawMinutes / 15) * 15)
    );
    setHoverSlot((prev) =>
      prev && prev.date === date && prev.minutes === snapped
        ? prev
        : { date, minutes: snapped }
    );
  };

  const headerTitle = useMemo(() => {
    if (viewMode === 'day') return formatDisplayDate(focusDate);
    if (viewMode === 'month')
      return formatDisplayDate(focusDate, { month: 'long', year: 'numeric' });
    return `${formatShortDate(range.start)} – ${formatShortDate(range.end)}`;
  }, [viewMode, focusDate, range]);

  const renderAgendaCard = (occ: EventOccurrence) => {
    const cat = getCategoryMeta(occ.category);
    const isCancelled = occ.activityRecord?.status === 'cancelled';
    const isDone = occ.activityRecord?.status === 'completed';
    const isFree = isFreeSchoolPeriod(occ);

    return (
      <div
        key={occ.occurrenceKey}
        draggable
        onDragStart={() => setDraggedOcc(occ)}
        onClick={() => setSelectedOcc(occ)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSelectedOcc(occ);
          }
        }}
        className={`group cursor-pointer rounded-xl border p-3 text-left transition ${
          isCancelled
            ? 'opacity-50 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40'
            : isFree
            ? 'border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 hover:border-slate-400 dark:hover:border-slate-600'
            : occ.commitmentStatus === 'tentative'
            ? 'border-dashed border-amber-400/80 dark:border-amber-600/70 bg-amber-50/40 dark:bg-amber-950/20'
            : occ.commitmentStatus === 'proposed'
            ? 'border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#192233] hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-sm shrink-0 ${
                isFree ? 'opacity-50 border border-current bg-transparent' : ''
              }`}
              style={
                isFree
                  ? { borderColor: cat.colour }
                  : { backgroundColor: cat.colour }
              }
            />
            <p
              className={`text-sm font-semibold leading-snug truncate ${
                isFree
                  ? 'text-slate-700 dark:text-slate-200'
                  : 'text-slate-900 dark:text-slate-100'
              } ${isCancelled ? 'line-through' : ''}`}
            >
              {occ.title}
            </p>
          </div>
          {isDone && (
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 pl-4">
          <span className="font-mono tabular-nums">
            {occ.startTime}–{occ.endTime}
          </span>
          {isFree && (
            <span className="text-slate-500 dark:text-slate-400">
              · Available free period
            </span>
          )}
          {occ.location && !isFree && <span>· {occ.location}</span>}
          {occ.linkedRoleBadge && <span>· Role: {occ.linkedRoleBadge}</span>}
          {!isFree && occ.commitmentStatus !== 'confirmed' && (
            <span className="capitalize">· {occ.commitmentStatus}</span>
          )}
        </div>
      </div>
    );
  };

  const renderTimelineBlock = (
    pos: PositionedOccurrence,
    isSingleDay: boolean
  ) => {
    const {
      occ,
      startMin,
      endMin,
      leftPercent,
      widthPercent,
      totalCols,
      maxVisualEndMin,
    } = pos;
    const cat = getCategoryMeta(occ.category);
    const isCancelled = occ.activityRecord?.status === 'cancelled';
    const isDone = occ.activityRecord?.status === 'completed';
    const isFree = isFreeSchoolPeriod(occ);
    const isTentative = occ.commitmentStatus === 'tentative';
    const isProposed = occ.commitmentStatus === 'proposed';

    const topPx = (startMin / 60) * HOUR_HEIGHT + 1;
    const naturalHeightPx = ((endMin - startMin) / 60) * HOUR_HEIGHT - 2;
    const maxAllowedHeightPx =
      ((maxVisualEndMin - startMin) / 60) * HOUR_HEIGHT - 2;
    const heightPx = Math.min(
      Math.max(15, naturalHeightPx),
      Math.max(14, maxAllowedHeightPx)
    );

    const isMicro = heightPx < 22; // e.g. 10m marker (15px)
    const isCompact = heightPx >= 22 && heightPx < 42; // 15m-25m (22px-38px)
    const isSpacious = heightPx >= 76; // >= 50m
    const isNarrowOverlap = !isSingleDay && totalCols >= 2;

    const bgHexAlpha = isCancelled
      ? undefined
      : isFree
      ? `${cat.colour}0D`
      : occ.isRoutineMarker
      ? `${cat.colour}12`
      : `${cat.colour}22`;

    const borderHexAlpha = isCancelled
      ? undefined
      : isFree
      ? `${cat.colour}66`
      : `${cat.colour}55`;

    return (
      <div
        key={occ.occurrenceKey}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          setDraggedOcc(occ);
        }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedOcc(occ);
        }}
        onMouseEnter={() => setHoverSlot(null)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setSelectedOcc(occ);
          }
        }}
        style={{
          top: `${topPx}px`,
          height: `${heightPx}px`,
          left: `calc(${leftPercent}% + 2px)`,
          width: `calc(${widthPercent}% - 4px)`,
          backgroundColor: bgHexAlpha,
          borderColor: borderHexAlpha,
        }}
        className={`absolute z-10 flex items-stretch gap-1.5 overflow-hidden rounded-lg border text-left transition-shadow cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-slate-900/40 dark:focus:ring-white/40 ${
          isMicro
            ? 'px-1.5 py-0'
            : isCompact
            ? 'px-1.5 py-0.5'
            : 'px-2 py-1.5'
        } ${
          isCancelled
            ? 'opacity-45 border-slate-300 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-900/60'
            : isFree || isTentative
            ? 'border-dashed hover:shadow-sm'
            : isProposed
            ? 'opacity-85 border-dotted hover:shadow-sm'
            : 'hover:shadow-md'
        }`}
        title={`${occ.title} · ${occ.startTime}–${occ.endTime}${
          isFree ? ' (Free school period — not counted as occupied time)' : ''
        }`}
      >
        <span
          className={`w-[3px] shrink-0 rounded-full ${
            isMicro ? 'my-0.5' : ''
          } ${isFree ? 'opacity-45' : ''}`}
          style={{
            backgroundColor: isCancelled ? '#94a3b8' : cat.colour,
          }}
        />
        <div className="min-w-0 flex-1 flex flex-col justify-center overflow-hidden">
          {isMicro || isCompact ? (
            <div className="flex items-center justify-between gap-1.5 min-w-0">
              <p
                className={`truncate font-semibold leading-none ${
                  isMicro ? 'text-[10px]' : 'text-[11px]'
                } ${
                  isFree
                    ? 'text-slate-700 dark:text-slate-200'
                    : 'text-slate-900 dark:text-slate-100'
                } ${isCancelled ? 'line-through' : ''}`}
              >
                {occ.title}
              </p>
              {!isMicro && !isNarrowOverlap && (
                <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0 leading-none">
                  {occ.startTime}
                </span>
              )}
              {isDone && (
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col justify-start overflow-hidden">
              <div className="flex items-start justify-between gap-1 min-w-0">
                <p
                  className={`text-xs font-semibold leading-tight ${
                    isSpacious ? 'line-clamp-2' : 'truncate'
                  } ${
                    isFree
                      ? 'text-slate-700 dark:text-slate-200'
                      : 'text-slate-900 dark:text-slate-100'
                  } ${isCancelled ? 'line-through' : ''}`}
                >
                  {occ.title}
                </p>
                {isDone && (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                )}
              </div>
              <p className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 truncate mt-0.5 leading-tight">
                {occ.startTime}–{occ.endTime}
                {isFree && !isSpacious ? ' · Available' : ''}
              </p>
              {isSpacious && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-1 leading-tight">
                  {[
                    isFree ? 'Free period · Available' : null,
                    isSingleDay && !isFree && occ.location ? occ.location : null,
                    occ.linkedRoleBadge
                      ? `Role: ${occ.linkedRoleBadge}`
                      : null,
                    !isFree && occ.commitmentStatus !== 'confirmed'
                      ? occ.commitmentStatus === 'tentative'
                        ? 'Tentative'
                        : 'Proposed'
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTimeGrid = (dates: string[]) => {
    const isSingleDay = dates.length === 1;
    const currentTimeTop = (now.minutes / 60) * HOUR_HEIGHT;
    const showNowInGutter = dates.includes(now.date);

    return (
      <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xs">
        {/* Week A/B, occupied hours (excluding free periods), & context strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 sm:px-4 py-2.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 text-xs">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">
              Week {weekType}
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
              w/c {formatShortDate(activeMonday)}
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
              {formatDuration(occupiedMinutes)} occupied
            </span>
            {freeSchoolMinutes > 0 && (
              <>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {formatDuration(freeSchoolMinutes)} free{' '}
                  {freeSchoolMinutes === 1 ? 'period' : 'periods'}
                </span>
              </>
            )}
            {isOverridden && (
              <>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-amber-700 dark:text-amber-300 font-medium">
                  Manual override
                </span>
              </>
            )}
            {isSingleDay && focusHoliday && (
              <>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-amber-700 dark:text-amber-300 font-medium">
                  Holiday: {focusHoliday.label}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden lg:inline text-[11px] text-slate-400 dark:text-slate-500">
              Tap any empty gap to schedule
            </span>
            <button
              type="button"
              onClick={() => toggleWeekOverride(activeMonday)}
              className="min-h-[32px] px-2.5 py-1 rounded-lg font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition"
            >
              Switch to Week {weekType === 'A' ? 'B' : 'A'}
            </button>
          </div>
        </div>

        {/* Scrollable 24h Time Grid: sticky weekday headers (top) + sticky time axis (left) */}
        <div
          ref={timelineScrollRef}
          className="overflow-auto h-[calc(100dvh-305px)] sm:h-[calc(100dvh-250px)] min-h-[380px] sm:min-h-[480px] max-h-[800px] relative overscroll-contain"
        >
          <div
            className={
              isSingleDay ? 'min-w-full' : 'min-w-[924px] md:min-w-full'
            }
          >
            {/* Sticky Day Column Headers */}
            <div className="sticky top-0 z-30 flex bg-white dark:bg-[#141b29] border-b border-slate-200 dark:border-slate-800 shadow-[0_1px_0_0_rgba(15,23,42,0.04)]">
              <div className="sticky left-0 z-40 w-14 sm:w-16 shrink-0 bg-white dark:bg-[#141b29] border-r border-slate-200/80 dark:border-slate-800/80 flex items-center justify-center">
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase">
                  GMT
                </span>
              </div>
              <div
                className={`flex-1 grid ${
                  isSingleDay ? 'grid-cols-1' : 'grid-cols-7'
                } divide-x divide-slate-200/70 dark:divide-slate-800/70`}
              >
                {dates.map((d) => {
                  const isToday = d === now.date;
                  const isSelected = d === focusDate;
                  const holiday = isSchoolHoliday(
                    d,
                    state.settings.schoolHolidays
                  );
                  const dayNum = Number(d.split('-')[2]);
                  const weekdayLabel = formatDisplayDate(d, {
                    weekday: 'short',
                  });

                  return (
                    <div
                      key={d}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverDate(d);
                      }}
                      onDragLeave={() => setDragOverDate(null)}
                      onDrop={() => handleDropOnDate(d)}
                      className={`px-2 py-2 flex items-center justify-between gap-1 transition-colors ${
                        dragOverDate === d
                          ? 'bg-slate-100 dark:bg-slate-800/70'
                          : isSelected && !isSingleDay
                          ? 'bg-slate-50/90 dark:bg-slate-900/50'
                          : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setFocusDate(d);
                          if (!isSingleDay) handleSelectViewMode('day');
                        }}
                        className="flex items-center gap-1.5 min-w-0 text-left group"
                      >
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white">
                          {weekdayLabel}
                        </span>
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono tabular-nums font-semibold transition ${
                            isToday
                              ? 'bg-rose-500 text-white'
                              : isSelected && !isSingleDay
                              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                              : 'text-slate-900 dark:text-slate-100 group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
                          }`}
                        >
                          {dayNum}
                        </span>
                        {holiday && (
                          <span
                            className="text-[10px] font-medium text-amber-600 dark:text-amber-400 truncate"
                            title={holiday.label}
                          >
                            Hol
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openNewEventModal(d, '09:00', '10:00')}
                        className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        aria-label={`Add event on ${d}`}
                        title="Add event"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 24-Hour Grid Body */}
            <div
              className="flex relative"
              style={{ height: `${TOTAL_GRID_HEIGHT}px` }}
            >
              {/* Sticky Left Time Axis */}
              <div className="sticky left-0 z-20 w-14 sm:w-16 shrink-0 bg-white dark:bg-[#141b29] border-r border-slate-200/80 dark:border-slate-800/80 select-none">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    style={{ height: `${HOUR_HEIGHT}px` }}
                    className="relative"
                  >
                    {h > 0 && (
                      <span className="absolute -top-2 right-2 text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                        {`${String(h).padStart(2, '0')}:00`}
                      </span>
                    )}
                  </div>
                ))}
                {showNowInGutter && (
                  <div
                    style={{ top: `${currentTimeTop}px` }}
                    className="absolute right-1.5 -translate-y-1/2 px-1 rounded bg-rose-500 text-white text-[10px] font-mono tabular-nums font-semibold leading-tight z-30 pointer-events-none"
                  >
                    {now.time}
                  </div>
                )}
              </div>

              {/* Day Columns */}
              <div
                className={`flex-1 grid ${
                  isSingleDay ? 'grid-cols-1' : 'grid-cols-7'
                } divide-x divide-slate-200/70 dark:divide-slate-800/70 relative`}
              >
                {dates.map((d) => {
                  const dayOccs = occurrencesByDate.get(d) ?? [];
                  const positioned = layoutDayEvents(dayOccs);
                  const isToday = d === now.date;
                  const holiday = isSchoolHoliday(
                    d,
                    state.settings.schoolHolidays
                  );
                  const activeHoverMinutes =
                    hoverSlot && hoverSlot.date === d ? hoverSlot.minutes : null;
                  const hoverWindow =
                    activeHoverMinutes !== null
                      ? getAvailableWindowFrom(dayOccs, activeHoverMinutes)
                      : null;

                  return (
                    <div
                      key={d}
                      onClick={(e) => handleTimelineColumnClick(e, d)}
                      onMouseMove={(e) => handleTimelineColumnMove(e, d)}
                      onMouseLeave={() =>
                        setHoverSlot((prev) =>
                          prev?.date === d ? null : prev
                        )
                      }
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverDate(d);
                      }}
                      onDragLeave={() => setDragOverDate(null)}
                      onDrop={() => handleDropOnDate(d)}
                      className={`relative cursor-crosshair transition-colors ${
                        dragOverDate === d
                          ? 'bg-slate-100/80 dark:bg-slate-800/50'
                          : isToday
                          ? 'bg-rose-500/[0.015] dark:bg-rose-400/[0.025]'
                          : holiday
                          ? 'bg-amber-50/25 dark:bg-amber-950/10'
                          : ''
                      }`}
                      style={{ height: `${TOTAL_GRID_HEIGHT}px` }}
                    >
                      {/* Hourly + Half-Hourly Subtle Gridlines */}
                      {HOURS.map((h) => (
                        <div
                          key={h}
                          style={{ height: `${HOUR_HEIGHT}px` }}
                          className="border-b border-slate-100 dark:border-slate-800/70 relative pointer-events-none"
                        >
                          <div
                            style={{ top: `${HOUR_HEIGHT / 2}px` }}
                            className="absolute inset-x-0 border-b border-dashed border-slate-100/70 dark:border-slate-800/40"
                          />
                        </div>
                      ))}

                      {/* Interactive Empty-Slot Hover Ghost showing available duration until next commitment */}
                      {activeHoverMinutes !== null && hoverWindow && (
                        <div
                          style={{
                            top: `${(activeHoverMinutes / 60) * HOUR_HEIGHT + 1}px`,
                            height: `${HOUR_HEIGHT / 4 - 2}px`,
                          }}
                          className="absolute inset-x-1 rounded-md border border-dashed border-slate-300 dark:border-slate-600 bg-slate-100/75 dark:bg-slate-800/55 px-2 flex items-center justify-between gap-2 pointer-events-none z-0 overflow-hidden"
                        >
                          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">
                            {isSingleDay
                              ? `${minutesToTime(activeHoverMinutes)} · ${hoverWindow.summaryText}`
                              : `${minutesToTime(activeHoverMinutes)} · ${formatDuration(hoverWindow.availableMinutes)} free`}
                          </span>
                          <Plus className="w-3 h-3 text-slate-400 shrink-0" />
                        </div>
                      )}

                      {/* Positioned Event Blocks */}
                      {positioned.map((pos) =>
                        renderTimelineBlock(pos, isSingleDay)
                      )}

                      {/* Current Time Indicator */}
                      {isToday && (
                        <div
                          style={{ top: `${currentTimeTop}px` }}
                          className="absolute inset-x-0 z-20 pointer-events-none flex items-center"
                          aria-label={`Current time ${now.time}`}
                        >
                          <span className="w-2.5 h-2.5 -ml-1.25 rounded-full bg-rose-500 shrink-0" />
                          <div className="flex-1 h-[1.5px] bg-rose-500" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const [y, m] = focusDate.split('-').map(Number);
    const grid = getMonthGridDates(y, m - 1);
    const currentMonthPrefix = `${y}-${String(m).padStart(2, '0')}`;
    const selectedDayOccs = occurrencesByDate.get(focusDate) ?? [];
    const selectedDayOccupiedMins = calculateOccupiedMinutes(selectedDayOccs);

    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xs">
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 text-center py-2.5">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/80">
            {grid.map((d) => {
              const inMonth = d.startsWith(currentMonthPrefix);
              const dayOccs = occurrencesByDate.get(d) ?? [];
              const isToday = d === now.date;
              const isSelected = d === focusDate;
              const isMon = getIsoWeekday(d) === 1;
              const holiday = isSchoolHoliday(d, state.settings.schoolHolidays);

              return (
                <div
                  key={d}
                  onClick={() => setFocusDate(d)}
                  onDoubleClick={() => {
                    setFocusDate(d);
                    handleSelectViewMode('day');
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverDate(d);
                  }}
                  onDragLeave={() => setDragOverDate(null)}
                  onDrop={() => handleDropOnDate(d)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setFocusDate(d);
                    }
                  }}
                  className={`min-h-[68px] sm:min-h-[116px] p-1.5 sm:p-2 text-left transition cursor-pointer ${
                    !inMonth
                      ? 'opacity-45 bg-slate-50/60 dark:bg-slate-950/30'
                      : ''
                  } ${
                    dragOverDate === d
                      ? 'bg-slate-100 dark:bg-slate-800/60'
                      : isSelected
                      ? 'bg-slate-100/70 dark:bg-slate-800/40 ring-1 ring-inset ring-slate-900/20 dark:ring-slate-100/25'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono tabular-nums ${
                        isToday
                          ? 'bg-rose-500 text-white font-semibold'
                          : isSelected
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {Number(d.split('-')[2])}
                    </span>
                    <div className="flex items-center gap-1">
                      {holiday && (
                        <span
                          className="hidden sm:inline text-[10px] font-medium text-amber-600 dark:text-amber-400"
                          title={holiday.label}
                        >
                          Hol
                        </span>
                      )}
                      {isMon && (
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                          {getWeekType(d, state.settings)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mobile compact dots (hollow ring for free periods) */}
                  <div className="flex sm:hidden flex-wrap items-center gap-1 mt-1 px-0.5">
                    {dayOccs.slice(0, 5).map((occ) => {
                      const cat = getCategoryMeta(occ.category);
                      const isFree = isFreeSchoolPeriod(occ);
                      return (
                        <span
                          key={occ.occurrenceKey}
                          className={`w-1.5 h-1.5 rounded-full ${
                            isFree ? 'border bg-transparent opacity-70' : ''
                          }`}
                          style={
                            isFree
                              ? { borderColor: cat.colour }
                              : { backgroundColor: cat.colour }
                          }
                        />
                      );
                    })}
                    {dayOccs.length > 5 && (
                      <span className="text-[9px] font-mono text-slate-400">
                        +{dayOccs.length - 5}
                      </span>
                    )}
                  </div>

                  {/* Tablet & Desktop title-first readable previews */}
                  <div className="hidden sm:block space-y-1">
                    {dayOccs.slice(0, 3).map((occ) => {
                      const cat = getCategoryMeta(occ.category);
                      const isCancelled =
                        occ.activityRecord?.status === 'cancelled';
                      const isFree = isFreeSchoolPeriod(occ);
                      return (
                        <button
                          key={occ.occurrenceKey}
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDraggedOcc(occ);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFocusDate(d);
                            setSelectedOcc(occ);
                          }}
                          style={{
                            backgroundColor: isFree
                              ? `${cat.colour}0C`
                              : `${cat.colour}1B`,
                            borderColor: isFree
                              ? `${cat.colour}55`
                              : 'transparent',
                          }}
                          className={`w-full flex items-center justify-between gap-1 px-1.5 py-0.5 rounded-md border text-left hover:brightness-95 dark:hover:brightness-110 transition ${
                            isFree ? 'border-dashed' : ''
                          } ${isCancelled ? 'opacity-45 line-through' : ''}`}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isFree ? 'opacity-50' : ''
                              }`}
                              style={{ backgroundColor: cat.colour }}
                            />
                            <span
                              className={`text-[11px] font-medium truncate ${
                                isFree
                                  ? 'text-slate-600 dark:text-slate-300'
                                  : 'text-slate-800 dark:text-slate-100'
                              }`}
                            >
                              {occ.title}
                            </span>
                          </div>
                          <span className="text-[9px] font-mono tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                            {occ.startTime}
                          </span>
                        </button>
                      );
                    })}
                    {dayOccs.length > 3 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusDate(d);
                          handleSelectViewMode('day');
                        }}
                        className="text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-1"
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

        {/* Selected Date Detail Panel */}
        <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-semibold">
                {formatDisplayDate(focusDate, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Week {getWeekType(focusDate, state.settings)} ·{' '}
                {formatDuration(selectedDayOccupiedMins)} occupied
                {focusHoliday ? ` · Holiday: ${focusHoliday.label}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectViewMode('day')}
                className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Open Day timeline
              </button>
              <button
                type="button"
                onClick={() => openNewEventModal(focusDate, '09:00', '10:00')}
                className="min-h-[38px] px-3 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          {selectedDayOccs.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
              Nothing scheduled on this day.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {selectedDayOccs.map((occ) => renderAgendaCard(occ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderListView = () => {
    const days = Array.from({ length: 21 }, (_, idx) =>
      addDays(focusDate, idx)
    );
    const populatedDays = days.filter(
      (d) => (occurrencesByDate.get(d) ?? []).length > 0
    );

    if (populatedDays.length === 0) {
      return (
        <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-8 text-center space-y-3">
          <CalendarIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No scheduled activities between {formatShortDate(range.start)} and{' '}
            {formatShortDate(range.end)}.
          </p>
          <button
            type="button"
            onClick={() => openNewEventModal(focusDate, '09:00', '10:00')}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
          >
            <Plus className="w-4 h-4" /> Add event
          </button>
        </div>
      );
    }

    return (
      <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 divide-y divide-slate-100 dark:divide-slate-800/80">
        {populatedDays.map((d) => {
          const dayOccs = occurrencesByDate.get(d) ?? [];
          const dayOccupiedMins = calculateOccupiedMinutes(dayOccs);
          const holiday = isSchoolHoliday(d, state.settings.schoolHolidays);
          const isToday = d === now.date;
          return (
            <div key={d} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">
                    {formatDisplayDate(d, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </h3>
                  {isToday && (
                    <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                      Today
                    </span>
                  )}
                  {holiday && (
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      · {holiday.label}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  Week {getWeekType(d, state.settings)} ·{' '}
                  {formatDuration(dayOccupiedMins)} occupied
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {dayOccs.map((occ) => renderAgendaCard(occ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-3.5 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => stepNavigation(-1)}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleJumpToday}
              className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap transition"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => stepNavigation(1)}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-semibold tracking-tight truncate">
              {headerTitle}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Week {weekType} · Europe/London · 24h
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
          {/* 4-option Apple Calendar-style Segmented View Control */}
          <div
            role="tablist"
            aria-label="Calendar view"
            className="grid grid-cols-4 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 flex-1 sm:flex-none sm:w-auto"
          >
            {(
              [
                { id: 'day', label: 'Day' },
                { id: 'week', label: 'Week' },
                { id: 'month', label: 'Month' },
                { id: 'list', label: 'List' },
              ] as Array<{ id: CalendarMode; label: string }>
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={viewMode === item.id}
                onClick={() => handleSelectViewMode(item.id)}
                className={`min-h-[34px] px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  viewMode === item.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => openNewEventModal(focusDate, '09:00', '10:00')}
            className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 whitespace-nowrap hover:opacity-90 transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline sm:inline">Add event</span>
          </button>
        </div>
      </div>

      {/* View Content */}
      {viewMode === 'day' && renderTimeGrid([focusDate])}
      {viewMode === 'week' && renderTimeGrid(getWeekDates(activeMonday))}
      {viewMode === 'month' && renderMonthView()}
      {viewMode === 'list' && renderListView()}

      {/* Selected Occurrence Full Detail & Quick-Action Sheet */}
      {selectedOcc && (() => {
        const isFree = isFreeSchoolPeriod(selectedOcc);
        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-sm p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            onClick={() => setSelectedOcc(null)}
          >
            <div
              className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#141b29] border border-slate-200 dark:border-slate-800 p-5 shadow-xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span
                      className={`w-2.5 h-2.5 rounded-sm shrink-0 ${
                        isFree ? 'border border-dashed bg-transparent' : ''
                      }`}
                      style={
                        isFree
                          ? {
                              borderColor: getCategoryMeta(selectedOcc.category)
                                .colour,
                            }
                          : {
                              backgroundColor: getCategoryMeta(
                                selectedOcc.category
                              ).colour,
                            }
                      }
                    />
                    <span>
                      {getCategoryMeta(selectedOcc.category).label} ·{' '}
                      {isFree ? (
                        'Available free period (not counted as occupied)'
                      ) : (
                        <span className="capitalize">
                          {selectedOcc.commitmentStatus}
                        </span>
                      )}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold mt-1">
                    {selectedOcc.title}
                  </h3>
                  <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1">
                    {formatDisplayDate(selectedOcc.date, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    · {selectedOcc.startTime}–{selectedOcc.endTime} (
                    {formatDuration(selectedOcc.durationMinutes)})
                  </p>
                  {selectedOcc.location && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {selectedOcc.location}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOcc(null)}
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
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
              {(() => {
                const linkedHabit = state.habits.find(
                  (h) =>
                    !h.archived &&
                    (h.id === selectedOcc.linkedHabitId ||
                      h.linkedEventIds?.includes(selectedOcc.eventId))
                );
                if (!linkedHabit) return null;
                return (
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    Linked habit: {linkedHabit.title}
                  </p>
                );
              })()}
              {selectedOcc.notes && (
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {selectedOcc.notes}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    confirmOccurrence(selectedOcc, 'completed');
                    setSelectedOcc(null);
                  }}
                  className="min-h-[42px] px-3 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Mark completed
                </button>
                <button
                  type="button"
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
                    type="button"
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
                  type="button"
                  onClick={() => {
                    confirmOccurrence(selectedOcc, 'cancelled');
                    setSelectedOcc(null);
                  }}
                  className="min-h-[42px] px-3 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel occurrence
                </button>
                <button
                  type="button"
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
        );
      })()}

      {modalOpen && (
        <EventModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          defaultDate={modalDefaultDate}
          defaultStartTime={modalDefaultStartTime}
          defaultEndTime={modalDefaultEndTime}
          editingOccurrence={editingOcc}
        />
      )}
    </div>
  );
};
