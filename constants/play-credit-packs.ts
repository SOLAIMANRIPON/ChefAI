/**
 * Google Play consumable credit packs (must match Play Console product IDs and server
 * `CHEFAI_PLAY_PRODUCT_CREDITS_JSON`).
 *
 * Suggested USD list prices target ~2× margin vs estimated API cost (70% text / 30% photo mix).
 * Set the same prices in Play Console → Monetize → Products.
 */
export const DEFAULT_PLAY_PRODUCT_CREDITS: Record<string, number> = {
  chefai_credits_small: 30,
  chefai_credits_pack: 80,
  chefai_credits_large: 200,
};

export type PlayCreditPack = {
  productId: string;
  credits: number;
  /** Short label in purchase picker */
  title: string;
  /** Suggested Play list price (USD) — configure in Play Console */
  suggestedUsd: number;
};

const PACK_META: Omit<PlayCreditPack, 'productId' | 'credits'>[] = [
  { title: 'Small', suggestedUsd: 2.99 },
  { title: 'Medium', suggestedUsd: 7.99 },
  { title: 'Large', suggestedUsd: 16.99 },
];

const PACK_ORDER = ['chefai_credits_small', 'chefai_credits_pack', 'chefai_credits_large'] as const;

function parseCreditsMapFromEnv(raw: string | undefined): Record<string, number> | null {
  if (!raw?.trim()) return null;
  try {
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== 'object') return null;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj)) {
      const id = String(k).trim();
      const n = typeof v === 'number' ? v : Number(v);
      if (id && Number.isFinite(n) && n > 0) out[id] = Math.floor(n);
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

/** Credits granted per SKU (client; server uses CHEFAI_PLAY_PRODUCT_CREDITS_JSON). */
export function getPlayProductCreditsMap(): Record<string, number> {
  return (
    parseCreditsMapFromEnv(process.env.EXPO_PUBLIC_PLAY_PRODUCT_CREDITS_JSON) ?? { ...DEFAULT_PLAY_PRODUCT_CREDITS }
  );
}

export function getPlayCreditPacks(): PlayCreditPack[] {
  const map = getPlayProductCreditsMap();
  const orderedIds = [
    ...PACK_ORDER.filter((id) => id in map),
    ...Object.keys(map).filter((id) => !PACK_ORDER.includes(id as (typeof PACK_ORDER)[number])),
  ];
  return orderedIds.map((productId, i) => {
    const credits = map[productId]!;
    const meta = PACK_META[i] ?? { title: productId, suggestedUsd: 0 };
    return { productId, credits, title: meta.title, suggestedUsd: meta.suggestedUsd };
  });
}

export function getPlayCreditPackSkus(): string[] {
  return getPlayCreditPacks().map((p) => p.productId);
}

/** ~USD per credit at medium-pack price (for UI hints). */
export function estimatedUsdPerCredit(): number {
  const packs = getPlayCreditPacks();
  const medium = packs.find((p) => p.productId === 'chefai_credits_pack') ?? packs[0];
  if (!medium?.credits) return 0.1;
  return Math.round((medium.suggestedUsd / medium.credits) * 100) / 100;
}
