import type { HelpBundle, HelpFaq, HelpLangId, HelpTopic } from '@/constants/help-types';

const EN_TOPICS: HelpTopic[] = [
  {
    id: 'start',
    title: 'Getting started',
    body:
      '• Home: choose ingredients, cuisine, language, and how you want the recipe (text or with a dish photo).\n' +
      '• Explore: saved recipes, shopping lists, recent history, and a link to Settings.\n' +
      '• After a recipe is generated, open Recipe details for the full text, cook mode, save, and share.\n' +
      '• Hub and list screens stay in English; recipe text follows the language you picked for that recipe.',
  },
  {
    id: 'recipe',
    title: 'Recipe details',
    body:
      '• Cook mode: step-by-step with voice commands, timers, and optional alarm sounds (Settings → Timer alarm).\n' +
      '• Save recipe: stores on this device for offline access from Explore.\n' +
      '• Share: sends recipe text (with a Google Play link at the end) and, when possible, the dish photo. Some apps (e.g. Messenger) may only attach the photo—paste from clipboard if we copied the text there.\n' +
      '• Save photo to gallery: exports the dish image when you tap that action on Recipe details.\n' +
      '• Shopping list: build a list from saved recipes via Explore → Shopping Lists.',
  },
  {
    id: 'credits',
    title: 'Credits & purchases',
    body:
      '• Credits are used when you generate text or photo recipes (see costs on Recipe details).\n' +
      '• Tap Your credits or Buy credits on Recipe details. Purchases run through Google Play on Android.',
  },
  {
    id: 'build',
    title: 'Updates',
    body:
      '• Install the latest ChefAI from Google Play when an update is available.\n' +
      '• If a message says to update the app, open Play Store → ChefAI → Update, then reopen the app.\n' +
      '• After updating, force-stop the app if a screen still looks outdated, then open it again.',
  },
  {
    id: 'privacy',
    title: 'Scope & safety',
    body:
      '• Photos: ChefAI uses the system photo picker on Android—you choose each image; the app does not read your whole gallery.\n' +
      '• This Help section and FAQ search only describe ChefAI. They do not browse the web and do not call AI for answers.\n' +
      '• Do not enter passwords, bank details, or personal secrets in Help search.\n' +
      '• For food safety or health, ask a qualified professional—not this app.',
  },
];

const EN_FAQ: HelpFaq[] = [
  {
    id: 'share',
    q: 'Why does only the image go to Messenger?',
    a: 'Some apps ignore extra text when an image is shared. We copy the full recipe to the clipboard before opening share—paste it in the chat after sending the photo.',
    keywords: ['messenger', 'share', 'clipboard', 'photo', 'image', 'facebook', 'whatsapp'],
  },
  {
    id: 'share_playstore',
    q: 'Why is there a Google Play link when I share a recipe?',
    a: 'Shared recipe text ends with a short download link so friends can install ChefAI. Only the recipe body and that footer are shared—nothing else from your phone.',
    keywords: ['play', 'store', 'link', 'share', 'footer', 'download'],
  },
  {
    id: 'photo_picker',
    q: 'How does ChefAI access my photos?',
    a: 'On Android, ChefAI opens the system photo picker—you tap the images you want (ingredient scan, community post). The app does not request broad access to your entire gallery.',
    keywords: ['photo', 'gallery', 'permission', 'picker', 'camera', 'image'],
  },
  {
    id: 'gallery_save',
    q: 'Save photo to gallery',
    a: 'On Recipe details, tap Save photo to gallery when a dish image is shown. Only that image is saved—you choose when to export it.',
    keywords: ['save', 'gallery', 'photo', 'export', 'image'],
  },
  {
    id: 'splash',
    q: 'Splash logo looks cropped on Android',
    a: 'Update ChefAI to the latest version from Google Play. Launch icons can look different on Android 12+; a store update includes the newest assets.',
    keywords: ['splash', 'logo', 'android', 'launch', 'icon', 'update'],
  },
  {
    id: 'metro',
    q: 'App opens but shows an old screen',
    a: 'Update from Google Play, then force-stop ChefAI in Android Settings → Apps and open it again. If it persists, uninstall and reinstall from the store.',
    keywords: ['old', 'screen', 'stale', 'cache', 'update', 'reload'],
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
    a: 'Hub and list screens stay in English; recipe content follows the language you chose when you generated that recipe.',
    keywords: ['language', 'bangla', 'english', 'explore', 'hub'],
  },
  {
    id: 'save',
    q: 'Where are saved recipes stored?',
    a: 'On this device, inside the app. They are not uploaded to a ChefAI cloud unless a feature explicitly says it syncs online.',
    keywords: ['save', 'storage', 'offline', 'device', 'cloud'],
  },
  {
    id: 'credits_low',
    q: 'It says I have no credits',
    a: 'Open Recipe details and tap Your credits or Buy credits. Payments run through Google Play only—ChefAI cannot charge outside that flow.',
    keywords: ['credits', 'billing', 'pay', 'purchase', 'recipe', 'details'],
  },
  {
    id: 'review',
    q: 'Rate ChefAI popup after cooking',
    a: 'After you finish Cook Mode a few times, Android may show the official Google Play rating sheet. The system decides when—it is optional and not every session.',
    keywords: ['rate', 'review', 'stars', 'play', 'cook', 'rating'],
  },
  {
    id: 'help_search',
    q: 'What can I type in Help search?',
    a: 'Short words about the app: share, save, timer, credits, photo, update, language. Answers come only from this built-in guide—not from the internet.',
    keywords: ['search', 'help', 'faq', 'question'],
  },
];

