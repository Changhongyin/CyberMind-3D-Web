// The halo: three concentric cognition rings (忆 MEMORY / 感 SENSE / 志 WILL) on a spoked frame behind the head.
// The visitor turns each ring until its glyph plate sits under the lock claw at twelve o'clock. Code-built.
import * as THREE from 'three';
import { Builder, rng, damp, wrapPi, clamp, easeInOut } from './util.js';
import { G, hullMaterial, glow, PAL } from './materials.js';
import { haloBand, glyphPlate, RING_GLYPHS, RING_NAMES } from './textures.js';

export const HALO = { z: -3.75, y: 0.5, radii: [[3.05, 3.55], [3.75, 4.25], [4.45, 4.95]], start: [2.05, -1.35, 2.85] };
const RING_COL = [new THREE.Color(0x35e6ff), new THREE.Color(0xff2e88), new THREE.Color(0xffb347)];

function washer(rIn, rOut, t, seg = 192) {
  const pts = [new THREE.Vector2(rIn, -t / 2), new THREE.Vector2(rOut, -t / 2), new THREE.Vector2(rOut, t / 2), new THREE.Vector2(rIn, t / 2), new THREE.Vector2(rIn, -t / 2)];
  const g = new THREE.LatheGeometry(pts, seg).toNonIndexed(); g.computeVertexNormals(); g.rotateX(Math.PI / 2); return g;
}

