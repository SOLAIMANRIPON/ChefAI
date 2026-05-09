# ChefAI v1.0 — Architectural Decisions

এই ৫টা সিদ্ধান্ত v1.0 development শুরু করার আগে নিতে হবে। প্রতিটার নিচে অপশন
দেওয়া আছে — পড়ুন, ভাবুন, পছন্দটার পাশে ✅ বসান।

পুরো কাজ শেষে শেষের "Final Choices" section-এ পাঁচটা decision summary করে
আমাকে ফেরত দিন। আমি সেই অনুযায়ী v1.0 সম্পূর্ণ implementation শুরু করব।

---

## 🎯 Goal recap

**Full-featured v1.0** = Community + Auth + Sync + Offline + Crash reporting +
Polish + Tests + App Store submission ready। আনুমানিক ৪ সপ্তাহের কাজ।

---

## Question 1: Authentication Provider

User login/signup-এর জন্য কোন service ব্যবহার করব?

| Option | Free tier | Setup time | Pros | Cons | Choice |
|--------|-----------|------------|------|------|--------|
| **A. Firebase Auth** | 10k MAU free | 1 দিন | সবচেয়ে established, Google login সহজ, phone OTP, password reset built-in | Google ecosystem-এ lock-in | ☐ |
| **B. Supabase Auth** | 50k MAU free | 1 দিন | Open source, একই platform-এ DB+Storage একসাথে, Postgres backend | কম mature than Firebase | ☐ |
| **C. Clerk** | 10k MAU free | ৪ ঘন্টা | সবচেয়ে polished pre-built UI, magic link সহজ | একটু expensive scale-এ ($25/mo+) | ☐ |
| **D. Skip auth এই version-এ** | N/A | 0 দিন | দ্রুত launch, simple | Multi-device sync নেই, user accounts নেই, Community feature limited | ☐ |

**আমার সুপারিশ:** যদি Question 2-এ Supabase choose করেন, তাহলে Auth-ও Supabase
(এক platform = কম সমস্যা)। অন্যথায় Firebase সবচেয়ে safe।

---

## Question 2: Database

Recipes, posts, users, comments, likes — কোথায় store করব?

| Option | Free tier | Pros | Cons | Choice |
|--------|-----------|------|------|--------|
| **A. Supabase Postgres** | 500MB DB + 2GB bandwidth | Real Postgres (SQL), Auth+Storage একই platform, dashboard ভালো | Free tier-এ 7-day inactivity-এ sleep | ☐ |
| **B. Firebase Firestore** | 1GB storage + 10GB/mo bandwidth | Real-time updates সহজ, scaling automatic | NoSQL — complex query কঠিন, vendor lock-in | ☐ |
| **C. Render Postgres** | $7/mo (no free) | Backend-এর সাথে same platform, full Postgres control | Paid from day 1 | ☐ |
| **D. MongoDB Atlas** | 512MB free | Flexible JSON, JS developer-friendly | Schema discipline নিজে রাখতে হয় | ☐ |

**আমার সুপারিশ:** **Supabase** — Auth + DB + Storage তিনটাই একসাথে, free tier
generous, Postgres-এর reliability।

---

## Question 3: Image Storage

User-uploaded images (Community posts, avatars) কোথায় host করব?

| Option | Free tier | Pros | Cons | Choice |
|--------|-----------|------|------|--------|
| **A. Supabase Storage** | 1GB free | Auth/DB Supabase হলে natural fit | DB choice-এর সাথে coupled | ☐ |
| **B. Firebase Storage** | 5GB free | Auth Firebase হলে seamless | Auth/DB Firebase হলেই ভালো | ☐ |
| **C. Cloudinary** | 25GB storage + transformation | Image resize/crop/optimize automatic, CDN built-in | আলাদা service manage করতে হবে | ☐ |
| **D. User upload skip** | N/A | কোনো setup লাগবে না | Community-তে শুধু AI-generated image, real photo নেই | ☐ |

**আমার সুপারিশ:** Auth/DB যেটা choose করবেন সেটার সাথে matching। Cloudinary সব
চেয়ে generous free tier কিন্তু আলাদা account লাগে।

---

## Question 4: Error Reporting / Crash Monitoring

Production-এ user-এর crash track করতে?