const BN_TOPICS: HelpTopic[] = [
  {
    id: 'start',
    title: 'শুরু করুন',
    body:
      '• হোম: উপকরণ, রান্নার ধরন, ভাষা আর রেসিপি ধরন (টেক্সট / ছবিসহ) বেছে নিন।\n' +
      '• এক্সপ্লোর: সেভ করা রেসিপি, শপিং লিস্ট, সাম্প্রতিক ইতিহাস, সেটিংসের লিংক।\n' +
      '• রেসিপি তৈরি হলে রেসিপি ডিটেইলে পুরো লেখা, কুক মোড, সেভ ও শেয়ার পাবেন।\n' +
      '• হাব/লিস্ট স্ক্রিন ইংরেজিতে থাকে; রেসিপির লেখা আপনি যে ভাষায় তৈরি করেছেন সেই অনুযায়ী।',
  },
  {
    id: 'recipe',
    title: 'রেসিপি ডিটেইল',
    body:
      '• কুক মোড: ধাপে ধাপে, ভয়েস কমান্ড, টাইমার; অ্যালার্ম শব্দ সেটিংস → টাইমার অ্যালার্ম।\n' +
      '• সেভ: রেসিপি ফোনে সংরক্ষিত—এক্সপ্লোর থেকে খুলুন।\n' +
      '• শেয়ার: টেক্সট (শেষে Google Play লিংক) ও সম্ভব হলে ছবি। Messenger শুধু ছবি নিলে ক্লিপবোর্ড থেকে পেস্ট করুন।\n' +
      '• গ্যালারিতে ছবি সেভ: রেসিপি ডিটেইলে “Save photo to gallery”।\n' +
      '• শপিং লিস্ট: এক্সপ্লোর → Shopping Lists থেকে সেভ করা রেসিপি দিয়ে।',
  },
  {
    id: 'credits',
    title: 'ক্রেডিট ও কেনাকাটা',
    body:
      '• টেক্সট/ফটো রেসিপি তৈরিতে ক্রেডিট কাটে (খরচ রেসিপি ডিটেইলে দেখুন)।\n' +
      '• রেসিপি ডিটেইলে Your credits বা Buy credits—Android-এ কেনাকাটা Google Play দিয়ে।',
  },
  {
    id: 'build',
    title: 'আপডেট',
    body:
      '• Google Play থেকে ChefAI-এর সর্বশেষ ভার্সন ইনস্টল রাখুন।\n' +
      '• “অ্যাপ আপডেট করুন” বার্তা এলে Play Store → Update চাপুন, তারপর অ্যাপ আবার খুলুন।\n' +
      '• আপডেটের পরও পুরনো স্ক্রিন দেখালে Settings → Apps থেকে Force stop করে আবার খুলুন।',
  },
  {
    id: 'privacy',
    title: 'সীমা ও নিরাপত্তা',
    body:
      '• ছবি: Android-এ সিস্টেম ফটো পিকার—আপনি বেছে নেওয়া ছবি; পুরো গ্যালারি পড়া হয় না।\n' +
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
    id: 'share_playstore',
    q: 'শেয়ারে Google Play লিংক কেন?',
    a: 'শেয়ার করা রেসিপির শেষে ছোট ডাউনলোড লিংক যোগ হয় যাতে বন্ধুরা ChefAI ইনস্টল করতে পারে। শুধু রেসিপি টেক্সট ও সেই ফুটার—আপনার ফোনের অন্য কিছু যায় না।',
    keywords: ['play', 'store', 'লিংক', 'শেয়ার', 'ডাউনলোড'],
  },
  {
    id: 'photo_picker',
    q: 'ChefAI আমার ছবি কীভাবে নেয়?',
    a: 'Android-এ সিস্টেম ফটো পিকার খোলে—আপনি যে ছবি চান সেটাই বেছে নিন (উপকরণ স্ক্যান, কমিউনিটি)। পুরো গ্যালারির অনুমতি চাওয়া হয় না।',
    keywords: ['ছবি', 'গ্যালারি', 'permission', 'পিকার', 'ক্যামেরা', 'photo'],
  },
  {
    id: 'gallery_save',
    q: 'গ্যালারিতে ছবি সেভ',
    a: 'রেসিপি ডিটেইলে ডিশ ছবি থাকলে “Save photo to gallery” ট্যাপ করুন। শুধু সেই ছবিটি সেভ হয়—আপনি চাইলে তবেই।',
    keywords: ['সেভ', 'গ্যালারি', 'ছবি', 'export'],
  },
  {
    id: 'splash',
    q: 'স্প্ল্যাশ লোগো কাটা দেখাচ্ছে',
    a: 'Google Play থেকে ChefAI আপডেট করুন। Android ১২+ এ লঞ্চ আইকন আলাদা দেখাতে পারে; স্টোর আপডেটে নতুন অ্যাসেট থাকে।',
    keywords: ['splash', 'লোগো', 'android', 'আইকন', 'আপডেট'],
  },
  {
    id: 'metro',
    q: 'পুরনো স্ক্রিন দেখাচ্ছে',
    a: 'Play Store থেকে আপডেট করুন, তারপর Settings → Apps থেকে ChefAI Force stop করে আবার খুলুন। না হলে স্টোর থেকে আনইনস্টল করে পুনরায় ইনস্টল করুন।',
    keywords: ['পুরনো', 'স্ক্রিন', 'আপডেট', 'ক্যাশ'],
  },
  {
    id: 'timer',
    q: 'টাইমার শব্দ',
    a: 'সেটিংস → টাইমার অ্যালার্ম থেকে প্রিসেট বা নিজের অডিও (মোবাইল)। Preview দিয়ে পরীক্ষা।',
    keywords: ['টাইমার', 'timer', 'অ্যালার্ম', 'কুক'],
  },
  {
    id: 'language',
    q: 'এক্সপ্লোর ইংরেজি, রেসিপি বাংলা কেন?',
    a: 'হাব/লিস্ট ইংরেজিতে; রেসিপির লেখা আপনি যে ভাষায় তৈরি করেছেন সেই অনুযায়ী।',
    keywords: ['ভাষা', 'language', 'বাংলা', 'ইংরেজি'],
  },
  {
    id: 'save',
    q: 'সেভ করা রেসিপি কোথায়?',
    a: 'এই ডিভাইসে, অ্যাপের ভিতরে। অনলাইন সিঙ্ক না বললে ক্লাউডে অটো আপলোড হয় না।',
    keywords: ['সেভ', 'save', 'ডিভাইস', 'ক্লাউড'],
  },
  {
    id: 'credits_low',
    q: 'ক্রেডিট শেষ দেখাচ্ছে',
    a: 'রেসিপি ডিটেইল খুলে Your credits বা Buy credits ট্যাপ করুন। পেমেন্ট শুধু Google Play দিয়ে—অ্যাপের বাইরে নয়।',
    keywords: ['ক্রেডিট', 'credits', 'কেনা', 'রেসিপি'],
  },
  {
    id: 'review',
    q: 'রান্না শেষে রেটিং পপআপ',
    a: 'কুক মোড কয়েকবার শেষ করলে Android Google Play রেটিং শিট দেখাতে পারে। সিস্টেম সিদ্ধান্ত নেয়—ঐচ্ছিক, প্রতিবার নয়।',
    keywords: ['রেট', 'রিভিউ', 'স্টার', 'কুক'],
  },
  {
    id: 'help_search',
    q: 'সার্চে কী লিখব?',
    a: 'ছোট শব্দ: শেয়ার, সেভ, টাইমার, ক্রেডিট, ছবি, আপডেট, ভাষা। উত্তর শুধু এই গাইড থেকে—ইন্টারনেট নয়।',
    keywords: ['সার্চ', 'search', 'হেল্প'],
  },
];

