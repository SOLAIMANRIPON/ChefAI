# Privacy policy URL (GitHub Pages)

The privacy policy lives at [`docs/privacy.html`](./privacy.html).

Hosting uses **Deploy from a branch** (`main` + `/docs`) only — there is no GitHub Actions workflow for Pages (avoids failed “Deploy docs” emails).

## Enable GitHub Pages (one time)

1. Open https://github.com/SOLAIMANRIPON/ChefAI/settings/pages
2. **Build and deployment** → **Source:** Deploy from a branch
3. **Branch:** `main` → **Folder:** `/docs`
4. **Save**
5. Wait 1–5 minutes.

## URL for Google Play Console

Use this in **App content → Privacy policy**:

```
https://solaimanripon.github.io/ChefAI/privacy.html
```

If your GitHub username or repo name differs, the pattern is:

```
https://<github-username>.github.io/<repo-name>/privacy.html
```

Test the link in an incognito browser before submitting to Play.

## Alternative (backend)

The same HTML is also served at:

```
https://chefai-backend-jgth.onrender.com/privacy
```

Either URL is fine for Play Console if it loads the policy in a browser.
