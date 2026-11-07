'use strict';
/**
 * Xuất PNG từ các file SVG trong web/icons (cần devDependency puppeteer).
 *   npm install && npm run icons
 */
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');

const dir = path.join(__dirname, '..', 'web', 'icons');
const jobs = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon.svg', 'icon-1024.png', 1024],
  ['maskable.svg', 'maskable-512.png', 512],
  ['apple-touch.svg', 'apple-touch-icon.png', 180],
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox'],
    headless: 'new',
  });
  const page = await browser.newPage();
  for (const [src, out, size] of jobs) {
    const svg = fs.readFileSync(path.join(dir, src), 'utf8');
    await page.setViewport({ width: size, height: size });
    await page.setContent(`<body style="margin:0;background:transparent">${svg.replace(/width="1024" height="1024"/, `width="${size}" height="${size}"`)}</body>`);
    await page.screenshot({ path: path.join(dir, out), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    console.log('đã tạo', out);
  }
  await browser.close();
})();
