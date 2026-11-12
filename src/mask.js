// The face. Geometry + base-colour/roughness textures are the Lux3D image-to-3D output (assets/mask.glb, task 6691940).
// Code here: scaling, splitting the single generated mesh into three moving shells (left face, right face, rear/neck)
// with shader clipping, an inward-offset inner lining that closes the cut edge, seam light, kintsugi glow, glaze micro-detail
// and the hydraulic struts that carry the two face halves.
import * as THREE from 'three';
import { Builder, clamp, easeInOut, damp, GLSL_NOISE } from './util.js';
import { G, hullMaterial, glow } from './materials.js';
import { CIRCUIT_GLSL } from './engine.js';

export const MASK = { height: 7.7, yShift: -1.02, cutZ: -0.55, cutY: -3.42, hingeX: 2.0, thick: 0.075 };

const PARS_V = /* glsl */`varying vec3 vOP; uniform vec3 uCut; uniform float uThick; uniform int uPart;
float maskSeamDist(vec3 p){
  float dz = p.z - uCut.z, dy = p.y - uCut.y;
  if (uPart < 2) return min(abs(p.x), min(dz, dy));
  float a = -dz, b = -dy; return (a > 0.0 && b > 0.0) ? length(vec2(a, b)) : max(a, b);
}`;
const PARS_F = /* glsl */`varying vec3 vOP; uniform vec3 uCut; uniform int uPart; uniform float uSeam; uniform vec3 uSeamCol; uniform float uKin; uniform float uTime; uniform float uWake; uniform vec3 uHue;
${GLSL_NOISE}
float maskSeamDist(vec3 p){
  float dz = p.z - uCut.z, dy = p.y - uCut.y;
  if (uPart < 2) return min(abs(p.x), min(dz, dy));
  float a = -dz, b = -dy; return (a > 0.0 && b > 0.0) ? length(vec2(a, b)) : max(a, b);
}
void maskClip(){
  bool front = vOP.z > uCut.z && vOP.y > uCut.y;
  if (uPart == 0) { if (!(front && vOP.x < 0.0)) discard; }
  else if (uPart == 1) { if (!(front && vOP.x >= 0.0)) discard; }
  else { if (front) discard; }
}`;

