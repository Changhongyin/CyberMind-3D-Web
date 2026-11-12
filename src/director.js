// Scripted tour. It drives the SAME live scene through the same public actions a visitor uses (align rings, wake,
// turn drums, inspect) and only overrides the camera. Used for the in-site tour (interruptible) and, stepped at a
// fixed 1/120 s, for the demonstration master.
import { clamp } from './util.js';

// camera shots: [t, az, el, dist, [tx,ty,tz], fov]; each array is one continuous move, a new array is a cut
const SHOTS = [
  [[0, -0.62, 0.36, 25.5, [0, 1.2, 0], 40], [4, -0.36, 0.19, 23.5, [0, 0.9, 0], 39], [7.6, -0.10, 0.05, 20.5, [0, 0.6, 0], 38]],
  [[7.6, 0.58, 0.10, 13.5, [0, 1.3, -0.6], 38], [10.8, 0.34, 0.05, 11.5, [0, 1.0, 0], 38], [13.6, 0.14, 0.02, 10, [0, 0.8, 0.5], 38]],
  [[13.6, -0.36, 0.06, 8.6, [0, 0.75, 1.4], 36], [17.5, -0.16, 0.03, 7.4, [0, 0.7, 1.5], 36]],
  [[17.5, 0.02, -0.09, 12, [0, 0.6, 0.3], 38], [22, 0.12, -0.05, 15, [0, 0.6, 0.3], 38], [26.2, 0.24, 0.0, 17, [0, 0.6, 0.3], 38]],
  [[26.2, 0.3, 0.08, 14, [0, 0.6, 0.4], 38], [29.6, -0.35, 0.13, 13, [0, 0.6, 0.4], 38], [33, -0.98, 0.17, 12, [0, 0.6, 0.4], 38]],
  [[33, 0.34, 0.03, 6.0, [0, 0.3, 0.3], 36], [36.5, 0.2, 0.02, 5.2, [0, 0.3, 0.3], 36], [40, 0.06, 0.03, 4.5, [0, 0.35, 0.3], 36]],
  [[40, -0.5, 0.12, 1.5, [0.74, 0.27, 1.2], 32], [45, -0.26, 0.07, 1.1, [0.74, 0.27, 1.2], 32]],
  [[45, -0.5, 0.2, 3.3, [0, 3.15, 0.06], 34], [50, -0.08, 0.3, 2.6, [0, 3.2, 0.06], 34]],
  [[50, -0.55, 0.16, 8.5, [0, 0.8, 0], 38], [54, -0.1, 0.3, 17, [0, 0.2, 0], 38], [58.5, 0.34, 0.43, 26, [0, -0.6, 0], 38]],
];
const EVENTS = [
  [3.0, (a) => a.alignRing(0)], [6.2, (a) => a.alignRing(1)], [9.2, (a) => a.alignRing(2)],
  [16.2, (a) => a.wake()],
  [33.2, (a) => a.card('drums')], [34.4, (a) => a.stepDrum(0)], [35.9, (a) => a.stepDrum(2)], [37.3, (a) => a.stepDrum(1)], [38.7, (a) => a.stepDrum(0)],
  [40.0, (a) => a.card('reeds')], [41.0, (a) => a.stepDrum(1)], [42.4, (a) => a.stepDrum(1)], [43.7, (a) => a.stepDrum(1, -1)],
  [45.0, (a) => a.card('seed')], [46.5, (a) => a.stepDrum(0)], [48.3, (a) => a.stepDrum(0)],
  [50.0, (a) => a.card(null)], [52.0, (a) => a.stepDrum(3)], [55.0, (a) => a.stepDrum(1)],
];
const AWAKE_FROM = 26.2;

function hermite(keys, t, idx) {
  let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const k0 = keys[i], k1 = keys[i + 1], h = k1[0] - k0[0], u = clamp((t - k0[0]) / h);
  const get = (k) => (idx.length === 2 ? k[idx[0]][idx[1]] : k[idx[0]]);
  const p0 = get(k0), p1 = get(k1), pm = i > 0 ? get(keys[i - 1]) : null, pn = i < keys.length - 2 ? get(keys[i + 2]) : null;
  const m0 = pm === null ? 0 : ((p1 - pm) / (k1[0] - keys[i - 1][0])) * h, m1 = pn === null ? 0 : ((pn - p0) / (keys[i + 2][0] - k0[0])) * h;
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1;
}

export class Director {
  constructor({ S, rig, api }) { this.S = S; this.rig = rig; this.api = api; this.active = false; this.done = false; this.t = 0; this.ei = 0; this.mode = 'tour'; this.length = SHOTS[SHOTS.length - 1].at(-1)[0]; }
  start(mode) {
    this.mode = mode; this.active = true; this.done = false; this.S.tourHide = true;
    this.t = this.S.phase === 'awake' ? AWAKE_FROM : 0;
    if (this.S.phase === 'opening' || this.S.phase === 'closing') this.t = 17.5;
    this.ei = EVENTS.findIndex((e) => e[0] >= this.t); if (this.ei < 0) this.ei = EVENTS.length;
  }
  stop() { this.active = false; this.S.tourHide = false; this.api.card(null); }
  update(dt) {
    this.t += dt;
    while (this.ei < EVENTS.length && EVENTS[this.ei][0] <= this.t) { EVENTS[this.ei][1](this.api); this.ei++; }
    if (this.t >= this.length) { this.done = true; if (this.mode === 'tour') { this.api.tour(false); return; } }
    const t = Math.min(this.t, this.length); let shot = SHOTS[0]; for (const s of SHOTS) if (t >= s[0][0]) shot = s;
    const r = this.rig; r.az = hermite(shot, t, [1]); r.el = hermite(shot, t, [2]); r.dist = hermite(shot, t, [3]); r.fov = hermite(shot, t, [5]);
    r.tgt.set(hermite(shot, t, [4, 0]), hermite(shot, t, [4, 1]), hermite(shot, t, [4, 2]));
  }
}
