import net from 'node:net';
import { EventEmitter } from 'node:events';
import {
  CMD, CODE, CMD2, CODE2, DEV_TARGET, DEV_TOKEN,
  PacketParser, PacketParser2, JpegAssembler, encode, encodeJson, encodeJson2, parseJson, parseCatalogueXml, localUnixTime,
} from './protocol.js';
import { discover, DEFAULT_HOST, DEFAULT_PORT } from './discovery.js';

const now = () => performance.timeOrigin + performance.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One TCP session with the camera, in either packet format:
 *   v1 — most V720 cameras (A9, X5, M1 …): JSON commands wrapped in code 502
 *   v2 — newer models (A12, W1): plain JSON commands, video cmd 1003
 * Emits 'frame' (jpeg, timestampMs), 'audio' (alaw), 'json', 'packet', 'close' (error?).
 */
class Session extends EventEmitter {
  constructor(host, port, { protocol = 'v1', devId = null } = {}) {
    super();
    this.host = host;
    this.port = port;
    this.protocol = protocol === 'v2' ? 'v2' : 'v1';
    this.devId = devId || DEV_TARGET;
    this.parser = this.protocol === 'v2' ? new PacketParser2() : new PacketParser();
    this.pending = [];
    this.waiters = [];
    this.closed = false;
    this.lastPacketAt = 0;
    this.jpeg = new JpegAssembler((frame) => this.emit('frame', frame, now()));
  }

