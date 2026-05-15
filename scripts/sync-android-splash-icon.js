/**
 * Android 12+ uses res/drawable-*dpi/splashscreen_logo.png for the launch icon,
 * not assets/images/splash.png. Gradle assembleDebug does not refresh those from Expo.
 *
 * Run after changing assets/images/splash.png (or after `expo prebuild` overwrote them):
 *   npm run sync:splash-android
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const splashSrc = path.join(root, 'assets', 'images', 'splash.png');
const resRoot = path.join(root, 'android', 'app', 'src', 'main', 'res');
const dirs = ['drawable-mdpi', 'drawable-hdpi', 'drawable-xhdpi', 'drawable-xxhdpi', 'drawable-xxxhdpi'];

async function main() {
  if (!fs.existsSync(splashSrc)) {
    throw new Error(`Missing ${splashSrc}`);
  }
  for (const d of dirs) {
    const outPath = path.join(resRoot, d, 'splashscreen_logo.png');
    if (!fs.existsSync(outPath)) {
      // eslint-disable-next-line no-console
      console.warn(`Skip ${d}: ${outPath} not found`);
      continue;
    }
    const { width: w, height: h } = await sharp(outPath).metadata();
    if (!w || !h) throw new Error(`Bad dimensions for ${outPath}`);
    // Android 12+ applies a circular / squircle mask on this bitmap. Content near the
    // square corners is clipped even with `contain` on the full WxH canvas. Fit the
    // artwork inside ~62% of min(w,h) then center on black — keeps "ChefAI" inside the
    // visible mask (Material 3 ~2/3 icon safe zone).
    const safe = Math.max(1, Math.floor(Math.min(w, h) * 0.62));
    const logoBuf = await sharp(splashSrc)
      .resize(safe, safe, {
        fit: 'contain',
        position: 'centre',
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      })
      .png()
      .toBuffer();
    await sharp({
      create: {
        width: w,
        height: h,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .composite([{ input: logoBuf, gravity: 'centre' }])
      .png()
      .toFile(outPath);
    // eslint-disable-next-line no-console
    console.log(`Wrote ${outPath} (${w}×${h}, safe=${safe}px)`);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
