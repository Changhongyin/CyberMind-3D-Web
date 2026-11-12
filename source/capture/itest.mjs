// End-to-end interaction test of the LIVE site (real requestAnimationFrame loop, real pointer/keyboard events).
//   node itest.mjs [WxH=1600x900] [url=http://localhost:8787/]
import puppeteer from 'puppeteer-core';
const [W, H] = (process.argv[2] || '1600x900').split('x').map(Number), url = process.argv[3] || `http://localhost:${process.env.PORT || 8787}/`;
const browser = await puppeteer.launch({ executablePath: process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--hide-scrollbars', '--mute-audio', `--window-size=${W},${H}`], defaultViewport: { width: W, height: H, deviceScaleFactor: 1 }, protocolTimeout: 600000 });
const page = await browser.newPage(); const errs = [];
page.on('pageerror', (e) => { errs.push(e.message); console.log('[pageerror]', e.message); });
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) { errs.push(m.text()); console.log('[console.error]', m.text().slice(0, 400)); } });
const results = []; const check = (name, ok, extra = '') => { results.push([name, !!ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const st = () => page.evaluate(() => { const a = window.__api, i = window.__info(); return { phase: a.S.phase, locked: a.halo.rings.map((r) => r.locked), ang: a.halo.rings.map((r) => +r.ang.toFixed(3)), inspect: a.S.inspect, idx: a.engine.index(), frame: i.frame, scene: i.scene, buffer: i.buffer, profile: i.profile, tour: document.getElementById('b-tour').classList.contains('on'), dist: a.rig.g.dist, az: a.rig.g.az }; });
const proj = (p) => page.evaluate((p) => { const { camera, THREE } = window.__dbg; const v = new THREE.Vector3(...p).project(camera); return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight]; }, p);
const ringPoint = (i, a) => page.evaluate((i, a) => { const h = window.__api.halo, R = h.rings[i], rr = (R.ri + R.ro) / 2, p = h.root.position; return [p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, p.z + 0.1]; }, i, a);

await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 300000 });
check('loading screen shows the enter button', await page.$eval('#b-enter', (b) => !b.hidden));
await page.click('#b-enter'); await sleep(1800);
const s0 = await st(); await sleep(1000); const s1 = await st();
check('render loop advances', s1.frame > s0.frame + 10, `(${s1.frame - s0.frame} frames in 1 s)`);
check('HUD visible, loading hidden', await page.evaluate(() => !document.getElementById('hud').hidden && getComputedStyle(document.getElementById('loading')).opacity < 0.1));

// 1) drag ring 0 (MEMORY) by hand until it locks
{ const a0 = Math.PI * 0.13, need = -(await st()).ang[0]; const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x)); const d = wrap(need);
  let p = await proj(await ringPoint(0, a0)); await page.mouse.move(p[0], p[1]); await page.mouse.down();
  for (let k = 1; k <= 24; k++) { p = await proj(await ringPoint(0, a0 + (d * k) / 24)); await page.mouse.move(p[0], p[1]); await sleep(16); }
  await page.mouse.up(); await sleep(500); const s = await st(); check('ring 0 locks after a manual drag', s.locked[0], JSON.stringify(s.ang)); }
// 2) click ring 1 (auto-align), 3) keyboard for ring 2
{ const p = await proj(await ringPoint(1, Math.PI * 0.1)); await page.mouse.click(p[0], p[1]); await sleep(3200); check('ring 1 aligns and locks after a click', (await st()).locked[1]); }
{ const p = await proj([0, 0.6, 3.6]); await page.mouse.click(p[0], p[1]); await sleep(600); check('face refuses to open before all rings lock', (await st()).phase === 'dormant'); }
await page.keyboard.press('3'); await sleep(3600); check('ring 2 locks from the keyboard (key 3)', (await st()).locked[2]);
check('unseal button offered', await page.$eval('#b-act', (b) => !b.hidden));
// 4) orbit + zoom keep working and stay within limits
{ const a = await st(); await page.mouse.move(W * 0.12, H * 0.3); await page.mouse.down(); await page.mouse.move(W * 0.3, H * 0.36, { steps: 8 }); await page.mouse.up(); await page.mouse.wheel({ deltaY: -400 }); await sleep(500); const b = await st();
  check('drag orbits and wheel zooms', Math.abs(b.az - a.az) > 0.05 && b.dist < a.dist, `az ${a.az.toFixed(2)}->${b.az.toFixed(2)} dist ${a.dist.toFixed(1)}->${b.dist.toFixed(1)}`);
  await page.keyboard.press('r'); await sleep(1500); }
// 5) wake by clicking the face
{ const p = await proj([0, 0.6, 3.6]); await page.mouse.click(p[0], p[1]); await sleep(700); check('clicking the face starts the transformation', (await st()).phase === 'opening'); await sleep(9500); check('reaches the awake state', (await st()).phase === 'awake'); }
// 6) turn a drum by clicking it, and from the HUD
{ const a = await st(); const p = await proj([0, 0.77, 1.26]); await page.mouse.click(p[0], p[1]); await sleep(500); const b = await st(); check('clicking a glyph drum changes the thought', b.idx !== a.idx, `${a.idx}->${b.idx}`);
  await page.click('#glyphs button:nth-child(1)'); await sleep(400); const c = await st(); check('HUD glyph button turns drum 1', c.idx !== b.idx, `${b.idx}->${c.idx}`); }
// 7) inspect via a mark, return with Escape
{ await page.evaluate(() => [...document.querySelectorAll('.mark')].find((m) => m.textContent.includes('THE SEED')).click()); await sleep(2500); const s = await st(); check('mark opens the seed inspection', s.inspect === 'seed' && await page.$eval('#card', (c) => !c.hidden));
  await page.keyboard.press('Escape'); await sleep(1500); check('Escape returns to the overview', (await st()).inspect === null && await page.$eval('#card', (c) => c.hidden)); }
// 8) tour starts and can be interrupted
{ await page.keyboard.press('t'); await sleep(1500); const on = (await st()).tour; await page.mouse.move(W * 0.5, H * 0.2); await page.mouse.down(); await page.mouse.up(); await sleep(300); check('tour starts and a pointer press interrupts it', on && !(await st()).tour); }
// 9) quality profiles change the real internal resolution
{ await page.evaluate(() => window.__api.setProfile('performance')); await sleep(600); const a = await st(); await page.evaluate(() => window.__api.setProfile('fidelity')); await sleep(600); const b = await st();
  check('performance profile halves the internal target, fidelity restores native', a.scene[0] === Math.floor(W * 0.5) && b.scene[0] === W && b.buffer[0] === W, `${a.scene} -> ${b.scene}, buffer ${b.buffer}`); }
// 10) seal again with Space; rings unwind; loop can repeat
{ await page.keyboard.press('Space'); await sleep(700); check('Space starts sealing', (await st()).phase === 'closing'); await sleep(9000); const s = await st(); check('returns to dormant with all rings released', s.phase === 'dormant' && s.locked.every((x) => !x), JSON.stringify(s.locked));
  await page.keyboard.press('1'); await page.keyboard.press('2'); await page.keyboard.press('3'); await sleep(4200); await page.keyboard.press('Enter'); await sleep(800); check('second run: rings re-lock and the face opens again', (await st()).phase === 'opening'); }
await page.screenshot({ path: process.env.SHOT || 'itest_end.png' });
check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
const fail = results.filter((r) => !r[1]).length; console.log(`\n${results.length - fail}/${results.length} passed`);
await browser.close(); process.exitCode = fail ? 1 : 0;
