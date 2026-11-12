// JIXIN 机心 — boot, render loop, state machine, camera rig, input. See README for the URL flags.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Post } from './post.js';
import { G, HUES } from './materials.js';
import { clamp, lerp, damp, wrapPi, easeInOut } from './util.js';
import { buildEngine } from './engine.js';
import { buildHalo, HALO } from './halo.js';
import { buildMask } from './mask.js';
import { buildWorld } from './world.js';
import { UI } from './ui.js';
import { Sound } from './audio.js';
import { Director } from './director.js';
import { HOTSPOTS, HOME, HEAD } from './hotspots.js';

const Q = new URLSearchParams(location.search);
const CAPTURE = Q.has('capture');
export const PROFILES = {
  fidelity: { name: '原生 FIDELITY', note: '原生分辨率 · 4×MSAA · 全部特效', scale: 1.0, msaa: 4, shadow: 2048, reflect: 1.0, rain: 1.0, bloomLevels: 6 },
  balanced: { name: '均衡 BALANCED', note: '75% 内部分辨率 · 2×MSAA', scale: 0.75, msaa: 2, shadow: 1024, reflect: 0.5, rain: 0.7, bloomLevels: 6 },
  performance: { name: '流畅 PERFORMANCE', note: '50% 内部分辨率 · 无MSAA · 无倒影', scale: 0.5, msaa: 0, shadow: 0, reflect: 0, rain: 0.45, bloomLevels: 5 },
  auto: { name: '自动 AUTO', note: '动态分辨率 50–100%', scale: 1.0, msaa: 2, shadow: 1024, reflect: 0.5, rain: 0.7, bloomLevels: 6, dynamic: true },
};

const canvas = document.getElementById('gl');
const ui = new UI();
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: false, preserveDrawingBuffer: false });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 required');
} catch (e) { ui.fatal('此设备或浏览器无法启动 WebGL2 渲染。', 'WebGL2 is unavailable in this browser/GPU. Try a current Chrome, Edge, Safari or Firefox with hardware acceleration enabled.'); throw e; }
renderer.setPixelRatio(1); renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.info.autoReset = false;
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ui.fatal('图形上下文丢失。', 'The graphics context was lost. Reload the page; choose a lighter quality profile if it repeats.', true); });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.12, 1400);
const post = new Post(renderer);
const sound = new Sound();

// ---------------------------------------------------------------- state
const S = {
  T: 0, frame: 0, phase: 'dormant', open: 0, wake: 0, phaseT: 0, inspect: null, tour: false, hue: 2, profile: 'fidelity', scale: 1,
  lastInput: -100, msg: null, msgT: -10, hud: true,
};
const rig = {
  az: HOME.az, el: HOME.el, dist: HOME.dist, tgt: new THREE.Vector3(...HOME.tgt), fov: HOME.fov,
  g: { az: HOME.az, el: HOME.el, dist: HOME.dist, tgt: new THREE.Vector3(...HOME.tgt), fov: HOME.fov },
  lim: null, lambda: 6,
};
const HOME_LIM = { az: [-1.42, 1.42], el: [-0.2, 0.52], dist: [9.5, 25.5] };
rig.lim = HOME_LIM;

let engine, halo, mask, world, director;

function setHue(i) { S.hue = i; }
function say(zh, en, T = S.T) { S.msg = [zh, en]; S.msgT = T; ui.flash(zh, en); }

