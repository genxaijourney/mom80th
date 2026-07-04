/* Sharon 80 — 1950s trivia sound effects (Web Audio API synthesis).
 * -------------------------------------------------------------
 * 10 unique CORRECT sounds and 10 unique WRONG sounds, all synthesized
 * live in the browser — no files, no CDN, no network hits during play.
 *
 * Each sound is ~2.5–3.5 seconds long with musical/phrase-length content
 * (multi-note runs, repeated hits, decorated resolutions).
 *
 * Public API:
 *   sfx.playCorrect()   — pick a random correct-answer sound
 *   sfx.playWrong()     — pick a random wrong-answer sound
 *   sfx.setEnabled(b)   — global mute toggle
 *   sfx.getEnabled()    — current state
 *   sfx.unlock()        — call inside a user gesture to unlock audio on mobile Safari
 * -------------------------------------------------------------
 */

let ctx = null;
let enabled = true;
let lastCorrectIdx = -1;
let lastWrongIdx   = -1;

const MASTER = 0.55;

export function setEnabled(b) { enabled = !!b; }
export function getEnabled()   { return enabled; }

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

/* ---------- Helpers ---------- */

function shape(c, gainNode, { attack = 0.008, peak = 0.6, hold = 0.05, decay = 1.5, release = 0.08, duration = 2.0, startAt = 0 }) {
  const g = gainNode.gain;
  const t = c.currentTime + startAt;
  g.cancelScheduledValues(t);
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(peak * MASTER, t + attack);
  g.linearRampToValueAtTime(peak * MASTER, t + attack + hold);
  g.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + hold + decay, duration - release));
  g.linearRampToValueAtTime(0, t + duration);
}

function tone(c, { type = "sine", freq, dur, gainOpts = {}, startAt = 0 }) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + startAt);
  const g = c.createGain();
  o.connect(g); g.connect(c.destination);
  shape(c, g, { duration: dur, startAt, ...gainOpts });
  o.start(c.currentTime + startAt);
  o.stop(c.currentTime + startAt + dur + 0.05);
  return { o, g };
}

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
  o.stop(t0 + dur + 0.05);
  return { o, g };
}

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
  src.stop(c.currentTime + startAt + dur + 0.05);
  return { src, g };
}

function chord(c, { type = "sine", freqs, dur, gainOpts = {}, startAt = 0 }) {
  for (const f of freqs) tone(c, { type, freq: f, dur, gainOpts, startAt });
}

/* ---------- CORRECT (10) — each ~2.5–3.5 s ---------- */

