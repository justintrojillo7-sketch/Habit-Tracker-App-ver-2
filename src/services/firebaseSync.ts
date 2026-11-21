import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  DocumentReference,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  QuerySnapshot,
  setDoc,
  where,
  writeBatch,
  DocumentData,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { INITIAL_STATE } from '../data/seedData';
import { DEFAULT_FITNESS_CONFIG } from '../data/pillarSeedData';
import { migrateAppState } from './migration';
import {
  ActiveTimerState,
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
  MigrationMeta,
  PriorityTask,
  WeeklyReviewEntry,
  WorkoutSessionLog,
} from '../types/lifehq';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

const app = initializeApp(firebaseConfig);

function createFirestoreInstance() {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = createFirestoreInstance();
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

function stripUndefinedValue(val: unknown): unknown {
  if (Array.isArray(val)) {
    return val.map(stripUndefinedValue);
  }
  if (val !== null && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedValue(v);
      }
    }
    return out;
  }
  return val;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return stripUndefinedValue(obj) as T;
}

function stripOwner<T extends Record<string, unknown>>(docData: T): T {
  const copy = { ...docData };
  delete (copy as Record<string, unknown>).ownerId;
  return copy;
}

function buildOwnedQuery(uid: string, subcollection: string) {
  return query(
    collection(db, `users/${uid}/${subcollection}`),
    where('ownerId', '==', uid)
  );
}

const SUBCOLLECTIONS = [
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
] as const;

type RootDocData = AppSettings & {
  ownerId?: string;
  schemaVersion?: number;
  migrationMeta?: MigrationMeta;
  updatedAt?: string;
};

function assembleWorkspaceState(params: {
  rootData: RootDocData;
  events: CalendarEvent[];
  activityRecords: ActivityRecord[];
  priorities: PriorityTask[];
  habits: Habit[];
  habitLogs: HabitLog[];
  goals: Goal[];
  weeklyReviews: WeeklyReviewEntry[];
  activeTimer: ActiveTimerState | null;
  devotionEntries: DevotionEntry[];
  bibleStudies: BibleStudyNote[];
  workoutLogs: WorkoutSessionLog[];
  cardioLogs: CardioSessionLog[];
  beholdWeeks: BeholdWeekItem[];
  fitnessConfig: FitnessConfig | null;
}): AppState {
  const { rootData } = params;
  const settings: AppSettings = {
    ...INITIAL_STATE.settings,
    theme: rootData.theme ?? INITIAL_STATE.settings.theme,
    weekAnchorMonday:
      rootData.weekAnchorMonday ?? INITIAL_STATE.settings.weekAnchorMonday,
    weekAnchorType:
      rootData.weekAnchorType ?? INITIAL_STATE.settings.weekAnchorType,
    weekOverrides: rootData.weekOverrides ?? {},
    schoolHolidays: rootData.schoolHolidays ?? [],
    targetBedtime:
      rootData.targetBedtime ?? INITIAL_STATE.settings.targetBedtime,
    notificationsEnabled: Boolean(rootData.notificationsEnabled),
    reminderOptions: {
      ...INITIAL_STATE.settings.reminderOptions,
      ...(rootData.reminderOptions ?? {}),
    },
    categoryColours: {
      ...INITIAL_STATE.settings.categoryColours,
      ...(rootData.categoryColours ?? {}),
    },
  };

  const schemaVersion = rootData.schemaVersion ?? 3;

  const rawState: AppState = {
    version: schemaVersion,
    settings,
    events: params.events,
    activityRecords: params.activityRecords,
    priorities: params.priorities,
    habits: params.habits,
    habitLogs: params.habitLogs,
    goals: params.goals,
    weeklyReviews: params.weeklyReviews,
    activeTimer: params.activeTimer,
    devotionEntries: params.devotionEntries,
    bibleStudies: params.bibleStudies,
    workoutLogs: params.workoutLogs,
    cardioLogs: params.cardioLogs,
    beholdWeeks: params.beholdWeeks,
    fitnessConfig: params.fitnessConfig ?? { ...DEFAULT_FITNESS_CONFIG },
    ...(rootData.migrationMeta
      ? { migrationMeta: rootData.migrationMeta }
      : {}),
  };

  return migrateAppState(rawState);
}

