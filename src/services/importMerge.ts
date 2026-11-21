import {
  ActivityRecord,
  AppSettings,
  AppState,
  BeholdWeekItem,
  BibleStudyNote,
  CalendarEvent,
  CardioSessionLog,
  DevotionEntry,
  FitnessConfig,
  Goal,
  Habit,
  HabitLog,
  HolidayRange,
  PriorityTask,
  WeeklyReviewEntry,
  WorkoutPlanSession,
  WorkoutSessionLog,
} from '../types/lifehq';
import { migrateAppState } from './migration';

export type ImportMergeMode = 'merge-safe' | 'merge-overwrite' | 'replace-all';

export interface ImportDomainCounts {
  events: number;
  activityRecords: number;
  priorities: number;
  habits: number;
  habitLogs: number;
  goals: number;
  weeklyReviews: number;
  devotionEntries: number;
  bibleStudies: number;
  workoutLogs: number;
  cardioLogs: number;
  beholdWeeks: number;
  holidays: number;
  workoutPlans: number;
}

export interface ImportPreviewSummary {
  counts: ImportDomainCounts;
  currentCounts: ImportDomainCounts;
  duplicateIdsCount: number;
  duplicateSignatureCount: number;
  totalIncomingItems: number;
  weekAnchorMonday: string;
  weekAnchorType: 'A' | 'B';
  holidaysSummary: string[];
  sampleTitles: {
    events: string[];
    habits: string[];
    goals: string[];
    studies: string[];
    behold: string[];
  };
}

const RECOGNIZED_STATE_KEYS = [
  'events',
  'activityRecords',
  'priorities',
  'habits',
  'habitLogs',
  'goals',
  'weeklyReviews',
  'devotionEntries',
  'bibleStudies',
  'workoutLogs',
  'cardioLogs',
  'beholdWeeks',
  'fitnessConfig',
  'settings',
];

function pickKnownAppStateFields(
  obj: Record<string, unknown>
): Partial<AppState> {
  return {
    version: typeof obj.version === 'number' ? obj.version : 3,
    events: Array.isArray(obj.events)
      ? (obj.events as CalendarEvent[])
      : undefined,
    activityRecords: Array.isArray(obj.activityRecords)
      ? (obj.activityRecords as ActivityRecord[])
      : undefined,
    activeTimer:
      obj.activeTimer && typeof obj.activeTimer === 'object'
        ? (obj.activeTimer as AppState['activeTimer'])
        : null,
    priorities: Array.isArray(obj.priorities)
      ? (obj.priorities as PriorityTask[])
      : undefined,
    habits: Array.isArray(obj.habits) ? (obj.habits as Habit[]) : undefined,
    habitLogs: Array.isArray(obj.habitLogs)
      ? (obj.habitLogs as HabitLog[])
      : undefined,
    goals: Array.isArray(obj.goals) ? (obj.goals as Goal[]) : undefined,
    weeklyReviews: Array.isArray(obj.weeklyReviews)
      ? (obj.weeklyReviews as WeeklyReviewEntry[])
      : undefined,
    devotionEntries: Array.isArray(obj.devotionEntries)
      ? (obj.devotionEntries as DevotionEntry[])
      : undefined,
    bibleStudies: Array.isArray(obj.bibleStudies)
      ? (obj.bibleStudies as BibleStudyNote[])
      : undefined,
    workoutLogs: Array.isArray(obj.workoutLogs)
      ? (obj.workoutLogs as WorkoutSessionLog[])
      : undefined,
    cardioLogs: Array.isArray(obj.cardioLogs)
      ? (obj.cardioLogs as CardioSessionLog[])
      : undefined,
    beholdWeeks: Array.isArray(obj.beholdWeeks)
      ? (obj.beholdWeeks as BeholdWeekItem[])
      : undefined,
    fitnessConfig:
      obj.fitnessConfig && typeof obj.fitnessConfig === 'object'
        ? (obj.fitnessConfig as FitnessConfig)
        : undefined,
    settings:
      obj.settings && typeof obj.settings === 'object'
        ? (obj.settings as AppSettings)
        : undefined,
    migrationMeta:
      obj.migrationMeta && typeof obj.migrationMeta === 'object'
        ? (obj.migrationMeta as AppState['migrationMeta'])
        : undefined,
  };
}

