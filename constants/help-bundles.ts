import type { HelpBundle, HelpFaq, HelpLangId, HelpTopic } from '@/constants/help-types';

const EN_TOPICS: HelpTopic[] = [
  {
    id: 'start',
    title: 'Getting started',
    body:
      '• Home: choose ingredients, cuisine, language, and how you want the recipe (text or with a dish photo).\n' +
      '• Explore: open saved recipes, shopping lists, recent history, and Settings.\n' +
      '• After a recipe is generated, open Recipe details for the full text, nutrition hints, cook mode, save, and share.\n' +
      'List and hub screens stay in English unless you change app language in i18n; recipe text follows the recipe language you picked.',
  },
  {
    id: 'recipe',
    title: 'Recipe details',
    body:
      '• Cook mode: step-by-step with optional timer sounds (set under Settings).\n' +
      '• Save recipe: stores the recipe on this device for offline access from Explore.\n' +
      '• Share: sends the recipe text and, when possible, the dish photo. Some apps (e.g. Messenger) may only attach the photo—copy from clipboard if we put the text there.\n' +
      '• Shopping list: build a list from saved recipes from Explore.',
  },
  {
    id: 'credits',
    title: 'Credits & purchases',
    body:
      '• ChefAI uses credits when you generate recipes or images according to the in-app rules.\n' +
      '• Purchases and balances are handled through the store on your device. ChefAI cannot give medical, legal, or financial advice—only how the app works.',
  },
  {
    id: 'build',
    title: 'Updates & Android build',
    body:
      '• Some features need a native rebuild (new permissions, sharing, media library). If something says “update the app build”, install a fresh debug or store build from your developer workflow.\n' +
      '• Dev client: run Metro with your matching native app so JavaScript updates apply.',
  },
  {
    id: 'privacy',
    title: 'Scope & safety',
    body:
      '• This Help section and the FAQ search only describe ChefAI. They do not browse the web and do not call AI for answers.\n' +
      '• Do not enter passwords, bank details, or personal secrets in Help search.\n' +
      '• For food safety or health, ask a qualified professional—not this app.',
  },
];

const EN_FAQ: HelpFaq[] = [
  {
    id: 'share',
    q: 'Why does only the image go to Messenger?',
    a: 'Some apps ignore extra text when an image is shared. We copy the full recipe to the clipboard before opening share—paste it in the chat after sending the photo.',
    keywords: ['messenger', 'share', 'clipboard', 'photo', 'image', 'facebook'],
  },
  {
    id: 'splash',
    q: 'Splash logo looks cropped on Android',
    a: 'Android 12+ uses a special launch icon. The project script sync:splash-android regenerates those assets from your splash image after you change it—then rebuild the APK.',
    keywords: ['splash', 'logo', 'android', 'launch', 'gradle'],
  },
  {
    id: 'metro',
    q: 'App opens but shows an old screen',
    a: 'Reload JavaScript in the dev client or reinstall the APK if native code changed. Clear Metro cache if the bundler acts stale.',
    keywords: ['metro', 'cache', 'reload', 'expo', 'dev'],
  },
  {
    id: 'timer',
    q: 'Timer sound in cook mode',
    a: 'Open Settings → Timer alarm: pick a built-in sound or your own audio file (mobile). Use Preview to test.',
    keywords: ['timer', 'alarm', 'sound', 'cook', 'audio'],
  },
  {
    id: 'language',
    q: 'Why is Explore in English but my recipe is Bangla?',
    a: 'Hub and list screens follow app UI language rules; recipe content follows the language you chose for that recipe.',
    keywords: ['language', 'bangla', 'english', 'explore', 'hub'],
  },
  {
    id: 'save',
    q: 'Where are saved recipes stored?',
    a: 'On this device, inside the app. They are not uploaded to a ChefAI “cloud feed” unless you use a separate feature that explicitly says so.',
    keywords: ['save', 'storage', 'offline', 'device'],
  },
  {
    id: 'credits_low',
    q: 'It says I have no credits',
    a: 'Check the billing or credits screen in the app and your store account. ChefAI cannot process payments outside the store flow shown in the app.',
    keywords: ['credits', 'billing', 'pay', 'purchase'],
  },
  {
    id: 'help_search',
    q: 'What can I type in Help search?',
    a: 'Short words about the app: share, save, timer, language, credits, Android, splash. Answers come only from this built-in guide—not from the internet.',
    keywords: ['search', 'help', 'faq', 'question'],
  },
];

