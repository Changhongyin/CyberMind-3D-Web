// Code-drawn textures (canvas 2D): engraved glyph bands, halo scales, neon sign atlas, paper talismans, console screen.
// All text here is fictional set dressing for the world of JIXIN.
import * as THREE from 'three';
import { rng } from './util.js';

export const FONT_KAI = '"Kaiti SC","STKaiti","KaiTi","Songti SC","SimSun","Noto Serif CJK SC",serif';
export const FONT_HEI = '"PingFang SC","Microsoft YaHei","Heiti SC","SimHei","Noto Sans CJK SC",sans-serif';
export const FONT_MONO = '"SF Mono","Cascadia Mono","Consolas","Menlo",monospace';

// The four glyph drums. Any combination reads as a terse four-character line: subject · verb · object · time.
export const DRUM_GLYPHS = [
  ['雨', '城', '灯', '梦', '潮', '铁', '雾', '心'],
  ['记', '忘', '守', '问', '听', '燃', '归', '醒'],
  ['旧', '海', '名', '夜', '光', '路', '人', '火'],
  ['时', '处', '中', '前', '后', '外', '间', '初'],
];
export const RING_GLYPHS = ['忆', '感', '志'];
export const RING_NAMES = ['MEMORY', 'SENSE', 'WILL'];

function tex(canvas, { srgb = true, repeat = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } else { t.wrapS = THREE.RepeatWrapping; }
  return t;
}
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

// Band wrapped around a drum: R = glyph/engraving mask (emissive + bump), drawn white on black.
export function glyphBand(glyphs, seed, scale = 1) {
  const W = 4096 * scale, H = 512 * scale, [c, g] = mk(W, H), r = rng(seed), n = glyphs.length, cw = W / n;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const x = i * cw;
    g.font = `${H * 0.56}px ${FONT_KAI}`; g.fillText(glyphs[i], x + cw / 2, H * 0.5);
    g.lineWidth = 3 * scale; g.strokeRect(x + cw * 0.14, H * 0.14, cw * 0.72, H * 0.72);           // cartouche
    g.lineWidth = 1.5 * scale; g.strokeRect(x + cw * 0.17, H * 0.17, cw * 0.66, H * 0.66);
    g.font = `${H * 0.055}px ${FONT_MONO}`; g.textAlign = 'left';
    g.fillText(`${String(i).padStart(2, '0')}·${(r() * 0xffff | 0).toString(16).toUpperCase().padStart(4, '0')}`, x + cw * 0.15, H * 0.075);
    g.textAlign = 'right'; g.fillText(`θ${(i * 360 / n).toFixed(0)}°`, x + cw * 0.86, H * 0.075); g.textAlign = 'center';
    for (let k = 0; k < 40; k++) {                                                                      // punched data dots between cartouches
      if (r() < 0.55) continue; const px = x + cw * (0.885 + 0.035 * (k % 4)) - cw * 0.0, py = H * (0.16 + 0.07 * Math.floor(k / 4));
      g.beginPath(); g.arc((px + cw * 0.06) % W, py, 2.6 * scale, 0, 7); g.fill();
    }
  }
  for (let i = 0; i < 512; i++) { const x = (i / 512) * W, long = i % 8 === 0; g.fillRect(x, H * 0.925, (long ? 3 : 1.5) * scale, H * (long ? 0.06 : 0.035)); }
  g.fillRect(0, H * 0.905, W, 2 * scale); g.fillRect(0, H * 0.1, W, 2 * scale);
  return tex(c, { srgb: false });
}

// Halo ring scale: one long strip (u = angle). The lock glyph sits at u = 0.25 (top of the ring, see halo.js).
export function haloBand(glyph, seed) {
  const W = 4096, H = 256, [c, g] = mk(W, H), r = rng(seed);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  for (let i = 0; i < 360; i++) { const x = (i / 360) * W, L = i % 30 === 0 ? 0.42 : i % 5 === 0 ? 0.26 : 0.14; g.fillRect(x, 0, i % 30 === 0 ? 4 : 2, H * L); }
  g.font = `${H * 0.2}px ${FONT_MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) { const x = ((i + 0.5) / 12) * W; g.fillText((r() * 0xfffff | 0).toString(16).toUpperCase().padStart(5, '0'), x, H * 0.62); }
  for (let i = 0; i < 180; i++) if (r() < 0.6) g.fillRect((i / 180) * W, H * 0.84, W / 180 * 0.6, H * 0.1);
  return tex(c, { srgb: false });
}

// Single big glyph plate (halo lock plates, HUD-in-world)
export function glyphPlate(glyph, sub) {
  const S = 512, [c, g] = mk(S, S);
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S); g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  g.lineWidth = 6; g.strokeRect(36, 36, S - 72, S - 72); g.lineWidth = 2; g.strokeRect(52, 52, S - 104, S - 104);
  g.font = `${S * 0.56}px ${FONT_KAI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(glyph, S / 2, S * 0.47);
  g.font = `${S * 0.07}px ${FONT_MONO}`; g.fillText(sub, S / 2, S * 0.84);
  const t = tex(c, { srgb: false }); t.wrapS = THREE.ClampToEdgeWrapping; return t;
}

// 4x4 atlas of fictional neon shop / district signs. rgb = colour, drawn on black (additive).
export const SIGNS = [
  ['雾港电力', '#33e0ff'], ['忆库', '#ff3d7f'], ['夜航', '#ffb347'], ['长明', '#7dffcf'], ['第九井', '#ff5a36'], ['归零茶室', '#ffd27a'], ['梦典当', '#c77dff'], ['神经维修', '#3df2ff'],
  ['潮音', '#ff4fa3'], ['北冥数据', '#59a8ff'], ['云脚旅店', '#ffcf5a'], ['青鸟速递', '#52ffb8'], ['不夜面馆', '#ff7a45'], ['义体 · 骨科', '#8fd3ff'], ['机心局', '#ffe9a8'], ['万象回收', '#ff5c8a'],
];
export function signAtlas() {
  const S = 2048, [c, g] = mk(S, S), cell = S / 4;
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S); g.textAlign = 'center'; g.textBaseline = 'middle';
  SIGNS.forEach(([txt, col], i) => {
    const x = (i % 4) * cell, y = Math.floor(i / 4) * cell, chars = [...txt.replace(/ /g, '')], n = chars.length, vertical = true;
    g.save(); g.translate(x, y); g.strokeStyle = col; g.fillStyle = col; g.shadowColor = col;
    const w = cell * 0.30, x0 = cell / 2 - w / 2;
    g.shadowBlur = 18; g.lineWidth = 7; g.strokeRect(x0, 24, w, cell - 48);
    g.shadowBlur = 10; const fs = Math.min(w * 0.74, (cell - 80) / n * 0.92); g.font = `bold ${fs}px ${FONT_HEI}`;
    chars.forEach((ch, k) => g.fillText(ch, cell / 2, 40 + ((cell - 80) / n) * (k + 0.5)));
    g.restore();
  });
  const t = tex(c); t.wrapS = THREE.ClampToEdgeWrapping; return t;
}

