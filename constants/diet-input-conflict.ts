import type { DietPreference } from './recipe-preferences';

export type DietConflictReason =
  | 'vegetarian_flesh'
  | 'vegan_flesh'
  | 'vegan_animal_product'
  | 'gluten_grain';

export type DietConflictResult = { ok: true } | { ok: false; reason: DietConflictReason };

/** Latin slice for whole-word matching */
const EN_MEAT_FISH =
  /\b(chicken|beef|pork|mutton|lamb|veal|fish|salmon|tuna|sardine|anchovy|meat|steak|ribs|bacon|ham|sausage|pepperoni|salami|turkey|duck|goose|quail|shrimp|prawn|crab|lobster|crayfish|mussel|clam|oyster|squid|octopus|eel|catfish|cod|haddock|hilsa|hilsha|pabda|rohu|katla|keema|kebab|bone.?broth|fish\s*sauce)\b/i;

const EN_DAIRY_EGG_HONEY =
  /\b(milk|cream|cheese|paneer|ricotta|mozzarella|cheddar|butter|ghee|yoghurt|yogurt|mayonnaise|honey|whey|lactose|dairy|eggs?)\b/i;

const EN_GLUTEN =
  /\b(wheat|barley|rye|gluten|semolina|couscous|bulgur|farina|spelt|triticale|malt|flour|bread|pasta|noodle|ramen|udon|couscous|cracker|croissant|bagel|pizza\s*dough|cake|brownie|cookie|biscuit|pie\s*crust|soy\s*sauce|atta|maida|roti|naan|paratha|phyllo|panko|breadcrumbs)\b/i;

/** Bengali / common substrings (substring match) */
const BN_MEAT_FISH = [
  'মাছ',
  'মাংস',
  'চিকেন',
  'গরুর',
  'খাসি',
  'মুরগি',
  'ইলিশ',
  'রুই',
  'পাবদা',
  'মাগুর',
  'ট্যাংরা',
  'ট্যাঙরা',
  'কই',
  'চিংড়ি',
  'চিংড়ি',
  'লবস্টার',
  'কাঁকড়া',
  'শুটকি',
  'কাবাব',
  'কিমা',
];

const BN_DAIRY_ETC = ['দুধ', 'পনির', 'ছানা', 'দই', 'ঘি', 'মধু', 'ডিম'];

const BN_GLUTEN = [
  'আটা',
  'ময়দা',
  'ময়দা',
  'সুজি',
  'গম',
  'রুটি',
  'নুডল',
  'পাস্তা',
  'বিস্কুট',
  'কেক',
  'গ্লুটেন',
  'বার্লি',
];

function hasSubstringAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => n.length > 0 && haystack.includes(n));
}

function hasMeatFish(latin: string, original: string): boolean {
  if (EN_MEAT_FISH.test(latin)) return true;
  return hasSubstringAny(original, BN_MEAT_FISH);
}

function hasAnimalProductNonFlesh(latinForEgg: string, original: string): boolean {
  if (EN_DAIRY_EGG_HONEY.test(latinForEgg)) return true;
  return hasSubstringAny(original, BN_DAIRY_ETC);
}

function hasGluten(latin: string, original: string): boolean {
  if (EN_GLUTEN.test(latin)) return true;
  return hasSubstringAny(original, BN_GLUTEN);
}

/**
 * Heuristic: keyword/substring scan. False positives/negatives possible.
 */
export function analyzeDietInputConflict(diet: DietPreference, rawInput: string): DietConflictResult {
  if (diet === 'none') return { ok: true };
  const q = rawInput.trim();
  if (!q) return { ok: true };

  const latin = q.toLowerCase();
  const latinNoEggplant = latin.replace(/\beggplants?\b/gi, ' ');

  if (diet === 'gluten_free') {
    if (hasGluten(latin, q)) return { ok: false, reason: 'gluten_grain' };
    return { ok: true };
  }

  if (diet === 'vegetarian') {
    if (hasMeatFish(latin, q)) return { ok: false, reason: 'vegetarian_flesh' };
    return { ok: true };
  }

  if (diet === 'vegan') {
    if (hasMeatFish(latin, q)) return { ok: false, reason: 'vegan_flesh' };
    if (hasAnimalProductNonFlesh(latinNoEggplant, q)) return { ok: false, reason: 'vegan_animal_product' };
    return { ok: true };
  }

  return { ok: true };
}
