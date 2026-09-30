// Capy Tower — audio: a procedural hip hop soundtrack plus cartoon sfx.
// Pure Web Audio, no samples, no dependencies. MP3s listed in
// music/tracks.json take priority over the procedural beats.
//
//   const audio = createAudio();          // from a user gesture
//   audio.music.start(); audio.sfx.jump(0.7);
//
// createAudio({ ctx: new OfflineAudioContext(...) }) renders offline;
// music.play(i, { offline: true, bars: 16, fromBar: 0 }) then schedules the
// whole range up front.

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// ================= Music data =================
const CHORDS = {
  M7: [0, 4, 7, 11], M9: [0, 4, 7, 11, 14], m7: [0, 3, 7, 10], m9: [0, 3, 7, 10, 14],
  '7': [0, 4, 7, 10], '9': [0, 4, 7, 10, 14], '7b9': [0, 4, 7, 10, 13],
  m11: [0, 3, 7, 10, 17], sus: [0, 5, 7, 10],
};
const SCALES = {
  majp: [0, 2, 4, 7, 9], minp: [0, 3, 5, 7, 10], dor: [0, 2, 3, 5, 7, 9, 10],
};
// pattern strings: X accent, x hit, o ghost, - soft, r hat roll (3 in a step), . rest
const VEL = { X: 1, x: 0.8, o: 0.45, '-': 0.28, r: -1 };
const pat = s => Array.from(s, c => VEL[c] || 0);

// prog: one entry per bar, each [offset from key, chord, start step]
// bass: [step, interval from chord root, length in steps, glide-to interval?]
// hook: two 2-bar motifs, [step 0..31, scale degree, length in steps]
const TRACKS = [
  {
    name: 'Riverbank Bounce', bpm: 96, swing: 0.12, key: 53, scale: 'majp', lead: 'whistle', leadOct: 2,
    prog: [[[0, 'M9', 0]], [[9, 'm9', 0]], [[2, 'm9', 0], [7, '9', 8]], [[0, 'M9', 0], [4, 'm7', 12]]],
    kick: ['X.....x...x.....', 'X.x...x...x..x..'],
    snare: '....X.......X...', hat: 'x-x-x-x-x-x-x-x-', open: '..............x.',
    keys: 'sustain',
    bass: [[0, 0, 3], [6, 0, 2], [10, 7, 2], [14, 12, 2]],
    hook: [
      [[0, 5, 2], [3, 6, 1], [4, 5, 2], [8, 4, 2], [12, 2, 2], [14, 4, 2], [16, 5, 4], [22, 4, 1], [24, 2, 2], [28, 0, 4]],
      [[0, 7, 2], [2, 6, 1], [4, 5, 2], [8, 4, 1], [10, 5, 1], [12, 4, 2], [16, 2, 2], [20, 4, 2], [24, 5, 6]],
    ],
  },
  {
    name: 'Bamboo Boom Bap', bpm: 90, swing: 0.18, key: 57, scale: 'minp', lead: 'pluck', leadOct: 1,
    prog: [[[0, 'm9', 0]], [[5, 'm9', 0]], [[10, '9', 0]], [[3, 'M7', 0], [7, '7b9', 8]]],
    kick: ['X......x.x......', 'X.....x..x..x...'],
    snare: '....X..o....X.o.', hat: 'x-x-x-xox-x-x-xo', open: '......x.......x.',
    keys: 'sustain',
    bass: [[0, 0, 4], [7, 0, 1], [9, 0, 2], [12, -2, 2], [14, -5, 2]],
    hook: [
      [[0, 7, 1], [1, 8, 1], [2, 7, 2], [6, 5, 2], [8, 4, 2], [11, 5, 1], [12, 7, 4], [20, 5, 2], [22, 4, 2], [24, 2, 2], [26, 4, 6]],
      [[0, 9, 1], [1, 10, 1], [2, 9, 2], [6, 7, 2], [8, 8, 2], [11, 7, 1], [12, 5, 4], [20, 4, 2], [22, 2, 2], [24, 0, 8]],
    ],
  },
  {
    name: 'Frostbite Flow', bpm: 86, swing: 0.22, key: 50, scale: 'dor', lead: 'flute', leadOct: 2,
    prog: [[[0, 'm9', 0]], [[8, 'M7', 0]], [[5, 'm9', 0]], [[7, '7b9', 0]]],
    kick: ['X.......x.x.....', 'X..x......x.....'],
    snare: '....X.......X..o', hat: 'x.x.x.x.x.x.x.x.', open: '',
    keys: 'sustain',
    bass: [[0, 0, 6], [8, 0, 1], [10, 7, 3], [14, 5, 2]],
    hook: [
      [[0, 4, 3], [4, 6, 2], [6, 7, 2], [8, 6, 4], [16, 4, 2], [18, 3, 2], [20, 2, 4], [26, 0, 6]],
      [[0, 7, 3], [4, 9, 2], [6, 8, 2], [8, 7, 4], [16, 6, 2], [18, 4, 2], [20, 5, 4], [26, 4, 6]],
    ],
  },
  {
    name: 'Lava Lean', bpm: 84, swing: 0.06, key: 52, scale: 'minp', lead: 'square', leadOct: 1,
    prog: [[[0, 'm9', 0]], [[8, 'M7', 0]], [[5, 'm9', 0]], [[11, '7b9', 0]]],
    kick: ['X.....X...X.....', 'X..X....X.x.....'],
    snare: '........X.......', hat: 'x-x-x-x-x-r-x-xr', open: '......x.........',
    keys: 'sustain', clapOnSnare: true,
    bass: [[0, 0, 5], [6, 0, 2, 12], [10, 7, 4], [14, -2, 2, 0]],
    hook: [
      [[0, 5, 2], [2, 5, 1], [3, 7, 2], [6, 5, 2], [8, 4, 4], [14, 3, 2], [16, 2, 6], [24, 3, 2], [26, 2, 2], [28, 0, 4]],
      [[0, 5, 2], [2, 5, 1], [3, 7, 2], [6, 8, 2], [8, 7, 4], [14, 8, 2], [16, 9, 6], [24, 7, 2], [26, 5, 6]],
    ],
  },
  {
    name: 'Neon Night Cypher', bpm: 100, swing: 0.14, key: 48, scale: 'minp', lead: 'saw', leadOct: 2,
    prog: [[[0, 'm9', 0]], [[8, 'M9', 0]], [[5, 'm9', 0]], [[7, '7b9', 0]]],
    kick: ['X...x.....X.....', 'X.....x.X..x....'],
    snare: '....X.......X...', hat: 'x-xxx-x-x-xxx-x-', open: '......x.......x.',
    keys: '..x.....x.x.....',
    bass: [[0, 0, 2], [3, 0, 1], [6, 12, 2], [10, 7, 2], [13, 10, 3]],
    hook: [
      [[0, 2, 1], [2, 4, 1], [4, 5, 2], [7, 4, 1], [8, 2, 2], [12, 0, 2], [16, 2, 1], [18, 4, 1], [20, 5, 2], [23, 7, 1], [24, 6, 6]],
      [[0, 7, 1], [2, 6, 1], [4, 5, 2], [7, 4, 1], [8, 5, 2], [12, 4, 2], [16, 2, 1], [18, 0, 1], [20, 2, 4], [26, 0, 6]],
    ],
  },
];
for (const tr of TRACKS) {
  tr.kickP = tr.kick.map(pat); tr.snareP = pat(tr.snare); tr.hatP = pat(tr.hat);
  tr.openP = pat(tr.open.padEnd(16, '.'));
  tr.keysP = tr.keys === 'sustain' ? null : pat(tr.keys);
}

