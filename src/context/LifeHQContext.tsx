import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { User } from 'firebase/auth';
import { CATEGORIES, createEmptyState } from '../data/seedData';
import {
  ActiveTimerState,
  ActivityOutcomeStatus,
  ActivityRecord,
  AppSettings,
  AppState,
  BeholdWeekItem,
  BibleStudyNote,
  CalendarEvent,
  CardioSessionLog,
  CategoryId,
  DevotionEntry,
  EventException,
  EventOccurrence,
  FitnessConfig,
  Goal,
  Habit,
  HabitLog,
  HabitLogStatus,
  NavSection,
  PillarTab,
  PriorityTask,
  WeeklyReviewEntry,
  WorkoutSessionLog,
} from '../types/lifehq';
import {
  addDays,
  formatDisplayDate,
  getIsoWeekday,
  getLondonNow,
  getMondayOfWeek,
  minutesToTime,
  timeToMinutes,
} from '../utils/dateUtils';
import { expandEventsForRange } from '../utils/recurrence';
import {
  clearLegacyLocalBackup,
  inspectLegacyLocalBackup,
  LegacyLocalBackupInfo,
  loadUserCache,
  saveUserCache,
} from '../services/storage';
import { ImportMergeMode } from '../services/importMerge';
import {
  ensureEmptyWorkspaceInitialized,
  removeDoc,
  replaceFullWorkspaceInCloud,
  saveFullWorkspaceToCloud,
  signInWithGoogle,
  signOutFirebase,
  subscribeAuth,
  subscribeUserWorkspace,
  syncActiveTimer,
  syncDoc,
  syncFitnessConfig,
  syncWorkspaceSettings,
} from '../services/firebaseSync';

export interface InAppReminder {
  id: string;
  type: 'event' | 'ministry' | 'habit' | 'review' | 'goal';
  title: string;
  detail: string;
  actionSection?: NavSection;
}

interface LifeHQContextValue {
  state: AppState;
  activeSection: NavSection;
  setActiveSection: (section: NavSection) => void;
  pillarTab: PillarTab;
  setPillarTab: (tab: PillarTab) => void;
  openPillar: (tab: PillarTab) => void;
  isDark: boolean;
  toast: string | null;
  showToast: (msg: string) => void;
  storageError: string | null;
  cloudUser: User | null;
  cloudAuthReady: boolean;
  cloudLoading: boolean;
  cloudError: string | null;
  cloudSyncStatus: 'local-only' | 'synced' | 'syncing' | 'error';
  signInCloud: () => Promise<void>;
  signOutCloud: () => Promise<void>;
  legacyBackupInfo: LegacyLocalBackupInfo;
  refreshLegacyBackupInfo: () => void;
  clearDetectedLegacyBackup: () => void;
  now: { date: string; time: string; minutes: number };
  reminders: InAppReminder[];

  getCategoryMeta: (id: CategoryId) => {
    id: CategoryId;
    label: string;
    colour: string;
    subcategories: string[];
  };

  upsertEvent: (event: CalendarEvent) => void;
  deleteEvent: (eventId: string) => void;
  editOccurrenceException: (
    eventId: string,
    originalDate: string,
    exception: EventException
  ) => void;
  confirmOccurrence: (
    occ: EventOccurrence,
    status: ActivityOutcomeStatus,
    actualMinutesOverride?: number,
    notes?: string
  ) => void;
  clearOccurrenceConfirmation: (eventId: string, occurrenceDate: string) => void;
  importEvents: (events: CalendarEvent[]) => void;

  startTimer: (payload: {
    category: CategoryId;
    subcategory: string;
    title: string;
    project?: string;
    notes?: string;
    linkedEventId?: string;
    linkedOccurrenceDate?: string;
  }) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  discardTimer: () => void;
  stopAndSaveTimer: (adjustedMinutes?: number) => void;
  addManualLog: (
    log: Omit<ActivityRecord, 'id' | 'createdAt' | 'updatedAt' | 'sourceType'>
  ) => void;
  updateActivityRecord: (id: string, patch: Partial<ActivityRecord>) => void;
  deleteActivityRecord: (id: string) => void;

  addPriority: (title: string, category: CategoryId, date?: string) => void;
  togglePriority: (id: string) => void;
  updatePriority: (id: string, patch: Partial<PriorityTask>) => void;
  postponePriority: (id: string, toDate?: string) => void;
  deletePriority: (id: string) => void;

  setHabitStatus: (
    habitId: string,
    date: string,
    status: HabitLogStatus | 'clear',
    source?: 'manual' | 'calendar',
    notes?: string,
    actualValue?: number
  ) => void;
  logStarterAttempt: (
    habitId: string,
    date: string,
    notes?: string,
    durationSeconds?: number
  ) => void;
  clearStarterAttempt: (habitId: string, date: string) => void;
  updateHabitStack: (
    habitId: string,
    stack: {
      stackAnchorEventId?: string;
      stackAnchorLabel?: string;
      stackAction?: string;
      preferredWindowStart?: string;
      preferredWindowEnd?: string;
    } | null
  ) => void;
  toggleHabitPause: (habitId: string) => void;
  toggleHabitArchive: (habitId: string) => void;
  addHabit: (habit: Omit<Habit, 'id'>) => void;
  upsertHabit: (habit: Habit, linkedEventIds?: string[]) => void;
  deleteHabit: (habitId: string) => void;

  toggleMilestone: (goalId: string, milestoneId: string) => void;
  upsertGoal: (goal: Goal) => void;
  deleteGoal: (goalId: string) => void;

  saveWeeklyReview: (entry: Omit<WeeklyReviewEntry, 'savedAt'>) => void;

  upsertDevotionEntry: (entry: DevotionEntry) => void;
  upsertBibleStudy: (study: BibleStudyNote) => void;
  deleteBibleStudy: (id: string) => void;
  upsertWorkoutLog: (log: WorkoutSessionLog, recordInTimeline?: boolean) => void;
  deleteWorkoutLog: (id: string) => void;
  upsertCardioLog: (log: CardioSessionLog, recordInTimeline?: boolean) => void;
  deleteCardioLog: (id: string) => void;
  updateFitnessConfig: (patch: Partial<FitnessConfig>) => void;
  logDailyProtein: (date: string, grams: number | null) => void;
  upsertBeholdWeek: (week: BeholdWeekItem) => void;

  updateSettings: (patch: Partial<AppSettings>) => void;
  applyImportedWorkspace: (
    nextState: AppState,
    mode: ImportMergeMode
  ) => Promise<boolean>;
  resetWorkspaceToEmpty: () => Promise<void>;
  loadDemoSampleLogs: () => void;
  clearDemoLogs: () => void;
}

const LifeHQContext = createContext<LifeHQContextValue | null>(null);