export function parseImportPayload(
  rawInput: unknown
):
  | { ok: true; state: AppState; formatLabel: string }
  | { ok: false; error: string } {
  try {
    let parsed: unknown = rawInput;
    if (typeof rawInput === 'string') {
      if (!rawInput.trim()) {
        return { ok: false, error: 'Backup file is empty.' };
      }
      parsed = JSON.parse(rawInput);
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        ok: false,
        error: 'Backup must be a JSON object exported from LifeHQ.',
      };
    }

    const root = parsed as Record<string, unknown>;
    let candidate = root;
    let formatLabel = 'LifeHQ backup JSON';

    if (
      root.data &&
      typeof root.data === 'object' &&
      !Array.isArray(root.data)
    ) {
      candidate = root.data as Record<string, unknown>;
      formatLabel = 'LifeHQ wrapped JSON backup';
    } else if (root.app === 'LifeHQ' && root.exportedAt) {
      formatLabel = `LifeHQ backup (${String(root.exportedAt).slice(0, 10)})`;
    } else if (!root.app && !root.exportedAt) {
      formatLabel = 'Legacy LifeHQ local snapshot';
    }

    const hasAnyKey = RECOGNIZED_STATE_KEYS.some((k) => k in candidate);
    if (!hasAnyKey) {
      return {
        ok: false,
        error:
          'Recognised LifeHQ collections or settings were not found in this file.',
      };
    }

    const normalized = migrateAppState(pickKnownAppStateFields(candidate));
    return { ok: true, state: normalized, formatLabel };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Could not parse backup JSON: ${err.message}`
          : 'Could not parse backup JSON.',
    };
  }
}

export function countStateDomains(state: AppState): ImportDomainCounts {
  return {
    events: state.events.length,
    activityRecords: state.activityRecords.length,
    priorities: state.priorities.length,
    habits: state.habits.length,
    habitLogs: state.habitLogs.length,
    goals: state.goals.length,
    weeklyReviews: state.weeklyReviews.length,
    devotionEntries: state.devotionEntries.length,
    bibleStudies: state.bibleStudies.length,
    workoutLogs: state.workoutLogs.length,
    cardioLogs: state.cardioLogs.length,
    beholdWeeks: state.beholdWeeks.length,
    holidays: state.settings.schoolHolidays.length,
    workoutPlans: state.fitnessConfig.workoutPlan.length,
  };
}

const normText = (v?: string) => (v ?? '').trim().toLowerCase();

const sigEvent = (e: CalendarEvent) =>
  `${normText(e.title)}|${e.startDate}|${e.startTime}|${e.endTime}|${e.recurrence}`;
const sigHabit = (h: Habit) =>
  `${normText(h.title)}|${h.category}|${h.frequency}`;
const sigGoal = (g: Goal) => `${normText(g.title)}|${g.category}`;
const sigHabitLog = (l: HabitLog) => `${l.habitId}|${l.date}`;
const sigRecord = (r: ActivityRecord) =>
  `${r.date}|${r.startTime}|${normText(r.title)}`;
const sigPriority = (p: PriorityTask) => `${p.date}|${normText(p.title)}`;
const sigWeeklyReview = (w: WeeklyReviewEntry) => w.weekMonday;
const sigDevotion = (d: DevotionEntry) => `${d.date}|${d.routineType}`;
const sigBibleStudy = (b: BibleStudyNote) =>
  `${normText(b.book)}|${normText(b.passage)}`;
const sigWorkoutLog = (w: WorkoutSessionLog) => `${w.date}|${w.sessionKey}`;
const sigCardioLog = (c: CardioSessionLog) => `${c.date}|${c.cardioType}`;
const sigBeholdWeek = (b: BeholdWeekItem) =>
  `w${b.weekNumber}|${normText(b.title)}`;
const sigHoliday = (h: HolidayRange) =>
  `${normText(h.label)}|${h.startDate}|${h.endDate}`;

function countDuplicates<T>(
  current: T[],
  incoming: T[],
  getId: (item: T) => string,
  getSig: (item: T) => string
): { idMatches: number; sigMatches: number } {
  const existingIds = new Set(current.map(getId));
  const existingSigs = new Set(current.map(getSig));
  let idMatches = 0;
  let sigMatches = 0;

  for (const item of incoming) {
    const id = getId(item);
    const sig = getSig(item);
    if (existingIds.has(id)) {
      idMatches++;
    } else if (existingSigs.has(sig)) {
      sigMatches++;
    }
  }
  return { idMatches, sigMatches };
}

export function analyzeImportPreview(
  current: AppState,
  incoming: AppState
): ImportPreviewSummary {
  const counts = countStateDomains(incoming);
  const currentCounts = countStateDomains(current);

  const dupPairs = [
    countDuplicates(current.events, incoming.events, (x) => x.id, sigEvent),
    countDuplicates(
      current.activityRecords,
      incoming.activityRecords,
      (x) => x.id,
      sigRecord
    ),
    countDuplicates(
      current.priorities,
      incoming.priorities,
      (x) => x.id,
      sigPriority
    ),
    countDuplicates(current.habits, incoming.habits, (x) => x.id, sigHabit),
    countDuplicates(
      current.habitLogs,
      incoming.habitLogs,
      (x) => x.id,
      sigHabitLog
    ),
    countDuplicates(current.goals, incoming.goals, (x) => x.id, sigGoal),
    countDuplicates(
      current.weeklyReviews,
      incoming.weeklyReviews,
      (x) => x.weekMonday,
      sigWeeklyReview
    ),
    countDuplicates(
      current.devotionEntries,
      incoming.devotionEntries,
      (x) => x.id,
      sigDevotion
    ),
    countDuplicates(
      current.bibleStudies,
      incoming.bibleStudies,
      (x) => x.id,
      sigBibleStudy
    ),
    countDuplicates(
      current.workoutLogs,
      incoming.workoutLogs,
      (x) => x.id,
      sigWorkoutLog
    ),
    countDuplicates(
      current.cardioLogs,
      incoming.cardioLogs,
      (x) => x.id,
      sigCardioLog
    ),
    countDuplicates(
      current.beholdWeeks,
      incoming.beholdWeeks,
      (x) => x.id,
      sigBeholdWeek
    ),
  ];

  const duplicateIdsCount = dupPairs.reduce((sum, d) => sum + d.idMatches, 0);
  const duplicateSignatureCount = dupPairs.reduce(
    (sum, d) => sum + d.sigMatches,
    0
  );

  const totalIncomingItems =
    counts.events +
    counts.activityRecords +
    counts.priorities +
    counts.habits +
    counts.habitLogs +
    counts.goals +
    counts.weeklyReviews +
    counts.devotionEntries +
    counts.bibleStudies +
    counts.workoutLogs +
    counts.cardioLogs +
    counts.beholdWeeks;

  return {
    counts,
    currentCounts,
    duplicateIdsCount,
    duplicateSignatureCount,
    totalIncomingItems,
    weekAnchorMonday: incoming.settings.weekAnchorMonday,
    weekAnchorType: incoming.settings.weekAnchorType,
    holidaysSummary: incoming.settings.schoolHolidays.map(
      (h) => `${h.label} (${h.startDate} → ${h.endDate})`
    ),
    sampleTitles: {
      events: incoming.events.slice(0, 4).map((e) => e.title),
      habits: incoming.habits.slice(0, 4).map((h) => h.title),
      goals: incoming.goals.slice(0, 4).map((g) => g.title),
      studies: incoming.bibleStudies
        .slice(0, 3)
        .map((s) => (s.passage ? `${s.book} (${s.passage})` : s.book)),
      behold: incoming.beholdWeeks
        .slice(0, 3)
        .map((b) => `Wk ${b.weekNumber}: ${b.title}`),
    },
  };
}

function mergeCollection<T>(
  current: T[],
  incoming: T[],
  mode: ImportMergeMode,
  getId: (item: T) => string,
  getSig: (item: T) => string,
  onOverwrite?: (existing: T, next: T) => T
): T[] {
  if (mode === 'replace-all') {
    // Deduplicate incoming list cleanly while preserving order
    const seenIds = new Set<string>();
    const seenSigs = new Set<string>();
    const out: T[] = [];
    for (const item of incoming) {
      const id = getId(item);
      const sig = getSig(item);
      if (seenIds.has(id) || seenSigs.has(sig)) continue;
      seenIds.add(id);
      seenSigs.add(sig);
      out.push(item);
    }
    return out;
  }

  const out = [...current];
  const idIndex = new Map<string, number>();
  const sigIndex = new Map<string, number>();

  out.forEach((item, idx) => {
    idIndex.set(getId(item), idx);
    sigIndex.set(getSig(item), idx);
  });

  for (const item of incoming) {
    const id = getId(item);
    const sig = getSig(item);
    const matchedIdx = idIndex.has(id)
      ? idIndex.get(id)!
      : sigIndex.get(sig);

    if (matchedIdx !== undefined) {
      if (mode === 'merge-overwrite') {
        const existing = out[matchedIdx];
        out[matchedIdx] = onOverwrite ? onOverwrite(existing, item) : item;
      }
      // In merge-safe, keep existing untouched
    } else {
      const nextIdx = out.length;
      out.push(item);
      idIndex.set(id, nextIdx);
      sigIndex.set(sig, nextIdx);
    }
  }

  return out;
}

function mergeSettingsForImport(
  current: AppSettings,
  incoming: AppSettings,
  mode: ImportMergeMode,
  includeSettings: boolean
): AppSettings {
  if (mode === 'replace-all') {
    return {
      ...incoming,
      weekOverrides: { ...incoming.weekOverrides },
      schoolHolidays: [...incoming.schoolHolidays],
      reminderOptions: { ...incoming.reminderOptions },
      categoryColours: { ...incoming.categoryColours },
    };
  }

  if (!includeSettings) {
    return current;
  }

  const mergedHolidays = mergeCollection(
    current.schoolHolidays,
    incoming.schoolHolidays,
    mode,
    (h) => h.id,
    sigHoliday
  );

  if (mode === 'merge-safe') {
    return {
      ...current,
      weekAnchorMonday: incoming.weekAnchorMonday || current.weekAnchorMonday,
      weekAnchorType: incoming.weekAnchorType || current.weekAnchorType,
      weekOverrides: {
        ...incoming.weekOverrides,
        ...current.weekOverrides,
      },
      schoolHolidays: mergedHolidays,
      targetBedtime: current.targetBedtime || incoming.targetBedtime,
    };
  }

  // merge-overwrite with includeSettings
  return {
    ...current,
    ...incoming,
    weekOverrides: {
      ...current.weekOverrides,
      ...incoming.weekOverrides,
    },
    schoolHolidays: mergedHolidays,
    reminderOptions: {
      ...current.reminderOptions,
      ...incoming.reminderOptions,
    },
    categoryColours: {
      ...current.categoryColours,
      ...incoming.categoryColours,
    },
  };
}

function mergeWorkoutPlans(
  current: WorkoutPlanSession[],
  incoming: WorkoutPlanSession[],
  mode: ImportMergeMode
): WorkoutPlanSession[] {
  return mergeCollection(
    current,
    incoming,
    mode,
    (p) => p.key,
    (p) => p.key
  );
}

function mergeFitnessConfigForImport(
  current: FitnessConfig,
  incoming: FitnessConfig,
  mode: ImportMergeMode,
  includeSettings: boolean
): FitnessConfig {
  if (mode === 'replace-all') {
    return {
      ...incoming,
      dailyProteinLogs: { ...incoming.dailyProteinLogs },
      workoutPlan: [...incoming.workoutPlan],
    };
  }

  const workoutPlan = mergeWorkoutPlans(
    current.workoutPlan,
    incoming.workoutPlan,
    mode
  );

  const dailyProteinLogs =
    mode === 'merge-safe'
      ? { ...incoming.dailyProteinLogs, ...current.dailyProteinLogs }
      : { ...current.dailyProteinLogs, ...incoming.dailyProteinLogs };

  const shouldCopyConfigMeta =
    includeSettings || mode === 'merge-overwrite' || current.workoutPlan.length === 0;

  return {
    ...current,
    ...(shouldCopyConfigMeta
      ? {
          rebuildStartDate: incoming.rebuildStartDate || current.rebuildStartDate,
          proteinTargetMin: incoming.proteinTargetMin || current.proteinTargetMin,
          proteinTargetMax: incoming.proteinTargetMax || current.proteinTargetMax,
          volleyballCompetitiveMode: incoming.volleyballCompetitiveMode,
          lastReviewDate: incoming.lastReviewDate ?? current.lastReviewDate,
        }
      : {}),
    dailyProteinLogs,
    workoutPlan,
  };
}

export function applyImportMerge(
  current: AppState,
  incoming: AppState,
  options: {
    mode: ImportMergeMode;
    includeSettings: boolean;
    sourceLabel: string;
  }
): AppState {
  const { mode, includeSettings, sourceLabel } = options;
  const nowIso = new Date().toISOString();

  const events = mergeCollection(
    current.events,
    incoming.events,
    mode,
    (e) => e.id,
    sigEvent,
    (existing, next) => ({ ...next, id: existing.id })
  );

  const activityRecords = mergeCollection(
    current.activityRecords,
    incoming.activityRecords,
    mode,
    (r) => r.id,
    sigRecord,
    (existing, next) => ({
      ...next,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: nowIso,
    })
  );

  const priorities = mergeCollection(
    current.priorities,
    incoming.priorities,
    mode,
    (p) => p.id,
    sigPriority,
    (existing, next) => ({
      ...next,
      id: existing.id,
      createdAt: existing.createdAt,
    })
  );

  const habits = mergeCollection(
    current.habits,
    incoming.habits,
    mode,
    (h) => h.id,
    sigHabit,
    (existing, next) => ({ ...next, id: existing.id })
  );

  const habitLogs = mergeCollection(
    current.habitLogs,
    incoming.habitLogs,
    mode,
    (l) => l.id,
    sigHabitLog,
    (existing, next) => ({ ...next, id: existing.id })
  );

  const goals = mergeCollection(
    current.goals,
    incoming.goals,
    mode,
    (g) => g.id,
    sigGoal,
    (existing, next) => ({ ...next, id: existing.id })
  );

  const weeklyReviews = mergeCollection(
    current.weeklyReviews,
    incoming.weeklyReviews,
    mode,
    (w) => w.weekMonday,
    sigWeeklyReview
  );

  const devotionEntries = mergeCollection(
    current.devotionEntries,
    incoming.devotionEntries,
    mode,
    (d) => d.id,
    sigDevotion,
    (existing, next) => ({ ...next, id: existing.id })
  );

  const bibleStudies = mergeCollection(
    current.bibleStudies,
    incoming.bibleStudies,
    mode,
    (b) => b.id,
    sigBibleStudy,
    (existing, next) => ({ ...next, id: existing.id })
  );

  const workoutLogs = mergeCollection(
    current.workoutLogs,
    incoming.workoutLogs,
    mode,
    (w) => w.id,
    sigWorkoutLog,
    (existing, next) => ({ ...next, id: existing.id })
  );

  const cardioLogs = mergeCollection(
    current.cardioLogs,
    incoming.cardioLogs,
    mode,
    (c) => c.id,
    sigCardioLog,
    (existing, next) => ({ ...next, id: existing.id })
  );

  const beholdWeeks = mergeCollection(
    current.beholdWeeks,
    incoming.beholdWeeks,
    mode,
    (b) => b.id,
    sigBeholdWeek,
    (existing, next) => ({ ...next, id: existing.id })
  );

  const settings = mergeSettingsForImport(
    current.settings,
    incoming.settings,
    mode,
    includeSettings
  );

  const fitnessConfig = mergeFitnessConfigForImport(
    current.fitnessConfig,
    incoming.fitnessConfig,
    mode,
    includeSettings
  );

  return {
    version: Math.max(3, current.version, incoming.version),
    settings,
    events,
    activityRecords,
    priorities,
    habits,
    habitLogs,
    goals,
    weeklyReviews,
    activeTimer:
      mode === 'replace-all' ? incoming.activeTimer : current.activeTimer,
    devotionEntries,
    bibleStudies,
    workoutLogs,
    cardioLogs,
    beholdWeeks,
    fitnessConfig,
    migrationMeta: {
      personalImportCompletedAt: nowIso,
      importedFrom: sourceLabel.slice(0, 120),
    },
  };
}
