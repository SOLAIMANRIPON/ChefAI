import { resolveUiLanguageKey } from '@/constants/language-alias';

export type SaveRecipeAlertBundle = {
  savedTitle: string;
  savedBody: string;
  savedBodyNoImage: string;
  failedTitle: string;
  failedBody: string;
};

const bundles: Record<'বাংলা' | 'English', SaveRecipeAlertBundle> = {
  বাংলা: {
    savedTitle: 'সেভ হয়েছে',
    savedBody: 'Explore ট্যাবে রেসিপি সেভ হয়েছে।',
    savedBodyNoImage:
      'Explore-এ রেসিপির লেখা সেভ হয়েছে। ছবিটি আকার বড় হওয়ায় ডিভাইসে সংরক্ষণ করা হয়নি।',
    failedTitle: 'সেভ ব্যর্থ',
    failedBody: 'এখন সেভ করা যায়নি। আবার চেষ্টা করুন। ওয়েবে থাকলে অ্যাপ ব্যবহার করে দেখুন।',
  },
  English: {
    savedTitle: 'Saved',
    savedBody: 'Recipe saved to the Explore tab.',
    savedBodyNoImage:
      'Recipe text saved to Explore. The image was not stored because it is too large for device storage.',
    failedTitle: 'Save failed',
    failedBody: 'Could not save right now. Please try again.',
  },
};

const hindiBundle: SaveRecipeAlertBundle = {
  savedTitle: 'सेव हो गया',
  savedBody: 'रेसिपी Explore टैब में सेव हो गई।',
  savedBodyNoImage:
    'रेसिपी का टेक्स्ट सेव हो गया। छवि बहुत बड़ी होने के कारण डिवाइस पर नहीं रखी गई।',
  failedTitle: 'सेव नहीं हुआ',
  failedBody: 'अभी सेव नहीं हो सका। दोबारा कोशिश करें। वेब पर समस्या हो तो ऐप में आज़माएँ।',
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
