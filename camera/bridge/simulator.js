// A stand-in camera that speaks the same protocol as the real V720 camera.
// Used by `node server.js --demo` and by the tests, so the whole app can be tried without hardware.
//
// The demo video shows a road filmed from the side: 20 px = 1 m, the red-topped posts A and B
// are 10 m apart, the red car drives left→right at 36 km/h and the blue car right→left at 54 km/h.

import net from 'node:net';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CMD, CODE, PacketParser, JpegAssembler, encode, encodeJson, parseJson } from './protocol.js';

const DEMO_FILE = fileURLToPath(new URL('../demo/demo-road.mjpeg', import.meta.url));

export function loadDemoFrames(file = DEMO_FILE) {
  const frames = [];
  new JpegAssembler((f) => frames.push(f)).push(fs.readFileSync(file));
  return frames;
}

export function startSimulator({ port = 0, host = '127.0.0.1', fps = 15, frames = loadDemoFrames(), chunkSize = 1400 } = {}) {
  const state = { ir: 0, flip: 0, connections: 0, commands: [] };

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
        if (p.cmd === CMD.LIVE_MOTION) { sock.write(encode({ cmd: CMD.LIVE_MOTION, payload: Buffer.from(JSON.stringify({ devId: 'SIM0001' })) })); continue; }
        if (p.cmd === CMD.HEARTBEAT) continue;
        if (p.cmd !== CMD.JSON) continue;
        const j = parseJson(p.payload);
        if (!j) continue;
        state.commands.push(j);
        if (j.code === CODE.AP_CONNECT) { sendJson({ code: CODE.AP_CONNECT, status: 200, devId: 'SIM0001', forwardId: '00000000' }); continue; }
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
        const reply = (extra = {}) => sendJson({ code: CODE.AP_COMMAND, content: { code: c.code, status: 200, ...extra } });
        switch (c.code) {
          case CODE.BASE_INFO: reply({ version: 'SIMULATOR-1.0', devId: 'SIM0001', batteryLevel: 87 }); break;
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