const CORRECT_SOUNDS = [

  // #1 — Bicycle bell, ding-ding-ding echoing away
  function bikeBell(c) {
    const times = [0, 0.5, 1.0, 1.55];
    times.forEach((t, i) => {
      tone(c, { type: "triangle", freq: 1760, dur: 1.8, startAt: t,
        gainOpts: { attack: 0.001, peak: 0.55 - i * 0.1, hold: 0.03, decay: 1.7, release: 0.05 }});
      tone(c, { type: "sine", freq: 2637, dur: 1.4, startAt: t,
        gainOpts: { attack: 0.001, peak: 0.28 - i * 0.05, hold: 0.03, decay: 1.3, release: 0.05 }});
    });
  },

  // #2 — Cash register: drawer swipe, coin jangle, then a triumphant bell + tail
  function cashRegister(c) {
    // metallic swipe
    noiseBurst(c, { dur: 0.35, filterType: "highpass", filterFreq: 4500,
      gainOpts: { attack: 0.001, peak: 0.45, hold: 0.05, decay: 0.32, release: 0.03 }});
    // coins jingling
    for (let i = 0; i < 6; i++) {
      const t = 0.15 + i * 0.08;
      tone(c, { type: "sine", freq: 2200 + Math.random() * 800, dur: 0.35, startAt: t,
        gainOpts: { attack: 0.001, peak: 0.32, decay: 0.32, release: 0.03 }});
    }
    // the CHA-CHING bell
    tone(c, { type: "sine", freq: 1568, dur: 2.4, startAt: 0.7,
      gainOpts: { attack: 0.002, peak: 0.55, hold: 0.06, decay: 2.3, release: 0.05 }});
    tone(c, { type: "sine", freq: 1975, dur: 2.4, startAt: 0.7,
      gainOpts: { attack: 0.002, peak: 0.35, hold: 0.06, decay: 2.3, release: 0.05 }});
    tone(c, { type: "triangle", freq: 3136, dur: 1.6, startAt: 0.7,
      gainOpts: { attack: 0.002, peak: 0.2, decay: 1.5, release: 0.05 }});
  },

  // #3 — Doo-wop harmony phrase (chord swell + vocal-like resolution)
  function dooWopStab(c) {
    // Opening major triad hit
    chord(c, { type: "triangle", freqs: [261.63, 329.63, 392.0, 523.25], dur: 1.2,
      gainOpts: { attack: 0.005, peak: 0.4, hold: 0.15, decay: 1.0, release: 0.06 }});
    // Move to IV chord
    chord(c, { type: "triangle", freqs: [349.23, 440.0, 523.25, 698.46], dur: 1.2, startAt: 1.1,
      gainOpts: { attack: 0.01, peak: 0.38, hold: 0.15, decay: 1.0, release: 0.06 }});
    // Resolve back to I with sparkle
    chord(c, { type: "triangle", freqs: [261.63, 329.63, 392.0, 523.25, 1046.5], dur: 1.4, startAt: 2.15,
      gainOpts: { attack: 0.01, peak: 0.42, hold: 0.2, decay: 1.15, release: 0.06 }});
  },

  // #4 — Xylophone rising arpeggio, then trill on top
  function xyloRun(c) {
    // Ascending do-mi-sol-do-mi-sol-do
    const notes = [523.25, 659.25, 784.0, 1046.5, 1318.51, 1567.98, 2093.0];
    notes.forEach((f, i) => {
      tone(c, { type: "sine", freq: f, dur: 1.0, startAt: i * 0.16,
        gainOpts: { attack: 0.002, peak: 0.55, hold: 0.04, decay: 0.9, release: 0.04 }});
      tone(c, { type: "triangle", freq: f * 2, dur: 0.8, startAt: i * 0.16,
        gainOpts: { attack: 0.002, peak: 0.2, decay: 0.75, release: 0.04 }});
    });
    // Trill on top C
    for (let i = 0; i < 5; i++) {
      tone(c, { type: "sine", freq: i % 2 ? 2093 : 2637, dur: 0.4, startAt: 1.3 + i * 0.14,
        gainOpts: { attack: 0.002, peak: 0.4, decay: 0.35, release: 0.04 }});
    }
    // Final long ringing top note
    tone(c, { type: "sine", freq: 2093, dur: 1.4, startAt: 2.0,
      gainOpts: { attack: 0.002, peak: 0.5, decay: 1.3, release: 0.06 }});
  },

  // #5 — Slide whistle UP, held, then quick echo up
  function slideUp(c) {
    slide(c, { type: "sine", from: 300, to: 1760, dur: 1.4,
      gainOpts: { attack: 0.02, peak: 0.5, hold: 0.15, decay: 1.2, release: 0.06 }});
    noiseBurst(c, { dur: 1.4, filterType: "bandpass", filterFreq: 1600, filterQ: 2,
      gainOpts: { attack: 0.1, peak: 0.06, decay: 1.25, release: 0.06 }});
    // Held top note
    tone(c, { type: "sine", freq: 1760, dur: 1.2, startAt: 1.35,
      gainOpts: { attack: 0.01, peak: 0.4, hold: 0.5, decay: 0.7, release: 0.06 }});
    // Cute little echo up
    slide(c, { type: "sine", from: 1000, to: 2637, dur: 0.6, startAt: 2.55,
      gainOpts: { attack: 0.01, peak: 0.35, decay: 0.55, release: 0.05 }});
  },

  // #6 — Barbershop quartet chord + progression (I-vi-IV-V-I)
  function barbershopChord(c) {
    const chords = [
      { freqs: [130.81, 196.0, 261.63, 329.63], t: 0    }, // I  (C E G C)
      { freqs: [110.0,  164.81, 220.0,  277.18], t: 0.6 }, // vi (A C E A)
      { freqs: [174.61, 261.63, 349.23, 440.0 ], t: 1.2 }, // IV (F A C F)
      { freqs: [196.0,  293.66, 392.0,  493.88], t: 1.8 }, // V  (G B D G)
      { freqs: [130.81, 196.0,  261.63, 329.63, 523.25], t: 2.4 }, // I resolution
    ];
    for (const ch of chords) {
      chord(c, { type: "sawtooth", freqs: ch.freqs, dur: 0.85, startAt: ch.t,
        gainOpts: { attack: 0.025, peak: 0.28, hold: 0.15, decay: 0.7, release: 0.05 }});
    }
    // final held top note
    tone(c, { type: "sine", freq: 659.25, dur: 1.2, startAt: 2.4,
      gainOpts: { attack: 0.03, peak: 0.32, hold: 0.4, decay: 0.75, release: 0.06 }});
  },

  // #7 — Game-show bell — DING DING DING DING DING
  function gameShowDing(c) {
    for (let i = 0; i < 6; i++) {
      const t = i * 0.5;
      tone(c, { type: "sine", freq: 1976, dur: 0.9, startAt: t,
        gainOpts: { attack: 0.001, peak: 0.55, hold: 0.05, decay: 0.85, release: 0.05 }});
      tone(c, { type: "triangle", freq: 2637, dur: 0.75, startAt: t,
        gainOpts: { attack: 0.001, peak: 0.25, decay: 0.7, release: 0.04 }});
    }
    // Final ring-out
    tone(c, { type: "sine", freq: 2637, dur: 1.5, startAt: 3.0,
      gainOpts: { attack: 0.001, peak: 0.45, decay: 1.4, release: 0.06 }});
  },

  // #8 — Jazz sax phrase (three-note motif with a bendy attack)
  function jazzSaxStab(c) {
    const t0 = c.currentTime;
    function saxNote(freq, startAt, dur, peak) {
      const o = c.createOscillator(); o.type = "sawtooth";
      const t = t0 + startAt;
      o.frequency.setValueAtTime(freq * 0.97, t);
      o.frequency.linearRampToValueAtTime(freq * 1.03, t + 0.08);
      o.frequency.linearRampToValueAtTime(freq, t + 0.15);
      const filter = c.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 1600; filter.Q.value = 4;
      const g = c.createGain();
      o.connect(filter); filter.connect(g); g.connect(c.destination);
      shape(c, g, { attack: 0.01, peak, hold: 0.1, decay: dur - 0.15, release: 0.06, duration: dur, startAt });
      o.start(t); o.stop(t + dur + 0.05);
    }
    saxNote(392.0, 0.0, 0.7, 0.5);   // G4
    saxNote(440.0, 0.7, 0.7, 0.5);   // A4
    saxNote(523.25, 1.4, 0.7, 0.55); // C5
    saxNote(659.25, 2.1, 1.2, 0.6);  // E5, held
  },

  // #9 — Marimba arpeggio + rolling rest note
  function marimbaHit(c) {
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 784.0, 1046.5];
    notes.forEach((f, i) => {
      tone(c, { type: "sine", freq: f, dur: 1.6, startAt: i * 0.18,
        gainOpts: { attack: 0.002, peak: 0.55, hold: 0.04, decay: 1.5, release: 0.06 }});
      tone(c, { type: "triangle", freq: f * 2, dur: 1.0, startAt: i * 0.18,
        gainOpts: { attack: 0.002, peak: 0.22, decay: 0.95, release: 0.05 }});
    });
    // Final low bass note ringing through
    tone(c, { type: "sine", freq: 130.81, dur: 2.0, startAt: 1.3,
      gainOpts: { attack: 0.005, peak: 0.35, decay: 1.9, release: 0.06 }});
  },

  // #10 — Vintage radio bell — three-note bell phrase + long ring-out
  function radioBell(c) {
    const notes = [1319, 1976, 1319, 1567, 1976];
    notes.forEach((f, i) => {
      tone(c, { type: "sine", freq: f, dur: 0.8, startAt: i * 0.35,
        gainOpts: { attack: 0.001, peak: 0.55, hold: 0.04, decay: 0.75, release: 0.05 }});
      tone(c, { type: "triangle", freq: f * 1.5, dur: 0.6, startAt: i * 0.35,
        gainOpts: { attack: 0.001, peak: 0.2, decay: 0.55, release: 0.04 }});
    });
    // Long final ring
    tone(c, { type: "sine", freq: 1976, dur: 1.4, startAt: 1.75,
      gainOpts: { attack: 0.001, peak: 0.5, decay: 1.3, release: 0.06 }});
    tone(c, { type: "sine", freq: 2637, dur: 1.2, startAt: 1.75,
      gainOpts: { attack: 0.001, peak: 0.25, decay: 1.1, release: 0.06 }});
  }
];