export function subscribeAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export async function loadUserWorkspace(uid: string): Promise<AppState | null> {
  const userDocPath = `users/${uid}`;
  try {
    const rootSnap = await getDoc(doc(db, 'users', uid));
    if (!rootSnap.exists()) return null;

    const rootData = rootSnap.data() as RootDocData;

    const [
      eventsSnap,
      recordsSnap,
      prioritiesSnap,
      habitsSnap,
      habitLogsSnap,
      goalsSnap,
      reviewsSnap,
      timerSnap,
      devotionsSnap,
      bibleStudiesSnap,
      workoutLogsSnap,
      cardioLogsSnap,
      beholdWeeksSnap,
      fitnessConfigSnap,
    ] = await Promise.all([
      getDocs(buildOwnedQuery(uid, 'events')),
      getDocs(buildOwnedQuery(uid, 'activityRecords')),
      getDocs(buildOwnedQuery(uid, 'priorities')),
      getDocs(buildOwnedQuery(uid, 'habits')),
      getDocs(buildOwnedQuery(uid, 'habitLogs')),
      getDocs(buildOwnedQuery(uid, 'goals')),
      getDocs(buildOwnedQuery(uid, 'weeklyReviews')),
      getDoc(doc(db, `users/${uid}/runtime`, 'activeTimer')),
      getDocs(buildOwnedQuery(uid, 'devotionEntries')),
      getDocs(buildOwnedQuery(uid, 'bibleStudies')),
      getDocs(buildOwnedQuery(uid, 'workoutLogs')),
      getDocs(buildOwnedQuery(uid, 'cardioLogs')),
      getDocs(buildOwnedQuery(uid, 'beholdWeeks')),
      getDoc(doc(db, `users/${uid}/runtime`, 'fitnessConfig')),
    ]);

    return assembleWorkspaceState({
      rootData,
      events: eventsSnap.docs.map((d) => stripOwner(d.data()) as CalendarEvent),
      activityRecords: recordsSnap.docs.map(
        (d) => stripOwner(d.data()) as ActivityRecord
      ),
      priorities: prioritiesSnap.docs.map(
        (d) => stripOwner(d.data()) as PriorityTask
      ),
      habits: habitsSnap.docs.map((d) => stripOwner(d.data()) as Habit),
      habitLogs: habitLogsSnap.docs.map((d) => stripOwner(d.data()) as HabitLog),
      goals: goalsSnap.docs.map((d) => stripOwner(d.data()) as Goal),
      weeklyReviews: reviewsSnap.docs.map(
        (d) => stripOwner(d.data()) as WeeklyReviewEntry
      ),
      activeTimer: timerSnap.exists()
        ? (stripOwner(timerSnap.data()) as ActiveTimerState)
        : null,
      devotionEntries: devotionsSnap.docs.map(
        (d) => stripOwner(d.data()) as DevotionEntry
      ),
      bibleStudies: bibleStudiesSnap.docs.map(
        (d) => stripOwner(d.data()) as BibleStudyNote
      ),
      workoutLogs: workoutLogsSnap.docs.map(
        (d) => stripOwner(d.data()) as WorkoutSessionLog
      ),
      cardioLogs: cardioLogsSnap.docs.map(
        (d) => stripOwner(d.data()) as CardioSessionLog
      ),
      beholdWeeks: beholdWeeksSnap.docs.map(
        (d) => stripOwner(d.data()) as BeholdWeekItem
      ),
      fitnessConfig: fitnessConfigSnap.exists()
        ? (stripOwner(fitnessConfigSnap.data()) as FitnessConfig)
        : null,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userDocPath);
  }
}

export function subscribeUserWorkspace(
  uid: string,
  callbacks: {
    onState: (state: AppState) => void;
    onMissingRoot: () => void;
    onError: (err: Error) => void;
  }
): () => void {
  let disposed = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let notifiedMissing = false;

  const ready = new Set<string>();
  const expectedKeys = [
    'root',
    'activeTimer',
    'fitnessConfig',
    ...SUBCOLLECTIONS,
  ];

  let rootData: RootDocData | null = null;
  let activeTimer: ActiveTimerState | null = null;
  let fitnessConfig: FitnessConfig | null = null;
  const subDocs: Record<(typeof SUBCOLLECTIONS)[number], Array<Record<string, unknown>>> = {
    events: [],
    activityRecords: [],
    priorities: [],
    habits: [],
    habitLogs: [],
    goals: [],
    weeklyReviews: [],
    devotionEntries: [],
    bibleStudies: [],
    workoutLogs: [],
    cardioLogs: [],
    beholdWeeks: [],
  };

  const scheduleEmit = () => {
    if (disposed) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (disposed) return;
      if (!ready.has('root')) return;
      if (!rootData) {
        if (!notifiedMissing) {
          notifiedMissing = true;
          callbacks.onMissingRoot();
        }
        return;
      }
      if (ready.size < expectedKeys.length) return;

      const assembled = assembleWorkspaceState({
        rootData,
        events: subDocs.events as unknown as CalendarEvent[],
        activityRecords: subDocs.activityRecords as unknown as ActivityRecord[],
        priorities: subDocs.priorities as unknown as PriorityTask[],
        habits: subDocs.habits as unknown as Habit[],
        habitLogs: subDocs.habitLogs as unknown as HabitLog[],
        goals: subDocs.goals as unknown as Goal[],
        weeklyReviews: subDocs.weeklyReviews as unknown as WeeklyReviewEntry[],
        activeTimer,
        devotionEntries: subDocs.devotionEntries as unknown as DevotionEntry[],
        bibleStudies: subDocs.bibleStudies as unknown as BibleStudyNote[],
        workoutLogs: subDocs.workoutLogs as unknown as WorkoutSessionLog[],
        cardioLogs: subDocs.cardioLogs as unknown as CardioSessionLog[],
        beholdWeeks: subDocs.beholdWeeks as unknown as BeholdWeekItem[],
        fitnessConfig,
      });
      callbacks.onState(assembled);
    }, 80);
  };

  const onListenerError = (path: string, error: unknown) => {
    if (disposed) return;
    try {
      handleFirestoreError(error, OperationType.GET, path);
    } catch (wrapped) {
      callbacks.onError(
        wrapped instanceof Error ? wrapped : new Error(String(wrapped))
      );
    }
  };

  const unsubs: Array<() => void> = [];

  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        ready.add('root');
        rootData = snap.exists() ? (snap.data() as RootDocData) : null;
        if (rootData) notifiedMissing = false;
        scheduleEmit();
      },
      (err) => onListenerError(`users/${uid}`, err)
    )
  );

  unsubs.push(
    onSnapshot(
      doc(db, `users/${uid}/runtime`, 'activeTimer'),
      (snap) => {
        ready.add('activeTimer');
        activeTimer = snap.exists()
          ? (stripOwner(snap.data()) as ActiveTimerState)
          : null;
        scheduleEmit();
      },
      (err) => onListenerError(`users/${uid}/runtime/activeTimer`, err)
    )
  );

  unsubs.push(
    onSnapshot(
      doc(db, `users/${uid}/runtime`, 'fitnessConfig'),
      (snap) => {
        ready.add('fitnessConfig');
        fitnessConfig = snap.exists()
          ? (stripOwner(snap.data()) as FitnessConfig)
          : null;
        scheduleEmit();
      },
      (err) => onListenerError(`users/${uid}/runtime/fitnessConfig`, err)
    )
  );

  for (const sub of SUBCOLLECTIONS) {
    unsubs.push(
      onSnapshot(
        buildOwnedQuery(uid, sub),
        (snap: QuerySnapshot<DocumentData>) => {
          ready.add(sub);
          subDocs[sub] = snap.docs.map((d) => stripOwner(d.data()));
          scheduleEmit();
        },
        (err) => onListenerError(`users/${uid}/${sub}`, err)
      )
    );
  }

  return () => {
    disposed = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    for (const unsub of unsubs) {
      unsub();
    }
  };
}