// ================= Engine: buses, shared buffers, instruments =================
class Engine {
  constructor(ctx) {
    this.ctx = ctx;
    this.intensity = 0;
    this.muted = false;

    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 10; comp.ratio.value = 2.5;
    comp.attack.value = 0.01; comp.release.value = 0.2;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20;
    lim.attack.value = 0.002; lim.release.value = 0.1;
    const out = ctx.createGain(); out.gain.value = 0.8;
    this.master.connect(comp).connect(lim).connect(out).connect(ctx.destination);

    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 4200; this.musicFilter.Q.value = 0.4;
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.5;
    this.musicBus.connect(this.musicFilter).connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.7;
    this.sfxBus.connect(this.master);

    // short room reverb, shared by music and sfx sends
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(1.3);
    const revTone = ctx.createBiquadFilter(); revTone.type = 'lowpass'; revTone.frequency.value = 5000;
    const revRet = ctx.createGain(); revRet.gain.value = 0.45;
    this.reverb.connect(revTone).connect(revRet).connect(this.master);
    this.sfxSend = ctx.createGain(); this.sfxSend.gain.value = 0.25;
    this.sfxSend.connect(this.reverb);

    const sr = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, sr * 2, sr);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // pre-filtered noise, so a drum hit is just a buffer source + gain
    this.nb = {
      hat: this.colored([['hp', 7000], ['hp', 7000]], 0.45),
      shaker: this.colored([['hp', 5000], ['lp', 8500]], 0.35),
      tamb: this.colored([['hp', 9000], ['hp', 9000]], 0.4),
      snare: this.colored([['hp', 1200], ['hp', 1200], ['lp', 9000]], 0.5),
      clap: this.colored([['hp', 800], ['lp', 2000], ['lp', 2000]], 0.35),
      click: this.colored([['hp', 3000]], 0.5),
      thud: this.colored([['lp', 1200], ['lp', 1200]], 0.5),
    };
    this.vox = this.makeVox();
    this.crackleBuf = this.makeCrackle();
    this.shaper = ctx.createWaveShaper ? this.makeShaperCurve() : null;
  }

  impulse(sec) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return b;
  }
  // white noise through one-pole hp/lp stages, normalised to an rms
  colored(stages, rms) {
    const ctx = this.ctx, sr = ctx.sampleRate, len = sr;
    const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const dt = 1 / sr;
    for (const [type, fc] of stages) {
      const rc = 1 / (2 * Math.PI * Math.min(fc, sr * 0.45));
      if (type === 'hp') {
        const a = rc / (rc + dt); let y = 0, px = 0;
        for (let i = 0; i < len; i++) { const x = d[i]; y = a * (y + x - px); px = x; d[i] = y; }
      } else {
        const a = dt / (rc + dt); let y = 0;
        for (let i = 0; i < len; i++) { y += a * (d[i] - y); d[i] = y; }
      }
    }
    let sum = 0;
    for (let i = 0; i < len; i++) sum += d[i] * d[i];
    const k = rms / Math.sqrt(sum / len);
    for (let i = 0; i < len; i++) d[i] *= k;
    return b;
  }
  // a looping "ahh" vowel for turntable scratches
  makeVox() {
    const ctx = this.ctx, sr = ctx.sampleRate, len = Math.floor(sr * 0.8);
    const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
    const f0 = 160, parts = [];
    for (let h = 1; h <= 24; h++) {
      const f = f0 * h;
      const w = Math.exp(-Math.pow((f - 750) / 260, 2)) + 0.6 * Math.exp(-Math.pow((f - 1150) / 300, 2))
        + 0.3 * Math.exp(-Math.pow((f - 2600) / 420, 2)) + 0.06;
      parts.push([f, w / h * 3]);
    }
    let peak = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr, bend = 1 + 0.08 * Math.sin(t * 7);
      let v = (Math.random() * 2 - 1) * 0.12;
      for (const [f, w] of parts) v += w * Math.sin(2 * Math.PI * f * bend * t);
      d[i] = v; peak = Math.max(peak, Math.abs(v));
    }
    for (let i = 0; i < len; i++) d[i] /= peak;
    return b;
  }
  makeCrackle() {
    const ctx = this.ctx, sr = ctx.sampleRate, len = sr * 4;
    const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.02;
    for (let k = 0; k < 110; k++) {
      const p = Math.floor(Math.random() * (len - 40)), a = (Math.random() < 0.2 ? 0.9 : 0.35) * (Math.random() < 0.5 ? -1 : 1);
      for (let j = 0; j < 30; j++) d[p + j] += a * Math.exp(-j / 4);
    }
    return b;
  }
  makeShaperCurve() {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(2 * x) / Math.tanh(2); }
    return c;
  }
  setMuted(b) {
    this.muted = !!b;
    const g = this.master.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(this.muted ? 0 : 1, t, 0.02);
  }

  // ---------- helpers ----------
  gain(v, dest) { const g = this.ctx.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; }
  osc(type, f, dest) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; if (dest) o.connect(dest); return o; }
  filt(type, f, q, dest) {
    const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f;
    if (q != null) b.Q.value = q; if (dest) b.connect(dest); return b;
  }
  // percussive envelope: silence -> peak in a -> silence after d
  env(param, t, peak, a, d) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    param.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  noiseSrc(t, dur, dest, buf) {
    const s = this.ctx.createBufferSource(); s.buffer = buf || this.noise;
    const room = Math.max(0, s.buffer.duration - dur - 0.06);
    s.connect(dest); s.start(t, Math.random() * room, dur + 0.05);
    return s;
  }

  // ---------- drums ----------
  kick(t, v, dest) {
    const g = this.gain(0, dest), o = this.osc('sine', 160, g);
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    this.env(g.gain, t, 0.95 * v, 0.002, 0.42);
    o.start(t); o.stop(t + 0.5);
    const cg = this.gain(0, dest);
    this.noiseSrc(t, 0.02, cg, this.nb.click);
    this.env(cg.gain, t, 0.22 * v, 0.001, 0.012);
  }
  snare(t, v, dest, send) {
    const g = this.gain(0, dest);
    if (send) g.connect(send);
    this.noiseSrc(t, 0.22, g, this.nb.snare);
    this.env(g.gain, t, 0.42 * v, 0.002, 0.16);
    const bg = this.gain(0, dest), b = this.osc('triangle', 200, bg);
    b.frequency.setValueAtTime(200, t); b.frequency.exponentialRampToValueAtTime(150, t + 0.06);
    this.env(bg.gain, t, 0.32 * v, 0.002, 0.09);
    b.start(t); b.stop(t + 0.15);
  }
  clap(t, v, dest, send) {
    const g = this.gain(0, dest);
    if (send) g.connect(send);
    this.noiseSrc(t, 0.25, g, this.nb.clap);
    const p = g.gain;
    p.setValueAtTime(0.0001, t);
    for (let i = 0; i < 3; i++) {
      p.setValueAtTime(0.35 * v, t + i * 0.012);
      p.exponentialRampToValueAtTime(0.02, t + i * 0.012 + 0.01);
    }
    p.setValueAtTime(0.35 * v, t + 0.036);
    p.exponentialRampToValueAtTime(0.0001, t + 0.2);
  }
  hat(t, v, open, dest, player) {
    const g = this.gain(0, dest);
    this.noiseSrc(t, open ? 0.35 : 0.06, g, this.nb.hat);
    this.env(g.gain, t, (open ? 0.12 : 0.14) * v, 0.001, open ? 0.28 : 0.035);
    if (player) {
      // a closed hat chokes the ringing open one
      if (!open && player.lastOpen && t > player.lastOpenT) {
        const pg = player.lastOpen.gain;
        pg.cancelScheduledValues(t); pg.setValueAtTime(0.03, t); pg.exponentialRampToValueAtTime(0.0001, t + 0.02);
        player.lastOpen = null;
      }
      if (open) { player.lastOpen = g; player.lastOpenT = t; }
    }
  }
  shaker(t, v, dest) {
    const g = this.gain(0, dest);
    this.noiseSrc(t, 0.08, g, this.nb.shaker);
    this.env(g.gain, t, 0.07 * v, 0.008, 0.05);
  }
  tamb(t, v, dest) {
    const g = this.gain(0, dest);
    this.noiseSrc(t, 0.14, g, this.nb.tamb);
    this.env(g.gain, t, 0.1 * v, 0.002, 0.1);
  }

  // ---------- tonal ----------
  bass(t, midi, dur, v, glideTo, dest) {
    const ctx = this.ctx, f = mtof(midi);
    const g = this.gain(0, null);
    if (this.shaper) {                            // soft saturation, 808 grit
      const sh = ctx.createWaveShaper(); sh.curve = this.shaper;
      g.connect(sh); sh.connect(dest);
    } else g.connect(dest);
    const o = this.osc('sine', f, g);
    const h = this.osc('sine', f * 2, this.gain(0.18, g));
    if (glideTo != null) {
      const f2 = mtof(glideTo);
      for (const [osc, k] of [[o, 1], [h, 2]]) {
        osc.frequency.setValueAtTime(f * k, t + dur * 0.55);
        osc.frequency.exponentialRampToValueAtTime(f2 * k, t + dur);
      }
    }
    const p = g.gain;
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(0.55 * v, t + 0.006);
    p.setTargetAtTime(0.38 * v, t + 0.05, 0.15);
    p.setTargetAtTime(0, t + dur, 0.04);
    o.start(t); h.start(t); o.stop(t + dur + 0.3); h.stop(t + dur + 0.3);
  }
  rhodes(t, notes, dur, v, dest, send) {
    const lp = this.filt('lowpass', 2600, 0.5, null);
    const trem = this.gain(0.8, dest);
    if (send) trem.connect(send);
    lp.connect(trem);
    const lfo = this.osc('sine', 5.2, this.gain(0.16, trem.gain));
    lfo.start(t); lfo.stop(t + dur + 0.35);
    const pk = 0.13 * v / Math.sqrt(notes.length);
    for (const m of notes) {
      const f = mtof(m) * (1 + (Math.random() - 0.5) * 0.002);
      const ng = this.gain(0, lp);
      const car = this.osc('sine', f, ng);
      const mg = this.gain(0, car.frequency), mod = this.osc('sine', f, mg);
      mg.gain.setValueAtTime(f * 1.4, t); mg.gain.setTargetAtTime(f * 0.25, t, 0.25);
      const p = ng.gain;
      p.setValueAtTime(0, t);
      p.linearRampToValueAtTime(pk, t + 0.004);
      p.setTargetAtTime(pk * 0.35, t + 0.02, 0.5);
      p.setTargetAtTime(0, t + dur, 0.08);
      const end = t + dur + 0.35;
      for (const o of [car, mod]) { o.start(t); o.stop(end); }
    }
  }
  lead(t, midi, dur, v, type, dest, send) {
    const f = mtof(midi), end = t + dur + 0.4;
    const g = this.gain(0, dest);
    if (send) g.connect(send);
    const p = g.gain;
    const vib = (rate, depth, delay, target) => {
      const l = this.osc('sine', rate, null), lg = this.gain(0, target);
      l.connect(lg); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(depth, t + delay + 0.15);
      l.start(t); l.stop(end);
    };
    if (type === 'pluck') {                       // koto-ish plucked string
      const lp = this.filt('lowpass', 5000, 4, g);
      lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.25);
      for (const d of [-6, 6]) {
        const o = this.osc('sawtooth', f, lp); o.detune.value = d;
        o.frequency.setValueAtTime(f * 0.985, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
        o.start(t); o.stop(end);
      }
      this.env(p, t, 0.16 * v, 0.003, Math.min(dur, 0.4) + 0.15);
      return;
    }
    const oscs = [];
    if (type === 'whistle') {
      const o = this.osc('sine', f, g);
      o.frequency.setValueAtTime(f * 0.96, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      vib(6.2, f * 0.012, 0.08, o.frequency); oscs.push(o);
      const bg = this.gain(0, g); this.noiseSrc(t, 0.06, this.filt('highpass', 3000, 0.7, bg));
      this.env(bg.gain, t, 0.02 * v, 0.005, 0.05);
      p.setValueAtTime(0, t); p.linearRampToValueAtTime(0.13 * v, t + 0.03);
    } else if (type === 'flute') {
      const o = this.osc('triangle', f, g), o2 = this.osc('sine', f * 2, this.gain(0.2, g));
      vib(5, f * 0.009, 0.12, o.frequency); vib(5, f * 0.018, 0.12, o2.frequency); oscs.push(o, o2);
      const bg = this.gain(0.035 * v, g); this.noiseSrc(t, dur, this.filt('bandpass', f * 2, 2, bg));
      p.setValueAtTime(0, t); p.linearRampToValueAtTime(0.13 * v, t + 0.05);
    } else if (type === 'square') {
      const lp = this.filt('lowpass', 1800, 2, g);
      const o = this.osc('square', f, lp); oscs.push(o);
      vib(5.5, f * 0.006, 0.2, o.frequency);
      p.setValueAtTime(0, t); p.linearRampToValueAtTime(0.075 * v, t + 0.005);
    } else {                                      // saw: detuned synth lead
      const lp = this.filt('lowpass', 1200, 3, g);
      lp.frequency.setValueAtTime(1200, t); lp.frequency.exponentialRampToValueAtTime(3200, t + 0.06);
      lp.frequency.exponentialRampToValueAtTime(1600, t + 0.3);
      for (const d of [-8, 8]) { const o = this.osc('sawtooth', f, lp); o.detune.value = d; oscs.push(o); }
      p.setValueAtTime(0, t); p.linearRampToValueAtTime(0.07 * v, t + 0.005);
    }
    p.setTargetAtTime(0, t + dur, 0.05);
    for (const o of oscs) { o.start(t); o.stop(end); }
  }
  scratch(t, dur, v, dest) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.vox; src.loop = true;
    const g = this.gain(0, dest);
    const bp = this.filt('bandpass', 1400, 0.9, g);
    this.filt('highpass', 300, 0.7, bp);
    src.connect(bp);
    const n = Math.max(2, Math.round(dur / 0.09)), st = dur / n;
    const r = src.playbackRate, gp = g.gain, bf = bp.frequency;
    r.setValueAtTime(0.25, t); gp.setValueAtTime(0, t);
    for (let i = 0; i < n; i++) {
      const s = t + i * st;
      r.setValueAtTime(0.25, s); r.linearRampToValueAtTime(1.9, s + st * 0.45); r.linearRampToValueAtTime(0.25, s + st * 0.9);
      bf.setValueAtTime(900, s); bf.linearRampToValueAtTime(2300, s + st * 0.45); bf.linearRampToValueAtTime(900, s + st * 0.9);
      gp.setValueAtTime(0.5 * v, s); gp.setValueAtTime(0, s + st * (i % 2 ? 0.55 : 0.8));   // crossfader cuts
    }
    src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.02);
  }
  brass(t, midis, dur, v, dest, send) {
    const g = this.gain(0, dest);
    if (send) g.connect(send);
    const lp = this.filt('lowpass', 600, 1, g);
    lp.frequency.setValueAtTime(600, t); lp.frequency.exponentialRampToValueAtTime(3200, t + 0.03);
    lp.frequency.exponentialRampToValueAtTime(900, t + dur);
    const pk = v / Math.sqrt(midis.length);
    for (const m of midis) for (const d of [-6, 6]) {
      const o = this.osc('sawtooth', mtof(m), lp); o.detune.value = d; o.start(t); o.stop(t + dur + 0.1);
    }
    const p = g.gain;
    p.setValueAtTime(0, t); p.linearRampToValueAtTime(pk, t + 0.01);
    p.setValueAtTime(pk, t + dur * 0.7); p.linearRampToValueAtTime(0, t + dur);
  }
  airhorn(t, dur, v, dest) {
    const g = this.gain(0, dest), lp = this.filt('lowpass', 3500, 1, g);
    for (const f of [466, 470, 587]) {
      const o = this.osc('sawtooth', f, lp);
      o.frequency.setValueAtTime(f * 0.97, t); o.frequency.linearRampToValueAtTime(f, t + 0.03);
      o.frequency.setValueAtTime(f, t + dur * 0.75); o.frequency.linearRampToValueAtTime(f * 0.93, t + dur);
      o.start(t); o.stop(t + dur + 0.05);
    }
    const p = g.gain;
    p.setValueAtTime(0, t); p.linearRampToValueAtTime(0.09 * v, t + 0.012);
    p.setValueAtTime(0.09 * v, t + dur - 0.03); p.linearRampToValueAtTime(0, t + dur);
  }
  bell(t, f, v, dest) {
    const g = this.gain(0, dest);
    const car = this.osc('sine', f, g);
    const mg = this.gain(0, car.frequency), mod = this.osc('sine', f * 3.5, mg);
    mg.gain.setValueAtTime(f * 2, t); mg.gain.setTargetAtTime(0, t, 0.15);
    const p2g = this.gain(0.3, g), p2 = this.osc('sine', f * 2.76, p2g);
    this.env(g.gain, t, 0.18 * v, 0.002, 0.7);
    for (const o of [car, mod, p2]) { o.start(t); o.stop(t + 0.8); }
  }
}

