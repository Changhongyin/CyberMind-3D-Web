// The cognition engine hidden behind the face: four engraved glyph drums on one spindle, each plucking a comb of
// tuned reeds (a music-box mind), a lotus-caged seed crystal on top, a cooling turbine below and a memory spine behind.
// Everything in this file is code-built geometry and shaders.
import * as THREE from 'three';
import { Builder, rng, damp, clamp, easeInOut, GLSL_NOISE } from './util.js';
import { G, HUES, hullMaterial, glow, std } from './materials.js';
import { DRUM_GLYPHS, glyphBand } from './textures.js';

export const CIRCUIT_GLSL = /* glsl */`
float circuitCell(vec2 p, out float flow){
  vec2 c = floor(p), f = fract(p); float h = hash21(c + 0.37); float w = 0.075;
  float lh = 1.0 - smoothstep(w * 0.5, w, abs(f.y - 0.5)), lv = 1.0 - smoothstep(w * 0.5, w, abs(f.x - 0.5)); float t;
  if (h < 0.38) { t = lh; flow = f.x + c.x; }
  else if (h < 0.72) { t = lv; flow = f.y + c.y; }
  else if (h < 0.90) { t = max(lh * step(f.x, 0.5 + w), lv * step(0.5 - w, f.y)); flow = f.x + f.y + c.x + c.y; }
  else { float d = length(f - 0.5); t = max(smoothstep(0.24, 0.21, d) * smoothstep(0.10, 0.13, d), max(lh, lv) * step(0.24, d)); flow = c.x + c.y; }
  return t;
}
// returns x = trace mask, y = travelling pulse along traces
vec2 circuit(vec2 p, float time){
  float f1, f2; float a = circuitCell(p, f1); float b = circuitCell(p * 3.0 + 11.3, f2) * 0.55;
  float pulse = a * smoothstep(0.86, 1.0, sin(f1 * 1.9 - time * 2.3 + hash21(floor(p)) * 6.28)) + b * smoothstep(0.93, 1.0, sin(f2 * 1.3 - time * 3.1));
  return vec2(max(a, b), pulse);
}`;

