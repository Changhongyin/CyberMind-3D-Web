// Low-cost timing review: plays the scripted tour once at a small size and saves a frame at each listed second.
//   node filmstrip.mjs <outDir> [WxH=960x540] [t1,t2,...]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const outDir = process.argv[2];
const [W, H] = (process.argv[3] || '960x540').split('x').map(Number);
const times = (process.argv[4] || '1,5,9,12,15,17,19,21,23,25,28,31,34,37,41,43,46,49,52,55,58').split(',').map(Number);
fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--hide-scrollbars', '--mute-audio', `--window-size=${W},${H}`], defaultViewport: { width: W, height: H, deviceScaleFactor: 1 }, protocolTimeout: 900000 });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${process.env.PORT || 8787}/?capture&director=film&q=${process.env.Q || 'fidelity'}`, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 300000 });
let t = 0;
for (const target of times) {
  const n = Math.round((target - t) * 60); t = target;
  await page.evaluate((n) => { for (let i = 0; i < n; i++) window.__frame(1 / 60); }, n);
  await page.screenshot({ path: `${outDir}/t${String(target).padStart(4, '0')}.png` });
}
console.log(JSON.stringify(await page.evaluate(() => window.__info())));
await browser.close();