  open(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ host: this.host, port: this.port });
      this.sock = sock;
      sock.setNoDelay(true);
      sock.setKeepAlive(true, 5000);
      const t = setTimeout(() => { sock.destroy(); reject(new Error(`No answer from ${this.host}:${this.port}`)); }, timeoutMs);
      sock.once('connect', () => { clearTimeout(t); resolve(); });
      sock.on('data', (chunk) => this._onData(chunk));
      sock.on('error', (err) => { clearTimeout(t); this._close(err); reject(err); });
      sock.on('close', () => this._close());
    });
  }

  _onData(chunk) {
    this.lastPacketAt = Date.now();
    for (const p of this.parser.push(chunk)) this._onPacket(this._normalize(p));
  }

  /** Gives packets of both formats the same shape: { kind, cmd, payload }. */
  _normalize(p) {
    if (this.protocol === 'v2') {
      const kind = { [CMD2.JSON]: 'json', [CMD2.JPEG]: 'jpeg', [CMD2.G711]: 'audio', [CMD2.XML]: 'xml', [CMD2.LIVE_MOTION]: 'live', [CMD2.PING]: 'ping', [CMD2.PONG]: 'pong' }[p.cmd] || 'other';
      return { ...p, kind };
    }
    const kind = {
      [CMD.JSON]: 'json', [CMD.DIRECT_MOTION]: 'json', [CMD.JPEG]: 'jpeg', [CMD.G711]: 'audio', [CMD.XML]: 'xml',
      [CMD.LIVE_MOTION]: 'live', [CMD.HEARTBEAT]: 'heartbeat', [CMD.PING]: 'ping', [CMD.PONG]: 'pong',
    }[p.cmd] || 'other';
    return { ...p, kind };
  }

  _onPacket(p) {
    // Keep-alive: answer the camera's pings, or it drops the connection
    if (p.kind === 'heartbeat') { this.send(encode({ cmd: CMD.HEARTBEAT })); return; }
    if (p.kind === 'ping') { this.send(this.protocol === 'v2' ? encodeJson2Raw(CMD2.PONG) : encode({ cmd: CMD.PONG })); return; }
    if (p.kind === 'pong') return;
    // Anyone waiting for "the next packet of this kind" (handshake, XML, file data)
    for (let i = 0; i < this.waiters.length; i++) {
      const w = this.waiters[i];
      if (w.match(p)) {
        this.waiters.splice(i, 1);
        clearTimeout(w.timer);
        w.resolve(p);
        return;
      }
    }
    if (p.kind === 'jpeg') return this.jpeg.push(p.payload);
    if (p.kind === 'audio') return this.emit('audio', p.payload);
    if (p.kind === 'json' || p.kind === 'live') {
      const json = parseJson(p.payload);
      if (!json) return;
      this.emit('json', json);
      const key = json.content?.code ?? json.code;
      let idx = this.pending.findIndex((r) => r.key === key);
      if (idx === -1) idx = 0;
      const req = this.pending.splice(idx, 1)[0];
      if (req) { clearTimeout(req.timer); req.resolve(json); }
      return;
    }
    this.emit('packet', p);
  }

  send(buf) {
    if (!this.closed && this.sock?.writable) this.sock.write(buf);
  }

  sendJson(obj) {
    this.send(this.protocol === 'v2' ? encodeJson2(obj) : encodeJson(obj));
  }

  waitFor(match, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const w = { match, resolve };
      w.timer = setTimeout(() => {
        const i = this.waiters.indexOf(w);
        if (i !== -1) this.waiters.splice(i, 1);
        reject(new Error('Camera did not respond'));
      }, timeoutMs);
      this.waiters.push(w);
    });
  }

  /** Sends a JSON request and resolves with the camera's JSON answer. */
  request(obj, { timeoutMs = 4000, key } = {}) {
    return new Promise((resolve, reject) => {
      const req = { key: key ?? obj.content?.code ?? obj.code, resolve };
      req.timer = setTimeout(() => {
        const i = this.pending.indexOf(req);
        if (i !== -1) this.pending.splice(i, 1);
        reject(new Error('Camera did not respond'));
      }, timeoutMs);
      this.pending.push(req);
      this.sendJson(obj);
    });
  }

  /** A device command: wrapped in code 502 for v1 cameras, plain JSON for v2. */
  ap(content, opts) {
    if (this.protocol === 'v2') return this.request(content, opts);
    return this.request({ code: CODE.AP_COMMAND, content: { devTarget: this.devId, ...content } }, opts);
  }

  async handshake() {
    let conn = null;
    if (this.protocol === 'v2') {
      // Official app: send {"code":115}; a 115 packet back means "identify yourself"
      const first = this.waitFor((p) => p.kind === 'live' || p.kind === 'json', 5000).catch(() => null);
      this.sendJson({ code: CODE2.LIVE_MOTION });
      const p = await first;
      if (p?.kind === 'live') {
        conn = await this.request({ code: CODE2.LIVE_MOTION, target: this.devId, token: DEV_TOKEN, unixTimer: localUnixTime() }, { timeoutMs: 5000 }).catch(() => null);
      }
    } else {
      // Official app: send a bare 115 header; the camera answers 115, then we log in with code 501
      const first = this.waitFor((p) => p.kind === 'live' || p.kind === 'json', 5000).catch(() => null);
      this.send(encode({ cmd: CMD.LIVE_MOTION }));
      await first;
      conn = await this.request({ code: CODE.AP_CONNECT, target: this.devId, token: DEV_TOKEN, unixTimer: localUnixTime() }, { timeoutMs: 5000 });
    }
    if (this.closed) throw new Error('Camera closed the connection');
    let info = {};
    try {
      const r = this.protocol === 'v2'
        ? await this.ap({ code: CODE2.BASE_INFO })
        : await this.ap({ code: CODE.BASE_INFO, unixTimer: localUnixTime() });
      info = r?.content ?? r ?? {};
    } catch { /* some firmwares skip this */ }
    if (this.closed) throw new Error('Camera closed the connection');
    const devId = conn?.devId ?? info.devId ?? (this.devId !== DEV_TARGET ? this.devId : null);
    return { ...info, devId, protocol: this.protocol };
  }

  openAV() {
    return this.protocol === 'v2' ? this.ap({ code: CODE2.AV_SWITCH, avSwitch: 3 }) : this.ap({ code: CODE.OPEN_AV });
  }

  closeAV() {
    return this.protocol === 'v2' ? this.ap({ code: CODE2.AV_SWITCH, avSwitch: 0 }) : this.ap({ code: CODE.CLOSE_AV });
  }

  reboot() {
    if (this.protocol === 'v2') this.sendJson({ code: CODE2.REBOOT });
    else this.sendJson({ code: CODE.AP_COMMAND, content: { devTarget: this.devId, code: CODE.REBOOT } });
  }

  close() { this._close(); }

  _close(err) {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.hb);
    this.sock?.destroy();
    for (const r of this.pending) { clearTimeout(r.timer); r.resolve(null); }
    for (const w of this.waiters) { clearTimeout(w.timer); w.resolve(null); }
    this.pending = [];
    this.waiters = [];
    this.emit('close', err);
  }

  startHeartbeat() {
    if (this.closed) return;
    this.hb = setInterval(() => {
      this.send(this.protocol === 'v2' ? encodeJson2Raw(CMD2.PING) : encode({ cmd: CMD.HEARTBEAT }));
    }, 5000);
  }
}