export async function buildMask(loader, url) {
  const gltf = await loader.loadAsync(url);
  let src = null; gltf.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
  const geo = src.geometry.clone(); geo.computeBoundingBox();
  const bb = geo.boundingBox, s = MASK.height / (bb.max.y - bb.min.y), cx = (bb.max.x + bb.min.x) / 2, cy = (bb.max.y + bb.min.y) / 2, cz = (bb.max.z + bb.min.z) / 2;
  geo.translate(-cx, -cy, -cz); geo.scale(s, s, s); geo.translate(0, MASK.yShift, 0); geo.computeBoundingBox(); geo.computeBoundingSphere();
  const map = src.material.map, rmap = src.material.roughnessMap;
  if (map) { map.anisotropy = 16; }
  const root = new THREE.Group(); root.name = 'mask';
  const shared = { uCut: { value: new THREE.Vector3(0, MASK.cutY, MASK.cutZ) }, uThick: { value: MASK.thick }, uSeam: { value: 0 }, uSeamCol: { value: new THREE.Color(1, 0.75, 0.4) }, uKin: { value: 0 }, uTime: G.uTime, uWake: G.uWake, uHue: G.uHue };
  const parts = [];

  for (let p = 0; p < 3; p++) {
    const U = { ...shared, uPart: { value: p } };
    // --- outer glazed shell (generated texture + coded detail)
    const outer = new THREE.MeshPhysicalMaterial({ map, roughnessMap: rmap, metalnessMap: null, metalness: 0.0, roughness: 0.55, clearcoat: 0.4, clearcoatRoughness: 0.14, envMapIntensity: 0.6, emissive: 0xffffff, emissiveIntensity: 1 });
    outer.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + PARS_V).replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + PARS_F)
        .replace('#include <map_fragment>', /* glsl */`maskClip();
          #include <map_fragment>
          vec3 alb = diffuseColor.rgb;
          float kin = smoothstep(0.52, 0.78, (alb.r - alb.b) / max(alb.r, 1e-3)) * smoothstep(0.10, 0.22, alb.r);   // gold repair veins in the generated texture
          float dark = 1.0 - smoothstep(0.10, 0.30, dot(alb, vec3(0.333)));                                    // metal collar / vents
          float crack = smoothstep(0.035, 0.0, abs(vnoise3(vOP * 5.5) - 0.5) ) * 0.5 + smoothstep(0.02, 0.0, abs(vnoise3(vOP * 13.0 + 7.0) - 0.5)) * 0.35;
          float fwm = length(fwidth(vOP)); crack *= 1.0 - smoothstep(0.004, 0.02, fwm);
          diffuseColor.rgb *= 1.0 - 0.22 * crack * (1.0 - dark);
          diffuseColor.rgb *= vec3(1.0, 0.975, 0.93);
          float sd = maskSeamDist(vOP);
          diffuseColor.rgb *= mix(0.22, 1.0, smoothstep(0.003, 0.016, sd));`)
        .replace('#include <roughnessmap_fragment>', /* glsl */`#include <roughnessmap_fragment>
          roughnessFactor = mix(clamp(roughnessFactor * 0.6 + 0.14 + 0.25 * crack, 0.1, 1.0), 0.42, dark); roughnessFactor = mix(roughnessFactor, 0.3, kin);`)
        .replace('#include <metalnessmap_fragment>', /* glsl */`#include <metalnessmap_fragment>
          metalnessFactor = max(dark * 0.9, kin * 0.95);`)
        .replace('#include <emissivemap_fragment>', /* glsl */`
          float seamG = 3.0 * exp(-max(sd, 0.0) / 0.022) + 0.3 * exp(-max(sd, 0.0) / 0.12);
          totalEmissiveRadiance = uSeamCol * seamG * uSeam + mix(vec3(1.0, 0.72, 0.3), uHue, 0.35) * kin * uKin * (0.75 + 0.25 * sin(uTime * 1.7 + vOP.y * 2.0));`)
        .replace('#include <clearcoat_normal_fragment_begin>', /* glsl */`#include <clearcoat_normal_fragment_begin>
          `);
    };
    outer.customProgramCacheKey = () => 'maskOuter';
    // --- inner lining: same generated surface, pushed inward, seen from behind; coded circuit-lacquer finish
    const inner = new THREE.MeshStandardMaterial({ color: 0x0d0f12, metalness: 0.7, roughness: 0.4, side: THREE.BackSide, emissive: 0xffffff });
    inner.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + PARS_V)
        .replace('#include <begin_vertex>', /* glsl */`#include <begin_vertex>
          { float lip = smoothstep(0.0, 0.22, maskSeamDist(position)); transformed -= normalize(objectNormal) * uThick * lip; }
          vOP = position;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + PARS_F + CIRCUIT_GLSL)
        .replace('#include <map_fragment>', /* glsl */`maskClip();
          float sd = maskSeamDist(vOP);
          vec2 cuv = vec2(atan(vOP.x, vOP.z) * 2.2, vOP.y) * 3.2; vec2 cc = circuit(cuv, uTime);
          float rib = smoothstep(0.40, 0.5, abs(fract(vOP.y * 2.6) - 0.5));
          float rim = 1.0 - smoothstep(0.03, 0.2, sd);                       // ivory lip where the lining rolls up to meet the glaze
          diffuseColor.rgb = mix(vec3(0.04, 0.045, 0.055), vec3(0.40, 0.27, 0.09), cc.x * 0.85);
          diffuseColor.rgb *= 1.0 - 0.5 * rib * (1.0 - cc.x);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.76, 0.70), rim);`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(mix(0.5, 0.22, cc.x), 0.2, rim);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor = mix(mix(0.55, 1.0, cc.x), 0.0, rim);')
        .replace('#include <emissivemap_fragment>', /* glsl */`
          float seamG = exp(-max(sd, 0.0) / 0.03);
          totalEmissiveRadiance = uSeamCol * seamG * uSeam * 0.7 + (vec3(0.9, 0.6, 0.25) * cc.x * 0.03 + mix(vec3(0.2, 0.9, 1.0), uHue, 0.7) * cc.y * 0.8) * uWake;`);
    };
    inner.customProgramCacheKey = () => 'maskInner';
    const pivot = new THREE.Group(), hx = p === 0 ? -MASK.hingeX : p === 1 ? MASK.hingeX : 0;
    pivot.position.set(hx, 0, MASK.cutZ); root.add(pivot);
    const mo = new THREE.Mesh(geo, outer), mi = new THREE.Mesh(geo, inner);
    for (const m of [mo, mi]) { m.position.set(-hx, 0, -MASK.cutZ); m.frustumCulled = false; pivot.add(m); }
    parts.push({ pivot, outer: mo, inner: mi, U });
  }

  // invisible proxy for cheap pointer picking of the closed face
  const proxy = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ visible: false }));
  proxy.scale.set(2.3, 3.1, 2.9); proxy.position.set(0, -0.28, 0); proxy.userData.face = true; root.add(proxy);

  // ---- hydraulic struts carrying the face halves (code-built). Anchors found by raycasting the generated mesh once.
  const steel = hullMaterial({ color: 0x2a2f37, metalness: 0.9, roughness: 0.4, object: true, panel: 3, key: 'strut' });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde4, metalness: 1, roughness: 0.12 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb8924a, metalness: 1, roughness: 0.3 });
  const rc = new THREE.Raycaster(); const tmpMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  tmpMesh.updateMatrixWorld(true);
  const struts = [];
  const sleeveGeo = new THREE.CylinderGeometry(0.075, 0.075, 1, 16).translate(0, 0.5, 0), rodGeo = new THREE.CylinderGeometry(0.038, 0.038, 1, 12).translate(0, 0.5, 0);
  const eyeGeo = new THREE.SphereGeometry(0.11, 16, 12);
  for (const side of [-1, 1]) for (const [yy, zz] of [[1.75, 0.55], [-0.95, 0.75]]) {
    const o = new THREE.Vector3(side * 0.2, yy, zz), d = new THREE.Vector3(side, 0.0, 0.12).normalize(); rc.set(o, d); rc.far = 10;
    const hits = rc.intersectObject(tmpMesh, false); const hp = hits.length ? hits[0].point.clone() : o.clone().addScaledVector(d, 1.7);
    const anchorB = hp.addScaledVector(d, -(MASK.thick + 0.16));                  // on the inside of the lining
    const pv = parts[side < 0 ? 0 : 1].pivot, local = anchorB.clone().sub(pv.position);
    const pad = new THREE.Group(); pad.position.copy(local); pv.add(pad);
    const pb = new Builder(); pb.cyl(0.2, 0.26, 0.2, 20, [side * 0.12, 0, 0], [0, 0, Math.PI / 2]); pb.box(0.1, 0.5, 0.5, [side * 0.2, 0, 0]);
    pad.add(new THREE.Mesh(pb.build(), steel)); pad.add(new THREE.Mesh(eyeGeo, brass));
    const anchorA = new THREE.Vector3(side * 1.72, yy * 0.8 + 0.1, MASK.cutZ - 0.75);
    const baseEye = new THREE.Mesh(eyeGeo, brass); baseEye.position.copy(anchorA); root.add(baseEye);
    const sleeve = new THREE.Mesh(sleeveGeo, steel), rod = new THREE.Mesh(rodGeo, chrome); root.add(sleeve, rod);
    struts.push({ pad, anchorA, sleeve, rod, rest: 0 });
  }
  tmpMesh.material.dispose();
  // rear cradle that the struts push from (static, behind the engine)
  const cb = new Builder(), C = [1, 1, 1], HZ = [1.0, 0.62, 0.12];
  for (const side of [-1, 1]) { cb.box(0.22, 3.6, 0.3, [side * 1.72, 0.55, MASK.cutZ - 0.9], [0, 0, 0], C); cb.box(0.3, 0.2, 0.34, [side * 1.72, 1.5, MASK.cutZ - 0.85], [0, 0, 0], HZ); cb.box(0.3, 0.2, 0.34, [side * 1.72, -0.66, MASK.cutZ - 0.85], [0, 0, 0], HZ); }
  cb.box(3.7, 0.2, 0.26, [0, 2.3, MASK.cutZ - 0.95], [0, 0, 0], C); cb.box(3.7, 0.2, 0.26, [0, -1.25, MASK.cutZ - 0.95], [0, 0, 0], C);
  root.add(new THREE.Mesh(cb.build(), steel));

  const wa = new THREE.Vector3(), wb = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), q = new THREE.Quaternion();
  const stt = { kin: 0, seam: 0 };
  // open: 0..1 timeline value; locks: how many rings are aligned (drives the seam light before opening)
  function update(dt, T, open, locks) {
    const gap = easeInOut(clamp(open / 0.16)), swing = easeInOut(clamp((open - 0.13) / 0.87));
    for (let p = 0; p < 2; p++) {
      const sg = p === 0 ? -1 : 1, P = parts[p].pivot;
      P.rotation.y = sg * swing * 0.74;
      P.position.set(sg * (MASK.hingeX + 0.10 * gap + 0.95 * swing), 0, MASK.cutZ + 0.06 * gap + 0.35 * swing);
    }
    parts[2].pivot.position.z = MASK.cutZ - 0.12 * swing;
    root.updateMatrixWorld(true);
    for (const s of struts) {
      s.pad.getWorldPosition(wb); wa.copy(s.anchorA); root.localToWorld(wa);
      root.worldToLocal(wb); wa.copy(s.anchorA);
      dir.copy(wb).sub(wa); const len = dir.length(); dir.normalize(); q.setFromUnitVectors(up, dir);
      if (!s.rest) s.rest = len;
      s.sleeve.position.copy(wa); s.sleeve.quaternion.copy(q); s.sleeve.scale.set(1, s.rest * 0.82, 1);
      s.rod.position.copy(wa); s.rod.quaternion.copy(q); s.rod.scale.set(1, len, 1);
    }
    const pulse = 0.5 + 0.5 * Math.sin(T * 3.2);
    const seamT = open >= 0.999 ? 0.12 : open > 0.001 ? 0.9 : (locks >= 3 ? 0.55 + 0.45 * pulse : locks * 0.12);
    stt.seam = damp(stt.seam, seamT, 3.5, dt); stt.kin = damp(stt.kin, Math.max(G.uWake.value * 2.6, locks * 0.22), 2.0, dt);
    shared.uSeam.value = stt.seam; shared.uKin.value = stt.kin;
    shared.uSeamCol.value.copy(G.uHue.value).lerp(new THREE.Color(1, 0.8, 0.5), 0.5);
  }
  return { root, parts, proxy, update, geo, shared };
}
