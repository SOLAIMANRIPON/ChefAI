import type { BuiltinTimerSoundId, TimerSoundPreference } from '@/constants/timer-sound-preference';
import { getTimerSoundPreference } from '@/constants/timer-sound-preference';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

const BUILTIN_MODULES: Record<BuiltinTimerSoundId, number> = {
  classic: require('@/assets/sounds/timer-done.wav'),
  soft: require('@/assets/sounds/timer-soft.wav'),
  bright: require('@/assets/sounds/timer-bright.wav'),
  alarm: require('@/assets/sounds/timer-alarm.mp3'),
};

const TICK_MODULE = require('@/assets/sounds/timer-tick.mp3');

let tickSound: Audio.Sound | null = null;

export async function startTickingSound(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await stopTickingSound();
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    const { sound } = await Audio.Sound.createAsync(TICK_MODULE, {
      shouldPlay: true,
      isLooping: true,
      volume: 0.5,
    });
    tickSound = sound;
  } catch {
    /* noop */
  }
}

export async function stopTickingSound(): Promise<void> {
  if (!tickSound) return;
  try {
    await tickSound.stopAsync();
    await tickSound.unloadAsync();
  } catch {
    /* noop */
  } finally {
    tickSound = null;
  }
}

function playWebBeep(frequencyHz: number, durationMs: number): void {
  try {
    const win = globalThis as typeof globalThis & {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const AC = win.AudioContext ?? win.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequencyHz;
    gain.gain.value = 0.14;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    globalThis.setTimeout(() => {
      try {
        osc.stop();
        void ctx.close();
      } catch {
        /* noop */
      }
    }, durationMs);
  } catch {
    /* noop */
  }
}

function webParamsForBuiltin(id: BuiltinTimerSoundId): [number, number] {
  switch (id) {
    case 'soft':
      return [520, 520];
    case 'bright':
      return [1400, 260];
    case 'alarm':
      return [880, 800];
    default:
      return [880, 380];
  }
}

async function playNativeAlarm(pref: TimerSoundPreference): Promise<void> {
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
  });

  const loadAndPlay = async (source: Parameters<typeof Audio.Sound.createAsync>[0]) => {
    const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true, volume: 1 });
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        void sound.unloadAsync();
      }
    });
  };

  try {
    if (pref.kind === 'custom' && pref.customUri) {
      await loadAndPlay({ uri: pref.customUri });
      return;
    }
    const id = pref.kind === 'builtin' ? pref.builtin : 'classic';
    await loadAndPlay(BUILTIN_MODULES[id]);
  } catch {
    if (pref.kind === 'custom') {
      try {
        await loadAndPlay(BUILTIN_MODULES.classic);
      } catch {
        /* noop */
      }
    }
  }
}

/** Play the alarm for a given preference (preview or timer end). */
export async function playTimerAlarm(pref: TimerSoundPreference): Promise<void> {
  if (Platform.OS === 'web') {
    // Custom files are not replayed on web here; presets still preview differently.
    if (pref.kind === 'custom') {
      playWebBeep(880, 380);
      return;
    }
    const [f, ms] = webParamsForBuiltin(pref.builtin);
    playWebBeep(f, ms);
    return;
  }

  await playNativeAlarm(pref);
}

export async function playTimerDoneSound(): Promise<void> {
  await playTimerAlarm(getTimerSoundPreference());
}

export async function previewTimerAlarm(pref?: TimerSoundPreference): Promise<void> {
  await playTimerAlarm(pref ?? getTimerSoundPreference());
}
