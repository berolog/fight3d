// Tiny synthesized sound effects (no audio files needed).
export class Sfx {
  constructor() { this.ctx = null; }

  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _noise(dur, type, f0, f1, vol, q = 1) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const flt = c.createBiquadFilter(); flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur);
  }

  _tone(dur, f0, f1, vol, type = 'sine') {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur);
  }

  hit(heavy, counter) {
    this._noise(heavy ? 0.22 : 0.12, 'lowpass', heavy ? 2200 : 3000, 200, heavy ? 1.0 : 0.7);
    this._tone(heavy ? 0.3 : 0.15, heavy ? 120 : 180, 40, heavy ? 0.9 : 0.5);
    if (counter) this._tone(0.25, 900, 600, 0.15, 'triangle');
  }
  block() { this._noise(0.08, 'bandpass', 1800, 900, 0.6, 3); this._tone(0.06, 500, 300, 0.2, 'square'); }
  swoosh(k) { this._noise(k >= 2 ? 0.22 : 0.13, 'bandpass', 600, 2500, k >= 2 ? 0.35 : 0.22, 2); }
  ko() { this._tone(1.2, 90, 30, 1.0); this._noise(0.6, 'lowpass', 800, 60, 0.6); }
  superCharge() { this._tone(0.5, 200, 900, 0.3, 'sawtooth'); this._noise(0.5, 'bandpass', 400, 3000, 0.4, 2); }
  bell() { this._tone(0.9, 1320, 1300, 0.25, 'triangle'); this._tone(0.9, 660, 655, 0.2); }
}
