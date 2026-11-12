// Offline soundtrack for the demonstration master, made with the SAME synthesiser the website uses (src/audio.js).
//   node soundtrack.mjs <out.wav> [frames=7020] [fps=120]
// 1. Opens the site in capture mode with the scripted film (?capture&director=film), exactly like capture.mjs.
// 2. Wraps the Sound class methods (module singleton, imported again from the same URL) so every sound call the
//    simulation makes is logged with its simulation frame. The page itself is not modified.
// 3. Steps the simulation with the recorder's fixed 1/fps step (no rendering needed: sound never depends on pixels).
//    Video frame index v of the master corresponds to simulation frame v + 2 (one warm-up step at boot + one per frame),
//    so each event is placed at time (simFrame - 2) / fps, i.e. on the first video frame that shows its effect.
// 4. Replays the log through the unchanged Sound code on an OfflineAudioContext (clock proxied to the event time,
//    setTimeout replaced by a sample-accurate queue) and writes a 48 kHz / 16-bit stereo WAV + the event log JSON.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const out = process.argv[2], frames = Number(process.argv[3] || 7020), fps = Number(process.argv[4] || 120);
const browser = await puppeteer.launch({ executablePath: process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--mute-audio', '--window-size=640,360'], defaultViewport: { width: 640, height: 360, deviceScaleFactor: 1 }, protocolTimeout: 1800000 });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${process.env.PORT || 8787}/?capture&director=film&q=performance`, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 600000 });

const result = await page.evaluate(async (frames, fps) => {
  const { Sound } = await import('/src/audio.js');
  const S = window.__api.S, log = [], orig = {};
  const names = ['unlock', 'pluck', 'tick', 'tickStart', 'lock', 'deny', 'blip', 'wake', 'sleep', 'update'];
  for (const n of names) { orig[n] = Sound.prototype[n]; Sound.prototype[n] = function (...a) { if (n === 'update') log.push([S.frame, 'update', S.phase, +S.wake.toFixed(5)]); else log.push([S.frame, n, ...a]); return orig[n].apply(this, a); }; }
  window.__step(1 / fps, frames);
  for (const n of names) Sound.prototype[n] = orig[n];
  const simFirst = 2, end = frames / fps;

  // ---- offline render through the unchanged synthesiser
  let rnd = 12345; Math.random = () => ((rnd = (rnd * 1664525 + 1013904223) >>> 0) / 4294967296);   // deterministic noise offsets
  const SR = 48000, off = new OfflineAudioContext(2, Math.ceil(end * SR), SR);
  let now = 0; const proxy = new Proxy(off, { get(t, p) { if (p === 'currentTime') return now; const v = t[p]; return typeof v === 'function' ? v.bind(t) : v; } });
  const realAC = window.AudioContext, realST = window.setTimeout, queue = [];
  window.AudioContext = function () { return proxy; };
  window.setTimeout = (fn, ms) => { queue.push({ at: now + (ms || 0) / 1000, fn }); return queue.length; };
  const snd = new Sound(); snd.unlock();
  const runQueue = (upTo) => { for (;;) { queue.sort((a, b) => a.at - b.at); if (!queue.length || queue[0].at > upTo) break; const q = queue.shift(); now = q.at; q.fn(); } };
  const counts = {};
  for (const e of log) {
    const t = (e[0] - simFirst) / fps; if (t < 0 || t >= end) continue;
    runQueue(t); now = t;
    if (e[1] === 'update') { snd.update(1 / fps, { phase: e[2], wake: e[3] }); continue; }
    counts[e[1]] = (counts[e[1]] || 0) + 1; snd[e[1]](...e.slice(2));
  }
  runQueue(end);
  window.AudioContext = realAC; window.setTimeout = realST;
  const buf = await off.startRendering();
  // measure, gently limit if needed, encode WAV 16-bit
  const ch = [buf.getChannelData(0), buf.getChannelData(1)]; let peak = 0, ss = 0;
  for (const c of ch) for (let i = 0; i < c.length; i++) { const v = Math.abs(c[i]); if (v > peak) peak = v; ss += c[i] * c[i]; }
  const gain = peak > 0.89 ? 0.89 / peak : 1, n = buf.length, bytes = new Uint8Array(44 + n * 4), dv = new DataView(bytes.buffer);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); wr(8, 'WAVE'); wr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
  dv.setUint32(24, SR, true); dv.setUint32(28, SR * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); wr(36, 'data'); dv.setUint32(40, n * 4, true);
  for (let i = 0, o = 44; i < n; i++) for (const c of ch) { const v = Math.max(-1, Math.min(1, c[i] * gain)); dv.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { wav: btoa(bin), seconds: n / SR, peak, gainApplied: gain, rmsDb: 10 * Math.log10(ss / (2 * n) + 1e-12), counts, events: log.filter((e) => e[1] !== 'update').map((e) => ({ simFrame: e[0], videoTime: +((e[0] - simFirst) / fps).toFixed(4), call: e[1], args: e.slice(2) })), updates: log.filter((e) => e[1] === 'update').length };
}, frames, fps);

fs.writeFileSync(out, Buffer.from(result.wav, 'base64'));
delete result.wav;
result.method = 'site synthesiser (src/audio.js) replayed offline from the simulation event log; event time = (simFrame - 2) / fps';
fs.writeFileSync(out.replace(/\.wav$/, '') + '.events.json', JSON.stringify(result, null, 1));
console.log(JSON.stringify({ seconds: result.seconds, peak: result.peak, gain: result.gainApplied, rmsDb: result.rmsDb.toFixed(1), counts: result.counts, updates: result.updates }));
await browser.close();