const HI_TOPICS: HelpTopic[] = [
  {
    id: 'start',
    title: 'शुरुआत',
    body:
      '• होम: सामग्री, व्यंजन, भाषा और रेसिपी प्रकार (टेक्स्ट / फोटो) चुनें।\n' +
      '• एक्सप्लोर: सेव्ड रेसिपी, शॉपिंग लिस्ट, इतिहास, सेटिंग्स।\n' +
      '• रेसिपी तैयार होने पर विवरण में पूरा टेक्स्ट, कुक मोड, सेव और शेयर।\n' +
      '• हब/लिस्ट स्क्रीन अंग्रेज़ी में; रेसिपी आपकी चुनी भाषा में।',
  },
  {
    id: 'recipe',
    title: 'रेसिपी विवरण',
    body:
      '• कुक मोड: चरण-दर-चरण, वॉइस, टाइमर; अलार्म ध्वनि सेटिंग्स → टाइमर अलार्म।\n' +
      '• सेव: इस डिवाइस पर; एक्सप्लोर से खोलें।\n' +
      '• शेयर: टेक्स्ट (अंत में Google Play लिंक) और फोटो। Messenger केवल फोटो ले तो क्लिपबोर्ड से पेस्ट करें।\n' +
      '• गैलरी में फोटो सेव: रेसिपी विवरण पर “Save photo to gallery”।\n' +
      '• शॉपिंग लिस्ट: एक्सप्लोर → Shopping Lists।',
  },
  {
    id: 'credits',
    title: 'क्रेडिट और खरीद',
    body:
      '• टेक्स्ट/फोटो रेसिपी पर क्रेडिट खर्च (विवरण पर लागत देखें)।\n' +
      '• रेसिपी विवरण पर Your credits या Buy credits—Android पर Google Play से खरीद।',
  },
  {
    id: 'build',
    title: 'अपडेट',
    body:
      '• Google Play से ChefAI का नवीनतम संस्करण रखें।\n' +
      '• अपडेट संदेश आए तो Play Store → Update, फिर ऐप दोबारा खोलें।\n' +
      '• पुरानी स्क्रीन दिखे तो Settings → Apps से Force stop करें।',
  },
  {
    id: 'privacy',
    title: 'दायरा और सुरक्षा',
    body:
      '• फोटो: Android पर सिस्टम फोटो पिकर—आप चुनते हैं; पूरी गैलरी नहीं पढ़ी जाती।\n' +
      '• यह सहायता केवल ChefAI के बारे में; वेब या अलग AI नहीं।\n' +
      '• पासवर्ड या बैंक विवरण न लिखें।\n' +
      '• स्वास्थ्य सलाह के लिए विशेषज्ञ से पूछें।',
  },
];

