/** Split backend/plain recipe text into ordered steps for cook mode. */

function stripBullet(line: string) {
  return line.replace(/^[•\-\*]\s*/, '').trim();
}

function stripNumberPrefix(line: string) {
  const m = line.match(/^\d+[\.)]\s+(.+)$/);
  return m ? m[1].trim() : line.trim();
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Maps Bengali / Arabic-Indic digits to ASCII so `\d+` patterns match recipe text. */
export function normalizeNumeralsForParse(input: string): string {
  return [...input]
    .map((ch) => {
      const bn = BN_DIGITS.indexOf(ch);
      if (bn !== -1) return String(bn);
      const ar = AR_DIGITS.indexOf(ch);
      if (ar !== -1) return String(ar);
      return ch;
    })
    .join('');
}

/**
 * Section header keywords meaning "the actual cooking steps follow". When any of
 * these appears on its own line, everything *after* it is the cookable list and
 * everything *before* it (yields, ingredients, …) is reference metadata.
 */
const INSTRUCTION_SECTION_HEADERS = [
  'instructions', 'directions', 'method', 'methods',
  'steps', 'step by step', 'procedure',
  'cooking instructions', 'cooking steps',
  'নির্দেশনা', 'নির্দেশ', 'প্রস্তুত প্রণালী', 'প্রণালী', 'পদ্ধতি', 'রান্নার পদ্ধতি',
  'রন্ধন প্রণালী', 'রান্নার নিয়ম',
  'निर्देश', 'विधि', 'तरीका', 'पकाने का तरीका', 'बनाने की विधि',
  'تعليمات', 'طريقة', 'طريقة التحضير', 'طريقة الطبخ', 'الخطوات',
  'بنانے کا طریقہ', 'ترکیب', 'ہدایات',
  'instrucciones', 'método', 'metodo', 'modo de preparación',
  'mode opératoire', 'méthode',
  'hazırlanışı', 'yapılışı', 'pişirme talimatı',
  'دستورالعمل', 'روش', 'طرز تهیه', 'مراحل',
  '做法', '步骤', '制作方法', '烹饪步骤', '烹飪步驟',
  '作り方', '手順', '調理手順',
  '만드는 법', '조리법', '조리 방법',
  'οδηγίες', 'μέθοδος',
  'modo de preparo', 'preparo',
];

/**
 * Section header keywords meaning "this line is reference info, not a step".
 * Lines starting with these are dropped when no instructions header is present
 * (and trailing blocks like "Notes:" are also trimmed off after the steps end).
 */
const METADATA_SECTION_HEADERS = [
  'yields', 'yield', 'serves', 'servings', 'serving', 'serving size', 'makes', 'portions',
  'ingredients', 'ingredient list', 'shopping list',
  'prep time', 'preparation time', 'cook time', 'cooking time', 'total time',
  'time', 'difficulty', 'cuisine', 'course', 'category',
  'notes', 'note', 'tips', 'tip', 'pro tip', 'chef tip',
  'nutrition', 'calories',
  'উপকরণ', 'উপকরণসমূহ', 'পরিমাণ', 'পরিবেশন', 'প্রস্তুতি সময়', 'রান্নার সময়', 'মোট সময়',
  'টিপস', 'টিপ', 'নোট', 'সময়', 'কষ্টের মাত্রা',
  'सामग्री', 'सर्विंग्स', 'कुल समय', 'पकाने का समय', 'तैयारी का समय', 'टिप्स', 'पोषण',
  'مكونات', 'مقادير', 'الوقت', 'ملاحظات', 'حصص', 'القيمة الغذائية',
  'اجزاء', 'اجزائے ترکیبی', 'تیاری کا وقت', 'پکانے کا وقت',
  'ingredientes', 'tiempo', 'porciones', 'tiempo de preparación', 'tiempo de cocción',
  'rinde', 'rendimiento', 'notas',
  'temps', 'temps de préparation', 'temps de cuisson', 'portions', 'ingrédients',
  'malzemeler', 'porsiyon', 'süre', 'hazırlık süresi', 'pişirme süresi', 'toplam süre',
  'مواد', 'مواد لازم', 'پیمانه', 'تعداد نفرات', 'زمان آماده‌سازی', 'زمان پخت',
  '材料', '份量', '时间', '准备时间', '烹饪时间', '总时间', '備註',
  '재료', '분량', '시간', '준비 시간', '조리 시간',
  'υλικά', 'χρόνος', 'μερίδες',
  'tempo', 'porções', 'tempo de preparo', 'tempo de cozimento',
];

/** Strip markdown decoration so header detection works on `**Instructions:**` etc. */
function stripDecorativePrefix(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>+\s*/, '')
    .replace(/\*+/g, '')
    .replace(/_{2,}/g, '')
    .trim();
}

