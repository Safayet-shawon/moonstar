// Turns the supplied logo (green disc, white MPT, white page background) into transparent PNG/WebP assets.
// The disc is fitted from the green pixels; everything inside stays (incl. the white letters), outside becomes transparent.
// Usage: node scripts/make-logo.cjs <source.png>
const sharp = require("sharp");
const fs = require("fs");

(async () => {
  const src = process.argv[2];
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const isGreen = (x, y) => { const i = (y * W + x) * 4; return data[i] < 90 && data[i + 1] > 110 && data[i + 2] < 120; };
  let top = H, bottom = 0, right = 0, left = W;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isGreen(x, y)) { if (y < top) top = y; if (y > bottom) bottom = y; if (x > right) right = x; if (x < left) left = x; }
  const r = (bottom - top + 1) / 2;
  const cy = (top + bottom + 1) / 2;
  const cx = right + 1 - r; // the left edge is hidden under the M, so anchor on the right edge
  console.log({ top, bottom, left, right, r: +r.toFixed(1), cx: +cx.toFixed(1), cy: +cy.toFixed(1) });

  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    const a = Math.max(0, Math.min(1, r - d + 0.5)); // 1px anti-aliased rim
    out[i] = data[i]; out[i + 1] = data[i + 1]; out[i + 2] = data[i + 2]; out[i + 3] = Math.round(a * 255);
    if (a > 0 && a < 1) { out[i] = 1; out[i + 1] = 149; out[i + 2] = 65; } // rim pixels take the brand green
  }
  const x0 = Math.max(0, Math.floor(cx - r)), y0 = Math.max(0, Math.floor(cy - r));
  const size = Math.ceil(r * 2);
  const crop = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).extract({ left: x0, top: y0, width: Math.min(size, W - x0), height: Math.min(size, H - y0) }).png().toBuffer();
  const meta = await sharp(crop).metadata();
  const side = Math.max(meta.width, meta.height);
  const square = await sharp(crop).extend({ top: 0, left: 0, right: side - meta.width, bottom: side - meta.height, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

  fs.mkdirSync("frontend/public/img", { recursive: true });
  fs.mkdirSync("backend/assets", { recursive: true });
  await sharp(square).resize(512, 512).png({ compressionLevel: 9 }).toFile("frontend/public/img/logo.png");
  await sharp(square).resize(192, 192).webp({ quality: 90, alphaQuality: 100 }).toFile("frontend/public/img/logo-192.webp");
  await sharp(square).resize(512, 512).png().toFile("frontend/src/app/icon.png");
  await sharp(square).resize(256, 256).png({ compressionLevel: 9 }).toFile("backend/assets/logo.png");
  const prev = await sharp({ create: { width: 640, height: 320, channels: 3, background: "#ffffff" } })
    .composite([
      { input: await sharp(square).resize(280).png().toBuffer(), left: 20, top: 20 },
      { input: await sharp({ create: { width: 320, height: 320, channels: 3, background: "#072a17" } }).png().toBuffer(), left: 320, top: 0 },
      { input: await sharp(square).resize(280).png().toBuffer(), left: 340, top: 20 },
    ]).png().toBuffer();
  fs.mkdirSync("shots", { recursive: true });
  fs.writeFileSync("shots/logo-preview.png", prev);
  console.log("logo assets written");
})();
