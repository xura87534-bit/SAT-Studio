import { SpeedGate, UNITS, convert, speedFrom, toGray, alawToFloat } from './radar.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// ---------------------------------------------------------------- settings
const DEFAULTS = {
  source: 'camera',
  lines: [[0.3, 0.25, 0.3, 0.92], [0.7, 0.25, 0.7, 0.92]],
  distanceM: 10,
  unit: 'kmh',
  sensitivity: 55,
  limit: 0,
  radarOn: false,
  showMotion: false,
  rotate: 0,
  mirror: false,
  tab: 'live',
};
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const S = { ...DEFAULTS, ...store.get('cc.settings', {}) };
const save = () => store.set('cc.settings', S);

// ---------------------------------------------------------------- helpers
const view = $('#view');
const ctx = view.getContext('2d');
const stage = $('#stage');
let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
async function api(path, body) {
  const r = await fetch(path, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '∞');
const unitLabel = () => UNITS[S.unit].label;
function stageMsg(text) {
  const m = $('#stageMsg');
  m.hidden = !text;
  if (text) m.textContent = text;
}

// ---------------------------------------------------------------- picture sources
const CRLF2 = [13, 10, 13, 10];
function indexOfSeq(buf, seq, from = 0) {
  outer: for (let i = from; i <= buf.length - seq.length; i++) {
    for (let j = 0; j < seq.length; j++) if (buf[i + j] !== seq[j]) continue outer;
    return i;
  }
  return -1;
}

/** Live MJPEG from the bridge, read with fetch so every frame keeps its capture timestamp. */
class CameraSource {
  constructor(onFrame) { this.onFrame = onFrame; this.active = false; }
  start() {
    this.active = true;
    this._run();
  }
  stop() {
    this.active = false;
    this.ctrl?.abort();
  }
  async _run() {
    const dec = new TextDecoder();
    while (this.active) {
      this.ctrl = new AbortController();
      try {
        const res = await fetch('stream.mjpg', { signal: this.ctrl.signal, cache: 'no-store' });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        let buf = new Uint8Array(0);
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const nb = new Uint8Array(buf.length + value.length);
          nb.set(buf);
          nb.set(value, buf.length);
          buf = nb;
          for (;;) {
            const he = indexOfSeq(buf, CRLF2);
            if (he < 0) { if (buf.length > 4096 && indexOfSeq(buf, [45, 45]) < 0) buf = new Uint8Array(0); break; }
            const head = dec.decode(buf.subarray(0, he));
            const len = /Content-Length:\s*(\d+)/i.exec(head);
            if (!len) { buf = buf.subarray(he + 4); continue; }
            const start = he + 4;
            const end = start + Number(len[1]);
            if (buf.length < end) break;
            const ts = /X-Timestamp:\s*([\d.]+)/i.exec(head);
            this._deliver(buf.slice(start, end), ts ? Number(ts[1]) : performance.timeOrigin + performance.now());
            buf = buf.subarray(end);
          }
        }
      } catch (e) {
        if (!this.active) return;
      }
      if (this.active) await new Promise((r) => setTimeout(r, 1200));
    }
  }
  async _deliver(bytes, ts) {
    // Decode one frame at a time; if the device is slow, skip to the newest one.
    if (this.decoding) { this.next = [bytes, ts]; return; }
    this.decoding = true;
    let item = [bytes, ts];
    while (item && this.active) {
      try {
        const bmp = await createImageBitmap(new Blob([item[0]], { type: 'image/jpeg' }));
        this.onFrame(bmp, item[1], bmp.width, bmp.height);
      } catch { /* corrupt frame */ }
      item = this.next;
      this.next = null;
    }
    this.decoding = false;
  }
}

/** A <video> element (device camera or file), with per-frame timestamps where supported. */
class VideoSource {
  constructor(onFrame, kind) {
    this.onFrame = onFrame;
    this.kind = kind;
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
  }
  async start(file) {
    this.active = true;
    const v = this.video;
    if (this.kind === 'device') {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser only allows the camera on https or localhost. Open the app on the Mac at http://localhost, or use the Wi-Fi camera.');
      }
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false });
      v.srcObject = this.stream;
    } else {
      v.src = URL.createObjectURL(file);
      v.loop = true;
    }
    await v.play().catch(() => {});
    const loop = (now, meta) => {
      if (!this.active) return;
      if (v.videoWidth) {
        let t;
        if (this.kind === 'file') t = (meta?.mediaTime ?? v.currentTime) * 1000;
        else t = meta?.captureTime ?? (meta ? meta.expectedDisplayTime : performance.now());
        this.onFrame(v, t, v.videoWidth, v.videoHeight);
      }
      this._next(loop);
    };
    this._next(loop);
  }
  _next(cb) {
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) this.video.requestVideoFrameCallback(cb);
    else requestAnimationFrame((n) => cb(n, null));
  }
  stop() {
    this.active = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.video.pause();
    if (this.video.src) URL.revokeObjectURL(this.video.src);
    this.video.removeAttribute('src');
    this.video.srcObject = null;
  }
}

