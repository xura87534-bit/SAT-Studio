import test from 'node:test';
import assert from 'node:assert/strict';
import { encode, encodeJson, PacketParser, JpegAssembler, parseCatalogueXml, minutesFromMask, CMD } from '../bridge/protocol.js';
import { SpeedGate, speedFrom, alawToFloat } from '../public/radar.js';
import { createServer } from '../server.js';
import { startSimulator, SIM_DEV_ID } from '../bridge/simulator.js';
import { probe } from '../bridge/discovery.js';
import { Camera } from '../bridge/camera.js';
import { encode2, PacketParser2, sniffProtocol, localUnixTime } from '../bridge/protocol.js';

test('header layout matches the camera protocol', () => {
  const b = encodeJson({ code: 501 });
  assert.equal(b.readUInt32LE(0), b.length - 20);
  assert.equal(b.readUInt16LE(4), CMD.JSON);
  assert.equal(b.subarray(8, 16).toString(), '00000000');
  // the 20-byte heartbeat from the reference implementation's tests
  assert.deepEqual([...encode({ cmd: 100 })], [0, 0, 0, 0, 100, 0, 0, 0, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0, 0, 0, 0]);
});

test('parser handles packets split and joined across TCP chunks', () => {
  const all = Buffer.concat([encodeJson({ a: 1 }), encode({ cmd: 1, payload: Buffer.from([1, 2, 3]) }), encodeJson({ b: 2 })]);
  const p = new PacketParser();
  const got = [];
  for (let i = 0; i < all.length; i += 7) got.push(...p.push(all.subarray(i, i + 7)));
  assert.equal(got.length, 3);
  assert.deepEqual([...got[1].payload], [1, 2, 3]);
});