// ================= One procedural track playing =================
class Player {
  constructor(eng, tr, dest) {
    this.eng = eng; this.tr = tr;
    const ctx = eng.ctx;
    this.out = eng.gain(0, dest);                 // dry, faded on crossfade
    this.send = eng.gain(0, eng.reverb);          // reverb send, faded alongside
    this.sendIn = eng.gain(1, this.send);         // instruments feed this
    this.sd = 60 / tr.bpm / 4;
    this.step = 0; this.maxSteps = Infinity;
    this.lastOpen = null; this.lastOpenT = 0;
    this.fadeEnd = Infinity; this.dead = false;
    // vinyl crackle bed
    this.crk = ctx.createBufferSource(); this.crk.buffer = eng.crackleBuf; this.crk.loop = true;
    this.crkG = eng.gain(0.1, this.out);
    this.crk.connect(eng.filt('highpass', 700, 0.7, eng.filt('lowpass', 5000, 0.7, this.crkG)));
  }
  start(t, fadeIn) {
    const p = this.out.gain, s = this.send.gain;
    p.setValueAtTime(0, t); s.setValueAtTime(0, t);
    p.linearRampToValueAtTime(1, t + (fadeIn || 0.01));
    s.linearRampToValueAtTime(0.3, t + (fadeIn || 0.01));
    this.nextTime = t;
    this.crk.start(t);
  }
  stop(t, fade) {
    for (const p of [this.out.gain, this.send.gain]) {
      p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(0, t + fade);
    }
    this.fadeEnd = t + fade;
    try { this.crk.stop(t + fade + 0.05); } catch (e) { /* already stopped */ }
  }
  fillUntil(until) {
    const ctx = this.eng.ctx;
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;   // tab stalled: resync
    while (this.nextTime < until && this.step < this.maxSteps && this.nextTime < this.fadeEnd) {
      const swing = (this.step % 2) ? this.tr.swing * this.sd : 0;
      this.scheduleStep(this.step, this.nextTime + swing);
      this.step++;
      this.nextTime += this.sd;
    }
    if (this.step >= this.maxSteps) this.dead = true;
  }
  degToMidi(d) {
    const sc = SCALES[this.tr.scale], n = sc.length;
    const o = Math.floor(d / n), i = ((d % n) + n) % n;
    return this.tr.key + 12 * this.tr.leadOct + 12 * o + sc[i];
  }
  scheduleStep(step, t) {
    const E = this.eng, tr = this.tr, sd = this.sd, I = E.intensity, dest = this.out, send = this.sendIn;
    const bar = Math.floor(step / 16), s = step % 16;
    let sec = 'intro', bis = bar, secIdx = -1;
    if (bar >= 4) { const k = bar - 4; secIdx = Math.floor(k / 8); bis = k % 8; sec = secIdx % 2 ? 'B' : 'A'; }
    const intro = sec === 'intro';
    const lastBar = intro ? bar === 3 : bis === 7;
    const drop = lastBar && (intro || sec === 'A') && s >= 8;      // kick + bass drop out before the hook
    const fill = lastBar && s >= 12;
    const breakdown = sec === 'A' && secIdx % 4 === 2 && bis < 2;   // every other verse opens without kick

    if (s === 0) this.crkG.gain.setTargetAtTime(intro ? 0.12 : 0.045 + 0.03 * (1 - I), t, 0.3);

    // chord in effect at this step
    const chords = tr.prog[bar % tr.prog.length];
    let ch = chords[0];
    for (const c of chords) if (c[2] <= s) ch = c;
    const root = tr.key + ch[0];

    // ---- keys ----
    const voice = c => {
      const r = tr.key + c[0], out = [];
      for (const iv of CHORDS[c[1]]) {
        if (iv === 0) continue;
        let m = r + iv;
        while (m < 55) m += 12;
        while (m > 76) m -= 12;
        if (!out.includes(m)) out.push(m);
      }
      return out.sort((a, b) => a - b);
    };
    const kv = intro ? 0.75 : 0.9;
    if (!tr.keysP) {
      chords.forEach((c, i) => {
        if (c[2] !== s) return;
        const endStep = i + 1 < chords.length ? chords[i + 1][2] : 16;
        E.rhodes(t, voice(c), (endStep - s) * sd * 0.98, kv, dest, send);
      });
    } else if (tr.keysP[s] || (intro && s === 0)) {
      E.rhodes(t, voice(ch), intro && s === 0 ? sd * 8 : sd * 2.2, kv, dest, send);
    }

    // ---- drums ----
    const hv = tr.hatP[s];
    if (!intro || bar >= 2) {
      const hs = intro ? 0.5 : 1;
      if (hv === -1) for (let k = 0; k < 3; k++) E.hat(t + k * sd / 3, 0.5 * hs + k * 0.15, false, dest, this);
      else if (hv) E.hat(t, hv * hs, false, dest, this);
      if (tr.openP[s] && !intro) E.hat(t, tr.openP[s], true, dest, this);
    }
    if (!intro) {
      const k = tr.kickP[bar % 2][s];
      if (k && !drop && !breakdown && !(fill && s > 12)) E.kick(t, k, dest);
      const sn = tr.snareP[s];
      if (sn && !fill) {
        E.snare(t, sn, dest, send);
        if ((tr.clapOnSnare || I > 0.7) && sn > 0.5) E.clap(t, 0.8, dest, send);
      }
      if (I > 0.35) E.shaker(t, s % 4 === 2 ? 0.7 : 0.35, dest);
      if (I > 0.7 && s % 4 === 2) E.tamb(t, 0.8, dest);
    }
    if (fill) {                                   // snare roll into the next section
      const v = 0.35 + 0.18 * (s - 12);
      E.snare(t, v, dest, send);
      if (s >= 14) E.snare(t + sd / 2, v + 0.08, dest, send);
    }

    // ---- 808 ----
    if (!intro && !drop) {
      const br = 28 + (((root - 28) % 12) + 12) % 12;
      for (const b of tr.bass) {
        if (b[0] !== s) continue;
        E.bass(t, br + b[1], b[2] * sd * 0.95, 1, b[3] != null ? br + b[3] : null, dest);
      }
    }

    // ---- hook ----
    const hookOn = sec === 'B' || (I > 0.65 && sec === 'A' && bis % 4 >= 2);
    if (hookOn) {
      const motif = tr.hook[Math.floor(bar / 2) % 2], s32 = (bar % 2) * 16 + s;
      for (const n of motif) if (n[0] === s32) E.lead(t, this.degToMidi(n[1]), n[2] * sd * 0.95, 1, tr.lead, dest, send);
    }

    // ---- scratch fill every 8 bars (and extra ones when it's heating up) ----
    if (lastBar && s === 8 && (!intro || bar === 3)) E.scratch(t, sd * 4, 0.8, dest);
    else if (I > 0.8 && !intro && bis % 4 === 3 && s === 14) E.scratch(t, sd * 2, 0.6, dest);
  }
}

