import { DesignerCreditLine } from '@/components/designer-footer';
import { HOME_EXPLORE_NAV_RESERVED_BOTTOM, HomeExploreNav } from '@/components/home-explore-nav';
import { resolveUiLanguageKey } from '@/constants/language-alias';
import { clearCookModeSession, loadCookModeSession } from '@/constants/cook-mode-session';
import {
  cancelCookTimerNotification,
  scheduleCookTimerNotification,
} from '@/lib/cook-timer-notifications';
import { extractMinutesFromStep, parseRecipeSteps } from '@/lib/recipe-steps';
import { playTimerDoneSound } from '@/lib/timer-alarm';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GOLD = '#d3b275';
const TIMER_STICKY_MIN_HEIGHT = 56;
const PADDING_BOTTOM_EXTRA = 24;

function formatMmSs(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function truncateLabel(text: string, max = 42) {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function truncateVoiceLiveHint(text: string, max = 52) {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

type VoiceCommand =
  | 'next'
  | 'previous'
  | 'repeat'
  | 'pause_audio'
  | 'resume_audio'
  | 'mark_done'
  | 'pause_timer'
  | 'resume_timer'
  | 'stop_timer'
  | 'start_step_timer'
  | 'scroll_up'
  | 'scroll_down'
  | 'scroll_top'
  | 'scroll_bottom'
  | null;

type SpeechRecognitionPermission = { granted?: boolean };
type SpeechRecognitionListener = { remove: () => void };
type SpeechRecognitionResultEvent = {
  isFinal?: boolean;
  results?: { transcript?: string }[];
};
type SpeechRecognitionStartOptions = {
  lang?: string;
  interimResults?: boolean;
  continuous?: boolean;
  /** Biases the engine toward Cook Mode phrases (Android 33+ / iOS). */
  contextualStrings?: string[];
  /** iOS: extra noise / feedback suppression — helps steady background noise (e.g. fans). */
  iosVoiceProcessingEnabled?: boolean;
};
type SpeechRecognitionModuleLike = {
  requestPermissionsAsync: () => Promise<SpeechRecognitionPermission>;
  start: (options: SpeechRecognitionStartOptions) => void;
  stop: () => void;
  addListener?: (
    eventName: 'start' | 'end' | 'result' | 'error',
    listener: (event: any) => void
  ) => SpeechRecognitionListener;
};

async function resolveSpeechRecognitionModule(): Promise<SpeechRecognitionModuleLike | null> {
  // Expo Go does not include this native module; skip import to avoid runtime toast/error logs.
  if (Constants.appOwnership === 'expo') {
    return null;
  }
  try {
    const loaded = await import('expo-speech-recognition');
    return (loaded?.ExpoSpeechRecognitionModule as SpeechRecognitionModuleLike | undefined) ?? null;
  } catch {
    return null;
  }
}

const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

function toBanglaDigits(input: string): string {
  return input.replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)] ?? d);
}

/**
 * Make recipe text safer for the OS TTS engine.
 *
 * 1. Numeric ranges like `5-6 মিনিট` / `5 – 6 cups` → `5 থেকে 6` (Bangla) /
 *    `5 to 6` (others). Without this, TTS pronounces the hyphen literally as
 *    "minus" (e.g. "পাঁচ মাইনাস ছয়" instead of "পাঁচ থেকে ছয়").
 * 2. `1/4` / `1 / 4` → `1 of 4` (Bangla) / `1 over 4` (others) so the slash isn't
 *    skipped or mumbled. Most TTS engines will otherwise drop fraction numerators
 *    /denominators silently when there's no whitespace around the slash.
 * 3. Convert ASCII digits → Bangla numerals only when the spoken locale is Bangla;
 *    otherwise English / Hindi / Arabic / etc. TTS engines see foreign glyphs and
 *    silently drop the numbers (the bug behind: "১.৫ lbs flank steak" → "lbs flank
 *    steak").
 *
 * Both range and fraction regexes accept ASCII (`0-9`) and Bangla (`০-৯`) digits
 * because real recipes mix the two depending on the LLM output language.
 */
function normalizeStepForSpeech(input: string, uiLanguage: string): string {
  const isBangla = uiLanguage === 'বাংলা';
  const fractionJoiner = isBangla ? ' এর ' : ' over ';
  const rangeJoiner = isBangla ? ' থেকে ' : ' to ';
  const withRanges = input.replace(
    /([\d০-৯])\s*[-–—−]+\s*([\d০-৯])/g,
    `$1${rangeJoiner}$2`
  );
  const withFractions = withRanges.replace(
    /([\d০-৯])\s*\/\s*([\d০-৯])/g,
    `$1${fractionJoiner}$2`
  );
  if (isBangla) return toBanglaDigits(withFractions);
  return withFractions;
}

function stripBengaliNukta(input: string): string {
  return input
    .normalize('NFC')
    .replace(/\u09DF/g, '\u09AF') // য় -> য
    .replace(/\u09DC/g, '\u09A1') // ড় -> ড
    .replace(/\u09DD/g, '\u09A2') // ঢ় -> ঢ
    .replace(/\u09BC/g, ''); // combining nukta -> remove
}


/** Optional “Chef” prefix only — never strip শেষ (breaks “এই ধাপ শেষ”). */
const LEADING_WAKE_WORD_RE =
  /^\s*(?:chef|chif|sef|শেফ|সেফ|চেফ|শেপ|সেপ|শাফ|সাফ|শ্যাফ|স্যাফ|চিফ|সিফ|শিফ|সিপ|শিপ)(?:\s+|$)/i;

/** Commands that may interrupt step TTS while the mic stays on (no stop/restart beeps). */
const TTS_INTERRUPT_COMMANDS = new Set<VoiceCommand>(['pause_audio', 'mark_done', 'next', 'previous']);

const SPEECH_LOCALE_BY_LANGUAGE: Record<string, string> = {
  বাংলা: 'bn-BD',
  English: 'en-US',
  Hindi: 'hi-IN',
  Arabic: 'ar-SA',
  French: 'fr-FR',
  Spanish: 'es-ES',
  Urdu: 'ur-PK',
  Japanese: 'ja-JP',
  Chinese: 'zh-CN',
  Korean: 'ko-KR',
  Turkish: 'tr-TR',
  Persian: 'fa-IR',
  Greek: 'el-GR',
  Portuguese: 'pt-BR',
};

type CookModeUi = {
  loading: string;
  back: string;
  cookMode: string;
  stepWord: string;
  handsFreeTitle: string;
  bnVoiceMissingTitle: string;
  bnVoiceMissingBody: string;
  prevStep: string;
  nextStep: string;
  doneStep: string;
  timer: string;
  minutes: string;
  start: string;
  noStepTime: string;
  checklist: string;
  timeUp: string;
  close: string;
  timerRunningTitle: string;
  timerRunningBody: string;
  stay: string;
  leave: string;
  heardPrefix: string;
  timerStarted: string;
  noStepTimeStatus: string;
  voiceUnavailable: string;
  voiceOff: string;
  voiceListening: string;
  /** Shown while the mic is active (optional brief line under the title). */
  voiceListeningSub: string;
  /** Prefix before quoted interim transcript so the UI does not look frozen. */
  voiceListeningLive: string;
  voiceReconnect: string;
  voiceRestart: string;
  /** Mic paused while the step is read aloud (avoids restart loop with TTS). */
  voiceReadingStep: string;
  micPermissionOff: string;
  voiceNeedsDevBuild: string;
  audioOnA11y: string;
  audioOffA11y: string;
  voiceOnA11y: string;
  voiceOffA11y: string;
};