const BN_TOPICS: HelpTopic[] = [
  {
    id: 'start',
    title: 'শুরু করুন',
    body:
      '• হোম: উপকরণ, রান্নার ধরন, ভাষা আর রেসিপি ধরন (টেক্সট / ছবিসহ) বেছে নিন।\n' +
      '• এক্সপ্লোর: সেভ করা রেসিপি, শপিং লিস্ট, সাম্প্রতিক ইতিহাস, সেটিংস।\n' +
      '• রেসিপি তৈরি হলে রেসিপি ডিটেইলে পুরো লেখা, কুক মোড, সেভ ও শেয়ার পাবেন।\n' +
      'লিস্ট/হাব স্ক্রিন সাধারণত ইংরেজি; রেসিপির ভাষা আপনি যা বেছে নিয়েছেন সেটা অনুসরণ করে।',
  },
  {
    id: 'recipe',
    title: 'রেসিপি ডিটেইল',
    body:
      '• কুক মোড: ধাপে ধাপে; টাইমারের শব্দ সেটিংস থেকে বদলান।\n' +
      '• সেভ: রেসিপি ফোনে সংরক্ষিত থাকে, এক্সপ্লোর থেকে খুলতে পারবেন।\n' +
      '• শেয়ার: টেক্সট ও সম্ভব হলে ছবি। কিছু অ্যাপ (যেমন Messenger) শুধু ছবি নিতে পারে—তখন ক্লিপবোর্ডে কপি থাকলে চ্যাটে পেস্ট করুন।\n' +
      '• শপিং লিস্ট: এক্সপ্লোর থেকে সেভ করা রেসিপি দিয়ে তালিকা বানান।',
  },
  {
    id: 'credits',
    title: 'ক্রেডিট ও কেনাকাটা',
    body:
      '• রেসিপি/ছবি তৈরিতে অ্যাপের নিয়ম অনুযায়ী ক্রেডিট কাটে।\n' +
      '• কেনাকাটা ডিভাইসের স্টোরের মাধ্যমে। এখানে চিকিৎসা, আইনি বা আর্থিক পরামর্শ দেওয়া হয় না—শুধু অ্যাপ কীভাবে চলে।',
  },
  {
    id: 'build',
    title: 'আপডেট ও Android বিল্ড',
    body:
      '• কিছু ফিচারের জন্য নতুন নেটিভ বিল্ড (APK) লাগতে পারে। বার্তা এলে ডেভেলপার ওয়ার্কফ্লো অনুযায়ী আবার বানান।\n' +
      '• ডেভ ক্লায়েন্ট: মিলিয়ে Metro চালু রাখুন।',
  },
  {
    id: 'privacy',
    title: 'সীমা ও নিরাপত্তা',
    body:
      '• এই হেল্প ও সার্চ শুধু ChefAI সম্পর্কে; ওয়েব ব্রাউজ করে না, আলাদা AI ডাকে না।\n' +
      '• পাসওয়ার্ড, ব্যাংক বা গোপন তথ্য লিখবেন না।\n' +
      '• খাদ্য নিরাপত্তা/স্বাস্থ্য: বিশেষজ্ঞের কাছে জিজ্ঞেস করুন।',
  },
];