// 8 paper talisman strips in a row (u). R = paper albedo, drawn in colour; glyph ink is saturated red so the shader can key it.
export function talismanAtlas() {
  const W = 2048, H = 1024, [c, g] = mk(W, H), r = rng(77), n = 8, cw = W / n;
  const lines = ['敕令机心安眠', '第九井镇守', '忆不外泄', '雨落无声', '勿扰其梦', '归零复始', '万念俱寂', '启封须三环'];
  for (let i = 0; i < n; i++) {
    const x = i * cw; const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#d9c58a'); gr.addColorStop(1, '#b89d5e');
    g.fillStyle = gr; g.fillRect(x + 6, 0, cw - 12, H);
    for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(${90 + r() * 60 | 0},${70 + r() * 40 | 0},${30 + r() * 30 | 0},${0.05 + r() * 0.08})`; g.fillRect(x + 6 + r() * (cw - 12), r() * H, 1 + r() * 14, 1 + r() * 3); }
    g.strokeStyle = '#e01818'; g.fillStyle = '#e01818'; g.lineWidth = 5; g.strokeRect(x + 26, 30, cw - 52, H - 60);
    g.beginPath(); g.arc(x + cw / 2, 96, 36, 0, 7); g.stroke(); g.beginPath(); g.moveTo(x + cw / 2 - 24, 96); g.lineTo(x + cw / 2 + 24, 96); g.moveTo(x + cw / 2, 72); g.lineTo(x + cw / 2, 120); g.stroke();
    const chars = [...lines[i]], fs = Math.min(cw * 0.52, (H - 260) / chars.length * 0.95); g.font = `${fs}px ${FONT_KAI}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    chars.forEach((ch, k) => g.fillText(ch, x + cw / 2, 180 + ((H - 260) / chars.length) * (k + 0.5)));
    g.font = `22px ${FONT_MONO}`; g.fillText(`No.${(r() * 9999 | 0).toString().padStart(4, '0')}`, x + cw / 2, H - 48);
  }
  const t = tex(c); t.wrapS = THREE.ClampToEdgeWrapping; return t;
}

// Technician console screen (static layer; the shader adds the moving scan/cursor).
export function consoleScreen() {
  const W = 1024, H = 640, [c, g] = mk(W, H), r = rng(5);
  g.fillStyle = '#020608'; g.fillRect(0, 0, W, H); g.fillStyle = '#7dffe0'; g.strokeStyle = '#7dffe0';
  g.font = `bold 44px ${FONT_HEI}`; g.fillText('机心局 · 第九井', 36, 64);
  g.font = `20px ${FONT_MONO}`; g.fillText('JIXIN BUREAU / WELL-09 / NIGHT SHIFT CONSOLE', 36, 100);
  g.fillRect(36, 116, W - 72, 2);
  const rows = ['UNIT      傀-7  "KUI-7"  MUNICIPAL COGNITION', 'STATE     封存 SEALED  ·  since 2187-03-11', 'DRUMS     4 × 8 glyph  ·  4096 lines', 'REEDS     96 tuned  ·  pentatonic', 'RINGS     忆 MEMORY  /  感 SENSE  /  志 WILL', 'NOTE      三环合一方可启封  ALIGN ALL THREE', '', '> 夜班记录: 雨未停。它在做梦。'];
  rows.forEach((s, i) => { g.font = `24px ${FONT_MONO}`; g.fillText(s, 36, 168 + i * 40); });
  for (let i = 0; i < 64; i++) { const h = 12 + r() * 86; g.fillRect(36 + i * 15, H - 40 - h, 9, h); }
  g.font = `16px ${FONT_MONO}`; g.fillText('FICTIONAL ARCHIVE · 虚构档案 — not live telemetry', 36, H - 14);
  const t = tex(c); t.wrapS = THREE.ClampToEdgeWrapping; return t;
}

// Soft round sprite (mist, glow)
export function softDot() {
  const S = 128, [c, g] = mk(S, S), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.42)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S); const t = tex(c, { srgb: false }); t.wrapS = THREE.ClampToEdgeWrapping; return t;
}
