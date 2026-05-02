import bn from '@/locales/bn.json';
import en from '@/locales/en.json';
import hi from '@/locales/hi.json';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const SUPPORTED_APP_LANGUAGES = ['en', 'bn', 'hi'] as const;
export type AppLanguage = (typeof SUPPORTED_APP_LANGUAGES)[number];

const resources = {
  en: { translation: en },
  bn: { translation: bn },
  hi: { translation: hi },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: [...SUPPORTED_APP_LANGUAGES],
  compatibilityJSON: 'v4',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