// A header-only v2 packet (ping / pong)
function encodeJson2Raw(cmd) {
  const b = Buffer.alloc(20);
  b.writeUInt32LE(cmd, 4);
  return b;
}

/**
 * Finds the camera, keeps a connection to it alive, reconnects when it drops, and only streams
 * video while someone is watching (to save the camera's battery).
 */
export class Camera extends EventEmitter {
  /**
   * @param {{host?: string, port?: number, settings?: object, autoDiscover?: boolean}} opts
   *   host: a fixed address; leave it out to search like the official app.
   */
  constructor({ host = null, port = DEFAULT_PORT, settings = {}, autoDiscover = true } = {}) {
    super();
    this.fixedHost = host;
    this.port = port;
    this.autoDiscover = autoDiscover;
    this.settings = { ir: false, flip: 0, ...settings };
    // Where the camera was found last time (remembered so the next start is instant)
    this.target = this.settings.lastCamera || null;
    this.state = 'idle';
    this.info = null;
    this.lastError = null;
    this.lastSearch = null;
    this.lastFrame = null;
    this.lastFrameAt = 0;
    this.frameTimes = [];
    this.viewers = 0;
    this.streaming = false;
    this.busy = false; // SD-card download in progress
    this.setMaxListeners(100);
  }

  get host() { return this.target?.host ?? this.fixedHost ?? DEFAULT_HOST; }

  start() {
    if (this.running) return;
    this.running = true;
    this._loop();
    this.watchdog = setInterval(() => this._watch(), 2000);
  }

  stop() {
    this.running = false;
    clearInterval(this.watchdog);
    this._wake?.();
    this.session?.close();
  }

  status() {
    const t = this.frameTimes;
    const fps = t.length > 1 ? ((t.length - 1) * 1000) / (t[t.length - 1] - t[0]) : 0;
    return {
      state: this.state,
      connected: this.state === 'connected',
      streaming: this.streaming,
      busy: this.busy,
      camera: `${this.host}:${this.port}`,
      protocol: this.target?.protocol ?? null,
      info: this.info,
      fps: Math.round(fps * 10) / 10,
      lastFrameAgeMs: this.lastFrameAt ? Date.now() - this.lastFrameAt : null,
      viewers: this.viewers,
      settings: { ir: this.settings.ir, flip: this.settings.flip },
      lastError: this.lastError,
      search: this.lastSearch,
    };
  }

  /** Looks for cameras (also used by the "Find camera" button). */
  async search({ scan = false } = {}) {
    if (this.state !== 'connected') this._setState('searching');
    const res = await discover({ preferred: this.fixedHost || this.target?.host, port: this.port, scan });
    this.lastSearch = { at: Date.now(), scan, tried: res.tried.map(({ host, ok, protocol, devId, reason }) => ({ host, ok, protocol, devId, reason })), networks: res.networks };
    return res;
  }

  /** Use this camera from now on (from the search results or a typed address). */
  useCamera({ host, port, protocol = null, devId = null }) {
    this.target = { host, port: Number(port) || DEFAULT_PORT, protocol, devId };
    this.port = this.target.port;
    this.settings.lastCamera = this.target;
    this.emit('settings', this.settings);
    this.reconnect();
  }

