import {
  ActivityRecord,
  AppSettings,
  CalendarEvent,
  CategoryId,
  EventOccurrence,
  Habit,
  HabitFrequency,
  HabitLog,
  HabitLogStatus,
} from '../types/lifehq';
import {
  addDays,
  formatDuration,
  getIsoWeekday,
  getMondayOfWeek,
  getSundayOfWeek,
  getWeekDates,
  isSchoolHoliday,
} from './dateUtils';
import { expandEventsForRange } from './recurrence';

export interface StarterHabitTemplate {
  templateKey: string;
  legacySeedId: string;
  matchKeywords: string[];
  title: string;
  category: CategoryId;
  frequency: HabitFrequency;
  weeklyTarget: number;
  daysOfWeek?: number[];
  targetMinutes?: number;
  targetQuantity?: number;
  targetUnit?: string;
  cue: string;
  twoMinuteRule: string;
  stackAnchorEventId?: string;
  stackAnchorLabel?: string;
  stackAction?: string;
  preferredWindowStart?: string;
  preferredWindowEnd?: string;
  linkedEventIds: string[];
  notes: string;
}

export const STARTER_HABIT_TEMPLATES: StarterHabitTemplate[] = [
  {
    templateKey: 'starter-devotion',
    legacySeedId: 'starter-habit-devotion',
    matchKeywords: ['scripture', 'devotion', 'prayer', 'reading'],
    title: 'Morning reflection & prayer',
    category: 'faith',
    frequency: 'daily',
    weeklyTarget: 7,
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    targetMinutes: 15,
    cue: 'Soon after waking up and hydrating',
    twoMinuteRule: 'Read one short passage or devotional note',
    stackAnchorLabel: 'Waking up & hydrating',
    stackAction: 'read a short passage, reflect, and pray',
    preferredWindowStart: '07:00',
    preferredWindowEnd: '07:20',
    linkedEventIds: [],
    notes: 'Consistent daily rhythm, kept gentle when schedule shifts.',
  },
  {
    templateKey: 'starter-gym',
    legacySeedId: 'starter-habit-gym',
    matchKeywords: ['gym', 'strength', 'training', 'workout'],
    title: 'Strength training sessions',
    category: 'fitness',
    frequency: 'weekly',
    weeklyTarget: 3,
    daysOfWeek: [1, 3, 5],
    targetMinutes: 60,
    cue: 'After finishing main work commitments',
    twoMinuteRule: 'Put on training clothes and warm up for 2 minutes',
    stackAnchorLabel: 'Finishing work',
    stackAction: 'change into training kit and begin warm-up',
    preferredWindowStart: '17:00',
    preferredWindowEnd: '18:30',
    linkedEventIds: [],
    notes: 'Focused compound strength work with steady progression.',
  },
  {
    templateKey: 'starter-behold',
    legacySeedId: 'starter-habit-creative',
    matchKeywords: ['creative', 'practice', 'craft', 'project'],
    title: 'Focused creative practice',
    category: 'behold',
    frequency: 'weekly',
    weeklyTarget: 3,
    daysOfWeek: [2, 4, 6],
    targetMinutes: 60,
    cue: 'Dedicated creative study or build block',
    twoMinuteRule: 'Open your active project workspace and outline one step',
    preferredWindowStart: '18:00',
    preferredWindowEnd: '19:30',
    linkedEventIds: [],
    notes: 'Deliberate skill practice and steady project output.',
  },
  {
    templateKey: 'starter-teaching',
    legacySeedId: 'starter-habit-prep',
    matchKeywords: ['prep', 'planning', 'organisation'],
    title: 'Advance work preparation',
    category: 'teaching',
    frequency: 'weekly',
    weeklyTarget: 3,
    daysOfWeek: [1, 3, 5],
    targetMinutes: 45,
    cue: 'During scheduled planning windows',
    twoMinuteRule: 'Review tomorrow’s top 3 priorities and open notes',
    linkedEventIds: [],
    notes: 'Protect evenings by preparing key materials during work hours.',
  },
  {
    templateKey: 'starter-reflection',
    legacySeedId: 'starter-habit-reflection',
    matchKeywords: ['reflection', 'weekly review', 'sunday reflection'],
    title: 'Weekly reflection and planning',
    category: 'personal',
    frequency: 'custom',
    weeklyTarget: 1,
    daysOfWeek: [7],
    targetMinutes: 30,
    cue: 'Weekend afternoon check-in',
    twoMinuteRule: 'Open Weekly Review and record one win from this week',
    preferredWindowStart: '16:00',
    preferredWindowEnd: '16:30',
    linkedEventIds: [],
    notes: 'Brief weekly review and calm plan for the coming week.',
  },
];

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function findMatchingHabitForTemplate(
  template: StarterHabitTemplate,
  habits: Habit[]
): Habit | undefined {
  const byTemplateOrId = habits.find(
    (h) =>
      h.templateKey === template.templateKey || h.id === template.legacySeedId
  );
  if (byTemplateOrId) return byTemplateOrId;

  return habits.find((h) => {
    if (h.category !== template.category) return false;
    const norm = h.title.toLowerCase();
    return template.matchKeywords.some((kw) => norm.includes(kw));
  });
}

