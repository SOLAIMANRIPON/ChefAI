# ChefAI

ChefAI is an Expo app with a Node.js backend (`server/index.js`) for recipe generation.

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set real values:

```env
EXPO_PUBLIC_API_BASE_URL=http://<your-lan-ip>:3000
PORT=3000
GEMINI_API_KEY=your_real_backend_key
GEMINI_TEXT_MODEL=gemini-3.1-flash-lite-preview
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
```

3. Start backend:

```bash
npm run start:backend
```

4. Start Expo app:

```bash
npx expo start
```

## Keep API key private

- Put `GEMINI_API_KEY` only in backend environment variables.
- Never store real keys in `.env.example`.
- `.env` is ignored by git, so keep secrets there locally.
- In the mobile app, use only `EXPO_PUBLIC_API_BASE_URL` (this is not a secret).

## Deploy backend publicly (Render, no domain required)

You can use Render's free URL (for example `https://your-service.onrender.com`) so the app works from any network.

1. Push this repo to GitHub.
2. On Render, create a new Web Service from your repo.
3. Render can auto-read `render.yaml` from this project.
4. In Render dashboard, set secret env var:
   - `GEMINI_API_KEY=<your real key>`
5. Deploy and copy your public backend URL.
6. Set app env locally:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-service.onrender.com
```

7. Restart Expo (`npx expo start`) to load the new API URL.

## Build APK with public backend

1. Install and login:

```bash
npm i -g eas-cli
eas login
```

2. Configure EAS once:

```bash
eas build:configure
```

3. Build Android APK (internal testing):

```bash
eas build -p android --profile preview
```

Before build, make sure `EXPO_PUBLIC_API_BASE_URL` points to your public HTTPS backend.
