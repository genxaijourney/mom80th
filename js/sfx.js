/* Sharon 80 — 1950s trivia sound effects (Web Audio API synthesis).
 * -------------------------------------------------------------
 * 10 unique CORRECT sounds and 10 unique WRONG sounds, all synthesized
 * live in the browser — no files, no CDN, no network hits during play.
 *
 * Public API:
 *   sfx.playCorrect()   — pick a random correct-answer sound (no repeats twice in a row)
 *   sfx.playWrong()     — pick a random wrong-answer sound (no repeats twice in a row)
 *   sfx.setEnabled(b)   — global mute toggle
 *   sfx.getEnabled()    — current state
 *   sfx.unlock()        — call inside a user gesture to unlock audio on mobile Safari
 * -------------------------------------------------------------
 */

let ctx = null;
let enabled = true;
let lastCorrectIdx = -1;
let lastWrongIdx   = -1;

const MASTER = 0.55; // overall volume

export function setEnabled(b) { enabled = !!b; }
export function getEnabled()   { return enabled; }

/* Wake up the audio context. Safari/iOS require a user gesture. */
export function unlock() {
  const c = ensureCtx();
  if (c && c.state === "suspended") c.resume();
}

function ensureCtx() {
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/* ---------- Tiny helpers ---------- */

function now(c) { return c.currentTime; }

function makeOsc(c, type, freq, when = 0) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + when);
  return o;
}

/* ADSR-style envelope on a GainNode */
function shape(c, gainNode, { attack = 0.004, peak = 0.6, hold = 0.02, decay = 0.4, sustain = 0.0001, release = 0.02, duration = 0.6, startAt = 0 }) {
  const g = gainNode.gain;
  const t = c.currentTime + startAt;
  g.cancelScheduledValues(t);
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(peak * MASTER, t + attack);
  g.linearRampToValueAtTime(peak * MASTER, t + attack + hold);
  g.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + attack + hold + decay);
  g.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + hold + decay + 0.01, duration - release));
  g.linearRampToValueAtTime(0, t + duration);
}

/* A single tone with an envelope. */
function tone(c, { type = "sine", freq, dur, gainOpts = {} , startAt = 0}) {
  const o = makeOsc(c, type, freq, startAt);
  const g = c.createGain();
  o.connect(g); g.connect(c.destination);
  shape(c, g, { duration: dur, startAt, ...gainOpts });
  o.start(c.currentTime + startAt);
  o.stop(c.currentTime + startAt + dur + 0.02);
  return { o, g };
}

/* A tone whose frequency slides (glide/glissando). */
function slide(c, { type = "sine", from, to, dur, gainOpts = {}, startAt = 0 }) {
  const o = c.createOscillator();
  o.type = type;
  const t0 = c.currentTime + startAt;
  o.frequency.setValueAtTime(from, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(to, 20), t0 + dur);
  const g = c.createGain();
  o.connect(g); g.connect(c.destination);
  shape(c, g, { duration: dur, startAt, ...gainOpts });
  o.start(t0);
  o.stop(t0 + dur + 0.02);
  return { o, g };
}

/* White noise burst (for percussive metallic hits, rasps, etc.). */
function noiseBurst(c, { dur, gainOpts = {}, filterType = "highpass", filterFreq = 4000, filterQ = 1, startAt = 0 }) {
  const bufSize = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = filterType; filter.frequency.value = filterFreq; filter.Q.value = filterQ;
  const g = c.createGain();
  src.connect(filter); filter.connect(g); g.connect(c.destination);
  shape(c, g, { duration: dur, startAt, ...gainOpts });
  src.start(c.currentTime + startAt);
  src.stop(c.currentTime + startAt + dur + 0.02);
  return { src, g };
}

/* Play a chord (multiple simultaneous tones). */
function chord(c, { type = "sine", freqs, dur, gainOpts = {}, startAt = 0 }) {
  for (const f of freqs) tone(c, { type, freq: f, dur, gainOpts, startAt });
}

/* ---------- CORRECT (10) ---------- */