  async _loop() {
    let backoff = 1000;
    while (this.running) {
      if (this.busy) { await sleep(500); continue; }

      // 1. Find the camera if we don't know where it is (or the last place stopped working)
      if (!this.target || this.target.stale) {
        if (this.autoDiscover) {
          const res = await this.search();
          if (!this.running) break;
          const best = res.found.find((f) => f.devId) || res.found[0];
          if (best) {
            this.target = { host: best.host, port: best.port, protocol: best.protocol, devId: best.devId };
            this.settings.lastCamera = this.target;
            this.emit('settings', this.settings);
          } else {
            this.lastError = 'no camera answered at 192.168.169.1 or on this network';
            this._setState('disconnected');
            await this._sleep(backoff);
            backoff = Math.min(backoff * 1.6, 8000);
            continue;
          }
        } else {
          this.target = { host: this.fixedHost || DEFAULT_HOST, port: this.port, protocol: null, devId: null };
        }
      }

      // 2. Connect and log in
      this._setState('connecting');
      const t = this.target;
      const s = new Session(t.host, t.port, { protocol: t.protocol || 'v1', devId: t.devId });
      this.session = s;
      let connected = false;
      try {
        await s.open();
        if (!this.running) throw new Error('stopped');
        s.on('frame', (jpeg, ts) => this._onFrame(jpeg, ts));
        s.on('audio', (a) => this.emit('audio', a));
        const closed = new Promise((r) => s.once('close', r));
        this.info = await s.handshake();
        if (!t.devId && this.info.devId) t.devId = this.info.devId;
        s.startHeartbeat();
        this.lastError = null;
        backoff = 1000;
        connected = true;
        this._setState('connected');
        await this._applySettings();
        this.streaming = false;
        if (this.viewers > 0) await this._openStream();
        const err = await closed;
        if (err) this.lastError = err.message;
      } catch (err) {
        this.lastError = err.message;
        s.close();
        // An unknown-format camera that failed in v1: try v2 next time, then search again
        if (!connected && t === this.target) {
          if (!t.protocol) t.protocol = 'v2';
          else if (this.autoDiscover && !this.fixedHost) t.stale = true;
        }
      }
      this.session = null;
      this.streaming = false;
      if (!this.running) break;
      if (this.busy) continue;
      this._setState('disconnected');
      await this._sleep(backoff);
      backoff = Math.min(backoff * 1.6, 8000);
    }
    this._setState('idle');
  }

  _sleep(ms) {
    return new Promise((r) => { const t = setTimeout(r, ms); this._wake = () => { clearTimeout(t); r(); }; });
  }

  _watch() {
    const s = this.session;
    if (!s || this.busy) return;
    if (this.streaming && this.lastFrameAt && Date.now() - this.lastFrameAt > 10000 && Date.now() - s.lastPacketAt > 10000) {
      this.lastError = 'Video stopped, reconnecting';
      s.close();
    }
    if (this.streaming && this.viewers === 0 && Date.now() - (this.lastViewerLeft || 0) > 20000) {
      this._closeStream();
    }
  }

