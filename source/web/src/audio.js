// Synthesised sound (Web Audio, no samples): rain bed, low hum, music-box reeds, ring ticks and locks, wake swell.
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
export class Sound {
  constructor() { this.enabled = true; this.ctx = null; this.master = null; }
  unlock() {
    if (!this.enabled || this.ctx) { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      const c = this.ctx = new AC(); this.master = c.createGain(); this.master.gain.value = 0.0; this.master.connect(c.destination);
      this.master.gain.linearRampToValueAtTime(0.8, c.currentTime + 1.5);
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); let s = 1234567;
      for (let i = 0; i < len; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
      this.noise = buf;
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.4;
      this.rainG = c.createGain(); this.rainG.gain.value = 0.05; src.connect(bp).connect(this.rainG).connect(this.master); src.start();
      this.humG = c.createGain(); this.humG.gain.value = 0.05; this.humG.connect(this.master);
      for (const f of [55, 55.6, 110.3]) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(this.humG); o.start(); }
      this.padG = c.createGain(); this.padG.gain.value = 0; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; this.padG.connect(lp).connect(this.master);
      for (const f of [146.83, 220, 293.66, 329.63, 440.5]) { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = c.createGain(); g.gain.value = 0.2; o.connect(g).connect(this.padG); o.start(); }
    } catch (e) { this.ctx = null; }
  }
  toggle() { this.enabled = !this.enabled; if (this.enabled) this.unlock(); else if (this.ctx) { this.ctx.close(); this.ctx = null; } return this.enabled; }
  update(dt, S) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.rainG.gain.setTargetAtTime(0.012 + 0.05 * Math.min(1, Math.abs(S.phase === 'dormant' || S.phase === 'closing' ? 1 : 0.0) + (1 - S.wake) * 0.3), t, 0.4);
    this.padG.gain.setTargetAtTime(0.06 * S.wake, t, 0.6); this.humG.gain.setTargetAtTime(0.04 + 0.03 * S.wake, t, 0.5);
  }
  _tone(freq, dur, type = 'sine', vol = 0.2, slideTo) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  _noise(dur, freq, vol, type = 'highpass') {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f).connect(g).connect(this.master); s.start(t, Math.random() * 1.5, dur + 0.05);
  }
  pluck(drum, glyph, vel = 1) { const f = 196 * Math.pow(2, (PENTA[glyph] + [0, 7, 12, 19][drum]) / 12); this._tone(f, 1.6, 'sine', 0.16 * vel); this._tone(f * 4.02, 0.5, 'sine', 0.05 * vel); this._tone(f * 2, 0.9, 'triangle', 0.04 * vel); this._noise(0.03, 3000, 0.05 * vel); }
  tick() { this._noise(0.025, 4200, 0.06); }
  tickStart() { this._noise(0.2, 900, 0.05, 'bandpass'); }
  lock(i) { this._tone(110, 0.5, 'sine', 0.35, 48); this._noise(0.09, 1200, 0.16, 'lowpass'); const f = [293.66, 369.99, 440][i]; this._tone(f, 2.4, 'sine', 0.14); this._tone(f * 2.01, 1.6, 'sine', 0.06); }
  deny() { this._tone(82, 0.16, 'square', 0.06); setTimeout(() => this._tone(74, 0.22, 'square', 0.06), 170); }
  blip() { this._tone(880, 0.25, 'sine', 0.06); }
  wake() { this._tone(55, 5.5, 'sawtooth', 0.07, 220); this._tone(41, 3.0, 'sine', 0.4, 30); this._noise(1.4, 500, 0.2, 'lowpass'); setTimeout(() => { [293.66, 440, 587.33, 880].forEach((f, k) => setTimeout(() => this._tone(f, 3.2, 'sine', 0.1), k * 240)); }, 1300); }
  sleep() { [880, 587.33, 440, 293.66].forEach((f, k) => setTimeout(() => this._tone(f, 2.2, 'sine', 0.08), k * 300)); this._tone(120, 3.5, 'sine', 0.2, 40); }
}