const EN_UI: CookModeUi = {
  loading: 'Loading…',
  back: '← Back',
  cookMode: 'Cook Mode',
  stepWord: 'Step',
  handsFreeTitle: 'Hands-free command',
  bnVoiceMissingTitle: 'Required TTS voice missing',
  bnVoiceMissingBody:
    'Install a voice for this language in Settings → Text-to-speech output → Google → Install voice data.',
  prevStep: 'Previous step',
  nextStep: 'Next step',
  doneStep: 'Mark step done',
  timer: 'Timer',
  minutes: 'Minutes',
  start: 'Start',
  noStepTime: 'No time mentioned in this step. Enter minutes below to start.',
  checklist: 'Checklist',
  timeUp: 'Time is up',
  close: 'Close',
  timerRunningTitle: 'Timer is running',
  timerRunningBody: 'Stop timer and leave?',
  stay: 'Stay',
  leave: 'Leave',
  heardPrefix: 'Heard',
  timerStarted: 'Timer started',
  noStepTimeStatus: 'No step time found for timer',
  voiceUnavailable: 'Voice command unavailable here. Use dev build.',
  voiceOff: 'Voice command off',
  voiceListening: 'Listening for commands',
  voiceListeningSub: 'Optional: say Chef, then your command.',
  voiceListeningLive: 'Hearing',
  voiceReconnect: 'Voice command reconnecting...',
  voiceRestart: 'Voice command restarting...',
  voiceReadingStep: 'Reading step aloud…',
  micPermissionOff: 'Mic permission off - voice command disabled',
  voiceNeedsDevBuild: 'Voice command unavailable (dev build needed)',
  audioOnA11y: 'Turn audio on',
  audioOffA11y: 'Turn audio off',
  voiceOnA11y: 'Turn voice command on',
  voiceOffA11y: 'Turn voice command off',
};

const COOK_UI_TEXT: Record<string, CookModeUi> = {
  বাংলা: {
    loading: 'লোড হচ্ছে…',
    back: '← ফিরে যান',
    cookMode: 'কুক মোড',
    stepWord: 'ধাপ',
    handsFreeTitle: 'Hands-free command',
    bnVoiceMissingTitle: 'বাংলা TTS voice নেই',
    bnVoiceMissingBody:
      'Recipe বাংলায় ঠিকঠাক পড়াতে বাংলা voice install করুন: Settings → General management → Text-to-speech output → Google → Install voice data → Bengali (Bangladesh)।',
    prevStep: 'আগের ধাপ',
    nextStep: 'পরের ধাপ',
    doneStep: 'এই ধাপ শেষ',
    timer: 'টাইমার',
    minutes: 'মিনিট',
    start: 'শুরু',
    noStepTime: 'এই ধাপে সময় উল্লেখ নেই—নিচে মিনিট লিখে শুরু করুন।',
    checklist: 'চেকলিস্ট',
    timeUp: 'সময় শেষ',
    close: 'বন্ধ',
    timerRunningTitle: 'টাইমার চলছে',
    timerRunningBody: 'টাইমার থামিয়ে বের হবেন?',
    stay: 'থাকুন',
    leave: 'বের হোন',
    heardPrefix: 'শুনলাম',
    timerStarted: 'টাইমার শুরু হয়েছে',
    noStepTimeStatus: 'এই ধাপে টাইমার সময় পাওয়া যায়নি',
    voiceUnavailable: 'Voice command unavailable here. Use dev build.',
    voiceOff: 'Voice command বন্ধ',
    voiceListening: 'কমান্ড শোনা হচ্ছে',
    voiceListeningSub: 'চাইলে আগে Chef বলে তারপর কমান্ড বলুন।',
    voiceListeningLive: 'শুনছি',
    voiceReconnect: 'Voice command reconnect হচ্ছে...',
    voiceRestart: 'Voice command restart হচ্ছে...',
    voiceReadingStep: 'ধাপ পড়া হচ্ছে…',
    micPermissionOff: 'Mic permission off - voice command বন্ধ',
    voiceNeedsDevBuild: 'Voice command unavailable (dev build needed)',
    audioOnA11y: 'অডিও চালু করুন',
    audioOffA11y: 'অডিও বন্ধ করুন',
    voiceOnA11y: 'ভয়েস কমান্ড চালু করুন',
    voiceOffA11y: 'ভয়েস কমান্ড বন্ধ করুন',
  },
  English: EN_UI,
  Hindi: EN_UI,
  Arabic: EN_UI,
  French: EN_UI,
  Spanish: EN_UI,
  Urdu: EN_UI,
  Japanese: EN_UI,
  Chinese: EN_UI,
  Korean: EN_UI,
  Turkish: EN_UI,
  Persian: EN_UI,
  Greek: EN_UI,
  Portuguese: EN_UI,
};

function normalizeCommandText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBnCommandText(input: string): string {
  return normalizeCommandText(stripBengaliNukta(input))
    .replace(/\bধপ\b/g, 'ধাপ')
    .replace(/\bধাব\b/g, 'ধাপ')
    .replace(/\bবলো\b/g, 'বল')
    .replace(/\bবলুন\b/g, 'বল')
    .replace(/\bটাইমার\b/g, 'টাইমার')
    .replace(/\s+/g, ' ')
    .trim();
}