// ================= Music controller =================
class Music {
  constructor(eng, base) {
    this.eng = eng;
    this.base = base != null ? base : '';
    this.players = [];
    this.idx = 0;
    this.mode = null;               // 'proc' | 'mp3'
    this.running = false;
    this.files = null;              // parsed tracks.json list
    this.mp3 = null;                // { el, g, name, i }
    this._timer = null;
  }
  get tracks() { return TRACKS.map(t => t.name); }
  get trackName() {
    if (this.mode === 'mp3' && this.mp3) return this.mp3.name;
    if (this.mode === 'proc') return TRACKS[this.idx].name;
    return '';
  }

  async start() {
    if (this.running) return;
    this.running = true;
    if (this.files === null) await this._loadList();
    if (!this.running) return;
    if (this.files.length) this._playMp3(0, 0);
    else this.play(this.idx);
  }
  stop() {
    this.running = false;
    const t = this.eng.ctx.currentTime;
    for (const p of this.players) p.stop(t, 0.6);
    this._stopMp3(0.6);
    this.mode = null;
  }
  next() {
    if (this.mode === 'mp3' && this.mp3) this._playMp3((this.mp3.i + 1) % this.files.length, 0);
    else this.play((this.idx + 1) % TRACKS.length);
  }
  setIntensity(x) {
    const E = this.eng, t = E.ctx.currentTime;
    E.intensity = clamp(+x || 0, 0, 1);
    const nyq = E.ctx.sampleRate / 2 - 100;
    const f = Math.min(nyq, this.mode === 'mp3' ? 20000 : 4200 + Math.pow(E.intensity, 1.4) * 15000);
    E.musicFilter.frequency.cancelScheduledValues(t);
    E.musicFilter.frequency.setTargetAtTime(f, t, 0.3);
  }