function lineMatchesAnyHeader(line: string, headers: readonly string[]): boolean {
  const cleaned = stripDecorativePrefix(line).toLowerCase();
  if (!cleaned) return false;
  for (const h of headers) {
    const hl = h.toLowerCase();
    if (cleaned === hl) return true;
    if (cleaned.startsWith(`${hl}:`) || cleaned.startsWith(`${hl}：`)) return true;
    if (cleaned.startsWith(`${hl} —`) || cleaned.startsWith(`${hl} -`)) return true;
    if (cleaned.startsWith(`${hl} –`)) return true;
  }
  return false;
}

function isInstructionsHeaderLine(line: string): boolean {
  return lineMatchesAnyHeader(line, INSTRUCTION_SECTION_HEADERS);
}

function isMetadataHeaderLine(line: string): boolean {
  return lineMatchesAnyHeader(line, METADATA_SECTION_HEADERS);
}

/** Lines like `1.`, `2)`, `৩।`, or `*1*` that have no actual content of their own. */
function isStandaloneNumberMarker(line: string): boolean {
  const t = stripDecorativePrefix(line);
  if (!t) return true;
  const ascii = normalizeNumeralsForParse(t);
  return /^\d+[\.)।]?$/.test(ascii);
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Scan the *entire text* (not just line starts) for an "Instructions" / "Method"
 * / "Steps" header followed by a separator. Returns the offset where the actual
 * cookable content starts. This handles single-paragraph recipes such as
 * "Yields: 4 servings. Ingredients: …. Instructions: 1. Whisk …" where line-based
 * detection fails because the whole recipe lives on one line.
 */
function findInstructionsAnchor(text: string): number | null {
  let earliestEnd: number | null = null;
  for (const h of INSTRUCTION_SECTION_HEADERS) {
    // (?:^|[^letter/digit]) gives us a word boundary that also works for non-Latin
    // scripts (Bangla/Hindi/Arabic), which the plain `\b` does not.
    const re = new RegExp(
      `(?:^|[^\\p{L}\\p{N}])${escapeRegex(h)}\\s*[:：—–\\-\\n]\\s*`,
      'iu'
    );
    const m = re.exec(text);
    if (m) {
      const end = m.index + m[0].length;
      if (earliestEnd == null || end < earliestEnd) earliestEnd = end;
    }
  }
  return earliestEnd;
}

/**
 * Split inline numbered steps such as "1. Whisk … 2. Toss … 3. Heat …" into
 * separate clean steps with the "N." prefix removed. Works on both single-line
 * paragraphs and multi-line text. Bengali / Arabic-Indic numerals are supported.
 */
function splitNumberedInline(text: string): string[] {
  const ascii = normalizeNumeralsForParse(text);
  // Numerator is preceded by start-of-string or whitespace and followed by `.`,
  // `)`, or Bangla dari `।`, then mandatory whitespace before the step prose.
  const re = /(?:^|\s)(\d+)[.)।]\s+/g;
  const starts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(ascii)) !== null) {
    const digitOffset = m[0].search(/\d/);
    starts.push(m.index + digitOffset);
  }
  if (starts.length < 2) return [];
  const out: string[] = [];
  for (let i = 0; i < starts.length; i += 1) {
    const segStart = starts[i];
    const segEnd = i + 1 < starts.length ? starts[i + 1] : text.length;
    const segment = text.slice(segStart, segEnd).trim();
    const stripped = segment.replace(/^[\d০-৯٠-٩]+[.)।]\s+/, '').trim();
    if (stripped) out.push(stripped);
  }
  return out;
}

/**
 * Split a single paragraph into sentences without breaking on `1.5`, `e.g.`, etc.
 * Sentence boundary = terminator (.!?।) + whitespace + capital letter / digit /
 * Bengali / Devanagari / Arabic letter.
 */
const SENTENCE_SPLIT_RE = /(?<=[.!?।])\s+(?=[A-Z\d\u0980-\u09FF\u0900-\u097F\u0600-\u06FF])/;

function preprocessRecipeText(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .trim();
}

