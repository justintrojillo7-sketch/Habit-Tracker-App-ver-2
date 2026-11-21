import {
  ActivityRecord,
  AppSettings,
  BeholdWeekItem,
  BibleStudyNote,
  CardioSessionLog,
  DevotionEntry,
  DevotionRoutineType,
  EventOccurrence,
  WorkoutExerciseTemplate,
  WorkoutSessionKey,
  WorkoutSessionLog,
} from '../types/lifehq';
import { diffDays, getWeekType, timeToMinutes } from './dateUtils';
import { isFreeSchoolPeriod } from './calendarLayout';

// ========================
// FAITH HELPERS
// ========================
export function getDevotionForDate(
  entries: DevotionEntry[],
  date: string,
  routineType: DevotionRoutineType
): DevotionEntry | undefined {
  return entries.find(
    (e) => e.date === date && e.routineType === routineType
  );
}

export function partitionBibleStudies(studies: BibleStudyNote[]): {
  completed: BibleStudyNote[];
  active: BibleStudyNote | null;
  upcoming: BibleStudyNote[];
} {
  const sorted = studies
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const completed = sorted.filter((s) => s.status === 'completed');
  const inProgress = sorted.find((s) => s.status === 'in-progress') ?? null;
  const upcoming = sorted.filter((s) => s.status === 'upcoming');
  const active = inProgress ?? upcoming[0] ?? null;
  return {
    completed,
    active,
    upcoming: active
      ? upcoming.filter((u) => u.id !== active.id)
      : upcoming,
  };
}

// ========================
// FITNESS DOUBLE PROGRESSION & PR ENGINE
// ========================
export interface DoubleProgressionCue {
  readyToIncrease: boolean;
  lastDate?: string;
  lastWeightKg?: number;
  lastRepsSummary?: string;
  suggestedWeightKg?: number;
  message: string;
}

function getModestIncrementKg(exerciseName: string): number {
  const lower = exerciseName.toLowerCase();
  if (
    lower.includes('squat') ||
    lower.includes('deadlift') ||
    lower.includes('bench') ||
    lower.includes('overhead')
  ) {
    return 2.5;
  }
  return 1.5;
}

export function getExerciseDoubleProgressionCue(
  exercise: WorkoutExerciseTemplate,
  workoutLogs: WorkoutSessionLog[],
  beforeOrOnDate?: string
): DoubleProgressionCue {
  const matching = workoutLogs
    .filter((w) => !beforeOrOnDate || w.date < beforeOrOnDate)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  for (const log of matching) {
    const ex = log.exercises.find(
      (item) =>
        item.exerciseId === exercise.id ||
        item.name.toLowerCase() === exercise.name.toLowerCase()
    );
    if (!ex || ex.sets.length === 0) continue;
    const completedSets = ex.sets.filter((s) => s.completed && s.reps > 0);
    if (completedSets.length === 0) continue;

    const topWeight = Math.max(...completedSets.map((s) => s.weightKg));
    const repsText = completedSets.map((s) => `${s.reps}`).join(', ');
    const summary = `${topWeight} kg × ${repsText}`;

    const allTargetSetsComplete = completedSets.length >= exercise.targetSets;
    const allHitUpperRep = completedSets.every(
      (s) => s.reps >= exercise.repMax
    );

    if (allTargetSetsComplete && allHitUpperRep && topWeight > 0) {
      const inc = getModestIncrementKg(exercise.name);
      const suggested = Number((topWeight + inc).toFixed(2));
      return {
        readyToIncrease: true,
        lastDate: log.date,
        lastWeightKg: topWeight,
        lastRepsSummary: summary,
        suggestedWeightKg: suggested,
        message: `All ${exercise.targetSets} sets hit ${exercise.repMax}+ reps (${summary}). Ready for +${inc} kg → ${suggested} kg if technique felt clean.`,
      };
    }

    return {
      readyToIncrease: false,
      lastDate: log.date,
      lastWeightKg: topWeight,
      lastRepsSummary: summary,
      message: `Last logged (${log.date}): ${summary}. Build toward ${exercise.targetSets}×${exercise.repMax} before adding load.`,
    };
  }

  return {
    readyToIncrease: false,
    message: `Target ${exercise.targetSets}×${exercise.repMin}${
      exercise.repMax !== exercise.repMin ? `–${exercise.repMax}` : ''
    }${exercise.repUnit ? ` ${exercise.repUnit}` : ''} — log your baseline with crisp technique.`,
  };
}