  // procedural track i (crossfades from whatever is playing)
  play(i, opts = {}) {
    const E = this.eng, ctx = E.ctx;
    this.idx = ((i % TRACKS.length) + TRACKS.length) % TRACKS.length;
    const now = ctx.currentTime, fading = this.players.length > 0 || !!this.mp3;
    for (const p of this.players) p.stop(now, 1.5);
    this._stopMp3(1.5);
    const p = new Player(E, TRACKS[this.idx], E.musicBus);
    this.mode = 'proc';
    this.setIntensity(E.intensity);
    if (opts.offline) {
      p.step = (opts.fromBar || 0) * 16;
      p.maxSteps = p.step + (opts.bars || 16) * 16;
      p.start(now, 0.01);
      p.fillUntil(Infinity);
      this.players.push(p);
      return p;
    }
    this.running = true;
    p.start(now + 0.05, fading ? 1.5 : 0.01);
    this.players.push(p);
    this._kick();
    return p;
  }
  _kick() {
    if (this._timer) return;
    const loop = () => {
      this._timer = null;
      const ctx = this.eng.ctx, now = ctx.currentTime;
      const ahead = (typeof document !== 'undefined' && document.hidden) ? 1.5 : 0.12;
      this.players = this.players.filter(p => p.fadeEnd > now && !p.dead);
      for (const p of this.players) p.fillUntil(now + ahead);
      if (this.players.length) this._timer = setTimeout(loop, 25);
    };
    loop();
  }