export function formatHabitScheduleLabel(habit: Habit): string {
  if (habit.frequency === 'daily') {
    if (habit.daysOfWeek && habit.daysOfWeek.length > 0 && habit.daysOfWeek.length < 7) {
      return habit.daysOfWeek.map((d) => WEEKDAY_SHORT[d - 1] ?? '').join(' · ');
    }
    return 'Daily';
  }
  if (habit.frequency === 'custom') {
    if (habit.daysOfWeek && habit.daysOfWeek.length > 0) {
      return habit.daysOfWeek
        .slice()
        .sort((a, b) => a - b)
        .map((d) => WEEKDAY_SHORT[d - 1] ?? '')
        .join(' · ');
    }
    return `${habit.weeklyTarget}× / week`;
  }
  return `${habit.weeklyTarget}× / week`;
}

export function formatHabitTargetLabel(habit: Habit): string | null {
  if (habit.targetMinutes && habit.targetMinutes > 0) {
    return formatDuration(habit.targetMinutes);
  }
  if (habit.targetQuantity && habit.targetQuantity > 0) {
    return `${habit.targetQuantity}${habit.targetUnit ? ` ${habit.targetUnit}` : ''}`;
  }
  return null;
}

export function formatPreferredWindow(habit: Habit): string | null {
  const start = habit.preferredWindowStart?.trim();
  const end = habit.preferredWindowEnd?.trim();
  if (start && end) return `${start}–${end}`;
  if (start) return `From ${start}`;
  if (end) return `By ${end}`;
  return null;
}

export function getHabitAnchorDisplay(
  habit: Habit,
  events: CalendarEvent[]
): { key: string; label: string; event?: CalendarEvent } | null {
  const ev = habit.stackAnchorEventId
    ? events.find((e) => e.id === habit.stackAnchorEventId)
    : undefined;
  const label = habit.stackAnchorLabel?.trim() || ev?.title || '';
  if (!label && !ev) return null;
  const resolvedLabel = label || ev!.title;
  return {
    key: ev ? `ev:${ev.id}` : `label:${resolvedLabel.toLowerCase()}`,
    label: resolvedLabel,
    event: ev,
  };
}

export function formatHabitStackText(
  habit: Habit,
  events: CalendarEvent[] = []
): string | null {
  const anchor = getHabitAnchorDisplay(habit, events);
  const action = habit.stackAction?.trim();
  if (anchor && action) {
    return `After ${anchor.label}, I will ${action}`;
  }
  if (anchor) {
    return `Stacked after ${anchor.label}`;
  }
  if (action) {
    return action;
  }
  return null;
}

