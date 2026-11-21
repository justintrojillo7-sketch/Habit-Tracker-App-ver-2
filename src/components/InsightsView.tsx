import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  PieChart as PieIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CATEGORIES } from '../data/seedData';
import { useLifeHQ } from '../context/LifeHQContext';
import { CategoryId } from '../types/lifehq';
import {
  addDays,
  analyseDayIntervals,
  diffDays,
  formatDuration,
  formatHoursDecimal,
  formatShortDate,
  getMondayOfWeek,
  getSundayOfWeek,
  getWeekDates,
  getWeekType,
  OverlapConflict,
  timeToMinutes,
} from '../utils/dateUtils';
import { expandEventsForRange } from '../utils/recurrence';
import { calculatePillarInsightsSummary } from '../utils/pillarUtils';

type InsightsTab = 'analytics' | 'review';
type RangePreset =
  | 'today'
  | 'thisWeek'
  | 'lastWeek'
  | 'weekA'
  | 'weekB'
  | 'last14'
  | 'thisMonth'
  | 'custom';
type AnalyticsMode = 'actual' | 'planned' | 'compare';

export const InsightsView: React.FC = () => {
  const {
    state,
    now,
    getCategoryMeta,
    saveWeeklyReview,
    setActiveSection,
    openPillar,
    loadDemoSampleLogs,
  } = useLifeHQ();

  const [tab, setTab] = useState<InsightsTab>('analytics');
  const [preset, setPreset] = useState<RangePreset>('thisWeek');
  const [customStart, setCustomStart] = useState<string>(
    getMondayOfWeek(now.date)
  );
  const [customEnd, setCustomEnd] = useState<string>(getSundayOfWeek(now.date));
  const [mode, setMode] = useState<AnalyticsMode>('actual');
  const [discretionaryOnly, setDiscretionaryOnly] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<CategoryId | null>(
    null
  );

  // Weekly Review state
  const currentMonday = getMondayOfWeek(now.date);
  const [reviewMonday, setReviewMonday] = useState<string>(currentMonday);
  const existingReview = state.weeklyReviews.find(
    (w) => w.weekMonday === reviewMonday
  );
  const [wentWell, setWentWell] = useState(existingReview?.wentWell ?? '');
  const [difficultOrDraining, setDifficultOrDraining] = useState(
    existingReview?.difficultOrDraining ?? ''
  );
  const [changeNextWeek, setChangeNextWeek] = useState(
    existingReview?.changeNextWeek ?? ''
  );

  const handleReviewWeekChange = (monday: string) => {
    setReviewMonday(monday);
    const found = state.weeklyReviews.find((w) => w.weekMonday === monday);
    setWentWell(found?.wentWell ?? '');
    setDifficultOrDraining(found?.difficultOrDraining ?? '');
    setChangeNextWeek(found?.changeNextWeek ?? '');
  };

  // Compute date range bounds
  const { startDate, endDate, dayCount } = useMemo(() => {
    const thisMon = getMondayOfWeek(now.date);
    const thisWeekType = getWeekType(thisMon, state.settings);

    let s = thisMon;
    let e = addDays(thisMon, 6);

    if (preset === 'today') {
      s = now.date;
      e = now.date;
    } else if (preset === 'lastWeek') {
      s = addDays(thisMon, -7);
      e = addDays(thisMon, -1);
    } else if (preset === 'weekA') {
      s = thisWeekType === 'A' ? thisMon : addDays(thisMon, 7);
      e = addDays(s, 6);
    } else if (preset === 'weekB') {
      s = thisWeekType === 'B' ? thisMon : addDays(thisMon, 7);
      e = addDays(s, 6);
    } else if (preset === 'last14') {
      s = addDays(now.date, -13);
      e = now.date;
    } else if (preset === 'thisMonth') {
      const [y, m] = now.date.split('-').map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      s = `${y}-${String(m).padStart(2, '0')}-01`;
      e = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (preset === 'custom') {
      s = customStart <= customEnd ? customStart : customEnd;
      e = customStart <= customEnd ? customEnd : customStart;
    }

    return {
      startDate: s,
      endDate: e,
      dayCount: Math.max(1, diffDays(s, e) + 1),
    };
  }, [preset, now.date, state.settings, customStart, customEnd]);

  const totalWindowMinutes = dayCount * 24 * 60;

  const isExcludedDiscretionary = (cat: CategoryId, sub: string) => {
    if (!discretionaryOnly) return false;
    if (cat === 'rest' && sub === 'Sleep') return true;
    if (
      cat === 'teaching' &&
      (sub === 'Core work' ||
        sub === 'Classroom teaching' ||
        sub === 'Administration' ||
        sub === 'School administration' ||
        sub.endsWith('development'))
    ) {
      return true;
    }
    return false;
  };

  // Compute Actual & Planned breakdowns + Overlap Detection
  const analytics = useMemo(() => {
    const actualRecords = state.activityRecords.filter(
      (r) =>
        r.date >= startDate &&
        r.date <= endDate &&
        (r.status === 'completed' || r.status === 'partial') &&
        r.actualMinutes > 0 &&
        !isExcludedDiscretionary(r.category, r.subcategory)
    );

    const plannedOccurrences = expandEventsForRange(
      state.events,
      startDate,
      endDate,
      state.settings,
      state.activityRecords
    ).filter(
      (o) =>
        !o.isRoutineMarker &&
        o.activityRecord?.status !== 'cancelled' &&
        !isExcludedDiscretionary(o.category, o.subcategory)
    );

    const initCatMap = () =>
      ({
        teaching: 0,
        behold: 0,
        fitness: 0,
        faith: 0,
        personal: 0,
        rest: 0,
      }) as Record<CategoryId, number>;

    const actualByCat = initCatMap();
    const plannedByCat = initCatMap();
    const subcatMap: Record<CategoryId, Record<string, number>> = {
      teaching: {},
      behold: {},
      fitness: {},
      faith: {},
      personal: {},
      rest: {},
    };

    // Group actual records by date for overlap conflict detection
    const actualByDay = new Map<string, typeof actualRecords>();
    for (const r of actualRecords) {
      actualByCat[r.category] += r.actualMinutes;
      if (mode !== 'planned') {
        subcatMap[r.category][r.subcategory] =
          (subcatMap[r.category][r.subcategory] ?? 0) + r.actualMinutes;
      }
      const list = actualByDay.get(r.date) ?? [];
      list.push(r);
      actualByDay.set(r.date, list);
    }

    const plannedByDay = new Map<string, typeof plannedOccurrences>();
    for (const o of plannedOccurrences) {
      plannedByCat[o.category] += o.durationMinutes;
      if (mode === 'planned') {
        subcatMap[o.category][o.subcategory] =
          (subcatMap[o.category][o.subcategory] ?? 0) + o.durationMinutes;
      }
      const list = plannedByDay.get(o.date) ?? [];
      list.push(o);
      plannedByDay.set(o.date, list);
    }

    // Deduplicated union minutes & overlap conflicts
    let deduplicatedActualMinutes = 0;
    const actualConflicts: OverlapConflict[] = [];
    for (const [date, list] of actualByDay.entries()) {
      const res = analyseDayIntervals(
        list.map((r) => ({
          id: r.id,
          date,
          title: r.title,
          startMin: timeToMinutes(r.startTime),
          endMin: timeToMinutes(r.startTime) + r.actualMinutes,
          category: r.category,
        }))
      );
      deduplicatedActualMinutes += res.mergedMinutes;
      actualConflicts.push(...res.conflicts);
    }

    let deduplicatedPlannedMinutes = 0;
    const plannedConflicts: OverlapConflict[] = [];
    for (const [date, list] of plannedByDay.entries()) {
      const res = analyseDayIntervals(
        list.map((o) => ({
          id: o.occurrenceKey,
          date,
          title: o.title,
          startMin: timeToMinutes(o.startTime),
          endMin: timeToMinutes(o.endTime),
          category: o.category,
        }))
      );
      deduplicatedPlannedMinutes += res.mergedMinutes;
      plannedConflicts.push(...res.conflicts);
    }

    const activeTrackedMinutes =
      mode === 'planned' ? deduplicatedPlannedMinutes : deduplicatedActualMinutes;
    const untrackedMinutes = Math.max(
      0,
      totalWindowMinutes - activeTrackedMinutes
    );

    const activeByCat = mode === 'planned' ? plannedByCat : actualByCat;
    const rawCatSum = Object.values(activeByCat).reduce((a, b) => a + b, 0);

    // Pie chart segments: include explicit Untracked when not in discretionary-only mode
    const pieData: Array<{
      id: string;
      name: string;
      minutes: number;
      hours: number;
      colour: string;
      percent: number;
    }> = CATEGORIES.map((c) => {
      const mins = activeByCat[c.id];
      const denominator = discretionaryOnly
        ? Math.max(1, rawCatSum)
        : totalWindowMinutes;
      return {
        id: c.id,
        name: c.label,
        minutes: mins,
        hours: Number((mins / 60).toFixed(1)),
        colour: getCategoryMeta(c.id).colour,
        percent: Number(((mins / denominator) * 100).toFixed(1)),
      };
    }).filter((d) => d.minutes > 0);

    if (!discretionaryOnly && untrackedMinutes > 0) {
      pieData.push({
        id: 'untracked',
        name: 'Untracked',
        minutes: untrackedMinutes,
        hours: Number((untrackedMinutes / 60).toFixed(1)),
        colour: '#cbd5e1',
        percent: Number(
          ((untrackedMinutes / totalWindowMinutes) * 100).toFixed(1)
        ),
      });
    }

    const comparisonData = CATEGORIES.map((c) => ({
      category: c.label,
      planned: Number((plannedByCat[c.id] / 60).toFixed(1)),
      actual: Number((actualByCat[c.id] / 60).toFixed(1)),
      variance: Number(
        ((actualByCat[c.id] - plannedByCat[c.id]) / 60).toFixed(1)
      ),
      colour: getCategoryMeta(c.id).colour,
    }));

    // Daily trend data across range (up to 31 days)
    const dailyTrend: Array<{
      day: string;
      actualHours: number;
      plannedHours: number;
    }> = [];
    for (let i = 0; i < Math.min(31, dayCount); i++) {
      const d = addDays(startDate, i);
      const aMin = (actualByDay.get(d) ?? []).reduce(
        (acc, r) => acc + r.actualMinutes,
        0
      );
      const pMin = (plannedByDay.get(d) ?? []).reduce(
        (acc, o) => acc + o.durationMinutes,
        0
      );
      dailyTrend.push({
        day: d.slice(5),
        actualHours: Number((aMin / 60).toFixed(1)),
        plannedHours: Number((pMin / 60).toFixed(1)),
      });
    }

    const demoCount = actualRecords.filter((r) => r.isDemoData).length;

    return {
      actualByCat,
      plannedByCat,
      subcatMap,
      deduplicatedActualMinutes,
      deduplicatedPlannedMinutes,
      untrackedMinutes,
      actualConflicts,
      plannedConflicts,
      pieData,
      comparisonData,
      dailyTrend,
      demoCount,
    };
  }, [
    state.activityRecords,
    state.events,
    state.settings,
    startDate,
    endDate,
    mode,
    discretionaryOnly,
    totalWindowMinutes,
    dayCount,
    getCategoryMeta,
  ]);

  // 5-Minute Sunday Review factual summary
  const reviewSummary = useMemo(() => {
    const rSun = addDays(reviewMonday, 6);
    const wDates = getWeekDates(reviewMonday);
    const recs = state.activityRecords.filter(
      (r) =>
        r.date >= reviewMonday &&
        r.date <= rSun &&
        (r.status === 'completed' || r.status === 'partial')
    );

    const totalMins = recs.reduce((acc, r) => acc + r.actualMinutes, 0);
    const gymDone = recs.filter((r) => r.category === 'fitness').length;
    const beholdMins = recs
      .filter((r) => r.category === 'behold')
      .reduce((acc, r) => acc + r.actualMinutes, 0);
    const beholdItems = recs
      .filter((r) => r.category === 'behold')
      .map((r) => r.title);
    const prepDone = recs.filter(
      (r) => r.category === 'teaching' && r.subcategory === 'Lesson planning'
    ).length;
    const ministryDone = recs
      .filter((r) => r.category === 'faith' && r.subcategory !== 'Devotion')
      .map((r) => r.title);
    const sleepMins = recs
      .filter((r) => r.category === 'rest' && r.subcategory === 'Sleep')
      .reduce((acc, r) => acc + r.actualMinutes, 0);

    const habitDoneTotal = state.habitLogs.filter(
      (l) => l.status === 'done' && wDates.includes(l.date)
    ).length;

    const factualLines: string[] = [
      `Week commencing ${formatShortDate(reviewMonday)} (Week ${getWeekType(
        reviewMonday,
        state.settings
      )}): ${formatHoursDecimal(totalMins)} of confirmed activity recorded.`,
      `Fitness: ${gymDone} strength / conditioning session${gymDone === 1 ? '' : 's'} logged.`,
      `${getCategoryMeta('behold').label}: ${formatHoursDecimal(beholdMins)} logged${
        beholdItems.length > 0
          ? ` (${Array.from(new Set(beholdItems)).slice(0, 3).join(', ')})`
          : ''
      }.`,
      `${getCategoryMeta('teaching').label} preparation: ${prepDone} dedicated planning block${prepDone === 1 ? '' : 's'} confirmed.`,
      `${getCategoryMeta('faith').label}: ${
        ministryDone.length > 0
          ? `${ministryDone.join(', ')} completed.`
          : 'No additional ministry blocks confirmed yet.'
      }`,
      sleepMins > 0
        ? `Sleep logged: ${formatHoursDecimal(sleepMins)} across the week.`
        : 'Sleep was not manually logged this week.',
    ];

    return {
      totalMins,
      gymDone,
      beholdMins,
      prepDone,
      ministryDone,
      sleepMins,
      habitDoneTotal,
      factualLines,
    };
  }, [state.activityRecords, state.habitLogs, state.settings, reviewMonday]);

  const pillarSummary = useMemo(
    () =>
      calculatePillarInsightsSummary({
        startDate,
        endDate,
        activityRecords: state.activityRecords,
        devotionEntries: state.devotionEntries,
        bibleStudies: state.bibleStudies,
        workoutLogs: state.workoutLogs,
        cardioLogs: state.cardioLogs,
        beholdWeeks: state.beholdWeeks,
      }),
    [
      startDate,
      endDate,
      state.activityRecords,
      state.devotionEntries,
      state.bibleStudies,
      state.workoutLogs,
      state.cardioLogs,
      state.beholdWeeks,
    ]
  );

  const activeConflicts =
    mode === 'planned'
      ? analytics.plannedConflicts
      : analytics.actualConflicts;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Insights &amp; Review
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            See clearly where your time is actually going vs what was planned.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 self-start">
          <button
            onClick={() => setTab('analytics')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              tab === 'analytics'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5" /> Time Analytics
          </button>
          <button
            onClick={() => setTab('review')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              tab === 'review'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Sunday Review
          </button>
        </div>
      </div>

      {/* TAB 1: TIME ANALYTICS */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Date Range Selector */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'today', label: 'Today' },
                    { id: 'thisWeek', label: 'This week' },
                    { id: 'lastWeek', label: 'Last week' },
                    { id: 'weekA', label: 'Week A' },
                    { id: 'weekB', label: 'Week B' },
                    { id: 'last14', label: 'Last 14 days' },
                    { id: 'thisMonth', label: 'This month' },
                    { id: 'custom', label: 'Custom' },
                  ] as const
                ).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setPreset(r.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                      preset === r.id
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Planned vs Actual View Selector */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900">
                {(
                  [
                    { id: 'actual', label: 'Actual time' },
                    { id: 'planned', label: 'Planned time' },
                    { id: 'compare', label: 'Planned vs Actual' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                      mode === m.id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {preset === 'custom' && (
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs text-slate-500">From</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                />
                <label className="text-xs text-slate-500">To</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {formatShortDate(startDate)} – {formatShortDate(endDate)} ·{' '}
                {dayCount} {dayCount === 1 ? 'day' : 'days'} (
                {formatHoursDecimal(totalWindowMinutes)} total)
                {analytics.demoCount > 0 && (
                  <span className="ml-2 text-amber-700 dark:text-amber-300 font-sans">
                    · Includes tagged sample logs
                  </span>
                )}
              </div>

              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={discretionaryOnly}
                  onChange={(e) => setDiscretionaryOnly(e.target.checked)}
                  className="rounded"
                />
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  Discretionary time only (exclude sleep &amp; compulsory
                  school hours)
                </span>
              </label>
            </div>
          </div>

          {/* Overlap Conflict Alert */}
          {activeConflicts.length > 0 && (
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    {activeConflicts.length} overlapping time{' '}
                    {activeConflicts.length === 1 ? 'entry' : 'entries'} flagged
                    (double-counting prevented in totals)
                  </p>
                  <p className="mt-0.5 opacity-90">
                    {activeConflicts[0].date}: &ldquo;
                    {activeConflicts[0].firstTitle}&rdquo; overlaps &ldquo;
                    {activeConflicts[0].secondTitle}&rdquo; by{' '}
                    {formatDuration(activeConflicts[0].overlapMinutes)}.
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setActiveSection(mode === 'planned' ? 'calendar' : 'track')
                }
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-900 text-white dark:bg-amber-200 dark:text-amber-950 shrink-0"
              >
                Resolve conflict
              </button>
            </div>
          )}

          {/* Empty state notice if Actual mode has 0 logs */}
          {mode === 'actual' && analytics.deduplicatedActualMinutes === 0 && (
            <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold">
                  No actual time logged in this window yet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  LifeHQ never fabricates actual hours from scheduled events.
                  Confirm an activity on Today, run a timer, switch to Planned
                  time, or load clearly tagged sample logs to preview charts.
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setMode('planned')}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
                >
                  View planned time
                </button>
                <button
                  onClick={loadDemoSampleLogs}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 whitespace-nowrap"
                >
                  Load sample logs
                </button>
              </div>
            </div>
          )}

          {/* KPI Summary Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === 'planned' ? 'Planned time' : 'Actual tracked'}
              </p>
              <p className="text-2xl font-semibold font-mono tabular-nums mt-1">
                {formatHoursDecimal(
                  mode === 'planned'
                    ? analytics.deduplicatedPlannedMinutes
                    : analytics.deduplicatedActualMinutes
                )}
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Untracked hours
              </p>
              <p className="text-2xl font-semibold font-mono tabular-nums mt-1">
                {formatHoursDecimal(analytics.untrackedMinutes)}
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Planned total
              </p>
              <p className="text-2xl font-semibold font-mono tabular-nums mt-1">
                {formatHoursDecimal(analytics.deduplicatedPlannedMinutes)}
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Actual vs planned
              </p>
              <p className="text-2xl font-semibold font-mono tabular-nums mt-1">
                {analytics.deduplicatedActualMinutes -
                  analytics.deduplicatedPlannedMinutes >=
                0
                  ? '+'
                  : ''}
                {formatHoursDecimal(
                  analytics.deduplicatedActualMinutes -
                    analytics.deduplicatedPlannedMinutes
                )}
              </p>
            </div>
          </div>

          {/* Three-Pillar Recorded Indicators (100% Real Data) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getCategoryMeta('faith').colour }}
                  />
                  Faith Development
                </span>
                <button
                  type="button"
                  onClick={() => openPillar('faith')}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white underline"
                >
                  Open
                </button>
              </div>
              <p className="text-sm font-mono tabular-nums font-semibold">
                {pillarSummary.faith.totalDevotionEntries} devotion check-ins ·{' '}
                {pillarSummary.faith.completedStudies}/
                {pillarSummary.faith.totalStudies} studies
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {pillarSummary.faith.morningCount} morning ·{' '}
                {pillarSummary.faith.eveningCount} evening · Active:{' '}
                {pillarSummary.faith.activeStudyLabel}
              </p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getCategoryMeta('fitness').colour }}
                  />
                  Fitness &amp; Conditioning
                </span>
                <button
                  type="button"
                  onClick={() => openPillar('fitness')}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white underline"
                >
                  Open
                </button>
              </div>
              <p className="text-sm font-mono tabular-nums font-semibold">
                {pillarSummary.fitness.strengthSessionsLogged} workouts ·{' '}
                {pillarSummary.fitness.cardioEnduranceCount +
                  pillarSummary.fitness.cardioSprintCount}{' '}
                cardio
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Volume {pillarSummary.fitness.totalSetVolumeKg.toLocaleString()}{' '}
                kg · Actual {formatHoursDecimal(pillarSummary.fitness.actualMinutes)}
              </p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getCategoryMeta('behold').colour }}
                  />
                  Creative Craft &amp; Projects
                </span>
                <button
                  type="button"
                  onClick={() => openPillar('behold')}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white underline"
                >
                  Open
                </button>
              </div>
              <p className="text-sm font-mono tabular-nums font-semibold">
                {pillarSummary.behold.completedWeeks}/
                {pillarSummary.behold.totalWeeks} weeks complete
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {pillarSummary.behold.portfolioReadyCount} portfolio-ready ·{' '}
                {pillarSummary.behold.clientMappedCount} client-linked ·{' '}
                {formatHoursDecimal(pillarSummary.behold.actualMinutes)}
              </p>
            </div>
          </div>

          {/* Main Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Doughnut / Pie Chart */}
            <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-base font-semibold">
                    {mode === 'planned'
                      ? 'Planned Time Allocation'
                      : 'Actual Time Allocation'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Untracked hours are shown explicitly, never labelled free
                    time.
                  </p>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.pieData}
                      dataKey="hours"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={98}
                      paddingAngle={2}
                    >
                      {analytics.pieData.map((entry) => (
                        <Cell key={entry.id} fill={entry.colour} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name) => [
                        `${val ?? 0}h`,
                        String(name ?? ''),
                      ]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #334155',
                        backgroundColor: '#0f172a',
                        color: '#f8fafc',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Accessible Interactive Legend & Subcategory Drilldown */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
                {CATEGORIES.map((c) => {
                  const mins =
                    mode === 'planned'
                      ? analytics.plannedByCat[c.id]
                      : analytics.actualByCat[c.id];
                  const pct = (
                    (mins /
                      (discretionaryOnly
                        ? Math.max(
                            1,
                            Object.values(
                              mode === 'planned'
                                ? analytics.plannedByCat
                                : analytics.actualByCat
                            ).reduce((a, b) => a + b, 0)
                          )
                        : totalWindowMinutes)) *
                    100
                  ).toFixed(1);
                  const isOpen = expandedCategory === c.id;
                  const subs = Object.entries(analytics.subcatMap[c.id]);

                  return (
                    <div key={c.id} className="py-2">
                      <button
                        onClick={() =>
                          setExpandedCategory(isOpen ? null : c.id)
                        }
                        className="w-full flex items-center justify-between text-xs py-1 hover:opacity-80"
                      >
                        <span className="flex items-center gap-2 font-medium">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{
                              backgroundColor: getCategoryMeta(c.id).colour,
                            }}
                          />
                          {c.label}
                        </span>
                        <span className="flex items-center gap-2 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {formatHoursDecimal(mins)} ({pct}%)
                          {subs.length > 0 &&
                            (isOpen ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ))}
                        </span>
                      </button>

                      {isOpen && subs.length > 0 && (
                        <div className="pl-5 pt-1 pb-1.5 space-y-1">
                          {subs.map(([subName, subMins]) => (
                            <div
                              key={subName}
                              className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400"
                            >
                              <span>{subName}</span>
                              <span className="font-mono tabular-nums">
                                {formatDuration(subMins)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {!discretionaryOnly && (
                  <div className="py-2.5 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" />
                      Untracked
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatHoursDecimal(analytics.untrackedMinutes)} (
                      {(
                        (analytics.untrackedMinutes / totalWindowMinutes) *
                        100
                      ).toFixed(1)}
                      %)
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Planned vs Actual + Daily Trend Charts */}
            <div className="space-y-6">
              <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-4 h-4 text-slate-500" />
                  <h2 className="text-base font-semibold">
                    Planned vs Actual by Category
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Hours scheduled vs hours confirmed completed.
                </p>

                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.comparisonData}
                      margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#94a3b8"
                        opacity={0.2}
                      />
                      <XAxis
                        dataKey="category"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #334155',
                          backgroundColor: '#0f172a',
                          color: '#f8fafc',
                          fontSize: '12px',
                        }}
                      />
                      <Bar
                        dataKey="planned"
                        name="Planned (h)"
                        fill="#94a3b8"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="actual"
                        name="Actual (h)"
                        fill="#4A7C9B"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5">
                <h2 className="text-base font-semibold mb-1">
                  Daily Hours Trend
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Day-by-day planned vs actual tracked hours across this period.
                </p>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.dailyTrend}
                      margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#94a3b8"
                        opacity={0.2}
                      />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #334155',
                          backgroundColor: '#0f172a',
                          color: '#f8fafc',
                          fontSize: '12px',
                        }}
                      />
                      <Bar
                        dataKey="plannedHours"
                        name="Planned (h)"
                        fill="#cbd5e1"
                        radius={[3, 3, 0, 0]}
                      />
                      <Bar
                        dataKey="actualHours"
                        name="Actual (h)"
                        fill="#5C8D76"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FIVE-MINUTE SUNDAY REVIEW */}
      {tab === 'review' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  Five-Minute Sunday Review
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Factual snapshot generated directly from your stored records.
                </p>
              </div>
              <select
                value={reviewMonday}
                onChange={(e) => handleReviewWeekChange(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
              >
                {[0, -7, -14, -21].map((offset) => {
                  const mon = addDays(currentMonday, offset);
                  return (
                    <option key={mon} value={mon}>
                      w/c {formatShortDate(mon)} (Week{' '}
                      {getWeekType(mon, state.settings)})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Factual Auto-Generated Summary */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 p-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Weekly Factual Summary
              </h3>
              <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                {reviewSummary.factualLines.map((line, i) => (
                  <li key={i} className="leading-relaxed">
                    • {line}
                  </li>
                ))}
              </ul>
            </div>

            {/* Three Optional Reflection Questions */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveWeeklyReview({
                  weekMonday: reviewMonday,
                  wentWell,
                  difficultOrDraining,
                  changeNextWeek,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  1. What went well this week?
                </label>
                <textarea
                  rows={2}
                  value={wentWell}
                  onChange={(e) => setWentWell(e.target.value)}
                  placeholder="Optional reflection..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  2. What was difficult or draining?
                </label>
                <textarea
                  rows={2}
                  value={difficultOrDraining}
                  onChange={(e) => setDifficultOrDraining(e.target.value)}
                  placeholder="Optional reflection..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  3. What should change next week?
                </label>
                <textarea
                  rows={2}
                  value={changeNextWeek}
                  onChange={(e) => setChangeNextWeek(e.target.value)}
                  placeholder="Optional adjustment..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                />
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-2 min-h-[42px] px-5 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              >
                <CheckCircle2 className="w-4 h-4" /> Save Sunday Review
              </button>
            </form>
          </section>

          <aside className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4">
            <h3 className="text-base font-semibold">Saved Reflections</h3>
            {state.weeklyReviews.length === 0 ? (
              <p className="text-xs text-slate-500">
                No past reviews saved yet. Complete your first five-minute
                review on the left.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {state.weeklyReviews.map((rev) => (
                  <div key={rev.weekMonday} className="py-3 first:pt-0 space-y-1">
                    <button
                      onClick={() => handleReviewWeekChange(rev.weekMonday)}
                      className="text-xs font-semibold hover:underline"
                    >
                      w/c {formatShortDate(rev.weekMonday)}
                    </button>
                    {rev.wentWell && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                        + {rev.wentWell}
                      </p>
                    )}
                    {rev.changeNextWeek && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        → {rev.changeNextWeek}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};
