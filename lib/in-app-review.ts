import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Platform } from 'react-native';

const STORAGE_KEY = 'chefai_in_app_review_v1';
/** First prompt only after this many full Cook Mode finishes. */
const MIN_COOK_COMPLETIONS = 2;
/** Minimum gap between review prompts (OS also enforces its own quota). */
const COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;
const PROMPT_DELAY_MS = 2000;

type ReviewState = {
  cookCompletions: number;
  lastPromptAtMs: number | null;
};

const DEFAULT_STATE: ReviewState = {
  cookCompletions: 0,
  lastPromptAtMs: null,
};

async function loadState(): Promise<ReviewState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      cookCompletions:
        typeof parsed.cookCompletions === 'number' && parsed.cookCompletions >= 0
          ? parsed.cookCompletions
          : 0,
      lastPromptAtMs:
        typeof parsed.lastPromptAtMs === 'number' && parsed.lastPromptAtMs > 0
          ? parsed.lastPromptAtMs
          : null,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function saveState(state: ReviewState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call when the user finishes the final Cook Mode step.
 * May show the native Play Store / App Store review sheet after a short delay.
 */
export async function recordCookModeCompletedAndMaybeRequestReview(): Promise<void> {
  if (Platform.OS === 'web') return;

  const state = await loadState();
  state.cookCompletions += 1;
  await saveState(state);

  if (state.cookCompletions < MIN_COOK_COMPLETIONS) return;

  const now = Date.now();
  if (state.lastPromptAtMs != null && now - state.lastPromptAtMs < COOLDOWN_MS) return;

  await sleep(PROMPT_DELAY_MS);

  const available = await StoreReview.isAvailableAsync();
  if (!available) return;

  const hasAction = await StoreReview.hasAction();
  if (!hasAction) return;

  await StoreReview.requestReview();

  const updated = await loadState();
  updated.lastPromptAtMs = Date.now();
  await saveState(updated);
}
