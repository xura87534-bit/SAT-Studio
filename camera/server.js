#!/usr/bin/env node
// V720 Camera Control — bridge server.
//
// Run this on a computer (e.g. your MacBook) that is connected to the camera's Wi-Fi hotspot.
// It talks to the camera and serves the control app to any browser on the same network:
//   node server.js                 real camera at 192.168.169.1:6123
//   node server.js --demo          built-in simulated camera (no hardware needed)
//   node server.js --password 1234 ask for a password before showing the camera
// No npm install needed: only Node.js 18+ built-ins are used.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Camera } from './bridge/camera.js';
import { startSimulator } from './bridge/simulator.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const SETTINGS_FILE = path.join(ROOT, '.camera-settings.json');

function parseArgs(argv) {
  const a = { port: Number(process.env.PORT) || 8720, camera: process.env.CAMERA || '192.168.169.1:6123', demo: false, password: process.env.CAMERA_PASSWORD || '', host: '0.0.0.0' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--demo') a.demo = true;
    else if (k === '--port' || k === '-p') a.port = Number(argv[++i]);
    else if (k === '--camera' || k === '-c') a.camera = argv[++i];
    else if (k === '--password') a.password = argv[++i] || '';
    else if (k === '--local-only') a.host = '127.0.0.1';
    else if (k === '--help' || k === '-h') {
      console.log('Usage: node server.js [--demo] [--port 8720] [--camera 192.168.169.1:6123] [--password PASS] [--local-only]');
      process.exit(0);
    }
  }
  return a;
}

function loadSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch { return {}; }
}
function saveSettings(s) {
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2)); } catch { /* read-only disk is fine */ }
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon',
};