// ---------------------------------------------------------------- build
async function boot() {
  ui.progress(0.05, '装配井体 · building the well');
  const manager = new THREE.LoadingManager();
  const loader = new GLTFLoader(manager);
  const prof = Q.get('q'); if (prof && PROFILES[prof]) S.profile = prof;
  await ui.fontsReady();
  engine = buildEngine({ onStep: (i, glyph, user) => { if (i === 0) setHue(glyph); sound.pluck(i, glyph, user ? 1 : 0.55); ui.thought(engine.line(), engine.index()); } });
  halo = buildHalo({ onLock: (i) => { sound.lock(i); const n = halo.rings.filter((r) => r.locked).length; ui.rings(halo.rings); if (n === 3) say('三环已合。点击面壳，启封机心。', 'All three rings aligned — click the face to unseal it.'); } });
  scene.add(halo.root);
  ui.progress(0.15, '唤取面壳 · loading the face');
  let loaded = 0; const tick = () => ui.progress(0.15 + 0.6 * (++loaded / 3), '唤取资产 · loading generated assets');
  const fail = (what) => (e) => { console.warn('asset failed', what, e); ui.warn(`${what} 未能载入，场景以缺省形态继续。`, `${what} failed to load; the scene continues without it.`); return null; };
  const [m, censer, drone] = await Promise.all([
    buildMask(loader, 'assets/mask.glb').then((x) => (tick(), x)).catch(fail('面壳 mask.glb')),
    loader.loadAsync('assets/censer.glb').then((x) => (tick(), x)).catch(fail('铜炉 censer.glb')),
    loader.loadAsync('assets/drone.glb').then((x) => (tick(), x)).catch(fail('灯奴 drone.glb')),
  ]);
  mask = m;
  const head = new THREE.Group(); head.name = 'head'; scene.add(head);
  if (mask) head.add(mask.root);
  engine.root.position.set(0, 0.0, 0.05); head.add(engine.root);
  head.scale.setScalar(HEAD.scale); head.position.y = HEAD.y;
  ui.progress(0.8, '点亮雾港 · lighting the city');
  world = buildWorld({ renderer, scene, camera, censer, drone, S });
  director = new Director({ S, rig, api });
  ui.bind(api); ui.sound(sound.enabled);
  ui.rings(halo.rings); ui.thought(engine.line(), engine.index()); ui.quality(S.profile, PROFILES);
  applyProfile(S.profile);
  resize();
  // warm-up: compile every program before the first visible frame
  ui.progress(0.92, '预热着色器 · compiling shaders');
  await new Promise((r) => setTimeout(r, 30));
  step(1 / 60); render();
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* optional */ }
  ui.progress(1, '就绪 · ready');
  window.__ready = true;
  if (CAPTURE) { ui.captureMode(); if (Q.has('director')) director.start(Q.get('director') || 'film'); return; }
  ui.ready(() => { sound.unlock(); });
  if (Q.has('tour')) api.tour(true);
  if (Q.has('bench')) bench(Number(Q.get('bench')) || 30);
  last = performance.now(); requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- quality / size