export function isHabitStarterEligible(
  habit: Habit,
  fullLog: HabitLog | null
): boolean {
  return (
    !habit.paused &&
    !habit.archived &&
    Boolean(habit.twoMinuteRule?.trim()) &&
    fullLog?.status !== 'done'
  );
}

export function getHabitStarterAttempt(
  habitId: string,
  dateStr: string,
  habitLogs: HabitLog[]
): HabitLog | null {
  return (
    habitLogs.find(
      (l) =>
        l.habitId === habitId && l.date === dateStr && l.status === 'starter'
    ) ?? null
  );
}

export function getLinkedEventsForHabit(
  habit: Habit,
  events: CalendarEvent[]
): CalendarEvent[] {
  const explicitSet = new Set(habit.linkedEventIds ?? []);
  return events.filter(
    (ev) => ev.linkedHabitId === habit.id || explicitSet.has(ev.id)
  );
}

export function getCreditForStatus(status?: HabitLogStatus): number {
  if (status === 'done') return 1;
  if (status === 'partial') return 0.5;
  return 0;
}

export function getEffectiveHabitLog(
  habit: Habit,
  dateStr: string,
  habitLogs: HabitLog[],
  linkedOccurrencesOnDate: EventOccurrence[]
): HabitLog | null {
  // Starter attempts are stored separately and never count as full habit completion
  const explicit = habitLogs.find(
    (l) =>
      l.habitId === habit.id && l.date === dateStr && l.status !== 'starter'
  );
  if (explicit) return explicit;

  // Check linked calendar event activity records without creating duplicate ActivityRecords
  for (const occ of linkedOccurrencesOnDate) {
    const status = occ.activityRecord?.status;
    if (status === 'completed') {
      return {
        id: `${habit.id}_${dateStr}`,
        habitId: habit.id,
        date: dateStr,
        status: 'done',
        source: 'calendar',
      };
    }
    if (status === 'partial') {
      return {
        id: `${habit.id}_${dateStr}`,
        habitId: habit.id,
        date: dateStr,
        status: 'partial',
        source: 'calendar',
      };
    }
    if (status === 'cancelled') {
      return {
        id: `${habit.id}_${dateStr}`,
        habitId: habit.id,
        date: dateStr,
        status: 'excused',
        source: 'calendar',
        notes: 'Linked calendar commitment cancelled',
      };
    }
    if (status === 'skipped') {
      return {
        id: `${habit.id}_${dateStr}`,
        habitId: habit.id,
        date: dateStr,
        status: 'skipped',
        source: 'calendar',
      };
    }
  }

  return null;
}

export interface DayScheduleCheck {
  scheduled: boolean;
  flexibleWeeklyDue: boolean;
  linkedOccurrences: EventOccurrence[];
  reason: string;
}

