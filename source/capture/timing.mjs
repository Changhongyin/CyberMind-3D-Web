// Offline-capture cost profiler: at one moment of the scripted tour, times the GPU render (forced to finish with a
// 1-pixel readback) and the lossless screenshot separately, then repeats with groups of objects hidden.
//   node timing.mjs [WxH=3840x2160] [filmSeconds=1] [profile=fidelity]
import puppeteer from 'puppeteer-core';
const [W, H] = (process.argv[2] || '3840x2160').split('x').map(Number), at = Number(process.argv[3] || 1), q = process.argv[4] || 'fidelity';
const browser = await puppeteer.launch({ executablePath: process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--hide-scrollbars', '--mute-audio', `--window-size=${W},${H}`, '--force-device-scale-factor=1'], defaultViewport: { width: W, height: H, deviceScaleFactor: 1 }, protocolTimeout: 900000 });
const page = await browser.newPage(); page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${process.env.PORT || 8787}/?capture&director=film&q=${q}`, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 600000 });
await page.evaluate((n) => window.__step(1 / 120, n), Math.round(at * 120));
const cdp = await page.createCDPSession();
const timeRender = (n = 4) => page.evaluate((n) => { const { renderer } = window.__dbg, gl = renderer.getContext(), px = new Uint8Array(4); const t = [];
  for (let i = 0; i < n; i++) { const t0 = performance.now(); window.__frame(1 / 120); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); t.push(performance.now() - t0); } return t.map((x) => Math.round(x)); }, n);
const timeShot = async (n = 3) => { const t = []; for (let i = 0; i < n; i++) { await page.evaluate(() => window.__frame(1 / 120)); const t0 = Date.now(); await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true }); t.push(Date.now() - t0); } return t; };
console.log('info', JSON.stringify(await page.evaluate(() => window.__info())));
console.log('render ms (all on)      ', await timeRender());
console.log('screenshot ms           ', await timeShot());
const groups = {
  'additive/transparent off': (o) => o.material && [].concat(o.material).some((m) => m.transparent),
  'water (reflection pass) off': (o) => o.material && o.material.uniforms && o.material.uniforms.uMirror,
  'instanced meshes off': (o) => o.isInstancedMesh,
};
for (const [name, fn] of Object.entries(groups)) {
  const n = await page.evaluate((src) => { const f = eval(src); let n = 0; window.__dbg.scene.traverse((o) => { if (o.visible && f(o)) { o.visible = false; o.userData.__off = true; n++; } }); return n; }, '(' + fn.toString() + ')');
  console.log(`render ms, ${name} (${n} objs)`, await timeRender());
  await page.evaluate(() => window.__dbg.scene.traverse((o) => { if (o.userData.__off) { o.visible = true; delete o.userData.__off; } }));
}
await page.evaluate(() => { window.__dbg.scene.traverse((o) => { if (o.isLight && o.castShadow) { o.castShadow = false; o.userData.__sh = true; } }); });
console.log('render ms, shadows off  ', await timeRender());
await browser.close();