| Option | Free tier | Pros | Cons | Choice |
|--------|-----------|------|------|--------|
| **A. Sentry** | 5k events/mo | Industry standard, source maps, breadcrumbs | Free tier-এ retention 30 days | ☐ |
| **B. Bugsnag** | 7.5k events/mo | Sentry-এর alternative, similar features | কম React Native examples online | ☐ |
| **C. Expo + Sentry plugin** | একই 5k events/mo | Expo-র সাথে best integration, sourcemap auto | Sentry-র সাথে সমান | ☐ |
| **D. Skip — production-এ blind উড়াব** | N/A | কোনো setup লাগবে না | User crash করলেও জানবেন না (NOT recommended) | ☐ |

**আমার সুপারিশ:** **Expo + Sentry plugin** — সবচেয়ে কম friction।

---

## Question 5: Scope Cuts (যদি ৪ সপ্তাহে fit না করে)

সবকিছু perfectly করতে গেলে scope creep হতে পারে। আগেই ঠিক রাখুন কোনটা cut
করতে রাজি।

| Option | Impact | Time saved | Choice |
|--------|--------|-----------|--------|
| **A. Community feature shorten** — শুধু read (seed posts), upload না | Tab আছে কিন্তু simple | 5-7 দিন | ☐ |
| **B. Auth optional** — guest mode-এ সব feature, sync শুধু logged-in user-এর | UX flexible | 2-3 দিন | ☐ |
| **C. Automated tests cut** — manual QA-তে rely করব | Tech debt বাড়ে | 3-4 দিন | ☐ |
| **D. কিছুই cut করব না** — সম্পূর্ণ feature complete v1.0 | সবচেয়ে polished | 0 দিন cut | ☐ |
| **E. App Store submission পরবর্তী version-এ** — শুধু code complete করব | Store work পরে | 5 দিন | ☐ |

**আমার সুপারিশ:** **B (Auth optional)** — best of both worlds। Casual user
guest mode-এ ব্যবহার করতে পারবে, serious user login করে sync পাবে।

---

## Question 6 (Bonus): App Store Account ready?

Build তো করতে পারব, কিন্তু submit করতে এগুলো লাগবে।

| Item | Cost | Status |
|------|------|--------|
| Apple Developer Program | $99/year | ☐ Have it / ☐ Will buy / ☐ Skip iOS |
| Google Play Console | $25 one-time | ☐ Have it / ☐ Will buy / ☐ Skip Android |
| Domain for privacy policy URL | $10/year (optional, GitHub Pages free) | ☐ Have / ☐ Will use GitHub Pages |

---

## 🎬 Final Choices (এখানে আপনার সিদ্ধান্তগুলো লিখুন)

Decision summary — আমাকে এটাই ফেরত দিলে কাজ শুরু করতে পারব।

```
Q1 (Auth):           [ A / B / C / D ]
Q2 (Database):       [ A / B / C / D ]
Q3 (Image storage):  [ A / B / C / D ]
Q4 (Error reporting):[ A / B / C / D ]
Q5 (Scope cuts):     [ A / B / C / D / E ] (একাধিক select করতে পারেন)
Q6 (Store account):  iOS [ Have / Buy / Skip ]  Android [ Have / Buy / Skip ]

Notes / questions:
-
-
```

---

## আমার Best Default Recommendation (যদি দ্রুত decide করতে চান)

```
Q1: B (Supabase Auth)
Q2: B (Supabase Postgres)        ← একই platform = সহজ
Q3: A (Supabase Storage)         ← একই platform = সহজ
Q4: C (Expo + Sentry plugin)
Q5: B (Auth optional — guest mode)
Q6: যা possible সেটা
```

কারণ: Supabase-এ ৩টা একসাথে → কম complexity, কম config, এক dashboard।
Sentry-এর Expo plugin সবচেয়ে কম setup। Guest mode user-friendly।

কিন্তু এটা শুধু সাজেশন — আপনার আলাদা preference থাকলে সেটাই বেছে নিন।

---

## পরে যা হবে

আপনি Final Choices fill করে আমাকে দিলে:

1. আমি একটা detailed ৪-sprint implementation plan বানাব (TODOs সহ)
2. Sprint-by-sprint কাজ শুরু করব
3. প্রতি sprint শেষে demo-able milestone থাকবে
4. শেষে App Store submission-এর জন্য prep

ধীরে-সুস্থে ভাবুন। তাড়া নেই।
