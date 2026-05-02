import { looksLikeCookingStep } from '@/constants/shopping-list-fallback';

export type ShoppingItemLike = { id: string; label: string; checked: boolean };

const NUM_PAT = '[০-৯\\d]+(?:[.,][০-৯\\d]+)?';
const BN_UNIT_PAT =
  '(কাপ|টেবিল\\s*চামচ|চা\\s*চামচ|খাবার\\s*চামচ|চামচ|গ্রাম|কেজি|লিটার|মিলিলিটার|মিলি|টি|টুকরা|পিস|ছোট\\s*চামচ|লবণ\\s*চামচ)';
const VERB_ONLY_RE = /^(দিন|নিন|করুন|ভাজুন|কষান|কষিয়ে|রান্না করুন)$/i;
const NON_BUYABLE_RE =
  /^(পানি|জল|গরম পানি|উষ্ণ পানি|ফুটন্ত পানি|সাধারণ পানি|কলের পানি|গরম জল|উষ্ণ জল|ফুটন্ত জল)$/i;
const TRAILING_VERB_RE = /\s+(দিন|নিন|করুন|ভাজুন|কষান|কষিয়ে|রান্না করুন)\s*$/i;
const COOKING_CLAUSE_SPLIT_RE =
  /\s+(মিশিয়ে|মিশিয়ে|তৈরি|গরম করে|গরম\s+করে|ছড়িয়ে|ছড়িয়ে|নামিয়ে|নামিয়ে|দিয়ে|দিয়ে|ভেজে|কষিয়ে|কষিয়ে|রান্না করে|রান্না\s+করুন)\b/i;

/** Strip amounts/units; keep one ingredient name per line (BN + common EN). */
export function ingredientNameOnly(raw: string): string {
  let s = raw
    .trim()
    .replace(/^[০-৯\d]+[\).\:\-\s।]+\s*/, '')
    .replace(/^[\u2022•\-\*○◎]\s*/, '')
    .replace(/^উপকরণ\s*:\s*/i, '')
    .replace(/\s*[\(\（][^\)\）]*$/, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/（[^）]*）/g, '');

  s = s
    .replace(/^উপর থেকে\s*/i, '')
    .replace(/^ওপর থেকে\s*/i, '')
    .replace(/^কড়াইতে\s*/i, '')
    .replace(/^কড়াইতে\s*/i, '')
    .replace(/^প্যানে\s*/i, '')
    .replace(/^চুলায়\s*/i, '')
    .replace(/^চুলায়\s*/i, '');

  const tailBnNumUnit = new RegExp(`\\s+${NUM_PAT}\\s*${BN_UNIT_PAT}\\s*$`, 'i');
  const tailBnWordQty = new RegExp(
    `\\s+(এক|দুই|তিন|চার|পাঁচ|ছয়|ছয়|সাত|আট|নয়|নয়|দশ|আধা)\\s*(কাপ|টেবিল\\s*চামচ|চা\\s*চামচ|খাবার\\s*চামচ|চামচ|টি|টুকরা|গ্রাম|কেজি|লিটার)\\s*$`,
    'i'
  );
  const tailEn = /\s+\d+(?:\.\d+)?\s*(kg|g|ml|l|tbsp|tsp|cups?)\s*$/i;

  let prev = '';
  while (s !== prev) {
    prev = s;
    s = s.replace(tailBnNumUnit, '').replace(tailBnWordQty, '').replace(tailEn, '').trim();
    s = s.replace(new RegExp(`\\s+${NUM_PAT}\\s*$`), '').trim();
  }

  s = s.split(COOKING_CLAUSE_SPLIT_RE)[0]?.trim() ?? s;
  s = s.replace(TRAILING_VERB_RE, '').trim();
  s = s.replace(/\s+(ও|এবং)\s*$/i, '').trim();
  s = s.replace(/^[,:;।\-\s]+|[,:;।\-\s]+$/g, '').trim();

  if (/আস্ত\s*গরম\s*মসলা/i.test(s) && /এলাচ/i.test(raw)) {
    s = 'এলাচ';
  }

  return s.replace(/\s+/g, ' ').trim();
}

/** Dedupe ingredient lines for shopping (names only, no cooking steps). */
export function normalizeShoppingIngredientLabels(rawLabels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of rawLabels) {
    const name = ingredientNameOnly(raw);
    if (name.length < 2) continue;
    if (VERB_ONLY_RE.test(name)) continue;
    if (NON_BUYABLE_RE.test(name)) continue;
    if (looksLikeCookingStep(name)) continue;
    const k = name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(name);
  }
  return out;
}

/** Merge rows that become the same ingredient after stripping quantities (preserve checked). */
export function mergeShoppingItemsToIngredientNames(items: ShoppingItemLike[]): ShoppingItemLike[] {
  const map = new Map<string, ShoppingItemLike>();
  for (const it of items) {
    const name = ingredientNameOnly(it.label);
    if (
      name.length < 2 ||
      VERB_ONLY_RE.test(name) ||
      NON_BUYABLE_RE.test(name) ||
      looksLikeCookingStep(name)
    )
      continue;
    const k = name.toLowerCase();
    const prev = map.get(k);
    if (!prev) {
      map.set(k, { ...it, label: name });
    } else {
      map.set(k, {
        ...prev,
        label: name,
        checked: prev.checked || it.checked,
      });
    }
  }
  return [...map.values()];
}
