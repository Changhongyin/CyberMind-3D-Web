// Real-time benchmark runner. Opens the site in a VISIBLE, focused, full-screen Edge window (or headless offscreen with
// --headless WxH, clearly labelled) and runs the built-in ?bench mode: 6 s warm-up, then N seconds of the scripted tour
// (ring alignment, wake transformation, close inspection) driven by requestAnimationFrame.
//   node bench.mjs <out.json> [--q fidelity] [--seconds 30] [--headless 3840x2160]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const args = process.argv.slice(2), out = args[0], opt = (k, d) => { const i = args.indexOf('--' + k); return i > 0 ? args[i + 1] : d; };
const q = opt('q', 'fidelity'), seconds = Number(opt('seconds', 30)), hl = opt('headless', null);
const common = ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'];
let browser;
if (hl) { const [W, H] = hl.split('x').map(Number); browser = await puppeteer.launch({ executablePath: process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: [...common, '--hide-scrollbars', `--window-size=${W},${H}`, '--force-device-scale-factor=1'], defaultViewport: { width: W, height: H, deviceScaleFactor: 1 }, protocolTimeout: 900000 }); }
else browser = await puppeteer.launch({ executablePath: process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: false, args: [...common, '--start-fullscreen', '--no-first-run', '--no-default-browser-check'], defaultViewport: null, protocolTimeout: 900000, userDataDir: process.env.BENCH_PROFILE || undefined });
const page = (await browser.pages())[0] || await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.bringToFront();
await page.goto(`http://localhost:${process.env.PORT || 8787}/?bench=${seconds}&q=${q}`, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 600000 });
await page.click('#b-enter'); await page.bringToFront();
await page.waitForFunction('window.__bench', { timeout: (seconds + 60) * 1000, polling: 500 });
const res = await page.evaluate(() => window.__bench);
res.mode = hl ? `HEADLESS OFFSCREEN ${hl} (not presented to a display)` : 'headed, full-screen, visible and focused window';
res.launchFlags = common.join(' ');
fs.writeFileSync(out, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ mode: res.mode, profile: res.profile, scene: res.sceneTarget, buffer: res.drawingBuffer, dpr: res.devicePixelRatio, avgFps: res.avgFps, frameMs: res.frameMs, hz: res.estRefreshHz, calls: res.drawCalls, tris: res.triangles, visible: res.visibility, focused: res.focused }));
await browser.close();
