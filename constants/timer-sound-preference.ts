import AsyncStorage from '@react-native-async-storage/async-storage';

export type BuiltinTimerSoundId = 'classic' | 'soft' | 'bright';

export type TimerSoundPreference = {
  kind: 'builtin' | 'custom';
  builtin: BuiltinTimerSoundId;
  customUri: string | null;
  customName: string | null;
};

export const DEFAULT_TIMER_SOUND_PREFERENCE: TimerSoundPreference = {
  kind: 'builtin',
  builtin: 'classic',
  customUri: null,
  customName: null,
};

const STORAGE_KEY = 'chefai_timer_sound_pref_v3';

let cached: TimerSoundPreference = DEFAULT_TIMER_SOUND_PREFERENCE;

function coerceParsed(raw: unknown): TimerSoundPreference | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.kind === 'builtin') {
    const b = o.builtin;
    if (b === 'classic' || b === 'soft' || b === 'bright') {
      return { kind: 'builtin', builtin: b, customUri: null, customName: null };
    }
    return null;
  }
  if (o.kind === 'custom' && typeof o.customUri === 'string' && o.customUri.length > 4) {
    const name = typeof o.customName === 'string' && o.customName.trim() ? o.customName.trim() : 'Audio';
    return { kind: 'custom', builtin: 'classic', customUri: o.customUri, customName: name };
  }
  return null;
}

export async function hydrateTimerSoundPreference(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = coerceParsed(JSON.parse(raw));
    if (parsed) cached = parsed;
  } catch {
    /* noop */
  }
}

export async function saveTimerSoundPreference(next: TimerSoundPreference): Promise<void> {
  cached = next;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getTimerSoundPreference(): TimerSoundPreference {
  return cached;
}
