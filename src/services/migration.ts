import { createDefaultFitnessConfig } from '../data/pillarSeedData';
import { createEmptyState } from '../data/seedData';
import { AppState, FitnessConfig } from '../types/lifehq';

function mergeSettings(raw?: Partial<AppState>['settings']) {
  const defaults = createEmptyState().settings;
  return {
    ...defaults,
    ...(raw ?? {}),
    weekOverrides: { ...(raw?.weekOverrides ?? {}) },
    schoolHolidays: Array.isArray(raw?.schoolHolidays) ? raw.schoolHolidays : [],
    reminderOptions: {
      ...defaults.reminderOptions,
      ...(raw?.reminderOptions ?? {}),
    },
    categoryColours: {
      ...defaults.categoryColours,
      ...(raw?.categoryColours ?? {}),
    },
  };
}

function mergeFitnessConfig(raw?: Partial<FitnessConfig>): FitnessConfig {
  const defaults = createDefaultFitnessConfig();
  return {
    ...defaults,
    ...(raw ?? {}),
    dailyProteinLogs: { ...(raw?.dailyProteinLogs ?? {}) },
    workoutPlan: Array.isArray(raw?.workoutPlan) ? raw.workoutPlan : [],
  };
}

/**
 * Pure schema normaliser: coerces missing or partial fields onto clean empty defaults
 * without ever injecting hardcoded personal schedules, study notes, or habits.
 */
export function migrateAppState(
  raw: Partial<AppState> | null | undefined
): AppState {
  const empty = createEmptyState();
  if (!raw) return empty;

  return {
    ...empty,
    ...raw,
    version: Math.max(3, raw.version ?? 3),
    events: Array.isArray(raw.events) ? raw.events : [],
    activityRecords: Array.isArray(raw.activityRecords)
      ? raw.activityRecords
      : [],
    activeTimer: raw.activeTimer ?? null,
    priorities: Array.isArray(raw.priorities) ? raw.priorities : [],
    habits: Array.isArray(raw.habits) ? raw.habits : [],
    habitLogs: Array.isArray(raw.habitLogs) ? raw.habitLogs : [],
    goals: Array.isArray(raw.goals) ? raw.goals : [],
    weeklyReviews: Array.isArray(raw.weeklyReviews) ? raw.weeklyReviews : [],
    devotionEntries: Array.isArray(raw.devotionEntries)
      ? raw.devotionEntries
      : [],
    bibleStudies: Array.isArray(raw.bibleStudies) ? raw.bibleStudies : [],
    workoutLogs: Array.isArray(raw.workoutLogs) ? raw.workoutLogs : [],
    cardioLogs: Array.isArray(raw.cardioLogs) ? raw.cardioLogs : [],
    beholdWeeks: Array.isArray(raw.beholdWeeks) ? raw.beholdWeeks : [],
    fitnessConfig: mergeFitnessConfig(raw.fitnessConfig),
    settings: mergeSettings(raw.settings),
  };
}