const COMMAND_CANONICALS: Record<string, Record<Exclude<VoiceCommand, null>, string[]>> = {
  বাংলা: {
    next: ['পরের ধাপ বল', 'পরের ধাপ', 'নেক্সট ধাপ'],
    previous: ['আগের ধাপ বল', 'আগের ধাপ'],
    repeat: ['আবার বল', 'আবার পড়ো', 'রিপিট কর'],
    pause_audio: ['এখন থাম', 'থাম', 'থামাও', 'ভয়েস থামাও', 'পড়া থামাও', 'পড়া বন্ধ'],
    resume_audio: ['এখন বল', 'আবার বলো', 'চালাও'],
    mark_done: ['এই ধাপ শেষ', 'ধাপ শেষ', 'এই ধাপ সম্পন্ন', 'ধাপ সম্পন্ন', 'শেষ কর', 'সম্পন্ন'],
    pause_timer: ['টাইমার থামাও', 'টাইমার পজ কর'],
    resume_timer: ['টাইমার চালাও', 'টাইমার রিজিউম কর'],
    stop_timer: ['টাইমার বন্ধ কর', 'টাইমার স্টপ কর'],
    start_step_timer: ['টাইমার শুরু কর', 'এই ধাপের টাইমার শুরু কর'],
    scroll_up: ['উপরে ওঠো', 'একটু উপরে', 'উপরে যাও', 'উপরে স্ক্রল কর'],
    scroll_down: ['নিচে নামো', 'একটু নিচে', 'নিচে যাও', 'নিচে স্ক্রল কর'],
    scroll_top: ['একদম উপরে', 'সবচেয়ে উপরে যাও'],
    scroll_bottom: ['একদম নিচে', 'সবচেয়ে নিচে যাও'],
  },
  English: {
    next: ['next step'],
    previous: ['previous step'],
    repeat: ['repeat step', 'say again'],
    pause_audio: ['pause now', 'pause voice'],
    resume_audio: ['speak now', 'resume voice'],
    mark_done: ['mark this step done', 'step done'],
    pause_timer: ['pause timer'],
    resume_timer: ['resume timer'],
    stop_timer: ['stop timer', 'cancel timer'],
    start_step_timer: ['start timer', 'start step timer'],
    scroll_up: ['scroll up', 'move up', 'go up'],
    scroll_down: ['scroll down', 'move down', 'go down'],
    scroll_top: ['go to top', 'scroll to top'],
    scroll_bottom: ['go to bottom', 'scroll to bottom'],
  },
  Hindi: {
    next: ['अगला स्टेप बोलो'],
    previous: ['पिछला स्टेप बोलो'],
    repeat: ['फिर से बोलो'],
    pause_audio: ['अभी रुक जाओ'],
    resume_audio: ['अभी बोलो'],
    mark_done: ['यह स्टेप पूरा'],
    pause_timer: ['टाइमर रोक दो'],
    resume_timer: ['टाइमर चालू करो'],
    stop_timer: ['टाइमर बंद करो'],
    start_step_timer: ['टाइमर शुरू करो'],
    scroll_up: ['ऊपर जाओ'],
    scroll_down: ['नीचे जाओ'],
    scroll_top: ['सबसे ऊपर जाओ'],
    scroll_bottom: ['सबसे नीचे जाओ'],
  },
  Arabic: {
    next: ['الخطوة التالية'],
    previous: ['الخطوة السابقة'],
    repeat: ['اعد مرة اخرى'],
    pause_audio: ['توقف الآن'],
    resume_audio: ['تكلم الآن'],
    mark_done: ['هذه الخطوة انتهت'],
    pause_timer: ['اوقف المؤقت'],
    resume_timer: ['اكمل المؤقت'],
    stop_timer: ['الغ المؤقت'],
    start_step_timer: ['ابدأ المؤقت'],
    scroll_up: ['الى الاعلى'],
    scroll_down: ['الى الاسفل'],
    scroll_top: ['الى اعلى الصفحة'],
    scroll_bottom: ['الى اسفل الصفحة'],
  },
  French: {
    next: ['etape suivante'],
    previous: ['etape precedente'],
    repeat: ['repete encore'],
    pause_audio: ['arrete maintenant'],
    resume_audio: ['parle maintenant'],
    mark_done: ['cette etape est terminee'],
    pause_timer: ['pause minuteur'],
    resume_timer: ['reprendre minuteur'],
    stop_timer: ['arreter minuteur'],
    start_step_timer: ['demarrer minuteur'],
    scroll_up: ['defiler vers le haut'],
    scroll_down: ['defiler vers le bas'],
    scroll_top: ['aller en haut'],
    scroll_bottom: ['aller en bas'],
  },
  Spanish: {
    next: ['siguiente paso'],
    previous: ['paso anterior'],
    repeat: ['repite otra vez'],
    pause_audio: ['pausa ahora'],
    resume_audio: ['habla ahora'],
    mark_done: ['este paso listo'],
    pause_timer: ['pausar temporizador'],
    resume_timer: ['reanudar temporizador'],
    stop_timer: ['detener temporizador'],
    start_step_timer: ['iniciar temporizador'],
    scroll_up: ['desplazar arriba'],
    scroll_down: ['desplazar abajo'],
    scroll_top: ['ir arriba del todo'],
    scroll_bottom: ['ir abajo del todo'],
  },
  Urdu: {
    next: ['اگلا قدم بولو'],
    previous: ['پچھلا قدم بولو'],
    repeat: ['دوبارہ بولو'],
    pause_audio: ['ابھی رکو'],
    resume_audio: ['ابھی بولو'],
    mark_done: ['یہ قدم مکمل'],
    pause_timer: ['ٹائمر روک دو'],
    resume_timer: ['ٹائمر چلاو'],
    stop_timer: ['ٹائمر بند کرو'],
    start_step_timer: ['ٹائمر شروع کرو'],
    scroll_up: ['اوپر جاؤ'],
    scroll_down: ['نیچے جاؤ'],
    scroll_top: ['سب سے اوپر جاؤ'],
    scroll_bottom: ['سب سے نیچے جاؤ'],
  },
  Japanese: {
    next: ['つぎのステップ'],
    previous: ['まえのステップ'],
    repeat: ['もういちど'],
    pause_audio: ['いま とめて'],
    resume_audio: ['いま はなして'],
    mark_done: ['このステップ おわり'],
    pause_timer: ['タイマー いちじていし'],
    resume_timer: ['タイマー さいかい'],
    stop_timer: ['タイマー ていし'],
    start_step_timer: ['タイマー かいし'],
    scroll_up: ['うえにスクロール'],
    scroll_down: ['したにスクロール'],
    scroll_top: ['いちばんうえへ'],
    scroll_bottom: ['いちばんしたへ'],
  },
  Chinese: {
    next: ['下一步'],
    previous: ['上一步'],
    repeat: ['再说一遍'],
    pause_audio: ['现在暂停'],
    resume_audio: ['现在说'],
    mark_done: ['这一步完成'],
    pause_timer: ['暂停计时器'],
    resume_timer: ['继续计时器'],
    stop_timer: ['停止计时器'],
    start_step_timer: ['开始计时器'],
    scroll_up: ['向上滚动'],
    scroll_down: ['向下滚动'],
    scroll_top: ['滚动到顶部'],
    scroll_bottom: ['滚动到底部'],
  },
  Korean: {
    next: ['다음 단계'],
    previous: ['이전 단계'],
    repeat: ['다시 말해줘'],
    pause_audio: ['지금 멈춰'],
    resume_audio: ['지금 말해'],
    mark_done: ['이 단계 완료'],
    pause_timer: ['타이머 일시정지'],
    resume_timer: ['타이머 계속'],
    stop_timer: ['타이머 중지'],
    start_step_timer: ['타이머 시작'],
    scroll_up: ['위로 스크롤'],
    scroll_down: ['아래로 스크롤'],
    scroll_top: ['맨 위로 가기'],
    scroll_bottom: ['맨 아래로 가기'],
  },
  Turkish: {
    next: ['sonraki adim'],
    previous: ['onceki adim'],
    repeat: ['tekrar soyle'],
    pause_audio: ['simdi dur'],
    resume_audio: ['simdi konus'],
    mark_done: ['bu adim bitti'],
    pause_timer: ['zamanlayiciyi duraklat'],
    resume_timer: ['zamanlayiciyi devam ettir'],
    stop_timer: ['zamanlayiciyi durdur'],
    start_step_timer: ['zamanlayiciyi baslat'],
    scroll_up: ['yukari kaydir'],
    scroll_down: ['asagi kaydir'],
    scroll_top: ['en üste git'],
    scroll_bottom: ['en alta git'],
  },
  Persian: {
    next: ['مرحله بعد'],
    previous: ['مرحله قبل'],
    repeat: ['دوباره بگو'],
    pause_audio: ['الان توقف'],
    resume_audio: ['الان بگو'],
    mark_done: ['این مرحله تمام'],
    pause_timer: ['تایمر را متوقف کن'],
    resume_timer: ['تایمر را ادامه بده'],
    stop_timer: ['تایمر را لغو کن'],
    start_step_timer: ['تایمر را شروع کن'],
    scroll_up: ['به بالا برو'],
    scroll_down: ['به پایین برو'],
    scroll_top: ['برو بالای صفحه'],
    scroll_bottom: ['برو پایین صفحه'],
  },
  Greek: {
    next: ['επομενο βημα'],
    previous: ['προηγουμενο βημα'],
    repeat: ['πεισ το ξανα'],
    pause_audio: ['σταματα τωρα'],
    resume_audio: ['μιλα τωρα'],
    mark_done: ['αυτο το βημα τελος'],
    pause_timer: ['παυση χρονομετρητη'],
    resume_timer: ['συνεχεια χρονομετρητη'],
    stop_timer: ['σταματημα χρονομετρητη'],
    start_step_timer: ['εναρξη χρονομετρητη'],
    scroll_up: ['κυλιση πανω'],
    scroll_down: ['κυλιση κατω'],
    scroll_top: ['πηγαινε στην κορυφη'],
    scroll_bottom: ['πηγαινε στο τελος'],
  },
  Portuguese: {
    next: ['proximo passo'],
    previous: ['passo anterior'],
    repeat: ['repete de novo'],
    pause_audio: ['pausa agora'],
    resume_audio: ['fale agora'],
    mark_done: ['este passo concluido'],
    pause_timer: ['pausar temporizador'],
    resume_timer: ['retomar temporizador'],
    stop_timer: ['parar temporizador'],
    start_step_timer: ['iniciar temporizador'],
    scroll_up: ['rolar para cima'],
    scroll_down: ['rolar para baixo'],
    scroll_top: ['ir para o topo'],
    scroll_bottom: ['ir para o fim'],
  },
};