// ---------------------------------------------------------------- rendering + radar
const small = document.createElement('canvas');
const sctx = small.getContext('2d', { willReadFrequently: true });
const maskCanvas = document.createElement('canvas');
const mctx = maskCanvas.getContext('2d');
let gray = null;
let last = null; // { img, sw, sh }
let lastT = null;
let lastFrameWall = 0;
let lastMeasure = null;
let zoom = 1;
let pan = { x: 0, y: 0 };

const gate = new SpeedGate({
  lines: S.lines,
  distanceM: S.distanceM,
  sensitivity: S.sensitivity,
  onMeasure: (m) => addMeasurement(m),
});

function onFrame(img, t, sw, sh) {
  if (last && last.img !== img && last.img.close) last.img.close();
  last = { img, sw, sh };
  lastFrameWall = Date.now();
  stageMsg('');
  if (lastT != null && t < lastT) gate.reset(); // video looped or seeked back
  lastT = t;
  render(true, t);
}

function render(detect, t) {
  if (!last) return;
  const { img, sw, sh } = last;
  const swap = S.rotate % 180 !== 0;
  const W = swap ? sh : sw;
  const H = swap ? sw : sh;
  if (view.width !== W || view.height !== H) {
    view.width = W;
    view.height = H;
    stage.style.setProperty('--ar', `${W} / ${H}`);
    gate.reset();
  }
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2 + pan.x * W, H / 2 + pan.y * H);
  ctx.scale(zoom, zoom);
  ctx.rotate((S.rotate * Math.PI) / 180);
  if (S.mirror) ctx.scale(-1, 1);
  try { ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh); } catch { /* closed bitmap */ }
  ctx.restore();

  let res = null;
  if (S.radarOn && detect) {
    const dw = 192;
    const dh = Math.max(8, Math.round((dw * H) / W));
    if (small.width !== dw || small.height !== dh) { small.width = dw; small.height = dh; }
    sctx.drawImage(view, 0, 0, dw, dh);
    const px = sctx.getImageData(0, 0, dw, dh).data;
    gray = toGray(px, gray);
    res = gate.process(gray, dw, dh, t);
    updateMeters(res);
  }
  drawOverlay(res);
  if (recorder) drawRecStamp();
}

