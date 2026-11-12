// Screenshots of the three Lux3D models exactly as generated (source/web/tools/model-viewer.html), for the report.
//   node mv_shots.mjs <outDir>
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const outDir = process.argv[2]; fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--hide-scrollbars', '--window-size=3600,3600'], defaultViewport: { width: 1200, height: 1200, deviceScaleFactor: 1 } });
const page = await browser.newPage(); page.on('pageerror', (e) => console.log('[pageerror]', e.message));
for (const [name, qs, size] of [['lux_mask_glb', 'asset=mask&yaw=28', 1200], ['lux_censer_glb', 'asset=censer&yaw=-20', 1200], ['lux_drone_glb', 'asset=drone&yaw=-25', 1200], ['split_wire', 'asset=mask&wire&yaw=40', 3600]]) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${process.env.PORT || 8787}/tools/model-viewer.html?${qs}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', { timeout: 120000 }); await new Promise((r) => setTimeout(r, 600));
  console.log(name, await page.$eval('#cap', (e) => e.textContent));
  await page.evaluate(() => { document.getElementById('nav').style.display = 'none'; document.getElementById('cap').style.display = 'none'; });
  await page.screenshot({ path: `${outDir}/${name}.png` });
}
await browser.close();