function applyProfile(name) {
  S.profile = name; const p = PROFILES[name]; S.scale = p.scale; post.levels = p.bloomLevels;
  world.setQuality(p); ui.quality(name, PROFILES); resize(true);
}
function resize(force) {
  const dpr = CAPTURE ? 1 : (window.devicePixelRatio || 1);
  const w = Math.max(2, Math.round(canvas.clientWidth * dpr)), h = Math.max(2, Math.round(canvas.clientHeight * dpr));
  if (force || canvas.width !== w || canvas.height !== h) renderer.setSize(w, h, false);
  post.setSize(w * S.scale, h * S.scale, PROFILES[S.profile].msaa);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', () => resize());

// ---------------------------------------------------------------- simulation step (deterministic for a given dt sequence)
const _c = new THREE.Color();
function step(dt) {
  S.T += dt; S.frame++; const T = S.T; G.uTime.value = T;
  if (director && director.active) director.update(dt, T);
  // phase machine
  if (S.phase === 'opening') {
    S.phaseT += dt; S.open = clamp(S.phaseT / 6.2);
    S.wake = damp(S.wake, S.phaseT > 1.6 ? 1 : 0, 0.9, dt);
    if (S.phaseT > 8.5) { S.phase = 'awake'; ui.phase(S.phase); say('它醒了。点击字鼓，改写它的念头。', 'It is awake. Click a glyph drum to turn its thought.'); }
  } else if (S.phase === 'closing') {
    S.phaseT += dt; S.open = 1 - clamp((S.phaseT - 0.6) / 4.6); S.wake = damp(S.wake, 0, 1.3, dt);
    if (S.phaseT > 6.2) { S.phase = 'dormant'; S.open = 0; ui.phase(S.phase); ui.rings(halo.rings); }
  } else if (S.phase === 'awake') { S.wake = damp(S.wake, 1, 1.5, dt); S.open = 1; } else { S.wake = damp(S.wake, 0, 1.5, dt); }
  G.uWake.value = S.wake; G.uOpen.value = S.open;
  const rainTarget = S.phase === 'dormant' ? 1 : S.phase === 'closing' ? (S.phaseT > 2 ? 1 : 0) : (S.phase === 'opening' && S.phaseT < 0.9 ? 1 : -0.03);
  G.uRainV.value = damp(G.uRainV.value, rainTarget, S.phase === 'opening' ? 1.6 : 0.9, dt); G.uRainT.value += dt * G.uRainV.value;
  _c.copy(HUES[S.hue]); G.uHue.value.lerp(_c, 1 - Math.exp(-dt * 2.5));

  halo.update(dt, T);
  const locks = halo.rings.filter((r) => r.locked).length;
  engine.update(dt, T, S.wake);
  if (mask) mask.update(dt, T, S.open, locks);
  world.update(dt, T);
  sound.update(dt, S);
  // camera
  const g = rig.g, L = rig.lim;
  if (!(director && director.active)) {
    g.az = clamp(g.az, L.az[0], L.az[1]); g.el = clamp(g.el, L.el[0], L.el[1]); g.dist = clamp(g.dist, L.dist[0], L.dist[1]);
    const k = 1 - Math.exp(-dt * rig.lambda);
    rig.az = lerp(rig.az, g.az, k); rig.el = lerp(rig.el, g.el, k); rig.dist = lerp(rig.dist, g.dist, k); rig.tgt.lerp(g.tgt, k); rig.fov = lerp(rig.fov, g.fov, k);
  }
  const sway = director && director.active ? 0 : 1, az = rig.az + sway * 0.012 * Math.sin(T * 0.21), el = rig.el + sway * 0.006 * Math.sin(T * 0.17 + 1);
  camera.position.set(rig.tgt.x + rig.dist * Math.sin(az) * Math.cos(el), rig.tgt.y + rig.dist * Math.sin(el), rig.tgt.z + rig.dist * Math.cos(az) * Math.cos(el));
  camera.lookAt(rig.tgt); if (Math.abs(camera.fov - rig.fov) > 1e-3) { camera.fov = rig.fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld(); G.uCam.value.copy(camera.position);
  // grade follows the state: cold and desaturated asleep, warm when awake
  const u = post.mFinal.uniforms;
  u.uExposure.value = 0.98 - 0.08 * S.wake; u.uBloom.value = 0.60 + 0.05 * S.wake;
  u.uTint.value.setRGB(lerp(0.94, 1.04, S.wake), lerp(1.0, 0.99, S.wake), lerp(1.07, 0.94, S.wake));
  u.uFlash.value = damp(u.uFlash.value, 0, 3.0, dt);
}
function render() {
  renderer.info.reset();
  world.preRender(renderer, scene, camera);
  post.render(scene, camera, S.frame);
  if (S.hud) ui.frame(camera, S, HOTSPOTS, canvas);
}

// ---------------------------------------------------------------- real-time loop
let last = 0, fpsAcc = 0, fpsN = 0, fpsT = 0, dynT = 0; const frameTimes = [];
function loop(now) {
  requestAnimationFrame(loop);
  const raw = (now - last) / 1000; last = now; const dt = Math.min(raw, 1 / 15);
  step(dt); render();
  fpsAcc += raw; fpsN++; if (benchRec) benchRec.push(raw * 1000);
  if (now - fpsT > 500) {
    const fps = fpsN / fpsAcc; ui.perf(fps, post.size.x, post.size.y, canvas.width, canvas.height, PROFILES[S.profile], S.scale, renderer.info.render);
    if (PROFILES[S.profile].dynamic && now - dynT > 1500) {      // dynamic resolution (labelled in the HUD)
      dynT = now; const target = S.refresh || 60;
      if (fps < target * 0.86 && S.scale > 0.5) { S.scale = Math.max(0.5, S.scale - 0.1); resize(); } else if (fps > target * 0.97 && S.scale < 1) { S.scale = Math.min(1, S.scale + 0.05); resize(); }
    }
    fpsAcc = 0; fpsN = 0; fpsT = now;
  }
}

// ---------------------------------------------------------------- actions (shared by pointer, keyboard, HUD and the tour)
const api = {
  S, rig, PROFILES, get halo() { return halo; }, get engine() { return engine; }, get world() { return world; },
  alignRing(i) { if (S.phase !== 'dormant') return; halo.autoAlign(i, S.T); sound.tickStart(); },
  toggleWake() { if (S.phase === 'dormant') api.wake(); else if (S.phase === 'awake') api.sleep(); },
  wake() {
    if (S.phase !== 'dormant') return false;
    if (!halo.allLocked()) { say('三环未合，面壳不启。', 'The face stays sealed until all three rings are aligned.'); sound.deny(); if (mask) mask.shared.uSeam.value = 1.6; return false; }
    S.phase = 'opening'; S.phaseT = 0; G.uShock.value = S.T + 1.2; post.mFinal.uniforms.uFlash.value = 0.5; sound.wake(); ui.phase(S.phase); api.inspect(null); return true;
  },
  sleep() { if (S.phase !== 'awake') return; S.phase = 'closing'; S.phaseT = 0; halo.reset(S.T + 3.6); sound.sleep(); ui.phase(S.phase); api.inspect(null); say('封存。三环归位，雨继续下。', 'Sealed again. The rings unwind and the rain resumes.'); },
  stepDrum(i, dir = 1) { if (S.phase !== 'awake') return; engine.stepDrum(i, dir, S.T, true); },
  inspect(id) {
    const h = id ? HOTSPOTS.find((x) => x.id === id) : null;
    if (h && !h.when.includes(S.phase === 'awake' ? 'awake' : 'dormant')) return;
    S.inspect = h ? h.id : null; const p = h ? h.pose : HOME;
    Object.assign(rig.g, { az: p.az, el: p.el, dist: p.dist, fov: p.fov || HOME.fov }); rig.g.tgt.set(...p.tgt); rig.lambda = 2.4;
    rig.lim = h ? { az: [p.az - 0.55, p.az + 0.55], el: [p.el - 0.3, p.el + 0.3], dist: [p.dist * 0.6, p.dist * 1.5] } : HOME_LIM;
    ui.inspect(h); if (h) sound.blip();
  },
  home() { api.inspect(null); },
  card(id) { ui.inspect(id ? HOTSPOTS.find((x) => x.id === id) : null); },
  tour(on) { if (on && !director.active) { api.inspect(null); director.start('tour'); ui.tour(true); } else if (!on && director.active) { director.stop(); ui.tour(false); rig.g.az = rig.az; rig.g.el = rig.el; rig.g.dist = rig.dist; rig.g.tgt.copy(rig.tgt); rig.g.fov = HOME.fov; rig.lim = HOME_LIM; } },
  setProfile(name) { applyProfile(name); },
  toggleSound() { const on = sound.toggle(); ui.sound(on); },
  toggleHud() { S.hud = !S.hud; ui.hud(S.hud); },
  say,
};

// ---------------------------------------------------------------- pointer / touch / keyboard
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const ptr = { down: false, mode: null, x: 0, y: 0, x0: 0, y0: 0, ring: -1, a0: 0, ang0: 0, moved: 0, target: null, pinch: 0, ids: new Map() };
function pickAt(x, y) {
  const r = canvas.getBoundingClientRect(); ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
  const objs = [];
  if (mask && S.open < 0.02) objs.push(mask.proxy);
  if (S.open > 0.7) objs.push(...engine.pickables);
  objs.push(...world.pickables);
  const hits = ray.intersectObjects(objs, true); const h = hits[0];
  const hr = S.phase === 'dormant' ? halo.pick(ray.ray) : null;
  if (hr && (!h || h.distance > hr.point.distanceTo(camera.position))) return { type: 'ring', ...hr };
  if (!h) return null;
  let o = h.object; while (o && !o.userData.face && o.userData.drum === undefined && !o.userData.hot) o = o.parent;
  if (!o) return null;
  if (o.userData.face) return { type: 'face' };
  if (o.userData.drum !== undefined) return { type: 'drum', i: o.userData.drum };
  return { type: 'hot', id: o.userData.hot };
}
function hover(x, y) {
  const p = pickAt(x, y); halo.rings.forEach((R, i) => { R.hot = !!p && p.type === 'ring' && p.i === i && !R.locked; });
  canvas.style.cursor = !p ? 'grab' : p.type === 'ring' ? 'ew-resize' : 'pointer'; ui.hover(p, S);
}
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId); ptr.ids.set(e.pointerId, [e.clientX, e.clientY]); sound.unlock(); S.lastInput = S.T;
  if (director.active) api.tour(false);
  if (ptr.ids.size === 2) { const [a, b] = [...ptr.ids.values()]; ptr.pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); ptr.mode = 'pinch'; return; }
  ptr.down = true; ptr.x = ptr.x0 = e.clientX; ptr.y = ptr.y0 = e.clientY; ptr.moved = 0;
  const p = pickAt(e.clientX, e.clientY); ptr.target = p;
  if (p && p.type === 'ring' && !halo.rings[p.i].locked && !halo.rings[p.i].auto) { ptr.mode = 'ring'; ptr.ring = p.i; ptr.a0 = p.a; ptr.ang0 = halo.rings[p.i].ang; halo.rings[p.i].hot = true; canvas.style.cursor = 'grabbing'; } else { ptr.mode = 'orbit'; canvas.style.cursor = 'grabbing'; }
});
canvas.addEventListener('pointermove', (e) => {
  if (ptr.ids.has(e.pointerId)) ptr.ids.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptr.mode === 'pinch' && ptr.ids.size === 2) { const [a, b] = [...ptr.ids.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); rig.g.dist *= ptr.pinch / Math.max(d, 1); ptr.pinch = d; rig.lambda = 9; return; }
  if (!ptr.down) { if (e.pointerType === 'mouse') hover(e.clientX, e.clientY); return; }
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y; ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved += Math.abs(dx) + Math.abs(dy);
  if (ptr.mode === 'ring') {
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const R = halo.rings[ptr.ring], plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(HALO.z + 0.1)), hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(plane, hit)) { const a = Math.atan2(hit.y - HALO.y, hit.x), prev = R.ang; R.ang = ptr.ang0 + wrapPi(a - ptr.a0); if (Math.floor(prev * 12) !== Math.floor(R.ang * 12)) sound.tick(ptr.ring); }
  } else if (ptr.mode === 'orbit' && ptr.moved > 4) { rig.g.az -= dx * 0.0042; rig.g.el += dy * 0.0036; rig.lambda = 9; }
});
function pointerUp(e) {
  ptr.ids.delete(e.pointerId); if (ptr.mode === 'pinch') { ptr.mode = null; ptr.down = false; return; }
  if (!ptr.down) return; ptr.down = false; canvas.style.cursor = 'grab';
  if (ptr.mode === 'ring') { const R = halo.rings[ptr.ring]; R.hot = false; if (ptr.moved < 5) api.alignRing(ptr.ring); else if (!halo.tryLock(ptr.ring, S.T)) { if (Math.abs(wrapPi(R.ang)) < 0.5) say('再近一点。', 'Closer — bring the glyph under the claw.'); } }
  else if (ptr.moved < 5 && ptr.target) { const p = ptr.target; if (p.type === 'face') api.wake(); else if (p.type === 'drum') api.stepDrum(p.i, e.shiftKey ? -1 : 1); else if (p.type === 'hot') api.inspect(p.id); }
  ptr.mode = null;
}
canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (director.active) api.tour(false); rig.g.dist *= Math.exp(e.deltaY * 0.0011); rig.lambda = 8; S.lastInput = S.T; }, { passive: false });
canvas.addEventListener('dblclick', () => api.home());
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return; sound.unlock(); S.lastInput = S.T;
  const k = e.key.toLowerCase();
  if (director.active && k !== 't') api.tour(false);
  if (k === '1' || k === '2' || k === '3') api.alignRing(Number(k) - 1);
  else if (k === ' ' || k === 'enter') { e.preventDefault(); api.toggleWake(); }
  else if (k === 'escape') { if (S.inspect) api.home(); else ui.closePanels(); }
  else if (k === 'r') api.home(); else if (k === 't') api.tour(!director.active); else if (k === 'm') api.toggleSound(); else if (k === 'h') api.toggleHud();
  else if (k === 'q') { const names = Object.keys(PROFILES); api.setProfile(names[(names.indexOf(S.profile) + 1) % names.length]); }
  else if (k === 'arrowleft') { rig.g.az -= 0.12; rig.lambda = 6; } else if (k === 'arrowright') { rig.g.az += 0.12; rig.lambda = 6; }
  else if (k === 'arrowup') { rig.g.el += 0.07; rig.lambda = 6; } else if (k === 'arrowdown') { rig.g.el -= 0.07; rig.lambda = 6; }
  else if (k === '=' || k === '+') { rig.g.dist *= 0.9; } else if (k === '-') { rig.g.dist *= 1.1; }
  else if (['z', 'x', 'c', 'v'].includes(k)) api.stepDrum(['z', 'x', 'c', 'v'].indexOf(k), e.shiftKey ? -1 : 1);
});

