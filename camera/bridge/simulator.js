// A stand-in camera that speaks the same protocol as the real V720 camera.
// Used by `node server.js --demo` and by the tests, so the whole app can be tried without hardware.
//
// The demo video shows a road filmed from the side: 20 px = 1 m, the red-topped posts A and B
// are 10 m apart, the red car drives left→right at 36 km/h and the blue car right→left at 54 km/h.

import net from 'node:net';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CMD, CODE, CMD2, CODE2, PacketParser, PacketParser2, JpegAssembler, encode, encodeJson, encode2, encodeJson2, parseJson } from './protocol.js';

const DEMO_FILE = fileURLToPath(new URL('../demo/demo-road.mjpeg', import.meta.url));

export function loadDemoFrames(file = DEMO_FILE) {
  const frames = [];
  new JpegAssembler((f) => frames.push(f)).push(fs.readFileSync(file));
  return frames;
}

export const SIM_DEV_ID = '0800c00128F8';

/**
 * @param {{protocol?: 'v1'|'v2'}} opts  v1 = most V720 cameras, v2 = newer models (A12, W1)
 */
export function startSimulator({ port = 0, host = '127.0.0.1', fps = 15, frames = loadDemoFrames(), chunkSize = 1400, protocol = 'v1', pingEveryMs = 3000 } = {}) {
  if (protocol === 'v2') return startSimulatorV2({ port, host, fps, frames, chunkSize, pingEveryMs });
  const state = { ir: 0, flip: 0, connections: 0, commands: [], pongs: 0, targets: [] };

  const sockets = new Set();
  const server = net.createServer((sock) => {
    state.connections++;
    sockets.add(sock);
    sock.on('close', () => sockets.delete(sock));
    const parser = new PacketParser();
    let timer = null;
    let frameNo = 0;
    let startedAt = 0;

    const sendJson = (obj) => sock.writable && sock.write(encodeJson(obj));
    // like the real camera: ask "are you there?" now and then (cmd 101), expect cmd 102
    const pinger = setInterval(() => sock.writable && sock.write(encode({ cmd: CMD.PING })), pingEveryMs);
    sock.on('close', () => clearInterval(pinger));
    const stopVideo = () => { clearTimeout(timer); timer = null; };
    const startVideo = () => {
      if (timer) return;
      startedAt = performance.now();
      frameNo = 0;
      const tick = () => {
        if (!sock.writable) return;
        const f = frames[frameNo % frames.length];
        for (let i = 0; i < f.length; i += chunkSize) sock.write(encode({ cmd: CMD.JPEG, payload: f.subarray(i, i + chunkSize) }));
        // a little fake audio (silence in A-law is 0xD5)
        sock.write(encode({ cmd: CMD.G711, payload: Buffer.alloc(Math.round(8000 / fps), 0xd5) }));
        frameNo++;
        // drift-free pacing
        timer = setTimeout(tick, Math.max(0, startedAt + (frameNo * 1000) / fps - performance.now()));
      };
      tick();
    };

    sock.on('data', (chunk) => {
      for (const p of parser.push(chunk)) {
        if (p.cmd === CMD.DIRECT_MOTION) { sock.write(encode({ cmd: CMD.DIRECT_MOTION, payload: Buffer.from(JSON.stringify({ devId: SIM_DEV_ID, code: 114 })) })); continue; }
        if (p.cmd === CMD.LIVE_MOTION) { sock.write(encode({ cmd: CMD.LIVE_MOTION })); continue; }
        if (p.cmd === CMD.PONG) { state.pongs++; continue; }
        if (p.cmd === CMD.HEARTBEAT) continue;
        if (p.cmd !== CMD.JSON) continue;
        const j = parseJson(p.payload);
        if (!j) continue;
        state.commands.push(j);
        if (j.code === CODE.AP_CONNECT) { state.targets.push(j.target); sendJson({ code: CODE.AP_CONNECT, status: 200, devId: SIM_DEV_ID, target: j.target, forwardId: '00000000' }); continue; }
        if (j.code === CODE.SD_DATE_LIST) { sendJson({ code: 401, status: 200, dates: [20261116] }); continue; }
        if (j.code === CODE.SD_CONFIG) {
          sendJson({ code: 403, status: 200 });
          sock.write(encode({ cmd: CMD.XML, payload: Buffer.from(`<?xml version="1.0" encoding="utf-8"?><video><catalogue date="${j.date}" hNumb="1"><option hours="9" minBin="${(1n << 5n) | (1n << 6n)}"/></catalogue></video>`) }));
          continue;
        }
        if (j.code === CODE.SD_MEDIA_INFO) { sendJson({ code: 405, status: 200, fileName: `${j.date}${String(j.hours).padStart(2, '0')}${String(j.minute).padStart(2, '0')}`, fileSize: 4096 }); continue; }
        if (j.code === CODE.SD_START_STREAM) {
          stopVideo();
          sendJson({ code: 407, status: 200 });
          const data = Buffer.alloc(4096, 0x41);
          data.write('RIFF', 0);
          for (let i = 0; i < data.length; i += 1024) sock.write(encode({ cmd: CMD.AVI, payload: data.subarray(i, i + 1024) }));
          sendJson({ code: CODE.SD_STREAM_END, status: 200 });
          continue;
        }
        if (j.code !== CODE.AP_COMMAND) continue;
        const c = j.content || {};
        state.targets.push(c.devTarget);
        const reply = (extra = {}) => sendJson({ code: CODE.AP_COMMAND, content: { code: c.code, status: 200, ...extra } });
        switch (c.code) {
          case CODE.BASE_INFO: reply({ version: 'SIMULATOR-1.0', devId: SIM_DEV_ID, batteryLevel: 87 }); break;
          case CODE.OPEN_AV: reply(); startVideo(); break;
          case CODE.CLOSE_AV: reply(); stopVideo(); break;
          case CODE.IR_LED: state.ir = c.IrLed; reply({ IrLed: c.IrLed }); break;
          case CODE.VIDEO_FLIP: state.flip = c.mirrorFlip; reply({ mirrorFlip: c.mirrorFlip }); break;
          case CODE.SDCARD_STATUS: reply({ sdDevStatus: 1, sdTotal: 32000, sdFree: 21000 }); break;
          case CODE.WIFI_SCAN: reply({ list: [] }); break;
          case CODE.REBOOT: sock.destroy(); break;
          default: reply();
        }
      }
    });
    sock.on('close', stopVideo);
    sock.on('error', stopVideo);
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => resolve({ server, state, port: server.address().port, host, close: () => new Promise((r) => { for (const s of sockets) s.destroy(); server.close(r); }) }));
  });
}

