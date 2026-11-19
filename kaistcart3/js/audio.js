// Fully synthesised audio (no asset files): hum, wind, belly-slide, thumps, beeps.
export class Sfx {
  constructor() { this.ctx = null; this.muted = false; }
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = .55; this.master.connect(c.destination);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const loop = (type, freq, q) => {
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(this.master); s.start();
      return { f, g };
    };
    this.wind = loop('bandpass', 700, .6);
    this.slide = loop('bandpass', 2600, 3.5);
    this.rumble = loop('lowpass', 160, .7);
    // motor-ish hum: two detuned saws through a low-pass
    this.humF = c.createBiquadFilter(); this.humF.type = 'lowpass'; this.humF.frequency.value = 300;
    this.humG = c.createGain(); this.humG.gain.value = 0;
    this.osc = [c.createOscillator(), c.createOscillator()];
    this.osc.forEach((o, i) => { o.type = 'sawtooth'; o.detune.value = i ? 9 : -9; o.connect(this.humF); o.start(); });
    this.humF.connect(this.humG); this.humG.connect(this.master);
  }
  setMuted(m) { this.muted = m; if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : .55, this.ctx.currentTime, .05); }
  /** speed 0..1, throttle 0/1, slide 0..1, grounded bool, offroad bool, boost bool */
  update(speed, throttle, slide, grounded, offroad, boost) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime, set = (p, v) => p.setTargetAtTime(v, t, .06);
    const f = 48 + speed * 150 + (boost ? 30 : 0);
    this.osc.forEach(o => set(o.frequency, f));
    set(this.humF.frequency, 240 + speed * 900 + throttle * 300);
    set(this.humG.gain, grounded ? .05 + throttle * .07 + speed * .03 : .03);
    set(this.wind.g.gain, speed * speed * .5 + (boost ? .12 : 0));
    set(this.wind.f.frequency, 500 + speed * 900);
    set(this.slide.g.gain, grounded ? slide * .22 : 0);
    set(this.rumble.g.gain, grounded ? (offroad ? .5 : .12) * speed : 0);
  }
  quiet() { this.update(0, 0, 0, false, false, false); }
  thump(power) { // landing / hard hit
    const c = this.ctx; if (!c) return;
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(38, t + .18);
    g.gain.setValueAtTime(Math.min(1, power) * .9, t); g.gain.exponentialRampToValueAtTime(.001, t + .28);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .3);
    this.burst(900, .7, .12, Math.min(1, power) * .35);
  }
  burst(freq, q, dur, vol, type = 'lowpass') {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + .02);
  }
  beep(freq, dur = .16, vol = .3) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .02);
  }
  whoosh() { // boost
    const c = this.ctx; if (!c) return;
    const t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3200, t + .35);
    g.gain.setValueAtTime(.001, t); g.gain.exponentialRampToValueAtTime(.5, t + .08); g.gain.exponentialRampToValueAtTime(.001, t + .6);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + .65);
  }
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.beep(f, .28, .22), i * 130)); }
}
