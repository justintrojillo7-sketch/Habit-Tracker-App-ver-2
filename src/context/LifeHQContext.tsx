import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { User } from 'firebase/auth';
import { CATEGORIES, INITIAL_STATE } from '../data/seedData';
import {
  ActiveTimerState,
  ActivityOutcomeStatus,
  ActivityRecord,
  AppSettings,
  AppState,
  CalendarEvent,
  CategoryId,
  EventException,
  EventOccurrence,
  Goal,
  Habit,
  HabitLogStatus,
  NavSection,
  PriorityTask,
  WeeklyReviewEntry,
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
  loadLocalState,
  resetLocalState,
  saveLocalState,
} from '../services/storage';
import {
  loadUserWorkspace,
  removeDoc,
  saveFullWorkspaceToCloud,
  signInWithGoogle,
  signOutFirebase,
  subscribeAuth,
  syncActiveTimer,
  syncDoc,
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
  isDark: boolean;
  toast: string | null;
  showToast: (msg: string) => void;
  storageError: string | null;
  cloudUser: User | null;
  cloudLoading: boolean;
  cloudSyncStatus: 'local-only' | 'synced' | 'syncing' | 'error';
  signInCloud: () => Promise<void>;
  signOutCloud: () => Promise<void>;
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
    source?: 'manual' | 'calendar'
  ) => void;
  toggleHabitPause: (habitId: string) => void;
  addHabit: (habit: Omit<Habit, 'id'>) => void;

  toggleMilestone: (goalId: string, milestoneId: string) => void;
  upsertGoal: (goal: Goal) => void;
  deleteGoal: (goalId: string) => void;

  saveWeeklyReview: (entry: Omit<WeeklyReviewEntry, 'savedAt'>) => void;

  updateSettings: (patch: Partial<AppSettings>) => void;
  restoreState: (newState: AppState) => void;
  resetDemoData: () => void;
  loadDemoSampleLogs: () => void;
  clearDemoLogs: () => void;
}

const LifeHQContext = createContext<LifeHQContextValue | null>(null);

