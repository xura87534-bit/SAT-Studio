// Speed radar: measures speed with v = d / t.
//
// You draw two lines (A and B) across the path the object travels, and enter the real-world
// distance d between them. Each frame, the detector compares the picture with a learned
// background; when something moving reaches a line it records the time. When the object has
// crossed both lines, t is the difference between the two crossing times, and
//
//     v = d / t
//
// Timing comes from when each frame was captured, not when it was shown, and crossing times are
// interpolated between frames, so the result is better than one frame interval. The remaining
// uncertainty is still about ±1 frame interval over t, and is reported as a range.

export const UNITS = {
  kmh: { label: 'km/h', factor: 3.6 },
  mph: { label: 'mph', factor: 2.236936 },
  ms: { label: 'm/s', factor: 1 },
  kn: { label: 'knots', factor: 1.943844 },
};

export function convert(ms, unit) {
  return ms * (UNITS[unit] || UNITS.kmh).factor;
}

/** Speed from distance (m) and time (s), with the range given a timing uncertainty (s). */
export function speedFrom(distanceM, seconds, uncertaintyS = 0) {
  const v = distanceM / seconds;
  const lo = distanceM / (seconds + uncertaintyS);
  const hi = seconds - uncertaintyS > 1e-3 ? distanceM / (seconds - uncertaintyS) : Infinity;
  return { v, lo, hi };
}

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** Pixel indices of a band around a line segment (normalised 0..1 coordinates) in a w×h grid. */
export function lineSamples(line, w, h, halfWidth = 1) {
  const [x1, y1, x2, y2] = [line[0] * (w - 1), line[1] * (h - 1), line[2] * (w - 1), line[3] * (h - 1)];
  const len = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(2, Math.ceil(len));
  const nx = len ? -(y2 - y1) / len : 0;
  const ny = len ? (x2 - x1) / len : 1;
  const set = new Set();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    for (let o = -halfWidth; o <= halfWidth; o++) {
      const x = Math.round(px + nx * o);
      const y = Math.round(py + ny * o);
      if (x >= 0 && y >= 0 && x < w && y < h) set.add(y * w + x);
    }
  }
  return Int32Array.from(set);
}

export class SpeedGate {
  constructor(opts = {}) {
    this.lines = opts.lines || [[0.3, 0.2, 0.3, 0.9], [0.7, 0.2, 0.7, 0.9]];
    this.distanceM = opts.distanceM ?? 10;
    this.sensitivity = opts.sensitivity ?? 50; // 0..100
    this.minSeconds = opts.minSeconds ?? 0.05;
    this.maxSeconds = opts.maxSeconds ?? 15;
    this.onMeasure = opts.onMeasure || (() => {});
    this.onCross = opts.onCross || (() => {});
    this.reset();
  }

  reset() {
    this.bg = null;
    this.w = 0;
    this.h = 0;
    this.samples = null;
    this.state = [this._lineState(), this._lineState()];
    this.pending = null;
    this.prevT = null;
    this.intervals = [];
    this.warmup = 0;
    this.mask = null;
  }

  _lineState() {
    return { armed: true, quiet: 0, activity: 0, prevActivity: 0, lastFire: null };
  }

  setLines(lines) {
    this.lines = lines;
    this.samples = null;
    this.pending = null;
  }

  /** Difference (0..255) a pixel needs from the background to count as moving. */
  get diffThreshold() {
    return 70 - clamp(this.sensitivity, 0, 100) * 0.6; // 70 (low) .. 10 (high)
  }

  /** Share of a line's pixels that must be moving to count as a crossing. */
  get triggerFraction() {
    return 0.3 - clamp(this.sensitivity, 0, 100) * 0.0022; // 0.30 .. 0.08
  }

  /** Median time between frames, in seconds. */
  get frameInterval() {
    if (!this.intervals.length) return 0;
    const s = [...this.intervals].sort((a, b) => a - b);
    return s[s.length >> 1] / 1000;
  }