const HI_FAQ: HelpFaq[] = [
  {
    id: 'share',
    q: 'Messenger में केवल फोटो क्यों जाती है?',
    a: 'कुछ ऐप्स इमेज के साथ टेक्स्ट नहीं लेते। शेयर से पहले पूरी रेसिपी क्लिपबोर्ड पर कॉपी होती है—फोटो भेजने के बाद चैट में पेस्ट करें।',
    keywords: ['messenger', 'share', 'clipboard', 'photo', 'शेयर'],
  },
  {
    id: 'share_playstore',
    q: 'शेयर में Google Play लिंक क्यों?',
    a: 'शेयर टेक्स्ट के अंत में छोटा डाउनलोड लिंक जोड़ा जाता है ताकि दोस्त ChefAI इंस्टॉल कर सकें।',
    keywords: ['play', 'store', 'link', 'share'],
  },
  {
    id: 'photo_picker',
    q: 'ChefAI मेरी फोटो कैसे लेता है?',
    a: 'Android पर सिस्टम फोटो पिकर खुलता है—आप जो चुनें वही। पूरी गैलरी की अनुमति नहीं मांगी जाती।',
    keywords: ['photo', 'gallery', 'permission', 'picker'],
  },
  {
    id: 'gallery_save',
    q: 'गैलरी में फोटो सेव',
    a: 'रेसिपी विवरण पर Save photo to gallery टैप करें जब डिश इमेज दिखे।',
    keywords: ['save', 'gallery', 'photo'],
  },
  {
    id: 'splash',
    q: 'स्प्लैश लोगो कटा दिखता है',
    a: 'Google Play से ChefAI अपडेट करें। Android 12+ पर लॉन्च आइकन अलग दिख सकता है।',
    keywords: ['splash', 'logo', 'android', 'update'],
  },
  {
    id: 'metro',
    q: 'पुरानी स्क्रीन दिख रही है',
    a: 'Play Store से अपडेट करें, फिर Settings → Apps से Force stop करके ऐप दोबारा खोलें।',
    keywords: ['old', 'screen', 'update', 'cache'],
  },
  {
    id: 'timer',
    q: 'कुक मोड में टाइमर ध्वनि',
    a: 'सेटिंग्स → टाइमर अलार्म: प्रीसेट या अपनी ऑडियो फ़ाइल। Preview से जाँचें।',
    keywords: ['timer', 'alarm', 'cook'],
  },
  {
    id: 'language',
    q: 'एक्सप्लोर अंग्रेज़ी, रेसिपी हिंदी क्यों?',
    a: 'हब/लिस्ट अंग्रेज़ी में; रेसिपी आपकी चुनी भाषा में।',
    keywords: ['language', 'hindi', 'english', 'explore'],
  },
  {
    id: 'save',
    q: 'सेव्ड रेसिपी कहाँ है?',
    a: 'इस डिवाइस पर, ऐप के अंदर। क्लाउड पर स्वतः अपलोड नहीं जब तक कोई फीचर स्पष्ट न कहे।',
    keywords: ['save', 'storage', 'device'],
  },
  {
    id: 'credits_low',
    q: 'क्रेडिट खत्म दिख रहा है',
    a: 'रेसिपी विवरण खोलकर Your credits या Buy credits टैप करें। भुगतान केवल Google Play से।',
    keywords: ['credits', 'billing', 'purchase'],
  },
  {
    id: 'review',
    q: 'खाना बनाने के बाद रेटिंग पॉपअप',
    a: 'कुक मोड कुछ बार पूरा करने के बाद Android Google Play रेटिंग दिखा सकता है—वैकल्पिक, हर बार नहीं।',
    keywords: ['rate', 'review', 'cook'],
  },
  {
    id: 'help_search',
    q: 'सर्च में क्या लिखूँ?',
    a: 'छोटे शब्द: share, save, timer, credits, photo, update। उत्तर केवल इस गाइड से।',
    keywords: ['search', 'help', 'faq'],
  },
];

