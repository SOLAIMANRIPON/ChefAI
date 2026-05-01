# ChefAI Monetization Backend Blueprint

This document defines a production-ready baseline for freemium credits, subscriptions, and purchase verification.

## 1) Recommended rollout order

1. Daily free limit + credit ledger
2. One-time credit packs via Google Play Billing
3. Monthly subscription plans
4. Rewarded ads for extra credits

## 2) Data model (SQL-style)

### `users`
- `id` (uuid, pk)
- `email` (text, unique, nullable)
- `display_name` (text, nullable)
- `country_code` (text, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### `wallets`
- `user_id` (uuid, pk, fk -> users.id)
- `balance_credits` (int, default 0)
- `lifetime_credits_added` (int, default 0)
- `lifetime_credits_used` (int, default 0)
- `updated_at` (timestamp)

### `daily_usage`
- `id` (uuid, pk)
- `user_id` (uuid, fk -> users.id)
- `usage_date` (date)
- `free_used` (int, default 0)
- unique index: (`user_id`, `usage_date`)

### `credit_transactions`
- `id` (uuid, pk)
- `user_id` (uuid, fk -> users.id)
- `type` (enum: `grant_free`, `purchase`, `consume`, `refund`, `rewarded_ad`)
- `amount` (int) // positive for add, negative for consume
- `source_ref` (text, nullable) // order id / request id / ad event id
- `metadata_json` (jsonb, nullable)
- `created_at` (timestamp)

### `subscriptions`
- `id` (uuid, pk)
- `user_id` (uuid, fk -> users.id)
- `platform` (enum: `google_play`)
- `product_id` (text)
- `purchase_token` (text, unique)
- `status` (enum: `active`, `grace`, `expired`, `revoked`)
- `current_period_start` (timestamp, nullable)
- `current_period_end` (timestamp, nullable)
- `auto_renewing` (boolean, default true)
- `last_verified_at` (timestamp, nullable)

### `ai_requests`
- `id` (uuid, pk)
- `user_id` (uuid, fk -> users.id)
- `request_type` (text) // e.g. `recipe_list`, `recipe_detail`
- `model_name` (text)
- `prompt_tokens` (int, nullable)
- `response_tokens` (int, nullable)
- `estimated_cost_usd` (numeric(10,6), nullable)
- `credits_charged` (int, not null)
- `status` (enum: `success`, `failed`, `timeout`)
- `created_at` (timestamp)

## 3) API contract (v1)

Base path: `/api/v1`

### Auth
- Use Firebase Auth ID token or JWT in `Authorization: Bearer <token>`.

### Wallet and limits
- `GET /wallet`
  - returns: `{ balanceCredits, freeUsedToday, freeLimitPerDay, subscriptionStatus }`

- `POST /usage/check`
  - body: `{ action: "recipe_list" }`
  - returns: `{ allowed, chargeType: "free" | "credit" | "blocked", creditsRequired }`

### AI proxy
- `POST /ai/recipes/list`
  - body: `{ ingredient, cuisine, language }`
  - server steps:
    1) validate user quota
    2) reserve credits (or free slot)
    3) call Gemini
    4) finalize ledger
  - returns: `{ recipes: string[], remainingCredits, freeRemainingToday }`

### Billing
- `POST /billing/google/purchase/verify`
  - body: `{ productId, purchaseToken, orderId, packageName }`
  - verify with Google Play Developer API
  - on success: add credits or activate subscription
  - returns: `{ success, walletBalance, subscriptionStatus }`

- `GET /billing/products`
  - returns one-time packs and subscription SKUs for the client paywall

### Rewarded ads
- `POST /ads/reward/claim`
  - body: `{ adNetwork: "admob", rewardEventId }`
  - must be idempotent
  - returns: `{ success, balanceCredits }`

## 4) Business rules

- Free limit: 5 requests/day/user
- Default charge:
  - `recipe_list`: 1 credit
  - `recipe_detail`: 2 credits
- Subscription users still use fair-use quota cap to avoid abuse.
- Always keep all balance changes in `credit_transactions` (never silent updates).

## 5) Security checklist

- Never keep Gemini key in app client.
- Only backend talks to Gemini API.
- Verify every purchase token server-side.
- All billing endpoints idempotent by unique keys.
- Add per-user + per-IP rate limit.

## 6) Suggested initial products

- `credits_50` -> $0.99
- `credits_350` -> $4.99
- `pro_monthly` -> $3.99 to $5.99

## 7) Frontend migration steps

1. Replace direct Gemini call with `POST /api/v1/ai/recipes/list`.
2. Load wallet state on app start using `GET /wallet`.
3. Show paywall when `allowed === false` in `/usage/check`.
4. On purchase success, call `/billing/google/purchase/verify`.
5. Refresh wallet and limits after each paid event.