export function parseRecipeSteps(recipeText: string): string[] {
  const raw = preprocessRecipeText(recipeText);
  if (!raw) return [];

  // 1) Slice off the "Yields/Ingredients/…" preamble by anchoring on an
  //    "Instructions" / "Method" / "Steps" / etc. header found *anywhere* in
  //    the text. Falls through unchanged if no such header exists.
  const anchor = findInstructionsAnchor(raw);
  const cookText = (anchor != null ? raw.slice(anchor) : raw).trim();
  if (!cookText) return [raw];

  // 2) First try splitting on inline numbered markers — this is the most reliable
  //    signal whether the recipe is a single paragraph or already multi-line.
  const inlineNumbered = splitNumberedInline(cookText);
  if (inlineNumbered.length >= 2) {
    const cleaned = inlineNumbered
      .filter((s) => !isMetadataHeaderLine(s))
      .filter((s) => !isStandaloneNumberMarker(s));
    if (cleaned.length >= 2) return cleaned;
  }

  // 3) Otherwise split on newlines and apply the existing bullet/numbered/plain
  //    fallbacks. Metadata header lines and standalone number markers are
  //    dropped per-line so that interleaved tips don't truncate real steps.
  const allLines = cookText
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !isMetadataHeaderLine(l))
    .filter((l) => !isStandaloneNumberMarker(l));

  if (allLines.length >= 2) {
    const fromBullets = allLines
      .filter((l) => /^[•\-\*]\s/.test(l))
      .map((l) => stripBullet(l))
      .filter(Boolean);
    if (fromBullets.length >= 2) return fromBullets;

    const numbered: string[] = [];
    for (const line of allLines) {
      const asciiLine = normalizeNumeralsForParse(line);
      const m = asciiLine.match(/^(\d+)[\.)]\s+(.+)$/);
      if (m?.[2]) numbered.push(m[2].trim());
    }
    if (numbered.length >= 2) return numbered;

    return allLines.map((l) => stripNumberPrefix(stripBullet(l))).filter(Boolean);
  }

  // 4) Single-paragraph fallback: split on sentence boundaries and drop metadata
  //    sentences ("Yields: 4 servings.", "Ingredients: …", …). This is what saves
  //    recipes that arrive without a recognizable Instructions header but still
  //    mix metadata sentences with cooking sentences in one paragraph.
  const single = allLines[0] ?? cookText;
  const sentences = single
    .split(SENTENCE_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length >= 2) {
    const filtered = sentences
      .filter((s) => !isMetadataHeaderLine(s))
      .filter((s) => !isStandaloneNumberMarker(s))
      .map((s) => stripNumberPrefix(stripBullet(s)))
      .filter(Boolean)
      .map((s) => (/[.!?।]$/.test(s) ? s : `${s}.`));
    if (filtered.length >= 1) return filtered;
  }

  return allLines.length ? allLines : [raw];
}

function clampMinutes(n: number): number {
  return Math.min(240, Math.max(1, n));
}

function parseIntSafe(group: string | undefined): number | null {
  if (group == null) return null;
  const n = Number.parseInt(group, 10);
  if (!Number.isFinite(n)) return null;
  return clampMinutes(n);
}

/**
 * Best-effort minutes hint from a step line (English / বাংলা / Bengali digits / Hindi मिनट).
 */
export function extractMinutesFromStep(text: string): number | null {
  const raw = text.trim();
  if (!raw) return null;

  const t = normalizeNumeralsForParse(raw);
  if (!t.trim()) return null;

  const patterns: RegExp[] = [
    // Ranges: use lower bound (first number)
    /(\d+)\s*[-–]\s*\d+\s*(?:min|mins|minute|minutes)\b/i,
    /(\d+)\s*[-–]\s*\d+\s*মিনিট/,
    /(\d+)\s*[-–]\s*\d+\s*মিনিট(?:ের|ের)?/,
    // Standard English
    /(\d+)\s*(?:min|mins|minute|minutes)\b/i,
    // Bengali: no space before মিনিট (common after normalization)
    /(\d+)মিনিট(?:ের|ের)?(?:\s|$|[,:.;])/,
    /(\d+)\s*মিনিট(?:ের|ের)?(?:\s+(?:ধরে|জন্য|পর্যন্ত))?/,
    /(\d+)\s*মিনিটের\s+জন্য/,
    // Hindi
    /(\d+)\s*मिनट(?:ों|्ट)?/,
    // Informal বাংলা "১৫ মি।"
    /(\d+)\s*মি(?:নিট|\.)/,
  ];

  for (const re of patterns) {
    const m = t.match(re);
    const v = parseIntSafe(m?.[1]);
    if (v != null) return v;
  }

  // বাক্যগতভাবে সংখ্যা ও “মিনিট” এর মাঝে অন্য শব্দ থাকলে (যেমন “প্রায় ১৫ মিনিট পর্যন্ত”)
  const relaxed = t.match(/(\d+)\D{0,32}মিনিট/);
  const relaxedVal = parseIntSafe(relaxed?.[1]);
  if (relaxedVal != null) return relaxedVal;

  const relaxedHi = t.match(/(\d+)\D{0,12}मिनट/);
  const relaxedHiVal = parseIntSafe(relaxedHi?.[1]);
  if (relaxedHiVal != null) return relaxedHiVal;

  return null;
}