const UNIVERSAL_ENGLISH_FALLBACK = COMMAND_CANONICALS.English;

function getCommandCatalog(uiLanguage: string): Record<Exclude<VoiceCommand, null>, string[]> {
  const base = COMMAND_CANONICALS[uiLanguage];
  if (!base) return UNIVERSAL_ENGLISH_FALLBACK;
  const merged = { ...base };
  (Object.keys(UNIVERSAL_ENGLISH_FALLBACK) as Exclude<VoiceCommand, null>[]).forEach((intent) => {
    merged[intent] = [...base[intent], ...UNIVERSAL_ENGLISH_FALLBACK[intent]];
  });
  return merged;
}

/**
 * Short bias list for the OS recognizer (Android EXTRA_BIASING_STRINGS caps effective size).
 * Uses the UI language catalog only — not the merged English fallback — to avoid huge lists.
 */
function collectSpeechBiasStrings(uiLanguage: string, maxStrings = 28): string[] {
  const catalog = COMMAND_CANONICALS[uiLanguage] ?? COMMAND_CANONICALS.English;
  const seen = new Set<string>();
  const out: string[] = [];
  (Object.keys(catalog) as Exclude<VoiceCommand, null>[]).forEach((intent) => {
    catalog[intent].forEach((phrase) => {
      const t = phrase.trim();
      if (t.length < 2 || seen.has(t)) return;
      seen.add(t);
      out.push(t);
    });
  });
  return out.slice(0, maxStrings);
}

/** Bridge / OEM quirks: treat only explicit partials as non-final. */
function speechResultIsPartial(event: SpeechRecognitionResultEvent): boolean {
  const raw = (event as { isFinal?: unknown }).isFinal;
  return raw === false || raw === 0 || raw === 'false';
}

