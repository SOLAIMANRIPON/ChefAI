export type HelpLangId = 'en' | 'bn' | 'hi' | 'ur';

export type HelpTopic = { id: string; title: string; body: string };

export type HelpFaq = { id: string; q: string; a: string; keywords: string[] };

export type HelpBundle = {
  /** Screen title */
  screenTitle: string;
  chooseLanguageTitle: string;
  chooseLanguageSub: string;
  continueHint: string;
  changeLanguage: string;
  onlyChefAiNotice: string;
  noNetworkLegal: string;
  searchPlaceholder: string;
  topicsHeading: string;
  faqHeading: string;
  noSearchResults: string;
  /** Footer below FAQ — taps through to Settings → Contact us. */
  stillStuckContact: string;
  topics: HelpTopic[];
  faqs: HelpFaq[];
};