export async function ensureEmptyWorkspaceInitialized(uid: string): Promise<void> {
  const basePath = `users/${uid}`;
  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'users', uid),
      stripUndefined({
        ownerId: uid,
        theme: INITIAL_STATE.settings.theme,
        weekAnchorMonday: INITIAL_STATE.settings.weekAnchorMonday,
        weekAnchorType: INITIAL_STATE.settings.weekAnchorType,
        weekOverrides: INITIAL_STATE.settings.weekOverrides,
        schoolHolidays: INITIAL_STATE.settings.schoolHolidays,
        targetBedtime: INITIAL_STATE.settings.targetBedtime,
        notificationsEnabled: INITIAL_STATE.settings.notificationsEnabled,
        reminderOptions: INITIAL_STATE.settings.reminderOptions,
        categoryColours: INITIAL_STATE.settings.categoryColours,
        schemaVersion: 3,
        updatedAt: new Date().toISOString(),
      })
    );
    batch.set(
      doc(db, `${basePath}/runtime`, 'fitnessConfig'),
      stripUndefined({ ...INITIAL_STATE.fitnessConfig, ownerId: uid })
    );
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, basePath);
  }
}

function buildStateWriteList(
  uid: string,
  state: AppState
): Array<{
  ref: DocumentReference<DocumentData>;
  data: Record<string, unknown>;
}> {
  const basePath = `users/${uid}`;
  const writes: Array<{
    ref: DocumentReference<DocumentData>;
    data: Record<string, unknown>;
  }> = [];

  writes.push({
    ref: doc(db, 'users', uid),
    data: stripUndefined({
      ownerId: uid,
      theme: state.settings.theme,
      weekAnchorMonday: state.settings.weekAnchorMonday,
      weekAnchorType: state.settings.weekAnchorType,
      weekOverrides: state.settings.weekOverrides,
      schoolHolidays: state.settings.schoolHolidays,
      targetBedtime: state.settings.targetBedtime,
      notificationsEnabled: state.settings.notificationsEnabled,
      reminderOptions: state.settings.reminderOptions,
      categoryColours: state.settings.categoryColours,
      schemaVersion: 3,
      migrationMeta: state.migrationMeta,
      updatedAt: new Date().toISOString(),
    }),
  });

  for (const ev of state.events) {
    writes.push({
      ref: doc(db, `${basePath}/events`, ev.id),
      data: stripUndefined({ ...ev, ownerId: uid }),
    });
  }
  for (const rec of state.activityRecords) {
    writes.push({
      ref: doc(db, `${basePath}/activityRecords`, rec.id),
      data: stripUndefined({ ...rec, ownerId: uid }),
    });
  }
  for (const p of state.priorities) {
    writes.push({
      ref: doc(db, `${basePath}/priorities`, p.id),
      data: stripUndefined({ ...p, ownerId: uid }),
    });
  }
  for (const h of state.habits) {
    writes.push({
      ref: doc(db, `${basePath}/habits`, h.id),
      data: stripUndefined({ ...h, ownerId: uid }),
    });
  }
  for (const l of state.habitLogs) {
    writes.push({
      ref: doc(db, `${basePath}/habitLogs`, l.id),
      data: stripUndefined({ ...l, ownerId: uid }),
    });
  }
  for (const g of state.goals) {
    writes.push({
      ref: doc(db, `${basePath}/goals`, g.id),
      data: stripUndefined({ ...g, ownerId: uid }),
    });
  }
  for (const w of state.weeklyReviews) {
    writes.push({
      ref: doc(db, `${basePath}/weeklyReviews`, w.weekMonday),
      data: stripUndefined({ ...w, ownerId: uid }),
    });
  }
  for (const d of state.devotionEntries) {
    writes.push({
      ref: doc(db, `${basePath}/devotionEntries`, d.id),
      data: stripUndefined({ ...d, ownerId: uid }),
    });
  }
  for (const b of state.bibleStudies) {
    writes.push({
      ref: doc(db, `${basePath}/bibleStudies`, b.id),
      data: stripUndefined({ ...b, ownerId: uid }),
    });
  }
  for (const wo of state.workoutLogs) {
    writes.push({
      ref: doc(db, `${basePath}/workoutLogs`, wo.id),
      data: stripUndefined({ ...wo, ownerId: uid }),
    });
  }
  for (const c of state.cardioLogs) {
    writes.push({
      ref: doc(db, `${basePath}/cardioLogs`, c.id),
      data: stripUndefined({ ...c, ownerId: uid }),
    });
  }
  for (const bw of state.beholdWeeks) {
    writes.push({
      ref: doc(db, `${basePath}/beholdWeeks`, bw.id),
      data: stripUndefined({ ...bw, ownerId: uid }),
    });
  }
  writes.push({
    ref: doc(db, `${basePath}/runtime`, 'fitnessConfig'),
    data: stripUndefined({ ...state.fitnessConfig, ownerId: uid }),
  });
  if (state.activeTimer) {
    writes.push({
      ref: doc(db, `${basePath}/runtime`, 'activeTimer'),
      data: stripUndefined({ ...state.activeTimer, ownerId: uid }),
    });
  }

  return writes;
}