const UR_TOPICS: HelpTopic[] = [
  {
    id: 'start',
    title: 'آغاز',
    body:
      '• ہوم: اجزاء، ذائقہ، زبان اور ریسپی کی قسم (ٹیکسٹ / تصویر)۔\n' +
      '• ایکسپلور: محفوظ رسپی، شاپنگ لسٹ، تاریخ، ترتیبات۔\n' +
      '• تیار ہونے پر تفصیل میں مکمل متن، کک موڈ، محفوظ اور شیئر۔\n' +
      '• ہب/لسٹ انگریزی میں؛ رسپی آپ کی چنی زبان میں۔',
  },
  {
    id: 'recipe',
    title: 'رسپی کی تفصیل',
    body:
      '• کک موڈ: قدم بہ قدم، آواز، ٹائمر؛ الارم آواز ترتیبات → ٹائمر الارم۔\n' +
      '• محفوظ: اس ڈیوائس پر؛ ایکسپلور سے کھولیں۔\n' +
      '• شیئر: متن (آخر میں Google Play لنک) اور تصویر۔ Messenger صرف تصویر لے تو کلپ بورڈ سے پیسٹ کریں۔\n' +
      '• گیلری میں تصویر: رسپی تفصیل پر “Save photo to gallery”۔\n' +
      '• شاپنگ لسٹ: ایکسپلور → Shopping Lists۔',
  },
  {
    id: 'credits',
    title: 'کریڈٹ اور خریداری',
    body:
      '• ٹیکسٹ/فوٹو رسپی پر کریڈٹ خرچ (تفصیل پر لاگت دیکھیں)۔\n' +
      '• رسپی تفصیل پر Your credits یا Buy credits—Android پر Google Play سے۔',
  },
  {
    id: 'build',
    title: 'اپ ڈیٹ',
    body:
      '• Google Play سے ChefAI کا تازہ ترین ورژن رکھیں۔\n' +
      '• اپ ڈیٹ کا پیغام آئے تو Play Store → Update، پھر ایپ دوبارہ کھولیں۔\n' +
      '• پرانی سکرین دکھے تو Settings → Apps سے Force stop کریں۔',
  },
  {
    id: 'privacy',
    title: 'حد اور حفاظت',
    body:
      '• تصاویر: Android پر سسٹم فوٹو پکر—آپ منتخب کرتے ہیں؛ پوری گیلری نہیں پڑھی جاتی۔\n' +
      '• یہ مدد صرف ChefAI کے بارے میں؛ ویب یا الگ AI نہیں۔\n' +
      '• پاس ورڈ یا بینک کی تفصیلات نہ لکھیں۔\n' +
      '• صحت کے لیے ماہر سے پوچھیں۔',
  },
];