function applyAsrFixes(input: string, uiLanguage: string): string {
  const base = uiLanguage === 'বাংলা' ? normalizeBnCommandText(input) : normalizeCommandText(input);
  if (uiLanguage === 'বাংলা') {
    return base
      .replace(/\bধপ\b/g, 'ধাপ')
      .replace(/\bদাপ\b/g, 'ধাপ')
      .replace(/\bবলে\b/g, 'বল')
      .replace(/\bবলো\b/g, 'বল')
      .replace(/\bবলোও\b/g, 'বল')
      .replace(/\bটামার\b/g, 'টাইমার')
      .replace(/\bটাইমা\b/g, 'টাইমার')
      .replace(/\bশুরুু\b/g, 'শুরু')
      .replace(/\bশুর\b/g, 'শুরু')
      .replace(/\bআগর\b/g, 'আগের')
      .replace(/\bপরর\b/g, 'পরের')
      .replace(/\bধাব\b/g, 'ধাপ')
      .replace(/\bকমপ্লিট\b/g, 'সম্পন্ন')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return base
    .replace(/\bnxt\b/g, 'next')
    .replace(/\bprev\b/g, 'previous')
    .replace(/\bpleas\b/g, 'please')
    .replace(/\btimerr\b/g, 'timer')
    .replace(/\bresum\b/g, 'resume')
    .replace(/\brepet\b/g, 'repeat')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function fuzzyMatchThresholdForPhraseLength(phraseLength: number): number {
  if (phraseLength <= 5) return 1;
  if (phraseLength <= 11) return 2;
  return 3;
}

function stripLeadingWakeWord(text: string): string {
  let body = text.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i += 1) {
    const next = body.replace(LEADING_WAKE_WORD_RE, '').trim();
    if (next === body) break;
    body = next;
  }
  return body;
}

function bestFuzzyCommandMatch(
  text: string,
  catalog: Record<Exclude<VoiceCommand, null>, string[]>,
  uiLanguage: string
): VoiceCommand {
  let best: { command: VoiceCommand; distance: number; phraseLength: number } = {
    command: null,
    distance: Number.POSITIVE_INFINITY,
    phraseLength: 0,
  };
  (Object.keys(catalog) as Exclude<VoiceCommand, null>[]).forEach((command) => {
    catalog[command].forEach((phrase) => {
      const normalizedPhrase = applyAsrFixes(phrase, uiLanguage);
      if (normalizedPhrase.length >= 5 && text.includes(normalizedPhrase)) {
        if (0 < best.distance || (best.distance === 0 && normalizedPhrase.length > best.phraseLength)) {
          best = { command, distance: 0, phraseLength: normalizedPhrase.length };
        }
        return;
      }
      const distance = levenshtein(text, normalizedPhrase);
      if (
        distance < best.distance ||
        (distance === best.distance && normalizedPhrase.length > best.phraseLength)
      ) {
        best = { command, distance, phraseLength: normalizedPhrase.length };
      }
    });
  });
  if (!best.command) return null;
  const threshold = fuzzyMatchThresholdForPhraseLength(best.phraseLength);
  return best.distance <= threshold ? best.command : null;
}

function parseVoiceCommand(raw: string, uiLanguage: string): VoiceCommand {
  const text =
    uiLanguage === 'বাংলা' ? normalizeBnCommandText(raw) : normalizeCommandText(raw);
  if (!text) return null;
  const body = stripLeadingWakeWord(text);
  if (!body) return null;
  const normalized = applyAsrFixes(body, uiLanguage);
  const catalog = getCommandCatalog(uiLanguage);
  return bestFuzzyCommandMatch(normalized, catalog, uiLanguage);
}

export default function CookModeScreen() {
  const router = useRouter();
  const [dishName, setDishName] = React.useState('');
  const [recipeLanguage, setRecipeLanguage] = React.useState('English');
  const [steps, setSteps] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [done, setDone] = React.useState<boolean[]>([]);

  const [customMinutes, setCustomMinutes] = React.useState('5');

  const [timerLabel, setTimerLabel] = React.useState('');
  const [remainingSeconds, setRemainingSeconds] = React.useState(0);
  const [timerStatus, setTimerStatus] = React.useState<'idle' | 'running' | 'paused'>('idle');
  const [finishedBanner, setFinishedBanner] = React.useState(false);
  const [audioPaused, setAudioPaused] = React.useState(false);
  const [handsFreeEnabled, setHandsFreeEnabled] = React.useState(false);
  const [voiceStatusText, setVoiceStatusText] = React.useState('Voice command off');
  const [speechRecognitionModule, setSpeechRecognitionModule] = React.useState<SpeechRecognitionModuleLike | null>(null);
  const [bnVoiceMissing, setBnVoiceMissing] = React.useState(false);

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = React.useRef<ScrollView | null>(null);
  const scheduledNotificationIdRef = React.useRef<string | null>(null);
  const remainingSecondsRef = React.useRef(0);
  const scrollYRef = React.useRef(0);
  const scrollViewportHeightRef = React.useRef(0);
  const scrollContentHeightRef = React.useRef(0);
  const lastVoiceTranscriptRef = React.useRef('');
  const lastVoiceCommandAtRef = React.useRef(0);
  const isTtsSpeakingRef = React.useRef(false);
  const pendingMicRestartAfterTtsRef = React.useRef(false);
  const handsFreeEnabledRef = React.useRef(false);
  const recognitionRestartTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsGenerationRef = React.useRef(0);
  const initialStepSpeakDoneRef = React.useRef(false);

  remainingSecondsRef.current = remainingSeconds;
  handsFreeEnabledRef.current = handsFreeEnabled;

  const clearRecognitionRestartTimer = React.useCallback(() => {
    if (recognitionRestartTimerRef.current) {
      clearTimeout(recognitionRestartTimerRef.current);
      recognitionRestartTimerRef.current = null;
    }
  }, []);

  const syncCookTimerNotification = React.useCallback(
    async (fireAtMs: number, dish: string, label: string) => {
      await cancelCookTimerNotification(scheduledNotificationIdRef.current);
      scheduledNotificationIdRef.current = null;
      const id = await scheduleCookTimerNotification({
        fireAtMs,
        dishName: dish,
        stepLabel: label,
      });
      if (id) scheduledNotificationIdRef.current = id;
    },
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    loadCookModeSession().then((session) => {
      if (cancelled) return;
      const hasStructuredSteps = Array.isArray(session?.steps) && (session?.steps?.length ?? 0) > 0;
      if (!session?.recipe?.trim() && !hasStructuredSteps) {
        router.back();
        return;
      }
      // Structured-first: when the backend gave us pre-split steps (the new
      // contract), use them directly. Heuristic parsing of `recipe` is only the
      // fallback for legacy sessions / pre-update saved recipes.
      const finalSteps = hasStructuredSteps
        ? (session!.steps as string[])
        : (() => {
            const parsed = parseRecipeSteps(session!.recipe);
            return parsed.length ? parsed : [session!.recipe.trim()];
          })();
      setDishName(session!.dishName?.trim() || 'Recipe');
      setRecipeLanguage(resolveUiLanguageKey(session!.language?.trim() || 'English'));
      setSteps(finalSteps);
      setDone(finalSteps.map(() => false));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  React.useEffect(() => {
    return () => {
      void clearCookModeSession();
      if (intervalRef.current) clearInterval(intervalRef.current);
      void cancelCookTimerNotification(scheduledNotificationIdRef.current);
      clearRecognitionRestartTimer();
      isTtsSpeakingRef.current = false;
      speechRecognitionModule?.stop();
      Speech.stop();
      scheduledNotificationIdRef.current = null;
    };
  }, [clearRecognitionRestartTimer, speechRecognitionModule]);

  React.useEffect(() => {
    if (timerStatus !== 'running') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((r) => {
        if (r <= 1) {
          void cancelCookTimerNotification(scheduledNotificationIdRef.current);
          scheduledNotificationIdRef.current = null;
          setTimerStatus('idle');
          setFinishedBanner(true);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          void playTimerDoneSound();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timerStatus]);

  const stepCount = steps.length;
  const safeIndex = stepCount ? Math.min(currentIndex, stepCount - 1) : 0;
  const currentStepText = steps[safeIndex] ?? '';
  const suggestedMinutes = extractMinutesFromStep(currentStepText);
  const resolvedVoiceLanguage = resolveUiLanguageKey(recipeLanguage);
  const ui = COOK_UI_TEXT[resolvedVoiceLanguage] ?? EN_UI;
  const commandCatalog = getCommandCatalog(resolvedVoiceLanguage);
  const hintPhrases = [
    commandCatalog.next[0],
    commandCatalog.previous[0],
    commandCatalog.pause_audio[0],
    commandCatalog.resume_audio[0],
    commandCatalog.mark_done[0],
    commandCatalog.start_step_timer[0],
    commandCatalog.scroll_down[0],
    commandCatalog.scroll_up[0],
    commandCatalog.scroll_bottom[0],
    commandCatalog.scroll_top[0],
  ].filter(Boolean);
  const voiceHintText = `${resolvedVoiceLanguage === 'বাংলা' ? 'বলুন' : 'Say'}: ${hintPhrases.join(', ')}`;
  const speechLocale = SPEECH_LOCALE_BY_LANGUAGE[resolvedVoiceLanguage] ?? 'en-US';
  const speechBiasStrings = React.useMemo(
    () => collectSpeechBiasStrings(resolvedVoiceLanguage),
    [resolvedVoiceLanguage]
  );
  const cookModeSpeechRecognitionOptions = React.useMemo(
    (): SpeechRecognitionStartOptions => ({
      lang: speechLocale,
      interimResults: true,
      // Keep one Android session alive through step TTS (one-shot `end` left mic dead until read finished).
      continuous: true,
      contextualStrings: speechBiasStrings.length > 0 ? speechBiasStrings : undefined,
      iosVoiceProcessingEnabled: Platform.OS === 'ios',
    }),
    [speechBiasStrings, speechLocale]
  );
  const spokenStepPrefix = ui.stepWord;

  const timerStripVisible =
    timerStatus === 'running' || timerStatus === 'paused' || finishedBanner || remainingSeconds > 0;

  const stopTimerFully = React.useCallback(() => {
    void cancelCookTimerNotification(scheduledNotificationIdRef.current);
    scheduledNotificationIdRef.current = null;
    setTimerStatus('idle');
    setRemainingSeconds(0);
    setFinishedBanner(false);
    setTimerLabel('');
  }, []);

  const startTimerSeconds = (seconds: number, label: string) => {
    const bounded = Math.min(24 * 3600, Math.max(1, Math.round(seconds)));
    setTimerLabel(label);
    setRemainingSeconds(bounded);
    setFinishedBanner(false);
    setTimerStatus('running');
    const fireAt = Date.now() + bounded * 1000;
    void syncCookTimerNotification(fireAt, dishName, label);
  };

  const togglePauseResume = React.useCallback(() => {
    setTimerStatus((prev) => {
      if (prev === 'running') {
        void cancelCookTimerNotification(scheduledNotificationIdRef.current);
        scheduledNotificationIdRef.current = null;
        return 'paused';
      }
      if (prev === 'paused') {
        const r = Math.max(1, remainingSecondsRef.current);
        const fireAt = Date.now() + r * 1000;
        const label =
          timerLabel.trim() || truncateLabel(currentStepText, 42);
        void syncCookTimerNotification(fireAt, dishName, label);
        return 'running';
      }
      return prev;
    });
  }, [dishName, timerLabel, currentStepText, syncCookTimerNotification]);

  const addOneMinute = React.useCallback(() => {
    if (timerStatus !== 'running') return;
    setRemainingSeconds((r) => {
      const next = r + 60;
      const fireAt = Date.now() + next * 1000;
      const label =
        timerLabel.trim() || truncateLabel(currentStepText, 42);
      void syncCookTimerNotification(fireAt, dishName, label);
      return next;
    });
  }, [timerStatus, dishName, timerLabel, currentStepText, syncCookTimerNotification]);

  const parseCustomMinutes = (): number | null => {
    const n = Number.parseInt(customMinutes.trim(), 10);
    if (!Number.isFinite(n)) return null;
    return Math.min(240, Math.max(1, n));
  };

  const handleBack = () => {
    if (timerStatus === 'running' || timerStatus === 'paused') {
      Alert.alert(ui.timerRunningTitle, ui.timerRunningBody, [
        { text: ui.stay, style: 'cancel' },
        {
          text: ui.leave,
          style: 'destructive',
          onPress: () => {
            stopTimerFully();
            router.back();
          },
        },
      ]);
      return;
    }
    router.back();
  };

  const toggleDoneAt = (index: number) => {
    setDone((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const markCurrentDoneAndAdvance = React.useCallback(() => {
    setDone((prev) => {
      const next = [...prev];
      next[safeIndex] = true;
      return next;
    });
    if (safeIndex < stepCount - 1) setCurrentIndex(safeIndex + 1);
  }, [safeIndex, stepCount]);

  const scrollBottomPad =
    20 + HOME_EXPLORE_NAV_RESERVED_BOTTOM + (timerStripVisible ? TIMER_STICKY_MIN_HEIGHT + 8 : 0) + PADDING_BOTTOM_EXTRA;

  const recognitionRestartDelayMs = Platform.OS === 'android' ? 800 : 400;

  const scheduleRecognitionRestart = React.useCallback(
    (delayMs: number, statusWhileWaiting?: string) => {
      clearRecognitionRestartTimer();
      if (!handsFreeEnabledRef.current || !speechRecognitionModule) return;
      if (statusWhileWaiting) setVoiceStatusText(statusWhileWaiting);
      recognitionRestartTimerRef.current = setTimeout(() => {
        recognitionRestartTimerRef.current = null;
        if (!handsFreeEnabledRef.current || !speechRecognitionModule) return;
        setVoiceStatusText(ui.voiceListening);
        speechRecognitionModule.start(cookModeSpeechRecognitionOptions);
      }, delayMs);
    },
    [
      clearRecognitionRestartTimer,
      cookModeSpeechRecognitionOptions,
      speechRecognitionModule,
      ui.voiceListening,
      ui.voiceReconnect,
    ]
  );

  const resumeMicAfterTts = React.useCallback(() => {
    pendingMicRestartAfterTtsRef.current = false;
    if (!handsFreeEnabledRef.current || !speechRecognitionModule) return;
    scheduleRecognitionRestart(Platform.OS === 'android' ? 450 : 250);
  }, [scheduleRecognitionRestart, speechRecognitionModule]);

  const cancelStepTts = React.useCallback(() => {
    const wasSpeaking = isTtsSpeakingRef.current;
    ttsGenerationRef.current += 1;
    isTtsSpeakingRef.current = false;
    Speech.stop();
    if (wasSpeaking) resumeMicAfterTts();
  }, [resumeMicAfterTts]);

  const speakCurrentStep = React.useCallback(
    (prefix?: string) => {
      if (audioPaused || !currentStepText.trim()) return;
      const rawSpoken = prefix ? `${prefix}. ${currentStepText}` : currentStepText;
      const spoken = normalizeStepForSpeech(rawSpoken, resolvedVoiceLanguage);
      const generation = ttsGenerationRef.current + 1;
      ttsGenerationRef.current = generation;

      isTtsSpeakingRef.current = true;
      setVoiceStatusText(ui.voiceReadingStep);
      Speech.stop();
      Speech.speak(spoken, {
        rate: 0.94,
        language: speechLocale,
        onDone: () => {
          if (ttsGenerationRef.current !== generation) return;
          isTtsSpeakingRef.current = false;
          if (handsFreeEnabledRef.current) {
            setVoiceStatusText(ui.voiceListening);
            resumeMicAfterTts();
          }
        },
        onStopped: () => {
          if (ttsGenerationRef.current !== generation) return;
          isTtsSpeakingRef.current = false;
          if (handsFreeEnabledRef.current) {
            setVoiceStatusText(ui.voiceListening);
            resumeMicAfterTts();
          }
        },
        onError: () => {
          if (ttsGenerationRef.current !== generation) return;
          isTtsSpeakingRef.current = false;
          if (handsFreeEnabledRef.current) {
            setVoiceStatusText(ui.voiceListening);
            resumeMicAfterTts();
          }
        },
      });
    },
    [audioPaused, currentStepText, resolvedVoiceLanguage, resumeMicAfterTts, speechLocale, ui.voiceListening, ui.voiceReadingStep]
  );

  /** Speak soon after load; first entry waits briefly so mic can start before TTS. */
  React.useEffect(() => {
    if (loading || stepCount === 0 || audioPaused) return;
    const stepNumber =
      resolvedVoiceLanguage === 'বাংলা' ? toBanglaDigits(String(safeIndex + 1)) : String(safeIndex + 1);
    const spokenPrefix = `${spokenStepPrefix} ${stepNumber}`;

    if (!initialStepSpeakDoneRef.current) {
      initialStepSpeakDoneRef.current = true;
      const delayMs = handsFreeEnabled ? 150 : 650;
      const timer = setTimeout(() => speakCurrentStep(spokenPrefix), delayMs);
      return () => clearTimeout(timer);
    }

    speakCurrentStep(spokenPrefix);
  }, [audioPaused, loading, resolvedVoiceLanguage, safeIndex, speakCurrentStep, spokenStepPrefix, stepCount, handsFreeEnabled]);

  const toggleAudioMute = React.useCallback(() => {
    setAudioPaused((prev) => {
      if (prev) {
        setTimeout(() => speakCurrentStep(), 80);
        return false;
      }
      Speech.stop();
      return true;
    });
  }, [speakCurrentStep]);

  const toggleHandsFreeListening = React.useCallback(() => {
    if (!speechRecognitionModule) {
      setVoiceStatusText(ui.voiceUnavailable);
      return;
    }
    setHandsFreeEnabled((prev) => {
      if (prev) {
        isTtsSpeakingRef.current = false;
        clearRecognitionRestartTimer();
        speechRecognitionModule.stop();
        Speech.stop();
        setVoiceStatusText(ui.voiceOff);
        return false;
      }
      isTtsSpeakingRef.current = false;
      setVoiceStatusText(ui.voiceListening);
      speechRecognitionModule.start(cookModeSpeechRecognitionOptions);
      return true;
    });
  }, [clearRecognitionRestartTimer, cookModeSpeechRecognitionOptions, speechRecognitionModule, ui.voiceListening, ui.voiceOff]);

  const scrollByVoice = React.useCallback((delta: number) => {
    const maxY = Math.max(0, scrollContentHeightRef.current - scrollViewportHeightRef.current);
    const nextY = Math.min(maxY, Math.max(0, scrollYRef.current + delta));
    scrollRef.current?.scrollTo({ y: nextY, animated: true });
  }, []);

  const runVoiceCommand = React.useCallback(
    (command: VoiceCommand) => {
      if (!command) return;
      switch (command) {
        case 'next':
          cancelStepTts();
          setCurrentIndex((i) => Math.min(stepCount - 1, i + 1));
          break;
        case 'previous':
          cancelStepTts();
          setCurrentIndex((i) => Math.max(0, i - 1));
          break;
        case 'repeat':
          speakCurrentStep();
          break;
        case 'pause_audio':
          cancelStepTts();
          setAudioPaused(true);
          break;
        case 'resume_audio':
          setAudioPaused(false);
          setTimeout(() => speakCurrentStep(), 80);
          break;
        case 'mark_done':
          cancelStepTts();
          markCurrentDoneAndAdvance();
          break;
        case 'pause_timer':
          if (timerStatus === 'running') togglePauseResume();
          break;
        case 'resume_timer':
          if (timerStatus === 'paused') togglePauseResume();
          break;
        case 'stop_timer':
          stopTimerFully();
          break;
        case 'start_step_timer': {
          const mins = extractMinutesFromStep(currentStepText);
          if (mins != null) {
            startTimerSeconds(mins * 60, truncateLabel(currentStepText));
            setVoiceStatusText(`${ui.timerStarted}: ${mins} ${ui.minutes.toLowerCase()}`);
          } else {
            setVoiceStatusText(ui.noStepTimeStatus);
          }
          break;
        }
        case 'scroll_up':
          scrollByVoice(-240);
          break;
        case 'scroll_down':
          scrollByVoice(240);
          break;
        case 'scroll_top':
          scrollRef.current?.scrollTo({ y: 0, animated: true });
          break;
        case 'scroll_bottom': {
          const maxY = Math.max(0, scrollContentHeightRef.current - scrollViewportHeightRef.current);
          scrollRef.current?.scrollTo({ y: maxY, animated: true });
          break;
        }
        default:
          break;
      }
    },
    [
      cancelStepTts,
      currentStepText,
      markCurrentDoneAndAdvance,
      scrollByVoice,
      speakCurrentStep,
      stepCount,
      stopTimerFully,
      timerStatus,
      togglePauseResume,
    ]
  );

  React.useEffect(() => {
    if (!speechRecognitionModule?.addListener) return;

    const onResult = speechRecognitionModule.addListener('result', (event: SpeechRecognitionResultEvent) => {
      const transcript = event.results?.[0]?.transcript?.trim();
      const isPartial = speechResultIsPartial(event);

      if (isPartial) {
        if (transcript) {
          const prefix = isTtsSpeakingRef.current ? ui.voiceReadingStep : ui.voiceListeningLive;
          setVoiceStatusText(`${prefix}: "${truncateVoiceLiveHint(transcript)}"`);
        }
        return;
      }

      if (!transcript) return;

      const now = Date.now();
      if (now - lastVoiceCommandAtRef.current < 1200) return;

      const command = parseVoiceCommand(transcript, resolvedVoiceLanguage);
      if (!command) return;

      if (isTtsSpeakingRef.current && !TTS_INTERRUPT_COMMANDS.has(command)) return;

      setVoiceStatusText(`${ui.heardPrefix}: ${transcript}`);
      lastVoiceTranscriptRef.current = transcript;
      lastVoiceCommandAtRef.current = now;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      runVoiceCommand(command);
    });

    const onError = speechRecognitionModule.addListener('error', () => {
      if (isTtsSpeakingRef.current) return;
      scheduleRecognitionRestart(900, ui.voiceReconnect);
    });

    const onStart = speechRecognitionModule.addListener('start', () => {
      if (isTtsSpeakingRef.current) return;
      setVoiceStatusText(ui.voiceListening);
    });

    const onEnd = speechRecognitionModule.addListener('end', () => {
      if (!handsFreeEnabledRef.current) return;
      if (isTtsSpeakingRef.current) {
        pendingMicRestartAfterTtsRef.current = true;
        return;
      }
      scheduleRecognitionRestart(recognitionRestartDelayMs, ui.voiceRestart);
    });

    return () => {
      onResult?.remove();
      onError?.remove();
      onStart?.remove();
      onEnd?.remove();
    };
  }, [
    cookModeSpeechRecognitionOptions,
    handsFreeEnabled,
    recognitionRestartDelayMs,
    resolvedVoiceLanguage,
    runVoiceCommand,
    scheduleRecognitionRestart,
    speechRecognitionModule,
    ui,
  ]);

  React.useEffect(() => {
    let cancelled = false;
    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (cancelled || !Array.isArray(voices)) return;
        const localePrefix = speechLocale.split('-')[0]?.toLowerCase();
        const hasTargetVoice = voices.some((v) => (v.language ?? '').toLowerCase().startsWith(`${localePrefix}-`));
        setBnVoiceMissing(!hasTargetVoice);
      })
      .catch(() => {
        if (!cancelled) setBnVoiceMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [speechLocale]);

  React.useEffect(() => {
    let cancelled = false;
    void resolveSpeechRecognitionModule()
      .then((mod) => {
        if (cancelled) return;
        setSpeechRecognitionModule(mod);
        if (!mod) setVoiceStatusText(ui.voiceUnavailable);
      })
      .catch(() => {
        if (!cancelled) {
          setSpeechRecognitionModule(null);
          setVoiceStatusText(ui.voiceNeedsDevBuild);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ui.voiceNeedsDevBuild, ui.voiceUnavailable]);

  React.useEffect(() => {
    let cancelled = false;
    const setupHandsFree = async () => {
      const mod = speechRecognitionModule;
      if (!mod) return;
      try {
        const permission = await mod.requestPermissionsAsync();
        if (!permission.granted) {
          setVoiceStatusText(ui.micPermissionOff);
          return;
        }
        if (cancelled) return;
        setHandsFreeEnabled(true);
        if (!isTtsSpeakingRef.current) setVoiceStatusText(ui.voiceListening);
        mod.start(cookModeSpeechRecognitionOptions);
      } catch {
        setVoiceStatusText(ui.voiceNeedsDevBuild);
      }
    };
    void setupHandsFree();
    return () => {
      cancelled = true;
    };
  }, [cookModeSpeechRecognitionOptions, speechRecognitionModule, ui]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>{ui.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.page}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          onLayout={(e) => {
            scrollViewportHeightRef.current = e.nativeEvent.layout.height;
          }}
          onContentSizeChange={(_, h) => {
            scrollContentHeightRef.current = h;
          }}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} accessibilityRole="button">
            <Text style={styles.backBtnText}>{ui.back}</Text>
          </TouchableOpacity>

          <Text style={styles.screenTitle}>{ui.cookMode}</Text>
          <Text style={styles.dishTitle} numberOfLines={2}>
            {dishName}
          </Text>

          <Text style={styles.progressLine}>
            {ui.stepWord} {safeIndex + 1} / {stepCount}
          </Text>
          <View style={styles.voiceInfoCard}>
            <View style={styles.voiceInfoHeader}>
              <Text style={styles.voiceInfoTitle}>{ui.handsFreeTitle}</Text>
              <View style={styles.voiceToggleRow}>
                <TouchableOpacity
                  style={[styles.voiceIconBtn, audioPaused && styles.voiceIconBtnOff]}
                  onPress={toggleAudioMute}
                  accessibilityRole="button"
                  accessibilityLabel={audioPaused ? ui.audioOnA11y : ui.audioOffA11y}>
                  <MaterialIcons
                    name={audioPaused ? 'volume-off' : 'volume-up'}
                    size={20}
                    color={audioPaused ? '#888' : GOLD}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.voiceIconBtn, !handsFreeEnabled && styles.voiceIconBtnOff]}
                  onPress={toggleHandsFreeListening}
                  accessibilityRole="button"
                  accessibilityLabel={handsFreeEnabled ? ui.voiceOffA11y : ui.voiceOnA11y}>
                  <MaterialIcons
                    name={handsFreeEnabled ? 'mic' : 'mic-off'}
                    size={20}
                    color={handsFreeEnabled ? GOLD : '#888'}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.voiceInfoText}>{voiceStatusText}</Text>
            {handsFreeEnabled ? <Text style={styles.voiceListeningSubText}>{ui.voiceListeningSub}</Text> : null}
            <Text style={styles.voiceInfoHint}>{voiceHintText}</Text>
          </View>

          {bnVoiceMissing ? (
            <View style={styles.bnVoiceBanner}>
              <MaterialIcons name="record-voice-over" size={18} color={GOLD} />
              <View style={styles.bnVoiceBannerBody}>
                <Text style={styles.bnVoiceBannerTitle}>{ui.bnVoiceMissingTitle}</Text>
                <Text style={styles.bnVoiceBannerText}>
                  {ui.bnVoiceMissingBody}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.stepCard}>
            <Text style={styles.stepBody}>{currentStepText}</Text>
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, safeIndex === 0 && styles.secondaryBtnDisabled]}
              disabled={safeIndex === 0}
              onPress={() => setCurrentIndex((i) => Math.max(0, i - 1))}>
              <Text style={[styles.secondaryBtnText, safeIndex === 0 && styles.secondaryBtnTextDisabled]}>{ui.prevStep}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, safeIndex >= stepCount - 1 && styles.secondaryBtnDisabled]}
              disabled={safeIndex >= stepCount - 1}
              onPress={() => setCurrentIndex((i) => Math.min(stepCount - 1, i + 1))}>
              <Text
                style={[styles.secondaryBtnText, safeIndex >= stepCount - 1 && styles.secondaryBtnTextDisabled]}>
                {ui.nextStep}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.donePrimary} onPress={markCurrentDoneAndAdvance} activeOpacity={0.85}>
            <MaterialIcons name="check-circle" size={22} color="#000" />
            <Text style={styles.donePrimaryText}>{ui.doneStep}</Text>
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>{ui.timer}</Text>
          <View style={styles.timerCard}>
            {suggestedMinutes != null ? (
              <TouchableOpacity
                style={styles.suggestBtn}
                onPress={() =>
                  startTimerSeconds(suggestedMinutes * 60, truncateLabel(currentStepText))
                }>
                <MaterialIcons name="timer" size={20} color="#000" />
                <Text style={styles.suggestBtnText}>{suggestedMinutes} {ui.minutes} {ui.start}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.suggestHint}>{ui.noStepTime}</Text>
            )}

            <View style={styles.customRow}>
              <Text style={styles.customLabel}>{ui.minutes}</Text>
              <TextInput
                value={customMinutes}
                onChangeText={setCustomMinutes}
                keyboardType="number-pad"
                placeholder="5"
                placeholderTextColor="#666"
                style={styles.customInput}
              />
              <TouchableOpacity
                style={styles.customStart}
                onPress={() => {
                  const m = parseCustomMinutes();
                  if (m == null) return;
                  startTimerSeconds(m * 60, truncateLabel(currentStepText));
                }}>
                <Text style={styles.customStartText}>{ui.start}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.presetRow}>
              {[3, 5, 10, 15].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={styles.presetChip}
                  onPress={() => startTimerSeconds(m * 60, truncateLabel(currentStepText))}>
                  <Text style={styles.presetChipText}>{m} মি</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={styles.sectionLabel}>{ui.checklist}</Text>
          <View style={styles.checklist}>
            {steps.map((line, i) => {
              const isCurrent = i === safeIndex;
              return (
                <TouchableOpacity
                  key={`step-${i}`}
                  style={[styles.checkRow, isCurrent && styles.checkRowCurrent]}
                  onPress={() => setCurrentIndex(i)}
                  activeOpacity={0.85}>
                  <TouchableOpacity
                    style={styles.checkHit}
                    onPress={() => toggleDoneAt(i)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !!done[i] }}>
                    <MaterialIcons
                      name={done[i] ? 'check-box' : 'check-box-outline-blank'}
                      size={26}
                      color={done[i] ? GOLD : '#666'}
                    />
                  </TouchableOpacity>
                  <Text style={[styles.checkText, done[i] && styles.checkTextDone]} numberOfLines={3}>
                    {line}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <DesignerCreditLine />
        </ScrollView>

        {timerStripVisible ? (
          <View style={styles.timerSticky}>
            {finishedBanner ? (
              <View style={styles.timerStickyInner}>
                <MaterialIcons name="notifications-active" size={22} color={GOLD} />
                <Text style={styles.timerStickyTitle}>{ui.timeUp}</Text>
                <TouchableOpacity style={styles.timerStickyDismiss} onPress={stopTimerFully}>
                  <Text style={styles.timerStickyDismissText}>{ui.close}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.timerStickyInner}>
                <View style={styles.timerStickyLeft}>
                  <Text style={styles.timerStickyLabel} numberOfLines={1}>
                    {timerLabel || truncateLabel(currentStepText, 36)}
                  </Text>
                  <Text style={styles.timerStickyClock}>{formatMmSs(remainingSeconds)}</Text>
                </View>
                <View style={styles.timerStickyActions}>
                  <TouchableOpacity style={styles.timerIconBtn} onPress={togglePauseResume}>
                    <MaterialIcons
                      name={timerStatus === 'running' ? 'pause' : 'play-arrow'}
                      size={28}
                      color={GOLD}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.timerIconBtn} onPress={addOneMinute}>
                    <Text style={styles.plusOneText}>+১ মি</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.timerIconBtn} onPress={stopTimerFully}>
                    <MaterialIcons name="stop" size={26} color="#c77" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : null}

        <HomeExploreNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  page: { flex: 1 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: GOLD, fontSize: 16 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, alignItems: 'stretch' },
  backBtn: { alignSelf: 'flex-start', marginBottom: 10 },
  backBtnText: { color: GOLD, fontSize: 15, fontWeight: '600' },
  screenTitle: { color: '#888', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  dishTitle: { color: GOLD, fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
  progressLine: { color: '#aaa', fontSize: 14, marginBottom: 14 },
  voiceInfoCard: {
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  voiceInfoTitle: { color: GOLD, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  voiceInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  voiceToggleRow: { flexDirection: 'row', gap: 8 },
  voiceIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GOLD,
    backgroundColor: '#181818',
  },
  voiceIconBtnOff: {
    borderColor: '#444',
    backgroundColor: '#0a0a0a',
  },
  voiceInfoText: { color: '#ddd', fontSize: 12, marginBottom: 6 },
  voiceListeningSubText: { color: '#888', fontSize: 11, lineHeight: 16, marginBottom: 4 },
  voiceInfoHint: { color: '#999', fontSize: 12, lineHeight: 18 },
  bnVoiceBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#1a1304',
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  bnVoiceBannerBody: { flex: 1 },
  bnVoiceBannerTitle: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  bnVoiceBannerText: { color: '#ddd', fontSize: 12, lineHeight: 18 },
  stepCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 14,
  },
  stepBody: { color: '#e8e8e8', fontSize: 17, lineHeight: 26 },
  navRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#0d0d0d',
    alignItems: 'center',
  },
  secondaryBtnDisabled: { opacity: 0.35 },
  secondaryBtnText: { color: GOLD, fontWeight: '600', fontSize: 14 },
  secondaryBtnTextDisabled: { color: '#555' },
  donePrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GOLD,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 22,
  },
  donePrimaryText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  sectionLabel: {
    color: '#777',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  timerCard: {
    backgroundColor: '#101010',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#252525',
    marginBottom: 22,
  },
  suggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GOLD,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  suggestBtnText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  suggestHint: { color: '#9a9a9a', fontSize: 13, marginBottom: 12, lineHeight: 20 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  customLabel: { color: '#aaa', fontSize: 14 },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    backgroundColor: '#080808',
  },
  customStart: {
    backgroundColor: '#222',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GOLD,
  },
  customStartText: { color: GOLD, fontWeight: '700' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  presetChipText: { color: '#ddd', fontSize: 13 },
  checklist: { gap: 8, marginBottom: 20 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#0c0c0c',
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  checkRowCurrent: { borderColor: GOLD, backgroundColor: '#141008' },
  checkHit: { paddingTop: 2 },
  checkText: { flex: 1, color: '#ddd', fontSize: 14, lineHeight: 20 },
  checkTextDone: { color: '#666', textDecorationLine: 'line-through' },
  timerSticky: {
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#070707',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: TIMER_STICKY_MIN_HEIGHT,
    justifyContent: 'center',
  },
  timerStickyInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  timerStickyLeft: { flex: 1 },
  timerStickyLabel: { color: '#9a9a9a', fontSize: 12, marginBottom: 4 },
  timerStickyClock: { color: GOLD, fontSize: 26, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  timerStickyActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerIconBtn: { padding: 8 },
  plusOneText: { color: GOLD, fontWeight: '700', fontSize: 13 },
  timerStickyTitle: { flex: 1, color: GOLD, fontWeight: '700', fontSize: 16 },
  timerStickyDismiss: {
    backgroundColor: '#222',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#444',
  },
  timerStickyDismissText: { color: '#eee', fontWeight: '600' },
});