/** Newer-format camera (A12 / W1 style): plain JSON (cmd 8), video cmd 1003, ping 9 / pong 10. */
function startSimulatorV2({ port, host, fps, frames, chunkSize, pingEveryMs = 3000 }) {
  const state = { ir: 0, flip: 0, connections: 0, commands: [], pongs: 0, targets: [], protocol: 'v2' };
  const sockets = new Set();
  const server = net.createServer((sock) => {
    state.connections++;
    sockets.add(sock);
    const parser = new PacketParser2();
    let timer = null;
    const sendJson = (obj) => sock.writable && sock.write(encodeJson2(obj));
    const stopVideo = () => { clearTimeout(timer); timer = null; };
    const startVideo = () => {
      if (timer) return;
      const startedAt = performance.now();
      let n = 0;
      const tick = () => {
        if (!sock.writable) return;
        const f = frames[n % frames.length];
        for (let i = 0; i < f.length; i += chunkSize) sock.write(encode2({ cmd: CMD2.JPEG, payload: f.subarray(i, i + chunkSize) }));
        sock.write(encode2({ cmd: CMD2.G711, payload: Buffer.alloc(Math.round(8000 / fps), 0xd5) }));
        n++;
        timer = setTimeout(tick, Math.max(0, startedAt + (n * 1000) / fps - performance.now()));
      };
      tick();
    };
    const pinger = setInterval(() => sock.writable && sock.write(encode2({ cmd: CMD2.PING })), pingEveryMs);
    sock.on('close', () => { sockets.delete(sock); clearInterval(pinger); stopVideo(); });
    sock.on('error', stopVideo);
    sock.on('data', (chunk) => {
      for (const p of parser.push(chunk)) {
        if (p.cmd === CMD2.PONG) { state.pongs++; continue; }
        if (p.cmd === CMD2.PING) { sock.write(encode2({ cmd: CMD2.PONG })); continue; }
        if (p.cmd !== CMD2.JSON) continue;
        const j = parseJson(p.payload);
        if (!j) continue;
        state.commands.push(j);
        switch (j.code) {
          case CODE2.DIRECT_MOTION: sendJson({ code: 114, devId: SIM_DEV_ID }); break;
          case CODE2.LIVE_MOTION:
            if (!j.target) sock.write(encode2({ cmd: CMD2.LIVE_MOTION }));
            else { state.targets.push(j.target); sendJson({ code: 115, status: 200, target: j.target }); }
            break;
          case CODE2.BASE_INFO: sendJson({ code: 214, version: 'SIMULATOR-V2', devId: SIM_DEV_ID, batteryLevel: 64 }); break;
          case CODE2.AV_SWITCH: sendJson({ code: 213, avSwitch: j.avSwitch }); if (j.avSwitch === 3) startVideo(); else stopVideo(); break;
          case CODE2.IR_LED: state.ir = j.IrLed; sendJson({ code: 202, IrLed: j.IrLed }); break;
          case CODE2.VIDEO_FLIP: state.flip = j.mirrorFlip; sendJson({ code: 216, mirrorFlip: j.mirrorFlip }); break;
          case CODE2.REBOOT: sock.destroy(); break;
          default: sendJson({ code: j.code, status: 200 });
        }
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(port, host, () => resolve({ server, state, port: server.address().port, host, close: () => new Promise((r) => { for (const s of sockets) s.destroy(); server.close(r); }) }));
  });
}
