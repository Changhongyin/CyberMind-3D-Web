// Renders report.html to a 16:9 PDF with headless Edge and (optionally) a PNG of every page for visual inspection.
//   node build_pdf.mjs <report.html> <out.pdf> [pngDir]
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const [src, out, pngDir] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new' });
const page = await browser.newPage();
await page.goto(pathToFileURL(src).href, { waitUntil: 'networkidle0' });
const broken = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')));
if (broken.length) console.log('BROKEN IMAGES:', broken);
const over = await page.evaluate(() => [...document.querySelectorAll('section')].map((s, i) => [i + 1, s.scrollHeight - s.clientHeight, s.scrollWidth - s.clientWidth]).filter((x) => x[1] > 1 || x[2] > 1));
if (over.length) console.log('OVERFLOWING PAGES [page, px high, px wide]:', JSON.stringify(over));
await page.pdf({ path: out, width: '297mm', height: '167.0625mm', printBackground: true, preferCSSPageSize: true });
const n = await page.evaluate(() => document.querySelectorAll('section').length);
if (pngDir) {
  fs.mkdirSync(pngDir, { recursive: true });
  await page.setViewport({ width: 1123, height: 632, deviceScaleFactor: 1.6 });
  const secs = await page.$$('section');
  for (let i = 0; i < secs.length; i++) await secs[i].screenshot({ path: `${pngDir}/p${String(i + 1).padStart(2, '0')}.png` });
}
await browser.close();
console.log('pdf written', out, 'pages', n, 'bytes', fs.statSync(out).size, broken.length || over.length ? 'WITH WARNINGS' : 'clean');