function drawOverlay(res) {
  const W = view.width;
  const H = view.height;
  const u = Math.max(1.5, W / 320);
  if (S.radarOn && S.showMotion && gate.mask && gate.w) {
    if (maskCanvas.width !== gate.w || maskCanvas.height !== gate.h) { maskCanvas.width = gate.w; maskCanvas.height = gate.h; }
    const id = mctx.createImageData(gate.w, gate.h);
    const m = gate.mask;
    for (let i = 0, j = 0; i < m.length; i++, j += 4) if (m[i]) { id.data[j] = 255; id.data[j + 1] = 60; id.data[j + 2] = 60; id.data[j + 3] = 150; }
    mctx.putImageData(id, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(maskCanvas, 0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
  }
  if (!S.radarOn && !editing) return;
  const colors = ['#22d3ee', '#f472b6'];
  S.lines.forEach((l, i) => {
    const [x1, y1, x2, y2] = [l[0] * W, l[1] * H, l[2] * W, l[3] * H];
    const act = res ? res.activity[i] : 0;
    const pending = res && res.pending === i;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.6)';
    ctx.lineWidth = u * 4;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = colors[i];
    ctx.lineWidth = u * (2 + Math.min(1, act / gate.triggerFraction) * 2);
    if (!pending) ctx.setLineDash(act >= gate.triggerFraction ? [] : [u * 6, u * 4]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.setLineDash([]);
    if (editing) {
      for (const [hx, hy] of [[x1, y1], [x2, y2]]) {
        ctx.fillStyle = colors[i];
        ctx.beginPath(); ctx.arc(hx, hy, u * 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = u; ctx.stroke();
      }
    }
    const lx = x1 + (x2 - x1) * 0.0;
    const ly = Math.min(y1, y2) - u * 8;
    ctx.font = `700 ${Math.round(u * 11)}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.fillRect(lx - u * 9, ly - u * 11, u * 18, u * 15);
    ctx.fillStyle = colors[i];
    ctx.fillText(i ? 'B' : 'A', lx, ly);
    ctx.restore();
  });
  // distance label between the lines
  const [a, b] = S.lines;
  const mx = ((a[0] + a[2]) / 2 + (b[0] + b[2]) / 2) / 2 * W;
  const my = ((a[1] + a[3]) / 2 + (b[1] + b[3]) / 2) / 2 * H;
  ctx.save();
  ctx.font = `600 ${Math.round(u * 9)}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  const label = `← ${S.distanceM} m →`;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(mx - tw / 2 - u * 4, my - u * 9, tw + u * 8, u * 13);
  ctx.fillStyle = '#fff';
  ctx.fillText(label, mx, my);
  if (lastMeasure && Date.now() - lastMeasure.time < 4000) {
    const txt = `${fmt(convert(lastMeasure.speed, S.unit))} ${unitLabel()}  ${lastMeasure.direction}`;
    ctx.font = `800 ${Math.round(u * 16)}px -apple-system, system-ui, sans-serif`;
    const w2 = ctx.measureText(txt).width;
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.fillRect(mx - w2 / 2 - u * 6, my + u * 8, w2 + u * 12, u * 22);
    ctx.fillStyle = isOver(lastMeasure) ? '#f87171' : '#fff';
    ctx.fillText(txt, mx, my + u * 24);
  }
  ctx.restore();
}

function drawRecStamp() {
  const u = Math.max(1, view.width / 480);
  ctx.save();
  ctx.font = `600 ${Math.round(u * 10)}px ui-monospace, Menlo, monospace`;
  const txt = new Date().toLocaleString();
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(4 * u, view.height - 18 * u, ctx.measureText(txt).width + 8 * u, 15 * u);
  ctx.fillStyle = '#fff';
  ctx.fillText(txt, 8 * u, view.height - 7 * u);
  ctx.restore();
}

function updateMeters(res) {
  const trig = gate.triggerFraction;
  $('#mA').style.width = `${Math.min(100, (res.activity[0] / trig) * 100)}%`;
  $('#mB').style.width = `${Math.min(100, (res.activity[1] / trig) * 100)}%`;
}

// Timing info for the radar card
setInterval(() => {
  if (!S.radarOn) return;
  const fi = gate.frameInterval;
  $('#radarInfo').textContent = fi
    ? `${fmt(1 / fi, 1)} frames/s → each crossing is timed to within one frame (${Math.round(fi * 1000)} ms), so t is good to about ±${Math.round(fi * 1000)} ms. At ${S.distanceM} m, 50 km/h gives t = ${fmt(S.distanceM / (50 / 3.6), 2)} s.`
    : 'Waiting for pictures…';
}, 1000);

// ---------------------------------------------------------------- measurements
let log = store.get('cc.log', []);
const thumbs = new Map();
const isOver = (m) => S.limit > 0 && convert(m.speed, S.unit) > S.limit;

function addMeasurement(m) {
  m.id = `${m.time}-${Math.random().toString(36).slice(2, 6)}`;
  m.method = m.method || 'radar';
  if (m.method === 'radar' && view.width) {
    try {
      const c = document.createElement('canvas');
      c.width = 192;
      c.height = Math.round((192 * view.height) / view.width);
      c.getContext('2d').drawImage(view, 0, 0, c.width, c.height);
      thumbs.set(m.id, c.toDataURL('image/jpeg', 0.7));
    } catch { /* tainted */ }
  }
  log.unshift(m);
  log = log.slice(0, 300);
  store.set('cc.log', log);
  lastMeasure = m;
  showSpeed(m);
  renderLog();
  if (isOver(m)) alarm();
}

function showSpeed(m) {
  const b = $('#speedBadge');
  b.hidden = false;
  $('#sbValue').textContent = fmt(convert(m.speed, S.unit));
  $('#sbUnit').textContent = `${unitLabel()} ${m.direction || ''}`;
  b.classList.toggle('over', isOver(m));
  b.classList.add('flash');
  setTimeout(() => b.classList.remove('flash'), 250);
  const v = convert(m.speed, S.unit);
  $('#fLive').innerHTML = `<b>${fmt(m.distanceM, 2)} m</b> ÷ <b>${fmt(m.seconds, 3)} s</b> = <b>${fmt(m.speed, 2)} m/s</b> = <b>${fmt(v)} ${unitLabel()}</b>`
    + (Number.isFinite(m.high) ? `<br>range ${fmt(convert(m.low, S.unit))}–${fmt(convert(m.high, S.unit))} ${unitLabel()} (±${Math.round(m.uncertaintyS * 1000)} ms)` : '');
}

function renderLog() {
  const ol = $('#log');
  ol.textContent = '';
  $('#logEmpty').hidden = log.length > 0;
  for (const m of log.slice(0, 100)) {
    const li = document.createElement('li');
    if (isOver(m)) li.className = 'over';
    const src = thumbs.get(m.id);
    const img = document.createElement(src ? 'img' : 'div');
    if (src) { img.src = src; img.alt = 'Picture at the moment of measurement'; } else { img.className = 'noimg'; img.textContent = m.method === 'manual' ? '⏱' : '🚗'; }
    const mid = document.createElement('div');
    const range = Number.isFinite(m.high) ? ` · ${fmt(convert(m.low, S.unit))}–${fmt(convert(m.high, S.unit))}` : '';
    mid.innerHTML = `<div class="v">${fmt(convert(m.speed, S.unit))} <small>${unitLabel()}</small></div>`
      + `<div class="meta">${fmt(m.distanceM, 2)} m in ${fmt(m.seconds, 3)} s${range} · ${new Date(m.time).toLocaleTimeString()}${m.method === 'manual' ? ' · stopwatch' : ''}</div>`;
    const dir = document.createElement('div');
    dir.className = 'dir';
    dir.textContent = m.direction || '';
    li.append(img, mid, dir);
    ol.append(li);
  }
}

$('#btnClear').onclick = () => {
  if (log.length && !confirm('Delete all measurements?')) return;
  log = [];
  thumbs.clear();
  store.set('cc.log', log);
  renderLog();
  $('#speedBadge').hidden = true;
};
$('#btnCsv').onclick = () => {
  const rows = [['time', 'method', 'direction', 'distance_m', 'time_s', 'speed_m_s', 'speed_km_h', 'speed_mph', 'low_km_h', 'high_km_h', 'timing_uncertainty_s']];
  for (const m of log) {
    rows.push([new Date(m.time).toISOString(), m.method, m.direction || '', m.distanceM, m.seconds.toFixed(4), m.speed.toFixed(3),
      (m.speed * 3.6).toFixed(2), convert(m.speed, 'mph').toFixed(2), (m.low * 3.6).toFixed(2), Number.isFinite(m.high) ? (m.high * 3.6).toFixed(2) : '', (m.uncertaintyS || 0).toFixed(3)]);
  }
  download(new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }), `speeds-${stamp()}.csv`);
};

let audioCtxBeep;
function alarm() {
  try {
    audioCtxBeep ||= new AudioContext();
    const o = audioCtxBeep.createOscillator();
    const g = audioCtxBeep.createGain();
    o.frequency.value = 1320;
    o.type = 'square';
    g.gain.setValueAtTime(0.0001, audioCtxBeep.currentTime);
    for (let i = 0; i < 3; i++) {
      const t0 = audioCtxBeep.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.2, t0);
      g.gain.setValueAtTime(0.0001, t0 + 0.14);
    }
    o.connect(g).connect(audioCtxBeep.destination);
    o.start();
    o.stop(audioCtxBeep.currentTime + 0.7);
  } catch { /* no audio */ }
  navigator.vibrate?.([120, 80, 120]);
}

// ---------------------------------------------------------------- stopwatch
let swStart = null;
let swRaf;
$('#swBtn').onclick = () => {
  const btn = $('#swBtn');
  if (swStart == null) {
    swStart = performance.now();
    btn.textContent = 'Stop';
    const tick = () => { $('#swTime').textContent = `${((performance.now() - swStart) / 1000).toFixed(3)} s`; swRaf = requestAnimationFrame(tick); };
    tick();
  } else {
    cancelAnimationFrame(swRaf);
    const secs = (performance.now() - swStart) / 1000;
    swStart = null;
    btn.textContent = 'Start';
    $('#swTime').textContent = `${secs.toFixed(3)} s`;
    if (secs < 0.05) return;
    const s = speedFrom(S.distanceM, secs, 0.2);
    addMeasurement({ time: Date.now(), method: 'manual', direction: '', seconds: secs, distanceM: S.distanceM, speed: s.v, low: s.lo, high: s.hi, uncertaintyS: 0.2 });
  }
};

// ---------------------------------------------------------------- line editing, zoom & pan
let editing = false;
let drag = null;
function canvasPoint(e) {
  // the canvas is letter-boxed with object-fit: contain
  const r = view.getBoundingClientRect();
  const ar = view.width / view.height;
  let w = r.width;
  let h = r.width / ar;
  if (h > r.height) { h = r.height; w = h * ar; }
  const ox = r.left + (r.width - w) / 2;
  const oy = r.top + (r.height - h) / 2;
  return { x: (e.clientX - ox) / w, y: (e.clientY - oy) / h, pxW: w, pxH: h };
}
function distToSeg(px, py, l, W, H) {
  const [x1, y1, x2, y2] = [l[0] * W, l[1] * H, l[2] * W, l[3] * H];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}
view.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  if (editing) {
    const W = p.pxW;
    const H = p.pxH;
    let best = null;
    S.lines.forEach((l, i) => {
      for (const k of [0, 1]) {
        const d = Math.hypot((l[k * 2] - p.x) * W, (l[k * 2 + 1] - p.y) * H);
        if (d < 32 && (!best || d < best.d)) best = { d, line: i, end: k };
      }
    });
    if (!best) {
      S.lines.forEach((l, i) => {
        const d = distToSeg(p.x * W, p.y * H, l, W, H);
        if (d < 24 && (!best || d < best.d)) best = { d, line: i, end: -1 };
      });
    }
    if (best) {
      drag = { ...best, start: p, orig: [...S.lines[best.line]] };
      view.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  } else if (zoom > 1) {
    drag = { pan: true, start: p, orig: { ...pan } };
    view.setPointerCapture(e.pointerId);
  }
});
view.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const c = (v) => Math.max(0, Math.min(1, v));
  if (drag.pan) {
    pan = { x: drag.orig.x + (p.x - drag.start.x), y: drag.orig.y + (p.y - drag.start.y) };
    clampPan();
  } else if (drag.end === -1) {
    const dx = p.x - drag.start.x;
    const dy = p.y - drag.start.y;
    const o = drag.orig;
    S.lines[drag.line] = [c(o[0] + dx), c(o[1] + dy), c(o[2] + dx), c(o[3] + dy)];
  } else {
    S.lines[drag.line][drag.end * 2] = c(p.x);
    S.lines[drag.line][drag.end * 2 + 1] = c(p.y);
  }
  render(false);
});
const endDrag = () => {
  if (drag && !drag.pan) {
    gate.setLines(S.lines);
    gate.reset();
    save();
  }
  drag = null;
};
view.addEventListener('pointerup', endDrag);
view.addEventListener('pointercancel', endDrag);
view.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });

