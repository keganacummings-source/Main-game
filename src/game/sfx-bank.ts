/**
 * TURBZ sound bank: every game sound effect (except the You Died sting) is synthesised here once, when
 * audio unlocks, into plain sample arrays. Nothing is downloaded, so sounds are instant and never fail to
 * load. Each sound is built from layered parts (a transient, a body and a tail), then normalised to the
 * same peak so the master FET bus sees evenly balanced material.
 *
 * Pure DSP with no Web Audio calls: `renderSfx(name, sampleRate)` returns a Float32Array, which keeps it
 * testable in Node.
 */

export type SfxName =
  | "hit" | "thud" | "slam" | "hurt" | "boom" | "swell" | "sparkle" | "burst" | "fanfare"
  | "pulse" | "click" | "rattle" | "chop" | "cast" | "blip";

/** Seeded random so every render of a sound is identical. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const TAU = Math.PI * 2;

/** RBJ biquad, run over a whole buffer in place. Frequency may be a function of time (seconds). */
function biquad(buf: Float32Array, sr: number, type: "lp" | "hp" | "bp", freq: number | ((t: number) => number), q = 0.707) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const fAt = typeof freq === "function" ? freq : () => freq;
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  for (let i = 0; i < buf.length; i++) {
    if (i % 32 === 0) {
      const f = Math.max(20, Math.min(sr * 0.45, fAt(i / sr)));
      const w = TAU * f / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
      if (type === "lp") { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; }
      else if (type === "hp") { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
      else { b0 = al; b1 = 0; b2 = -al; }
      b0 /= a0; b1 /= a0; b2 /= a0; a1 = (-2 * cw) / a0; a2 = (1 - al) / a0;
    }
    const x = buf[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    buf[i] = y;
  }
  return buf;
}

/** Attack / exponential-decay envelope. */
const env = (t: number, atk: number, decay: number) => (t < atk ? t / atk : Math.exp(-(t - atk) / decay));

function make(sr: number, secs: number) { return new Float32Array(Math.ceil(sr * secs)); }

function add(dst: Float32Array, src: Float32Array, gain = 1, offset = 0) {
  for (let i = 0; i < src.length && i + offset < dst.length; i++) dst[i + offset] += src[i] * gain;
  return dst;
}

/** A sine whose pitch glides from f0 to f1 (exponentially), with an envelope. */
function sweep(sr: number, secs: number, f0: number, f1: number, atk: number, decay: number, glide = secs) {
  const out = make(sr, secs);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const f = f0 * Math.pow(f1 / f0, Math.min(1, t / glide));
    ph += TAU * f / sr;
    out[i] = Math.sin(ph) * env(t, atk, decay);
  }
  return out;
}

function noise(sr: number, secs: number, seed: number, atk: number, decay: number) {
  const r = rng(seed), out = make(sr, secs);
  for (let i = 0; i < out.length; i++) out[i] = (r() * 2 - 1) * env(i / sr, atk, decay);
  return out;
}

/** A struck bell / mallet: a few inharmonic partials, each decaying at its own speed. */
function bell(sr: number, secs: number, f: number, decay: number, bright = 1) {
  const parts: [number, number, number][] = [[1, 1, 1], [2.0, 0.45 * bright, 0.6], [2.76, 0.3 * bright, 0.4], [5.4, 0.12 * bright, 0.22], [0.5, 0.18, 1.3]];
  const out = make(sr, secs);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    let v = 0;
    for (const [m, a, d] of parts) v += Math.sin(TAU * f * m * t) * a * env(t, 0.002, decay * d);
    out[i] = v;
  }
  return fadeTail(out, sr, Math.min(0.15, secs * 0.25));
}