export function isHabitScheduledOnDate(
  habit: Habit,
  dateStr: string,
  events: CalendarEvent[],
  settings: AppSettings,
  occurrencesByDate?: Map<string, EventOccurrence[]>
): DayScheduleCheck {
  if (habit.paused || habit.archived) {
    return {
      scheduled: false,
      flexibleWeeklyDue: false,
      linkedOccurrences: [],
      reason: habit.archived ? 'Archived' : 'Paused',
    };
  }
  if (habit.createdAt && dateStr < habit.createdAt) {
    return {
      scheduled: false,
      flexibleWeeklyDue: false,
      linkedOccurrences: [],
      reason: 'Before habit start date',
    };
  }

  const linkedEvents = getLinkedEventsForHabit(habit, events);
  const linkedIds = new Set(linkedEvents.map((e) => e.id));

  let dayOccurrences: EventOccurrence[];
  if (occurrencesByDate) {
    dayOccurrences = (occurrencesByDate.get(dateStr) ?? []).filter((o) =>
      linkedIds.has(o.eventId)
    );
  } else {
    dayOccurrences = expandEventsForRange(
      linkedEvents,
      dateStr,
      dateStr,
      settings,
      []
    );
  }

  // If habit relies purely on school timetable events and date is a school holiday, exempt automatically
  const allLinkedAreSchool =
    linkedEvents.length > 0 && linkedEvents.every((e) => e.isSchoolTimetable);
  if (allLinkedAreSchool && isSchoolHoliday(dateStr, settings.schoolHolidays)) {
    return {
      scheduled: false,
      flexibleWeeklyDue: false,
      linkedOccurrences: [],
      reason: 'School holiday',
    };
  }

  const iso = getIsoWeekday(dateStr);

  if (habit.frequency === 'daily') {
    const allowed =
      habit.daysOfWeek && habit.daysOfWeek.length > 0
        ? habit.daysOfWeek.includes(iso)
        : true;
    return {
      scheduled: allowed,
      flexibleWeeklyDue: false,
      linkedOccurrences: dayOccurrences,
      reason: allowed ? 'Daily habit' : 'Rest day',
    };
  }

  if (habit.frequency === 'custom') {
    const days = habit.daysOfWeek ?? [];
    const allowed = days.includes(iso);
    return {
      scheduled: allowed,
      flexibleWeeklyDue: false,
      linkedOccurrences: dayOccurrences,
      reason: allowed ? 'Scheduled weekday' : 'Not scheduled today',
    };
  }

  // Weekly frequency habit: strictly scheduled if a linked calendar event falls today
  // or if user selected preferred daysOfWeek; otherwise marked flexibleWeeklyDue.
  if (dayOccurrences.length > 0) {
    return {
      scheduled: true,
      flexibleWeeklyDue: false,
      linkedOccurrences: dayOccurrences,
      reason: 'Linked calendar session',
    };
  }
  if (habit.daysOfWeek && habit.daysOfWeek.length > 0) {
    const preferred = habit.daysOfWeek.includes(iso);
    return {
      scheduled: preferred,
      flexibleWeeklyDue: !preferred,
      linkedOccurrences: [],
      reason: preferred ? 'Preferred day' : 'Flexible weekly slot',
    };
  }

  return {
    scheduled: false,
    flexibleWeeklyDue: true,
    linkedOccurrences: [],
    reason: 'Flexible weekly target',
  };
}

export interface HabitStats {
  todayLog: HabitLog | null;
  todayStarterAttempt: HabitLog | null;
  todaySchedule: DayScheduleCheck;
  showOnToday: boolean;
  weekCredits: number;
  weekDoneCount: number;
  weekPartialCount: number;
  weekExcusedCount: number;
  weekEffectiveTarget: number;
  weekPct: number | null;
  consistency7d: number | null;
  credits7d: number;
  opportunities7d: number;
  consistency30d: number | null;
  credits30d: number;
  opportunities30d: number;
  starterAttempts7d: number;
  starterAttempts30d: number;
  currentStreak: number;
  longestStreak: number;
}

function buildOccurrencesMap(
  events: CalendarEvent[],
  startDate: string,
  endDate: string,
  settings: AppSettings,
  activityRecords: ActivityRecord[]
): Map<string, EventOccurrence[]> {
  const occs = expandEventsForRange(
    events,
    startDate,
    endDate,
    settings,
    activityRecords
  );
  const map = new Map<string, EventOccurrence[]>();
  for (const occ of occs) {
    const list = map.get(occ.date) ?? [];
    list.push(occ);
    map.set(occ.date, list);
  }
  return map;
}

function getHabitBaselineDate(
  habit: Habit,
  todayStr: string,
  habitLogs: HabitLog[],
  settings: AppSettings
): string {
  if (habit.createdAt) return habit.createdAt;
  const logsForHabit = habitLogs
    .filter((l) => l.habitId === habit.id)
    .map((l) => l.date)
    .sort();
  let baseline = settings.weekAnchorMonday <= todayStr
    ? settings.weekAnchorMonday
    : todayStr;
  if (logsForHabit.length > 0 && logsForHabit[0] < baseline) {
    baseline = logsForHabit[0];
  }
  return baseline;
}

