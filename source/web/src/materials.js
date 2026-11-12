// Shared uniforms and the procedural "hull" surface: one patched PBR material that gives every code-built structure
// panel seams, rivets, per-panel finish variation, grime streaks and edge wear from world/object position (no textures).
import * as THREE from 'three';
import { GLSL_NOISE } from './util.js';

// Global animated uniforms, shared by reference with every custom shader.
export const G = {
  uTime: { value: 0 },                 // simulation seconds (fixed-step in capture)
  uWake: { value: 0 },                 // 0 dormant .. 1 awake (environment blend)
  uOpen: { value: 0 },                 // 0 closed .. 1 open (face shells)
  uAct: { value: new THREE.Vector3() },// memory / sense / will ring activation 0..1
  uHue: { value: new THREE.Color(1.0, 0.72, 0.35) },   // current "thought" accent colour
  uRainT: { value: 0 },                // integrated rain phase (rain can stop and reverse)
  uRainV: { value: 1 },                // rain speed factor
  uShock: { value: -10 },              // time the wake shock-wave started
  uCam: { value: new THREE.Vector3() },
};

export const PAL = {
  cyan: new THREE.Color(0x35e6ff), teal: new THREE.Color(0x18b8a8), amber: new THREE.Color(0xffa63d), gold: new THREE.Color(0xffd27a),
  magenta: new THREE.Color(0xff2e88), red: new THREE.Color(0xff3b2e), violet: new THREE.Color(0x9a6bff), ink: new THREE.Color(0x05070a),
};
export const HUES = [0x49b8ff, 0xff3f93, 0xffa63d, 0xa77bff, 0x2fe6c8, 0xdfeaff, 0x9dffb0, 0xff5a3c].map((h) => new THREE.Color(h));

const HULL_PARS_V = /* glsl */`
varying vec3 vHullP; varying vec3 vHullN;
`;
const HULL_V = /* glsl */`
#ifdef HULL_OBJECT
  vHullP = transformed; vHullN = normalize(objectNormal);
#else
  vec4 hullW = vec4(transformed, 1.0);
  vec3 hullN = objectNormal;
  #ifdef USE_INSTANCING
    hullW = instanceMatrix * hullW; hullN = mat3(instanceMatrix) * hullN;
  #endif
  vHullP = (modelMatrix * hullW).xyz; vHullN = normalize(mat3(modelMatrix) * hullN);
#endif
`;
const HULL_PARS_F = /* glsl */`
varying vec3 vHullP; varying vec3 vHullN;
uniform float uPanel; uniform float uWear; uniform float uGrime; uniform float uBumpK; uniform float uTime; uniform float uWake;
${GLSL_NOISE}
// distance to the nearest seam of a two-level brick-offset panel layout; id = per-panel random
vec4 hullPanel(vec2 p){
  vec2 q = p; float row = floor(q.y); q.x += hash11(row * 7.13) * 3.7; vec2 c = floor(q), f = fract(q);
  float id = hash21(c + 3.1);
  vec2 d2 = min(f, 1.0 - f); float d = min(d2.x, d2.y);
  if (id > 0.45) {                                   // subdivide some panels once more
    vec2 s = id > 0.75 ? vec2(2.0, 1.0) : vec2(1.0, 2.0); vec2 g = fract(f * s); vec2 e = min(g, 1.0 - g) / s; d = min(d, min(e.x, e.y));
    id = hash21(c + floor(f * s) * 5.3 + 9.7);
  }
  vec2 rv = abs(d2 - 0.085);                          // rivets near panel corners
  float rivet = 1.0 - smoothstep(0.012, 0.026, length(rv));
  return vec4(d, id, rivet, 0.0);
}
float hullH; float hullSeam; float hullId; float hullFade; float hullGr;
void hullEval(){
  vec3 n = abs(vHullN); vec3 P = vHullP * uPanel; vec2 p = n.y > 0.72 ? P.xz : (n.x > n.z ? P.zy : P.xy);
  float fw = max(length(fwidth(p)), 1e-5);
  hullFade = 1.0 - smoothstep(0.08, 0.5, fw);        // fade micro-detail before it aliases
  vec4 pn = hullPanel(p);
  float seam = 1.0 - smoothstep(0.012, 0.012 + fw * 1.5 + 0.006, pn.x);
  hullSeam = seam * hullFade; hullId = pn.y;
  float micro = fbm(p * 9.0) * 0.5 + vnoise(p * 41.0) * 0.25;
  float scratch = smoothstep(0.82, 1.0, vnoise(vec2(p.x * 3.0 + p.y * 37.0, p.y * 1.3)));
  hullH = -hullSeam * 1.0 + pn.z * 0.9 * hullFade + (micro * 0.10 - scratch * 0.08) * hullFade;
  float streak = fbm(vec2(vHullP.x * 1.7 + vHullP.z * 1.3, vHullP.y * 0.22)) ;
  hullGr = clamp(fbm3(vHullP * 0.55) * 0.7 + streak * 0.6, 0.0, 1.0);
}
`;