// ---------------------------------------------------------------- benchmark (real-time, the page must be visible and focused)
let benchRec = null;
async function bench(seconds) {
  await new Promise((r) => setTimeout(r, 400)); api.tour(true);
  await new Promise((r) => setTimeout(r, 6000));                // warm-up
  benchRec = []; const t0 = performance.now(); await new Promise((r) => setTimeout(r, seconds * 1000));
  const rec = benchRec.slice().sort((a, b) => a - b); benchRec = null; const n = rec.length, sum = rec.reduce((a, b) => a + b, 0), pc = (p) => rec[Math.min(n - 1, Math.floor(n * p))];
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const out = {
    kind: 'JIXIN real-time benchmark (scripted tour incl. ring alignment, wake transformation and close inspection)', date: new Date().toISOString(), seconds: (performance.now() - t0) / 1000, frames: n,
    avgFps: +(1000 * n / sum).toFixed(2), frameMs: { avg: +(sum / n).toFixed(2), p50: +pc(0.5).toFixed(2), p90: +pc(0.9).toFixed(2), p95: +pc(0.95).toFixed(2), p99: +pc(0.99).toFixed(2), max: +rec[n - 1].toFixed(2), min: +rec[0].toFixed(2) },
    profile: S.profile, internalScale: S.scale, sceneTarget: [post.size.x, post.size.y], msaa: post.samples, drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight], cssSize: [canvas.clientWidth, canvas.clientHeight], devicePixelRatio: window.devicePixelRatio,
    visibility: document.visibilityState, focused: document.hasFocus(), renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency,
    screen: [screen.width, screen.height], estRefreshHz: +(1000 / pc(0.05)).toFixed(1), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, renderTargetMB: +post.memoryMB().toFixed(0),
    geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
    note: 'estRefreshHz is derived from the fastest 5% of requestAnimationFrame intervals; a display or compositor capped at 60 Hz cannot show more than 60 presented frames per second.',
  };
  window.__bench = out; ui.bench(out); api.tour(false);
}

