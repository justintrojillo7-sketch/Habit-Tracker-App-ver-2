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
  | 'habits'
  | 'pillars'
  | 'track'
  | 'insights'
  | 'goals'
  | 'settings';

export type PillarTab = 'faith' | 'fitness' | 'behold';

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
  daysOfWeek?: number[];
  targetMinutes?: number;
  targetQuantity?: number;
  targetUnit?: string;
  cue?: string;
  twoMinuteRule?: string;
  stackAnchorEventId?: string;
  stackAnchorLabel?: string;
  stackAction?: string;
  preferredWindowStart?: string;
  preferredWindowEnd?: string;
  linkedEventIds?: string[];
  templateKey?: string;
  createdAt?: string;
  paused: boolean;
  archived?: boolean;
  notes?: string;
}

export type HabitLogStatus = 'done' | 'partial' | 'skipped' | 'excused' | 'starter';

export interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  status: HabitLogStatus;
  source?: 'manual' | 'calendar';
  notes?: string;
  actualValue?: number;
  updatedAt?: string;
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

// ========================
// PILLAR 1: FAITH
// ========================
export type DevotionRoutineType = 'morning' | 'evening';

export interface DevotionEntry {
  id: string;
  date: string;
  routineType: DevotionRoutineType;
  hydrated?: boolean;
  watchwordsOpened?: boolean;
  scriptureRef: string;
  reflection: string;
  prayerCompleted: boolean;
  journalThoughts?: string;
  questions?: string;
  gratitude?: string;
  application?: string;
  shortOrMoved?: boolean;
  movedNote?: string;
  durationMinutes?: number;
  updatedAt: string;
}

export type BibleStudyStatus = 'completed' | 'in-progress' | 'upcoming';

export interface BibleStudyNote {
  id: string;
  book: string;
  passage: string;
  status: BibleStudyStatus;
  orderIndex: number;
  readingProgress: string;
  observations: string;
  historicalContext: string;
  theologicalInterpretation: string;
  crossReferences: string;
  practicalApplication: string;
  questions: string;
  prayerAndJournal: string;
  updatedAt: string;
}

// ========================
// PILLAR 2: FITNESS
// ========================
export type WorkoutSessionKey = 'upper_a' | 'lower_a' | 'upper_b' | 'lower_b';

export interface WorkoutExerciseTemplate {
  id: string;
  name: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  repUnit?: string;
  isSuperset?: boolean;
  notes?: string;
}

export interface WorkoutPlanSession {
  key: WorkoutSessionKey;
  title: string;
  shortLabel: string;
  dayOfWeek: number;
  linkedEventId?: string;
  focus: string;
  exercises: WorkoutExerciseTemplate[];
}

export interface WorkoutSetLog {
  weightKg: number;
  reps: number;
  completed: boolean;
}

export interface LoggedExercise {
  exerciseId: string;
  name: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  sets: WorkoutSetLog[];
  notes?: string;
}

export interface WorkoutSessionLog {
  id: string;
  date: string;
  sessionKey: WorkoutSessionKey;
  sessionTitle: string;
  linkedEventId?: string;
  durationMinutes: number;
  exercises: LoggedExercise[];
  effortRpe?: number;
  soreness?: number;
  recoveryNotes?: string;
  completed: boolean;
  updatedAt: string;
}

export type CardioType = 'endurance' | 'sprint' | 'low_impact' | 'skipped';

export interface CardioSessionLog {
  id: string;
  date: string;
  weekType: WeekType;
  cardioType: CardioType;
  durationMinutes: number;
  distanceKm?: number;
  averagePace?: string;
  sprintReps?: number;
  accelerationSeconds?: number;
  perceivedEffort?: number;
  recoveryQuality?: string;
  notes?: string;
  updatedAt: string;
}

export interface FitnessConfig {
  rebuildStartDate: string;
  proteinTargetMin: number;
  proteinTargetMax: number;
  dailyProteinLogs: Record<string, number>;
  volleyballCompetitiveMode: boolean;
  programmeReviewNotes: string;
  lastReviewDate?: string;
  workoutPlan: WorkoutPlanSession[];
}

// ========================
// PILLAR 3: BEHOLD
// ========================
export type BeholdWeekStatus = 'not-started' | 'in-progress' | 'completed';

export interface BeholdShotItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface BeholdWeekItem {
  id: string;
  weekNumber: number;
  monthPhase: 1 | 2 | 3;
  monthTitle: string;
  title: string;
  challenge: string;
  learningObjective: string;
  technicalFocus: string;
  practicalExercise: string;
  shotList: BeholdShotItem[];
  linkedEventId?: string;
  status: BeholdWeekStatus;
  projectLink: string;
  clientProjectName: string;
  reflectionWorked: string;
  reflectionDidntWork: string;
  reflectionImprove: string;
  portfolioReady: boolean;
  updatedAt: string;
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

export interface MigrationMeta {
  personalImportCompletedAt?: string;
  importedFrom?: string;
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
  devotionEntries: DevotionEntry[];
  bibleStudies: BibleStudyNote[];
  workoutLogs: WorkoutSessionLog[];
  cardioLogs: CardioSessionLog[];
  beholdWeeks: BeholdWeekItem[];
  fitnessConfig: FitnessConfig;
  migrationMeta?: MigrationMeta;
}
