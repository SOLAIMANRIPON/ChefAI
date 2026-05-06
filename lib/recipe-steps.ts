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

export function parseRecipeSteps(recipeText: string): string[] {
  const raw = recipeText.trim();
  if (!raw) return [];

  const sourceLines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const fromBullets = sourceLines
    .filter((l) => /^[•\-\*]\s/.test(l))
    .map((l) => stripBullet(l))
    .filter(Boolean);
  if (fromBullets.length >= 2) return fromBullets;

  const numbered: string[] = [];
  for (const line of sourceLines) {
    const asciiLine = normalizeNumeralsForParse(line);
    const m = asciiLine.match(/^(\d+)[\.)]\s+(.+)$/);
    if (m?.[2]) numbered.push(m[2].trim());
  }
  if (numbered.length >= 2) return numbered;

  const plain = sourceLines.map((l) => stripNumberPrefix(stripBullet(l))).filter(Boolean);
  if (plain.length >= 2) return plain;

  const single = sourceLines.join(' ');
  if (single.length > 240) {
    const rough = single
      .split(/\.\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 12);
    if (rough.length >= 3) return rough.map((s) => (s.endsWith('.') ? s : `${s}.`));
  }

  return plain.length ? plain : [raw];
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