const BN_FAQ: HelpFaq[] = [
  {
    id: 'share',
    q: 'Messenger এ শুধু ছবি যায় কেন?',
    a: 'কিছু অ্যাপ ছবির সাথে টেক্সট নেয় না। শেয়ার খোলার আগে পুরো রেসিপি ক্লিপবোর্ডে কপি হয়—ছবি পাঠানোর পর চ্যাটে লং-প্রেস করে পেস্ট করুন।',
    keywords: ['messenger', 'শেয়ার', 'share', 'ছবি', 'clipboard', 'কপি'],
  },
  {
    id: 'splash',
    q: 'স্প্ল্যাশ লোগো কাটা দেখাচ্ছে',
    a: 'Android ১২+ আলাদা লঞ্চ আইকন ব্যবহার করে। splash.png বদলালে প্রজেক্টে npm run sync:splash-android চালিয়ে তারপর APK আবার বানান।',
    keywords: ['splash', 'লোগো', 'android', 'apk', 'gradle'],
  },
  {
    id: 'metro',
    q: 'পুরনো স্ক্রিন দেখাচ্ছে',
    a: 'ডেভ ক্লায়েন্টে রিলোড করুন; নেটিভ বদল হলে নতুন APK। প্রয়োজনে Metro ক্লিয়ার।',
    keywords: ['metro', 'reload', 'expo', 'ক্যাশ'],
  },
  {
    id: 'timer',
    q: 'টাইমার শব্দ',
    a: 'সেটিংস → টাইমার অ্যালার্ম থেকে প্রিসেট বা নিজের অডিও (মোবাইল)। “শুনে দেখুন” দিয়ে পরীক্ষা।',
    keywords: ['টাইমার', 'timer', 'অ্যালার্ম', 'কুক'],
  },
  {
    id: 'language',
    q: 'এক্সপ্লোর ইংরেজি, রেসিপি বাংলা কেন?',
    a: 'হাব/লিস্টের ভাষা আলাদা নিয়ম; রেসিপির লেখা আপনি যে ভাষায় তৈরি করেছেন সেই অনুযায়ী।',
    keywords: ['ভাষা', 'language', 'বাংলা', 'ইংরেজি'],
  },
  {
    id: 'save',
    q: 'সেভ করা রেসিপি কোথায়?',
    a: 'এই ডিভাইসে, অ্যাপের ভিতরে। আলাদা “ক্লাউড ফিড” এ স্বয়ংক্রিয় আপলোড নয় যদি না অন্য কোনো ফিচার স্পষ্ট বলে।',
    keywords: ['সেভ', 'save', 'ডিভাইস'],
  },
  {
    id: 'credits_low',
    q: 'ক্রেডিট শেষ দেখাচ্ছে',
    a: 'অ্যাপের ক্রেডিট/বিলিং স্ক্রিন ও স্টোর অ্যাকাউন্ট দেখুন। অ্যাপের বাইরে পেমেন্ট প্রসেস করা হয় না।',
    keywords: ['ক্রেডিট', 'credits', 'কেনা'],
  },
  {
    id: 'help_search',
    q: 'সার্চে কী লিখব?',
    a: 'ছোট শব্দ: শেয়ার, সেভ, টাইমার, ভাষা, ক্রেডিট, splash। উত্তর শুধু এই গাইড থেকে—ইন্টারনেট নয়।',
    keywords: ['সার্চ', 'search', 'হেল্প'],
  },
];

const HI_TOPICS: HelpTopic[] = EN_TOPICS.map((t) =>
  t.id === 'start'
    ? {
        ...t,
        title: 'शुरुआत',
        body:
          '• होम: सामग्री, व्यंजन प्रकार, भाषा और रेसिपी प्रकार चुनें।\n' +
          '• एक्सप्लोर: सेव्ड रेसिपी, शॉपिंग लिस्ट, इतिहास, सेटिंग्स।\n' +
          '• रेसिपी तैयार होने पर विवरण में पूरा टेक्स्ट, कुक मोड, सेव और शेयर।\n' +
          'यह सहायता केवल ChefAI ऐप के बारे में है।',
      }
    : t.id === 'privacy'
      ? {
          ...t,
          title: 'दायरा और सुरक्षा',
          body:
            '• यह सहायता इंटरनेट नहीं खोलती और अलग AI नहीं बुलाती।\n' +
            '• पासवर्ड या बैंक विवरण न लिखें।\n' +
            '• स्वास्थ्य सलाह के लिए विशेषज्ञ से पूछें।',
        }
      : t
);

