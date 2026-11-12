// Demonstration-master recorder. Records the scripted tour from the RUNNING site, one screenshot per simulated frame.
//   node capture.mjs <out.mkv|.mp4> [--size 3840x2160] [--fps 120] [--from 0] [--to <seconds>] [--codec hevc|h264] [--crf 14] [--keep 600]
// Method: the page runs with ?capture (no requestAnimationFrame). For every output frame the simulation is advanced by
// exactly 1/fps and rendered once at the page's native drawing-buffer size; the composited page (WebGL canvas + HUD) is
// grabbed losslessly (PNG over the DevTools protocol) and piped to ffmpeg. No upscaling, interpolation or frame repetition.
// --from fast-forwards by simulating (not rendering) the earlier frames, so a long take can be recorded in segments.
// Every --keep-th frame is also written as a PNG next to the output (native-resolution evidence).
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2), out = args[0], opt = (k, d) => { const i = args.indexOf('--' + k); return i > 0 ? args[i + 1] : d; };
const [W, H] = opt('size', '3840x2160').split('x').map(Number), fps = Number(opt('fps', 120)), from = Number(opt('from', 0)), codec = opt('codec', 'hevc'), crf = opt('crf', '14'), keep = Number(opt('keep', 600));
const PORT = process.env.PORT || 8787, q = opt('q', 'fidelity');
if (!process.env.FFMPEG) throw new Error('set FFMPEG to the ffmpeg executable');

const browser = await puppeteer.launch({
  executablePath: process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--hide-scrollbars', '--mute-audio', `--window-size=${W},${H}`, '--force-device-scale-factor=1'],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 }, protocolTimeout: 900000,
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${PORT}/?capture&director=film&q=${q}`, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 600000 });
const info0 = await page.evaluate(() => window.__info());
const to = Number(opt('to', info0.directorLen));
const f0 = Math.round(from * fps), f1 = Math.round(to * fps), total = f1 - f0;
if (info0.buffer[0] !== W || info0.buffer[1] !== H || info0.scene[0] !== W || info0.scene[1] !== H) throw new Error(`drawing buffer ${info0.buffer} / scene target ${info0.scene} is not ${W}x${H}`);
console.log(`capture ${W}x${H} @ ${fps} fps, frames ${f0}..${f1 - 1} (${total}), profile ${info0.profile}, msaa ${info0.msaa}`);

const vcodec = codec === 'h264'
  ? ['-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-profile:v', 'high']
  : ['-c:v', 'libx265', '-preset', 'medium', '-crf', crf, '-pix_fmt', 'yuv420p10le', '-tag:v', 'hvc1', '-x265-params', `log-level=error:keyint=${fps}:min-keyint=${fps}:scenecut=0`];
const ff = spawn(process.env.FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
  ...vcodec, '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', '-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
let ffExit = null; ff.on('close', (c) => { ffExit = c; });

if (f0 > 0) await page.evaluate((dt, n) => window.__step(dt, n), 1 / fps, f0);
const cdp = await page.createCDPSession();
const log = [], t0 = Date.now(), stillDir = path.join(path.dirname(out), path.basename(out).replace(/\.[^.]+$/, '') + '_frames');
if (keep) fs.mkdirSync(stillDir, { recursive: true });
for (let i = 0; i < total; i++) {
  const st = await page.evaluate((dt) => { window.__frame(dt); const x = window.__info(); return [x.buffer[0], x.buffer[1], x.scene[0], x.scene[1], x.frame, x.T]; }, 1 / fps);
  if (st[0] !== W || st[1] !== H || st[2] !== W || st[3] !== H) throw new Error(`frame ${f0 + i}: buffer changed to ${st}`);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  const buf = Buffer.from(data, 'base64');
  if (buf.readUInt32BE(16) !== W || buf.readUInt32BE(20) !== H) throw new Error(`frame ${f0 + i}: screenshot is ${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`);
  if (ffExit !== null) throw new Error('ffmpeg exited early: ' + ffExit);
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (keep && (f0 + i) % keep === 0) fs.writeFileSync(path.join(stillDir, `frame_${String(f0 + i).padStart(5, '0')}.png`), buf);
  if (i % 120 === 0) { const el = (Date.now() - t0) / 1000; console.log(`frame ${f0 + i} (${i}/${total})  T=${st[5].toFixed(3)}  ${el.toFixed(0)} s elapsed, ${(el / (i + 1)).toFixed(2)} s/frame`); }
  log.push(st[4]);
}
ff.stdin.end();
await new Promise((r) => (ffExit !== null ? r() : ff.on('close', r)));
if (ffExit !== 0) { await browser.close(); throw new Error(`ffmpeg exited with code ${ffExit}; no completion record written for ${out}`); }
const meta = { out: path.basename(out), width: W, height: H, fps, firstFrame: f0, frames: total, seconds: total / fps, dt: 1 / fps, codec, crf, profile: info0.profile, msaa: info0.msaa, sceneTarget: info0.scene, drawingBuffer: info0.buffer,
  simFrameFirst: log[0], simFrameLast: log[log.length - 1], wallSeconds: (Date.now() - t0) / 1000, userAgent: await page.evaluate(() => navigator.userAgent), date: new Date().toISOString(),
  method: 'fixed-step 1/fps simulation, one native-resolution render and one lossless PNG screenshot per output frame, piped to ffmpeg' };
fs.writeFileSync(out.replace(/\.[^.]+$/, '') + '.capture.json', JSON.stringify(meta, null, 1));
await browser.close();
console.log('done', JSON.stringify(meta));