const CORRECT_SOUNDS = [

  // #1 — Bicycle bell "ding"
  function bikeBell(c) {
    tone(c, { type: "triangle", freq: 1760, dur: 0.9,
      gainOpts: { attack: 0.001, peak: 0.55, hold: 0.02, decay: 0.85, release: 0.02 }});
    tone(c, { type: "sine", freq: 2637, dur: 0.7,
      gainOpts: { attack: 0.001, peak: 0.28, hold: 0.02, decay: 0.65, release: 0.02 }});
  },

  // #2 — Cash register CHA-CHING (metallic swipe + tone)
  function cashRegister(c) {
    noiseBurst(c, { dur: 0.09, filterType: "highpass", filterFreq: 4500,
      gainOpts: { attack: 0.001, peak: 0.5, decay: 0.08, release: 0.01 }});
    tone(c, { type: "sine", freq: 1568, dur: 0.55, startAt: 0.08,
      gainOpts: { attack: 0.002, peak: 0.5, hold: 0.02, decay: 0.5, release: 0.02 }});
    tone(c, { type: "sine", freq: 1975, dur: 0.55, startAt: 0.08,
      gainOpts: { attack: 0.002, peak: 0.32, hold: 0.02, decay: 0.5, release: 0.02 }});
  },

  // #3 — Doo-wop harmony stab (major triad hit)
  function dooWopStab(c) {
    chord(c, { type: "triangle", freqs: [261.63, 329.63, 392.0, 523.25], dur: 0.7,
      gainOpts: { attack: 0.005, peak: 0.4, hold: 0.05, decay: 0.6, release: 0.05 }});
    // subtle sparkle on top
    tone(c, { type: "sine", freq: 1046.5, dur: 0.6, startAt: 0.03,
      gainOpts: { attack: 0.004, peak: 0.2, decay: 0.55, release: 0.03 }});
  },

  // #4 — Xylophone rising run (do-mi-sol-do)
  function xyloRun(c) {
    const notes = [523.25, 659.25, 784.0, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => {
      tone(c, { type: "sine", freq: f, dur: 0.28, startAt: i * 0.09,
        gainOpts: { attack: 0.002, peak: 0.55, hold: 0.02, decay: 0.24, release: 0.02 }});
      // second harmonic for wooden bar character
      tone(c, { type: "triangle", freq: f * 2, dur: 0.2, startAt: i * 0.09,
        gainOpts: { attack: 0.002, peak: 0.2, decay: 0.18, release: 0.02 }});
    });
  },

  // #5 — Slide whistle UP (rising glissando)
  function slideUp(c) {
    slide(c, { type: "sine", from: 440, to: 1760, dur: 0.55,
      gainOpts: { attack: 0.01, peak: 0.5, hold: 0.02, decay: 0.5, release: 0.02 }});
    // little breath noise
    noiseBurst(c, { dur: 0.55, filterType: "bandpass", filterFreq: 1600, filterQ: 2,
      gainOpts: { attack: 0.05, peak: 0.06, decay: 0.5, release: 0.04 }});
  },

  // #6 — Barbershop chord hit (three-part harmony)
  function barbershopChord(c) {
    chord(c, { type: "sawtooth", freqs: [130.81, 196.0, 261.63, 329.63], dur: 0.7,
      gainOpts: { attack: 0.015, peak: 0.32, hold: 0.06, decay: 0.55, release: 0.05 }});
    // gentle vibrato-ish top note
    tone(c, { type: "sine", freq: 659.25, dur: 0.65, startAt: 0.02,
      gainOpts: { attack: 0.02, peak: 0.28, hold: 0.05, decay: 0.55, release: 0.04 }});
  },

  // #7 — Game-show ding ding ding (three bright bells)
  function gameShowDing(c) {
    [0, 0.13, 0.26].forEach((t, i) => {
      tone(c, { type: "sine", freq: 1976, dur: 0.24, startAt: t,
        gainOpts: { attack: 0.001, peak: 0.55 - i * 0.05, hold: 0.02, decay: 0.2, release: 0.02 }});
      tone(c, { type: "triangle", freq: 2637, dur: 0.2, startAt: t,
        gainOpts: { attack: 0.001, peak: 0.25, decay: 0.18, release: 0.02 }});
    });
  },

  // #8 — Jazz sax stab (buzzy saw with quick vibrato + envelope)
  function jazzSaxStab(c) {
    const t0 = c.currentTime;
    const o = c.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(392.0, t0); // G4
    // small pitch flick up then settle
    o.frequency.linearRampToValueAtTime(415.3, t0 + 0.05);
    o.frequency.linearRampToValueAtTime(392.0, t0 + 0.1);
    const filter = c.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 1400; filter.Q.value = 4;
    const g = c.createGain();
    o.connect(filter); filter.connect(g); g.connect(c.destination);
    shape(c, g, { attack: 0.008, peak: 0.5, hold: 0.06, decay: 0.35, release: 0.04, duration: 0.5 });
    o.start(t0); o.stop(t0 + 0.55);
  },

  // #9 — Marimba hit (single warm woody note)
  function marimbaHit(c) {
    tone(c, { type: "sine", freq: 523.25, dur: 0.55,
      gainOpts: { attack: 0.002, peak: 0.55, hold: 0.02, decay: 0.5, release: 0.02 }});
    tone(c, { type: "triangle", freq: 1046.5, dur: 0.4,
      gainOpts: { attack: 0.002, peak: 0.22, decay: 0.38, release: 0.02 }});
    tone(c, { type: "sine", freq: 1568.0, dur: 0.3,
      gainOpts: { attack: 0.002, peak: 0.12, decay: 0.28, release: 0.02 }});
  },

  // #10 — Vintage radio bell (two note "ding-ding" like an old game show)
  function radioBell(c) {
    tone(c, { type: "sine", freq: 1319, dur: 0.35,
      gainOpts: { attack: 0.001, peak: 0.55, hold: 0.03, decay: 0.3, release: 0.02 }});
    tone(c, { type: "sine", freq: 1976, dur: 0.45, startAt: 0.18,
      gainOpts: { attack: 0.001, peak: 0.55, hold: 0.03, decay: 0.4, release: 0.02 }});
  }
];