function evaluateWindow(
  habit: Habit,
  windowStart: string,
  windowEnd: string,
  baselineDate: string,
  habitLogs: HabitLog[],
  events: CalendarEvent[],
  settings: AppSettings,
  occMap: Map<string, EventOccurrence[]>
): { credits: number; opportunities: number; pct: number | null } {
  if (habit.paused || habit.archived) {
    return { credits: 0, opportunities: 0, pct: null };
  }
  const effectiveStart = windowStart > baselineDate ? windowStart : baselineDate;
  if (effectiveStart > windowEnd) {
    return { credits: 0, opportunities: 0, pct: null };
  }

  // Iterate dates from effectiveStart to windowEnd inclusive
  const dates: string[] = [];
  let cursor = effectiveStart;
  while (cursor <= windowEnd) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  let credits = 0;
  let excusedCount = 0;
  let explicitScheduledOpps = 0;

  for (const d of dates) {
    const sched = isHabitScheduledOnDate(habit, d, events, settings, occMap);
    const log = getEffectiveHabitLog(habit, d, habitLogs, sched.linkedOccurrences);
    if (log?.status === 'excused') {
      excusedCount++;
      continue;
    }
    credits += getCreditForStatus(log?.status);
    if (sched.scheduled) {
      explicitScheduledOpps++;
    } else if (log && (log.status === 'done' || log.status === 'partial' || log.status === 'skipped')) {
      // If user explicitly logged on a flexible day for daily/custom, count cleanly
      if (habit.frequency !== 'weekly') {
        explicitScheduledOpps++;
      }
    }
  }

  let opportunities = explicitScheduledOpps;
  if (habit.frequency === 'weekly') {
    // Expected opportunities over active days based on weeklyTarget, minus excused occurrences,
    // and never smaller than actual scheduled events encountered in the window.
    const prorated = Math.round((dates.length / 7) * habit.weeklyTarget);
    const baseExpected = Math.max(explicitScheduledOpps, prorated);
    opportunities = Math.max(0, baseExpected - excusedCount);
    // Do not show 0 opportunities if user already completed sessions in the window
    if (credits > 0 && opportunities < credits) {
      opportunities = Math.ceil(credits);
    }
  }

  const pct =
    opportunities > 0
      ? Math.min(100, Math.round((credits / opportunities) * 100))
      : null;

  return { credits, opportunities, pct };
}

