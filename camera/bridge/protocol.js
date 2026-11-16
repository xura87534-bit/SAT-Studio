// Wire protocol of V720 / Naxclow cameras (the "V720" app family).
//
// Every message, in both directions, is a 20-byte little-endian header followed by a payload:
//
//   uint32 payloadLength
//   uint16 cmd           (0 = JSON, 1 = JPEG chunk, 4 = G.711 A-law audio, 8 = XML, 100 = heartbeat ...)
//   uint8  msgFlag
//   uint8  dealFlag
//   char[8] forwardId    ("00000000" when talking to the camera directly)
//   uint32 pkgId
//   byte[payloadLength]
//
// Protocol details were reverse-engineered by the open-source a9-v720 project
// (https://github.com/intx82/a9-v720); this is an independent JavaScript implementation.

export const HEADER_SIZE = 20;
export const DEFAULT_FORWARD_ID = Buffer.from('00000000', 'ascii');
export const DEV_TARGET = 'deadbeef';
export const DEV_TOKEN = 'This is TEST token';

export const CMD = {
  JSON: 0,
  JPEG: 1,
  G711: 4,
  AVI: 7,
  XML: 8,
  HEARTBEAT: 100,
  LIVE_MOTION: 115,
};

export const CODE = {
  AP_CONNECT: 501,
  AP_COMMAND: 502,
  CLOSE_AV: 0,
  OPEN_A_CLOSE_V: 1,
  CLOSE_A_OPEN_V: 2,
  OPEN_AV: 3,
  BASE_INFO: 4,
  IR_LED: 202,
  SET_WIFI: 204,
  WIFI_SCAN: 211,
  VIDEO_FLIP: 216,
  SDCARD_STATUS: 218,
  REBOOT: 299,
  SD_DATE_LIST: 400,
  SD_CONFIG: 402,
  SD_MEDIA_INFO: 404,
  SD_START_STREAM: 406,
  SD_STOP_STREAM: 408,
  SD_STREAM_END: 411,
};

// mirrorFlip values understood by the camera
export const FLIP = { RESET: 0, NORMAL: 1, HORIZONTAL: 2, VERTICAL: 3, UP_DOWN: 4 };

const MAX_PAYLOAD = 4 * 1024 * 1024;

export function encode({ cmd = CMD.JSON, payload = Buffer.alloc(0), msgFlag = 0, dealFlag = 0, forwardId = DEFAULT_FORWARD_ID, pkgId = 0 } = {}) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const head = Buffer.alloc(HEADER_SIZE);
  head.writeUInt32LE(body.length, 0);
  head.writeUInt16LE(cmd, 4);
  head.writeUInt8(msgFlag & 0xff, 6);
  head.writeUInt8(dealFlag & 0xff, 7);
  forwardId.copy(head, 8, 0, 8);
  head.writeUInt32LE(pkgId >>> 0, 16);
  return Buffer.concat([head, body]);
}

export function encodeJson(obj, opts = {}) {
  return encode({ ...opts, cmd: CMD.JSON, payload: Buffer.from(JSON.stringify(obj), 'utf8') });
}

/** A command routed through the camera's AP command channel (code 502). */
export function encodeAp(content) {
  return encodeJson({ code: CODE.AP_COMMAND, content: { devTarget: DEV_TARGET, ...content } });
}

/** Incremental parser: feed it TCP chunks, get whole packets back. */
export class PacketParser {
  constructor() {
    this.buf = Buffer.alloc(0);
  }

  push(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    const out = [];
    while (this.buf.length >= HEADER_SIZE) {
      const len = this.buf.readUInt32LE(0);
      if (len > MAX_PAYLOAD) {
        // Lost sync: drop everything and wait for the next clean packet.
        this.buf = Buffer.alloc(0);
        break;
      }
      if (this.buf.length < HEADER_SIZE + len) break;
      out.push({
        cmd: this.buf.readUInt16LE(4),
        msgFlag: this.buf.readUInt8(6),
        dealFlag: this.buf.readUInt8(7),
        forwardId: this.buf.subarray(8, 16).toString('latin1'),
        pkgId: this.buf.readUInt32LE(16),
        payload: Buffer.from(this.buf.subarray(HEADER_SIZE, HEADER_SIZE + len)),
      });
      this.buf = this.buf.subarray(HEADER_SIZE + len);
    }
    return out;
  }
}

export function parseJson(payload) {
  try {
    return JSON.parse(payload.toString('utf8').replace(/\0+$/, ''));
  } catch {
    return null;
  }
}

/**
 * Re-assembles JPEG frames from the camera's JPEG chunks.
 * Frames start with FF D8 and end with FF D9; a chunk may contain the end of one frame and the
 * start of the next, and the end marker may be split across two chunks.
 */
export class JpegAssembler {
  constructor(onFrame) {
    this.onFrame = onFrame;
    this.parts = [];
    this.size = 0;
    this.inFrame = false;
    this.lastByte = -1;
  }

  push(data) {
    let pos = 0;
    while (pos < data.length) {
      if (!this.inFrame) {
        const start = data.indexOf(SOI, pos);
        if (start === -1) return;
        this.inFrame = true;
        this.parts = [];
        this.size = 0;
        this.lastByte = -1;
        pos = start;
      }
      // End marker split over the chunk boundary
      if (this.lastByte === 0xff && pos === 0 && data[0] === 0xd9) {
        this._append(data.subarray(0, 1));
        this._finish();
        pos = 1;
        continue;
      }
      const end = data.indexOf(EOI, this.size === 0 ? pos + 2 : pos);
      if (end === -1) {
        this._append(data.subarray(pos));
        return;
      }
      this._append(data.subarray(pos, end + 2));
      this._finish();
      pos = end + 2;
    }
  }

  _append(b) {
    if (!b.length) return;
    this.parts.push(Buffer.from(b));
    this.size += b.length;
    this.lastByte = b[b.length - 1];
    if (this.size > MAX_PAYLOAD) this.inFrame = false; // runaway frame, resync
  }

  _finish() {
    const frame = Buffer.concat(this.parts, this.size);
    this.inFrame = false;
    this.parts = [];
    this.size = 0;
    this.lastByte = -1;
    if (frame.length > 4) this.onFrame(frame);
  }
}
const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);

/** Recorded minutes of one hour are sent as a 64-bit mask ("minBin"). */
export function minutesFromMask(mask) {
  const big = BigInt(mask);
  const out = [];
  for (let i = 0n; i < 64n; i++) if ((big >> i) & 1n) out.push(Number(i));
  return out;
}

/** Parses the camera's <video><catalogue><option hours=.. minBin=../></catalogue></video> XML. */
export function parseCatalogueXml(xml) {
  const files = [];
  const re = /<option\b[^>]*?hours="(\d+)"[^>]*?minBin="(\d+)"/g;
  let m;
  while ((m = re.exec(xml))) {
    const hour = Number(m[1]);
    for (const minute of minutesFromMask(m[2])) files.push({ hour, minute });
  }
  return files;
}