export async function createServer(opts = {}) {
  const args = { port: 8720, camera: '192.168.169.1:6123', demo: false, password: '', host: '0.0.0.0', ...opts };
  let sim = null;
  let [camHost, camPort] = args.camera.split(':');
  camPort = Number(camPort) || 6123;
  if (args.demo) {
    sim = await startSimulator();
    camHost = sim.host;
    camPort = sim.port;
  }

  const cam = new Camera({ host: camHost, port: camPort, settings: args.demo ? {} : loadSettings() });
  if (!args.demo) cam.on('settings', saveSettings);
  cam.start();

  const json = (res, code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  const readBody = (req) => new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
  });
  const authorized = (req) => {
    if (!args.password) return true;
    const h = req.headers.authorization || '';
    if (!h.startsWith('Basic ')) return false;
    const [, pass] = Buffer.from(h.slice(6), 'base64').toString().split(':');
    return pass === args.password;
  };

  const api = {
    'GET /api/status': () => ({ ...cam.status(), demo: !!args.demo, bridgeTime: Date.now() }),
    'POST /api/ir': async (b) => { await cam.setIr(!!b.on); return { ok: true, ir: cam.settings.ir }; },
    'POST /api/flip': async (b) => { await cam.setFlip(b.mode); return { ok: true, flip: cam.settings.flip }; },
    'POST /api/reboot': () => { cam.reboot(); return { ok: true }; },
    'POST /api/reconnect': () => { cam.reconnect(); return { ok: true }; },
    'GET /api/sd/status': () => cam.sdStatus(),
    'GET /api/sd/dates': async () => ({ dates: await cam.sdDates() }),
    'GET /api/wifi/scan': () => cam.wifiScan(),
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!authorized(req)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Camera", charset="UTF-8"' });
      return res.end('Password required');
    }
    try {
      const route = `${req.method} ${url.pathname}`;

      if (route === 'GET /stream.mjpg') {
        res.writeHead(200, {
          'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
          'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache', Connection: 'close',
          'X-Accel-Buffering': 'no',
        });
        res.socket?.setNoDelay(true);
        let sending = false;
        const onFrame = (jpeg, ts) => {
          // Drop frames for slow viewers instead of piling them up
          if (sending && res.writableLength > 2 * jpeg.length) return;
          sending = true;
          res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\nX-Timestamp: ${ts.toFixed(2)}\r\n\r\n`);
          res.write(jpeg);
          res.write('\r\n');
        };
        cam.addViewer();
        cam.on('frame', onFrame);
        req.on('close', () => { cam.off('frame', onFrame); cam.removeViewer(); });
        return;
      }

      if (route === 'GET /snapshot.jpg') {
        if (!cam.lastFrame) return json(res, 503, { error: 'No picture yet' });
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' });
        return res.end(cam.lastFrame);
      }

      if (route === 'GET /audio.alaw') {
        // Raw G.711 A-law, 8 kHz mono. The app decodes it and plays it with Web Audio.
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' });
        const onAudio = (a) => { if (res.writableLength < 64000) res.write(a); };
        cam.addViewer();
        cam.on('audio', onAudio);
        req.on('close', () => { cam.off('audio', onAudio); cam.removeViewer(); });
        return;
      }

      if (route === 'GET /api/sd/files') {
        const date = url.searchParams.get('date');
        const files = await cam.sdFiles(date);
        return json(res, 200, { date, files });
      }

      if (route === 'GET /api/sd/download') {
        const { date, hour, minute } = Object.fromEntries(url.searchParams);
        const name = `${date}-${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}.avi`;
        let started = false;
        const total = await cam.sdDownload(date, hour, minute, (chunk) => {
          if (!started) {
            started = true;
            res.writeHead(200, { 'Content-Type': 'video/x-msvideo', 'Content-Disposition': `attachment; filename="${name}"` });
          }
          res.write(chunk);
        });
        if (!started) return json(res, 404, { error: 'The camera sent no data for this file' });
        res.end();
        console.log(`Downloaded ${name} (${total} bytes)`);
        return;
      }

      if (api[route]) {
        const body = req.method === 'POST' ? await readBody(req) : {};
        return json(res, 200, await api[route](body, url));
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });

      // Static app files
      let file = decodeURIComponent(url.pathname);
      if (file === '/') file = '/index.html';
      const full = path.normalize(path.join(PUBLIC, file));
      if (!full.startsWith(PUBLIC + path.sep)) return json(res, 403, { error: 'Forbidden' });
      fs.readFile(full, (err, data) => {
        if (err) return json(res, 404, { error: 'Not found' });
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(full)] || 'application/octet-stream',
          'Cache-Control': file === '/sw.js' ? 'no-cache' : 'no-cache',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(data);
      });
    } catch (err) {
      if (!res.headersSent) json(res, 502, { error: err.message });
      else res.end();
    }
  });

  await new Promise((r) => server.listen(args.port, args.host, r));
  return {
    server, cam, sim, port: server.address().port,
    close: async () => { cam.stop(); server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await sim?.close(); },
  };
}

function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push({ name, address: a.address });
  }
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const app = await createServer(args);
  const lines = [
    '',
    '  V720 Camera Control is running',
    `  Camera: ${args.demo ? 'built-in DEMO camera (no hardware)' : args.camera}`,
    '',
    `  On this computer:  http://localhost:${app.port}`,
  ];
  if (args.host !== '127.0.0.1') {
    for (const a of lanAddresses()) lines.push(`  On your phone:     http://${a.address}:${app.port}   (${a.name})`);
  }
  if (args.password) lines.push('', '  Password protection is on (any user name, your password).');
  lines.push('', '  Press Ctrl+C to stop.', '');
  console.log(lines.join('\n'));
  let last = '';
  app.cam.on('state', (s) => {
    const msg = s === 'connected' ? `Camera connected${app.cam.info?.version ? ` (firmware ${app.cam.info.version})` : ''}` : s === 'disconnected' ? (app.cam.lastError ? `Camera not reachable: ${app.cam.lastError} — retrying…` : 'Reconnecting to the camera…') : '';
    if (msg && msg !== last) { console.log(`[${new Date().toLocaleTimeString()}] ${msg}`); last = msg; }
  });
  const stop = async () => { await app.close(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
