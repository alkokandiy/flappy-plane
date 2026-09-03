// Sound effects (synthesized with Web Audio, no files needed) plus
// background music (assets/music/*.ogg|mp3|wav, played only during play).
// Everything is created lazily on the first user tap, which also
// satisfies browser autoplay policies on desktop and mobile.

import { MUSIC_VOLUME } from "./config.js";

const MUSIC_EXTS = ["ogg", "mp3", "wav"];
const MUSIC_RE = /href="([^"]+?\.(ogg|mp3|wav))"/gi;

export class SoundFX {
  constructor() {
    this.ctx = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  tone({ from = 440, to = 440, dur = 0.1, type = "sine", vol = 0.25, when = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.2, vol = 0.3, when = 0, freq = 1000 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(t0);
  }

  wing() {
    // Barely-there flutter so rapid tapping doesn't get annoying.
    this.noise({ dur: 0.08, vol: 0.03, freq: 2500 });
  }
  point() {
    this.tone({ from: 880, to: 880, dur: 0.07, type: "square", vol: 0.04 });
    this.tone({ from: 1320, to: 1320, dur: 0.12, type: "square", vol: 0.04, when: 0.07 });
  }
  hit() {
    this.noise({ dur: 0.25, vol: 0.4, freq: 400 });
  }
  die() {
    this.tone({ from: 600, to: 80, dur: 0.5, type: "sawtooth", vol: 0.2 });
  }
  swoosh() {
    this.noise({ dur: 0.18, vol: 0.15, freq: 1200 });
  }
}

export class Music {
  constructor(base = "assets/music") {
    this.base = base;
    this.el = null;
    this.track = null;
  }

  // Find the first supported track in the music folder by reading the
  // server's directory listing (works with any static server that
  // allows indexing, e.g. `python -m http.server`). Any filename works:
  // just drop a .ogg/.mp3/.wav into assets/music/.
  // A page can also force a track via window.FLAPPY_MUSIC_URL.
  async findTrack() {
    if (window.FLAPPY_MUSIC_URL) {
      this.track = window.FLAPPY_MUSIC_URL;
      return this.track;
    }
    try {
      const res = await fetch(`${this.base}/`);
      if (!res.ok) return null;
      const html = await res.text();
      const found = [];
      let m;
      MUSIC_RE.lastIndex = 0;
      while ((m = MUSIC_RE.exec(html)) !== null) {
        const name = decodeURIComponent(m[1]).split("/").pop();
        if (name && !name.startsWith("?") && MUSIC_EXTS.some((e) => name.toLowerCase().endsWith(`.${e}`))) {
          found.push(name);
        }
      }
      found.sort();
      if (found.length > 0) {
        this.track = `${this.base}/${encodeURIComponent(found[0])}`;
        return this.track;
      }
    } catch {
      /* no listing available -> silent */
    }
    return null;
  }

  start() {
    if (!this.track) return;
    try {
      if (!this.el) {
        this.el = new Audio(this.track);
        this.el.loop = true;
        this.el.volume = MUSIC_VOLUME;
        this.el.preload = "auto";
      }
      this.el.currentTime = 0;
      const p = this.el.play();
      if (p && p.catch) p.catch(() => {});
    } catch {
      /* silent when no track / not allowed */
    }
  }

  stop() {
    try {
      if (this.el) {
        this.el.pause();
        this.el.currentTime = 0;
      }
    } catch {
      /* ignore */
    }
  }
}