export interface ExercisePersonalRecord {
  exerciseName: string;
  maxWeightKg: number;
  repsAtMaxWeight: number;
  bestEst1RmKg: number;
  bestVolumeSetKg: number;
  lastDate: string;
  totalSessionsLogged: number;
}

export function calculateFitnessPersonalRecords(
  workoutLogs: WorkoutSessionLog[]
): ExercisePersonalRecord[] {
  const map = new Map<
    string,
    {
      exerciseName: string;
      maxWeightKg: number;
      repsAtMaxWeight: number;
      bestEst1RmKg: number;
      bestVolumeSetKg: number;
      lastDate: string;
      dates: Set<string>;
    }
  >();

  for (const log of workoutLogs) {
    for (const ex of log.exercises) {
      const validSets = ex.sets.filter(
        (s) => s.completed && s.weightKg > 0 && s.reps > 0
      );
      if (validSets.length === 0) continue;
      const key = ex.name.trim().toLowerCase();
      let entry = map.get(key);
      if (!entry) {
        entry = {
          exerciseName: ex.name,
          maxWeightKg: 0,
          repsAtMaxWeight: 0,
          bestEst1RmKg: 0,
          bestVolumeSetKg: 0,
          lastDate: log.date,
          dates: new Set<string>(),
        };
        map.set(key, entry);
      }
      entry.dates.add(log.date);
      if (log.date > entry.lastDate) entry.lastDate = log.date;

      for (const s of validSets) {
        const est1Rm =
          s.reps === 1
            ? s.weightKg
            : Number((s.weightKg * (1 + s.reps / 30)).toFixed(1));
        const vol = s.weightKg * s.reps;
        if (
          s.weightKg > entry.maxWeightKg ||
          (s.weightKg === entry.maxWeightKg && s.reps > entry.repsAtMaxWeight)
        ) {
          entry.maxWeightKg = s.weightKg;
          entry.repsAtMaxWeight = s.reps;
        }
        if (est1Rm > entry.bestEst1RmKg) entry.bestEst1RmKg = est1Rm;
        if (vol > entry.bestVolumeSetKg) entry.bestVolumeSetKg = vol;
      }
    }
  }

  return Array.from(map.values())
    .map((e) => ({
      exerciseName: e.exerciseName,
      maxWeightKg: e.maxWeightKg,
      repsAtMaxWeight: e.repsAtMaxWeight,
      bestEst1RmKg: e.bestEst1RmKg,
      bestVolumeSetKg: e.bestVolumeSetKg,
      lastDate: e.lastDate,
      totalSessionsLogged: e.dates.size,
    }))
    .sort((a, b) => b.maxWeightKg - a.maxWeightKg);
}

export function getRebuildPhaseInfo(
  rebuildStartDate: string,
  todayDate: string,
  lastReviewDate?: string
): {
  daysSinceStart: number;
  currentWeek: number;
  inRebuildPhase: boolean;
  reviewDue: boolean;
  label: string;
} {
  const days = Math.max(0, diffDays(rebuildStartDate, todayDate));
  const currentWeek = Math.floor(days / 7) + 1;
  const inRebuildPhase = currentWeek <= 4;
  const daysSinceReview = lastReviewDate
    ? diffDays(lastReviewDate, todayDate)
    : days;
  const reviewDue = currentWeek >= 6 && daysSinceReview >= 42;

  const label = inRebuildPhase
    ? `Rebuilding phase · Week ${currentWeek} of 4 (technique & sustainable loads)`
    : reviewDue
    ? `Week ${currentWeek} · 6–8 week programme review ready`
    : `Week ${currentWeek} · Progressive development phase`;

  return {
    daysSinceStart: days,
    currentWeek,
    inRebuildPhase,
    reviewDue,
    label,
  };
}

