/* TT Pirates: the game's own sounds, made with Kit.sound.tone / hiss (Web Audio synth, no files).
   Everything is a no-op until Kit.sound.init() runs on the first tap or key, and silent while muted. */
(function () {
  'use strict';
  const TT = (window.TT = window.TT || {});
  const S = Kit.sound;
  const tone = (o) => S.tone(o), hiss = (o) => S.hiss(o);

  // a sea-shanty-ish jingle of our own for setting sail (D major, a hop and a skip)
  const JINGLE = [[587, 0, 0.12], [740, 0.14, 0.12], [880, 0.28, 0.12], [740, 0.42, 0.12], [880, 0.56, 0.12], [1175, 0.7, 0.36]];
  const FANFARE = [[523, 0, 0.14], [659, 0.15, 0.14], [784, 0.3, 0.14], [1047, 0.45, 0.3], [784, 0.78, 0.12], [1047, 0.92, 0.5]];

  TT.sfx = {
    sail() {
      for (const [f, at, dur] of JINGLE) tone({ type: 'square', f, at, dur, vol: 0.06, lp: 2800 });
      tone({ type: 'triangle', f: 147, dur: 0.3, vol: 0.2 });
      tone({ type: 'triangle', f: 220, at: 0.7, dur: 0.4, vol: 0.2 });
    },
    // the water cannon: a pump "fwoosh"
    squirt() {
      hiss({ filter: 'bandpass', f: 1800, to: 900, q: 2, dur: 0.16, vol: 0.12 });
      tone({ type: 'sine', f: 380, to: 620, dur: 0.08, vol: 0.06 });
    },
    // water landing in water
    plip() {
      tone({ type: 'sine', f: 900, to: 1600, dur: 0.07, vol: 0.06 });
      hiss({ filter: 'lowpass', f: 1500, to: 400, dur: 0.12, vol: 0.05 });
    },
    // a splash on a ship
    splash() {
      hiss({ filter: 'lowpass', f: 3000, to: 500, dur: 0.3, vol: 0.18 });
      tone({ type: 'sine', f: 600, to: 1200, dur: 0.09, vol: 0.08 });
    },
    // you got splashed: a cold "brrr"
    brr() {
      hiss({ filter: 'lowpass', f: 2400, to: 400, dur: 0.25, vol: 0.14 });
      tone({ type: 'square', f: 220, to: 180, dur: 0.18, vol: 0.04, lp: 900 });
    },
    // a ship is soaked: down-the-drain glug
    soaked() {
      for (let i = 0; i < 4; i++) tone({ type: 'sine', f: 520 - i * 70, to: 300 - i * 50, at: i * 0.09, dur: 0.1, vol: 0.12 });
      hiss({ filter: 'lowpass', f: 1800, to: 300, dur: 0.5, vol: 0.12 });
    },
    // the brother's BIG SPLASH
    bigSplash() {
      tone({ type: 'sine', f: 110, to: 45, dur: 0.5, vol: 0.3 });
      hiss({ filter: 'lowpass', f: 4000, to: 300, dur: 1.1, vol: 0.3 });
      hiss({ filter: 'highpass', f: 3000, at: 0.15, dur: 0.6, vol: 0.08 });
    },
    treasure() {
      for (const [f, at, dur] of FANFARE) tone({ type: 'square', f, at, dur, vol: 0.06, lp: 3200 });
      for (let i = 0; i < 6; i++) tone({ type: 'triangle', f: 1568 + i * 220, at: 1.1 + i * 0.05, dur: 0.1, vol: 0.05 });
    },
    // digging the sand
    dig() { hiss({ filter: 'bandpass', f: 900, q: 1.5, dur: 0.12, vol: 0.1 }); },
    // "not here": a friendly uh-oh
    wrong() {
      tone({ type: 'triangle', f: 440, dur: 0.14, vol: 0.12 });
      tone({ type: 'triangle', f: 330, at: 0.17, dur: 0.22, vol: 0.12 });
    },
    newMap() {
      hiss({ filter: 'highpass', f: 2500, dur: 0.2, vol: 0.06 });
      tone({ type: 'triangle', f: 880, to: 1320, dur: 0.12, vol: 0.08 });
    },
    treat() {
      tone({ type: 'triangle', f: 660, to: 990, dur: 0.1, vol: 0.12 });
      tone({ type: 'triangle', f: 990, to: 1480, at: 0.1, dur: 0.14, vol: 0.12 });
    },
    // a brother pops in (and out)
    pop() {
      tone({ type: 'sine', f: 500, to: 1200, dur: 0.1, vol: 0.12 });
      hiss({ f: 3000, dur: 0.06, vol: 0.05 });
    },
    blocked() {
      tone({ type: 'triangle', f: 1200, dur: 0.06, vol: 0.08 });
      tone({ type: 'triangle', f: 1600, at: 0.05, dur: 0.1, vol: 0.08 });
    },
    clap() {
      hiss({ filter: 'bandpass', f: 2000, q: 1, dur: 0.06, vol: 0.25 });
      hiss({ filter: 'bandpass', f: 2600, q: 1, at: 0.03, dur: 0.08, vol: 0.18 });
    },
    // a soaked friend is dry again and back out sailing
    dried() { tone({ type: 'sine', f: 700, to: 1050, dur: 0.12, vol: 0.06 }); },
  };
})();
