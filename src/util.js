// Small shared helpers: seeded RNG, easing, damping, geometry merge with per-vertex tags.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function rng(seed) {            // mulberry32 — deterministic, used for every "random" layout decision
  let a = seed >>> 0;
  const f = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.int = (lo, hi) => Math.floor(f.range(lo, hi + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.sign = () => (f() < 0.5 ? -1 : 1);
  return f;
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));
export const wrapPi = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };

// --- geometry builder: collects transformed primitives, merges them into one BufferGeometry.
// Each piece gets a vertex colour (rgb = tint, used by the hull shader) so one draw call can show several finishes.
export class Builder {
  constructor() { this.parts = []; this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); }
  add(geo, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1], col = [1, 1, 1]) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    this.e.set(rot[0], rot[1], rot[2]); this.q.setFromEuler(this.e);
    this.m.compose(new THREE.Vector3(...pos), this.q, new THREE.Vector3(...(typeof scl === 'number' ? [scl, scl, scl] : scl)));
    g.applyMatrix4(this.m);
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    this.parts.push(g); return this;
  }
  box(w, h, d, pos, rot, col) { return this.add(new THREE.BoxGeometry(w, h, d), pos, rot, 1, col); }
  cyl(rt, rb, h, seg, pos, rot, col, open = false) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), pos, rot, 1, col); }
  torus(R, r, pos, rot, col, seg = 48, tube = 10, arc = Math.PI * 2) { return this.add(new THREE.TorusGeometry(R, r, tube, seg, arc), pos, rot, 1, col); }
  // straight tube between two points
  rod(a, b, r, col, seg = 8) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va), len = d.length();
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1, false).toNonIndexed();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    g.applyMatrix4(new THREE.Matrix4().compose(va.add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
    return this.add(g, [0, 0, 0], [0, 0, 0], 1, col);
  }
  build() { const g = mergeGeometries(this.parts, false); this.parts.forEach((p) => p.dispose()); this.parts = []; g.computeBoundingSphere(); return g; }
}

// tube along a sagging cable between two points
export function cableCurve(a, b, sag, n = 24) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(new THREE.Vector3(lerp(a.x, b.x, t), lerp(a.y, b.y, t) - sag * 4 * t * (1 - t), lerp(a.z, b.z, t))); }
  return new THREE.CatmullRomCurve3(pts);
}

// GLSL snippets shared by custom shaders
export const GLSL_NOISE = /* glsl */`
float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash31(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y); }
float vnoise3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y);
  float b = mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y);
  return mix(a, b, f.z); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vnoise3(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;
