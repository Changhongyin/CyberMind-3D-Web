// Independent check of the segment joins: renders the frames on BOTH sides of every join in ONE continuous browser
// session (no segment restart, no fast-forward boundary) and saves them, so they can be compared with the master.
//   node join_check.mjs <outDir> [joins=1200,2400,3600,4800,6000]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const outDir = process.argv[2], joins = (process.argv[3] || '1200,2400,3600,4800,6000').split(',').map(Number), W = 3840, H = 2160;
fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--hide-scrollbars', '--mute-audio', `--window-size=${W},${H}`, '--force-device-scale-factor=1'], defaultViewport: { width: W, height: H, deviceScaleFactor: 1 }, protocolTimeout: 900000 });
const page = await browser.newPage(); page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${process.env.PORT || 8787}/?capture&director=film&q=fidelity`, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 600000 });
const cdp = await page.createCDPSession(); let done = 0;          // number of 1/120 steps taken since boot == next video frame index
for (const b of joins) {
  for (const v of [b - 1, b]) {
    const k = v - done; await page.evaluate((k) => { if (k > 0) window.__step(1 / 120, k); window.__frame(1 / 120); }, k); done = v + 1;
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${outDir}/cont_${String(v).padStart(5, '0')}.png`, Buffer.from(data, 'base64'));
    console.log('frame', v, JSON.stringify(await page.evaluate(() => { const i = window.__info(); return { T: +i.T.toFixed(4), simFrame: i.frame, phase: i.phase }; })));
  }
}
await browser.close();