export function buildEngine({ onStep }) {
  const root = new THREE.Group(); root.name = 'engine';
  const R = 0.95, HD = 0.56, PITCH = 0.78, Y0 = -1.45, RC = 0.86, N = 4;
  const r = rng(1207);
  const brass = hullMaterial({ color: 0xc09a52, metalness: 1, roughness: 0.3, object: true, panel: 5.0, bump: 0.45, grime: 0.35, key: 'brass' });
  const steel = hullMaterial({ color: 0x2a2f37, metalness: 0.9, roughness: 0.42, object: true, panel: 3.0, bump: 0.6, grime: 0.4, key: 'steel' });
  const reedU = { uPluckT: { value: new THREE.Vector4(-10, -10, -10, -10) } };
  const pickables = [], drums = [], drumMats = [];
  const st = { step: [0, 3, 5, 6], ang: [0, 0, 0, 0], vel: [0, 0, 0, 0], lastUser: -100, nextAuto: 3, auto: rng(99), lotus: 0 };

  // ---- spindle + static frame --------------------------------------------------------------------------------
  const fb = new Builder(), bb = new Builder();
  const STEEL = [1, 1, 1], DARK = [0.55, 0.57, 0.62], HAZ = [1.0, 0.62, 0.12];
  bb.cyl(0.11, 0.11, 4.9, 24, [0, -0.15, 0]);
  const yTop = Y0 + PITCH * (N - 1) + HD / 2 + 0.16, yBot = Y0 - HD / 2 - 0.34;
  const combAng = [30, 90, 150, 210, 270, 330].map((d) => (d * Math.PI) / 180), RR = 1.27;
  for (const a of combAng) {
    const x = Math.sin(a) * RR, z = Math.cos(a) * RR;
    fb.box(0.075, yTop - yBot + 0.2, 0.055, [x, (yTop + yBot) / 2, z], [0, a, 0], STEEL);
    fb.box(0.11, 0.05, 0.09, [x, yTop + 0.1, z], [0, a, 0], DARK); fb.box(0.11, 0.05, 0.09, [x, yBot - 0.1, z], [0, a, 0], DARK);
    for (let k = 0; k < 9; k++) bb.cyl(0.012, 0.012, 0.07, 8, [Math.sin(a) * (RR + 0.03), yBot + 0.2 + (k / 8) * (yTop - yBot - 0.4), Math.cos(a) * (RR + 0.03)], [Math.PI / 2, a, 0]);   // bolt heads
  }
  fb.torus(RR, 0.028, [0, yTop + 0.1, 0], [Math.PI / 2, 0, 0], STEEL, 96, 10); fb.torus(RR, 0.028, [0, yBot - 0.1, 0], [Math.PI / 2, 0, 0], STEEL, 96, 10);
  fb.torus(RR - 0.02, 0.012, [0, yTop + 0.04, 0], [Math.PI / 2, 0, 0], HAZ, 96, 6);
  // top and bottom spiders holding the spindle
  for (let k = 0; k < 6; k++) { const a = combAng[k]; fb.rod([0, yTop + 0.3, 0], [Math.sin(a) * RR, yTop + 0.1, Math.cos(a) * RR], 0.022, STEEL); fb.rod([0, yBot - 0.3, 0], [Math.sin(a) * RR, yBot - 0.1, Math.cos(a) * RR], 0.026, STEEL); }
  bb.cyl(0.2, 0.26, 0.16, 32, [0, yTop + 0.3, 0]); bb.cyl(0.26, 0.2, 0.2, 32, [0, yBot - 0.3, 0]);

  // ---- drums -------------------------------------------------------------------------------------------------
  const pinGeo = new THREE.CylinderGeometry(0.011, 0.014, 0.06, 6).rotateX(Math.PI / 2).translate(0, 0, 0.03);
  const reedGeo = new THREE.BoxGeometry(1, 1, 1, 6, 1, 1).translate(0.5, 0, 0);
  const reedCount = N * combAng.length * 8;
  const reedMat = new THREE.MeshStandardMaterial({ color: 0x9fb4c8, metalness: 1, roughness: 0.22 });
  reedMat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, reedU, { uTime: G.uTime });
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aReed; uniform vec4 uPluckT; uniform float uTime;')
      .replace('#include <begin_vertex>', /* glsl */`#include <begin_vertex>
        { float tp = uTime - uPluckT[int(aReed.x)] - aReed.y * 0.42; float amp = tp > 0.0 ? exp(-tp * 2.6) * sin(tp * (48.0 + aReed.y * 70.0)) : 0.0;
          transformed.y += amp * 5.5 * position.x * position.x; }`);
  };
  const reeds = new THREE.InstancedMesh(reedGeo, reedMat, reedCount); reeds.name = 'reeds';
  const aReed = new Float32Array(reedCount * 2); let ri = 0; const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();

  for (let i = 0; i < N; i++) {
    const yc = Y0 + (N - 1 - i) * PITCH, g = new THREE.Group(); g.position.y = yc; root.add(g);
    const band = glyphBand(DRUM_GLYPHS[i], 40 + i);
    const U = { uGlow: { value: 0.1 }, uGlowCol: { value: new THREE.Color(1, 0.75, 0.4) } };
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a3a26, metalness: 1, roughness: 0.36, bumpMap: band, bumpScale: -3.0, emissive: 0xffffff, emissiveMap: band });
    mat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, U);
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying float vFront;')
        .replace('#include <project_vertex>', 'vFront = normalize(mat3(modelMatrix) * objectNormal).z;\n#include <project_vertex>');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFront; uniform float uGlow; uniform vec3 uGlowCol;')
        .replace('#include <emissivemap_fragment>', /* glsl */`
          float gm = texture2D(emissiveMap, vEmissiveMapUv).r; float front = smoothstep(0.80, 0.985, vFront);
          diffuseColor.rgb *= 1.0 - 0.55 * gm;
          totalEmissiveRadiance = uGlowCol * gm * uGlow * (0.14 + 1.6 * front);`);
    };
    const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, HD, 160, 1, true), mat); body.userData.drum = i; g.add(body); pickables.push(body); drumMats.push({ mat, U });
    // trim: rims, toothed crown, spoked caps, pin collar
    const tb = new Builder();
    tb.torus(R + 0.004, 0.022, [0, HD / 2, 0], [Math.PI / 2, 0, 0], [1, 1, 1], 128, 10); tb.torus(R + 0.004, 0.022, [0, -HD / 2, 0], [Math.PI / 2, 0, 0], [1, 1, 1], 128, 10);
    for (let k = 0; k < 96; k++) { const a = (k / 96) * Math.PI * 2; tb.box(0.03, 0.045, 0.05, [Math.sin(a) * (R + 0.02), HD / 2 + 0.035, Math.cos(a) * (R + 0.02)], [0, a, 0], [0.9, 0.86, 0.8]); }
    for (const sy of [1, -1]) {
      tb.add(new THREE.RingGeometry(R - 0.16, R, 96, 1), [0, sy * (HD / 2 - 0.005), 0], [-sy * Math.PI / 2, 0, 0], 1, [0.8, 0.78, 0.74]);
      tb.cyl(0.24, 0.24, 0.05, 32, [0, sy * (HD / 2 - 0.02), 0], [0, 0, 0], [0.9, 0.9, 0.9]);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + i * 0.4; tb.box(0.05, 0.03, R - 0.3, [Math.sin(a) * (R / 2 + 0.03), sy * (HD / 2 - 0.02), Math.cos(a) * (R / 2 + 0.03)], [0, a, 0], [0.85, 0.82, 0.78]); }
    }
    tb.cyl(RC, RC, PITCH - HD + 0.02, 96, [0, -HD / 2 - (PITCH - HD) / 2, 0], [0, 0, 0], [0.42, 0.40, 0.44], true);
    tb.add(new THREE.CylinderGeometry(R - 0.05, R - 0.05, HD - 0.02, 64, 1, true).scale(-1, 1, 1), [0, 0, 0], [0, 0, 0], 1, [0.3, 0.28, 0.26]);     // inner liner (seen through spokes)
    g.add(new THREE.Mesh(tb.build(), brass));
    // music-box pins on the collar
    const cols = 48, rows = 8, pm = [];
    for (let c = 0; c < cols; c++) for (let w = 0; w < rows; w++) if (r() < 0.3) pm.push([c, w]);
    const pins = new THREE.InstancedMesh(pinGeo, brass, pm.length);
    pm.forEach(([c, w], k) => { const a = (c / cols) * Math.PI * 2; E.set(0, a, 0); Q.setFromEuler(E); V.set(Math.sin(a) * RC, -HD / 2 - 0.035 - w * 0.019, Math.cos(a) * RC); M.compose(V, Q, S.set(1, 1, 1)); pins.setMatrixAt(k, M); });
    g.add(pins);
    drums.push(g);
    // reading frame at the front of each drum + reed combs (static)
    const zf = R + 0.07, fw = 0.33, fh = 0.25;
    for (const sx of [-1, 1]) { fb.box(0.022, fh * 2 + 0.03, 0.022, [sx * fw, yc, zf], [0, 0, 0], HAZ); fb.rod([sx * fw, yc, zf], [Math.sin(combAng[sx > 0 ? 0 : 5]) * RR, yc, Math.cos(combAng[0]) * RR], 0.012, STEEL); }
    for (const sy of [-1, 1]) fb.box(fw * 2 + 0.022, 0.022, 0.022, [0, yc + sy * fh, zf], [0, 0, 0], HAZ);
    bb.cyl(0.03, 0.03, 0.02, 16, [0, yc + fh + 0.03, zf], [Math.PI / 2, 0, 0]);
    combAng.forEach((a, ci) => {
      const yk = yc - HD / 2 - (PITCH - HD) / 2;
      fb.box(0.1, 0.19, 0.16, [Math.sin(a) * (RR - 0.07), yk, Math.cos(a) * (RR - 0.07)], [0, a, 0], DARK);
      for (let t = 0; t < 8; t++) {
        const len = 0.12 + 0.02 * t + 0.01 * ((ci + i) % 3), tipR = RC + 0.068, y = yk + 0.066 - t * 0.019;
        // local +x of the reed points inward (from root to tip), local y (bending axis) is tangential
        E.set(0, a + Math.PI / 2, 0); Q.setFromEuler(E);
        V.set(Math.sin(a) * (tipR + len), y, Math.cos(a) * (tipR + len)); M.compose(V, Q, S.set(len, 0.005, 0.013));
        reeds.setMatrixAt(ri, M); aReed[ri * 2] = i; aReed[ri * 2 + 1] = ((t * 5 + ci * 3) % 8) / 8; ri++;
      }
    });
  }
  reedGeo.setAttribute('aReed', new THREE.InstancedBufferAttribute(aReed, 2)); root.add(reeds);
  root.add(new THREE.Mesh(fb.build(), steel)); root.add(new THREE.Mesh(bb.build(), brass));

  // ---- lotus cage + seed crystal -----------------------------------------------------------------------------
  const top = new THREE.Group(); top.position.y = yTop + 0.5; root.add(top);
  const petalGeo = (() => {
    const g = new THREE.PlaneGeometry(1, 1, 6, 12).translate(0, 0.5, 0), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i); const w = Math.sin(Math.pow(y, 0.7) * Math.PI) * 0.5 + 0.06 * (1 - y); p.setX(i, x * w * 2); p.setZ(i, -0.55 * (x * w * 2) * (x * w * 2) + 0.22 * Math.sin(y * 2.4) ); }
    g.computeVertexNormals(); return g;
  })();
  const petalMat = new THREE.MeshPhysicalMaterial({ color: 0xbfb8a8, metalness: 0.0, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0 });
  const petals = [];
  for (let ring = 0; ring < 2; ring++) for (let k = 0; k < 8; k++) {
    const piv = new THREE.Group(), a = (k / 8) * Math.PI * 2 + ring * Math.PI / 8, rad = 0.2 + ring * 0.05;
    piv.position.set(Math.sin(a) * rad, -0.2 - ring * 0.03, Math.cos(a) * rad); piv.rotation.y = a;
    const m = new THREE.Mesh(petalGeo, petalMat); m.scale.set(0.34 + ring * 0.05, 0.62 + ring * 0.1, 0.4); piv.add(m); top.add(piv); petals.push({ m, ring });
  }
  const cup = new Builder(); cup.cyl(0.3, 0.2, 0.12, 32, [0, -0.28, 0]); cup.cyl(0.14, 0.16, 0.2, 24, [0, -0.42, 0]); cup.torus(0.3, 0.02, [0, -0.22, 0], [Math.PI / 2, 0, 0], [1, 1, 1], 48, 8);
  top.add(new THREE.Mesh(cup.build(), brass));
  const seedU = { uGlow: { value: 0 }, uHue: G.uHue, uTime: G.uTime };
  const seedMat = new THREE.ShaderMaterial({
    uniforms: seedU, toneMapped: false,
    vertexShader: /* glsl */`varying vec3 vV; varying vec3 vO; void main(){ vO = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`varying vec3 vV; varying vec3 vO; uniform float uGlow; uniform vec3 uHue; uniform float uTime;
      ${GLSL_NOISE}
      void main(){ vec3 n = normalize(cross(dFdx(vV), dFdy(vV))); vec3 v = normalize(-vV); float ndv = abs(dot(n, v)); float fres = pow(1.0 - ndv, 2.2);
        vec3 rf = refract(-v, n, 0.62); float inner = vnoise3(vO * 9.0 + rf * 2.5 + uTime * 0.35); float vein = smoothstep(0.55, 0.9, vnoise3(vO * 22.0 - uTime * 0.2 + inner));
        vec3 base = vec3(0.035, 0.04, 0.05) + vec3(0.5, 0.55, 0.6) * pow(1.0 - ndv, 4.0);
        vec3 col = base + uHue * uGlow * (0.5 + 2.6 * fres + 3.5 * vein * inner + 1.6 * pow(ndv, 6.0));
        gl_FragColor = vec4(col, 1.0); }`,
  });
  const seed = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0).scale(1, 1.75, 1), seedMat); seed.userData.hot = 'seed'; top.add(seed); pickables.push(seed);
  const gim = [0.44, 0.38, 0.32].map((rad, k) => { const m = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.011, 8, 96), brass); m.userData.ax = k; top.add(m); return m; });
  const seedLight = new THREE.PointLight(0xffb060, 0, 14, 1.8); top.add(seedLight);

  // ---- turbine base ------------------------------------------------------------------------------------------
  const base = new THREE.Group(); base.position.y = yBot - 0.55; root.add(base);
  const tbb = new Builder();
  for (let k = 0; k < 44; k++) { const a = (k / 44) * Math.PI * 2; tbb.box(0.016, 0.2, 0.72, [Math.sin(a) * 0.66, 0, Math.cos(a) * 0.66], [0.0, a, 0.5], [0.8, 0.82, 0.86]); }
  tbb.cyl(0.3, 0.3, 0.22, 32, [0, 0, 0], [0, 0, 0], [0.6, 0.6, 0.62]);
  const turb = new THREE.Mesh(tbb.build(), steel); base.add(turb);
  const hb = new Builder(); hb.cyl(1.06, 1.06, 0.3, 96, [0, 0, 0], [0, 0, 0], [0.8, 0.8, 0.8], true); hb.torus(1.06, 0.035, [0, 0.15, 0], [Math.PI / 2, 0, 0], [1, 1, 1], 96, 8); hb.torus(1.06, 0.035, [0, -0.15, 0], [Math.PI / 2, 0, 0], [1, 1, 1], 96, 8);
  hb.cyl(1.04, 0.5, 0.5, 64, [0, -0.42, 0], [0, 0, 0], [0.7, 0.7, 0.72], true);
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; hb.box(0.05, 0.3, 0.03, [Math.sin(a) * 1.085, 0, Math.cos(a) * 1.085], [0, a, 0], k % 4 ? [0.7, 0.7, 0.7] : [1.0, 0.62, 0.12]); }
  const hbM = hullMaterial({ color: 0x2a2f37, metalness: 0.9, roughness: 0.42, object: true, panel: 3.0, side: THREE.DoubleSide, key: 'steelDS' });
  base.add(new THREE.Mesh(hb.build(), hbM));
  const ventMat = glow(0xff9a3c, 0.0); const vent = new THREE.Mesh(new THREE.CircleGeometry(1.0, 64).rotateX(-Math.PI / 2), ventMat); vent.position.y = -0.16; base.add(vent);

  // ---- memory spine: curved circuit wall with blinking cells behind the drums ---------------------------------
  const spineU = { uTime: G.uTime, uWake: G.uWake, uHue: G.uHue, uAct: G.uAct };
  const spineMat = new THREE.MeshStandardMaterial({ color: 0x0c0f13, metalness: 0.75, roughness: 0.38, side: THREE.DoubleSide });
  spineMat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, spineU);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vSp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSp = uv;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec2 vSp; uniform float uTime; uniform float uWake; uniform vec3 uHue; uniform vec3 uAct;\n${GLSL_NOISE}\n${CIRCUIT_GLSL}`)
      .replace('#include <emissivemap_fragment>', /* glsl */`
        vec2 sp = vSp * vec2(28.0, 34.0); vec2 cc = circuit(sp, uTime);
        float rib = smoothstep(0.46, 0.5, abs(fract(vSp.y * 17.0) - 0.5));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.40, 0.16), cc.x * 0.85) * (1.0 - 0.6 * rib);
        float on = max(uWake, uAct.x * 0.45);
        totalEmissiveRadiance = (vec3(0.9, 0.6, 0.25) * cc.x * 0.05 + mix(vec3(0.2, 0.9, 1.0), uHue, uWake) * cc.y * 1.1) * on;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.22, circuit(vSp * vec2(28.0, 34.0), 0.0).x);');
  };
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.62, 4.1, 64, 1, true, Math.PI - 1.0, 2.0), spineMat); spine.position.y = -0.2; spine.userData.hot = 'spine'; root.add(spine); pickables.push(spine);
  const sb = new Builder();
  for (const a of [Math.PI - 1.0, Math.PI + 1.0]) sb.box(0.07, 4.2, 0.1, [Math.sin(a) * 1.62, -0.2, Math.cos(a) * 1.62], [0, a, 0], [1, 1, 1]);
  for (let k = 0; k < 6; k++) sb.torus(1.63, 0.022, [0, -2.2 + k * 0.8, 0], [Math.PI / 2, 0, -Math.PI / 2 - 1.0], [1, 1, 1], 48, 8, 2.0);
  root.add(new THREE.Mesh(sb.build(), steel));
  // memory cells: tiny lamps on the spine, blinking in address order
  const cellN = 22 * 30, cellGeo = new THREE.BoxGeometry(0.035, 0.018, 0.012), cellSeed = new Float32Array(cellN);
  const cellMat = new THREE.ShaderMaterial({
    uniforms: spineU, toneMapped: false,
    vertexShader: /* glsl */`attribute float aS; varying float vS; void main(){ vS = aS; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`varying float vS; uniform float uTime; uniform float uWake; uniform vec3 uHue; uniform vec3 uAct;
      void main(){ float on = max(uWake, uAct.x * 0.6); float b = step(0.72 - 0.4 * uWake, fract(sin(floor(uTime * (2.0 + 6.0 * fract(vS * 7.7))) * 12.9898 + vS * 78.233) * 43758.5453));
        float sweep = smoothstep(0.92, 1.0, sin(vS * 40.0 - uTime * 4.0));
        vec3 c = mix(vec3(0.15, 0.85, 1.0), uHue, 0.75 * uWake) * (0.04 + on * (b * 2.6 + sweep * 3.0)); gl_FragColor = vec4(c, 1.0); }`,
  });
  const cells = new THREE.InstancedMesh(cellGeo, cellMat, cellN); let ck = 0;
  for (let cx = 0; cx < 22; cx++) for (let cy = 0; cy < 30; cy++) { const a = Math.PI - 0.9 + (cx / 21) * 1.8; E.set(0, a, 0); Q.setFromEuler(E); V.set(Math.sin(a) * 1.6, -2.05 + cy * 0.128 + (cx % 2) * 0.03, Math.cos(a) * 1.6); M.compose(V, Q, S.set(1, 1, 1)); cells.setMatrixAt(ck, M); cellSeed[ck] = (cx * 30 + cy) / cellN; ck++; }
  cellGeo.setAttribute('aS', new THREE.InstancedBufferAttribute(cellSeed, 1)); root.add(cells);
  const coreLight = new THREE.PointLight(0xffa050, 0, 18, 1.6); coreLight.position.set(0.4, 0.2, 2.6); root.add(coreLight);

  function stepDrum(i, dir, T, user) {
    st.step[i] += dir; reedU.uPluckT.value.setComponent(i, T); if (user) st.lastUser = T;
    onStep && onStep(i, ((st.step[i] % 8) + 8) % 8, user);
  }
  const line = () => st.step.map((s, i) => DRUM_GLYPHS[i][((s % 8) + 8) % 8]);
  const index = () => st.step.reduce((a, s, i) => a + (((s % 8) + 8) % 8) * Math.pow(8, 3 - i), 0);

  for (let i = 0; i < N; i++) st.ang[i] = -(st.step[i] + 0.5) * Math.PI / 4;

  function update(dt, T, wake) {
    for (let i = 0; i < N; i++) {              // sprung detent: a mechanical click with a small overshoot
      const target = -(st.step[i] + 0.5) * Math.PI / 4, acc = 260 * (target - st.ang[i]) - 19 * st.vel[i];
      st.vel[i] += acc * dt; st.ang[i] += st.vel[i] * dt; drums[i].rotation.y = st.ang[i];
      const since = T - reedU.uPluckT.value.getComponent(i);
      drumMats[i].U.uGlow.value = 0.06 + wake * (1.0 + 0.9 * Math.exp(-since * 2.2));
      drumMats[i].U.uGlowCol.value.copy(G.uHue.value).lerp(new THREE.Color(1, 0.82, 0.55), 0.55);
    }
    if (wake > 0.97 && T > st.nextAuto && T - st.lastUser > 9) {   // the mind keeps turning thoughts over when left alone
      stepDrum(Math.floor(st.auto() * 4), st.auto() < 0.8 ? 1 : -1, T, false); st.nextAuto = T + 1.5 + st.auto() * 1.9;
    }
    if (wake < 0.9) st.nextAuto = T + 2.2;
    st.lotus = damp(st.lotus, wake, 2.2, dt);
    const o = easeInOut(clamp(st.lotus));
    for (const p of petals) p.m.rotation.x = 0.1 + o * (0.95 + p.ring * 0.38) + Math.sin(T * 0.9 + p.ring) * 0.015 * o;
    seed.position.y = 0.12 + o * 0.22 + Math.sin(T * 1.3) * 0.012; seed.rotation.y = T * (0.15 + 0.5 * o);
    seedU.uGlow.value = 0.05 + 1.5 * o + 0.25 * o * Math.sin(T * 2.1);
    gim.forEach((m, k) => { const sp = (0.08 + 0.7 * o) * (k % 2 ? -1 : 1); m.position.y = seed.position.y; m.rotation.set(T * sp * (k === 0 ? 1 : 0.3) + k, T * sp * (k === 1 ? 1 : 0.4) + k * 2.0, T * sp * (k === 2 ? 1 : 0.2)); });
    seedLight.color.copy(G.uHue.value); seedLight.intensity = 2.0 * o; seedLight.position.y = seed.position.y;
    coreLight.color.copy(G.uHue.value).lerp(new THREE.Color(1, 0.7, 0.4), 0.5); coreLight.intensity = 9 * o;
    turb.rotation.y += dt * (0.15 + 2.4 * o);
    ventMat.color.copy(G.uHue.value).lerp(new THREE.Color(1, 0.5, 0.15), 0.6).multiplyScalar(0.02 + 2.2 * o);
  }

  return { root, update, stepDrum, pickables, drums, line, index, st, seed, top, yTop, yBot, R };
}
