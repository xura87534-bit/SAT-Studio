import net from 'node:net';
import { EventEmitter } from 'node:events';
import {
  CMD, CODE, DEV_TARGET, DEV_TOKEN,
  PacketParser, JpegAssembler, encode, encodeJson, encodeAp, parseJson, parseCatalogueXml,
} from './protocol.js';

const now = () => performance.timeOrigin + performance.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One TCP session with the camera. Emits:
 *   'frame' (jpeg: Buffer, timestampMs: number)
 *   'audio' (alaw: Buffer)
 *   'close' (error?)
 */
class Session extends EventEmitter {
  constructor(host, port) {
    super();
    this.host = host;
    this.port = port;
    this.parser = new PacketParser();
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
      const t = setTimeout(() => { sock.destroy(); reject(new Error(`No answer from camera at ${this.host}:${this.port}`)); }, timeoutMs);
      sock.once('connect', () => { clearTimeout(t); resolve(); });
      sock.on('data', (chunk) => this._onData(chunk));
      sock.on('error', (err) => { clearTimeout(t); this._close(err); reject(err); });
      sock.on('close', () => this._close());
    });
  }

  _onData(chunk) {
    this.lastPacketAt = Date.now();
    for (const p of this.parser.push(chunk)) this._onPacket(p);
  }

  _onPacket(p) {
    if (p.cmd === CMD.HEARTBEAT) {
      this.send(encode({ cmd: CMD.HEARTBEAT }));
      return;
    }
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
    if (p.cmd === CMD.JPEG) return this.jpeg.push(p.payload);
    if (p.cmd === CMD.G711) return this.emit('audio', p.payload);
    if (p.cmd === CMD.JSON || p.cmd === CMD.LIVE_MOTION) {
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

  waitFor(match, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const w = { match, resolve };
      w.timer = setTimeout(() => {
        this.waiters.splice(this.waiters.indexOf(w), 1);
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
      this.send(encodeJson(obj));
    });
  }

  ap(content, opts) {
    return this.request({ code: CODE.AP_COMMAND, content: { devTarget: DEV_TARGET, ...content } }, opts);
  }

  async handshake() {
    const first = this.waitFor((p) => p.cmd === CMD.LIVE_MOTION || p.cmd === CMD.JSON);
    this.send(encode({ cmd: CMD.LIVE_MOTION }));
    await first;
    const conn = await this.request({
      code: CODE.AP_CONNECT, target: DEV_TARGET, token: DEV_TOKEN, unixTimer: Math.floor(Date.now() / 1000),
    });
    let info = {};
    try {
      const r = await this.ap({ code: CODE.BASE_INFO, unixTimer: Math.floor(Date.now() / 1000) });
      info = r?.content ?? {};
    } catch { /* some firmwares skip this */ }
    if (this.closed) throw new Error('Camera closed the connection');
    return { devId: conn?.devId ?? info.devId ?? null, ...info };
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
    this.hb = setInterval(() => this.send(encode({ cmd: CMD.HEARTBEAT })), 5000);
  }
}

/**
 * Keeps a connection to the camera alive, re-connects when it drops, and only streams
 * video while someone is watching (to save the camera's battery).
 */
export class Camera extends EventEmitter {
  constructor({ host = '192.168.169.1', port = 6123, settings = {} } = {}) {
    super();
    this.host = host;
    this.port = port;
    this.settings = { ir: false, flip: 0, ...settings };
    this.state = 'idle';
    this.info = null;
    this.lastError = null;
    this.lastFrame = null;
    this.lastFrameAt = 0;
    this.frameTimes = [];
    this.viewers = 0;
    this.streaming = false;
    this.busy = false; // SD-card download in progress
    this.setMaxListeners(100);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._loop();
    this.watchdog = setInterval(() => this._watch(), 2000);
  }

  stop() {
    this.running = false;
    clearInterval(this.watchdog);
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
      info: this.info,
      fps: Math.round(fps * 10) / 10,
      lastFrameAgeMs: this.lastFrameAt ? Date.now() - this.lastFrameAt : null,
      viewers: this.viewers,
      settings: this.settings,
      lastError: this.lastError,
    };
  }

  async _loop() {
    let backoff = 1000;
    while (this.running) {
      if (this.busy) { await sleep(500); continue; }
      this._setState('connecting');
      const s = new Session(this.host, this.port);
      this.session = s;
      try {
        await s.open();
        if (!this.running) throw new Error('stopped');
        s.on('frame', (jpeg, ts) => this._onFrame(jpeg, ts));
        s.on('audio', (a) => this.emit('audio', a));
        const closed = new Promise((r) => s.once('close', r));
        this.info = await s.handshake();
        s.startHeartbeat();
        this.lastError = null;
        backoff = 1000;
        this._setState('connected');
        await this._applySettings();
        this.streaming = false;
        if (this.viewers > 0) await this._openStream();
        const err = await closed;
        if (err) this.lastError = err.message;
      } catch (err) {
        this.lastError = err.message;
        s.close();
      }
      this.session = null;
      this.streaming = false;
      if (!this.running) break;
      if (this.busy) continue;
      this._setState('disconnected');
      await sleep(backoff);
      backoff = Math.min(backoff * 1.6, 8000);
    }
    this._setState('idle');
  }

  _watch() {
    const s = this.session;
    if (!s || this.busy) return;
    // Live stream went silent: reconnect
    if (this.streaming && this.lastFrameAt && Date.now() - this.lastFrameAt > 10000 && Date.now() - s.lastPacketAt > 10000) {
      this.lastError = 'Video stopped, reconnecting';
      s.close();
    }
    // Stop streaming 20 s after the last viewer left
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
    // Video + audio. Some firmwares never answer this; frames arriving is the real confirmation.
    this.session.ap({ code: CODE.OPEN_AV }).catch(() => {});
  }

  _closeStream() {
    if (!this.session) return;
    this.streaming = false;
    this.session.ap({ code: CODE.CLOSE_AV }).catch(() => {});
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
    const r = await this._need().ap({ code: CODE.SDCARD_STATUS });
    return r?.content ?? r;
  }

  async wifiScan() {
    const r = await this._need().ap({ code: CODE.WIFI_SCAN }, { timeoutMs: 10000 });
    return r?.content ?? r;
  }

  reboot() {
    this._need().send(encodeAp({ code: CODE.REBOOT }));
  }

  reconnect() {
    this.session?.close();
  }

  // ---------- SD card ----------

  async sdDates() {
    const r = await this._need().request({ code: CODE.SD_DATE_LIST, devTarget: DEV_TARGET }, { timeoutMs: 6000 });
    return r?.dates ?? [];
  }

  async sdFiles(date) {
    const s = this._need();
    const xml = s.waitFor((p) => p.cmd === CMD.XML, 8000);
    const r = await s.request({ code: CODE.SD_CONFIG, devTarget: DEV_TARGET, date: Number(date) }, { timeoutMs: 6000 });
    if (!r || r.status !== 200) { xml.catch(() => {}); return []; }
    const p = await xml;
    return p ? parseCatalogueXml(p.payload.toString('utf8')) : [];
  }

  async sdFileInfo(date, hour, minute) {
    return this._need().request({ code: CODE.SD_MEDIA_INFO, devTarget: DEV_TARGET, date: Number(date), hours: Number(hour), minute: Number(minute) });
  }

  /**
   * Streams a recorded AVI from the SD card into `write(chunk)`.
   * The camera pauses recording while doing this, and live video stops; it resumes afterwards.
   */
  async sdDownload(date, hour, minute, write) {
    const s = this._need();
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
      const r = await s.request({ code: CODE.SD_START_STREAM, devTarget: DEV_TARGET, date: Number(date), hours: Number(hour), minute: Number(minute) }, { timeoutMs: 8000 });
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