/** Plucked string (Karplus–Strong) for warm, organic tones. `bright` keeps more of the raw string. */
function pluck(sr: number, secs: number, f: number, seed: number, damp = 0.996, bright = 0.5) {
  const r = rng(seed), n = Math.max(2, Math.round(sr / f)), line = new Float32Array(n), out = make(sr, secs);
  for (let i = 0; i < n; i++) line[i] = r() * 2 - 1;
  let idx = 0;
  for (let i = 0; i < out.length; i++) {
    const cur = line[idx], next = line[(idx + 1) % n];
    out[i] = cur;
    line[idx] = damp * (bright * cur + (1 - bright) * 0.5 * (cur + next));
    idx = (idx + 1) % n;
  }
  return fadeTail(out, sr, Math.min(0.25, secs * 0.3));
}

/** Detuned saw stack (soft, band-limited enough at these pitches) for pads and brass. */
function saws(sr: number, secs: number, f: number, voices: number, detune: number, ampEnv: (t: number) => number, seed = 1) {
  const r = rng(seed), out = make(sr, secs), ph = Array.from({ length: voices }, () => r());
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    let v = 0;
    for (let k = 0; k < voices; k++) {
      const fk = f * (1 + (k - (voices - 1) / 2) * detune);
      ph[k] = (ph[k] + fk / sr) % 1;
      v += ph[k] * 2 - 1;
    }
    out[i] = (v / voices) * ampEnv(t);
  }
  return out;
}

function softClip(buf: Float32Array, drive: number) {
  const k = Math.tanh(drive);
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * drive) / k;
  return buf;
}

function fadeTail(buf: Float32Array, sr: number, secs = 0.03) {
  const n = Math.min(buf.length, Math.floor(sr * secs));
  for (let i = 0; i < n; i++) buf[buf.length - 1 - i] *= i / n;
  return buf;
}

/** Scales a buffer so its peak lands at `peak`, and removes DC offset. */
export function normalise(buf: Float32Array, peak = 0.89) {
  let mean = 0;
  for (let i = 0; i < buf.length; i++) mean += buf[i];
  mean /= buf.length || 1;
  let max = 0;
  for (let i = 0; i < buf.length; i++) { buf[i] -= mean; max = Math.max(max, Math.abs(buf[i])); }
  if (max > 0) for (let i = 0; i < buf.length; i++) buf[i] *= peak / max;
  return buf;
}