const HI_FAQ: HelpFaq[] = EN_FAQ.map((f) =>
  f.id === 'share'
    ? {
        ...f,
        q: 'Messenger में केवल फोटो क्यों जाती है?',
        a: 'कुछ ऐप्स इमेज के साथ टेक्स्ट नहीं लेते। शेयर से पहले पूरी रेसिपी क्लिपबोर्ड पर कॉपी हो सकती है—फोटो भेजने के बाद चैट में पेस्ट करें।',
        keywords: [...f.keywords, 'मेसेंजर', 'क्लिपबोर्ड'],
      }
    : f
);

const UR_TOPICS: HelpTopic[] = EN_TOPICS.map((t) =>
  t.id === 'start'
    ? {
        ...t,
        title: 'آغاز',
        body:
          '• ہوم: اجزاء، ذائقہ، زبان اور ریسپی کی قسم منتخب کریں۔\n' +
          '• ایکسپلور: محفوظ رسائل، خریداری کی فہرست، تاریخ، ترتیبات۔\n' +
          '• تیار ہونے پر تفصیل میں مکمل متن، کک موڈ، محفوظ اور شیئر۔\n' +
          'یہ مدد صرف ChefAI ایپ کے بارے میں ہے۔',
      }
    : t.id === 'privacy'
      ? {
          ...t,
          title: 'حد اور حفاظت',
          body:
            '• یہ مدد انٹرنیٹ نہیں کھولتی اور الگ AI نہیں بلاتی۔\n' +
            '• پاس ورڈ یا بینک کی تفصیلات نہ لکھیں۔\n' +
            '• صحت کے لیے ماہر سے پوچھیں۔',
        }
      : t
);

const UR_FAQ: HelpFaq[] = EN_FAQ.map((f) =>
  f.id === 'share'
    ? {
        ...f,
        q: 'Messenger میں صرف تصویر کیوں جاتی ہے؟',
        a: 'کچھ ایپس تصویر کے ساتھ متن نہیں لیتی۔ شیئر سے پہلے مکمل رسپی کلپ بورڈ پر کاپی ہو سکتی ہے—تصویر بھیجنے کے بعد چیٹ میں پیسٹ کریں۔',
        keywords: [...f.keywords, 'میسنجر', 'کلپ بورڈ'],
      }
    : f
);

