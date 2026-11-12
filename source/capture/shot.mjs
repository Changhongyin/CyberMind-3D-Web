// Stills from the running site (headless Edge, real WebGL, page drawing buffer = viewport, DPR 1).
//   node shot.mjs <outDir> [WxH=1920x1080] [shots.json | name:state:seconds[:poseJSON] ...]
// shots.json: [{name, state, secs, pose?, hud?:false, jpg?:true}]
// state: dormant | locked | awake | film@<seconds> (plays the scripted tour up to that time with the recorder's 1/120 step)
// The simulation is advanced without rendering, then the final frames are rendered; the PNG is the composited page.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const outDir = process.argv[2];
const [W, H] = (process.argv[3] || '1920x1080').split('x').map(Number);
const PORT = process.env.PORT || 8787, q = process.env.Q || 'fidelity';
let shots = process.argv.slice(4).map((s) => { const [name, state, secs, ...rest] = s.split(':'); return { name, state, secs: Number(secs || 2), pose: rest.length ? JSON.parse(rest.join(':')) : null }; });
if (shots.length === 1 && shots[0].name.endsWith('.json')) shots = JSON.parse(fs.readFileSync(shots[0].name, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--hide-scrollbars', '--mute-audio', `--window-size=${W},${H}`, '--force-device-scale-factor=1'],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 }, protocolTimeout: 900000,
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => { errs.push(e.message); console.log('[pageerror]', e.message); });
const meta = [];
for (const s of shots) {
  const film = s.state.startsWith('film@');
  await page.goto(`http://localhost:${PORT}/?capture&q=${q}${film ? '&director=film' : ''}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', { timeout: 300000 });
  const t0 = Date.now();
  const res = await page.evaluate(async (s, film) => {
    const dt = 1 / 120;
    if (!film) { if (s.state !== 'dormant') window.__state(s.state); if (s.pose) window.__pose(s.pose); }
    const n = Math.max(3, Math.round((film ? Number(s.state.slice(5)) : s.secs) * 120));
    window.__step(dt, n - 2); window.__frame(dt); window.__frame(dt);
    if (s.hud === false) document.getElementById('hud').style.display = 'none';
    return window.__info();
  }, s, film);
  await new Promise((r) => setTimeout(r, 120));
  const path = `${outDir}/${s.name}.${s.jpg ? 'jpg' : 'png'}`;
  await page.screenshot({ path, type: s.jpg ? 'jpeg' : 'png', ...(s.jpg ? { quality: 92 } : {}) });
  meta.push({ name: s.name, file: path.split('/').pop(), state: s.state, pose: s.pose || null, hud: s.hud !== false, info: res });
  console.log(s.name, JSON.stringify({ buffer: res.buffer, scene: res.scene, msaa: res.msaa, T: +res.T.toFixed(3), phase: res.phase, calls: res.calls }), `${Date.now() - t0} ms`);
}
fs.writeFileSync(`${outDir}/shots.meta.json`, JSON.stringify({ viewport: [W, H], dpr: 1, profile: q, shots: meta }, null, 1));
await browser.close();
if (errs.length) { console.log('PAGE ERRORS:', errs.length); process.exitCode = 1; }