const RENDER: Record<SfxName, (sr: number) => Float32Array> = {
  /** Melee impact: a punchy low thump under a crisp, bandpassed crack. */
  hit(sr) {
    const out = make(sr, 0.32);
    add(out, sweep(sr, 0.32, 170, 52, 0.002, 0.07, 0.09), 1);
    add(out, biquad(noise(sr, 0.12, 11, 0.0005, 0.018), sr, "bp", 2600, 0.9), 1.4);
    add(out, biquad(noise(sr, 0.3, 12, 0.001, 0.06), sr, "lp", 900), 0.5);
    return softClip(out, 1.8);
  },
  /** A body hitting the ground: low, dull, dusty. */
  thud(sr) {
    const out = make(sr, 0.6);
    add(out, sweep(sr, 0.6, 110, 38, 0.003, 0.14, 0.2), 1);
    add(out, biquad(noise(sr, 0.6, 21, 0.004, 0.12), sr, "lp", (t) => 1400 * Math.exp(-t * 6) + 200), 0.9);
    return softClip(out, 1.5);
  },
  /** Heavy set-proc impact: thump, metallic ring and a rumbling tail. */
  slam(sr) {
    const out = make(sr, 1.2);
    add(out, sweep(sr, 1.2, 140, 34, 0.002, 0.22, 0.3), 1);
    add(out, biquad(noise(sr, 0.15, 31, 0.0005, 0.03), sr, "bp", 1800, 0.7), 1.2);
    add(out, biquad(noise(sr, 1.2, 32, 0.01, 0.35), sr, "lp", (t) => 600 * Math.exp(-t * 2) + 80), 1.1);
    add(out, bell(sr, 1.2, 310, 0.5, 0.6), 0.18);
    return softClip(out, 2);
  },
  /** You get hit: a short gritty crunch with a downward bite. */
  hurt(sr) {
    const out = make(sr, 0.26);
    add(out, sweep(sr, 0.26, 420, 150, 0.001, 0.06, 0.12), 0.8);
    add(out, biquad(noise(sr, 0.2, 41, 0.0005, 0.035), sr, "bp", 1200, 0.8), 1.2);
    add(out, sweep(sr, 0.26, 95, 55, 0.002, 0.07), 0.7);
    return softClip(out, 3.2);
  },
  /** Big ominous hit / explosion: sub drop, crackle and a long filtered rumble. */
  boom(sr) {
    const out = make(sr, 2.2);
    add(out, sweep(sr, 2.2, 90, 28, 0.004, 0.45, 0.8), 1.1);
    add(out, biquad(noise(sr, 2.2, 51, 0.003, 0.5), sr, "lp", (t) => 2600 * Math.exp(-t * 3) + 90, 0.9), 1.3);
    const crackle = noise(sr, 0.6, 52, 0.001, 0.12);
    const r = rng(53);
    for (let i = 0; i < crackle.length; i++) if (r() > 0.04) crackle[i] *= 0.15;
    add(out, biquad(crackle, sr, "hp", 1500), 0.7);
    return softClip(out, 2.2);
  },
  /** Magic rising: detuned pad that opens up, with a shimmer on top. */
  swell(sr) {
    const secs = 2.2, out = make(sr, secs);
    const pad = (f: number, seed: number) => biquad(
      saws(sr, secs, f, 5, 0.011, (t) => Math.min(1, t / 0.6) * Math.exp(-Math.max(0, t - 1.1) / 0.4), seed),
      sr, "lp", (t) => 300 + 3200 * Math.min(1, t / 1.1) ** 2, 1.4);
    add(out, pad(220, 61), 0.7);
    add(out, pad(329.6, 62), 0.5);
    add(out, pad(440, 63), 0.35);
    const sh = biquad(noise(sr, secs, 64, 0.8, 0.5), sr, "bp", (t) => 3000 + 4000 * Math.min(1, t / 1.2), 4);
    add(out, sh, 0.5);
    return fadeTail(out, sr, 0.2);
  },
  /** Glittering chimes: a quick run of high bells. */
  sparkle(sr) {
    const out = make(sr, 1.4);
    const notes = [1318.5, 1760, 2093, 2637, 3136, 2637];
    notes.forEach((f, k) => add(out, bell(sr, 1.4 - k * 0.07, f, 0.35, 0.7), 0.5 - k * 0.04, Math.floor(sr * k * 0.07)));
    add(out, biquad(noise(sr, 1.4, 71, 0.05, 0.3), sr, "hp", 7000), 0.12);
    return fadeTail(out, sr, 0.1);
  },
  /** Reward: a bright rising major arpeggio of plucks with a bell on top (level up, quest done). */
  burst(sr) {
    const out = make(sr, 2.2);
    [523.3, 659.3, 784, 1046.5].forEach((f, k) => {
      add(out, pluck(sr, 1.6, f, 80 + k, 0.997, 0.35), 0.6, Math.floor(sr * k * 0.085));
      add(out, bell(sr, 1.6, f * 2, 0.4, 0.4), 0.18, Math.floor(sr * k * 0.085));
    });
    add(out, bell(sr, 1.8, 2093, 0.7, 0.8), 0.35, Math.floor(sr * 0.34));
    return fadeTail(out, sr, 0.15);
  },
  /** Victory: a short brass-like chord progression (I – IV – V – I). */
  fanfare(sr) {
    const secs = 3.4, out = make(sr, secs);
    const chord = (fs: number[], at: number, len: number, seed: number) => {
      for (const [k, f] of fs.entries()) {
        const s = biquad(saws(sr, len, f, 3, 0.006, (t) => Math.min(1, t / 0.03) * (t < len - 0.2 ? 0.9 + 0.1 * Math.exp(-t * 8) : Math.max(0, (len - t) / 0.2)), seed + k),
          sr, "lp", (t) => 900 + 2600 * Math.exp(-t * 3), 1.1);
        add(out, s, 0.35, Math.floor(sr * at));
      }
    };
    chord([261.6, 329.6, 392], 0, 0.32, 90);
    chord([349.2, 440, 523.3], 0.34, 0.32, 93);
    chord([392, 493.9, 587.3], 0.68, 0.32, 96);
    chord([523.3, 659.3, 784, 261.6], 1.02, 2.3, 99);
    add(out, sweep(sr, 2.4, 130.8, 130.8, 0.01, 0.9), 0.4, Math.floor(sr * 1.02));
    return fadeTail(out, sr, 0.3);
  },
  /** Gathering loop: steady soft taps, one every half second. */
  pulse(sr) {
    const secs = 8, out = make(sr, secs);
    for (let k = 0; k * 0.5 < secs - 0.3; k++) {
      const at = Math.floor(sr * (0.08 + k * 0.5));
      add(out, sweep(sr, 0.25, 240, 120, 0.001, 0.05), 0.7, at);
      add(out, biquad(noise(sr, 0.08, 100 + k, 0.0005, 0.012), sr, "bp", 3200, 1.2), 0.6, at);
    }
    return out;
  },
  /** UI / building click: a tight wooden knock. */
  click(sr) {
    const out = make(sr, 0.12);
    add(out, sweep(sr, 0.12, 1100, 700, 0.0005, 0.018), 0.8);
    add(out, biquad(noise(sr, 0.05, 111, 0.0003, 0.006), sr, "bp", 4200, 1.5), 1);
    add(out, sweep(sr, 0.12, 260, 200, 0.001, 0.025), 0.5);
    return out;
  },
  /** Chest / box: a latch clack, then a few rattling wooden bits. */
  rattle(sr) {
    const out = make(sr, 0.7);
    const r = rng(121);
    add(out, sweep(sr, 0.15, 900, 500, 0.0005, 0.02), 0.8);
    add(out, biquad(noise(sr, 0.06, 122, 0.0003, 0.008), sr, "bp", 3000, 1.2), 1);
    for (let k = 0; k < 7; k++) {
      const at = Math.floor(sr * (0.07 + k * 0.045 + r() * 0.03));
      add(out, sweep(sr, 0.08, 600 + r() * 900, 400, 0.0005, 0.012), 0.45 * (1 - k / 9), at);
    }
    add(out, bell(sr, 0.6, 880, 0.25, 0.5), 0.18, Math.floor(sr * 0.12));
    return out;
  },
  /** Harvest done: a woody crack plus a small reward chime. */
  chop(sr) {
    const out = make(sr, 0.7);
    add(out, biquad(noise(sr, 0.12, 131, 0.0005, 0.025), sr, "bp", 1700, 1), 1.2);
    add(out, sweep(sr, 0.3, 320, 140, 0.001, 0.05), 0.8);
    add(out, bell(sr, 0.6, 1318.5, 0.22, 0.5), 0.3, Math.floor(sr * 0.06));
    return softClip(out, 1.6);
  },
  /** Spell / shot release: an airy whoosh that rises, with a little tonal zip. */
  cast(sr) {
    const out = make(sr, 0.34);
    add(out, biquad(noise(sr, 0.34, 141, 0.03, 0.09), sr, "bp", (t) => 800 + 5200 * Math.min(1, t / 0.2), 2), 1.3);
    add(out, sweep(sr, 0.2, 500, 1300, 0.004, 0.05, 0.12), 0.35);
    return out;
  },
  /** General soft mallet blip, pitched by tone(): warm and short (replaces the old FX1 sample). */
  blip(sr) {
    const out = make(sr, 0.6);
    add(out, pluck(sr, 0.6, 440, 151, 0.993, 0.4), 0.7);
    add(out, bell(sr, 0.6, 440, 0.18, 0.35), 0.35);
    return fadeTail(out, sr, 0.05);
  },
};

export const SFX_NAMES = Object.keys(RENDER) as SfxName[];
/** Pitch the blip was rendered at (tone(freq) plays it at freq / BLIP_HZ speed). */
export const BLIP_HZ = 440;

/** Renders one sound effect to a normalised mono buffer at the given sample rate. */
export function renderSfx(name: SfxName, sr: number): Float32Array {
  return normalise(RENDER[name](sr));
}