export const HELP_BUNDLES: Record<HelpLangId, HelpBundle> = {
  en: {
    screenTitle: 'Help',
    chooseLanguageTitle: 'Choose help language',
    chooseLanguageSub: 'Guides and answers below will use this language. Only ChefAI is covered—no web search, no general AI answers.',
    continueHint: 'Tap a language to continue.',
    changeLanguage: 'Change help language',
    onlyChefAiNotice:
      'ChefAI Help: explanations and FAQ match this app only. Nothing here is medical, legal, or financial advice.',
    noNetworkLegal: 'No data is sent from Help search to a server for answering.',
    searchPlaceholder: 'Search topics & FAQ (e.g. share, timer, credits)',
    topicsHeading: 'Topics',
    faqHeading: 'Common questions',
    noSearchResults: 'No matching topics or questions. Try shorter words like: share, save, timer, credits.',
    topics: EN_TOPICS,
    faqs: EN_FAQ,
  },
  bn: {
    screenTitle: 'সাহায্য',
    chooseLanguageTitle: 'সাহায্যের ভাষা বেছে নিন',
    chooseLanguageSub:
      'নিচের গাইড ও প্রশ্নোত্তর এই ভাষায় থাকবে। শুধু ChefAI অ্যাপ—ওয়েব খোলা হয় না, সাধারণ AI উত্তর নেই।',
    continueHint: 'একটি ভাষায় ট্যাপ করুন।',
    changeLanguage: 'সাহায্যের ভাষা বদলান',
    onlyChefAiNotice:
      'ChefAI সাহায্য: শুধু এই অ্যাপ। চিকিৎসা, আইনি বা আর্থিক পরামর্শ নয়।',
    noNetworkLegal: 'সার্চের জন্য সার্ভারে প্রশ্ন পাঠানো হয় না।',
    searchPlaceholder: 'টপিক ও FAQ সার্চ (যেমন: শেয়ার, টাইমার, ক্রেডিট)',
    topicsHeading: 'বিষয়সমূহ',
    faqHeading: 'প্রায়শই জিজ্ঞাসা',
    noSearchResults: 'মিল পেল না। ছোট শব্দ চেষ্টা করুন: শেয়ার, সেভ, টাইমার, ক্রেডিট।',
    topics: BN_TOPICS,
    faqs: BN_FAQ,
  },
  hi: {
    screenTitle: 'सहायता',
    chooseLanguageTitle: 'सहायता भाषा चुनें',
    chooseLanguageSub:
      'नीचे की गाइड इसी भाषा में होगी। केवल ChefAI ऐप—वेब खोज नहीं, सामान्य AI उत्तर नहीं।',
    continueHint: 'जारी रखने के लिए भाषा पर टैप करें।',
    changeLanguage: 'सहायता भाषा बदलें',
    onlyChefAiNotice:
      'ChefAI सहायता: केवल यह ऐप। चिकित्सा, कानूनी या वित्तीय सलाह नहीं।',
    noNetworkLegal: 'खोज के लिए सर्वर पर सवाल नहीं भेजा जाता।',
    searchPlaceholder: 'टॉपिक व FAQ खोजें (जैसे: share, timer, credits)',
    topicsHeading: 'विषय',
    faqHeading: 'सामान्य प्रश्न',
    noSearchResults: 'कोई मेल नहीं। छोटे शब्द आज़माएँ: share, save, timer, credits.',
    topics: HI_TOPICS,
    faqs: HI_FAQ,
  },
  ur: {
    screenTitle: 'مدد',
    chooseLanguageTitle: 'مدد کی زبان منتخب کریں',
    chooseLanguageSub:
      'نیچے کی رہنمائی اسی زبان میں ہوگی۔ صرف ChefAI ایپ—ویب تلاش نہیں، عام AI جواب نہیں۔',
    continueHint: 'جاری رکھنے کے لیے زبان پر تھپتھپائیں۔',
    changeLanguage: 'مدد کی زبان بدلیں',
    onlyChefAiNotice:
      'ChefAI مدد: صرف یہ ایپ۔ طبی، قانونی یا مالی مشورہ نہیں۔',
    noNetworkLegal: 'تلاش کے لیے سرور پر سوال نہیں بھیجا جاتا۔',
    searchPlaceholder: 'موضوع و FAQ تلاش (مثلاً: share, timer, credits)',
    topicsHeading: 'عنوانات',
    faqHeading: 'عام سوالات',
    noSearchResults: 'کوئی میل نہیں۔ مختصر الفاظ آزمائیں: share, save, timer.',
    topics: UR_TOPICS,
    faqs: UR_FAQ,
  },
};

export function scoreHelpQuery(query: string, faq: HelpFaq): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const hay = [faq.q, faq.a, ...faq.keywords].join(' ').toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return hay.includes(q) ? 2 : 0;
  let s = 0;
  for (const w of words) {
    if (hay.includes(w)) s += 2;
    if (faq.keywords.some((k) => k.toLowerCase().includes(w))) s += 3;
  }
  return s;
}

export function topicMatchesQuery(query: string, topic: HelpTopic): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${topic.title}\n${topic.body}`.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return hay.includes(q);
  return words.some((w) => hay.includes(w));
}