const UR_FAQ: HelpFaq[] = [
  {
    id: 'share',
    q: 'Messenger میں صرف تصویر کیوں جاتی ہے؟',
    a: 'کچھ ایپس تصویر کے ساتھ متن نہیں لیتی۔ شیئر سے پہلے مکمل رسپی کلپ بورڈ پر کاپی ہوتی ہے—تصویر بھیجنے کے بعد چیٹ میں پیسٹ کریں۔',
    keywords: ['messenger', 'share', 'clipboard', 'تصویر'],
  },
  {
    id: 'share_playstore',
    q: 'شیئر میں Google Play لنک کیوں؟',
    a: 'شیئر متن کے آخر میں چھوٹا ڈاؤن لوڈ لنک تاکہ دوست ChefAI انسٹال کر سکیں۔',
    keywords: ['play', 'store', 'link', 'share'],
  },
  {
    id: 'photo_picker',
    q: 'ChefAI میری تصاویر کیسے لیتا ہے؟',
    a: 'Android پر سسٹم فوٹو پکر کھلتا ہے—آپ جو چنیں۔ پوری گیلری کی اجازت نہیں مانگی جاتی۔',
    keywords: ['photo', 'gallery', 'permission', 'picker'],
  },
  {
    id: 'gallery_save',
    q: 'گیلری میں تصویر محفوظ',
    a: 'رسپی تفصیل پر Save photo to gallery ٹیپ کریں جب ڈش کی تصویر ہو۔',
    keywords: ['save', 'gallery', 'photo'],
  },
  {
    id: 'splash',
    q: 'سپلاش لوگو کٹا نظر آتا ہے',
    a: 'Google Play سے ChefAI اپ ڈیٹ کریں۔ Android 12+ پر لانچ آئیکن مختلف ہو سکتا ہے۔',
    keywords: ['splash', 'logo', 'android', 'update'],
  },
  {
    id: 'metro',
    q: 'پرانی سکرین دکھ رہی ہے',
    a: 'Play Store سے اپ ڈیٹ کریں، پھر Settings → Apps سے Force stop کر کے ایپ دوبارہ کھولیں۔',
    keywords: ['old', 'screen', 'update'],
  },
  {
    id: 'timer',
    q: 'کک موڈ میں ٹائمر آواز',
    a: 'ترتیبات → ٹائمر الارم: پری سیٹ یا اپنی آڈیو۔ Preview سے جانچیں۔',
    keywords: ['timer', 'alarm', 'cook'],
  },
  {
    id: 'language',
    q: 'ایکسپلور انگریزی، رسپی اردو کیوں؟',
    a: 'ہب/لسٹ انگریزی میں؛ رسپی آپ کی چنی زبان میں۔',
    keywords: ['language', 'urdu', 'english'],
  },
  {
    id: 'save',
    q: 'محفوظ رسپی کہاں ہے؟',
    a: 'اس ڈیوائس پر، ایپ کے اندر۔ کلاؤڈ پر خودکار اپ لوڈ نہیں جب تک کوئی فیچر صاف نہ کہے۔',
    keywords: ['save', 'storage', 'device'],
  },
  {
    id: 'credits_low',
    q: 'کریڈٹ ختم دکھ رہا ہے',
    a: 'رسپی تفصیل کھول کر Your credits یا Buy credits ٹیپ کریں۔ ادائیگی صرف Google Play سے۔',
    keywords: ['credits', 'billing', 'purchase'],
  },
  {
    id: 'review',
    q: 'پکانے کے بعد ریٹنگ پاپ اپ',
    a: 'کک موڈ کئی بار مکمل کرنے کے بعد Android Google Play ریٹنگ دکھا سکتا ہے—اختیاری، ہر بار نہیں۔',
    keywords: ['rate', 'review', 'cook'],
  },
  {
    id: 'help_search',
    q: 'تلاش میں کیا لکھوں؟',
    a: 'مختصر الفاظ: share, save, timer, credits, photo, update۔ جواب صرف اس گائیڈ سے۔',
    keywords: ['search', 'help', 'faq'],
  },
];

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
    searchPlaceholder: 'Search topics & FAQ (e.g. share, timer, credits, photo)',
    topicsHeading: 'Topics',
    faqHeading: 'Common questions',
    noSearchResults: 'No matching topics or questions. Try shorter words like: share, save, timer, credits, photo.',
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
    searchPlaceholder: 'টপিক ও FAQ সার্চ (যেমন: শেয়ার, টাইমার, ক্রেডিট, ছবি)',
    topicsHeading: 'বিষয়সমূহ',
    faqHeading: 'প্রায়শই জিজ্ঞাসা',
    noSearchResults: 'মিল পেল না। ছোট শব্দ চেষ্টা করুন: শেয়ার, সেভ, টাইমার, ক্রেডিট, ছবি।',
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
    searchPlaceholder: 'टॉपिक व FAQ खोजें (जैसे: share, timer, credits, photo)',
    topicsHeading: 'विषय',
    faqHeading: 'सामान्य प्रश्न',
    noSearchResults: 'कोई मेल नहीं। छोटे शब्द आज़माएँ: share, save, timer, credits, photo.',
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
    searchPlaceholder: 'موضوع و FAQ تلاش (مثلاً: share, timer, credits, photo)',
    topicsHeading: 'عنوانات',
    faqHeading: 'عام سوالات',
    noSearchResults: 'کوئی میل نہیں۔ مختصر الفاظ آزمائیں: share, save, timer, photo.',
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
