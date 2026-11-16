export type CategoryId =
  | 'teaching'
  | 'behold'
  | 'fitness'
  | 'faith'
  | 'personal'
  | 'rest';

export type NavSection =
  | 'today'
  | 'calendar'
  | 'track'
  | 'insights'
  | 'goals'
  | 'settings';

export type WeekType = 'A' | 'B';

export type ThemePreference = 'system' | 'light' | 'dark';

export type CommitmentStatus = 'confirmed' | 'tentative' | 'proposed';

export type ActivityOutcomeStatus =
  | 'completed'
  | 'partial'
  | 'skipped'
  | 'cancelled'
  | 'rescheduled';

export type RecurrenceType =
  | 'once'
  | 'daily'
  | 'weekly'
  | 'fortnightly'
  | 'monthly'
  | 'nthWeekday'
  | 'wednesdayBeforeThirdSunday'
  | 'custom';

export type EventSource = 'school' | 'routine' | 'personal' | 'ics-import';

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  colour: string;
  subcategories: string[];
}

export interface EventException {
  deleted?: boolean;
  title?: string;
  startTime?: string;
  endTime?: string;
  date?: string;
  location?: string;
  notes?: string;
  commitmentStatus?: CommitmentStatus;
  category?: CategoryId;
  subcategory?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  category: CategoryId;
  subcategory: string;
  startDate: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  recurrence: RecurrenceType;
  daysOfWeek?: number[];
  weekAB?: 'A' | 'B' | 'both';
  nth?: number;
  weekday?: number;
  customIntervalDays?: number;
  commitmentStatus: CommitmentStatus;
  source: EventSource;
  isSchoolTimetable?: boolean;
  isRoutineMarker?: boolean;
  isFlexible?: boolean;
  durationUnconfirmed?: boolean;
  location?: string;
  notes?: string;
  reminderMinutes?: number | null;
  linkedHabitId?: string;
  linkedMonthlyRole?: {
    nth: number;
    weekday: number;
    label: string;
  };
  exceptions?: Record<string, EventException>;
  icsUid?: string;
}

export interface EventOccurrence {
  occurrenceKey: string;
  eventId: string;
  date: string;
  originalDate: string;
  title: string;
  category: CategoryId;
  subcategory: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  commitmentStatus: CommitmentStatus;
  source: EventSource;
  isSchoolTimetable?: boolean;
  isRoutineMarker?: boolean;
  isFlexible?: boolean;
  durationUnconfirmed?: boolean;
  location?: string;
  notes?: string;
  reminderMinutes?: number | null;
  linkedHabitId?: string;
  linkedRoleBadge?: string;
  isOverridden?: boolean;
  activityRecord?: ActivityRecord;
}

export interface ActivityRecord {
  id: string;
  sourceType: 'scheduled' | 'timer' | 'manual';
  eventId?: string;
  occurrenceDate?: string;
  date: string;
  startTime: string;
  endTime: string;
  scheduledMinutes?: number;
  actualMinutes: number;
  status: ActivityOutcomeStatus;
  category: CategoryId;
  subcategory: string;
  title: string;
  project?: string;
  notes?: string;
  isDemoData?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveTimerState {
  id: string;
  isRunning: boolean;
  startedAtMs: number | null;
  accumulatedMs: number;
  category: CategoryId;
  subcategory: string;
  title: string;
  project: string;
  notes: string;
  linkedEventId?: string;
  linkedOccurrenceDate?: string;
}

export interface PriorityTask {
  id: string;
  title: string;
  category: CategoryId;
  date: string;
  completed: boolean;
  notes?: string;
  createdAt: string;
}

export type HabitFrequency = 'daily' | 'weekly' | 'custom';

export interface Habit {
  id: string;
  title: string;
  category: CategoryId;
  frequency: HabitFrequency;
  weeklyTarget: number;
  paused: boolean;
  notes?: string;
}

export type HabitLogStatus = 'done' | 'skipped';

export interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  status: HabitLogStatus;
  source?: 'manual' | 'calendar';
}

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: CategoryId;
  targetDate?: string;
  measurableTarget?: string;
  progressMode: 'milestones' | 'manual' | 'hours';
  manualProgress: number;
  targetHours?: number;
  status: 'active' | 'completed' | 'paused';
  milestones: Milestone[];
  linkedActivityKeyword?: string;
}

export interface WeeklyReviewEntry {
  weekMonday: string;
  wentWell: string;
  difficultOrDraining: string;
  changeNextWeek: string;
  savedAt: string;
}

export interface HolidayRange {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}

export interface AppSettings {
  theme: ThemePreference;
  weekAnchorMonday: string;
  weekAnchorType: WeekType;
  weekOverrides: Record<string, WeekType>;
  schoolHolidays: HolidayRange[];
  targetBedtime: string;
  notificationsEnabled: boolean;
  reminderOptions: {
    upcomingEvents: boolean;
    unconfirmedMinistry: boolean;
    dailyHabits: boolean;
    weeklyReview: boolean;
    goalDeadlines: boolean;
  };
  categoryColours: Record<CategoryId, string>;
}

export interface AppState {
  version: number;
  events: CalendarEvent[];
  activityRecords: ActivityRecord[];
  activeTimer: ActiveTimerState | null;
  priorities: PriorityTask[];
  habits: Habit[];
  habitLogs: HabitLog[];
  goals: Goal[];
  weeklyReviews: WeeklyReviewEntry[];
  settings: AppSettings;
}
