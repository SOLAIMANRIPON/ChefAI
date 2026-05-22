/**
 * Places splash artwork so the "ChefAI" wordmark is vertically centered
 * (chef-hat icon sits above center — not included in vertical center math).
 *
 * Run: npm run center:splash
 */
const path = require('path');
const sharp = require('sharp');

const splashSrc = path.join(__dirname, '..', 'assets', 'images', 'splash.png');

/** Row pixel counts for non-black content. */
async function rowOccupancy(buf, width, height) {
  const { data } = await sharp(buf).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const rows = [];
  for (let y = 0; y < height; y++) {
    let count = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (a > 20 && r + g + b > 40) count++;
    }
    rows.push(count);
  }
  return rows;
}

/**
 * Split hat (top) from "ChefAI" text using the lowest-density row in the upper 70%.
 */
function findTextBand(rows, height) {
  const max = Math.max(...rows, 1);
  const thresh = max * 0.08;

  let contentTop = 0;
  let contentBottom = height - 1;
  for (let y = 0; y < height; y++) {
    if (rows[y] > thresh) {
      contentTop = y;
      break;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    if (rows[y] > thresh) {
      contentBottom = y;
      break;
    }
  }

  const scanStart = contentTop + Math.floor((contentBottom - contentTop) * 0.15);
  const scanEnd = contentTop + Math.floor((contentBottom - contentTop) * 0.72);
  let gapY = scanStart;
  let minVal = max;
  for (let y = scanStart; y <= scanEnd; y++) {
    if (rows[y] < minVal) {
      minVal = rows[y];
      gapY = y;
    }
  }

  const textTop = Math.min(gapY + 6, contentBottom);
  const textBottom = contentBottom;
  const textCenterY = (textTop + textBottom) / 2;

  return { contentTop, textTop, textBottom, textCenterY };
}

async function main() {
  const meta = await sharp(splashSrc).metadata();
  const canvasW = meta.width;
  const canvasH = meta.height;
  if (!canvasW || !canvasH) throw new Error('Invalid splash dimensions');

  const trimmedBuf = await sharp(splashSrc).trim({ threshold: 15 }).toBuffer();
  const logo = await sharp(trimmedBuf).metadata();
  const logoW = logo.width;
  const logoH = logo.height;
  if (!logoW || !logoH) throw new Error('Could not detect logo bounds');

  const rows = await rowOccupancy(trimmedBuf, logoW, logoH);
  const { textCenterY } = findTextBand(rows, logoH);

  const canvasCenterY = canvasH / 2;
  const top = Math.round(canvasCenterY - textCenterY);
  const left = Math.round((canvasW - logoW) / 2);

  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([{ input: trimmedBuf, left, top }])
    .png()
    .toFile(splashSrc);

  // eslint-disable-next-line no-console
  console.log(
    `Placed logo (${logoW}×${logoH}) with "ChefAI" text center at screen middle (top=${top}, left=${left}) → ${splashSrc}`
  );
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