// options: color, metalness, roughness, panel (panels per metre), wear, grime, bump, object (use object space), emissive...
export function hullMaterial(o = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: o.color ?? 0x23272d, metalness: o.metalness ?? 0.8, roughness: o.roughness ?? 0.5, vertexColors: o.vertexColors ?? true,
    side: o.side ?? THREE.FrontSide, envMapIntensity: o.env ?? 1.0, flatShading: !!o.flat,
  });
  if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 1; }
  const U = { uPanel: { value: o.panel ?? 0.8 }, uWear: { value: o.wear ?? 0.5 }, uGrime: { value: o.grime ?? 0.5 }, uBumpK: { value: o.bump ?? 1.0 } };
  m.userData.U = U;
  if (o.object) m.defines = { ...(m.defines || {}), HULL_OBJECT: 1 };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U, { uTime: G.uTime, uWake: G.uWake });
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\n' + HULL_PARS_V)
      .replace('#include <project_vertex>', HULL_V + '\n#include <project_vertex>');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + HULL_PARS_F)
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
        hullEval();
        float hullPaint = smoothstep(0.12, 0.35, max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)) - min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b)));
        diffuseColor.rgb *= 0.86 + 0.28 * hullId;                                 // per-panel tone
        diffuseColor.rgb *= mix(1.0, 0.32, hullSeam);                             // dark seams
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.42, 0.40, 0.36), uGrime * smoothstep(0.42, 0.85, hullGr));`)
      .replace('#include <roughnessmap_fragment>', /* glsl */`#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (hullId - 0.5) * 0.22 + uGrime * 0.35 * smoothstep(0.4, 0.9, hullGr) - uWear * 0.12 * hullFade * vnoise(vHullP.xy * 23.0), 0.06, 1.0);`)
      .replace('#include <metalnessmap_fragment>', /* glsl */`#include <metalnessmap_fragment>
        metalnessFactor *= 1.0 - 0.85 * hullPaint;`)
      .replace('#include <normal_fragment_maps>', /* glsl */`#include <normal_fragment_maps>
        { vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(hullH), dhy = dFdy(hullH);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
          normal = normalize(abs(det) * normal - grad * 0.012 * uBumpK); }`);
    if (o.patch) o.patch(s);
  };
  m.customProgramCacheKey = () => 'hull' + (o.object ? 'o' : 'w') + (o.key || '');
  return m;
}

// Unlit HDR emitter (LED strips, indicator lamps). intensity > 1 feeds bloom.
export function glow(color, intensity = 2, opts = {}) {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c, toneMapped: false, fog: opts.fog ?? true, side: opts.side ?? THREE.FrontSide, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !opts.additive });
}

export const std = (color, metalness, roughness, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