function clampPan() {
  const m = (zoom - 1) / 2;
  pan.x = Math.max(-m, Math.min(m, pan.x));
  pan.y = Math.max(-m, Math.min(m, pan.y));
}
function setZoom(z) {
  zoom = Math.max(1, Math.min(6, z));
  if (zoom === 1) pan = { x: 0, y: 0 };
  clampPan();
  stage.classList.toggle('panning', zoom > 1 && !editing);
  gate.reset();
  render(false);
}
$('#btnZoomIn').onclick = () => setZoom(zoom * 1.4);
$('#btnZoomOut').onclick = () => setZoom(zoom / 1.4);
$('#btnZoomReset').onclick = () => setZoom(1);
$('#btnFull').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else if (stage.requestFullscreen) stage.requestFullscreen().catch(() => {});
  else if (view.webkitEnterFullscreen) view.webkitEnterFullscreen();
  else toast('Full screen is not available in this browser. Add the app to your Home Screen instead.');
};
function setEditing(on) {
  editing = on;
  $('#btnEditLines').setAttribute('aria-pressed', String(on));
  stage.classList.toggle('editing', on);
  stage.classList.toggle('panning', zoom > 1 && !on);
  render(false);
}
$('#btnEditLines').onclick = () => setEditing(!editing);

// ---------------------------------------------------------------- camera controls
$('#btnSnap').onclick = () => {
  if (!last) return toast('No picture yet');
  view.toBlob((b) => { if (b) { download(b, `photo-${stamp()}.jpg`); toast('Photo saved'); } }, 'image/jpeg', 0.93);
};

