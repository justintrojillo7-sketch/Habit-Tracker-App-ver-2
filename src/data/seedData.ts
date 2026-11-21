import {
  AppSettings,
  AppState,
  CalendarEvent,
  CategoryId,
  CategoryMeta,
  Goal,
  Habit,
  PriorityTask,
} from '../types/lifehq';
import { getLondonNow, getMondayOfWeek } from '../utils/dateUtils';
import { createDefaultFitnessConfig } from './pillarSeedData';

export const DEFAULT_CATEGORY_COLOURS: Record<CategoryId, string> = {
  teaching: '#4A7C9B', // Muted blue
  behold: '#7C68A6', // Sophisticated purple
  fitness: '#C98A3B', // Warm amber
  faith: '#5C8D76', // Sage green
  personal: '#B36B7A', // Muted rose
  rest: '#6E7B8B', // Neutral slate
};

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'teaching',
    label: 'Work & Teaching',
    colour: DEFAULT_CATEGORY_COLOURS.teaching,
    subcategories: [
      'Core work',
      'Lesson planning',
      'Preparation',
      'Meetings',
      'Administration',
    ],
  },
  {
    id: 'behold',
    label: 'Creative & Craft',
    colour: DEFAULT_CATEGORY_COLOURS.behold,
    subcategories: [
      'Practice',
      'Projects',
      'Editing',
      'Learning',
      'Planning',
      'Admin',
    ],
  },
  {
    id: 'fitness',
    label: 'Fitness',
    colour: DEFAULT_CATEGORY_COLOURS.fitness,
    subcategories: [
      'Strength training',
      'Conditioning & cardio',
      'Sport & agility',
      'Mobility',
      'Recovery work',
    ],
  },
  {
    id: 'faith',
    label: 'Faith & Ministry',
    colour: DEFAULT_CATEGORY_COLOURS.faith,
    subcategories: [
      'Devotion',
      'Bible study',
      'Fellowship',
      'Service',
      'Worship',
      'Church',
    ],
  },
  {
    id: 'personal',
    label: 'Personal',
    colour: DEFAULT_CATEGORY_COLOURS.personal,
    subcategories: [
      'Daily routine',
      'Planning & reflection',
      'Errands & admin',
      'Family & friends',
      'Meals',
      'Commuting',
    ],
  },
  {
    id: 'rest',
    label: 'Rest & Recovery',
    colour: DEFAULT_CATEGORY_COLOURS.rest,
    subcategories: ['Sleep', 'Wind down', 'Downtime', 'Recovery'],
  },
];

export function createDefaultSettings(): AppSettings {
  return {
    theme: 'system',
    weekAnchorMonday: getMondayOfWeek(getLondonNow().date),
    weekAnchorType: 'A',
    weekOverrides: {},
    schoolHolidays: [],
    targetBedtime: '22:30',
    notificationsEnabled: false,
    reminderOptions: {
      upcomingEvents: true,
      unconfirmedMinistry: true,
      dailyHabits: true,
      weeklyReview: true,
      goalDeadlines: true,
    },
    categoryColours: { ...DEFAULT_CATEGORY_COLOURS },
  };
}

export const DEFAULT_SETTINGS: AppSettings = createDefaultSettings();

export const SEED_EVENTS: CalendarEvent[] = [];

export const SEED_HABITS: Habit[] = [];

export const SEED_GOALS: Goal[] = [];

export const SEED_PRIORITIES: PriorityTask[] = [];

export function createEmptyState(): AppState {
  return {
    version: 3,
    events: [],
    activityRecords: [],
    activeTimer: null,
    priorities: [],
    habits: [],
    habitLogs: [],
    goals: [],
    weeklyReviews: [],
    settings: createDefaultSettings(),
    devotionEntries: [],
    bibleStudies: [],
    workoutLogs: [],
    cardioLogs: [],
    beholdWeeks: [],
    fitnessConfig: createDefaultFitnessConfig(),
  };
}

export const INITIAL_STATE: AppState = createEmptyState();
