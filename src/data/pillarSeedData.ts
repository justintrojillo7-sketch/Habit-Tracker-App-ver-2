import {
  BeholdWeekItem,
  BibleStudyNote,
  CalendarEvent,
  FitnessConfig,
  Goal,
  Habit,
  WorkoutPlanSession,
} from '../types/lifehq';
import { getLondonNow } from '../utils/dateUtils';

export const MORAVIAN_WATCHWORDS_LINKS: Array<{ label: string; url: string }> =
  [];

export const MORNING_FAITH_STEPS = [
  { time: 'Step 1', label: 'Quiet down and prepare for the day' },
  { time: 'Step 2', label: 'Read a daily devotional or Scripture passage' },
  { time: 'Step 3', label: 'Reflect briefly and note key thoughts' },
  { time: 'Step 4', label: 'Prayer and daily intention' },
];

export const SEED_BIBLE_STUDIES: BibleStudyNote[] = [];

export const DEFAULT_WORKOUT_PLAN: WorkoutPlanSession[] = [];

export const STARTER_UPPER_LOWER_TEMPLATE: WorkoutPlanSession[] = [
  {
    key: 'upper_a',
    title: 'Upper A: Strength',
    shortLabel: 'Upper A',
    dayOfWeek: 1,
    focus: 'Compound upper-body push and pull strength with controlled form',
    exercises: [
      { id: 'tpl-ua-bench', name: 'Barbell bench press', targetSets: 3, repMin: 5, repMax: 8 },
      { id: 'tpl-ua-row', name: 'Bent-over or cable row', targetSets: 3, repMin: 6, repMax: 10 },
      { id: 'tpl-ua-ohp', name: 'Overhead press', targetSets: 3, repMin: 6, repMax: 10 },
      { id: 'tpl-ua-pulldown', name: 'Lat pulldown', targetSets: 3, repMin: 8, repMax: 12 },
    ],
  },
  {
    key: 'lower_a',
    title: 'Lower A: Strength',
    shortLabel: 'Lower A',
    dayOfWeek: 4,
    focus: 'Primary lower-body compound patterns and core stability',
    exercises: [
      { id: 'tpl-la-squat', name: 'Squat', targetSets: 3, repMin: 5, repMax: 8 },
      { id: 'tpl-la-rdl', name: 'Romanian deadlift', targetSets: 3, repMin: 6, repMax: 10 },
      { id: 'tpl-la-split', name: 'Split squat', targetSets: 2, repMin: 8, repMax: 10, repUnit: '/leg' },
      { id: 'tpl-la-calf', name: 'Calf raises', targetSets: 3, repMin: 10, repMax: 15 },
    ],
  },
  {
    key: 'upper_b',
    title: 'Upper B: Hypertrophy',
    shortLabel: 'Upper B',
    dayOfWeek: 5,
    focus: 'Controlled upper-body volume, shoulder balance, and accessories',
    exercises: [
      { id: 'tpl-ub-incline', name: 'Incline dumbbell press', targetSets: 3, repMin: 8, repMax: 12 },
      { id: 'tpl-ub-row', name: 'Seated row', targetSets: 3, repMin: 8, repMax: 12 },
      { id: 'tpl-ub-lat', name: 'Lateral raises', targetSets: 3, repMin: 12, repMax: 15 },
      { id: 'tpl-ub-arms', name: 'Arm accessories', targetSets: 2, repMin: 10, repMax: 15 },
    ],
  },
  {
    key: 'lower_b',
    title: 'Lower B: Conditioning & Power',
    shortLabel: 'Lower B',
    dayOfWeek: 6,
    focus: 'Posterior chain, unilateral stability, and athletic control',
    exercises: [
      { id: 'tpl-lb-deadlift', name: 'Deadlift or trap-bar pull', targetSets: 3, repMin: 5, repMax: 6 },
      { id: 'tpl-lb-lunge', name: 'Reverse lunges', targetSets: 3, repMin: 8, repMax: 10, repUnit: '/leg' },
      { id: 'tpl-lb-curl', name: 'Hamstring curl', targetSets: 3, repMin: 10, repMax: 12 },
      { id: 'tpl-lb-core', name: 'Core stability', targetSets: 3, repMin: 10, repMax: 15 },
    ],
  },
];

export function createDefaultFitnessConfig(): FitnessConfig {
  return {
    rebuildStartDate: getLondonNow().date,
    proteinTargetMin: 120,
    proteinTargetMax: 160,
    dailyProteinLogs: {},
    volleyballCompetitiveMode: false,
    programmeReviewNotes: '',
    workoutPlan: [],
  };
}

export const DEFAULT_FITNESS_CONFIG: FitnessConfig = createDefaultFitnessConfig();

export const BEHOLD_CORE_DISCIPLINES: string[] = [];

export const SEED_BEHOLD_WEEKS: BeholdWeekItem[] = [];

export const PILLAR_EXTRA_EVENTS: CalendarEvent[] = [];

export const PILLAR_EXTRA_HABITS: Habit[] = [];

export const PILLAR_EXTRA_GOALS: Goal[] = [];