export const LifeHQProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AppState>(() => loadLocalState());
  const [activeSection, setActiveSection] = useState<NavSection>('today');
  const [toast, setToast] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [cloudLoading, setCloudLoading] = useState<boolean>(true);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<
    'local-only' | 'synced' | 'syncing' | 'error'
  >('local-only');
  const [now, setNow] = useState(() => getLondonNow());
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );

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

  // Always save to localStorage as immediate cache
  useEffect(() => {
    const res = saveLocalState(state);
    setStorageError(res.ok ? null : res.error ?? 'Storage failed');
  }, [state]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3200);
  }, []);

  // Auth listener & initial cloud hydration
  useEffect(() => {
    return subscribeAuth(async (user) => {
      setCloudUser(user);
      if (!user) {
        setCloudSyncStatus('local-only');
        setCloudLoading(false);
        return;
      }

      setCloudLoading(true);
      setCloudSyncStatus('syncing');
      try {
        const remote = await loadUserWorkspace(user.uid);
        if (remote) {
          setState(remote);
          setCloudSyncStatus('synced');
        } else {
          // Seed cloud workspace with current state on first Google sign-in
          const localCurrent = loadLocalState();
          await saveFullWorkspaceToCloud(user.uid, localCurrent);
          setCloudSyncStatus('synced');
          showToast('Workspace synced to your cloud account');
        }
      } catch (err) {
        console.error('Failed to sync cloud workspace:', err);
        setCloudSyncStatus('error');
        setStorageError(
          'Could not connect to cloud sync; changes are saved locally on this device.'
        );
      } finally {
        setCloudLoading(false);
      }
    });
  }, [showToast]);

  const signInCloud = useCallback(async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google sign-in error:', err);
      showToast('Sign-in cancelled or blocked');
    }
  }, [showToast]);

  const signOutCloud = useCallback(async () => {
    await signOutFirebase();
    setCloudSyncStatus('local-only');
    showToast('Signed out — local device mode active');
  }, [showToast]);

  const runCloudOp = useCallback(
    (fn: (uid: string) => Promise<void>) => {
      if (!cloudUser) return;
      setCloudSyncStatus('syncing');
      fn(cloudUser.uid)
        .then(() => setCloudSyncStatus('synced'))
        .catch((err) => {
          console.error('Cloud sync error:', err);
          setCloudSyncStatus('error');
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
        return { ...prev, events };
      });
      runCloudOp((uid) => syncDoc(uid, 'events', event.id, event as unknown as Record<string, unknown>));
      showToast('Event saved');
    },
    [runCloudOp, showToast]
  );

  const deleteEvent = useCallback(
    (eventId: string) => {
      setState((prev) => ({
        ...prev,
        events: prev.events.filter((e) => e.id !== eventId),
      }));
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
        if (occ.linkedHabitId) {
          const logId = `${occ.linkedHabitId}_${occ.date}`;
          if (status === 'completed' || status === 'partial') {
            const newLog = {
              id: logId,
              habitId: occ.linkedHabitId,
              date: occ.date,
              status: 'done' as const,
              source: 'calendar' as const,
            };
            const exists = habitLogs.some((l) => l.id === logId);
            habitLogs = exists
              ? habitLogs.map((l) => (l.id === logId ? newLog : l))
              : [...habitLogs, newLog];
            runCloudOp((uid) => syncDoc(uid, 'habitLogs', logId, newLog));
          } else if (status === 'cancelled') {
            const exists = habitLogs.some((l) => l.id === logId);
            if (!exists) {
              const newLog = {
                id: logId,
                habitId: occ.linkedHabitId,
                date: occ.date,
                status: 'skipped' as const,
                source: 'calendar' as const,
              };
              habitLogs = [...habitLogs, newLog];
              runCloudOp((uid) => syncDoc(uid, 'habitLogs', logId, newLog));
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
        return {
          ...prev,
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
      source: 'manual' | 'calendar' = 'manual'
    ) => {
      const id = `${habitId}_${date}`;
      setState((prev) => {
        const filtered = prev.habitLogs.filter((l) => l.id !== id);
        if (status === 'clear') {
          runCloudOp((uid) => removeDoc(uid, 'habitLogs', id));
          return { ...prev, habitLogs: filtered };
        }
        const entry = { id, habitId, date, status, source };
        runCloudOp((uid) => syncDoc(uid, 'habitLogs', id, entry));
        return {
          ...prev,
          habitLogs: [...filtered, entry],
        };
      });
    },
    [runCloudOp]
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

  const addHabit = useCallback(
    (habit: Omit<Habit, 'id'>) => {
      const created: Habit = { ...habit, id: `habit-${Date.now()}` };
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

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setState((prev) => {
        const nextSettings = { ...prev.settings, ...patch };
        runCloudOp((uid) => syncWorkspaceSettings(uid, nextSettings));
        return { ...prev, settings: nextSettings };
      });
    },
    [runCloudOp]
  );

  const restoreState = useCallback(
    (newState: AppState) => {
      const merged = { ...INITIAL_STATE, ...newState };
      setState(merged);
      runCloudOp((uid) => saveFullWorkspaceToCloud(uid, merged));
      showToast('Backup restored');
    },
    [runCloudOp, showToast]
  );

  const resetDemoData = useCallback(() => {
    const fresh = resetLocalState();
    setState(fresh);
    runCloudOp((uid) => saveFullWorkspaceToCloud(uid, fresh));
    showToast('Reset to initial schedule');
  }, [runCloudOp, showToast]);

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
          title: 'Video editing (sample)',
          project: 'Portfolio Film',
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
          h.frequency === 'daily' &&
          !state.habitLogs.some((l) => l.habitId === h.id && l.date === now.date)
      );
      if (pendingToday.length > 0) {
        items.push({
          id: `rem-hab-${now.date}`,
          type: 'habit',
          title: 'Daily habit check-in',
          detail: `${pendingToday.length} daily habit${pendingToday.length > 1 ? 's' : ''} remaining today.`,
          actionSection: 'track',
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
        isDark,
        toast,
        showToast,
        storageError,
        cloudUser,
        cloudLoading,
        cloudSyncStatus,
        signInCloud,
        signOutCloud,
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
        toggleHabitPause,
        addHabit,
        toggleMilestone,
        upsertGoal,
        deleteGoal,
        saveWeeklyReview,
        updateSettings,
        restoreState,
        resetDemoData,
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