export function calculateHabitStats(
  habit: Habit,
  todayStr: string,
  habitLogs: HabitLog[],
  events: CalendarEvent[],
  settings: AppSettings,
  activityRecords: ActivityRecord[],
  sharedOccMap?: Map<string, EventOccurrence[]>
): HabitStats {
  const start30 = addDays(todayStr, -29);
  const weekMonday = getMondayOfWeek(todayStr);
  const weekSunday = getSundayOfWeek(todayStr);
  const mapStart = start30 < weekMonday ? start30 : weekMonday;
  const mapEnd = weekSunday > todayStr ? weekSunday : todayStr;

  const occMap =
    sharedOccMap ??
    buildOccurrencesMap(events, mapStart, mapEnd, settings, activityRecords);

  const baseline = getHabitBaselineDate(habit, todayStr, habitLogs, settings);
  const todaySchedule = isHabitScheduledOnDate(
    habit,
    todayStr,
    events,
    settings,
    occMap
  );
  const todayLog = getEffectiveHabitLog(
    habit,
    todayStr,
    habitLogs,
    todaySchedule.linkedOccurrences
  );
  const todayStarterAttempt = getHabitStarterAttempt(
    habit.id,
    todayStr,
    habitLogs
  );

  // Current week summary (Mon..Sun)
  const weekDates = getWeekDates(weekMonday);
  let weekCredits = 0;
  let weekDoneCount = 0;
  let weekPartialCount = 0;
  let weekExcusedCount = 0;
  let weekScheduledUpToToday = 0;

  for (const d of weekDates) {
    const sched = isHabitScheduledOnDate(habit, d, events, settings, occMap);
    const log = getEffectiveHabitLog(habit, d, habitLogs, sched.linkedOccurrences);
    if (log?.status === 'excused') {
      weekExcusedCount++;
      continue;
    }
    if (log?.status === 'done') {
      weekDoneCount++;
      weekCredits += 1;
    } else if (log?.status === 'partial') {
      weekPartialCount++;
      weekCredits += 0.5;
    }
    if (d <= todayStr && d >= baseline && sched.scheduled) {
      weekScheduledUpToToday++;
    }
  }

  const weekEffectiveTarget = habit.paused || habit.archived
    ? 0
    : habit.frequency === 'weekly'
    ? Math.max(0, habit.weeklyTarget - weekExcusedCount)
    : Math.max(weekScheduledUpToToday, Math.max(0, habit.weeklyTarget - weekExcusedCount));

  const weekPct =
    habit.paused || habit.archived
      ? null
      : habit.frequency === 'weekly'
      ? weekEffectiveTarget > 0
        ? Math.min(100, Math.round((weekCredits / weekEffectiveTarget) * 100))
        : 100
      : weekScheduledUpToToday > 0
      ? Math.min(100, Math.round((weekCredits / weekScheduledUpToToday) * 100))
      : null;

  const win7 = evaluateWindow(
    habit,
    addDays(todayStr, -6),
    todayStr,
    baseline,
    habitLogs,
    events,
    settings,
    occMap
  );
  const win30 = evaluateWindow(
    habit,
    start30,
    todayStr,
    baseline,
    habitLogs,
    events,
    settings,
    occMap
  );

  // Secondary streak calculation (excused/rest/holidays preserve streak without breaking)
  let currentStreak = 0;
  let longestStreak = 0;
  if (!habit.archived) {
    const streakStart = baseline < start30 ? baseline : start30;
    const streakDates: string[] = [];
    let c = streakStart;
    while (c <= todayStr) {
      streakDates.push(c);
      c = addDays(c, 1);
    }

    if (habit.frequency === 'weekly') {
      // Consecutive weeks meeting target, OR consecutive logged completions if still in first week
      let running = 0;
      for (const d of streakDates) {
        const sched = isHabitScheduledOnDate(habit, d, events, settings, occMap);
        const log = getEffectiveHabitLog(habit, d, habitLogs, sched.linkedOccurrences);
        if (log?.status === 'done' || log?.status === 'partial') {
          running++;
          longestStreak = Math.max(longestStreak, running);
        } else if (log?.status === 'skipped') {
          running = 0;
        } else if (sched.scheduled && d < todayStr && log?.status !== 'excused') {
          running = 0;
        }
      }
      currentStreak = running;
    } else {
      let running = 0;
      for (const d of streakDates) {
        const sched = isHabitScheduledOnDate(habit, d, events, settings, occMap);
        const log = getEffectiveHabitLog(habit, d, habitLogs, sched.linkedOccurrences);
        if (log?.status === 'excused') {
          // Excused days never penalise or break streaks
          continue;
        }
        if (log?.status === 'done' || log?.status === 'partial') {
          running++;
          longestStreak = Math.max(longestStreak, running);
        } else if (log?.status === 'skipped') {
          running = 0;
        } else if (sched.scheduled && d < todayStr) {
          running = 0;
        }
      }
      currentStreak = running;
    }
  }

  const start7 = addDays(todayStr, -6);
  const starterAttempts7d = habitLogs.filter(
    (l) =>
      l.habitId === habit.id &&
      l.status === 'starter' &&
      l.date >= start7 &&
      l.date <= todayStr
  ).length;
  const starterAttempts30d = habitLogs.filter(
    (l) =>
      l.habitId === habit.id &&
      l.status === 'starter' &&
      l.date >= start30 &&
      l.date <= todayStr
  ).length;

  const showOnToday =
    !habit.paused &&
    !habit.archived &&
    (todaySchedule.scheduled ||
      Boolean(todayLog) ||
      Boolean(todayStarterAttempt) ||
      (habit.frequency === 'weekly' && weekCredits < habit.weeklyTarget));

  return {
    todayLog,
    todayStarterAttempt,
    todaySchedule,
    showOnToday,
    weekCredits,
    weekDoneCount,
    weekPartialCount,
    weekExcusedCount,
    weekEffectiveTarget,
    weekPct,
    consistency7d: win7.pct,
    credits7d: win7.credits,
    opportunities7d: win7.opportunities,
    consistency30d: win30.pct,
    credits30d: win30.credits,
    opportunities30d: win30.opportunities,
    starterAttempts7d,
    starterAttempts30d,
    currentStreak,
    longestStreak,
  };
}

