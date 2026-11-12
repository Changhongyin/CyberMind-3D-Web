// Checks the site's degraded states: (1) WebGL unavailable, (2) one generated model missing (404), (3) narrow phone viewport.
//   node failtest.mjs <outDir> [baseUrl=http://localhost:8787/]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const outDir = process.argv[2], base = process.argv[3] || `http://localhost:${process.env.PORT || 8787}/`; fs.mkdirSync(outDir, { recursive: true });
const EDGE = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const res = [];
const check = (n, ok, x = '') => { res.push([n, !!ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); };
{ // 1. no WebGL
  const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis', '--window-size=1280,720'], defaultViewport: { width: 1280, height: 720 } });
  const p = await b.newPage(); await p.goto(base, { waitUntil: 'load' }); await new Promise((r) => setTimeout(r, 2500));
  const t = await p.evaluate(() => ({ fatal: !document.getElementById('fatal').hidden, zh: document.getElementById('f-zh').textContent, btn: !!document.querySelector('#fatal button') }));
  await p.screenshot({ path: `${outDir}/fallback_no-webgl.png` }); check('no WebGL -> readable message + reload button', t.fatal && t.zh && t.btn, JSON.stringify(t)); await b.close();
}
{ // 2. a generated model fails to load
  const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--window-size=1280,720'], defaultViewport: { width: 1280, height: 720 } });
  const p = await b.newPage(); await p.setRequestInterception(true);
  p.on('request', (r) => (r.url().endsWith('/assets/drone.glb') ? r.respond({ status: 404, body: 'missing' }) : r.continue()));
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base, { waitUntil: 'load' }); await p.waitForFunction('window.__ready === true', { timeout: 300000 });
  const t = await p.evaluate(() => ({ warn: document.getElementById('lwarn').textContent, enter: !document.getElementById('b-enter').hidden }));
  await p.screenshot({ path: `${outDir}/fallback_missing-model_loading.png` });
  await p.click('#b-enter'); await new Promise((r) => setTimeout(r, 2500)); await p.screenshot({ path: `${outDir}/fallback_missing-model_scene.png` });
  check('missing drone.glb -> warning, site still enters', t.warn.includes('drone') && t.enter && errs.length === 0, JSON.stringify(t).slice(0, 160)); await b.close();
}
{ // 3. phone portrait viewport, touch
  const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--window-size=420,900'] });
  const p = await b.newPage(); await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base, { waitUntil: 'load' }); await p.waitForFunction('window.__ready === true', { timeout: 300000 });
  await p.tap('#b-enter'); await new Promise((r) => setTimeout(r, 2000));
  const t = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, buf: [document.getElementById('gl').width, document.getElementById('gl').height] }));
  await p.screenshot({ path: `${outDir}/phone_390x844.png` });
  await p.evaluate(() => window.__api.setProfile('balanced'));
  await p.keyboard.press('1'); await p.keyboard.press('2'); await p.keyboard.press('3'); await new Promise((r) => setTimeout(r, 4200));
  await p.tap('#b-act'); await new Promise((r) => setTimeout(r, 9500));
  const ph = await p.evaluate(() => window.__api.S.phase); await p.screenshot({ path: `${outDir}/phone_390x844_awake.png` });
  check('phone viewport: no horizontal scroll, touch button wakes the face', t.sw <= t.iw && ph === 'awake' && errs.length === 0, JSON.stringify({ ...t, ph })); await b.close();
}
const fail = res.filter((r) => !r[1]).length; console.log(`${res.length - fail}/${res.length} passed`); process.exitCode = fail ? 1 : 0;
