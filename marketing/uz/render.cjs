// Renders ad.html frame by frame.
//   node render.cjs timeline.json out.mp4            full silent video
//   node render.cjs timeline.json outdir 1.5 6 12    single PNG frames for checking
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const [tlPath, out, ...times] = process.argv.slice(2);
const FPS = 30;
(async () => {
  const tl = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(__dirname, 'ad.html'));
  await p.evaluate(tl => build(tl), tl);
  if (times.length) {
    fs.mkdirSync(out, { recursive: true });
    for (const t of times) { await p.evaluate(t => setT(t), +t); await p.screenshot({ path: path.join(out, `${tl.id}_${t}.png`) }); }
  } else {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-r', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-color_range', 'tv', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round(tl.total * FPS);
    for (let f = 0; f < n; f++) {
      await p.evaluate(t => setT(t), f / FPS);
      const buf = await p.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    console.log('rendered', out, n, 'frames');
  }
  await b.close();
})();
