// Finding the camera, the way the official V720 app does it:
//
// 1. Connect to the camera's TCP port (6123) at a likely address. In hotspot mode that is
//    192.168.169.1 (the camera's own Wi-Fi). We also try the ".1" address of every network this
//    computer is on, an address the user typed, and, on request, every address of the local network.
// 2. Send "who are you?" (code 114, DIRECT_MOTION). The camera answers with JSON holding its devId.
//    Older cameras answer in the "v1" packet format, newer ones (A12, W1) in "v2"; we try both.

import net from 'node:net';
import os from 'node:os';
import { CMD, encode, encodeJson2, PacketParser, PacketParser2, parseJson, sniffProtocol, HEADER_SIZE } from './protocol.js';

export const DEFAULT_HOST = '192.168.169.1';
export const DEFAULT_PORT = 6123;

function connect(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port });
    const done = (err) => { clearTimeout(t); sock.removeAllListeners('connect'); resolve(err ? { err } : { sock }); };
    const t = setTimeout(() => { sock.destroy(); done(new Error('timeout')); }, timeoutMs);
    sock.once('connect', () => { sock.on('error', () => {}); done(); });
    sock.once('error', (e) => { sock.destroy(); done(e); });
  });
}

function collect(sock, ms) {
  return new Promise((resolve) => {
    const chunks = [];
    const onData = (c) => chunks.push(c);
    sock.on('data', onData);
    setTimeout(() => { sock.off('data', onData); resolve(Buffer.concat(chunks)); }, ms);
  });
}

function describeError(err) {
  const c = err?.code;
  if (err?.message === 'timeout' || c === 'ETIMEDOUT') return 'no answer';
  if (c === 'ECONNREFUSED') return 'something is there, but not a camera port';
  if (c === 'EHOSTUNREACH' || c === 'ENETUNREACH' || c === 'EHOSTDOWN') return 'not reachable from this network';
  return err?.message || 'failed';
}

/**
 * Asks one address whether a camera is there.
 * @returns {Promise<{host, port, ok: boolean, protocol?: 'v1'|'v2', devId?: string, info?: object, reason?: string}>}
 */
export async function probe(host, port = DEFAULT_PORT, { connectTimeoutMs = 1500, answerMs = 1500 } = {}) {
  // Old format first: the "who are you?" header with no payload (cmd 114)
  let c = await connect(host, port, connectTimeoutMs);
  if (c.err) return { host, port, ok: false, reason: describeError(c.err) };
  c.sock.write(encode({ cmd: CMD.DIRECT_MOTION }));
  let buf = await collect(c.sock, answerMs);
  c.sock.destroy();
  let result = parseAnswer(buf);
  if (result?.json) return { host, port, ok: true, ...result };
  const sniffed = result?.protocol ?? null; // e.g. it only sent a keep-alive ping

  // Newer format: JSON {"code":114}
  c = await connect(host, port, connectTimeoutMs);
  if (c.err) return { host, port, ok: false, reason: describeError(c.err) };
  c.sock.write(encodeJson2({ code: 114 }));
  buf = await collect(c.sock, answerMs);
  c.sock.destroy();
  result = parseAnswer(buf);
  if (result?.json) return { host, port, ok: true, ...result };

  // The port is open but the device didn't say who it is: still worth trying as a camera.
  return { host, port, ok: true, protocol: result?.protocol ?? sniffed, devId: null, info: {}, reason: 'port open, no reply to "who are you?"' };
}

function parseAnswer(buf) {
  if (buf.length < HEADER_SIZE) return null;
  const protocol = sniffProtocol(buf);
  const packets = protocol === 'v2' ? new PacketParser2().push(buf) : new PacketParser().push(buf);
  for (const p of packets) {
    const j = parseJson(p.payload);
    if (j && typeof j === 'object') return { json: true, protocol, devId: j.devId ?? j.target ?? j.devTarget ?? null, info: j };
  }
  return packets.length ? { json: false, protocol, devId: null, info: {} } : null;
}

/** IPv4 networks this computer is on, as { address, netmask, name }. */
export function localNetworks() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push({ name, address: a.address, netmask: a.netmask });
  }
  return out;
}

function gatewayGuess(address) {
  const p = address.split('.');
  return `${p[0]}.${p[1]}.${p[2]}.1`;
}

/** Addresses worth trying first, most likely first. */
export function quickCandidates(preferred) {
  const list = [];
  if (preferred) list.push(preferred);
  list.push(DEFAULT_HOST);
  for (const n of localNetworks()) list.push(gatewayGuess(n.address));
  return [...new Set(list)];
}

/** Every address of each local /24 network (skips very large networks). */
export function subnetCandidates() {
  const out = [];
  for (const n of localNetworks()) {
    const p = n.address.split('.');
    for (let i = 1; i < 255; i++) {
      const ip = `${p[0]}.${p[1]}.${p[2]}.${i}`;
      if (ip !== n.address) out.push(ip);
    }
  }
  return [...new Set(out)];
}

/**
 * Looks for cameras.
 * @param {{preferred?: string, port?: number, scan?: boolean, onProgress?: Function}} opts
 */
export async function discover({ preferred, port = DEFAULT_PORT, scan = false, onProgress } = {}) {
  const tried = [];
  const found = [];
  for (const host of quickCandidates(preferred)) {
    const r = await probe(host, port, { connectTimeoutMs: 1200 });
    tried.push(r);
    onProgress?.(r);
    if (r.ok) found.push(r);
    if (found.some((f) => f.devId)) break;
  }
  if (scan && !found.length) {
    // Quick port check on the whole network, then a full probe of anything that answers.
    const hosts = subnetCandidates().filter((h) => !tried.some((t) => t.host === h));
    const open = [];
    let i = 0;
    const worker = async () => {
      while (i < hosts.length) {
        const h = hosts[i++];
        const c = await connect(h, port, 500);
        if (c.sock) { c.sock.destroy(); open.push(h); }
      }
    };
    await Promise.all(Array.from({ length: 48 }, worker));
    tried.push({ host: `${hosts.length} addresses on this network`, ok: open.length > 0, reason: open.length ? `${open.length} answered` : 'no camera port found' });
    for (const h of open) {
      const r = await probe(h, port);
      tried.push(r);
      onProgress?.(r);
      if (r.ok) found.push(r);
    }
  }
  return { found, tried, networks: localNetworks() };
}
