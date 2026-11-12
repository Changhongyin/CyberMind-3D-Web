// DOM interface: loading / failure states, ring chips, prompt line, thought readout, inspection card, 3D-anchored marks.
import * as THREE from 'three';
import { RING_GLYPHS, RING_NAMES, FONT_KAI, FONT_HEI } from './textures.js';

const $ = (id) => document.getElementById(id);
const RING_CSS = ['#5fe6ff', '#ff5aa0', '#ffb85c'];
const PHASE = {
  dormant: ['第九井 · 傀-7 · 封存中 SEALED', '拖动光环，让三枚字牌各自归位。', 'Drag each ring until its glyph sits under the claw at twelve o’clock.'],
  opening: ['第九井 · 傀-7 · 启封 UNSEALING', '……', ''],
  awake: ['第九井 · 傀-7 · 清醒 AWAKE', '点击字鼓，改写它的念头。', 'Click a glyph drum to turn its thought. Marks ◇ lead closer.'],
  closing: ['第九井 · 傀-7 · 归眠 SEALING', '……', ''],
};

export class UI {
  constructor() { this.marks = new Map(); this.v = new THREE.Vector3(); this.api = null; this.promptKey = ''; this.toastT = 0; }
  async fontsReady() { try { await Promise.race([Promise.all([document.fonts.load(`40px ${FONT_KAI}`, '机心忆感志'), document.fonts.load(`20px ${FONT_HEI}`, '机心')]), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* system fonts only */ } }
  progress(k, msg) { $('bar').style.width = `${Math.round(k * 100)}%`; if (msg) $('lmsg').textContent = msg; }
  warn(zh, en) { $('lwarn').innerHTML += `${zh}<br><span class="dim">${en}</span><br>`; this.toast(zh); }
  fatal(zh, en, keep) { $('f-zh').textContent = zh; $('f-en').textContent = en; $('fatal').hidden = false; if (!keep) $('loading').classList.add('out'); }
  ready(onEnter) {
    const b = $('b-enter'); b.hidden = false; b.focus();
    const go = () => { $('loading').classList.add('out'); $('hud').hidden = false; onEnter(); document.getElementById('gl').focus(); setTimeout(() => { $('loading').style.display = 'none'; }, 1300); };
    b.addEventListener('click', go, { once: true });
  }
  captureMode() { document.body.classList.add('capture'); $('loading').style.display = 'none'; $('hud').hidden = false; }

  bind(api) {
    this.api = api;
    $('b-tour').onclick = () => api.tour(!$('b-tour').classList.contains('on'));
    $('b-sound').onclick = () => api.toggleSound();
    $('b-quality').onclick = () => this.togglePanel('p-quality'); $('b-help').onclick = () => this.togglePanel('p-help');
    $('b-back').onclick = () => api.home(); $('b-act').onclick = () => api.toggleWake();
    const R = $('rings'); R.innerHTML = '';
    RING_GLYPHS.forEach((g, i) => { const b = document.createElement('button'); b.style.setProperty('--c', RING_CSS[i]); b.title = `${g} ${RING_NAMES[i]} — 按 ${i + 1}`; b.innerHTML = `<span class="g">${g}</span><span class="t"><b>${RING_NAMES[i]}</b><em style="font-style:normal">未合 · OPEN</em></span>`; b.onclick = () => api.alignRing(i); R.appendChild(b); });
    const G = $('glyphs'); G.innerHTML = '';
    for (let i = 0; i < 4; i++) { const b = document.createElement('button'); b.title = '点击换字 · click to turn'; b.onclick = (e) => api.stepDrum(i, e.shiftKey ? -1 : 1); G.appendChild(b); }
    this.phase('dormant');
  }
  togglePanel(id) { for (const p of ['p-quality', 'p-help']) $(p).hidden = p === id ? !$(p).hidden : true; }
  closePanels() { $('p-quality').hidden = true; $('p-help').hidden = true; }
  quality(name, P) {
    $('q-name').textContent = name.toUpperCase(); const box = $('p-quality'); box.innerHTML = '<h3>画质档位 · Quality profile</h3>';
    for (const k of Object.keys(P)) { const b = document.createElement('button'); b.className = 'qopt' + (k === name ? ' on' : ''); b.innerHTML = `<b>${P[k].name}</b><span>${P[k].note}</span>`; b.onclick = () => this.api && this.api.setProfile(k); box.appendChild(b); }
    const p = document.createElement('p'); p.className = 'dim'; p.textContent = '左下角读数显示实际内部渲染分辨率。低于 100% 的档位为放大输出，并非原生分辨率。'; box.appendChild(p);
  }
  sound(on) { $('b-sound').innerHTML = on ? '有声<small>SOUND ON</small>' : '静音<small>SOUND OFF</small>'; $('b-sound').classList.toggle('on', on); }
  tour(on) { $('b-tour').classList.toggle('on', on); $('b-tour').innerHTML = on ? '停止<small>STOP TOUR</small>' : '导览<small>TOUR</small>'; }
  hud(on) { $('hud').classList.toggle('off', !on); }
  phase(ph) {
    document.body.classList.remove('dormant', 'opening', 'awake', 'closing'); document.body.classList.add(ph);
    $('state').lastElementChild.textContent = PHASE[ph][0]; this.setPrompt(PHASE[ph][1], PHASE[ph][2]);
    $('thought').hidden = ph !== 'awake'; this.actState(ph);
  }
  actState(ph, allLocked) {
    const b = $('b-act');
    if (ph === 'awake') { b.hidden = false; b.innerHTML = '封存<small>SEAL · SPACE</small>'; b.style.bottom = '8.25rem'; b.style.left = 'calc(50% + 13.2rem)'; b.style.animation = 'none'; b.style.fontSize = '.82rem'; b.style.padding = '.55rem .9rem'; }
    else if (ph === 'dormant' && allLocked) { b.hidden = false; b.innerHTML = '启封<small>UNSEAL · SPACE</small>'; b.style.bottom = ''; b.style.left = ''; b.style.animation = ''; b.style.fontSize = ''; b.style.padding = ''; }
    else b.hidden = true;
  }
  rings(rings) {
    const bs = $('rings').children; let n = 0;
    rings.forEach((R, i) => { if (!bs[i]) return; bs[i].classList.toggle('locked', R.locked); bs[i].querySelector('em').textContent = R.locked ? '已合 · LOCKED' : '未合 · OPEN'; if (R.locked) n++; });
    if (document.body.classList.contains('dormant')) { this.actState('dormant', n === 3); if (n === 3) this.setPrompt('三环已合。点击面壳，启封机心。', 'All three rings aligned — click the face, or press Space, to unseal.'); else if (n > 0) this.setPrompt(`已合 ${n} / 3。继续转动其余光环。`, `${n} of 3 aligned. Turn the remaining rings.`); else this.setPrompt(PHASE.dormant[1], PHASE.dormant[2]); }
  }
  setPrompt(zh, en) { const k = zh + en; if (k === this.promptKey) return; this.promptKey = k; const p = $('prompt'); p.firstElementChild.textContent = zh; p.lastElementChild.textContent = en; p.classList.remove('swap'); void p.offsetWidth; p.classList.add('swap'); }
  flash(zh, en) { this.setPrompt(zh, en); }
  toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(this.toastT); this.toastT = setTimeout(() => t.classList.remove('on'), 2600); }
  thought(line, idx) {
    const bs = $('glyphs').children; if (!bs.length) return;
    line.forEach((g, i) => { if (bs[i].textContent !== g) { bs[i].textContent = g; bs[i].classList.remove('tick'); void bs[i].offsetWidth; bs[i].classList.add('tick'); } });
    $('idx').textContent = `念头 LINE ${String(idx + 1).padStart(4, '0')} / 4096`;
  }
  inspect(h) {
    const c = $('card'); if (!h) { c.hidden = true; return; }
    $('card-en').textContent = h.en; $('card-zh').textContent = h.zh; $('card-body').textContent = h.body; $('card-sub').textContent = h.sub; c.hidden = true; void c.offsetWidth; c.hidden = false;
  }
  hover(p, S) { this.hoverHot = p && p.type === 'hot' ? p.id : null; }
  perf(fps, sw, sh, cw, ch, prof, scale, info) {
    $('perf').textContent = `${fps.toFixed(0)} FPS · 内部 ${sw}×${sh}${scale < 0.999 ? ` (${Math.round(scale * 100)}% → ${cw}×${ch})` : ' 原生'} · ${prof.msaa ? prof.msaa + '×MSAA' : 'NO MSAA'} · ${info.calls} calls · ${(info.triangles / 1e6).toFixed(2)}M tris`;
  }
  bench(o) { const b = $('bench'); b.hidden = false; b.textContent = 'BENCHMARK RESULT — copy this block (click outside to close)\n\n' + JSON.stringify(o, null, 1); b.onclick = (e) => e.stopPropagation(); setTimeout(() => window.addEventListener('pointerdown', (e) => { if (!b.contains(e.target)) b.hidden = true; }, { once: false }), 500); }

  // per-frame: place the inspection marks over their 3D anchors
  frame(camera, S, HOT, canvas) {
    const w = canvas.clientWidth, h = canvas.clientHeight, box = $('marks'), mode = S.phase === 'awake' ? 'awake' : S.phase === 'dormant' ? 'dormant' : 'none';
    for (const hs of HOT) {
      let m = this.marks.get(hs.id);
      if (!m) { m = document.createElement('button'); m.className = 'mark'; m.innerHTML = `<i></i><span>${hs.zh} · ${hs.en}</span>`; m.onclick = () => this.api && this.api.inspect(hs.id); box.appendChild(m); this.marks.set(hs.id, m); }
      this.v.set(...hs.anchor).project(camera);
      const on = hs.when.includes(mode) && S.inspect !== hs.id && this.v.z < 1 && Math.abs(this.v.x) < 0.94 && Math.abs(this.v.y) < 0.9 && !S.tourHide;
      m.classList.toggle('vis', on); m.tabIndex = on ? 0 : -1; m.style.pointerEvents = on ? 'auto' : 'none';
      if (on) m.style.transform = `translate(${((this.v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-this.v.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-0.69rem, -50%)`;
    }
  }
}
