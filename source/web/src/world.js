// Well-09 and the city of Wugang around it. All geometry, shaders and motion here are code-built, except the two
// Lux3D-generated props that are placed into it: the bronze censer on the deck and the lantern drones.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Builder, rng, damp, clamp, lerp, cableCurve, GLSL_NOISE } from './util.js';
import { G, PAL, hullMaterial, glow } from './materials.js';
import { signAtlas, talismanAtlas, consoleScreen, softDot, SIGNS } from './textures.js';
import { HALO } from './halo.js';

export const WELL = { pierR: 31, piers: 12, waterY: -11, deckY: -4.25, deckR: [3.3, 6.3] };
const FOG_GLSL = /* glsl */`float fogF(float d, float k){ return 1.0 - exp(-k * k * d * d); }`;

export function buildWorld({ renderer, scene, camera, censer, drone, S }) {
  const r = rng(2187), pickables = [], updaters = [], M = new THREE.Matrix4(), Qt = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), Sc = new THREE.Vector3(1, 1, 1);
  const root = new THREE.Group(); root.name = 'world'; scene.add(root);
  const fogCol = new THREE.Color(0x0a1118); scene.fog = new THREE.FogExp2(fogCol.getHex(), 0.0105);
  scene.background = new THREE.Color(0x020305);
  const UF = { uFogCol: { value: scene.fog.color }, uTime: G.uTime, uWake: G.uWake, uAct: G.uAct, uHue: G.uHue, uCam: G.uCam, uRainT: G.uRainT, uRainV: G.uRainV, uShock: G.uShock };

  // ---------------------------------------------------------------- environment light (code-built studio for reflections)
  {
    const es = new THREE.Scene(); es.background = new THREE.Color(0x05080c);
    const add = (w, h, col, I, pos) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(I), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(0, 0, 0); es.add(m); };
    add(14, 5, 0x9fd8ff, 5, [0, 12, 4]); add(3, 14, 0xff2e88, 4.5, [-13, 2, -5]); add(3, 14, 0x35e6ff, 4.5, [13, 1, -6]); add(10, 2, 0xffa63d, 3.5, [0, -4, 12]);
    add(2, 2, 0xffffff, 12, [6, 6, 10]); add(1.2, 6, 0xffffff, 7, [-8, 5, 9]); add(18, 6, 0x16202c, 1.5, [0, -10, 0]); add(6, 1, 0x7dffcf, 4, [9, 9, -9]);
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, 0.03).texture; scene.environmentIntensity = 0.75; pm.dispose();
  }
  const hemi = new THREE.HemisphereLight(0x4a6078, 0x1a1410, 1.0); scene.add(hemi);
  const key = new THREE.SpotLight(0xe8eeff, 2700, 90, 0.42, 0.55, 1.6); key.position.set(7, 26, 19); key.target.position.set(0, -0.5, 0); scene.add(key, key.target);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 8; key.shadow.camera.far = 60; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  const rimM = new THREE.SpotLight(0xff2e88, 620, 80, 0.5, 0.7, 1.6); rimM.position.set(-19, 5, -13); rimM.target.position.set(0, 0.5, 0); scene.add(rimM, rimM.target);
  const rimC = new THREE.SpotLight(0x35e6ff, 620, 80, 0.5, 0.7, 1.6); rimC.position.set(20, 1, -10); rimC.target.position.set(0, 0, 0); scene.add(rimC, rimC.target);
  const under = new THREE.PointLight(0x2fe6c8, 60, 30, 1.8); under.position.set(0, -8.5, 5); scene.add(under);
  const fill = new THREE.SpotLight(0xffe2c0, 520, 60, 0.36, 0.8, 1.6); fill.position.set(5, 3.5, 24); fill.target.position.set(0, 0.6, 0); scene.add(fill, fill.target);

  const hull = hullMaterial({ color: 0x2b3037, metalness: 0.78, roughness: 0.52, panel: 0.42, bump: 1.0, grime: 0.75, key: 'wall', patch: (s) => {
    // painted-on practical lighting: each ledge washes the pier face below it (cheap stand-in for ~130 real lamps)
    s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', /* glsl */`#include <emissivemap_fragment>
      { float lvl = (vHullP.y + 14.0) / 6.5; float fr = fract(lvl), id = floor(lvl);
        float down = exp(-(1.0 - fr) * 2.2) * smoothstep(1.0, 0.95, fr); float inner = smoothstep(29.6, 27.4, length(vHullP.xz));
        vec3 wc = mod(id, 2.0) < 0.5 ? vec3(0.10, 0.55, 0.65) : vec3(0.80, 0.34, 0.10); wc = mix(wc, vec3(0.95, 0.45, 0.18), 0.55 * uWake);
        float nn = 0.55 + 0.45 * vnoise(vec2(atan(vHullP.x, vHullP.z) * 46.0, id * 3.1));
        totalEmissiveRadiance += diffuseColor.rgb * wc * down * inner * nn * (16.0 + 8.0 * uWake); }`); } });
  const hullFine = hullMaterial({ color: 0x30353d, metalness: 0.85, roughness: 0.45, panel: 1.3, bump: 0.9, grime: 0.55, key: 'fine' });
  const C = [1, 1, 1], D = [0.62, 0.64, 0.68], DK = [0.36, 0.37, 0.4], HZ = [1.0, 0.62, 0.12], RD = [0.75, 0.16, 0.12], BR = [0.9, 0.68, 0.36];

  // ---------------------------------------------------------------- sky dome
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: UF,
    vertexShader: /* glsl */`varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: /* glsl */`varying vec3 vD; uniform float uTime; uniform float uWake; uniform vec3 uHue;
      ${GLSL_NOISE}
      void main(){ vec3 d = normalize(vD); float h = d.y;
        vec3 zen = mix(vec3(0.006, 0.010, 0.018), vec3(0.016, 0.010, 0.022), uWake);
        vec3 hor = mix(vec3(0.050, 0.125, 0.155), vec3(0.22, 0.075, 0.13), uWake);
        vec3 c = mix(hor, zen, smoothstep(-0.02, 0.62, h)); c += mix(vec3(0.13, 0.06, 0.03), vec3(0.24, 0.11, 0.04), uWake) * exp(-abs(h) * 7.0);    // sodium haze on the horizon
        vec2 uv = d.xz / (abs(h) + 0.22); float cl = fbm(uv * 1.6 + vec2(uTime * 0.008, 0.0)); cl = smoothstep(0.42, 0.78, cl);
        c += cl * mix(vec3(0.020, 0.036, 0.046), vec3(0.085, 0.032, 0.058), uWake) * smoothstep(-0.05, 0.3, h) * (1.4 - h);
        gl_FragColor = vec4(c, 1.0); }`,
  })); sky.renderOrder = -10; sky.frustumCulled = false; root.add(sky);

  // ---------------------------------------------------------------- city: instanced towers with procedural windows
  {
    const N = 560, geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), aS = new Float32Array(N * 4);
    const mat = new THREE.ShaderMaterial({
      uniforms: UF, fog: false,
      vertexShader: /* glsl */`attribute vec4 aS; varying vec3 vL; varying vec3 vN; varying vec3 vW; varying vec4 vS; varying vec3 vSz;
        void main(){ vS = aS; vL = position; vN = normal; vSz = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`varying vec3 vL; varying vec3 vN; varying vec3 vW; varying vec4 vS; varying vec3 vSz; uniform float uTime; uniform float uWake; uniform vec3 uHue; uniform vec3 uCam; uniform float uShock;
        ${GLSL_NOISE} ${FOG_GLSL}
        void main(){
          vec3 n = abs(vN); vec2 f = n.x > 0.5 ? vec2(vL.z * vSz.z, vL.y * vSz.y) : vec2(vL.x * vSz.x, vL.y * vSz.y);
          float top = step(0.5, n.y);
          vec2 cs = vec2(1.05 + vS.x * 0.7, 2.9); vec2 cell = floor(f / cs), g = fract(f / cs); vec2 unit = floor(vec2(cell.x / 2.0, cell.y));
          float dist = length(vW.xz); float wave = clamp(uWake * 1.6 - dist / 620.0, 0.0, 1.0);               // the lit-window wave spreads outward from the well
          float rnd = hash21(unit + vS.y * 91.0); float floorRnd = hash11(cell.y + vS.y * 13.0); float rnd2 = hash21(cell + vS.z * 17.0);
          float thr = mix(0.86, 0.60, wave) - 0.3 * step(0.9, floorRnd);
          float rib = step(0.5, mod(cell.x, 7.0)) ;
          float lit = step(thr, rnd) * step(0.22, rnd2) * (0.35 + 0.65 * hash21(unit * 2.1 + 5.0)) * rib * step(0.13, g.x) * step(g.x, 0.87) * step(0.30, g.y) * step(g.y, 0.80);
          float fw = max(fwidth(f.x), fwidth(f.y)) / cs.x; lit *= 1.0 - smoothstep(0.35, 0.9, fw); float far = smoothstep(0.35, 0.9, fw) * (1.0 - thr) * 0.5;
          vec3 wc = mix(vec3(1.0, 0.72, 0.38), vec3(0.55, 0.85, 1.0), step(0.62, hash21(cell * 1.7 + vS.z * 7.0)));
          wc = mix(wc, uHue, 0.35 * wave * step(0.7, hash11(vS.w * 31.0 + cell.y)));
          float flick = 0.75 + 0.25 * step(0.02, fract(rnd * 31.0 + uTime * 0.05));
          float slab = step(g.y, 0.10) * (1.0 - smoothstep(0.2, 0.6, fw));
          vec3 col = vec3(0.012, 0.016, 0.022) * (0.6 + 0.6 * n.x) * (1.0 + 1.4 * slab) * (0.55 + 0.45 * rib) + wc * (lit + far * 0.6) * mix(0.5, 0.9, wave) * flick * (1.0 - top);
          float band = step(0.965, fract(vL.y * vSz.y / 41.0 + vS.z)); col += mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.2, 0.5), step(0.5, vS.w)) * band * 0.7 * (0.3 + wave) * (1.0 - top);
          col += vec3(1.0, 0.1, 0.06) * top * step(0.5, fract(uTime * 0.5 + vS.x)) * 0.25;
          float fd = distance(vW, uCam); vec3 hz = mix(vec3(0.040, 0.100, 0.125), vec3(0.18, 0.065, 0.11), uWake) * (1.0 + 0.5 * exp(-max(vW.y, 0.0) / 60.0));
          col = mix(col, hz, clamp(fogF(fd, 0.0030) * 0.92 + 0.03, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0); }`,
    });
    const city = new THREE.InstancedMesh(geo, mat, N); city.frustumCulled = false;
    for (let i = 0; i < N; i++) {
      const band = i < 170 ? 0 : i < 340 ? 1 : 2, rad = [r.range(78, 140), r.range(140, 280), r.range(280, 600)][band], a = r() * Math.PI * 2;
      const w = r.range(9, 24) * (1 + band * 0.6), d = r.range(9, 24) * (1 + band * 0.6), h = [r.range(60, 170), r.range(90, 260), r.range(140, 440)][band] * (r() < 0.12 ? 1.5 : 1);
      E.set(0, a + r.range(-0.4, 0.4), 0); Qt.setFromEuler(E); M.compose(V.set(Math.sin(a) * rad, -70, Math.cos(a) * rad), Qt, Sc.set(w, h, d)); city.setMatrixAt(i, M);
      aS.set([r(), r(), r(), r()], i * 4);
    }
    geo.setAttribute('aS', new THREE.InstancedBufferAttribute(aS, 4)); root.add(city);

    // neon signs hung on the nearer towers and around the well mouth
    const SN = 120, sg = new THREE.PlaneGeometry(1, 1), aC = new Float32Array(SN * 3);
    const smat = new THREE.ShaderMaterial({
      uniforms: { ...UF, tMap: { value: signAtlas() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: /* glsl */`attribute vec3 aC; varying vec2 vUv; varying vec3 vC; varying vec3 vW; void main(){ vC = aC; vUv = (uv * vec2(0.36, 1.0) + vec2(0.32, 0.0) + vec2(mod(aC.x, 4.0), 3.0 - floor(aC.x / 4.0))) / 4.0; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`uniform sampler2D tMap; uniform float uTime; uniform float uWake; uniform vec3 uCam; varying vec2 vUv; varying vec3 vC; varying vec3 vW; ${FOG_GLSL}
        void main(){ vec3 t = texture2D(tMap, vUv).rgb; float fl = step(0.08, fract(sin(floor(uTime * 9.0) * 12.9 + vC.y * 78.2) * 43758.5)) * 0.25 + 0.75; fl *= mix(1.0, step(0.5, fract(uTime * 0.7 + vC.y)), step(0.86, vC.y));
          float d = distance(vW, uCam); gl_FragColor = vec4(t * t * (1.6 + 1.9 * uWake) * fl * vC.z * (1.0 - fogF(d, 0.0034)), 1.0); }`,
    });
    const signs = new THREE.InstancedMesh(sg, smat, SN); signs.frustumCulled = false; signs.renderOrder = 2;
    for (let i = 0; i < SN; i++) {
      const near = i < 26, a = near ? ((Math.floor(r() * WELL.piers) + 0.5 + r.sign() * 0.34) / WELL.piers) * Math.PI * 2 : r() * Math.PI * 2, rad = near ? WELL.pierR + r.range(-1.5, 3.5) : r.range(60, 230), h = near ? r.range(5.5, 9.5) : r.range(14, 46);
      E.set(0, a + (near ? Math.PI : Math.PI + r.range(-0.7, 0.7)), 0); Qt.setFromEuler(E); M.compose(V.set(Math.sin(a) * rad, near ? r.range(-2, 30) : r.range(-20, 150), Math.cos(a) * rad), Qt, Sc.set(h * 0.36, h, 1)); signs.setMatrixAt(i, M);
      aC.set([Math.floor(r() * 16), r(), near ? 1.0 : 1.5], i * 3);
    }
    sg.setAttribute('aC', new THREE.InstancedBufferAttribute(aC, 3)); root.add(signs);

    // air traffic: small lights circling between the towers
    const TN = 260, tg = new THREE.PlaneGeometry(1, 1), aT = new Float32Array(TN * 4);
    for (let i = 0; i < TN; i++) aT.set([r.range(70, 330), r.range(-10, 150), r() * 6.283, (r.sign()) * r.range(0.012, 0.05)], i * 4);
    tg.setAttribute('aT', new THREE.InstancedBufferAttribute(aT, 4));
    const tm = new THREE.ShaderMaterial({ uniforms: { ...UF, tDot: { value: softDot() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: /* glsl */`attribute vec4 aT; uniform float uTime; uniform float uRainV; uniform float uRainT; varying vec2 vUv; varying float vDir; void main(){ vUv = uv; vDir = sign(aT.w);
        float a = aT.z + aT.w * (uTime * 0.25 + uRainT * 0.75) ; vec3 c = vec3(sin(a) * aT.x, aT.y + sin(a * 3.0) * 6.0, cos(a) * aT.x); vec4 mv = viewMatrix * vec4(c, 1.0); mv.xy += (position.xy) * vec2(3.2, 1.3) * (1.0 + aT.x / 160.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`uniform sampler2D tDot; varying vec2 vUv; varying float vDir; void main(){ float a = texture2D(tDot, vUv).r; gl_FragColor = vec4(mix(vec3(1.0, 0.25, 0.15), vec3(0.85, 0.95, 1.0), step(0.0, vDir)) * a * 2.2, 1.0); }` });
    const traffic = new THREE.InstancedMesh(tg, tm, TN); traffic.frustumCulled = false; root.add(traffic);
  }

  // ---------------------------------------------------------------- the well: twelve piers, galleries, lintel ring
  {
    const pb = new Builder();
    pb.box(7, 76, 6, [0, 20, 0], [0, 0, 0], C);
    for (const sx of [-1, 1]) { pb.box(0.7, 76, 1.0, [sx * 2.75, 20, -3.4], [0, 0, 0], D); pb.cyl(0.24, 0.24, 76, 12, [sx * 3.25, 20, -3.75], [0, 0, 0], BR); pb.cyl(0.13, 0.13, 76, 8, [sx * 3.25 - sx * 0.5, 20, -3.95], [0, 0, 0], DK); pb.box(0.5, 76, 0.5, [sx * 3.5, 20, 3.0], [0, 0, 0], D); }
    for (let y = -14; y < 58; y += 6.5) {
      pb.box(7.7, 0.45, 6.9, [0, y, 0], [0, 0, 0], D); pb.box(4.6, 5.2, 0.3, [0, y + 3.3, -3.02], [0, 0, 0], DK);
      for (const sx of [-1, 1]) { pb.box(0.55, 0.3, 0.6, [sx * 3.25, y + 2, -3.75], [0, 0, 0], HZ); pb.box(0.9, 0.9, 0.5, [sx * 2.75, y + 4.6, -3.75], [0, 0, 0], C); }
      for (let k = 0; k < 5; k++) pb.box(4.2, 0.12, 0.42, [0, y + 1.2 + k * 0.95, -3.2], [0, 0, 0], C);                 // rack shelves in each niche
      pb.box(0.2, 5.0, 0.34, [-1.2, y + 3.3, -3.25], [0, 0, 0], D); pb.box(0.2, 5.0, 0.34, [1.2, y + 3.3, -3.25], [0, 0, 0], D);
    }
    for (const sx of [-1, 1]) for (let y = -10; y < 50; y += 13) { pb.box(0.4, 9, 3.2, [sx * 3.6, y, 0.4], [0, 0, 0], DK); pb.cyl(0.3, 0.3, 4.4, 10, [sx * 3.85, y + 5.5, -1.0], [Math.PI / 2, 0, 0], BR); }
    const pg = pb.build(), piers = new THREE.InstancedMesh(pg, hull, WELL.piers); piers.frustumCulled = false;
    for (let k = 0; k < WELL.piers; k++) { const a = (k / WELL.piers) * Math.PI * 2; E.set(0, a, 0); Qt.setFromEuler(E); M.compose(V.set(Math.sin(a) * WELL.pierR, 0, Math.cos(a) * WELL.pierR), Qt, Sc.set(1, 1, 1)); piers.setMatrixAt(k, M); }
    piers.receiveShadow = true; root.add(piers);

    // ring structures (galleries, lintel, rails) — one merged mesh
    const rb = new Builder();
    for (const [y, r0, r1, t] of [[WELL.deckY - 0.2, 26.6, 28.6, 0.3], [9.2, 26.9, 28.6, 0.3], [23, 27.2, 34.5, 3.2], [-12.6, 26.0, 36, 3.4]]) {
      const pts = [new THREE.Vector2(r0, y - t / 2), new THREE.Vector2(r1, y - t / 2), new THREE.Vector2(r1, y + t / 2), new THREE.Vector2(r0, y + t / 2), new THREE.Vector2(r0, y - t / 2)];
      const lg = new THREE.LatheGeometry(pts, 96).toNonIndexed(); lg.computeVertexNormals(); rb.add(lg, [0, 0, 0], [0, 0, 0], 1, y > 20 || y < -10 ? C : D);
    }
    for (const y of [WELL.deckY, 9.4]) for (const h of [0.55, 1.1]) rb.torus(26.75, 0.045, [0, y + h, 0], [Math.PI / 2, 0, 0], BR, 160, 6);
    for (let k = 0; k < 96; k++) { const a = (k / 96) * Math.PI * 2; for (const y of [WELL.deckY, 9.4]) rb.box(0.07, 1.15, 0.07, [Math.sin(a) * 26.75, y + 0.55, Math.cos(a) * 26.75], [0, a, 0], C); }
    for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2; rb.box(0.5, 1.1, 0.5, [Math.sin(a) * 27.25, 21.0, Math.cos(a) * 27.25], [0, a, 0], k % 2 ? HZ : DK); rb.box(0.22, 2.6, 1.6, [Math.sin(a) * 27.9, WELL.deckY - 1.5, Math.cos(a) * 27.9], [0, a, 0], DK); }
    const ringMesh = new THREE.Mesh(rb.build(), hullFine); ringMesh.receiveShadow = true; root.add(ringMesh);
    // lintel light strip + gallery edge strips
    const strip = (rad, y, col, I) => { const m = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.05, 6, 200), glow(col, I)); m.rotation.x = Math.PI / 2; m.position.y = y; root.add(m); return m; };
    const s1 = strip(27.15, 21.35, 0x35e6ff, 2.2), s2 = strip(26.58, WELL.deckY - 0.3, 0xff7a2e, 1.4), s3 = strip(26.88, 9.1, 0x35e6ff, 1.1);
    updaters.push(() => { const w = G.uWake.value; s1.material.color.copy(PAL.cyan).lerp(PAL.gold, w).multiplyScalar(1.6 + 2.2 * w); s3.material.color.copy(PAL.cyan).lerp(PAL.magenta, w).multiplyScalar(0.9 + 1.4 * w); });

    // server-niche lamps: thousands of tiny status lights that wake row by row when MEMORY aligns
    const perNiche = 5 * 14, niches = 9, LN = WELL.piers * niches * perNiche, lg = new THREE.BoxGeometry(0.09, 0.05, 0.03), aL = new Float32Array(LN * 2);
    const lmat = new THREE.ShaderMaterial({ uniforms: UF, toneMapped: false, fog: false,
      vertexShader: /* glsl */`attribute vec2 aL; varying vec2 vL; varying vec3 vW; void main(){ vL = aL; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`varying vec2 vL; varying vec3 vW; uniform float uTime; uniform float uWake; uniform vec3 uAct; uniform vec3 uHue; uniform vec3 uCam; ${FOG_GLSL}
        void main(){ float mem = max(uAct.x, uWake); float rise = smoothstep(0.0, 1.0, mem * 1.35 - (vW.y + 14.0) / 180.0);
          float b = step(0.55, fract(sin(floor(uTime * (0.6 + 3.0 * fract(vL.x * 9.1))) * 12.9898 + vL.x * 78.233) * 43758.5453));
          float idle = step(0.78, fract(vL.x * 57.3)) * (0.55 + 0.45 * sin(uTime * 1.5 + vL.x * 40.0));
          vec3 c = vL.y < 0.6 ? vec3(0.15, 0.9, 1.0) : vL.y < 0.86 ? vec3(1.0, 0.62, 0.2) : vec3(1.0, 0.15, 0.3); c = mix(c, uHue, 0.5 * uWake * step(0.5, fract(vL.x * 3.3)));
          float I = idle * 1.1 + rise * b * 2.4; float d = distance(vW, uCam); gl_FragColor = vec4(c * I * (1.0 - fogF(d, 0.0105) * 0.8), 1.0); }` });
    const lamps = new THREE.InstancedMesh(lg, lmat, LN); lamps.frustumCulled = false; let li = 0;
    for (let k = 0; k < WELL.piers; k++) {
      const a = (k / WELL.piers) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); E.set(0, a, 0); Qt.setFromEuler(E);
      for (let n = 0; n < niches; n++) { const y0 = -14 + n * 6.5; for (let row = 0; row < 5; row++) for (let c = 0; c < 14; c++) {
        const lx = -1.95 + c * 0.3 + (c > 3 ? 0.1 : 0) + (c > 9 ? 0.1 : 0), ly = y0 + 1.42 + row * 0.95, lz = -3.42;
        M.compose(V.set(sa * WELL.pierR + ca * lx + sa * lz, ly, ca * WELL.pierR - sa * lx + ca * lz), Qt, Sc.set(1, 1, 1)); lamps.setMatrixAt(li, M); aL.set([r(), r()], li * 2); li++; } }
    }
    lg.setAttribute('aL', new THREE.InstancedBufferAttribute(aL, 2)); root.add(lamps);
    // lamp bars under each ledge (the visible source of the wall wash)
    const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(4.4, 0.08, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), WELL.piers * 11), bc = new THREE.Color(); let bi = 0;
    for (let k = 0; k < WELL.piers; k++) { const a = (k / WELL.piers) * Math.PI * 2; E.set(0, a, 0); Qt.setFromEuler(E);
      for (let n = 0; n < 11; n++) { const y = -14 + n * 6.5 - 0.3; M.compose(V.set(Math.sin(a) * (WELL.pierR - 3.45), y, Math.cos(a) * (WELL.pierR - 3.45)), Qt, Sc.set(1, 1, 1)); bars.setMatrixAt(bi, M);
        bars.setColorAt(bi, bc.set((n + 1) % 2 ? 0x2fd0e6 : 0xff8a3a).multiplyScalar(1.7)); bi++; } }
    bars.frustumCulled = false; root.add(bars);
  }

  // ---------------------------------------------------------------- pillar under the head, collar clamp, maintenance deck, bridge
  const deckY = WELL.deckY;
  {
    const b = new Builder();
    b.cyl(1.55, 1.75, 6.6, 40, [0, -7.9, 0], [0, 0, 0], C); b.cyl(2.1, 2.5, 1.2, 40, [0, -11.2, 0], [0, 0, 0], D);
    for (const y of [-4.9, -6.2, -8.4, -10.3]) b.cyl(1.9, 1.9, 0.3, 40, [0, y, 0], [0, 0, 0], y === -6.2 ? HZ : D);
    b.cyl(2.25, 1.6, 0.7, 48, [0, -4.45, 0], [0, 0, 0], C);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.39, x = Math.sin(a), z = Math.cos(a); b.cyl(0.16, 0.16, 5.6, 12, [x * 2.05, -7.6, z * 2.05], [0, 0, 0], BR); b.cyl(0.24, 0.24, 2.2, 12, [x * 2.05, -9.3, z * 2.05], [0, 0, 0], DK); b.box(0.5, 0.36, 0.5, [x * 2.05, -4.9, z * 2.05], [0, a, 0], D); }
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; b.box(0.7, 0.9, 0.9, [Math.sin(a) * 2.3, -4.2, Math.cos(a) * 2.3], [0, a, 0], k % 2 ? HZ : C); }   // collar clamp jaws
    // horseshoe deck in front of the neck
    const [r0, r1] = WELL.deckR, arc = 3.9, a0 = -arc / 2;
    const dg = new THREE.RingGeometry(r0, r1, 72, 3, Math.PI / 2 - arc / 2, arc); b.add(new THREE.RingGeometry(r0, r1, 72, 3, -Math.PI / 2 - arc / 2, arc), [0, deckY, 0], [-Math.PI / 2, 0, 0], 1, D); b.add(dg, [0, deckY - 0.22, 0], [Math.PI / 2, 0, 0], 1, DK);
    b.add(new THREE.CylinderGeometry(r1, r1, 0.22, 72, 1, true, a0, arc), [0, deckY - 0.11, 0], [0, 0, 0], 1, HZ); b.add(new THREE.CylinderGeometry(r0, r0, 0.22, 72, 1, true, a0, arc).scale(-1, 1, 1), [0, deckY - 0.11, 0], [0, 0, 0], 1, D);
    for (let k = 0; k <= 22; k++) { const a = a0 + (k / 22) * arc, x = Math.sin(a), z = Math.cos(a); if (Math.abs(a) < 0.2) continue; b.box(0.06, 1.1, 0.06, [x * (r1 - 0.08), deckY + 0.55, z * (r1 - 0.08)], [0, a, 0], C); if (k % 3 === 0) b.rod([x * 2.0, -6.3, z * 2.0], [x * (r1 - 0.5), deckY - 0.2, z * (r1 - 0.5)], 0.07, D); }
    for (const h of [0.55, 1.08]) for (const sg of [-1, 1]) b.add(new THREE.TorusGeometry(r1 - 0.08, 0.035, 6, 60, arc / 2 - 0.2), [0, deckY + h, 0], [Math.PI / 2, 0, sg > 0 ? Math.PI / 2 - arc / 2 : Math.PI / 2 + 0.2], 1, BR);
    // bridge to the gallery
    b.box(2.2, 0.2, 20.6, [0, deckY - 0.1, r1 + 10.2], [0, 0, 0], D); for (const sx of [-1, 1]) { b.box(0.12, 0.5, 20.6, [sx * 1.1, deckY - 0.3, r1 + 10.2], [0, 0, 0], HZ); b.rod([sx * 1.08, deckY + 1.08, r1 - 0.1], [sx * 1.08, deckY + 1.08, r1 + 20.4], 0.035, BR); b.rod([sx * 1.08, deckY + 0.55, r1 - 0.1], [sx * 1.08, deckY + 0.55, r1 + 20.4], 0.035, BR); for (let z = 0; z <= 20; z += 2) b.box(0.06, 1.1, 0.06, [sx * 1.08, deckY + 0.55, r1 + z], [0, 0, 0], C); }
    // console pedestal + altar table
    b.box(1.3, 1.0, 0.5, [-2.75, deckY + 0.5, 3.95], [0, -0.62, 0], C);
    b.box(1.5, 0.12, 0.8, [2.85, deckY + 0.72, 3.9], [0, 0.62, 0], [0.5, 0.2, 0.14]); for (const [dx, dz] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) { const cx = 2.85 + dx * Math.cos(0.62) + dz * Math.sin(0.62), cz = 3.9 - dx * Math.sin(0.62) + dz * Math.cos(0.62); b.box(0.08, 0.7, 0.08, [cx, deckY + 0.35, cz], [0, 0.62, 0], [0.4, 0.16, 0.12]); }
    const mesh = new THREE.Mesh(b.build(), hullFine); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
    // deck grating glow line + console screen
    const edge = new THREE.Mesh(new THREE.TorusGeometry(r1 + 0.02, 0.03, 6, 96, arc), glow(0xff7a2e, 2.2)); edge.rotation.set(Math.PI / 2, 0, Math.PI / 2 - arc / 2); edge.position.y = deckY - 0.02; root.add(edge);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.82), new THREE.ShaderMaterial({ uniforms: { ...UF, tMap: { value: consoleScreen() } }, toneMapped: false,
      vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`uniform sampler2D tMap; uniform float uTime; uniform float uWake; varying vec2 vUv; void main(){ vec3 t = texture2D(tMap, vUv).rgb; float scan = 0.85 + 0.15 * sin(vUv.y * 640.0 * 3.14159); float bar = smoothstep(0.02, 0.0, abs(fract(vUv.y - uTime * 0.12) - 0.5) - 0.48);
        vec3 c = t * mix(vec3(0.5, 1.0, 0.9), vec3(1.0, 0.8, 0.5), uWake) * scan * 1.5 + vec3(0.01, 0.03, 0.035) + t * bar * 0.5; gl_FragColor = vec4(c, 1.0); }` }));
    scr.position.set(-2.75, deckY + 1.36, 3.95); scr.rotation.set(-0.5, -0.62, 0, 'YXZ');
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.96, 0.09), hullFine); back.position.copy(scr.position); back.rotation.copy(scr.rotation); back.castShadow = true; root.add(back);
    scr.translateZ(0.05); root.add(scr);
    const cLight = new THREE.PointLight(0x6fffe0, 5, 5, 2); cLight.position.set(-2.5, deckY + 1.7, 4.4); root.add(cLight);

    // --- Lux3D asset #2: the censer on the altar, plus coded offerings around it
    const altar = new THREE.Group(); altar.position.set(2.85, deckY + 0.78, 3.9); altar.rotation.y = 0.62; root.add(altar);
    if (censer) {
      let cm = null; censer.scene.traverse((o) => { if (o.isMesh && !cm) cm = o; });
      const g = cm.geometry; g.computeBoundingBox(); const bb = g.boundingBox, sc = 0.86 / (bb.max.y - bb.min.y);
      const m = new THREE.Mesh(g, cm.material); m.material.metalness = 0.55; m.material.roughness = 0.9; m.material.envMapIntensity = 1.3; if (m.material.map) m.material.map.anisotropy = 16;
      m.scale.setScalar(sc); m.position.set(0, -bb.min.y * sc, 0); m.rotation.y = -0.5; m.castShadow = true; m.receiveShadow = true; m.userData.hot = 'shrine'; altar.add(m); pickables.push(m);
    }
    const ob = new Builder();
    for (const [x, z] of [[-0.55, 0.22], [-0.42, 0.3], [0.55, 0.26]]) { ob.cyl(0.045, 0.03, 0.07, 16, [x, 0.035, z], [0, 0, 0], [0.85, 0.87, 0.9]); }
    ob.torus(0.12, 0.022, [0.5, 0.025, -0.2], [Math.PI / 2, 0, 0], [0.2, 0.2, 0.22], 32, 8); ob.torus(0.1, 0.022, [0.5, 0.06, -0.2], [Math.PI / 2, 0, 0], [0.2, 0.2, 0.22], 32, 8);
    for (const [x, z, h] of [[-0.6, -0.2, 0.34], [-0.52, -0.24, 0.3], [-0.56, -0.14, 0.38]]) ob.cyl(0.006, 0.006, h, 6, [x, h / 2, z], [0.05, 0, 0.06], [0.5, 0.2, 0.15]);
    altar.add(new THREE.Mesh(ob.build(), hullFine));
    const ember = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 8, 6), glow(0xff5a1e, 5), 3);
    [[-0.61, 0.34, -0.19], [-0.527, 0.3, -0.232], [-0.572, 0.38, -0.13]].forEach((p, i) => { M.makeTranslation(...p); ember.setMatrixAt(i, M); }); altar.add(ember);
    const aLight = new THREE.PointLight(0xffa050, 4, 5, 2); aLight.position.set(0.2, 1.0, 0.7); altar.add(aLight);
    // incense smoke: a thin additive ribbon
    const smoke = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 1.6, 1, 24).translate(0, 0.8, 0), new THREE.ShaderMaterial({ uniforms: UF, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: /* glsl */`uniform float uTime; uniform float uRainT; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; float t = uTime * 0.2 + uRainT * 0.5; p.x += (sin(p.y * 5.0 - t * 2.0) * 0.05 + sin(p.y * 11.0 - t * 3.1) * 0.02) * p.y; p.z += cos(p.y * 4.0 - t * 1.7) * 0.05 * p.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: /* glsl */`varying vec2 vUv; void main(){ float a = smoothstep(0.5, 0.0, abs(vUv.x - 0.5)) * smoothstep(1.0, 0.2, vUv.y) * smoothstep(0.0, 0.08, vUv.y); gl_FragColor = vec4(vec3(0.5, 0.56, 0.62) * a * 0.22, 1.0); }` }));
    smoke.position.set(-0.57, 0.34, -0.19); altar.add(smoke);
  }

  // ---------------------------------------------------------------- Lux3D asset #3: lantern drones on patrol (3 instances of one generated mesh)
  const drones = [];
  if (drone) {
    let dm = null; drone.scene.traverse((o) => { if (o.isMesh && !dm) dm = o; });
    const g = dm.geometry; g.computeBoundingBox(); const bb = g.boundingBox, sc = 1.25 / (bb.max.y - bb.min.y);
    dm.material.metalness = 0.6; dm.material.roughness = 0.85; dm.material.envMapIntensity = 1.4; if (dm.material.map) dm.material.map.anisotropy = 16;
    // amber glass panels of the generated texture are keyed (warm, mid-bright) and made to glow from inside
    dm.material.emissive = new THREE.Color(0xffffff); dm.material.emissiveMap = dm.material.map;
    const DU = { uLamp: { value: 0.5 } };
    dm.material.onBeforeCompile = (s) => { Object.assign(s.uniforms, DU); s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uLamp;').replace('#include <emissivemap_fragment>', /* glsl */`
      vec3 em = texture2D(emissiveMap, vEmissiveMapUv).rgb; float k = smoothstep(0.10, 0.26, em.r - em.b) * smoothstep(0.30, 0.5, em.r); totalEmissiveRadiance = em * vec3(1.0, 0.55, 0.2) * k * uLamp;`); };
    const dot = softDot();
    const paths = [[9.5, 2.6, 0.0, 0.075, 1], [13.5, 6.4, 2.2, -0.05, 1.1], [7.6, -1.6, 4.1, 0.06, 0.9]];
    paths.forEach(([rad, y, ph, sp, scl], i) => {
      const grp = new THREE.Group(), m = new THREE.Mesh(g, dm.material); m.scale.setScalar(sc * scl); m.castShadow = true; grp.add(m);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: new THREE.Color(0xff9a3c).multiplyScalar(1.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); halo.scale.setScalar(3.2); grp.add(halo);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 1.2, 9, 20, 1, true).translate(0, -4.5, 0), beamMat(new THREE.Color(0xffc27a), 0.5)); beam.position.y = -0.55; grp.add(beam);
      root.add(grp); drones.push({ grp, m, rad, y, ph, sp, halo, beam });
    });
    updaters.push((dt, T) => {
      const sense = Math.max(G.uAct.value.y, G.uWake.value); DU.uLamp.value = 0.5 + 2.2 * sense;
      for (const d of drones) {
        const tt = T * 0.3 + G.uRainT.value * 0.7, a = d.ph + tt * d.sp * 2.2, x = Math.sin(a) * d.rad, z = Math.cos(a) * d.rad * 0.8 + 2.5;
        d.grp.position.set(x, d.y + Math.sin(T * 0.7 + d.ph) * 0.35, z);
        d.grp.rotation.set(Math.sin(T * 0.9 + d.ph) * 0.05, Math.atan2(-x, -z) + Math.PI * 0 + lerp(a + Math.PI / 2 - Math.atan2(-x, -z), 0, sense) * 0, Math.cos(T * 0.8 + d.ph) * 0.05);
        d.grp.rotation.y = lerp(a + Math.PI / 2, Math.atan2(-x, -z), 0.25 + 0.75 * sense);       // patrol heading -> turns to watch the head once SENSE is aligned
        d.halo.material.opacity = 0.35 + 0.5 * sense; d.beam.material.uniforms.uI.value = 0.12 + 0.5 * sense;
      }
    });
  }

  function beamMat(col, I) {
    return new THREE.ShaderMaterial({ uniforms: { ...UF, uCol: { value: col }, uI: { value: I } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`uniform vec3 uCol; uniform float uI; uniform float uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV; ${GLSL_NOISE}
        void main(){ float f = pow(abs(dot(normalize(vN), vV)), 2.2); float fall = vUv.y * vUv.y * smoothstep(0.0, 0.3, 1.0 - vUv.y + 0.3 * step(uI, -1.0)); float n = 0.7 + 0.3 * vnoise(vec2(vUv.x * 14.0, vUv.y * 3.0 - uTime * 0.15)); gl_FragColor = vec4(uCol * uI * f * fall * n, 1.0); }` });
  }

  // ---------------------------------------------------------------- light shafts falling into the well + SENSE searchlights
  {
    for (const [x, z, rad, I, col] of [[-6, -4, 5.5, 0.07, 0x9fd8ff], [8, 3, 4.2, 0.06, 0x9fd8ff]]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.45, rad, 46, 32, 1, true), beamMat(new THREE.Color(col), I)); m.position.set(x, 10, z); m.rotation.set(0.06 * x * 0.1, 0, 0.03 * z); m.scale.y = -1; m.renderOrder = 3; root.add(m);
      updaters.push(() => { m.material.uniforms.uCol.value.set(col).lerp(PAL.gold, 0.6 * G.uWake.value); });
    }
    const sl = [];
    for (const sx of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(sx * 3.9, HALO.y + 3.9, HALO.z + 0.1); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 2.6, 34, 24, 1, true).translate(0, -17, 0), beamMat(new THREE.Color(0xff5aa0), 0)); m.renderOrder = 3; piv.add(m); root.add(piv); sl.push({ piv, m, sx }); }
    updaters.push((dt, T) => { const s = G.uAct.value.y * (1 - 0.65 * G.uWake.value); for (const o of sl) { o.m.material.uniforms.uI.value = 0.55 * s; o.piv.rotation.set(-1.25 + 0.3 * Math.sin(T * 0.31 + o.sx), 0, o.sx * (0.5 + 0.3 * Math.sin(T * 0.23 + 2 * o.sx))); } });
  }

  // ---------------------------------------------------------------- pressure ring thrown out when the face unlatches
  {
    const ringM = new THREE.ShaderMaterial({ uniforms: { ...UF, uA: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`varying vec2 vUv; uniform float uA; uniform vec3 uHue; void main(){ float e = smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.5, vUv.y); gl_FragColor = vec4(mix(vec3(1.0, 0.85, 0.6), uHue, 0.4) * e * e * uA, 1.0); }` });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.93, 1.0, 160, 1), ringM); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.6; ring.visible = false; ring.renderOrder = 6; root.add(ring);
    { const uv = ring.geometry.attributes.uv; for (let j = 0; j <= 1; j++) for (let k = 0; k <= 160; k++) uv.setXY(j * 161 + k, k / 160, j); }
    updaters.push((dt, T) => { const st = T - G.uShock.value; ring.visible = st > 0 && st < 3.2; if (ring.visible) { const s = 2.5 + st * 9.5; ring.scale.set(s, s, 1); ringM.uniforms.uA.value = 1.6 * Math.exp(-st * 1.25) * Math.min(1, st * 6); } });
  }

  // ---------------------------------------------------------------- cables converging on the halo, with light packets when MEMORY is aligned
  {
    const cb = new Builder();
    for (let k = 0; k < 20; k++) {
      const pier = [4, 5, 6, 7, 8, 3, 9][k % 7], a = ((pier + r.range(-0.2, 0.2)) / WELL.piers) * Math.PI * 2, y0 = r.range(8, 21);
      const from = new THREE.Vector3(Math.sin(a) * 27.4, y0, Math.cos(a) * 27.4), th = r() * Math.PI * 2, rr = 5.3;
      const to = k < 15 ? new THREE.Vector3(Math.cos(th) * rr, HALO.y + Math.sin(th) * rr, HALO.z - 0.35) : new THREE.Vector3(Math.sin(a) * 2.0, -5.0, Math.cos(a) * 2.0);
      const tube = new THREE.TubeGeometry(cableCurve(from, to, r.range(2.5, 6) + (k >= 15 ? 5 : 0), 20), 56, r.range(0.035, 0.075), 7, false);
      cb.add(tube, [0, 0, 0], [0, 0, 0], 1, [r(), r.range(0.4, 1), 0]);
    }
    const cm = new THREE.MeshStandardMaterial({ color: 0x101214, metalness: 0.3, roughness: 0.55, vertexColors: false, emissive: 0xffffff });
    cm.onBeforeCompile = (s) => { Object.assign(s.uniforms, UF);
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 color; varying vec3 vCb; varying vec2 vCu;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCb = color; vCu = uv;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCb; varying vec2 vCu; uniform float uTime; uniform float uWake; uniform vec3 uAct; uniform vec3 uHue;')
        .replace('#include <emissivemap_fragment>', /* glsl */`float ph = vCu.x * 9.0 - uTime * (0.7 + vCb.y) + vCb.x * 20.0; float pk = smoothstep(0.90, 1.0, sin(ph)) ; float on = max(uAct.x, uWake);
          totalEmissiveRadiance = mix(vec3(0.2, 0.9, 1.0), uHue, uWake) * pk * on * 3.0 * step(0.3, sin(vCu.y * 6.283 * 2.0) * 0.5 + 0.5);`); };
    const cables = new THREE.Mesh(cb.build(), cm); cables.castShadow = false; root.add(cables);
  }

  // ---------------------------------------------------------------- paper talismans strung across the well (foreground parallax, react to the wake shock)
  {
    const lines = [[[-27, 14, 4], [27, 12.5, 7], 3.0, 26], [[-26, 11, -9], [20, 14.5, 16], 3.4, 24], [[-18, 16, 18], [24, 12, -14], 3.0, 22], [[-27, 12.5, 11], [27, 13.5, 12], 3.6, 30], [[-22, 16, -16], [22, 15, -17], 2.5, 20], [[-26, 10.5, -19], [26, 10, -18], 2.2, 24]];
    const N = lines.reduce((a, l) => a + l[3], 0), g = new THREE.PlaneGeometry(1, 1, 1, 6).translate(0, -0.5, 0), aP = new Float32Array(N * 4), aQ = new Float32Array(N * 2); let k = 0;
    const lb = new Builder();
    for (const [a, b, sag, n] of lines) {
      const cv = cableCurve(new THREE.Vector3(...a), new THREE.Vector3(...b), sag, 16); lb.add(new THREE.TubeGeometry(cv, 48, 0.018, 5, false), [0, 0, 0], [0, 0, 0], 1, [0.2, 0.2, 0.2]);
      for (let i = 0; i < n; i++) { const p = cv.getPoint((i + 0.5 + r.range(-0.25, 0.25)) / n); aP.set([p.x, p.y, p.z, r() * 6.283], k * 4); aQ.set([Math.floor(r() * 8), r.range(0.8, 1.25)], k * 2); k++; }
    }
    root.add(new THREE.Mesh(lb.build(), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 })));
    g.setAttribute('aP', new THREE.InstancedBufferAttribute(aP, 4)); g.setAttribute('aQ', new THREE.InstancedBufferAttribute(aQ, 2));
    const tm = new THREE.ShaderMaterial({ uniforms: { ...UF, tMap: { value: talismanAtlas() } }, side: THREE.DoubleSide, fog: false,
      vertexShader: /* glsl */`attribute vec4 aP; attribute vec2 aQ; uniform float uTime; uniform float uShock; uniform float uRainV; varying vec2 vUv; varying vec3 vW; varying float vL;
        void main(){ vUv = vec2((uv.x + aQ.x) / 8.0, uv.y); float h = -position.y; vec3 base = aP.xyz;
          float yaw = atan(base.x, base.z) + 1.5708 + sin(aP.w) * 0.5; float t = uTime * 0.25 + uTime * 0.75 * abs(uRainV);
          float sw = (sin(t * 1.3 + aP.w) * 0.16 + sin(t * 2.9 + aP.w * 3.0) * 0.05) * h;
          float st = uTime - uShock - length(base.xz) / 14.0; float shock = st > 0.0 ? exp(-st * 1.1) * sin(st * 7.0) * 1.25 : 0.0;       // pressure wave from the opening face
          vec3 outward = normalize(vec3(base.x, 0.0, base.z) + 1e-4);
          vec3 p = vec3(position.x * 0.36 * aQ.y, position.y * 1.35 * aQ.y, 0.0); float c = cos(yaw), s = sin(yaw); p = vec3(p.x * c, p.y, -p.x * s);
          p += outward * (sw + shock * h * 0.9) * h; p.y += (abs(sw) + abs(shock) * 0.6) * h * 0.25;
          vec3 w = base + p; vW = w; vL = 0.55 + 0.45 * abs(dot(vec3(s, 0.0, c), normalize(cameraPosition - w))); gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
      fragmentShader: /* glsl */`uniform sampler2D tMap; uniform float uWake; uniform vec3 uHue; uniform vec3 uCam; uniform vec3 uFogCol; varying vec2 vUv; varying vec3 vW; varying float vL; ${FOG_GLSL}
        void main(){ vec3 t = texture2D(tMap, vUv).rgb; float ink = smoothstep(0.25, 0.6, t.r - t.g);
          float up = smoothstep(-10.0, 24.0, vW.y); vec3 lightC = mix(vec3(0.10, 0.17, 0.22), vec3(0.30, 0.16, 0.14), uWake) * (0.6 + up);
          vec3 c = t * lightC * vL + mix(vec3(1.0, 0.16, 0.08), mix(vec3(1.0, 0.75, 0.3), uHue, 0.4), uWake) * ink * (0.35 + 2.6 * uWake);
          float d = distance(vW, uCam); c = mix(c, uFogCol, fogF(d, 0.0105)); gl_FragColor = vec4(c, 1.0); }` });
    const tal = new THREE.InstancedMesh(g, tm, N); tal.frustumCulled = false; root.add(tal);
  }

  // ---------------------------------------------------------------- rain: streaks that can slow, hang in the air as beads, and drift upward
  const rainN = 26000; let rain;
  {
    const g = new THREE.InstancedBufferGeometry(); g.index = new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 2, 1, 3]), 1);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0]), 3));
    const aR = new Float32Array(rainN * 4);
    for (let i = 0; i < rainN; i++) { const rad = 2.9 + Math.sqrt(r()) * 25, a = r() * 6.283; aR.set([Math.sin(a) * rad, r() * 60, Math.cos(a) * rad, r()], i * 4); }
    g.setAttribute('aR', new THREE.InstancedBufferAttribute(aR, 4)); g.instanceCount = rainN;
    rain = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: UF, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: /* glsl */`attribute vec4 aR; uniform float uRainT; uniform float uRainV; uniform float uTime; varying vec2 vUv; varying float vK; varying float vS; varying vec3 vW;
        void main(){ vUv = position.xy + vec2(0.5, 0.0); vS = aR.w; float sp = 26.0 * (0.75 + 0.5 * aR.w); float y = mod(aR.y - uRainT * sp, 60.0) - 13.0;
          float still = 1.0 - smoothstep(0.02, 0.3, abs(uRainV)); vK = still;
          vec3 c = vec3(aR.x, y, aR.z); c.x += still * sin(uTime * 0.6 + aR.w * 40.0) * 0.03;
          float len = mix(0.25 + 1.5 * abs(uRainV) * (0.6 + 0.8 * aR.w), 0.05, still), wid = mix(0.018, 0.05, still);
          vec3 toC = normalize(cameraPosition - c); vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toC)); vec3 upv = mix(vec3(0.0, 1.0, 0.0), normalize(cross(toC, right)), still);
          vec3 w = c + right * position.x * wid + upv * (position.y - 0.5 * still) * len; vW = w; gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
      fragmentShader: /* glsl */`varying vec2 vUv; varying float vK; varying float vS; varying vec3 vW; uniform float uWake; uniform vec3 uHue; uniform vec3 uCam;
        void main(){ vec2 q = vUv - 0.5; float streak = smoothstep(0.5, 0.0, abs(q.x)) * smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
          float bead = smoothstep(0.5, 0.18, length(q)) + 1.6 * smoothstep(0.16, 0.0, length(q - vec2(-0.12, 0.14)));
          float a = mix(streak * 0.10, bead * 0.42 * step(0.5, fract(vS * 13.7)), vK); float d = distance(vW, uCam); a *= smoothstep(0.6, 3.0, d) * (1.0 - smoothstep(40.0, 75.0, d));
          float core = exp(-dot(vW.xz, vW.xz) / 150.0);
          vec3 c = mix(vec3(0.55, 0.75, 0.9), mix(vec3(1.0, 0.8, 0.55), uHue, 0.5), vK * (0.35 + 0.65 * core)) * (0.6 + 1.6 * core * uWake + 0.8 * vK);
          gl_FragColor = vec4(c * a, 1.0); }` }));
    rain.frustumCulled = false; rain.renderOrder = 4; root.add(rain);
  }

  // ---------------------------------------------------------------- mist banks
  {
    const N = 30, g = new THREE.PlaneGeometry(1, 1), aM = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) { const a = r() * 6.283, rad = i < 30 ? r.range(6, 25) : r.range(9, 24); aM.set([Math.sin(a) * rad, i < 30 ? r.range(-10.4, -7.5) : r.range(-3, 18), Math.cos(a) * rad, r()], i * 4); }
    g.setAttribute('aM', new THREE.InstancedBufferAttribute(aM, 4));
    const mm = new THREE.ShaderMaterial({ uniforms: { ...UF, tDot: { value: softDot() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: /* glsl */`attribute vec4 aM; uniform float uTime; varying vec2 vUv; varying float vS; varying float vD; void main(){ vUv = uv; vS = aM.w; float a = uTime * 0.02 * (aM.w - 0.5); float c = cos(a), s = sin(a);
        vec3 ctr = vec3(aM.x * c - aM.z * s, aM.y + sin(uTime * 0.1 + aM.w * 9.0) * 0.5, aM.x * s + aM.z * c); vec4 mv = viewMatrix * vec4(ctr, 1.0); vD = -mv.z; mv.xy += position.xy * vec2(15.0, 5.0) * (0.7 + aM.w); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`uniform sampler2D tDot; uniform float uWake; uniform vec3 uHue; varying vec2 vUv; varying float vS; varying float vD; void main(){ float a = texture2D(tDot, vUv).r; a *= smoothstep(3.0, 12.0, vD);
        vec3 c = mix(vec3(0.05, 0.12, 0.15), mix(vec3(0.2, 0.09, 0.06), uHue * 0.2, 0.4), uWake); gl_FragColor = vec4(c * a * 0.24, 1.0); }` });
    const mist = new THREE.InstancedMesh(g, mm, N); mist.frustumCulled = false; mist.renderOrder = 5; root.add(mist);
  }

  // ---------------------------------------------------------------- the flooded floor: mirror water with rain rings
  const waterU = { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTime: G.uTime, uRainV: G.uRainV, uRainT: G.uRainT, uWake: G.uWake, uHue: G.uHue, uShock: G.uShock, uCam: G.uCam, uMirror: { value: 1 }, uFogCol: { value: scene.fog.color } };
  const waterShader = {
    name: 'WellWater', uniforms: waterU,
    vertexShader: /* glsl */`uniform mat4 textureMatrix; varying vec4 vUvR; varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vUvR = textureMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`uniform sampler2D tDiffuse; uniform float uTime; uniform float uRainV; uniform float uRainT; uniform float uWake; uniform vec3 uHue; uniform float uShock; uniform vec3 uCam; uniform float uMirror; uniform vec3 uFogCol; varying vec4 vUvR; varying vec3 vW;
      ${GLSL_NOISE} ${FOG_GLSL}
      float ring(vec2 p, float t){ vec2 c = floor(p), f = fract(p) - 0.5; float h = hash21(c); float ph = fract(t * (0.35 + 0.3 * h) + h * 7.0); vec2 o = (hash22(c + 3.0) - 0.5) * 0.5; float d = length(f - o);
        return sin((d - ph * 0.45) * 60.0) * smoothstep(0.06, 0.0, abs(d - ph * 0.45)) * (1.0 - ph); }
      void main(){ vec2 p = vW.xz; float rainOn = smoothstep(0.1, 0.6, abs(uRainV)); float t = uRainT * 2.0;
        float hgt = (vnoise(p * 0.7 + uTime * 0.08) + 0.5 * vnoise(p * 1.9 - uTime * 0.11)) * 0.5;
        vec2 e = vec2(0.06, 0.0);
        float hx = (vnoise((p + e) * 0.7 + uTime * 0.08) + 0.5 * vnoise((p + e) * 1.9 - uTime * 0.11)) * 0.5, hz = (vnoise((p + e.yx) * 0.7 + uTime * 0.08) + 0.5 * vnoise((p + e.yx) * 1.9 - uTime * 0.11)) * 0.5;
        vec2 n = vec2(hx - hgt, hz - hgt) * 2.4;
        float rr = (ring(p * 0.9, t) + ring(p * 1.7 + 4.0, t * 1.3)) * rainOn; n += vec2(dFdx(rr), dFdy(rr)) * 3.0 + rr * 0.012;
        float st = uTime - uShock; float sd = length(p) - st * 9.0; float sw = st > 0.0 ? sin(sd * 1.6) * exp(-abs(sd) * 0.35) * exp(-st * 0.35) : 0.0; n += normalize(p + 1e-3) * sw * 0.06;
        vec3 V = normalize(uCam - vW); float fres = 0.04 + 0.96 * pow(1.0 - max(V.y, 0.0), 4.0);
        vec2 uv = vUvR.xy / vUvR.w + n * 0.55;
        vec3 refl = texture2D(tDiffuse, uv).rgb * uMirror + (1.0 - uMirror) * mix(vec3(0.02, 0.05, 0.06), vec3(0.09, 0.04, 0.05), uWake);
        vec3 deep = mix(vec3(0.004, 0.012, 0.016), vec3(0.016, 0.008, 0.012), uWake);
        vec3 c = mix(deep, refl, clamp(fres * 1.15 + 0.12, 0.0, 1.0));
        float d = distance(vW, uCam); c = mix(c, uFogCol, fogF(d, 0.0105) * 0.6); gl_FragColor = vec4(c, 1.0); }`,
  };
  const waterGeo = new THREE.CircleGeometry(40, 64);
  let water = null;
  function makeWater(scale) {
    if (water) { root.remove(water); water.getRenderTarget && water.getRenderTarget().dispose(); water.material.dispose(); water = null; }
    const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (scale > 0) {
      water = new Reflector(waterGeo, { textureWidth: Math.max(256, Math.round(sz.x * scale * 0.5)), textureHeight: Math.max(256, Math.round(sz.y * scale * 0.5)), shader: waterShader, clipBias: 0.02, multisample: 0 });
      water.material.uniforms.uMirror.value = 1; water.getRenderTarget().texture.type = THREE.HalfFloatType;
    } else {
      const u = THREE.UniformsUtils.clone({ color: { value: new THREE.Color() }, textureMatrix: { value: new THREE.Matrix4() } });
      water = new THREE.Mesh(waterGeo, new THREE.ShaderMaterial({ uniforms: { ...waterU, ...u, tDiffuse: { value: null }, uMirror: { value: 0 } }, vertexShader: waterShader.vertexShader, fragmentShader: waterShader.fragmentShader }));
    }
    for (const k of ['uTime', 'uRainV', 'uRainT', 'uWake', 'uHue', 'uShock', 'uCam', 'uFogCol']) water.material.uniforms[k] = waterU[k];
    water.rotation.x = -Math.PI / 2; water.position.y = WELL.waterY; water.frustumCulled = false; root.add(water);
  }

  // ---------------------------------------------------------------- per-frame
  const cKey = new THREE.Color(0xe8eeff), cKeyW = new THREE.Color(0xffd9a8), fogD = new THREE.Color(0x0a1118), fogW = new THREE.Color(0x160d12);
  function update(dt, T) {
    const w = G.uWake.value, act = G.uAct.value;
    key.color.copy(cKey).lerp(cKeyW, w); key.intensity = 2700 * (1 - 0.25 * w);
    rimM.intensity = 620 * (0.55 + 0.45 * act.y) * (1 - 0.5 * w); rimC.intensity = 620 * (0.6 + 0.4 * act.x) * (1 - 0.35 * w); fill.intensity = 520 * (1 - 0.3 * w);
    under.intensity = 60 + 120 * act.z + 160 * w; under.color.copy(PAL.teal).lerp(G.uHue.value, w);
    scene.fog.color.copy(fogD).lerp(fogW, w); hemi.intensity = 1.0 + 0.3 * w; scene.environmentIntensity = 0.75 + 0.2 * w;
    for (const u of updaters) u(dt, T);
  }
  function setQuality(p) {
    key.castShadow = p.shadow > 0; if (p.shadow > 0 && key.shadow.mapSize.x !== p.shadow) { key.shadow.mapSize.set(p.shadow, p.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    rain.geometry.instanceCount = Math.floor(rainN * p.rain); makeWater(p.reflect);
  }
  function preRender() {}
  return { root, update, setQuality, preRender, pickables, drones, lights: { key, rimM, rimC } };
}