  async _loadList() {
    try {
      const r = await fetch(this.base + 'music/tracks.json', { cache: 'no-cache' });
      const j = await r.json();
      this.files = (Array.isArray(j.tracks) ? j.tracks : []).filter(t => t && typeof t.file === 'string');
    } catch (e) {
      this.files = [];
    }
  }
  _stopMp3(fade) {
    const m = this.mp3;
    if (!m) return;
    this.mp3 = null;
    const t = this.eng.ctx.currentTime, p = m.g.gain;
    p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => { m.el.pause(); m.el.removeAttribute('src'); m.el.load(); m.g.disconnect(); }, fade * 1000 + 100);
  }
  // play files[i]; on failure try the next, and fall back to procedural when none load
  _playMp3(i, tries) {
    const E = this.eng, ctx = E.ctx;
    if (!this.running) return;
    if (tries >= this.files.length) { this.files = []; this.play(this.idx); return; }
    const f = this.files[i];
    const el = new Audio();
    el.preload = 'auto';
    el.src = this.base + 'music/' + f.file;
    const g = E.gain(0, E.musicBus);
    let src;
    try { src = ctx.createMediaElementSource(el); src.connect(g); } catch (e) { g.disconnect(); this._playMp3((i + 1) % this.files.length, tries + 1); return; }
    const fail = () => { g.disconnect(); if (this.running && (!this.mp3 || this.mp3.el !== el)) this._playMp3((i + 1) % this.files.length, tries + 1); };
    el.addEventListener('error', fail, { once: true });
    el.addEventListener('ended', () => { if (this.mp3 && this.mp3.el === el) this.next(); });
    el.play().then(() => {
      if (!this.running) { el.pause(); g.disconnect(); return; }
      const t = ctx.currentTime;
      for (const p of this.players) p.stop(t, 1.2);
      this._stopMp3(1.2);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 1.2);
      this.mp3 = { el, g, i, name: f.name || f.file.replace(/\.[^.]+$/, '') };
      this.mode = 'mp3';
      this.setIntensity(E.intensity);
    }, () => { el.removeEventListener('error', fail); fail(); });
  }
}

