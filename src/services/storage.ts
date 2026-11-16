import { INITIAL_STATE } from '../data/seedData';
import { AppState } from '../types/lifehq';

const STORAGE_KEY = 'lifehq_state_v1';

export function loadLocalState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...INITIAL_STATE,
      ...parsed,
      settings: {
        ...INITIAL_STATE.settings,
        ...(parsed.settings ?? {}),
        reminderOptions: {
          ...INITIAL_STATE.settings.reminderOptions,
          ...(parsed.settings?.reminderOptions ?? {}),
        },
        categoryColours: {
          ...INITIAL_STATE.settings.categoryColours,
          ...(parsed.settings?.categoryColours ?? {}),
        },
      },
    };
  } catch (err) {
    console.error('Failed to read local LifeHQ state:', err);
    return INITIAL_STATE;
  }
}

export function saveLocalState(state: AppState): { ok: boolean; error?: string } {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (err) {
    console.error('Failed to persist LifeHQ state:', err);
    return {
      ok: false,
      error: 'Browser storage limit reached or unavailable.',
    };
  }
}

export function resetLocalState(): AppState {
  localStorage.removeItem(STORAGE_KEY);
  return INITIAL_STATE;
}
