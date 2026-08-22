// Rasterizes the app mark into the PNG sizes iOS and Android actually
// honour, using the Chromium that @playwright/test already vendors - no
// new dependency, and the PNGs are committed so a normal build never
// needs this script.
//
// Why PNGs exist at all when the design rule says "PWA icon is
// favicon.svg":
//   - iOS ignores an SVG apple-touch-icon outright. With no usable one
//     declared, Safari falls back to /apple-touch-icon.png at the ORIGIN
//     root - which on a github.io account is a different project's icon.
//   - Chrome's installability criteria name a 192px and a 512px icon.
//     An SVG entry with sizes="any" may or may not satisfy that on a
//     given Chrome version; shipping the two rasters removes the
//     question. This half is unverified here - Chromium's
//     Page.getInstallabilityErrors reports clean even for a manifest
//     with no icons at all, so it cannot confirm or deny it headless.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// Design tokens, duplicated here only because this runs outside the app
// bundle and cannot import src/theme (Charcoal canvas, Off-White text).
const CANVAS = '#131313';
const TEXT = '#F5F5F5';

// The 8-ball mark: an Off-White disc with a Charcoal spot carrying the
// numeral, on a full-bleed Charcoal field. No maskable inset knob exists
// because none is needed - Android crops a maskable icon to a circle of
// ~80% of the canvas (radius 205 of 512) and the disc stops at 150, so
// the mark already sits inside the safe zone at every size.
function markSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${CANVAS}"/>
  <circle cx="256" cy="256" r="150" fill="${TEXT}"/>
  <circle cx="256" cy="256" r="70" fill="${CANVAS}"/>
  <text x="256" y="256" font-family="Inter, sans-serif" font-size="90" font-weight="600"
        fill="${TEXT}" text-anchor="middle" dominant-baseline="central">8</text>
</svg>`;
}

const targets = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  // Same art as icon-512: the mark is already inside the maskable safe
  // zone, so this differs only in the manifest `purpose` pointing at it.
  { file: 'icon-maskable-512.png', size: 512 },
];

const browser = await chromium.launch();
try {
  for (const target of targets) {
    const page = await browser.newPage({
      viewport: { width: target.size, height: target.size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<style>html,body{margin:0;padding:0;background:${CANVAS}}svg{display:block;width:${target.size}px;height:${target.size}px}</style>${markSvg()}`,
    );
    const png = await page.screenshot();
    writeFileSync(join(publicDir, target.file), png);
    console.log(`wrote ${target.file} (${target.size}x${target.size}, ${png.length} bytes)`);
    await page.close();
  }

  // The browser favicon is written from the same mark so the two never
  // drift; it keeps the square field the app already ships.
  writeFileSync(join(publicDir, 'favicon.svg'), `${markSvg()}\n`);
  console.log('wrote favicon.svg');
} finally {
  await browser.close();
}