export function buildHalo({ onLock }) {
  const root = new THREE.Group(); root.position.set(0, HALO.y, HALO.z); root.name = 'halo';
  const r = rng(31);
  const steel = hullMaterial({ color: 0x262b33, metalness: 0.9, roughness: 0.44, object: true, panel: 1.6, bump: 0.9, grime: 0.5, key: 'haloSteel' });
  const brass = hullMaterial({ color: 0xb48c48, metalness: 1, roughness: 0.34, object: true, panel: 2.5, bump: 0.5, grime: 0.45, key: 'haloBrass' });
  const rings = [];

  // ---- static frame: spokes, hub, outer rim, roller trucks, lock claws ----
  const fb = new Builder(), C = [1, 1, 1], D = [0.6, 0.62, 0.66], HZ = [1.0, 0.62, 0.12];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8, c = Math.cos(a), s = Math.sin(a);
    fb.box(4.2, 0.16, 0.12, [c * 3.2, s * 3.2, -0.34], [0, 0, a], C); fb.box(4.2, 0.05, 0.2, [c * 3.2, s * 3.2, -0.34], [0, 0, a], D);
    for (const [ri, ro] of HALO.radii) for (const rr of [ri - 0.07, ro + 0.07]) fb.cyl(0.07, 0.07, 0.3, 14, [c * rr, s * rr, -0.12], [Math.PI / 2, 0, 0], D);   // rollers that carry the rings
    fb.box(0.5, 0.3, 0.2, [c * 5.25, s * 5.25, -0.3], [0, 0, a], C);
  }
  fb.add(washer(5.12, 5.34, 0.22, 128), [0, 0, -0.32], [0, 0, 0], 1, C);
  fb.add(washer(1.0, 1.25, 0.3, 64), [0, 0, -0.34], [0, 0, 0], 1, C);
  fb.cyl(1.0, 1.0, 0.1, 48, [0, 0, -0.44], [Math.PI / 2, 0, 0], D);
  fb.cyl(0.85, 1.0, 0.7, 40, [0, 0, 0.1], [Math.PI / 2, 0, 0], C); fb.cyl(1.12, 1.12, 0.12, 40, [0, 0, -0.1], [Math.PI / 2, 0, 0], HZ);      // gimbal mount into the back of the head
  // lock claws at twelve o'clock
  const lamps = [];
  HALO.radii.forEach(([ri, ro], i) => {
    const y = (ri + ro) / 2;
    fb.box(0.12, ro - ri + 0.3, 0.1, [-0.42, y, 0.16], [0, 0, 0], HZ); fb.box(0.12, ro - ri + 0.3, 0.1, [0.42, y, 0.16], [0, 0, 0], HZ);
    fb.box(0.96, 0.08, 0.3, [0, ro + 0.11, 0.02], [0, 0, 0], C); fb.box(0.96, 0.08, 0.3, [0, ri - 0.11, 0.02], [0, 0, 0], C);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.045, 0.05), glow(0xff3b2e, 2.5)); lamp.position.set(0, ro + 0.11, 0.19); root.add(lamp); lamps.push(lamp);
  });
  fb.box(0.5, 5.6, 0.3, [0, 2.4, -0.62], [0, 0, 0], C);
  root.add(new THREE.Mesh(fb.build(), steel));
  // outer rim tick lamps
  const tickN = 96, tick = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), glow(0x35e6ff, 1.6), tickN), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  for (let k = 0; k < tickN; k++) { const a = (k / tickN) * Math.PI * 2; E.set(0, 0, a - Math.PI / 2); Q.setFromEuler(E); M.compose(new THREE.Vector3(Math.cos(a) * 5.23, Math.sin(a) * 5.23, -0.19), Q, new THREE.Vector3(1, k % 8 === 0 ? 2.2 : 1, 1)); tick.setMatrixAt(k, M); }
  root.add(tick);

  // ---- the three rings ----
  HALO.radii.forEach(([ri, ro], i) => {
    const g = new THREE.Group(); root.add(g);
    const rb = new Builder();
    rb.add(washer(ri, ro, 0.18), [0, 0, 0], [0, 0, 0], 1, C);
    const nBlk = 10 + i * 4;
    for (let k = 0; k < nBlk; k++) {                                   // greeble: junction boxes, vents and conduits riding on the ring
      const a = Math.PI / 2 + ((k + 0.5) / nBlk) * Math.PI * 2, rr = (ri + ro) / 2, w = 0.25 + r() * 0.5;
      if (Math.abs(wrapPi(a - Math.PI / 2)) < 0.3) continue;
      rb.box(w, (ro - ri) * (0.3 + r() * 0.3), 0.08 + r() * 0.07, [Math.cos(a) * (rr + (r() - 0.5) * 0.12), Math.sin(a) * (rr + (r() - 0.5) * 0.12), 0.11], [0, 0, a + Math.PI / 2], r() < 0.2 ? HZ : D);
      if (r() < 0.6) rb.cyl(0.035, 0.035, 0.14, 10, [Math.cos(a + 0.05) * (ro - 0.06), Math.sin(a + 0.05) * (ro - 0.06), 0.1], [Math.PI / 2, 0, 0], C);
    }
    for (let k = 0; k < 72; k++) { const a = (k / 72) * Math.PI * 2; rb.box(0.06, 0.05, 0.2, [Math.cos(a) * (ro + 0.005), Math.sin(a) * (ro + 0.005), 0], [0, 0, a], D); }   // gear teeth on the rim
    g.add(new THREE.Mesh(rb.build(), i === 1 ? brass : steel));
    // engraved scale band on the front face
    const band = haloBand(RING_GLYPHS[i], 50 + i), bg = new THREE.RingGeometry(ri + 0.05, ro - 0.05, 256, 1), uv = bg.attributes.uv;
    for (let j = 0; j <= 1; j++) for (let k = 0; k <= 256; k++) uv.setXY(j * 257 + k, (k / 256) * (i + 2), 1 - j);
    band.repeat.set(1, 1);
    const U = { uGlow: { value: 0.2 }, uCol: { value: RING_COL[i].clone() } };
    const bm = new THREE.MeshStandardMaterial({ color: 0x15181c, metalness: 0.9, roughness: 0.3, emissive: 0xffffff, emissiveMap: band, bumpMap: band, bumpScale: -2 });
    bm.onBeforeCompile = (s) => { Object.assign(s.uniforms, U); s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGlow; uniform vec3 uCol;').replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = uCol * texture2D(emissiveMap, vEmissiveMapUv).r * uGlow;'); };
    const bandMesh = new THREE.Mesh(bg, bm); bandMesh.position.z = 0.092; g.add(bandMesh);
    // the glyph plate (marker) — at twelve o'clock in ring space
    const pt = glyphPlate(RING_GLYPHS[i], RING_NAMES[i]), PU = { uGlow: { value: 0.5 }, uCol: { value: RING_COL[i].clone() } };
    const pm = new THREE.MeshStandardMaterial({ color: 0x0c0d10, metalness: 0.6, roughness: 0.3, emissive: 0xffffff, emissiveMap: pt, bumpMap: pt, bumpScale: -2 });
    pm.onBeforeCompile = (s) => { Object.assign(s.uniforms, PU); s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGlow; uniform vec3 uCol;').replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = uCol * texture2D(emissiveMap, vEmissiveMapUv).r * uGlow;'); };
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.66, 0.1), [steel, steel, steel, steel, pm, steel]); plate.position.set(0, (ri + ro) / 2, 0.15); g.add(plate);
    g.rotation.z = HALO.start[i];
    rings.push({ g, ri, ro, ang: HALO.start[i], vel: 0, locked: false, auto: null, U, PU, act: 0, flash: 0, hover: 0, hot: false });
  });

  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(HALO.z + 0.1)), hit = new THREE.Vector3();
  // which ring (if any) is under this ray; also returns the polar angle of the hit for dragging
  function pick(ray) {
    if (!ray.intersectPlane(plane, hit)) return null;
    const x = hit.x, y = hit.y - HALO.y, rad = Math.hypot(x, y);
    for (let i = 0; i < 3; i++) if (rad > HALO.radii[i][0] - 0.1 && rad < HALO.radii[i][1] + 0.1) return { i, a: Math.atan2(y, x), point: hit.clone() };
    return null;
  }
  function tryLock(i, T) {
    const R = rings[i]; if (R.locked) return false;
    if (Math.abs(wrapPi(R.ang)) < 0.16) { R.locked = true; R.ang = wrapPi(R.ang); R.auto = null; R.flash = 1; onLock && onLock(i, T); return true; }
    return false;
  }
  function autoAlign(i, T) { const R = rings[i]; if (R.locked || R.auto) return; R.auto = { t0: T, from: R.ang, to: R.ang - wrapPi(R.ang), dur: 1.1 + Math.abs(wrapPi(R.ang)) * 0.35 }; }
  function reset(T) { rings.forEach((R, i) => { R.locked = false; R.auto = { t0: T + i * 0.25, from: R.ang, to: HALO.start[i], dur: 2.2, noLock: true }; }); }
  const allLocked = () => rings.every((R) => R.locked);

  function update(dt, T) {
    rings.forEach((R, i) => {
      if (R.auto) {
        const k = clamp((T - R.auto.t0) / R.auto.dur); R.ang = R.auto.from + (R.auto.to - R.auto.from) * easeInOut(k);
        if (k >= 1) { const nl = R.auto.noLock; R.auto = null; if (!nl) tryLock(i, T); }
      } else if (R.locked) R.ang = damp(R.ang, 0, 14, dt);
      R.g.rotation.z = R.ang;
      R.act = damp(R.act, R.locked ? 1 : 0, 2.5, dt); R.flash = damp(R.flash, 0, 2.2, dt); R.hover = damp(R.hover, R.hot ? 1 : 0, 10, dt);
      const near = 1 - clamp(Math.abs(wrapPi(R.ang)) / 0.5);            // glyph warms up as it approaches the claw
      R.U.uGlow.value = 0.22 + 0.5 * R.hover + 1.3 * R.act + 4 * R.flash + 0.08 * Math.sin(T * 2 + i);
      R.PU.uGlow.value = 0.7 + 1.2 * near + 0.8 * R.hover + 2.4 * R.act + 6 * R.flash;
      lamps[i].material.color.copy(PAL.red).lerp(RING_COL[i], R.act).multiplyScalar(1.5 + 2.5 * R.act + 2 * near * (1 - R.act) * (0.5 + 0.5 * Math.sin(T * 14)));
    });
    G.uAct.value.set(rings[0].act, rings[1].act, rings[2].act);
    tick.material.color.copy(PAL.cyan).lerp(PAL.gold, G.uWake.value).multiplyScalar(0.5 + 1.4 * (rings[0].act + rings[1].act + rings[2].act) / 3 + 1.2 * G.uWake.value);
  }
  return { root, rings, pick, tryLock, autoAlign, reset, allLocked, update, RING_COL };
}
