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
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { INITIAL_STATE } from '../data/seedData';
import {
  ActiveTimerState,
  ActivityRecord,
  AppSettings,
  AppState,
  CalendarEvent,
  Goal,
  Habit,
  HabitLog,
  PriorityTask,
  WeeklyReviewEntry,
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
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

function handleFirestoreError(
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

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

function stripOwner<T extends Record<string, unknown>>(docData: T): T {
  const copy = { ...docData };
  delete (copy as Record<string, unknown>).ownerId;
  return copy;
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

    const rootData = rootSnap.data() as AppSettings & {
      ownerId?: string;
      updatedAt?: string;
    };

    const [
      eventsSnap,
      recordsSnap,
      prioritiesSnap,
      habitsSnap,
      habitLogsSnap,
      goalsSnap,
      reviewsSnap,
      timerSnap,
    ] = await Promise.all([
      getDocs(collection(db, `users/${uid}/events`)),
      getDocs(collection(db, `users/${uid}/activityRecords`)),
      getDocs(collection(db, `users/${uid}/priorities`)),
      getDocs(collection(db, `users/${uid}/habits`)),
      getDocs(collection(db, `users/${uid}/habitLogs`)),
      getDocs(collection(db, `users/${uid}/goals`)),
      getDocs(collection(db, `users/${uid}/weeklyReviews`)),
      getDoc(doc(db, `users/${uid}/runtime`, 'activeTimer')),
    ]);

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

    return {
      version: 1,
      settings,
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
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userDocPath);
  }
}

export async function saveFullWorkspaceToCloud(
  uid: string,
  state: AppState
): Promise<void> {
  const basePath = `users/${uid}`;
  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'users', uid),
      stripUndefined({
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
        updatedAt: new Date().toISOString(),
      })
    );

    for (const ev of state.events) {
      batch.set(
        doc(db, `${basePath}/events`, ev.id),
        stripUndefined({ ...ev, ownerId: uid })
      );
    }
    for (const rec of state.activityRecords) {
      batch.set(
        doc(db, `${basePath}/activityRecords`, rec.id),
        stripUndefined({ ...rec, ownerId: uid })
      );
    }
    for (const p of state.priorities) {
      batch.set(
        doc(db, `${basePath}/priorities`, p.id),
        stripUndefined({ ...p, ownerId: uid })
      );
    }
    for (const h of state.habits) {
      batch.set(
        doc(db, `${basePath}/habits`, h.id),
        stripUndefined({ ...h, ownerId: uid })
      );
    }
    for (const l of state.habitLogs) {
      batch.set(
        doc(db, `${basePath}/habitLogs`, l.id),
        stripUndefined({ ...l, ownerId: uid })
      );
    }
    for (const g of state.goals) {
      batch.set(
        doc(db, `${basePath}/goals`, g.id),
        stripUndefined({ ...g, ownerId: uid })
      );
    }
    for (const w of state.weeklyReviews) {
      batch.set(
        doc(db, `${basePath}/weeklyReviews`, w.weekMonday),
        stripUndefined({ ...w, ownerId: uid })
      );
    }
    if (state.activeTimer) {
      batch.set(
        doc(db, `${basePath}/runtime`, 'activeTimer'),
        stripUndefined({ ...state.activeTimer, ownerId: uid })
      );
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, basePath);
  }
}

export async function syncWorkspaceSettings(
  uid: string,
  settings: AppSettings
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
