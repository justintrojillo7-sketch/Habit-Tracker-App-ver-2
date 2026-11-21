import { AppState } from '../types/lifehq';
import { migrateAppState } from './migration';

export const LEGACY_STORAGE_KEY = 'lifehq_state_v1';
const USER_CACHE_PREFIX = 'lifehq_cache_v2_';

export interface LegacyLocalBackupInfo {
  exists: boolean;
  eventCount: number;
  habitCount: number;
  goalCount: number;
  recordCount: number;
  studyCount: number;
  beholdCount: number;
  rawJson: string | null;
}

function getUserCacheKey(uid: string): string {
  return `${USER_CACHE_PREFIX}${uid}`;
}

export function loadUserCache(uid: string): AppState | null {
  try {
    const raw = localStorage.getItem(getUserCacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return migrateAppState(parsed);
  } catch (err) {
    console.error('Failed to read user cache:', err);
    return null;
  }
}

export function saveUserCache(
  uid: string,
  state: AppState
): { ok: boolean; error?: string } {
  try {
    localStorage.setItem(getUserCacheKey(uid), JSON.stringify(state));
    return { ok: true };
  } catch (err) {
    console.error('Failed to persist user cache:', err);
    return {
      ok: false,
      error: 'Browser storage limit reached or unavailable.',
    };
  }
}

export function clearUserCache(uid: string): void {
  try {
    localStorage.removeItem(getUserCacheKey(uid));
  } catch {
    // Ignore storage removal errors
  }
}

/**
 * Read-only inspection of the pre-auth single-browser key (`lifehq_state_v1`).
 * Never modifies or deletes legacy browser data automatically.
 */
export function inspectLegacyLocalBackup(): LegacyLocalBackupInfo {
  const empty: LegacyLocalBackupInfo = {
    exists: false,
    eventCount: 0,
    habitCount: 0,
    goalCount: 0,
    recordCount: 0,
    studyCount: 0,
    beholdCount: 0,
    rawJson: null,
  };
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<AppState> | null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return empty;
    }
    const eventCount = Array.isArray(parsed.events) ? parsed.events.length : 0;
    const habitCount = Array.isArray(parsed.habits) ? parsed.habits.length : 0;
    const goalCount = Array.isArray(parsed.goals) ? parsed.goals.length : 0;
    const recordCount = Array.isArray(parsed.activityRecords)
      ? parsed.activityRecords.length
      : 0;
    const studyCount = Array.isArray(parsed.bibleStudies)
      ? parsed.bibleStudies.length
      : 0;
    const beholdCount = Array.isArray(parsed.beholdWeeks)
      ? parsed.beholdWeeks.length
      : 0;

    const hasMeaningfulContent =
      eventCount > 0 ||
      habitCount > 0 ||
      goalCount > 0 ||
      recordCount > 0 ||
      studyCount > 0 ||
      beholdCount > 0 ||
      (Array.isArray(parsed.priorities) && parsed.priorities.length > 0) ||
      (Array.isArray(parsed.devotionEntries) &&
        parsed.devotionEntries.length > 0) ||
      (Array.isArray(parsed.workoutLogs) && parsed.workoutLogs.length > 0);

    if (!hasMeaningfulContent) return empty;

    return {
      exists: true,
      eventCount,
      habitCount,
      goalCount,
      recordCount,
      studyCount,
      beholdCount,
      rawJson: raw,
    };
  } catch {
    return empty;
  }
}

/**
 * Read-only load of `lifehq_state_v1` for explicit post-authentication import preview.
 */
export function loadLegacyLocalBackup(): AppState | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppState> | null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return migrateAppState(parsed);
  } catch (err) {
    console.error('Failed to read legacy backup:', err);
    return null;
  }
}

/**
 * Explicit user-triggered cleanup of `lifehq_state_v1` ONLY after confirmed cloud migration.
 */
export function clearLegacyLocalBackup(): void {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to remove legacy backup:', err);
  }
}