let recorder = null;
let recChunks = [];
let recStart = 0;
let recTimer;
$('#btnRec').onclick = () => {
  if (recorder) { recorder.stop(); return; }
  if (!view.captureStream || !window.MediaRecorder) return toast('Recording is not supported in this browser');
  if (!last) return toast('No picture yet');
  const stream = view.captureStream(25);
  const at = audio.recordTrack();
  if (at) stream.addTrack(at);
  const type = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
  try { recorder = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 4e6 } : undefined); } catch (e) { return toast(`Can't record: ${e.message}`); }
  recChunks = [];
  recorder.ondataavailable = (e) => e.data.size && recChunks.push(e.data);
  recorder.onstop = () => {
    const mt = recorder.mimeType || type || 'video/webm';
    download(new Blob(recChunks, { type: mt }), `video-${stamp()}.${mt.includes('mp4') ? 'mp4' : 'webm'}`);
    recorder = null;
    clearInterval(recTimer);
    $('#recBadge').hidden = true;
    $('#btnRec').classList.remove('recording');
    $('#recLabel').textContent = 'Record';
    toast('Video saved');
  };
  recorder.start(1000);
  recStart = Date.now();
  $('#recBadge').hidden = false;
  $('#btnRec').classList.add('recording');
  $('#recLabel').textContent = 'Stop';
  recTimer = setInterval(() => {
    const s = Math.floor((Date.now() - recStart) / 1000);
    $('#recTime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 500);
};

let camSettings = { ir: false, flip: 0 };
$('#btnIr').onclick = async () => {
  const on = !camSettings.ir;
  try {
    await api('api/ir', { on });
    camSettings.ir = on;
    reflectCamSettings();
    toast(on ? 'Night vision on' : 'Night vision off');
  } catch (e) { toast(`Couldn't switch night vision: ${e.message}`); }
};
$('#flipSel').onchange = async (e) => {
  try { await api('api/flip', { mode: Number(e.target.value) }); camSettings.flip = Number(e.target.value); } catch (err) { toast(`Couldn't change the picture: ${err.message}`); }
};
$('#btnRotate').onclick = () => { S.rotate = (S.rotate + 90) % 360; save(); render(false); };
$('#btnMirror').onclick = () => { S.mirror = !S.mirror; save(); $('#btnMirror').setAttribute('aria-pressed', String(S.mirror)); render(false); };
function reflectCamSettings() {
  $('#btnIr').setAttribute('aria-pressed', String(!!camSettings.ir));
  $('#irBadge').hidden = !camSettings.ir;
  $('#flipSel').value = String(camSettings.flip || 0);
}

// ---------------------------------------------------------------- audio (camera microphone)
const audio = {
  on: false,
  async start() {
    this.ctx ||= new AudioContext();
    await this.ctx.resume();
    this.gain ||= this.ctx.createGain();
    this.gain.connect(this.ctx.destination);
    this.dest ||= this.ctx.createMediaStreamDestination();
    this.gain.connect(this.dest);
    this.on = true;
    this.ctrl = new AbortController();
    this.next = 0;
    const res = await fetch('audio.alaw', { signal: this.ctrl.signal, cache: 'no-store' });
    if (!res.ok || !res.body) throw new Error('No sound from the camera');
    const reader = res.body.getReader();
    (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done || !this.on) break;
          this._play(alawToFloat(value));
        }
      } catch { /* stopped */ }
    })();
  },
  _play(pcm8k) {
    const rate = this.ctx.sampleRate;
    const n = Math.round((pcm8k.length * rate) / 8000);
    if (!n) return;
    const buf = this.ctx.createBuffer(1, n, rate);
    const out = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const x = (i * 8000) / rate;
      const i0 = Math.floor(x);
      const f = x - i0;
      out[i] = (pcm8k[i0] || 0) * (1 - f) + (pcm8k[i0 + 1] ?? pcm8k[i0] ?? 0) * f;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.gain);
    const now = this.ctx.currentTime;
    if (this.next < now + 0.05 || this.next > now + 1.0) this.next = now + 0.15; // (re)buffer
    src.start(this.next);
    this.next += buf.duration;
  },
  stop() {
    this.on = false;
    this.ctrl?.abort();
  },
  recordTrack() {
    return this.on && this.dest ? this.dest.stream.getAudioTracks()[0] : null;
  },
};
$('#btnAudio').onclick = async () => {
  const btn = $('#btnAudio');
  if (audio.on) { audio.stop(); btn.setAttribute('aria-pressed', 'false'); return; }
  if (S.source !== 'camera') return toast('Sound comes from the Wi-Fi camera only');
  try {
    await audio.start();
    btn.setAttribute('aria-pressed', 'true');
    toast('Listening to the camera microphone');
  } catch (e) { toast(e.message); }
};

