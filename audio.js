/* Synthesized boot score. No audio files, no network. */
(function (scope) {
  'use strict';
  let ctx, master, generation = 0;
  function AudioCtor() {
    return scope.AudioContext || scope.webkitAudioContext;
  }
  function ensure() {
    const Ctor = AudioCtor();
    if (!Ctor) return null;
    if (!ctx || ctx.state === 'closed') {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.18;
      master.connect(ctx.destination);
    }
    return ctx;
  }
  function tone(when, freq, dur, type, gain, slide) {
    if (when < ctx.currentTime - 0.02) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, when);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain || 0.07, when + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g); g.connect(master);
    osc.start(when); osc.stop(when + dur + 0.03);
  }
  function whoosh(when, dur, gain) {
    if (when < ctx.currentTime - 0.02) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(280, when);
    filter.frequency.exponentialRampToValueAtTime(2200, when + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain || 0.1, when + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(when); src.stop(when + dur);
  }
  function play(options) {
    const from = Math.max(0, Number(options && options.from) || 0);
    const duration = Math.max(3000, Number(options && options.duration) || 12000);
    const muted = Boolean(options && options.muted);
    const rich = options && options.rich !== false;
    stop();
    if (muted || !ensure()) return;
    const id = ++generation;
    ctx.resume().catch(() => {});
    const scale = duration / 12000;
    const t0 = ctx.currentTime - (from / 1000) * scale;
    const at = sec => t0 + sec * scale;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(rich ? 0.2 : 0.1, ctx.currentTime);
    whoosh(at(0.05), 1.1, rich ? 0.12 : 0.06);
    tone(at(1.12), 720, 0.16, 'triangle', 0.06);
    tone(at(1.28), 1080, 0.12, 'sine', 0.04);
    tone(at(2.35), 540, 0.18, 'sine', 0.045);
    if (rich) {
      whoosh(at(4.18), 0.9, 0.1);
      for (let i = 0; i < 8; i++) tone(at(4.45 + i * 0.28), 980 + i * 40, 0.07, 'square', 0.018);
      tone(at(7.18), 220, 1.4, 'sine', 0.07, 440);
      tone(at(7.22), 1320, 0.35, 'triangle', 0.05);
    } else {
      tone(at(4.2), 640, 0.2, 'sine', 0.04);
      tone(at(7.2), 880, 0.25, 'sine', 0.04);
    }
    whoosh(at(10.95), 0.85, rich ? 0.11 : 0.05);
    tone(at(11.55), 180, 0.22, 'sine', 0.05, 90);
    setTimeout(() => { if (id === generation && master) master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05); }, duration + 80);
  }
  function stop() {
    generation += 1;
    if (!master || !ctx) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value || 0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
  }
  const api = {play, stop};
  if (typeof module !== 'undefined') {
    module.exports = api;
    return;
  }
  scope.aemeathAudio = api;
})(typeof window === 'undefined' ? {} : window);
