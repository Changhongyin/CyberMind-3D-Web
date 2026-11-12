// grab N consecutive native frames of the film at time t to PNG files (encoder benchmarking)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const at = Number(process.argv[2] || 1), n = Number(process.argv[3] || 24), dir = process.argv[4] || 'out/enc';
const W = 3840, H = 2160; fs.mkdirSync(dir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--hide-scrollbars', '--mute-audio', `--window-size=${W},${H}`, '--force-device-scale-factor=1'], defaultViewport: { width: W, height: H, deviceScaleFactor: 1 }, protocolTimeout: 900000 });
const page = await browser.newPage();
await page.goto('http://localhost:8787/?capture&director=film&q=fidelity', { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 600000 });
await page.evaluate((k) => window.__step(1 / 120, k), Math.round(at * 120));
const cdp = await page.createCDPSession(); const t0 = Date.now();
for (let i = 0; i < n; i++) { await page.evaluate(() => window.__frame(1 / 120)); const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true }); fs.writeFileSync(`${dir}/f${String(i).padStart(3, '0')}.png`, Buffer.from(data, 'base64')); }
console.log('grabbed', n, 'frames in', ((Date.now() - t0) / 1000).toFixed(1), 's');
await browser.close();
