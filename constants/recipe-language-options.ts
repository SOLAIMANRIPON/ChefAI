import { languageAliasByCountry } from '@/constants/language-alias';
import type { HelpLangId } from '@/constants/help-types';

/** Same “Languages” row as the home language modal. */
export const RECIPE_CORE_LANGUAGES = ['বাংলা', 'English', 'Hindi', 'Arabic', 'French', 'Spanish', 'Urdu'] as const;

/** Same “Countries” row as the home language modal (maps via `languageAliasByCountry`). */
export const RECIPE_COUNTRY_PICKER_OPTIONS = [
  'Bangladesh',
  'India',
  'Pakistan',
  'China',
  'Japan',
  'Thailand',
  'Korea',
  'Turkey',
  'Iran',
  'Saudi Arabia',
  'United Arab Emirates',
  'Italy',
  'France',
  'Spain',
  'Greece',
  'Mexico',
  'United States',
  'Brazil',
  'Argentina',
  'United Kingdom',
] as const;

/** Full picker list: languages first, then countries (matches home). */
export const RECIPE_LANGUAGE_PICKER_OPTIONS: readonly string[] = [
  ...RECIPE_CORE_LANGUAGES,
  ...RECIPE_COUNTRY_PICKER_OPTIONS,
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