export async function saveFullWorkspaceToCloud(
  uid: string,
  state: AppState
): Promise<void> {
  const basePath = `users/${uid}`;
  try {
    const writes = buildStateWriteList(uid, state);
    const CHUNK_SIZE = 400;
    for (let i = 0; i < writes.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      for (const item of writes.slice(i, i + CHUNK_SIZE)) {
        batch.set(item.ref, item.data);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, basePath);
  }
}

export async function replaceFullWorkspaceInCloud(
  uid: string,
  state: AppState
): Promise<void> {
  const basePath = `users/${uid}`;
  try {
    const desiredIdsBySub: Record<(typeof SUBCOLLECTIONS)[number], Set<string>> = {
      events: new Set(state.events.map((e) => e.id)),
      activityRecords: new Set(state.activityRecords.map((r) => r.id)),
      priorities: new Set(state.priorities.map((p) => p.id)),
      habits: new Set(state.habits.map((h) => h.id)),
      habitLogs: new Set(state.habitLogs.map((l) => l.id)),
      goals: new Set(state.goals.map((g) => g.id)),
      weeklyReviews: new Set(state.weeklyReviews.map((w) => w.weekMonday)),
      devotionEntries: new Set(state.devotionEntries.map((d) => d.id)),
      bibleStudies: new Set(state.bibleStudies.map((b) => b.id)),
      workoutLogs: new Set(state.workoutLogs.map((w) => w.id)),
      cardioLogs: new Set(state.cardioLogs.map((c) => c.id)),
      beholdWeeks: new Set(state.beholdWeeks.map((b) => b.id)),
    };

    const existingSnaps = await Promise.all(
      SUBCOLLECTIONS.map((sub) => getDocs(buildOwnedQuery(uid, sub)))
    );

    const deletes: DocumentReference<DocumentData>[] = [];
    SUBCOLLECTIONS.forEach((sub, idx) => {
      const keep = desiredIdsBySub[sub];
      for (const d of existingSnaps[idx].docs) {
        if (!keep.has(d.id)) {
          deletes.push(d.ref);
        }
      }
    });

    if (!state.activeTimer) {
      const timerSnap = await getDoc(
        doc(db, `${basePath}/runtime`, 'activeTimer')
      );
      if (timerSnap.exists()) {
        deletes.push(timerSnap.ref);
      }
    }

    const writes = buildStateWriteList(uid, state);

    const CHUNK_SIZE = 400;
    const ops: Array<
      | { kind: 'delete'; ref: DocumentReference<DocumentData> }
      | {
          kind: 'set';
          ref: DocumentReference<DocumentData>;
          data: Record<string, unknown>;
        }
    > = [
      ...deletes.map((ref) => ({ kind: 'delete' as const, ref })),
      ...writes.map((w) => ({ kind: 'set' as const, ref: w.ref, data: w.data })),
    ];

    for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      for (const op of ops.slice(i, i + CHUNK_SIZE)) {
        if (op.kind === 'delete') {
          batch.delete(op.ref);
        } else {
          batch.set(op.ref, op.data);
        }
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, basePath);
  }
}

export async function syncWorkspaceSettings(
  uid: string,
  settings: AppSettings,
  migrationMeta?: MigrationMeta
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await setDoc(
      doc(db, 'users', uid),
      stripUndefined({
        ownerId: uid,
        theme: settings.theme,
        weekAnchorMonday: settings.weekAnchorMonday,
        weekAnchorType: settings.weekAnchorType,
        weekOverrides: settings.weekOverrides,
        schoolHolidays: settings.schoolHolidays,
        targetBedtime: settings.targetBedtime,
        notificationsEnabled: settings.notificationsEnabled,
        reminderOptions: settings.reminderOptions,
        categoryColours: settings.categoryColours,
        schemaVersion: 3,
        ...(migrationMeta ? { migrationMeta } : {}),
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncDoc(
  uid: string,
  subcollection: string,
  docId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const path = `users/${uid}/${subcollection}/${docId}`;
  try {
    await setDoc(
      doc(db, `users/${uid}/${subcollection}`, docId),
      stripUndefined({ ...payload, ownerId: uid })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeDoc(
  uid: string,
  subcollection: string,
  docId: string
): Promise<void> {
  const path = `users/${uid}/${subcollection}/${docId}`;
  try {
    await deleteDoc(doc(db, `users/${uid}/${subcollection}`, docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncActiveTimer(
  uid: string,
  timer: ActiveTimerState | null
): Promise<void> {
  const path = `users/${uid}/runtime/activeTimer`;
  try {
    const ref = doc(db, `users/${uid}/runtime`, 'activeTimer');
    if (!timer) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, stripUndefined({ ...timer, ownerId: uid }));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncFitnessConfig(
  uid: string,
  fitnessConfig: FitnessConfig
): Promise<void> {
  const path = `users/${uid}/runtime/fitnessConfig`;
  try {
    await setDoc(
      doc(db, `users/${uid}/runtime`, 'fitnessConfig'),
      stripUndefined({ ...fitnessConfig, ownerId: uid })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
