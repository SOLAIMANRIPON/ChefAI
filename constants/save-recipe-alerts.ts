import { resolveUiLanguageKey } from '@/constants/language-alias';

export type SaveRecipeAlertBundle = {
  savedTitle: string;
  savedBody: string;
  savedBodyNoImage: string;
  failedTitle: string;
  failedBody: string;
  coverCopyFailedBody: string;
};

const bundles: Record<'বাংলা' | 'English', SaveRecipeAlertBundle> = {
  বাংলা: {
    savedTitle: 'সেভ হয়েছে',
    savedBody: 'Explore ট্যাবে রেসিপি সেভ হয়েছে।',
    savedBodyNoImage:
      'Explore-এ রেসিপির লেখা সেভ হয়েছে, কিন্তু ছবিটি ফাইল হিসেবে সংরক্ষণ করা যায়নি। “Save photo to gallery” দিয়ে গ্যালারিতে রাখতে পারেন।',
    failedTitle: 'সেভ ব্যর্থ',
    failedBody: 'এখন সেভ করা যায়নি। আবার চেষ্টা করুন। ওয়েবে থাকলে অ্যাপ ব্যবহার করে দেখুন।',
    coverCopyFailedBody:
      'রেসিপির লেখা সেভ করা হয়নি। কভার ছবিটি ডিভাইসে কপি করা যায়নি—অনুমতি বা স্টোরেজ চেক করে আবার চেষ্টা করুন।',
  },
  English: {
    savedTitle: 'Saved',
    savedBody: 'Recipe saved to the Explore tab.',
    savedBodyNoImage:
      'Recipe text saved to Explore, but the dish image could not be written to a file on this device. Try “Save photo to gallery” or save again.',
    failedTitle: 'Save failed',
    failedBody: 'Could not save right now. Please try again.',
    coverCopyFailedBody:
      'Could not copy your cover photo to app storage. Check photo permission or storage, then try again.',
  },
};

const hindiBundle: SaveRecipeAlertBundle = {
  savedTitle: 'सेव हो गया',
  savedBody: 'रेसिपी Explore टैब में सेव हो गई।',
  savedBodyNoImage:
    'रेसिपी का टेक्स्ट सेव हो गया, पर डिश इमेज फाइल के रूप में नहीं सेव हो सकी। “Save photo to gallery” आज़माएँ।',
  failedTitle: 'सेव नहीं हुआ',
  failedBody: 'अभी सेव नहीं हो सका। दोबारा कोशिश करें। वेब पर समस्या हो तो ऐप में आज़माएँ।',
  coverCopyFailedBody:
    'कवर फोटो ऐप स्टोरेज में कॉपी नहीं हो सका। अनुमति या स्टोरेज जाँच कर फिर कोशिश करें।',
};

/**
 * Follows the same “resolved” language as the home screen (e.g. Bangladesh → বাংলা, India → Hindi).
 * Other languages fall back to English strings until more bundles are added.
 */
export function getSaveRecipeAlerts(selectedLangFromParams: string): SaveRecipeAlertBundle {
  const resolved = resolveUiLanguageKey(selectedLangFromParams);
  if (resolved === 'বাংলা') return bundles.বাংলা;
  if (resolved === 'Hindi') return hindiBundle;
  return bundles.English;
}