/* ---------- WRONG (10) ---------- */

const WRONG_SOUNDS = [

  // #1 — Sad trombone (three descending womps)
  function sadTrombone(c) {
    const notes = [220.0, 196.0, 174.6]; // A3 G3 F3
    notes.forEach((f, i) => {
      slide(c, { type: "sawtooth", from: f * 1.08, to: f, dur: 0.25, startAt: i * 0.28,
        gainOpts: { attack: 0.02, peak: 0.45, hold: 0.06, decay: 0.15, release: 0.03 }});
    });
    // final long "wahhhh"
    slide(c, { type: "sawtooth", from: 174.6, to: 130.8, dur: 0.6, startAt: 0.84,
      gainOpts: { attack: 0.03, peak: 0.5, hold: 0.15, decay: 0.35, release: 0.05 }});
  },

  // #2 — Slide whistle DOWN
  function slideDown(c) {
    slide(c, { type: "sine", from: 1760, to: 220, dur: 0.6,
      gainOpts: { attack: 0.005, peak: 0.5, hold: 0.02, decay: 0.55, release: 0.02 }});
    noiseBurst(c, { dur: 0.6, filterType: "bandpass", filterFreq: 900, filterQ: 2,
      gainOpts: { attack: 0.05, peak: 0.06, decay: 0.55, release: 0.04 }});
  },

  // #3 — Harpo honk (double-toot bicycle horn)
  function harpoHonk(c) {
    for (const t of [0, 0.2]) {
      slide(c, { type: "square", from: 320, to: 300, dur: 0.15, startAt: t,
        gainOpts: { attack: 0.003, peak: 0.35, hold: 0.05, decay: 0.08, release: 0.02 }});
      slide(c, { type: "sawtooth", from: 640, to: 600, dur: 0.15, startAt: t,
        gainOpts: { attack: 0.003, peak: 0.2, decay: 0.08, release: 0.02 }});
    }
  },

  // #4 — Kazoo raspberry (buzzy pitch wobble)
  function kazooRaspberry(c) {
    const t0 = c.currentTime;
    const o = c.createOscillator(); o.type = "square";
    o.frequency.setValueAtTime(240, t0);
    // pitch wobble to simulate flapping lips
    for (let i = 0; i < 12; i++) {
      const t = t0 + i * 0.03;
      o.frequency.linearRampToValueAtTime(220 + (i % 2 ? 40 : 0), t);
    }
    const filter = c.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.value = 900; filter.Q.value = 6;
    const g = c.createGain();
    o.connect(filter); filter.connect(g); g.connect(c.destination);
    shape(c, g, { attack: 0.01, peak: 0.4, hold: 0.25, decay: 0.15, release: 0.03, duration: 0.45 });
    o.start(t0); o.stop(t0 + 0.5);
  },

  // #5 — Boing (bouncing spring)
  function boing(c) {
    const t0 = c.currentTime;
    const o = c.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(600, t0);
    o.frequency.exponentialRampToValueAtTime(160, t0 + 0.35);
    // add wobble via LFO
    const lfo = c.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 22;
    const lfoGain = c.createGain(); lfoGain.gain.value = 80;
    lfo.connect(lfoGain); lfoGain.connect(o.frequency);
    const g = c.createGain();
    o.connect(g); g.connect(c.destination);
    shape(c, g, { attack: 0.005, peak: 0.5, hold: 0.05, decay: 0.4, release: 0.04, duration: 0.55 });
    o.start(t0); lfo.start(t0);
    o.stop(t0 + 0.6); lfo.stop(t0 + 0.6);
  },

  // #6 — Cartoon dud (soft thud)
  function cartoonDud(c) {
    // muffled low thump
    tone(c, { type: "sine", freq: 90, dur: 0.35,
      gainOpts: { attack: 0.003, peak: 0.6, hold: 0.05, decay: 0.3, release: 0.03 }});
    noiseBurst(c, { dur: 0.15, filterType: "lowpass", filterFreq: 400,
      gainOpts: { attack: 0.002, peak: 0.35, decay: 0.14, release: 0.02 }});
  },

  // #7 — Cuckoo miss (two-note descending like a broken cuckoo clock)
  function cuckooMiss(c) {
    tone(c, { type: "sine", freq: 784, dur: 0.35,
      gainOpts: { attack: 0.005, peak: 0.5, hold: 0.05, decay: 0.28, release: 0.03 }});
    slide(c, { type: "sine", from: 622.25, to: 466.16, dur: 0.5, startAt: 0.28,
      gainOpts: { attack: 0.005, peak: 0.5, hold: 0.08, decay: 0.4, release: 0.03 }});
  },

  // #8 — Tuba honk (single low pump)
  function tubaHonk(c) {
    slide(c, { type: "sawtooth", from: 130.8, to: 110, dur: 0.5,
      gainOpts: { attack: 0.015, peak: 0.5, hold: 0.15, decay: 0.3, release: 0.03 }});
    tone(c, { type: "sine", freq: 65.4, dur: 0.55,
      gainOpts: { attack: 0.015, peak: 0.35, hold: 0.15, decay: 0.35, release: 0.03 }});
  },

  // #9 — Sad clarinet (single sighing note)
  function sadClarinet(c) {
    slide(c, { type: "square", from: 293.66, to: 246.94, dur: 0.7,
      gainOpts: { attack: 0.06, peak: 0.35, hold: 0.15, decay: 0.45, release: 0.05 }});
    // subtle reed harmonic
    slide(c, { type: "triangle", from: 587.32, to: 493.88, dur: 0.7,
      gainOpts: { attack: 0.08, peak: 0.15, decay: 0.55, release: 0.05 }});
  },

  // #10 — Doorbell fail (a bright ding that goes sour)
  function doorbellFail(c) {
    tone(c, { type: "sine", freq: 880, dur: 0.35,
      gainOpts: { attack: 0.002, peak: 0.5, hold: 0.05, decay: 0.28, release: 0.03 }});
    // second bell sours (drops a tritone)
    slide(c, { type: "sine", from: 587.32, to: 415.3, dur: 0.55, startAt: 0.22,
      gainOpts: { attack: 0.002, peak: 0.5, hold: 0.08, decay: 0.45, release: 0.03 }});
  }
];

/* ---------- Public play API ---------- */

function pickIndex(len, lastIdx) {
  if (len <= 1) return 0;
  let i = Math.floor(Math.random() * len);
  if (i === lastIdx) i = (i + 1) % len;
  return i;
}

export function playCorrect() {
  const c = ensureCtx();
  if (!c) return;
  const idx = pickIndex(CORRECT_SOUNDS.length, lastCorrectIdx);
  lastCorrectIdx = idx;
  try { CORRECT_SOUNDS[idx](c); } catch (e) { /* fail silent */ }
  return idx;
}

export function playWrong() {
  const c = ensureCtx();
  if (!c) return;
  const idx = pickIndex(WRONG_SOUNDS.length, lastWrongIdx);
  lastWrongIdx = idx;
  try { WRONG_SOUNDS[idx](c); } catch (e) { /* fail silent */ }
  return idx;
}

export const correctCount = CORRECT_SOUNDS.length;
export const wrongCount   = WRONG_SOUNDS.length;