export function getWednesdayCardioPrescription(
  dateStr: string,
  settings: AppSettings
): {
  weekType: 'A' | 'B';
  title: string;
  prescription: string;
  guidance: string;
} {
  const weekType = getWeekType(dateStr, settings);
  if (weekType === 'A') {
    return {
      weekType: 'A',
      title: 'Week A · Endurance cardio',
      prescription: '20–30 min at easy conversational pace',
      guidance:
        'Keep heart rate conversational (Zone 2); build aerobic duration gradually without chasing speed.',
    };
  }
  return {
    weekType: 'B',
    title: 'Week B · Sprint development',
    prescription: 'Progressive warm-up + 6 × 10–15s controlled accelerations',
    guidance:
      'Use generous full walking recovery (60–90s) between reps. Choose low-impact bike/row or skip gently if fatigued or sore.',
  };
}

export function getSessionKeyForDateOrEvent(
  eventId?: string,
  isoWeekday?: number
): WorkoutSessionKey {
  if (eventId === 'mon-gym-push' || isoWeekday === 1) return 'upper_a';
  if (eventId === 'thu-gym-pull' || isoWeekday === 4) return 'lower_a';
  if (eventId === 'fri-gym-legs' || isoWeekday === 5) return 'upper_b';
  if (eventId === 'sat-gym-full' || isoWeekday === 6) return 'lower_b';
  return 'upper_a';
}

// ========================
// BEHOLD HELPERS
// ========================
export function getActiveBeholdWeek(
  weeks: BeholdWeekItem[]
): BeholdWeekItem | null {
  if (weeks.length === 0) return null;
  const sorted = weeks.slice().sort((a, b) => a.weekNumber - b.weekNumber);
  return (
    sorted.find((w) => w.status === 'in-progress') ??
    sorted.find((w) => w.status === 'not-started') ??
    sorted[sorted.length - 1]
  );
}

// ========================
// INSIGHTS PILLAR AGGREGATIONS (100% REAL RECORDED DATA)
// ========================
export interface ThreePillarInsightsSummary {
  faith: {
    morningCount: number;
    eveningCount: number;
    totalDevotionEntries: number;
    completedStudies: number;
    totalStudies: number;
    activeStudyLabel: string;
    actualMinutes: number;
  };
  fitness: {
    strengthSessionsLogged: number;
    cardioEnduranceCount: number;
    cardioSprintCount: number;
    totalSetVolumeKg: number;
    actualMinutes: number;
  };
  behold: {
    completedWeeks: number;
    inProgressWeeks: number;
    totalWeeks: number;
    portfolioReadyCount: number;
    clientMappedCount: number;
    actualMinutes: number;
  };
}

