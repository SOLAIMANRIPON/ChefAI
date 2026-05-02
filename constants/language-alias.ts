/** Maps country / picker labels to primary UI language keys used across the app. */
export const languageAliasByCountry: Record<string, string> = {
  Bangladesh: 'বাংলা',
  India: 'Hindi',
  Pakistan: 'Urdu',
  China: 'Chinese',
  Japan: 'Japanese',
  Thailand: 'English',
  Korea: 'Korean',
  Turkey: 'Turkish',
  Iran: 'Persian',
  'Saudi Arabia': 'Arabic',
  'United Arab Emirates': 'Arabic',
  Italy: 'English',
  France: 'French',
  Spain: 'Spanish',
  Greece: 'Greek',
  Mexico: 'Spanish',
  'United States': 'English',
  Brazil: 'Portuguese',
  Argentina: 'Spanish',
  'United Kingdom': 'English',
};

export function resolveUiLanguageKey(selectedLang: string): string {
  return languageAliasByCountry[selectedLang] ?? selectedLang;
}