// ---------------------------------------------------------------- source switching
let source = null;
async function setSource(kind, file) {
  source?.stop();
  source = null;
  last = null;
  lastT = null;
  gate.reset();
  S.source = kind;
  save();
  $$('#srcSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.src === kind)));
  $('#fileBar').hidden = kind !== 'file';
  if (kind !== 'camera' && audio.on) $('#btnAudio').click();
  if (kind === 'camera') {
    stageMsg('Connecting to the camera…');
    source = new CameraSource(onFrame);
    source.start();
  } else if (kind === 'device') {
    stageMsg('Starting this device’s camera…');
    source = new VideoSource(onFrame, 'device');
    try { await source.start(); } catch (e) { stageMsg(e.message); }
  } else if (kind === 'file') {
    if (!file) { $('#fileIn').click(); stageMsg('Choose a video file in Setup → Picture source'); return; }
    source = new VideoSource(onFrame, 'file');
    await source.start(file);
    bindFileBar(source.video);
  }
}
$$('#srcSeg button').forEach((b) => { b.onclick = () => (b.dataset.src === 'file' ? $('#fileIn').click() : setSource(b.dataset.src)); });
$('#fileIn').onchange = (e) => { const f = e.target.files[0]; if (f) setSource('file', f); e.target.value = ''; };

function bindFileBar(v) {
  const play = $('#fbPlay');
  const seek = $('#fbSeek');
  play.onclick = () => (v.paused ? v.play() : v.pause());
  v.onplay = () => { play.textContent = '❚❚'; };
  v.onpause = () => { play.textContent = '▶'; };
  v.ontimeupdate = () => { if (v.duration) seek.value = String(Math.round((v.currentTime / v.duration) * 1000)); };
  seek.oninput = () => { if (v.duration) { v.currentTime = (seek.value / 1000) * v.duration; gate.reset(); } };
  $('#fbRate').onchange = (e) => { v.playbackRate = Number(e.target.value); };
  v.playbackRate = Number($('#fbRate').value);
  play.textContent = v.paused ? '▶' : '❚❚';
}

// ---------------------------------------------------------------- status polling
let bridgeOk = null;
async function poll() {
  try {
    const s = await api('api/status');
    bridgeOk = true;
    const dot = $('#statusDot');
    const live = s.connected && s.lastFrameAgeMs != null && s.lastFrameAgeMs < 4000;
    dot.className = `dot ${s.connected ? (live || !s.streaming ? 'ok' : 'warn') : 'bad'}`;
    $('#statusText').textContent = s.busy ? 'Downloading…' : s.connected ? (s.demo ? 'Demo camera' : 'Camera connected') : s.state === 'connecting' ? 'Looking for camera…' : 'Camera not found';
    $('#demoChip').hidden = !s.demo;
    $('#fpsChip').hidden = !(S.source === 'camera' && s.fps);
    $('#fpsChip').textContent = `${s.fps} fps`;
    const batt = s.info?.batteryLevel ?? s.info?.battery ?? s.info?.power;
    $('#battChip').hidden = batt == null;
    if (batt != null) $('#battChip').textContent = `🔋 ${batt}%`;
    if (s.settings) {
      const changed = s.settings.ir !== camSettings.ir || s.settings.flip !== camSettings.flip;
      camSettings = { ...s.settings };
      if (changed) reflectCamSettings();
    }
    const kv = [['Address', s.camera], ['Status', s.state], ['Firmware', s.info?.version], ['Device ID', s.info?.devId], ['Battery', batt != null ? `${batt}%` : null], ['Frames/s', s.fps || null], ['Last problem', s.lastError]];
    $('#camInfo').innerHTML = kv.filter(([, v]) => v != null && v !== '').map(([k, v]) => `<dt>${k}</dt><dd>${String(v).replace(/[<>&]/g, '')}</dd>`).join('');
    if (S.source === 'camera' && !last) {
      stageMsg(s.connected ? 'Camera connected. Waiting for the picture…' : `Can’t reach the camera${s.lastError ? ` (${s.lastError})` : ''}.\nIs this computer on the camera’s Wi-Fi? See Setup.`);
    }
    if (S.source === 'camera' && last && Date.now() - lastFrameWall > 5000) stageMsg('Picture paused — reconnecting…');
  } catch {
    bridgeOk = false;
    $('#statusDot').className = 'dot bad';
    $('#statusText').textContent = 'Bridge not running';
    if (S.source === 'camera') stageMsg('Can’t reach the CamControl bridge. Start it on your Mac with “node server.js” and open the address it prints.');
  }
}
setInterval(poll, 2000);
poll();

// ---------------------------------------------------------------- SD card
$('#btnSdLoad').onclick = async () => {
  const st = $('#sdStatus');
  const list = $('#sdList');
  list.textContent = '';
  st.textContent = 'Asking the camera…';
  try {
    const sd = await api('api/sd/status').catch(() => null);
    if (sd && sd.sdDevStatus !== undefined && sd.sdDevStatus <= 0) { st.textContent = 'No memory card found in the camera.'; return; }
    const { dates } = await api('api/sd/dates');
    if (!dates?.length) { st.textContent = 'The memory card has no recordings.'; return; }
    st.textContent = `Recordings on ${dates.length} day${dates.length > 1 ? 's' : ''}. Pick a day:`;
    const row = document.createElement('div');
    row.className = 'sd-dates';
    for (const d of [...dates].sort().reverse()) {
      const b = document.createElement('button');
      const ds = String(d);
      b.textContent = `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}`;
      b.onclick = () => loadDay(ds);
      row.append(b);
    }
    list.append(row);
  } catch (e) { st.textContent = `Couldn't read the card: ${e.message}`; }
};
async function loadDay(date) {
  const host = $('#sdList');
  host.querySelector('.sd-date')?.remove();
  const box = document.createElement('div');
  box.className = 'sd-date';
  box.innerHTML = `<h4>${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}</h4><p class="hint">Loading…</p>`;
  host.append(box);
  try {
    const { files } = await api(`api/sd/files?date=${date}`);
    box.querySelector('.hint').textContent = files.length ? 'Tap a time to download that minute (AVI, plays in VLC or QuickTime with a converter).' : 'No files on this day.';
    const wrap = document.createElement('div');
    wrap.className = 'sd-files';
    for (const f of files) {
      const a = document.createElement('a');
      a.href = `api/sd/download?date=${date}&hour=${f.hour}&minute=${f.minute}`;
      a.download = '';
      a.textContent = `${String(f.hour).padStart(2, '0')}:${String(f.minute).padStart(2, '0')}`;
      wrap.append(a);
    }
    box.append(wrap);
  } catch (e) { box.querySelector('.hint').textContent = `Couldn't list files: ${e.message}`; }
}

$('#btnReconnect').onclick = async () => { try { await api('api/reconnect', {}); toast('Reconnecting…'); } catch (e) { toast(e.message); } };
$('#btnReboot').onclick = async () => {
  if (!confirm('Restart the camera? It takes about 20 seconds to come back.')) return;
  try { await api('api/reboot', {}); toast('Camera is restarting'); } catch (e) { toast(e.message); }
};

// ---------------------------------------------------------------- radar settings UI
function bindRadarUi() {
  const on = $('#radarOn');
  on.checked = S.radarOn;
  on.onchange = () => {
    S.radarOn = on.checked;
    save();
    gate.reset();
    if (S.radarOn && !store.get('cc.linesTouched', false)) { setEditing(true); store.set('cc.linesTouched', true); toast('Drag the A and B lines onto your two marks'); }
    if (!S.radarOn && editing) setEditing(false);
    render(false);
  };
  const dist = $('#distIn');
  dist.value = S.distanceM;
  dist.oninput = () => { const v = Number(dist.value); if (v > 0) { S.distanceM = v; gate.distanceM = v; save(); render(false); } };
  const unit = $('#unitSel');
  unit.value = S.unit;
  const syncUnit = () => { $('#limitUnit').textContent = unitLabel(); $('#sbUnit').textContent = unitLabel(); };
  unit.onchange = () => { S.unit = unit.value; save(); syncUnit(); renderLog(); if (lastMeasure) showSpeed(lastMeasure); };
  syncUnit();
  const sens = $('#sensIn');
  sens.value = S.sensitivity;
  sens.oninput = () => { S.sensitivity = Number(sens.value); gate.sensitivity = S.sensitivity; save(); };
  const lim = $('#limitIn');
  lim.value = S.limit || '';
  lim.oninput = () => { S.limit = Number(lim.value) || 0; save(); renderLog(); };
  const mo = $('#motionIn');
  mo.checked = S.showMotion;
  mo.onchange = () => { S.showMotion = mo.checked; save(); };
}

// ---------------------------------------------------------------- tabs
function showTab(name) {
  $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('.tab-body').forEach((p) => { p.hidden = p.id !== `tab-${name}`; });
  S.tab = name;
  save();
}
$$('.tabs button').forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });

// keyboard shortcuts on the Mac
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  if (e.code === 'Space' && S.tab === 'radar') { e.preventDefault(); $('#swBtn').click(); }
  else if (e.key === 'p') $('#btnSnap').click();
  else if (e.key === 'r') $('#btnRec').click();
  else if (e.key === 'f') $('#btnFull').click();
});

// keep the screen on while watching
async function wakeLock() {
  try { if (document.visibilityState === 'visible') await navigator.wakeLock?.request('screen'); } catch { /* not allowed */ }
}
document.addEventListener('visibilitychange', wakeLock);

// ---------------------------------------------------------------- start
bindRadarUi();
showTab(S.tab);
$('#btnMirror').setAttribute('aria-pressed', String(S.mirror));
renderLog();
setSource(S.source === 'file' ? 'camera' : S.source);
wakeLock();
if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});

// for tests
window.__cc = { gate, S, get log() { return log; } };