// ================= Sound effects =================
class Sfx {
  constructor(eng) {
    this.eng = eng;
    // muted: skip building the graph at all
    for (const k of Object.getOwnPropertyNames(Sfx.prototype)) {
      const f = Object.getOwnPropertyDescriptor(Sfx.prototype, k).value;
      if (k === 'constructor' || typeof f !== 'function') continue;
      this[k] = (...a) => { if (!eng.muted) f.apply(this, a); };
    }
  }
  get t() {
    const ctx = this.eng.ctx;
    if (ctx.state === 'suspended' && !ctx.startRendering) ctx.resume();
    return ctx.currentTime + 0.005;
  }
  jump(power = 0.5) {
    const E = this.eng, t = this.t, p = clamp(+power || 0, 0, 1);
    const g = E.gain(0, E.sfxBus), o = E.osc('triangle', 260, g);
    const f0 = 260 + p * 180, f1 = f0 * (1.9 + p * 0.8);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.09);
    o.frequency.exponentialRampToValueAtTime(f1 * 0.92, t + 0.16);
    const l = E.osc('sine', 28, E.gain(f0 * 0.06, o.frequency));   // spring wobble
    E.env(g.gain, t, 0.55, 0.004, 0.16);
    o.start(t); o.stop(t + 0.22); l.start(t); l.stop(t + 0.22);
  }
  land() {
    const E = this.eng, t = this.t;
    const g = E.gain(0, E.sfxBus), o = E.osc('sine', 140, g);
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.09);
    E.env(g.gain, t, 0.6, 0.003, 0.1);
    o.start(t); o.stop(t + 0.15);
    const ng = E.gain(0, E.sfxBus);
    E.noiseSrc(t, 0.07, ng, E.nb.thud);
    E.env(ng.gain, t, 0.3, 0.002, 0.05);
  }
  wallBounce() {
    const E = this.eng, t = this.t;
    const g = E.gain(0, E.sfxBus), o = E.osc('square', 330, E.filt('lowpass', 2500, 1, g));
    o.frequency.setValueAtTime(330, t); o.frequency.exponentialRampToValueAtTime(620, t + 0.06);
    E.env(g.gain, t, 0.3, 0.003, 0.1);
    o.start(t); o.stop(t + 0.14);
    const wg = E.gain(0, E.sfxBus), w = E.osc('sine', 1200, wg);
    E.env(wg.gain, t, 0.35, 0.001, 0.04);
    w.start(t); w.stop(t + 0.07);
  }
  combo(floors = 2) {
    const E = this.eng, t = this.t, n = clamp(floors | 0, 0, 30);
    const f = mtof(64 + n);
    [[0, f], [0.06, f * 1.5]].forEach(([dt, fr]) => {
      const g = E.gain(0, E.sfxBus), o = E.osc('triangle', fr, g);
      E.env(g.gain, t + dt, 0.28, 0.004, 0.12);
      o.start(t + dt); o.stop(t + dt + 0.18);
    });
  }
  // SWEET! GREAT! SUPER! WOW! AMAZING! EXTREME! FANTASTIC! SPLENDID! NO WAY! INSANE!
  praise(level = 0) {
    const E = this.eng, t = this.t, L = clamp(level | 0, 0, 9);
    E.scratch(t, 0.16 + L * 0.025, 0.9, E.sfxBus);
    const st = t + 0.13 + L * 0.02, root = 60 + L;
    const iv = L < 3 ? [0, 4, 7] : L < 6 ? [0, 4, 7, 11, 12] : [0, 4, 7, 11, 14, 19];
    E.brass(st, iv.map(x => root + x), 0.22 + L * 0.04, 0.12 + L * 0.012, E.sfxBus, E.sfxSend);
    if (L >= 5) {
      const n = L >= 9 ? 3 : L >= 7 ? 2 : 1;
      for (let k = 0; k < n; k++) E.airhorn(st + 0.05 + k * 0.2, k === n - 1 ? 0.45 : 0.14, 1, E.sfxBus);
    }
    if (L >= 8) E.scratch(st + 0.7, 0.25, 0.7, E.sfxBus);
  }
  comboEnd() {
    const E = this.eng, t = this.t;
    [[0, 520, 400], [0.1, 390, 260]].forEach(([dt, a, b]) => {
      const g = E.gain(0, E.sfxBus), o = E.osc('triangle', a, g);
      o.frequency.setValueAtTime(a, t + dt); o.frequency.exponentialRampToValueAtTime(b, t + dt + 0.16);
      E.env(g.gain, t + dt, 0.22, 0.005, 0.16);
      o.start(t + dt); o.stop(t + dt + 0.22);
    });
  }
  hurry() {
    const E = this.eng, t = this.t;
    for (const dt of [0, 0.16, 0.45, 0.61]) E.bell(t + dt, 1320, 1, E.sfxBus);
  }
  select() {
    const E = this.eng, t = this.t;
    const g = E.gain(0, E.sfxBus), o = E.osc('square', 880, E.filt('lowpass', 4000, 0.7, g));
    E.env(g.gain, t, 0.22, 0.002, 0.045);
    o.start(t); o.stop(t + 0.07);
  }
  confirm() {
    const E = this.eng, t = this.t;
    [[0, 660], [0.07, 990]].forEach(([dt, f]) => {
      const g = E.gain(0, E.sfxBus), o = E.osc('triangle', f, g);
      E.env(g.gain, t + dt, 0.26, 0.003, 0.12);
      o.start(t + dt); o.stop(t + dt + 0.17);
    });
  }
  countdown(n = 3) {
    const E = this.eng, t = this.t;
    if (n > 0) {
      const g = E.gain(0, E.sfxBus);
      const o = E.osc('sine', 660, g), q = E.osc('square', 660, E.gain(0.25, g));
      E.env(g.gain, t, 0.4, 0.004, 0.18);
      for (const x of [o, q]) { x.start(t); x.stop(t + 0.25); }
    } else {
      E.brass(t, [69, 73, 76, 81], 0.55, 0.16, E.sfxBus, E.sfxSend);
      E.kick(t, 0.9, E.sfxBus);
    }
  }
  gameOver() {
    const E = this.eng, t = this.t;
    const notes = [[0, 67, 0.3], [0.32, 66, 0.3], [0.64, 65, 0.3], [0.96, 64, 1.0]];
    for (const [dt, m, d] of notes) {
      const s = t + dt, f = mtof(m);
      const g = E.gain(0, E.sfxBus), lp = E.filt('lowpass', 700, 4, g);
      const o = E.osc('sawtooth', f, lp);
      lp.frequency.setValueAtTime(500, s); lp.frequency.linearRampToValueAtTime(1500, s + 0.12); lp.frequency.linearRampToValueAtTime(700, s + d);
      if (d > 0.5) {
        const l = E.osc('sine', 6, E.gain(f * 0.03, o.frequency)); l.start(s); l.stop(s + d + 0.05);
        o.frequency.setValueAtTime(f, s + d * 0.5); o.frequency.linearRampToValueAtTime(f * 0.94, s + d);
      }
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.14, s + 0.04);
      g.gain.setValueAtTime(0.14, s + d - 0.06); g.gain.linearRampToValueAtTime(0, s + d);
      o.start(s); o.stop(s + d + 0.05);
    }
  }
  join() {
    const E = this.eng, t = this.t;
    [[0, 500, 900], [0.08, 750, 1300]].forEach(([dt, a, b]) => {
      const g = E.gain(0, E.sfxBus), o = E.osc('sine', a, g);
      o.frequency.setValueAtTime(a, t + dt); o.frequency.exponentialRampToValueAtTime(b, t + dt + 0.05);
      E.env(g.gain, t + dt, 0.3, 0.003, 0.08);
      o.start(t + dt); o.stop(t + dt + 0.12);
    });
  }
}

// ================= Public =================
export { TRACKS };
export function createAudio(opts = {}) {
  let ctx = opts.ctx;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
  }
  const eng = new Engine(ctx);
  const music = new Music(eng, opts.base);
  const sfx = new Sfx(eng);
  return {
    ctx, music, sfx,
    get muted() { return eng.muted; },
    setMuted(b) { eng.setMuted(b); },
  };
}