test('JPEG frames are re-assembled even when markers straddle chunks', () => {
  const f1 = Buffer.from([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
  const f2 = Buffer.from([0xff, 0xd8, 9, 9, 9, 9, 0xff, 0xd9]);
  const stream = Buffer.concat([Buffer.from([7, 7]), f1, f2]);
  const frames = [];
  const a = new JpegAssembler((f) => frames.push(f));
  for (const cut of [[0, 6], [6, 9], [9, 16], [16, stream.length]]) a.push(stream.subarray(...cut));
  assert.deepEqual(frames.map((f) => [...f]), [[...f1], [...f2]]);
});

test('SD card catalogue XML becomes hour/minute list', () => {
  assert.deepEqual(minutesFromMask('5'), [0, 2]);
  const xml = '<video><catalogue date="20230124" hNumb="2"><option hours="2" minBin="3"/><option hours="10" minBin="9223372036854775808"/></catalogue></video>';
  assert.deepEqual(parseCatalogueXml(xml), [{ hour: 2, minute: 0 }, { hour: 2, minute: 1 }, { hour: 10, minute: 63 }]);
});

test('A-law decoding', () => {
  const v = alawToFloat(Uint8Array.from([0xd5, 0x55, 0x2a, 0xaa]));
  assert.ok(Math.abs(v[0]) < 0.001 && Math.abs(v[1]) < 0.001);
  assert.ok(v[2] < -0.9 && v[3] > 0.9);
});

test('v = d / t with uncertainty range', () => {
  const s = speedFrom(10, 0.72, 0.05);
  assert.ok(Math.abs(s.v * 3.6 - 50) < 0.01);
  assert.ok(s.lo < s.v && s.hi > s.v);
});

test('speed gate measures a synthetic object at the right speed and direction', () => {
  const W = 200, H = 40, fps = 15;
  for (const [vPx, dir] of [[8, 1], [13, -1]]) {
    const gate = new SpeedGate({ lines: [[0.25, 0, 0.25, 1], [0.75, 0, 0.75, 1]], distanceM: 10, sensitivity: 50 });
    const out = [];
    for (let f = 0; f < 80; f++) {
      const g = new Uint8Array(W * H).fill(60);
      const front = dir > 0 ? -30 + f * vPx : W + 30 - f * vPx;
      const x0 = dir > 0 ? front - 25 : front, x1 = dir > 0 ? front : front + 25;
      for (let y = 5; y < 35; y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, x1); x++) g[y * W + x] = 220;
      out.push(...gate.process(g, W, H, (f * 1000) / fps).measurements);
    }
    assert.equal(out.length, 1);
    const lineGapPx = 0.5 * (W - 1);
    const truth = (10 / (lineGapPx / (vPx * fps)));
    assert.equal(out[0].direction, dir > 0 ? 'A→B' : 'B→A');
    // a solid edge can only be timed to the frame, so allow the reported ±1-frame range
    assert.ok(out[0].low <= truth && out[0].high >= truth, `${out[0].low}..${out[0].high} vs ${truth}`);
    assert.ok(Math.abs(out[0].speed - truth) / truth < 0.15, `${out[0].speed} vs ${truth}`);
  }
});

test('a lighting change over the whole picture is not a measurement', () => {
  const gate = new SpeedGate({ distanceM: 10 });
  let n = 0;
  for (let f = 0; f < 30; f++) n += gate.process(new Uint8Array(100 * 50).fill(f < 15 ? 40 : 200), 100, 50, f * 66).measurements.length;
  assert.equal(n, 0);
});

test('bridge + simulated camera: status, stream, controls, SD card', async () => {
  const app = await createServer({ demo: true, port: 0, host: '127.0.0.1' });
  const base = `http://127.0.0.1:${app.port}`;
  try {
    for (let i = 0; i < 50 && !app.cam.status().connected; i++) await new Promise((r) => setTimeout(r, 100));
    const st = await (await fetch(`${base}/api/status`)).json();
    assert.equal(st.connected, true);
    assert.equal(st.info.version, 'SIMULATOR-1.0');

    const ctrl = new AbortController();
    const res = await fetch(`${base}/stream.mjpg`, { signal: ctrl.signal });
    const reader = res.body.getReader();
    let text = '';
    while ((text.match(/X-Timestamp/g) || []).length < 3) text += Buffer.from((await reader.read()).value).toString('latin1');
    ctrl.abort();
    assert.match(text, /Content-Type: image\/jpeg/);

    // one-frame-per-request mode used by the iPhone app
    const f1 = await fetch(`${base}/frame.jpg?after=0`);
    assert.equal(f1.status, 200);
    const seq = Number(f1.headers.get('x-seq'));
    assert.ok(seq > 0 && Number(f1.headers.get('x-timestamp')) > 0);
    assert.deepEqual([...new Uint8Array(await f1.arrayBuffer()).subarray(0, 2)], [0xff, 0xd8]);
    const f2 = await fetch(`${base}/frame.jpg?after=${seq}`);
    assert.ok(Number(f2.headers.get('x-seq')) > seq);
    await f2.arrayBuffer();
    const au = await fetch(`${base}/audio.chunk?after=-1`);
    assert.equal(au.status, 200);
    assert.ok((await au.arrayBuffer()).byteLength > 0);
    // POST body in the query string (the iPhone app's request handler may not get bodies)
    assert.equal((await (await fetch(`${base}/api/ir?b=${encodeURIComponent('{"on":false}')}`, { method: 'POST' })).json()).ir, false);

    assert.equal((await (await fetch(`${base}/api/ir`, { method: 'POST', body: '{"on":true}' })).json()).ir, true);
    assert.equal(app.sim.state.ir, 1);
    await fetch(`${base}/api/flip`, { method: 'POST', body: '{"mode":4}' });
    assert.equal(app.sim.state.flip, 4);

    assert.deepEqual((await (await fetch(`${base}/api/sd/dates`)).json()).dates, [20261116]);
    const files = (await (await fetch(`${base}/api/sd/files?date=20261116`)).json()).files;
    assert.equal(files.length, 2);
    const avi = Buffer.from(await (await fetch(`${base}/api/sd/download?date=20261116&hour=9&minute=5`)).arrayBuffer());
    assert.equal(avi.length, 4096);
    assert.equal(avi.subarray(0, 4).toString(), 'RIFF');
  } finally {
    await app.close();
  }
});

test('password protection', async () => {
  const app = await createServer({ demo: true, port: 0, host: '127.0.0.1', password: 'pw123' });
  const base = `http://127.0.0.1:${app.port}`;
  try {
    assert.equal((await fetch(`${base}/api/status`)).status, 401);
    const ok = await fetch(`${base}/api/status`, { headers: { Authorization: `Basic ${Buffer.from('me:pw123').toString('base64')}` } });
    assert.equal(ok.status, 200);
  } finally {
    await app.close();
  }
});

test('v2 packet format round-trips and is told apart from v1', () => {
  const b = encode2({ cmd: 1003, payload: Buffer.from([1, 2, 3]) });
  assert.equal(b.readUInt32LE(4), 1003);
  const [p] = new PacketParser2().push(b);
  assert.deepEqual([...p.payload], [1, 2, 3]);
  assert.equal(sniffProtocol(b), 'v2');
  assert.equal(sniffProtocol(encodeJson({ code: 1 })), 'v1');
  // local time, like the official app's unixTimer
  const d = new Date();
  assert.equal(localUnixTime(d), Math.floor(d.getTime() / 1000) - d.getTimezoneOffset() * 60);
});

for (const protocol of ['v1', 'v2']) {
  test(`discovery finds a ${protocol} camera and the bridge logs in with its real ID`, async () => {
    const sim = await startSimulator({ protocol, pingEveryMs: 300 });
    const cam = new Camera({ host: sim.host, port: sim.port });
    try {
      const r = await probe(sim.host, sim.port);
      assert.equal(r.ok, true);
      assert.equal(r.protocol, protocol);
      assert.equal(r.devId, SIM_DEV_ID);

      const frames = [];
      cam.on('frame', (f) => frames.push(f));
      cam.addViewer();
      cam.start();
      for (let i = 0; i < 80 && frames.length < 3; i++) await new Promise((res) => setTimeout(res, 100));
      assert.ok(frames.length >= 3, 'got video');
      assert.equal(cam.status().protocol, protocol);
      assert.equal(cam.info.devId, SIM_DEV_ID);
      assert.ok(sim.state.targets.includes(SIM_DEV_ID), 'logged in with the camera ID, not a placeholder');
      await cam.setIr(true);
      assert.equal(sim.state.ir, 1);
      await new Promise((res) => setTimeout(res, 700));
      assert.ok(sim.state.pongs > 0, 'answered the camera\'s keep-alive pings');
    } finally {
      cam.stop();
      await sim.close();
    }
  });
}

test('discovery reports why an address is not a camera', async () => {
  const r = await probe('127.0.0.1', 9, { connectTimeoutMs: 500 });
  assert.equal(r.ok, false);
  assert.ok(r.reason);
});
