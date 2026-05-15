/**
 * Bottom padding for scroll areas on tab-root screens so content clears the native tab bar.
 * (Screens outside tabs still use `HOME_EXPLORE_NAV_RESERVED_BOTTOM` where the custom strip exists.)
 */
export function tabScreenScrollPaddingBottom(insetsBottom: number): number {
  return 20 + Math.max(insetsBottom, 10) + 76;
}