export interface AggregateHabitSummary {
  activeCount: number;
  archivedCount: number;
  todayCredits: number;
  todayScheduledCount: number;
  todayStarterCount: number;
  todayPct: number | null;
  weeklyPct: number | null;
  consistency30dPct: number | null;
  statsById: Map<string, HabitStats>;
}

export function calculateAggregateHabitSummary(
  habits: Habit[],
  todayStr: string,
  habitLogs: HabitLog[],
  events: CalendarEvent[],
  settings: AppSettings,
  activityRecords: ActivityRecord[]
): AggregateHabitSummary {
  const start30 = addDays(todayStr, -29);
  const weekMonday = getMondayOfWeek(todayStr);
  const weekSunday = getSundayOfWeek(todayStr);
  const mapStart = start30 < weekMonday ? start30 : weekMonday;
  const mapEnd = weekSunday > todayStr ? weekSunday : todayStr;
  const sharedOccMap = buildOccurrencesMap(
    events,
    mapStart,
    mapEnd,
    settings,
    activityRecords
  );

  const statsById = new Map<string, HabitStats>();
  let activeCount = 0;
  let archivedCount = 0;
  let todayCredits = 0;
  let todayScheduledCount = 0;
  let todayStarterCount = 0;
  let weekCreditsSum = 0;
  let weekOppSum = 0;
  let credits30Sum = 0;
  let opps30Sum = 0;

  for (const h of habits) {
    if (h.archived) {
      archivedCount++;
    } else {
      activeCount++;
    }
    const st = calculateHabitStats(
      h,
      todayStr,
      habitLogs,
      events,
      settings,
      activityRecords,
      sharedOccMap
    );
    statsById.set(h.id, st);

    if (!h.paused && !h.archived) {
      if (st.todayStarterAttempt) {
        todayStarterCount++;
      }

      // Today's progress counts scheduled habits today (excluding excused)
      const isExcusedToday = st.todayLog?.status === 'excused';
      if (
        !isExcusedToday &&
        (st.todaySchedule.scheduled ||
          (st.todayLog &&
            (st.todayLog.status === 'done' ||
              st.todayLog.status === 'partial' ||
              st.todayLog.status === 'skipped')))
      ) {
        todayScheduledCount++;
        todayCredits += getCreditForStatus(st.todayLog?.status);
      }

      if (st.opportunities7d > 0) {
        weekCreditsSum += Math.min(st.credits7d, st.opportunities7d);
        weekOppSum += st.opportunities7d;
      }
      if (st.opportunities30d > 0) {
        credits30Sum += Math.min(st.credits30d, st.opportunities30d);
        opps30Sum += st.opportunities30d;
      }
    }
  }

  return {
    activeCount,
    archivedCount,
    todayCredits,
    todayScheduledCount,
    todayStarterCount,
    todayPct:
      todayScheduledCount > 0
        ? Math.min(100, Math.round((todayCredits / todayScheduledCount) * 100))
        : null,
    weeklyPct:
      weekOppSum > 0
        ? Math.min(100, Math.round((weekCreditsSum / weekOppSum) * 100))
        : null,
    consistency30dPct:
      opps30Sum > 0
        ? Math.min(100, Math.round((credits30Sum / opps30Sum) * 100))
        : null,
    statsById,
  };
}