// ---------------------------------------------------------------- capture / test hooks (fixed-step, no rAF)
window.__frame = (dt) => { step(dt); render(); return S.frame; };
window.__step = (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); return S.frame; };      // simulate only (fast-forward for segmented capture)
window.__api = api; window.__dbg = { scene, camera, renderer, post, THREE };
window.__info = () => { const gl = renderer.getContext(); return { buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight], scene: [post.size.x, post.size.y], msaa: post.samples, scale: S.scale, profile: S.profile, T: S.T, frame: S.frame, phase: S.phase, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, rtMB: post.memoryMB(), directorDone: director ? director.done : false, directorLen: director ? director.length : 0 }; };
window.__pose = (p) => { Object.assign(rig, { az: p.az, el: p.el, dist: p.dist, fov: p.fov || HOME.fov }); rig.tgt.set(...p.tgt); Object.assign(rig.g, { az: p.az, el: p.el, dist: p.dist, fov: p.fov || HOME.fov }); rig.g.tgt.set(...p.tgt); rig.lim = { az: [-9, 9], el: [-1.5, 1.5], dist: [0.3, 400] }; };
window.__state = (name) => {   // jump straight to a state (review stills)
  if (name === 'awake') { halo.rings.forEach((R) => { R.locked = true; R.ang = 0; R.act = 1; R.auto = null; }); S.phase = 'awake'; S.open = 1; S.wake = 1; G.uRainV.value = -0.03; ui.phase('awake'); }
  if (name === 'locked') { halo.rings.forEach((R) => { R.locked = true; R.ang = 0; R.act = 1; R.auto = null; }); }
  ui.rings(halo.rings);
};

boot().catch((e) => { console.error(e); ui.fatal('载入失败。', String(e && e.message || e)); });