/* ---------- WRONG (10) — each ~2.5–3.5 s ---------- */

const WRONG_SOUNDS = [

  // #1 — FULL sad trombone — five descending womps + long "wahhhhh"
  function sadTrombone(c) {
    const notes = [
      { freq: 246.94, t: 0.0 },   // B3
      { freq: 220.00, t: 0.5 },   // A3
      { freq: 196.00, t: 1.0 },   // G3
      { freq: 174.61, t: 1.5 },   // F3
    ];
    for (const n of notes) {
      slide(c, { type: "sawtooth", from: n.freq * 1.08, to: n.freq, dur: 0.5, startAt: n.t,
        gainOpts: { attack: 0.03, peak: 0.45, hold: 0.12, decay: 0.32, release: 0.05 }});
    }
    // final "wahhhhhhh"
    slide(c, { type: "sawtooth", from: 174.61, to: 116.54, dur: 1.6, startAt: 2.0,
      gainOpts: { attack: 0.04, peak: 0.5, hold: 0.4, decay: 1.1, release: 0.06 }});
    // low bass under it
    tone(c, { type: "sine", freq: 58.27, dur: 1.6, startAt: 2.0,
      gainOpts: { attack: 0.04, peak: 0.32, hold: 0.4, decay: 1.1, release: 0.06 }});
  },

  // #2 — Slide whistle DOWN — dramatic descent + settle
  function slideDown(c) {
    slide(c, { type: "sine", from: 2093, to: 200, dur: 2.0,
      gainOpts: { attack: 0.02, peak: 0.5, hold: 0.15, decay: 1.8, release: 0.06 }});
    noiseBurst(c, { dur: 2.0, filterType: "bandpass", filterFreq: 900, filterQ: 2,
      gainOpts: { attack: 0.1, peak: 0.06, decay: 1.8, release: 0.06 }});
    // Sad settle tone
    tone(c, { type: "sine", freq: 174.61, dur: 1.2, startAt: 1.95,
      gainOpts: { attack: 0.02, peak: 0.35, hold: 0.2, decay: 0.95, release: 0.06 }});
  },

  // #3 — Harpo honk — five quacking honks
  function harpoHonk(c) {
    for (let i = 0; i < 5; i++) {
      const t = i * 0.55;
      slide(c, { type: "square", from: 320, to: 300, dur: 0.4, startAt: t,
        gainOpts: { attack: 0.005, peak: 0.35, hold: 0.15, decay: 0.22, release: 0.03 }});
      slide(c, { type: "sawtooth", from: 640, to: 600, dur: 0.4, startAt: t,
        gainOpts: { attack: 0.005, peak: 0.2, hold: 0.15, decay: 0.22, release: 0.03 }});
    }
  },

  // #4 — Long kazoo raspberry with pitch wobbles
  function kazooRaspberry(c) {
    const t0 = c.currentTime;
    const o = c.createOscillator(); o.type = "square";
    o.frequency.setValueAtTime(240, t0);
    // pitch wobble long
    for (let i = 0; i < 60; i++) {
      const t = t0 + i * 0.045;
      o.frequency.linearRampToValueAtTime(200 + (i % 2 ? 60 : 0) + Math.random() * 30, t);
    }
    const filter = c.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.value = 900; filter.Q.value = 6;
    const g = c.createGain();
    o.connect(filter); filter.connect(g); g.connect(c.destination);
    shape(c, g, { attack: 0.02, peak: 0.4, hold: 2.3, decay: 0.4, release: 0.05, duration: 2.8 });
    o.start(t0); o.stop(t0 + 2.85);
    // deflate at end
    slide(c, { type: "sawtooth", from: 220, to: 80, dur: 0.6, startAt: 2.6,
      gainOpts: { attack: 0.02, peak: 0.3, decay: 0.55, release: 0.05 }});
  },

  // #5 — Boing — four bounces, each smaller (like a spring settling)
  function boing(c) {
    function boingHit(startAt, peak) {
      const t0 = c.currentTime + startAt;
      const o = c.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(600, t0);
      o.frequency.exponentialRampToValueAtTime(160, t0 + 0.4);
      const lfo = c.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 22;
      const lfoGain = c.createGain(); lfoGain.gain.value = 80;
      lfo.connect(lfoGain); lfoGain.connect(o.frequency);
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      shape(c, g, { attack: 0.005, peak, hold: 0.05, decay: 0.5, release: 0.05, duration: 0.6, startAt });
      o.start(t0); lfo.start(t0);
      o.stop(t0 + 0.65); lfo.stop(t0 + 0.65);
    }
    boingHit(0.0, 0.5);
    boingHit(0.7, 0.35);
    boingHit(1.35, 0.25);
    boingHit(1.95, 0.18);
    boingHit(2.5, 0.12);
  },

  // #6 — Cartoon dud — thud + settling rattle
  function cartoonDud(c) {
    // big low thump
    tone(c, { type: "sine", freq: 90, dur: 0.8,
      gainOpts: { attack: 0.003, peak: 0.6, hold: 0.1, decay: 0.7, release: 0.05 }});
    noiseBurst(c, { dur: 0.4, filterType: "lowpass", filterFreq: 400,
      gainOpts: { attack: 0.002, peak: 0.35, decay: 0.38, release: 0.03 }});
    // small aftershock
    tone(c, { type: "sine", freq: 80, dur: 0.6, startAt: 0.9,
      gainOpts: { attack: 0.005, peak: 0.35, decay: 0.55, release: 0.04 }});
    // rattling debris
    for (let i = 0; i < 5; i++) {
      noiseBurst(c, { dur: 0.2, filterType: "highpass", filterFreq: 2000, startAt: 1.3 + i * 0.25,
        gainOpts: { attack: 0.005, peak: 0.15, decay: 0.18, release: 0.02 }});
    }
    // last low sigh
    tone(c, { type: "sine", freq: 65, dur: 0.8, startAt: 2.4,
      gainOpts: { attack: 0.01, peak: 0.3, decay: 0.75, release: 0.05 }});
  },

  // #7 — Cuckoo miss — off-key cuckoo phrase repeated + descending fail
  function cuckooMiss(c) {
    // First cuckoo (off-key)
    tone(c, { type: "sine", freq: 784, dur: 0.6,
      gainOpts: { attack: 0.005, peak: 0.5, hold: 0.08, decay: 0.5, release: 0.04 }});
    slide(c, { type: "sine", from: 622.25, to: 466.16, dur: 0.9, startAt: 0.55,
      gainOpts: { attack: 0.005, peak: 0.5, hold: 0.15, decay: 0.75, release: 0.05 }});
    // Second cuckoo (worse)
    tone(c, { type: "sine", freq: 740, dur: 0.6, startAt: 1.5,
      gainOpts: { attack: 0.005, peak: 0.5, hold: 0.08, decay: 0.5, release: 0.04 }});
    slide(c, { type: "sine", from: 580, to: 380, dur: 1.0, startAt: 2.05,
      gainOpts: { attack: 0.005, peak: 0.5, hold: 0.15, decay: 0.8, release: 0.05 }});
  },

  // #8 — Tuba honk — three descending pumps
  function tubaHonk(c) {
    const notes = [
      { from: 155.56, to: 130.81, t: 0.0 },  // Eb3 → C3
      { from: 130.81, to: 110.00, t: 0.8 },  // C3 → A2
      { from: 110.00, to: 87.31,  t: 1.6 }   // A2 → F2
    ];
    for (const n of notes) {
      slide(c, { type: "sawtooth", from: n.from, to: n.to, dur: 0.7, startAt: n.t,
        gainOpts: { attack: 0.015, peak: 0.5, hold: 0.22, decay: 0.42, release: 0.05 }});
      tone(c, { type: "sine", freq: n.to / 2, dur: 0.75, startAt: n.t,
        gainOpts: { attack: 0.015, peak: 0.32, hold: 0.22, decay: 0.48, release: 0.05 }});
    }
    // Long final low honk
    slide(c, { type: "sawtooth", from: 87.31, to: 65.4, dur: 0.9, startAt: 2.4,
      gainOpts: { attack: 0.02, peak: 0.55, hold: 0.35, decay: 0.5, release: 0.05 }});
  },

  // #9 — Sad clarinet — two sighing phrases
  function sadClarinet(c) {
    // Phrase 1: descending sigh
    slide(c, { type: "square", from: 349.23, to: 261.63, dur: 1.4,
      gainOpts: { attack: 0.08, peak: 0.35, hold: 0.35, decay: 0.9, release: 0.06 }});
    slide(c, { type: "triangle", from: 698.46, to: 523.25, dur: 1.4,
      gainOpts: { attack: 0.1, peak: 0.15, decay: 1.2, release: 0.06 }});
    // Phrase 2: lower sigh
    slide(c, { type: "square", from: 293.66, to: 220, dur: 1.6, startAt: 1.5,
      gainOpts: { attack: 0.09, peak: 0.4, hold: 0.4, decay: 1.05, release: 0.07 }});
    slide(c, { type: "triangle", from: 587.32, to: 440, dur: 1.6, startAt: 1.5,
      gainOpts: { attack: 0.1, peak: 0.15, decay: 1.4, release: 0.07 }});
  },

  // #10 — Doorbell fail — cheerful start, minor descent, dissonant flourish
  function doorbellFail(c) {
    // Cheerful first ding
    tone(c, { type: "sine", freq: 880, dur: 0.9,
      gainOpts: { attack: 0.002, peak: 0.5, hold: 0.15, decay: 0.72, release: 0.05 }});
    tone(c, { type: "triangle", freq: 1108.73, dur: 0.7,
      gainOpts: { attack: 0.002, peak: 0.28, decay: 0.65, release: 0.04 }});
    // Second ding sours (drops to tritone)
    slide(c, { type: "sine", from: 587.32, to: 415.3, dur: 1.4, startAt: 0.75,
      gainOpts: { attack: 0.002, peak: 0.5, hold: 0.3, decay: 1.05, release: 0.06 }});
    // Dissonant flourish — three clashing tones
    tone(c, { type: "square", freq: 466.16, dur: 0.6, startAt: 1.9,
      gainOpts: { attack: 0.005, peak: 0.3, hold: 0.15, decay: 0.42, release: 0.05 }});
    tone(c, { type: "square", freq: 493.88, dur: 0.6, startAt: 1.9,
      gainOpts: { attack: 0.005, peak: 0.28, hold: 0.15, decay: 0.42, release: 0.05 }});
    // Give up sigh
    slide(c, { type: "sine", from: 415.3, to: 220, dur: 0.8, startAt: 2.55,
      gainOpts: { attack: 0.01, peak: 0.4, decay: 0.75, release: 0.06 }});
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