  /**
   * Feed one greyscale frame.
   * @param {Uint8Array|Uint8ClampedArray|Float32Array} gray  w*h luminance values (0..255)
   * @param {number} t  capture time of the frame in milliseconds
   */
  process(gray, w, h, t) {
    const n = w * h;
    if (!this.bg || this.w !== w || this.h !== h) {
      this.w = w;
      this.h = h;
      this.bg = Float32Array.from(gray);
      this.mask = new Uint8Array(n);
      this.samples = null;
      this.prevT = t;
      this.warmup = 3;
      return this._result([], false);
    }
    if (!this.samples) this.samples = this.lines.map((l) => lineSamples(l, w, h, 1));

    if (this.prevT != null && t > this.prevT) {
      this.intervals.push(t - this.prevT);
      if (this.intervals.length > 30) this.intervals.shift();
    }

    const thr = this.diffThreshold;
    const bg = this.bg;
    const mask = this.mask;
    let moving = 0;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(gray[i] - bg[i]);
      const m = d > thr ? 1 : 0;
      mask[i] = m;
      moving += m;
      // Learn the background: fast where still, very slowly where something moves
      bg[i] += (gray[i] - bg[i]) * (m ? 0.004 : 0.06);
    }

    // Whole picture changed (IR switched, auto exposure, camera bumped): relearn, no events
    if (moving / n > 0.45) {
      bg.set(gray);
      this.warmup = 3;
      this.pending = null;
      for (const s of this.state) { s.armed = false; s.quiet = 0; s.activity = 0; s.prevActivity = 0; }
      this.prevT = t;
      return this._result([], true);
    }

    const events = [];
    const trig = this.triggerFraction;
    for (let li = 0; li < 2; li++) {
      const idx = this.samples[li];
      let c = 0;
      for (let k = 0; k < idx.length; k++) c += mask[idx[k]];
      const st = this.state[li];
      st.prevActivity = st.activity;
      st.activity = idx.length ? c / idx.length : 0;

      if (this.warmup > 0) continue;
      if (st.armed && st.activity >= trig) {
        // Interpolate when activity passed the trigger level between the two frames
        const a0 = st.prevActivity;
        const f = st.activity > a0 ? clamp((trig - a0) / (st.activity - a0), 0, 1) : 1;
        const tf = this.prevT != null ? this.prevT + (t - this.prevT) * f : t;
        st.armed = false;
        st.quiet = 0;
        st.lastFire = tf;
        events.push({ line: li, t: tf });
      } else if (!st.armed) {
        st.quiet = st.activity < trig * 0.4 ? st.quiet + 1 : 0;
        if (st.quiet >= 2) st.armed = true;
      }
    }
    if (this.warmup > 0) this.warmup--;

    const measurements = [];
    // Both lines in the same frame: the object is longer than the gate or it is noise, skip
    if (events.length === 2) {
      events.forEach((ev) => this.onCross(ev));
      this.pending = null;
      this.prevT = t;
      return this._result([], false);
    }
    for (const ev of events) {
      this.onCross(ev);
      const p = this.pending;
      if (p && p.line !== ev.line) {
        const dt = (ev.t - p.t) / 1000;
        if (dt >= this.minSeconds && dt <= this.maxSeconds) {
          const unc = this.frameInterval;
          const s = speedFrom(this.distanceM, dt, unc);
          const m = {
            time: Date.now(),
            from: p.line,
            to: ev.line,
            direction: p.line === 0 ? 'A→B' : 'B→A',
            seconds: dt,
            distanceM: this.distanceM,
            speed: s.v,
            low: s.lo,
            high: s.hi,
            uncertaintyS: unc,
          };
          measurements.push(m);
          this.onMeasure(m);
          this.pending = null;
          continue;
        }
      }
      this.pending = { line: ev.line, t: ev.t };
    }
    if (this.pending && (t - this.pending.t) / 1000 > this.maxSeconds) this.pending = null;

    this.prevT = t;
    return this._result(measurements, false);
  }

  _result(measurements, relearned) {
    return {
      measurements,
      relearned,
      activity: this.state.map((s) => s.activity),
      armed: this.state.map((s) => s.armed),
      pending: this.pending ? this.pending.line : null,
    };
  }
}

/** Converts RGBA pixels into greyscale (Rec. 601 luma). */
export function toGray(rgba, out) {
  const n = rgba.length >> 2;
  const g = out && out.length === n ? out : new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) g[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
  return g;
}

/** Decoder for G.711 A-law audio (the camera's microphone). */
export function alawToFloat(bytes) {
  const out = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = ALAW[bytes[i]] / 32768;
  return out;
}
const ALAW = (() => {
  const t = new Int16Array(256);
  for (let i = 0; i < 256; i++) {
    const a = i ^ 0x55;
    const seg = (a & 0x70) >> 4;
    let v = (a & 0x0f) << 4;
    v = seg === 0 ? v + 8 : seg === 1 ? v + 0x108 : (v + 0x108) << (seg - 1);
    t[i] = a & 0x80 ? v : -v;
  }
  return t;
})();