export const LifeHQProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AppState>(() => createEmptyState());
  const [activeSection, setActiveSection] = useState<NavSection>('today');
  const [pillarTab, setPillarTab] = useState<PillarTab>('faith');
  const [toast, setToast] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [cloudAuthReady, setCloudAuthReady] = useState<boolean>(false);
  const [cloudLoading, setCloudLoading] = useState<boolean>(true);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<
    'local-only' | 'synced' | 'syncing' | 'error'
  >('local-only');
  const [legacyBackupInfo, setLegacyBackupInfo] = useState<LegacyLocalBackupInfo>(
    () => inspectLegacyLocalBackup()
  );
  const [now, setNow] = useState(() => getLondonNow());
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );

  const workspaceUnsubRef = useRef<(() => void) | null>(null);
  const verifiedUidRef = useRef<string | null>(null);
  const initializingRootUidRef = useRef<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(getLondonNow()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isDark =
    state.settings.theme === 'dark' ||
    (state.settings.theme === 'system' && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Save per-UID cache only for the active verified user
  useEffect(() => {
    if (!cloudUser || !cloudUser.emailVerified) return;
    if (verifiedUidRef.current !== cloudUser.uid) return;
    const res = saveUserCache(cloudUser.uid, state);
    setStorageError(res.ok ? null : res.error ?? 'Storage failed');
  }, [cloudUser, state]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3200);
  }, []);

  const refreshLegacyBackupInfo = useCallback(() => {
    setLegacyBackupInfo(inspectLegacyLocalBackup());
  }, []);

  const clearDetectedLegacyBackup = useCallback(() => {
    clearLegacyLocalBackup();
    setLegacyBackupInfo(inspectLegacyLocalBackup());
    showToast('Legacy browser data removed from this device');
  }, [showToast]);

  // Auth listener & real-time Firestore workspace subscription
  useEffect(() => {
    const unsubAuth = subscribeAuth((user) => {
      if (workspaceUnsubRef.current) {
        workspaceUnsubRef.current();
        workspaceUnsubRef.current = null;
      }
      initializingRootUidRef.current = null;
      setCloudUser(user);
      setCloudError(null);

      if (!user || !user.emailVerified) {
        verifiedUidRef.current = null;
        setState(createEmptyState());
        setCloudSyncStatus('local-only');
        setCloudLoading(false);
        setCloudAuthReady(true);
        return;
      }

      verifiedUidRef.current = user.uid;
      setLegacyBackupInfo(inspectLegacyLocalBackup());
      const cached = loadUserCache(user.uid);
      setState(cached ?? createEmptyState());
      setCloudLoading(true);
      setCloudSyncStatus('syncing');
      setCloudAuthReady(true);

      workspaceUnsubRef.current = subscribeUserWorkspace(user.uid, {
        onState: (remoteState) => {
          if (verifiedUidRef.current !== user.uid) return;
          setState(remoteState);
          saveUserCache(user.uid, remoteState);
          setCloudSyncStatus('synced');
          setCloudLoading(false);
          setCloudError(null);
          setStorageError(null);
        },
        onMissingRoot: () => {
          if (verifiedUidRef.current !== user.uid) return;
          if (initializingRootUidRef.current === user.uid) return;
          initializingRootUidRef.current = user.uid;
          void ensureEmptyWorkspaceInitialized(user.uid).catch((err) => {
            console.error('Failed to initialize workspace:', err);
            initializingRootUidRef.current = null;
            setCloudSyncStatus('error');
            setCloudError('Could not initialize your workspace in Firestore.');
            setCloudLoading(false);
          });
        },
        onError: (err) => {
          if (verifiedUidRef.current !== user.uid) return;
          console.error('Workspace subscription error:', err);
          setCloudSyncStatus('error');
          setCloudError(
            'Could not sync with Firestore. Check your connection or account access.'
          );
          setStorageError(
            'Cloud sync error — displaying last cached data for your account.'
          );
          setCloudLoading(false);
        },
      });
    });

    return () => {
      unsubAuth();
      if (workspaceUnsubRef.current) {
        workspaceUnsubRef.current();
        workspaceUnsubRef.current = null;
      }
    };
  }, []);

  const signInCloud = useCallback(async () => {
    setCloudError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google sign-in error:', err);
      setCloudError('Google sign-in was cancelled or blocked by your browser.');
      showToast('Sign-in cancelled or blocked');
    }
  }, [showToast]);

  const signOutCloud = useCallback(async () => {
    if (workspaceUnsubRef.current) {
      workspaceUnsubRef.current();
      workspaceUnsubRef.current = null;
    }
    verifiedUidRef.current = null;
    initializingRootUidRef.current = null;
    await signOutFirebase();
    setState(createEmptyState());
    setCloudSyncStatus('local-only');
    setCloudError(null);
    setStorageError(null);
    setActiveSection('today');
    showToast('Signed out');
  }, [showToast]);

  const runCloudOp = useCallback(
    (fn: (uid: string) => Promise<void>) => {
      if (!cloudUser || !cloudUser.emailVerified) return;
      setCloudSyncStatus('syncing');
      fn(cloudUser.uid)
        .then(() => {
          setCloudSyncStatus('synced');
          setCloudError(null);
        })
        .catch((err) => {
          console.error('Cloud sync error:', err);
          setCloudSyncStatus('error');
          setCloudError('A change could not be synced to Firestore.');
        });
    },
    [cloudUser]
  );

  const getCategoryMeta = useCallback(
    (id: CategoryId) => {
      const base = CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[4];
      return {
        ...base,
        colour: state.settings.categoryColours[id] ?? base.colour,
      };
    },
    [state.settings.categoryColours]
  );

  // ========================
  // EVENTS & CONFIRMATIONS
  // ========================
  const upsertEvent = useCallback(
    (event: CalendarEvent) => {
      setState((prev) => {
        const exists = prev.events.some((e) => e.id === event.id);
        const events = exists
          ? prev.events.map((e) => (e.id === event.id ? event : e))
          : [...prev.events, event];

        const habits = prev.habits.map((h) => {
          const currentlyIncludes = Boolean(h.linkedEventIds?.includes(event.id));
          const shouldInclude = event.linkedHabitId === h.id;
          if (shouldInclude && !currentlyIncludes) {
            const nextIds = [...(h.linkedEventIds ?? []), event.id];
            const updatedHabit = { ...h, linkedEventIds: nextIds };
            runCloudOp((uid) =>
              syncDoc(
                uid,
                'habits',
                h.id,
                updatedHabit as unknown as Record<string, unknown>
              )
            );
            return updatedHabit;
          }
          if (!shouldInclude && currentlyIncludes && exists) {
            // Only remove if user explicitly changed/cleared linkedHabitId on existing event
            const prevEvent = prev.events.find((e) => e.id === event.id);
            if (prevEvent && prevEvent.linkedHabitId !== event.linkedHabitId) {
              const nextIds = (h.linkedEventIds ?? []).filter(
                (id) => id !== event.id
              );
              const updatedHabit = { ...h };
              if (nextIds.length > 0) updatedHabit.linkedEventIds = nextIds;
              else delete updatedHabit.linkedEventIds;
              runCloudOp((uid) =>
                syncDoc(
                  uid,
                  'habits',
                  h.id,
                  updatedHabit as unknown as Record<string, unknown>
                )
              );
              return updatedHabit;
            }
          }
          return h;
        });

        return { ...prev, events, habits };
      });
      runCloudOp((uid) => syncDoc(uid, 'events', event.id, event as unknown as Record<string, unknown>));
      showToast('Event saved');
    },
    [runCloudOp, showToast]
  );

  const deleteEvent = useCallback(
    (eventId: string) => {
      setState((prev) => {
        const habits = prev.habits.map((h) => {
          if (!h.linkedEventIds?.includes(eventId)) return h;
          const nextIds = h.linkedEventIds.filter((id) => id !== eventId);
          const updatedHabit = { ...h };
          if (nextIds.length > 0) updatedHabit.linkedEventIds = nextIds;
          else delete updatedHabit.linkedEventIds;
          runCloudOp((uid) =>
            syncDoc(
              uid,
              'habits',
              h.id,
              updatedHabit as unknown as Record<string, unknown>
            )
          );
          return updatedHabit;
        });
        return {
          ...prev,
          events: prev.events.filter((e) => e.id !== eventId),
          habits,
        };
      });
      runCloudOp((uid) => removeDoc(uid, 'events', eventId));
      showToast('Event deleted');
    },
    [runCloudOp, showToast]
  );

  const editOccurrenceException = useCallback(
    (eventId: string, originalDate: string, exception: EventException) => {
      setState((prev) => {
        let updatedEvent: CalendarEvent | null = null;
        const events = prev.events.map((ev) => {
          if (ev.id !== eventId) return ev;
          updatedEvent = {
            ...ev,
            exceptions: {
              ...(ev.exceptions ?? {}),
              [originalDate]: {
                ...(ev.exceptions?.[originalDate] ?? {}),
                ...exception,
              },
            },
          };
          return updatedEvent;
        });
        if (updatedEvent) {
          const evCopy = updatedEvent;
          runCloudOp((uid) => syncDoc(uid, 'events', eventId, evCopy as unknown as Record<string, unknown>));
        }
        return { ...prev, events };
      });
      showToast(exception.deleted ? 'Occurrence removed' : 'Occurrence updated');
    },
    [runCloudOp, showToast]
  );

  const confirmOccurrence = useCallback(
    (
      occ: EventOccurrence,
      status: ActivityOutcomeStatus,
      actualMinutesOverride?: number,
      notes?: string
    ) => {
      const nowIso = new Date().toISOString();
      const isCancelledOrSkipped = status === 'cancelled' || status === 'skipped';
      const actualMinutes = isCancelledOrSkipped
        ? 0
        : actualMinutesOverride ?? occ.durationMinutes;

      setState((prev) => {
        const existingIdx = prev.activityRecords.findIndex(
          (r) =>
            r.sourceType === 'scheduled' &&
            r.eventId === occ.eventId &&
            r.occurrenceDate === occ.originalDate
        );

        const record: ActivityRecord = {
          id:
            existingIdx >= 0
              ? prev.activityRecords[existingIdx].id
              : `act-${occ.eventId}-${occ.originalDate}`,
          sourceType: 'scheduled',
          eventId: occ.eventId,
          occurrenceDate: occ.originalDate,
          date: occ.date,
          startTime: occ.startTime,
          endTime:
            actualMinutes > 0
              ? minutesToTime(timeToMinutes(occ.startTime) + actualMinutes)
              : occ.endTime,
          scheduledMinutes: occ.durationMinutes,
          actualMinutes,
          status,
          category: occ.category,
          subcategory: occ.subcategory,
          title: occ.title,
          notes: notes ?? occ.notes,
          createdAt:
            existingIdx >= 0
              ? prev.activityRecords[existingIdx].createdAt
              : nowIso,
          updatedAt: nowIso,
        };

        const activityRecords =
          existingIdx >= 0
            ? prev.activityRecords.map((r, i) => (i === existingIdx ? record : r))
            : [...prev.activityRecords, record];

        runCloudOp((uid) =>
          syncDoc(uid, 'activityRecords', record.id, record as unknown as Record<string, unknown>)
        );

        let habitLogs = prev.habitLogs;
        const matchedHabitIds = new Set<string>();
        if (occ.linkedHabitId) matchedHabitIds.add(occ.linkedHabitId);
        for (const h of prev.habits) {
          if (!h.archived && h.linkedEventIds?.includes(occ.eventId)) {
            matchedHabitIds.add(h.id);
          }
        }

        if (matchedHabitIds.size > 0) {
          for (const habitId of matchedHabitIds) {
            const logId = `${habitId}_${occ.date}`;
            let mappedStatus: HabitLogStatus | null = null;
            let autoNote: string | undefined;
            if (status === 'completed') mappedStatus = 'done';
            else if (status === 'partial') mappedStatus = 'partial';
            else if (status === 'cancelled') {
              mappedStatus = 'excused';
              autoNote = 'Calendar commitment cancelled';
            } else if (status === 'skipped') {
              mappedStatus = 'skipped';
            }

            if (mappedStatus) {
              const existingLog = habitLogs.find((l) => l.id === logId);
              const newLog: HabitLog = {
                id: logId,
                habitId,
                date: occ.date,
                status: mappedStatus,
                source: 'calendar',
                ...(autoNote ? { notes: autoNote } : existingLog?.notes ? { notes: existingLog.notes } : {}),
                ...(actualMinutes > 0 ? { actualValue: actualMinutes } : {}),
                updatedAt: nowIso,
              };
              habitLogs = existingLog
                ? habitLogs.map((l) => (l.id === logId ? newLog : l))
                : [...habitLogs, newLog];
              runCloudOp((uid) =>
                syncDoc(
                  uid,
                  'habitLogs',
                  logId,
                  newLog as unknown as Record<string, unknown>
                )
              );
            }
          }
        }

        let events = prev.events;
        if (status === 'cancelled') {
          events = prev.events.map((ev) => {
            if (ev.id !== occ.eventId) return ev;
            const updated = {
              ...ev,
              exceptions: {
                ...(ev.exceptions ?? {}),
                [occ.originalDate]: {
                  ...(ev.exceptions?.[occ.originalDate] ?? {}),
                  commitmentStatus: 'tentative' as const,
                },
              },
            };
            runCloudOp((uid) =>
              syncDoc(uid, 'events', ev.id, updated as unknown as Record<string, unknown>)
            );
            return updated;
          });
        }

        return { ...prev, activityRecords, habitLogs, events };
      });

      const labels: Record<ActivityOutcomeStatus, string> = {
        completed: 'Marked completed',
        partial: 'Marked partially completed',
        skipped: 'Marked skipped',
        cancelled: 'Marked cancelled (no penalty)',
        rescheduled: 'Marked rescheduled',
      };
      showToast(labels[status]);
    },
    [runCloudOp, showToast]
  );

  const clearOccurrenceConfirmation = useCallback(
    (eventId: string, occurrenceDate: string) => {
      setState((prev) => {
        const target = prev.activityRecords.find(
          (r) =>
            r.sourceType === 'scheduled' &&
            r.eventId === eventId &&
            r.occurrenceDate === occurrenceDate
        );
        if (target) {
          runCloudOp((uid) => removeDoc(uid, 'activityRecords', target.id));
        }
        const linkedHabitIds = new Set<string>();
        const ev = prev.events.find((e) => e.id === eventId);
        if (ev?.linkedHabitId) linkedHabitIds.add(ev.linkedHabitId);
        for (const h of prev.habits) {
          if (h.linkedEventIds?.includes(eventId)) linkedHabitIds.add(h.id);
        }
        const targetDate = target?.date ?? occurrenceDate;
        const removedLogIds = new Set<string>();
        const habitLogs = prev.habitLogs.filter((l) => {
          if (
            l.source === 'calendar' &&
            l.date === targetDate &&
            linkedHabitIds.has(l.habitId)
          ) {
            removedLogIds.add(l.id);
            return false;
          }
          return true;
        });
        removedLogIds.forEach((id) =>
          runCloudOp((uid) => removeDoc(uid, 'habitLogs', id))
        );
        return {
          ...prev,
          habitLogs,
          activityRecords: prev.activityRecords.filter(
            (r) =>
              !(
                r.sourceType === 'scheduled' &&
                r.eventId === eventId &&
                r.occurrenceDate === occurrenceDate
              )
          ),
        };
      });
      showToast('Confirmation cleared');
    },
    [runCloudOp, showToast]
  );

  const importEvents = useCallback(
    (eventsToAdd: CalendarEvent[]) => {
      setState((prev) => ({
        ...prev,
        events: [...prev.events, ...eventsToAdd],
      }));
      eventsToAdd.forEach((ev) => {
        runCloudOp((uid) =>
          syncDoc(uid, 'events', ev.id, ev as unknown as Record<string, unknown>)
        );
      });
    },
    [runCloudOp]
  );

  // ========================
  // TIMER & MANUAL LOGS
  // ========================
  const startTimer: LifeHQContextValue['startTimer'] = useCallback(
    (payload) => {
      const timer: ActiveTimerState = {
        id: `timer-${Date.now()}`,
        isRunning: true,
        startedAtMs: Date.now(),
        accumulatedMs: 0,
        category: payload.category,
        subcategory: payload.subcategory,
        title: payload.title,
        project: payload.project ?? '',
        notes: payload.notes ?? '',
        linkedEventId: payload.linkedEventId,
        linkedOccurrenceDate: payload.linkedOccurrenceDate,
      };
      setState((prev) => ({ ...prev, activeTimer: timer }));
      runCloudOp((uid) => syncActiveTimer(uid, timer));
      showToast(`Timer started: ${payload.title}`);
    },
    [runCloudOp, showToast]
  );

  const pauseTimer = useCallback(() => {
    setState((prev) => {
      if (!prev.activeTimer || !prev.activeTimer.isRunning) return prev;
      const elapsed = prev.activeTimer.startedAtMs
        ? Date.now() - prev.activeTimer.startedAtMs
        : 0;
      const updated: ActiveTimerState = {
        ...prev.activeTimer,
        isRunning: false,
        startedAtMs: null,
        accumulatedMs: prev.activeTimer.accumulatedMs + elapsed,
      };
      runCloudOp((uid) => syncActiveTimer(uid, updated));
      return { ...prev, activeTimer: updated };
    });
  }, [runCloudOp]);

  const resumeTimer = useCallback(() => {
    setState((prev) => {
      if (!prev.activeTimer || prev.activeTimer.isRunning) return prev;
      const updated: ActiveTimerState = {
        ...prev.activeTimer,
        isRunning: true,
        startedAtMs: Date.now(),
      };
      runCloudOp((uid) => syncActiveTimer(uid, updated));
      return { ...prev, activeTimer: updated };
    });
  }, [runCloudOp]);

  const discardTimer = useCallback(() => {
    setState((prev) => ({ ...prev, activeTimer: null }));
    runCloudOp((uid) => syncActiveTimer(uid, null));
    showToast('Timer discarded');
  }, [runCloudOp, showToast]);

  const stopAndSaveTimer = useCallback(
    (adjustedMinutes?: number) => {
      setState((prev) => {
        const t = prev.activeTimer;
        if (!t) return prev;
        const totalMs =
          t.accumulatedMs +
          (t.isRunning && t.startedAtMs ? Date.now() - t.startedAtMs : 0);
        const computedMinutes = Math.max(1, Math.round(totalMs / 60000));
        const actualMinutes =
          adjustedMinutes !== undefined
            ? Math.max(1, adjustedMinutes)
            : computedMinutes;

        const currentLondon = getLondonNow();
        const endMinutes = currentLondon.minutes;
        const startMinutes = Math.max(0, endMinutes - actualMinutes);
        const nowIso = new Date().toISOString();

        if (prev.activityRecords.some((r) => r.id === t.id)) {
          runCloudOp((uid) => syncActiveTimer(uid, null));
          return { ...prev, activeTimer: null };
        }

        const newRecord: ActivityRecord = {
          id: t.id,
          sourceType: 'timer',
          eventId: t.linkedEventId,
          occurrenceDate: t.linkedOccurrenceDate,
          date: currentLondon.date,
          startTime: minutesToTime(startMinutes),
          endTime: minutesToTime(endMinutes),
          actualMinutes,
          status: 'completed',
          category: t.category,
          subcategory: t.subcategory,
          title: t.title,
          project: t.project || undefined,
          notes: t.notes || undefined,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        runCloudOp(async (uid) => {
          await syncDoc(
            uid,
            'activityRecords',
            newRecord.id,
            newRecord as unknown as Record<string, unknown>
          );
          await syncActiveTimer(uid, null);
        });

        return {
          ...prev,
          activeTimer: null,
          activityRecords: [newRecord, ...prev.activityRecords],
        };
      });
      showToast('Activity session saved');
    },
    [runCloudOp, showToast]
  );

  const addManualLog: LifeHQContextValue['addManualLog'] = useCallback(
    (log) => {
      const nowIso = new Date().toISOString();
      const record: ActivityRecord = {
        ...log,
        id: `man-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sourceType: 'manual',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        activityRecords: [record, ...prev.activityRecords],
      }));
      runCloudOp((uid) =>
        syncDoc(
          uid,
          'activityRecords',
          record.id,
          record as unknown as Record<string, unknown>
        )
      );
      showToast('Activity logged');
    },
    [runCloudOp, showToast]
  );

  const updateActivityRecord = useCallback(
    (id: string, patch: Partial<ActivityRecord>) => {
      setState((prev) => {
        let updatedRec: ActivityRecord | null = null;
        const activityRecords = prev.activityRecords.map((r) => {
          if (r.id !== id) return r;
          updatedRec = { ...r, ...patch, updatedAt: new Date().toISOString() };
          return updatedRec;
        });
        if (updatedRec) {
          const recCopy = updatedRec;
          runCloudOp((uid) =>
            syncDoc(
              uid,
              'activityRecords',
              id,
              recCopy as unknown as Record<string, unknown>
            )
          );
        }
        return { ...prev, activityRecords };
      });
      showToast('Log updated');
    },
    [runCloudOp, showToast]
  );

  const deleteActivityRecord = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        activityRecords: prev.activityRecords.filter((r) => r.id !== id),
      }));
      runCloudOp((uid) => removeDoc(uid, 'activityRecords', id));
      showToast('Log removed');
    },
    [runCloudOp, showToast]
  );

  // ========================
  // PRIORITIES
  // ========================
  const addPriority = useCallback(
    (title: string, category: CategoryId, date?: string) => {
      const targetDate = date ?? getLondonNow().date;
      const task: PriorityTask = {
        id: `prio-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        title: title.trim(),
        category,
        date: targetDate,
        completed: false,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({ ...prev, priorities: [...prev.priorities, task] }));
      runCloudOp((uid) =>
        syncDoc(
          uid,
          'priorities',
          task.id,
          task as unknown as Record<string, unknown>
        )
      );
      showToast('Priority added');
    },
    [runCloudOp, showToast]
  );

  const togglePriority = useCallback(
    (id: string) => {
      setState((prev) => {
        let updated: PriorityTask | null = null;
        const priorities = prev.priorities.map((p) => {
          if (p.id !== id) return p;
          updated = { ...p, completed: !p.completed };
          return updated;
        });
        if (updated) {
          const copy = updated;
          runCloudOp((uid) =>
            syncDoc(
              uid,
              'priorities',
              id,
              copy as unknown as Record<string, unknown>
            )
          );
        }
        return { ...prev, priorities };
      });
    },
    [runCloudOp]
  );

  const updatePriority = useCallback(
    (id: string, patch: Partial<PriorityTask>) => {
      setState((prev) => {
        let updated: PriorityTask | null = null;
        const priorities = prev.priorities.map((p) => {
          if (p.id !== id) return p;
          updated = { ...p, ...patch };
          return updated;
        });
        if (updated) {
          const copy = updated;
          runCloudOp((uid) =>
            syncDoc(
              uid,
              'priorities',
              id,
              copy as unknown as Record<string, unknown>
            )
          );
        }
        return { ...prev, priorities };
      });
    },
    [runCloudOp]
  );

  const postponePriority = useCallback(
    (id: string, toDate?: string) => {
      setState((prev) => {
        let updated: PriorityTask | null = null;
        const priorities = prev.priorities.map((p) => {
          if (p.id !== id) return p;
          updated = { ...p, date: toDate ?? addDays(p.date, 1), completed: false };
          return updated;
        });
        if (updated) {
          const copy = updated;
          runCloudOp((uid) =>
            syncDoc(
              uid,
              'priorities',
              id,
              copy as unknown as Record<string, unknown>
            )
          );
        }
        return { ...prev, priorities };
      });
      showToast('Postponed to tomorrow');
    },
    [runCloudOp, showToast]
  );

  const deletePriority = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        priorities: prev.priorities.filter((p) => p.id !== id),
      }));
      runCloudOp((uid) => removeDoc(uid, 'priorities', id));
    },
    [runCloudOp]
  );

  // ========================
  // HABITS
  // ========================
  const setHabitStatus = useCallback(
    (
      habitId: string,
      date: string,
      status: HabitLogStatus | 'clear',
      source: 'manual' | 'calendar' = 'manual',
      notes?: string,
      actualValue?: number
    ) => {
      const id = `${habitId}_${date}`;
      setState((prev) => {
        const filtered = prev.habitLogs.filter((l) => l.id !== id);
        if (status === 'clear') {
          runCloudOp((uid) => removeDoc(uid, 'habitLogs', id));
          return { ...prev, habitLogs: filtered };
        }
        const trimmedNote = notes?.trim();
        const entry: HabitLog = {
          id,
          habitId,
          date,
          status,
          source,
          ...(trimmedNote ? { notes: trimmedNote.slice(0, 500) } : {}),
          ...(actualValue !== undefined && actualValue >= 0
            ? { actualValue }
            : {}),
          updatedAt: new Date().toISOString(),
        };
        runCloudOp((uid) =>
          syncDoc(
            uid,
            'habitLogs',
            id,
            entry as unknown as Record<string, unknown>
          )
        );
        return {
          ...prev,
          habitLogs: [...filtered, entry],
        };
      });
    },
    [runCloudOp]
  );

  const logStarterAttempt = useCallback(
    (
      habitId: string,
      date: string,
      notes?: string,
      durationSeconds?: number
    ) => {
      const id = `${habitId}_${date}_starter`;
      const trimmedNote = notes?.trim();
      const entry: HabitLog = {
        id,
        habitId,
        date,
        status: 'starter',
        source: 'manual',
        ...(trimmedNote ? { notes: trimmedNote.slice(0, 500) } : {}),
        ...(durationSeconds !== undefined && durationSeconds >= 0
          ? { actualValue: Math.min(10000, Math.round(durationSeconds)) }
          : {}),
        updatedAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        habitLogs: [...prev.habitLogs.filter((l) => l.id !== id), entry],
      }));
      runCloudOp((uid) =>
        syncDoc(
          uid,
          'habitLogs',
          id,
          entry as unknown as Record<string, unknown>
        )
      );
      showToast('Two-minute starter attempt recorded');
    },
    [runCloudOp, showToast]
  );

  const clearStarterAttempt = useCallback(
    (habitId: string, date: string) => {
      const id = `${habitId}_${date}_starter`;
      setState((prev) => ({
        ...prev,
        habitLogs: prev.habitLogs.filter((l) => l.id !== id),
      }));
      runCloudOp((uid) => removeDoc(uid, 'habitLogs', id));
    },
    [runCloudOp]
  );

  const updateHabitStack: LifeHQContextValue['updateHabitStack'] = useCallback(
    (habitId, stack) => {
      setState((prev) => {
        let updated: Habit | null = null;
        const habits = prev.habits.map((h) => {
          if (h.id !== habitId) return h;
          const next = { ...h };
          if (!stack) {
            delete next.stackAnchorEventId;
            delete next.stackAnchorLabel;
            delete next.stackAction;
            delete next.preferredWindowStart;
            delete next.preferredWindowEnd;
          } else {
            if (stack.stackAnchorEventId)
              next.stackAnchorEventId = stack.stackAnchorEventId;
            else delete next.stackAnchorEventId;

            if (stack.stackAnchorLabel?.trim())
              next.stackAnchorLabel = stack.stackAnchorLabel.trim().slice(0, 160);
            else delete next.stackAnchorLabel;

            if (stack.stackAction?.trim())
              next.stackAction = stack.stackAction.trim().slice(0, 200);
            else delete next.stackAction;

            if (stack.preferredWindowStart)
              next.preferredWindowStart = stack.preferredWindowStart;
            else delete next.preferredWindowStart;

            if (stack.preferredWindowEnd)
              next.preferredWindowEnd = stack.preferredWindowEnd;
            else delete next.preferredWindowEnd;
          }
          updated = next;
          return next;
        });
        if (updated) {
          const copy = updated;
          runCloudOp((uid) =>
            syncDoc(
              uid,
              'habits',
              habitId,
              copy as unknown as Record<string, unknown>
            )
          );
        }
        return { ...prev, habits };
      });
      showToast(stack ? 'Habit stack updated' : 'Habit stack link removed');
    },
    [runCloudOp, showToast]
  );

  const toggleHabitPause = useCallback(
    (habitId: string) => {
      setState((prev) => {
        let updated: Habit | null = null;
        const habits = prev.habits.map((h) => {
          if (h.id !== habitId) return h;
          updated = { ...h, paused: !h.paused };
          return updated;
        });
        if (updated) {
          const copy = updated;
          runCloudOp((uid) =>
            syncDoc(
              uid,
              'habits',
              habitId,
              copy as unknown as Record<string, unknown>
            )
          );
        }
        return { ...prev, habits };
      });
    },
    [runCloudOp]
  );

  const toggleHabitArchive = useCallback(
    (habitId: string) => {
      let nowArchived = false;
      setState((prev) => {
        let updated: Habit | null = null;
        const habits = prev.habits.map((h) => {
          if (h.id !== habitId) return h;
          nowArchived = !Boolean(h.archived);
          updated = { ...h, archived: nowArchived };
          return updated;
        });
        if (updated) {
          const copy = updated;
          runCloudOp((uid) =>
            syncDoc(
              uid,
              'habits',
              habitId,
              copy as unknown as Record<string, unknown>
            )
          );
        }
        return { ...prev, habits };
      });
      showToast(nowArchived ? 'Habit archived' : 'Habit restored');
    },
    [runCloudOp, showToast]
  );

  const addHabit = useCallback(
    (habit: Omit<Habit, 'id'>) => {
      const created: Habit = {
        ...habit,
        id: `habit-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        createdAt: habit.createdAt ?? getLondonNow().date,
      };
      setState((prev) => ({ ...prev, habits: [...prev.habits, created] }));
      runCloudOp((uid) =>
        syncDoc(
          uid,
          'habits',
          created.id,
          created as unknown as Record<string, unknown>
        )
      );
      showToast('Habit added');
    },
    [runCloudOp, showToast]
  );

  const upsertHabit = useCallback(
    (habit: Habit, linkedEventIds?: string[]) => {
      const cleanHabit: Habit = {
        ...habit,
        linkedEventIds: linkedEventIds ?? habit.linkedEventIds,
      };
      setState((prev) => {
        const exists = prev.habits.some((h) => h.id === cleanHabit.id);
        const habits = exists
          ? prev.habits.map((h) => (h.id === cleanHabit.id ? cleanHabit : h))
          : [...prev.habits, cleanHabit];

        let events = prev.events;
        if (linkedEventIds !== undefined) {
          const linkSet = new Set(linkedEventIds);
          events = prev.events.map((ev) => {
            const shouldLink = linkSet.has(ev.id);
            const currentlyLinkedHere = ev.linkedHabitId === cleanHabit.id;
            if (shouldLink && !currentlyLinkedHere) {
              const updatedEv = { ...ev, linkedHabitId: cleanHabit.id };
              runCloudOp((uid) =>
                syncDoc(
                  uid,
                  'events',
                  ev.id,
                  updatedEv as unknown as Record<string, unknown>
                )
              );
              return updatedEv;
            }
            if (!shouldLink && currentlyLinkedHere) {
              const updatedEv = { ...ev };
              delete updatedEv.linkedHabitId;
              runCloudOp((uid) =>
                syncDoc(
                  uid,
                  'events',
                  ev.id,
                  updatedEv as unknown as Record<string, unknown>
                )
              );
              return updatedEv;
            }
            return ev;
          });
        }

        return { ...prev, habits, events };
      });
      runCloudOp((uid) =>
        syncDoc(
          uid,
          'habits',
          cleanHabit.id,
          cleanHabit as unknown as Record<string, unknown>
        )
      );
      showToast('Habit saved');
    },
    [runCloudOp, showToast]
  );

  const deleteHabit = useCallback(
    (habitId: string) => {
      setState((prev) => {
        const logsToDelete = prev.habitLogs.filter((l) => l.habitId === habitId);
        logsToDelete.forEach((l) =>
          runCloudOp((uid) => removeDoc(uid, 'habitLogs', l.id))
        );
        const events = prev.events.map((ev) => {
          if (ev.linkedHabitId !== habitId) return ev;
          const updated = { ...ev };
          delete updated.linkedHabitId;
          runCloudOp((uid) =>
            syncDoc(
              uid,
              'events',
              ev.id,
              updated as unknown as Record<string, unknown>
            )
          );
          return updated;
        });
        return {
          ...prev,
          habits: prev.habits.filter((h) => h.id !== habitId),
          habitLogs: prev.habitLogs.filter((l) => l.habitId !== habitId),
          events,
        };
      });
      runCloudOp((uid) => removeDoc(uid, 'habits', habitId));
      showToast('Habit deleted');
    },
    [runCloudOp, showToast]
  );

  // ========================
  // GOALS
  // ========================
  const toggleMilestone = useCallback(
    (goalId: string, milestoneId: string) => {
      setState((prev) => {
        let updated: Goal | null = null;
        const goals = prev.goals.map((g) => {
          if (g.id !== goalId) return g;
          const milestones = g.milestones.map((m) =>
            m.id === milestoneId ? { ...m, completed: !m.completed } : m
          );
          updated = { ...g, milestones };
          return updated;
        });
        if (updated) {
          const copy = updated;
          runCloudOp((uid) =>
            syncDoc(
              uid,
              'goals',
              goalId,
              copy as unknown as Record<string, unknown>
            )
          );
        }
        return { ...prev, goals };
      });
    },
    [runCloudOp]
  );

  const upsertGoal = useCallback(
    (goal: Goal) => {
      setState((prev) => {
        const exists = prev.goals.some((g) => g.id === goal.id);
        return {
          ...prev,
          goals: exists
            ? prev.goals.map((g) => (g.id === goal.id ? goal : g))
            : [goal, ...prev.goals],
        };
      });
      runCloudOp((uid) =>
        syncDoc(uid, 'goals', goal.id, goal as unknown as Record<string, unknown>)
      );
      showToast('Goal saved');
    },
    [runCloudOp, showToast]
  );

  const deleteGoal = useCallback(
    (goalId: string) => {
      setState((prev) => ({
        ...prev,
        goals: prev.goals.filter((g) => g.id !== goalId),
      }));
      runCloudOp((uid) => removeDoc(uid, 'goals', goalId));
      showToast('Goal removed');
    },
    [runCloudOp, showToast]
  );

  // ========================
  // WEEKLY REVIEW & SETTINGS
  // ========================
  const saveWeeklyReview = useCallback(
    (entry: Omit<WeeklyReviewEntry, 'savedAt'>) => {
      const full: WeeklyReviewEntry = {
        ...entry,
        savedAt: new Date().toISOString(),
      };
      setState((prev) => {
        const filtered = prev.weeklyReviews.filter(
          (w) => w.weekMonday !== entry.weekMonday
        );
        return { ...prev, weeklyReviews: [full, ...filtered] };
      });
      runCloudOp((uid) =>
        syncDoc(
          uid,
          'weeklyReviews',
          full.weekMonday,
          full as unknown as Record<string, unknown>
        )
      );
      showToast('Weekly review saved');
    },
    [runCloudOp, showToast]
  );

  // ========================
  // PILLARS: FAITH, FITNESS & BEHOLD
  // ========================
  const openPillar = useCallback((tab: PillarTab) => {
    setPillarTab(tab);
    setActiveSection('pillars');
  }, []);

  const upsertDevotionEntry = useCallback(
    (entry: DevotionEntry) => {
      const normalized: DevotionEntry = {
        ...entry,
        updatedAt: new Date().toISOString(),
      };
      setState((prev) => {
        const exists = prev.devotionEntries.some((d) => d.id === normalized.id);
        return {
          ...prev,
          devotionEntries: exists
            ? prev.devotionEntries.map((d) =>
                d.id === normalized.id ? normalized : d
              )
            : [normalized, ...prev.devotionEntries],
        };
      });
      runCloudOp((uid) =>
        syncDoc(
          uid,
          'devotionEntries',
          normalized.id,
          normalized as unknown as Record<string, unknown>
        )
      );
      showToast(
        normalized.routineType === 'morning'
          ? 'Morning reflection saved'
          : 'Evening devotional saved'
      );
    },
    [runCloudOp, showToast]
  );

  const upsertBibleStudy = useCallback(
    (study: BibleStudyNote) => {
      const normalized: BibleStudyNote = {
        ...study,
        updatedAt: new Date().toISOString(),
      };
      setState((prev) => {
        const exists = prev.bibleStudies.some((s) => s.id === normalized.id);
        return {
          ...prev,
          bibleStudies: exists
            ? prev.bibleStudies.map((s) =>
                s.id === normalized.id ? normalized : s
              )
            : [...prev.bibleStudies, normalized],
        };
      });
      runCloudOp((uid) =>
        syncDoc(
          uid,
          'bibleStudies',
          normalized.id,
          normalized as unknown as Record<string, unknown>
        )
      );
      showToast(`Bible study saved: ${normalized.book}`);
    },
    [runCloudOp, showToast]
  );

  const deleteBibleStudy = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        bibleStudies: prev.bibleStudies.filter((s) => s.id !== id),
      }));
      runCloudOp((uid) => removeDoc(uid, 'bibleStudies', id));
      showToast('Study entry removed');
    },
    [runCloudOp, showToast]
  );

  const upsertWorkoutLog = useCallback(
    (log: WorkoutSessionLog, recordInTimeline = false) => {
      const nowIso = new Date().toISOString();
      const normalized: WorkoutSessionLog = {
        ...log,
        updatedAt: nowIso,
      };
      setState((prev) => {
        const exists = prev.workoutLogs.some((w) => w.id === normalized.id);
        const workoutLogs = exists
          ? prev.workoutLogs.map((w) =>
              w.id === normalized.id ? normalized : w
            )
          : [normalized, ...prev.workoutLogs];

        let activityRecords = prev.activityRecords;
        if (recordInTimeline && normalized.completed) {
          const recId = `act-wo-${normalized.id}`;
          const existingScheduled = normalized.linkedEventId
            ? prev.activityRecords.find(
                (r) =>
                  r.sourceType === 'scheduled' &&
                  r.eventId === normalized.linkedEventId &&
                  r.occurrenceDate === normalized.date
              )
            : undefined;
          const existingDirect = prev.activityRecords.find(
            (r) => r.id === recId
          );
          const targetRec = existingScheduled ?? existingDirect;
          const mins = Math.max(15, Math.min(240, normalized.durationMinutes));
          const linkedEv = normalized.linkedEventId
            ? prev.events.find((e) => e.id === normalized.linkedEventId)
            : undefined;
          const startTime = linkedEv?.startTime ?? '16:15';
          const endTime = minutesToTime(timeToMinutes(startTime) + mins);
          const nextRec: ActivityRecord = targetRec
            ? {
                ...targetRec,
                actualMinutes: mins,
                status: 'completed',
                title: normalized.sessionTitle,
                notes: normalized.recoveryNotes || targetRec.notes,
                updatedAt: nowIso,
              }
            : {
                id: recId,
                sourceType: normalized.linkedEventId ? 'scheduled' : 'manual',
                ...(normalized.linkedEventId
                  ? {
                      eventId: normalized.linkedEventId,
                      occurrenceDate: normalized.date,
                    }
                  : {}),
                date: normalized.date,
                startTime,
                endTime,
                actualMinutes: mins,
                status: 'completed',
                category: 'fitness',
                subcategory: 'Strength training',
                title: normalized.sessionTitle,
                ...(normalized.recoveryNotes
                  ? { notes: normalized.recoveryNotes }
                  : {}),
                createdAt: nowIso,
                updatedAt: nowIso,
              };
          activityRecords = targetRec
            ? prev.activityRecords.map((r) =>
                r.id === targetRec.id ? nextRec : r
              )
            : [nextRec, ...prev.activityRecords];
          runCloudOp((uid) =>
            syncDoc(
              uid,
              'activityRecords',
              nextRec.id,
              nextRec as unknown as Record<string, unknown>
            )
          );
        }

        return { ...prev, workoutLogs, activityRecords };
      });
      runCloudOp((uid) =>
        syncDoc(
          uid,
          'workoutLogs',
          normalized.id,
          normalized as unknown as Record<string, unknown>
        )
      );
      showToast(`Workout saved: ${normalized.sessionTitle}`);
    },
    [runCloudOp, showToast]
  );

  const deleteWorkoutLog = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        workoutLogs: prev.workoutLogs.filter((w) => w.id !== id),
      }));
      runCloudOp((uid) => removeDoc(uid, 'workoutLogs', id));
      showToast('Workout log removed');
    },
    [runCloudOp, showToast]
  );

  const upsertCardioLog = useCallback(
    (log: CardioSessionLog, recordInTimeline = false) => {
      const nowIso = new Date().toISOString();
      const normalized: CardioSessionLog = {
        ...log,
        updatedAt: nowIso,
      };
      setState((prev) => {
        const exists = prev.cardioLogs.some((c) => c.id === normalized.id);
        const cardioLogs = exists
          ? prev.cardioLogs.map((c) =>
              c.id === normalized.id ? normalized : c
            )
          : [normalized, ...prev.cardioLogs];

        let activityRecords = prev.activityRecords;
        if (recordInTimeline && normalized.cardioType !== 'skipped') {
          const recId = `act-cardio-${normalized.id}`;
          const linkedEventId =
            normalized.weekType === 'A' ? 'wed-cardio-a' : 'wed-cardio-b';
          const existingScheduled = prev.activityRecords.find(
            (r) =>
              r.sourceType === 'scheduled' &&
              r.eventId === linkedEventId &&
              r.occurrenceDate === normalized.date
          );
          const existingDirect = prev.activityRecords.find(
            (r) => r.id === recId
          );
          const targetRec = existingScheduled ?? existingDirect;
          const mins = Math.max(10, Math.min(180, normalized.durationMinutes));
          const title =
            normalized.cardioType === 'endurance'
              ? 'Wednesday Endurance Cardio (Week A)'
              : normalized.cardioType === 'sprint'
              ? 'Wednesday Sprint Development (Week B)'
              : 'Wednesday Low-Impact Conditioning';
          const nextRec: ActivityRecord = targetRec
            ? {
                ...targetRec,
                actualMinutes: mins,
                status: 'completed',
                title,
                notes: normalized.notes || targetRec.notes,
                updatedAt: nowIso,
              }
            : {
                id: recId,
                sourceType: 'scheduled',
                eventId: linkedEventId,
                occurrenceDate: normalized.date,
                date: normalized.date,
                startTime: '16:45',
                endTime: minutesToTime(timeToMinutes('16:45') + mins),
                actualMinutes: mins,
                status: 'completed',
                category: 'fitness',
                subcategory: 'Conditioning & cardio',
                title,
                ...(normalized.notes ? { notes: normalized.notes } : {}),
                createdAt: nowIso,
                updatedAt: nowIso,
              };
          activityRecords = targetRec
            ? prev.activityRecords.map((r) =>
                r.id === targetRec.id ? nextRec : r
              )
            : [nextRec, ...prev.activityRecords];
          runCloudOp((uid) =>
            syncDoc(
              uid,
              'activityRecords',
              nextRec.id,
              nextRec as unknown as Record<string, unknown>
            )
          );
        }

        return { ...prev, cardioLogs, activityRecords };
      });
      runCloudOp((uid) =>
        syncDoc(
          uid,
          'cardioLogs',
          normalized.id,
          normalized as unknown as Record<string, unknown>
        )
      );
      showToast('Cardio session logged');
    },
    [runCloudOp, showToast]
  );

  const deleteCardioLog = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        cardioLogs: prev.cardioLogs.filter((c) => c.id !== id),
      }));
      runCloudOp((uid) => removeDoc(uid, 'cardioLogs', id));
      showToast('Cardio log removed');
    },
    [runCloudOp, showToast]
  );

  const updateFitnessConfig = useCallback(
    (patch: Partial<FitnessConfig>) => {
      setState((prev) => {
        const nextConfig: FitnessConfig = {
          ...prev.fitnessConfig,
          ...patch,
        };
        runCloudOp((uid) => syncFitnessConfig(uid, nextConfig));
        return { ...prev, fitnessConfig: nextConfig };
      });
    },
    [runCloudOp]
  );

  const logDailyProtein = useCallback(
    (date: string, grams: number | null) => {
      setState((prev) => {
        const nextLogs = { ...prev.fitnessConfig.dailyProteinLogs };
        if (grams === null || Number.isNaN(grams) || grams <= 0) {
          delete nextLogs[date];
        } else {
          nextLogs[date] = Math.round(grams);
        }
        const nextConfig: FitnessConfig = {
          ...prev.fitnessConfig,
          dailyProteinLogs: nextLogs,
        };
        runCloudOp((uid) => syncFitnessConfig(uid, nextConfig));
        return { ...prev, fitnessConfig: nextConfig };
      });
    },
    [runCloudOp]
  );

  const upsertBeholdWeek = useCallback(
    (week: BeholdWeekItem) => {
      const normalized: BeholdWeekItem = {
        ...week,
        updatedAt: new Date().toISOString(),
      };
      setState((prev) => {
        const exists = prev.beholdWeeks.some((b) => b.id === normalized.id);
        return {
          ...prev,
          beholdWeeks: exists
            ? prev.beholdWeeks.map((b) =>
                b.id === normalized.id ? normalized : b
              )
            : [...prev.beholdWeeks, normalized],
        };
      });
      runCloudOp((uid) =>
        syncDoc(
          uid,
          'beholdWeeks',
          normalized.id,
          normalized as unknown as Record<string, unknown>
        )
      );
      showToast(`Saved Week ${normalized.weekNumber}: ${normalized.title}`);
    },
    [runCloudOp, showToast]
  );

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setState((prev) => {
        const nextSettings = { ...prev.settings, ...patch };
        runCloudOp((uid) =>
          syncWorkspaceSettings(uid, nextSettings, prev.migrationMeta)
        );
        return { ...prev, settings: nextSettings };
      });
    },
    [runCloudOp]
  );

  const applyImportedWorkspace = useCallback(
    async (nextState: AppState, mode: ImportMergeMode): Promise<boolean> => {
      if (!cloudUser || !cloudUser.emailVerified) return false;
      setCloudSyncStatus('syncing');
      try {
        if (mode === 'replace-all') {
          await replaceFullWorkspaceInCloud(cloudUser.uid, nextState);
        } else {
          await saveFullWorkspaceToCloud(cloudUser.uid, nextState);
        }
        setState(nextState);
        saveUserCache(cloudUser.uid, nextState);
        setCloudSyncStatus('synced');
        setCloudError(null);
        showToast('Personal workspace imported and synced');
        return true;
      } catch (err) {
        console.error('Import cloud sync error:', err);
        setCloudSyncStatus('error');
        setCloudError('Could not save imported workspace to Firestore.');
        showToast('Cloud import failed — existing data preserved');
        return false;
      }
    },
    [cloudUser, showToast]
  );

  const resetWorkspaceToEmpty = useCallback(async () => {
    const empty = createEmptyState();
    if (cloudUser && cloudUser.emailVerified) {
      setCloudSyncStatus('syncing');
      try {
        await replaceFullWorkspaceInCloud(cloudUser.uid, empty);
        setState(empty);
        saveUserCache(cloudUser.uid, empty);
        setCloudSyncStatus('synced');
        showToast('Workspace reset to empty');
      } catch (err) {
        console.error('Reset workspace error:', err);
        setCloudSyncStatus('error');
        showToast('Could not reset cloud workspace');
      }
    } else {
      setState(empty);
      showToast('Workspace reset to empty');
    }
  }, [cloudUser, showToast]);

  const loadDemoSampleLogs = useCallback(() => {
    const today = getLondonNow().date;
    const sampleDays = [-4, -3, -2, -1];
    const samples: ActivityRecord[] = [];
    const nowIso = new Date().toISOString();

    sampleDays.forEach((offset, idx) => {
      const d = addDays(today, offset);
      samples.push(
        {
          id: `demo-sleep-${d}`,
          sourceType: 'manual',
          date: d,
          startTime: '00:00',
          endTime: '07:00',
          actualMinutes: 420,
          status: 'completed',
          category: 'rest',
          subcategory: 'Sleep',
          title: 'Overnight sleep (sample)',
          isDemoData: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        {
          id: `demo-dev-${d}`,
          sourceType: 'manual',
          date: d,
          startTime: '07:10',
          endTime: '07:25',
          actualMinutes: 15,
          status: 'completed',
          category: 'faith',
          subcategory: 'Devotion',
          title: 'Scripture and prayer (sample)',
          isDemoData: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        }
      );
      if (idx % 2 === 0) {
        samples.push({
          id: `demo-behold-${d}`,
          sourceType: 'timer',
          date: d,
          startTime: '17:30',
          endTime: '19:00',
          actualMinutes: 90,
          status: 'completed',
          category: 'behold',
          subcategory: 'Editing',
          title: 'Focus session (sample)',
          project: 'Sample Project',
          isDemoData: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
      if (idx === 1 || idx === 3) {
        samples.push({
          id: `demo-gym-${d}`,
          sourceType: 'manual',
          date: d,
          startTime: '16:15',
          endTime: '17:30',
          actualMinutes: 75,
          status: 'completed',
          category: 'fitness',
          subcategory: 'Strength training',
          title: 'Gym session (sample)',
          isDemoData: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    });

    setState((prev) => ({
      ...prev,
      activityRecords: [
        ...prev.activityRecords.filter((r) => !r.isDemoData),
        ...samples,
      ],
    }));
    samples.forEach((s) =>
      runCloudOp((uid) =>
        syncDoc(
          uid,
          'activityRecords',
          s.id,
          s as unknown as Record<string, unknown>
        )
      )
    );
    showToast('Sample activity logs loaded (tagged as sample)');
  }, [runCloudOp, showToast]);

  const clearDemoLogs = useCallback(() => {
    setState((prev) => {
      const demoIds = prev.activityRecords
        .filter((r) => r.isDemoData)
        .map((r) => r.id);
      demoIds.forEach((id) =>
        runCloudOp((uid) => removeDoc(uid, 'activityRecords', id))
      );
      return {
        ...prev,
        activityRecords: prev.activityRecords.filter((r) => !r.isDemoData),
      };
    });
    showToast('Sample logs cleared');
  }, [runCloudOp, showToast]);

  // ========================
  // IN-APP REMINDERS ENGINE
  // ========================
  const reminders = useMemo<InAppReminder[]>(() => {
    if (!state.settings.notificationsEnabled) return [];
    const items: InAppReminder[] = [];
    const opts = state.settings.reminderOptions;

    if (opts.upcomingEvents) {
      const todayOccs = expandEventsForRange(
        state.events,
        now.date,
        now.date,
        state.settings,
        state.activityRecords
      );
      for (const occ of todayOccs) {
        if (occ.activityRecord || occ.isRoutineMarker) continue;
        const remMins = occ.reminderMinutes ?? 15;
        const diff = timeToMinutes(occ.startTime) - now.minutes;
        if (diff >= 0 && diff <= remMins) {
          items.push({
            id: `rem-ev-${occ.occurrenceKey}`,
            type: 'event',
            title: `Starting soon: ${occ.title}`,
            detail: `${occ.startTime}–${occ.endTime}${occ.location ? ` · ${occ.location}` : ''}`,
            actionSection: 'today',
          });
        }
      }
    }

    if (opts.unconfirmedMinistry) {
      const next14 = expandEventsForRange(
        state.events,
        now.date,
        addDays(now.date, 14),
        state.settings,
        state.activityRecords
      );
      const tentativeMinistry = next14.filter(
        (o) =>
          o.category === 'faith' &&
          o.commitmentStatus === 'tentative' &&
          !o.activityRecord
      );
      for (const m of tentativeMinistry) {
        items.push({
          id: `rem-min-${m.occurrenceKey}`,
          type: 'ministry',
          title: `Unconfirmed ministry: ${m.title}`,
          detail: `${formatDisplayDate(m.date, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })} at ${m.startTime} — confirm or cancel`,
          actionSection: 'calendar',
        });
      }
    }

    if (opts.dailyHabits && now.minutes >= 19 * 60) {
      const pendingToday = state.habits.filter(
        (h) =>
          !h.paused &&
          !h.archived &&
          h.frequency === 'daily' &&
          !state.habitLogs.some(
            (l) => l.habitId === h.id && l.date === now.date && l.status !== 'starter'
          )
      );
      if (pendingToday.length > 0) {
        items.push({
          id: `rem-hab-${now.date}`,
          type: 'habit',
          title: 'Daily habit check-in',
          detail: `${pendingToday.length} daily habit${pendingToday.length > 1 ? 's' : ''} remaining today.`,
          actionSection: 'habits',
        });
      }
    }

    if (opts.weeklyReview && getIsoWeekday(now.date) === 7) {
      const monday = getMondayOfWeek(now.date);
      const alreadyDone = state.weeklyReviews.some(
        (w) => w.weekMonday === monday
      );
      if (!alreadyDone) {
        items.push({
          id: `rem-rev-${monday}`,
          type: 'review',
          title: 'Sunday Weekly Review due',
          detail: 'Take 5 minutes to review your week and plan ahead.',
          actionSection: 'insights',
        });
      }
    }

    if (opts.goalDeadlines) {
      for (const g of state.goals) {
        if (g.status === 'active' && g.targetDate) {
          const daysLeft = Math.round(
            (new Date(g.targetDate).getTime() - new Date(now.date).getTime()) /
              86400000
          );
          if (daysLeft >= 0 && daysLeft <= 14) {
            items.push({
              id: `rem-goal-${g.id}`,
              type: 'goal',
              title: `Goal approaching: ${g.title}`,
              detail: `Target date ${g.targetDate} (${daysLeft} days remaining).`,
              actionSection: 'goals',
            });
          }
        }
      }
    }

    return items;
  }, [state, now]);

  return (
    <LifeHQContext.Provider
      value={{
        state,
        activeSection,
        setActiveSection,
        pillarTab,
        setPillarTab,
        openPillar,
        isDark,
        toast,
        showToast,
        storageError,
        cloudUser,
        cloudAuthReady,
        cloudLoading,
        cloudError,
        cloudSyncStatus,
        signInCloud,
        signOutCloud,
        legacyBackupInfo,
        refreshLegacyBackupInfo,
        clearDetectedLegacyBackup,
        now,
        reminders,
        getCategoryMeta,
        upsertEvent,
        deleteEvent,
        editOccurrenceException,
        confirmOccurrence,
        clearOccurrenceConfirmation,
        importEvents,
        startTimer,
        pauseTimer,
        resumeTimer,
        discardTimer,
        stopAndSaveTimer,
        addManualLog,
        updateActivityRecord,
        deleteActivityRecord,
        addPriority,
        togglePriority,
        updatePriority,
        postponePriority,
        deletePriority,
        setHabitStatus,
        logStarterAttempt,
        clearStarterAttempt,
        updateHabitStack,
        toggleHabitPause,
        toggleHabitArchive,
        addHabit,
        upsertHabit,
        deleteHabit,
        toggleMilestone,
        upsertGoal,
        deleteGoal,
        saveWeeklyReview,
        upsertDevotionEntry,
        upsertBibleStudy,
        deleteBibleStudy,
        upsertWorkoutLog,
        deleteWorkoutLog,
        upsertCardioLog,
        deleteCardioLog,
        updateFitnessConfig,
        logDailyProtein,
        upsertBeholdWeek,
        updateSettings,
        applyImportedWorkspace,
        resetWorkspaceToEmpty,
        loadDemoSampleLogs,
        clearDemoLogs,
      }}
    >
      {children}
    </LifeHQContext.Provider>
  );
};

export function useLifeHQ() {
  const ctx = useContext(LifeHQContext);
  if (!ctx) throw new Error('useLifeHQ must be used within LifeHQProvider');
  return ctx;
}
