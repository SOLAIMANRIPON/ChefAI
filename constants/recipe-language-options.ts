import { languageAliasByCountry } from '@/constants/language-alias';
import type { HelpLangId } from '@/constants/help-types';
import { LEGACY_COUNTRY_ALIASES, WORLD_COUNTRIES } from '@/constants/world-countries';

/** Same “Languages” row as the home language modal (canonical keys for recipes / storage). */
export const RECIPE_CORE_LANGUAGES = ['বাংলা', 'English', 'Hindi', 'Arabic', 'French', 'Spanish', 'Urdu'] as const;

/** English labels on hub/list pickers — matches English, Hindi, Arabic, … */
export function formatCoreLanguagePickerLabel(language: string): string {
  if (language === 'বাংলা') return 'Bangla';
  return language;
}

/** Home “Countries” section — full world list (A–Z). */
export const RECIPE_COUNTRY_PICKER_OPTIONS: readonly string[] = WORLD_COUNTRIES;

/** Home “Select Cuisine” — same 196 countries A–Z as the language picker (no Bangladeshi/Indian duplicates). */
export const RECIPE_CUISINE_PICKER_OPTIONS: readonly string[] = WORLD_COUNTRIES;

/** Full picker list: languages first, then countries (matches home). */
export const RECIPE_LANGUAGE_PICKER_OPTIONS: readonly string[] = [
  ...RECIPE_CORE_LANGUAGES,
  ...RECIPE_COUNTRY_PICKER_OPTIONS,
  ...LEGACY_COUNTRY_ALIASES,
];

/**
 * Map home-style language/country pick to a built-in help bundle (offline copy).
 * Unsupported written languages fall back to English help text.
 */
export function pickerValueToHelpLangId(pickerValue: string): HelpLangId {
  const raw = pickerValue.trim();
  const resolved = languageAliasByCountry[raw] ?? raw;
  if (resolved === 'বাংলা') return 'bn';
  if (resolved === 'Hindi') return 'hi';
  if (resolved === 'Urdu') return 'ur';
  return 'en';
}
