// Render the SVG logo set to transparent PNGs (and favicons) with headless Chromium.
// Usage: node scripts/render-logo-png.mjs   (requires `playwright` to be installed)
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brand = path.join(root, "public", "brand");

const jobs = [
  ["logo.svg", "logo.png", 1600],
  ["logo.svg", "logo@4x.png", 3200],
  ["logo-white.svg", "logo-white.png", 1600],
  ["logo-mark.svg", "logo-mark-512.png", 512],
  ["logo-mark.svg", "logo-mark-192.png", 192],
  ["logo-mark.svg", path.join("..", "apple-touch-icon.png"), 180],
  ["logo-mark.svg", path.join("..", "favicon-32.png"), 32],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, out, width] of jobs) {
  const svg = readFileSync(path.join(brand, src), "utf8");
  const [, vw, vh] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
  const height = Math.round((width * vh) / vw);
  await page.setViewportSize({ width, height });
  const sized = svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${width}" height="${height}"`);
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${sized}</body></html>`
  );
  await page.screenshot({ path: path.join(brand, out), omitBackground: true, clip: { x: 0, y: 0, width, height } });
  console.log(`rendered ${out} (${width}x${height})`);
}
await browser.close();