export function calculatePillarInsightsSummary(params: {
  startDate: string;
  endDate: string;
  activityRecords: ActivityRecord[];
  devotionEntries: DevotionEntry[];
  bibleStudies: BibleStudyNote[];
  workoutLogs: WorkoutSessionLog[];
  cardioLogs: CardioSessionLog[];
  beholdWeeks: BeholdWeekItem[];
}): ThreePillarInsightsSummary {
  const {
    startDate,
    endDate,
    activityRecords,
    devotionEntries,
    bibleStudies,
    workoutLogs,
    cardioLogs,
    beholdWeeks,
  } = params;

  const rangeDevotions = devotionEntries.filter(
    (d) => d.date >= startDate && d.date <= endDate
  );
  const morningCount = rangeDevotions.filter(
    (d) => d.routineType === 'morning'
  ).length;
  const eveningCount = rangeDevotions.filter(
    (d) => d.routineType === 'evening'
  ).length;

  const studiesPart = partitionBibleStudies(bibleStudies);

  const rangeWorkouts = workoutLogs.filter(
    (w) => w.date >= startDate && w.date <= endDate && w.completed
  );
  const rangeCardio = cardioLogs.filter(
    (c) =>
      c.date >= startDate && c.date <= endDate && c.cardioType !== 'skipped'
  );

  let totalSetVolumeKg = 0;
  for (const w of rangeWorkouts) {
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        if (s.completed && s.weightKg > 0 && s.reps > 0) {
          totalSetVolumeKg += s.weightKg * s.reps;
        }
      }
    }
  }

  const rangeActualMinsByCat = (cat: 'faith' | 'fitness' | 'behold') =>
    activityRecords
      .filter(
        (r) =>
          r.date >= startDate &&
          r.date <= endDate &&
          r.category === cat &&
          (r.status === 'completed' || r.status === 'partial')
      )
      .reduce((acc, r) => acc + r.actualMinutes, 0);

  return {
    faith: {
      morningCount,
      eveningCount,
      totalDevotionEntries: rangeDevotions.length,
      completedStudies: studiesPart.completed.length,
      totalStudies: bibleStudies.length,
      activeStudyLabel: studiesPart.active
        ? `${studiesPart.active.book} (${studiesPart.active.passage})`
        : 'All queued studies complete',
      actualMinutes: rangeActualMinsByCat('faith'),
    },
    fitness: {
      strengthSessionsLogged: rangeWorkouts.length,
      cardioEnduranceCount: rangeCardio.filter(
        (c) => c.cardioType === 'endurance' || c.cardioType === 'low_impact'
      ).length,
      cardioSprintCount: rangeCardio.filter((c) => c.cardioType === 'sprint')
        .length,
      totalSetVolumeKg: Math.round(totalSetVolumeKg),
      actualMinutes: rangeActualMinsByCat('fitness'),
    },
    behold: {
      completedWeeks: beholdWeeks.filter((w) => w.status === 'completed')
        .length,
      inProgressWeeks: beholdWeeks.filter((w) => w.status === 'in-progress')
        .length,
      totalWeeks: beholdWeeks.length,
      portfolioReadyCount: beholdWeeks.filter((w) => w.portfolioReady).length,
      clientMappedCount: beholdWeeks.filter((w) =>
        Boolean(w.clientProjectName.trim())
      ).length,
      actualMinutes: rangeActualMinsByCat('behold'),
    },
  };
}

// ========================
// CALENDAR OVERLAP WARNING DETECTOR
// ========================
export interface CalendarOverlapMatch {
  occurrence: EventOccurrence;
  overlapMinutes: number;
}

export function findOverlappingOccurrences(
  candidateStartTime: string,
  candidateEndTime: string,
  dayOccurrences: EventOccurrence[],
  excludeOccurrenceKey?: string
): CalendarOverlapMatch[] {
  const cStart = timeToMinutes(candidateStartTime);
  const cEnd = timeToMinutes(candidateEndTime);
  if (cEnd <= cStart) return [];

  const matches: CalendarOverlapMatch[] = [];
  for (const occ of dayOccurrences) {
    if (excludeOccurrenceKey && occ.occurrenceKey === excludeOccurrenceKey) {
      continue;
    }
    if (occ.activityRecord?.status === 'cancelled') continue;
    if (isFreeSchoolPeriod(occ)) continue;
    if (occ.isRoutineMarker && occ.durationMinutes <= 10) continue;

    const oStart = timeToMinutes(occ.startTime);
    const oEnd = timeToMinutes(occ.endTime);
    const overlap = Math.min(cEnd, oEnd) - Math.max(cStart, oStart);
    if (overlap > 0) {
      matches.push({ occurrence: occ, overlapMinutes: overlap });
    }
  }
  return matches;
}