  _setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.emit('state', state);
  }

  _onFrame(jpeg, ts) {
    this.lastFrame = jpeg;
    this.lastFrameAt = Date.now();
    this.frameTimes.push(ts);
    while (this.frameTimes.length > 30) this.frameTimes.shift();
    this.emit('frame', jpeg, ts);
  }

  async _applySettings() {
    try { await this.setIr(this.settings.ir); } catch { /* ignore */ }
    if (this.settings.flip) { try { await this.setFlip(this.settings.flip); } catch { /* ignore */ } }
  }

  async _openStream() {
    if (!this.session) return;
    this.streaming = true;
    // Some firmwares never answer this; frames arriving is the real confirmation.
    this.session.openAV().catch(() => {});
  }

  _closeStream() {
    if (!this.session) return;
    this.streaming = false;
    this.session.closeAV().catch(() => {});
  }

  addViewer() {
    this.viewers++;
    if (!this.streaming && this.state === 'connected') this._openStream();
  }

  removeViewer() {
    this.viewers = Math.max(0, this.viewers - 1);
    if (this.viewers === 0) this.lastViewerLeft = Date.now();
  }

  _need() {
    if (!this.session || this.session.closed || this.state !== 'connected') throw new Error('Camera is not connected');
    return this.session;
  }

  _needV1(what) {
    const s = this._need();
    if (s.protocol !== 'v1') throw new Error(`${what} isn’t supported for this camera model yet`);
    return s;
  }

  async setIr(on) {
    this.settings.ir = !!on;
    this.emit('settings', this.settings);
    return this._need().ap({ code: CODE.IR_LED, IrLed: on ? 1 : 0 });
  }

  async setFlip(mode) {
    this.settings.flip = Number(mode) || 0;
    this.emit('settings', this.settings);
    return this._need().ap({ code: CODE.VIDEO_FLIP, mirrorFlip: this.settings.flip });
  }

  async sdStatus() {
    const r = await this._needV1('The SD card').ap({ code: CODE.SDCARD_STATUS });
    return r?.content ?? r;
  }

  async wifiScan() {
    const r = await this._needV1('Wi-Fi scan').ap({ code: CODE.WIFI_SCAN }, { timeoutMs: 10000 });
    return r?.content ?? r;
  }

  reboot() {
    this._need().reboot();
  }

  reconnect() {
    this._wake?.();
    this.session?.close();
  }

  // ---------- SD card (v1 cameras) ----------

  async sdDates() {
    const s = this._needV1('The SD card');
    const r = await s.request({ code: CODE.SD_DATE_LIST, devTarget: s.devId }, { timeoutMs: 6000 });
    return r?.dates ?? [];
  }

  async sdFiles(date) {
    const s = this._needV1('The SD card');
    const xml = s.waitFor((p) => p.kind === 'xml', 8000);
    const r = await s.request({ code: CODE.SD_CONFIG, devTarget: s.devId, date: Number(date) }, { timeoutMs: 6000 });
    if (!r || r.status !== 200) { xml.catch(() => {}); return []; }
    const p = await xml;
    return p ? parseCatalogueXml(p.payload.toString('utf8')) : [];
  }

  async sdFileInfo(date, hour, minute) {
    const s = this._needV1('The SD card');
    return s.request({ code: CODE.SD_MEDIA_INFO, devTarget: s.devId, date: Number(date), hours: Number(hour), minute: Number(minute) });
  }

  /**
   * Streams a recorded AVI from the SD card into `write(chunk)`.
   * The camera pauses recording while doing this, and live video stops; it resumes afterwards.
   */
  async sdDownload(date, hour, minute, write) {
    const s = this._needV1('The SD card');
    if (this.busy) throw new Error('Another download is running');
    this.busy = true;
    const wasStreaming = this.streaming;
    try {
      if (wasStreaming) this._closeStream();
      await sleep(300);
      let total = 0;
      let done;
      const finished = new Promise((r) => { done = r; });
      let idle = setTimeout(() => done(), 8000);
      const bump = () => { clearTimeout(idle); idle = setTimeout(() => done(), 3000); };
      const onPacket = (p) => {
        if (p.cmd === CMD.AVI || p.cmd === CMD.JPEG || p.cmd === CMD.G711 || p.cmd > 1000 || p.cmd === 5 || p.cmd === 6) {
          total += p.payload.length;
          write(p.payload);
          bump();
        }
      };
      const onJson = (j) => { if (j.code === CODE.SD_STREAM_END) done(); };
      // While downloading, file data arrives as plain packets instead of live frames.
      const origJpeg = s.jpeg;
      s.jpeg = { push: (d) => onPacket({ cmd: CMD.JPEG, payload: d }) };
      s.on('packet', onPacket);
      s.on('json', onJson);
      const r = await s.request({ code: CODE.SD_START_STREAM, devTarget: s.devId, date: Number(date), hours: Number(hour), minute: Number(minute) }, { timeoutMs: 8000 });
      if (!r || (r.status !== undefined && r.status !== 200)) {
        clearTimeout(idle);
        throw new Error(`Camera refused the download (status ${r?.status ?? 'none'})`);
      }
      bump();
      await finished;
      clearTimeout(idle);
      s.off('packet', onPacket);
      s.off('json', onJson);
      s.jpeg = origJpeg;
      return total;
    } finally {
      this.busy = false;
      // A clean session is the most reliable way back to live video.
      s.close();
    }
  }
}
