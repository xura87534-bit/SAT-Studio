// Live test screens: a question with an answer picked, and the graphing calculator.
const { chromium } = require('playwright');
const dir = process.argv[2], out = process.argv[3];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, storageState: dir + '/state.json' });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 300)));
  await p.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.SAT_CONFIG={supabaseUrl:"",supabaseAnonKey:"",ai:false,turnstileSiteKey:""};' }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(3000);
  await p.evaluate(() => { const o = document.querySelector('#ov'); if (o) o.remove(); });
  const shot = async name => { await p.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };
  await p.evaluate(() => beginTest(LIBID['pt6'], true)); await p.waitForTimeout(1200);
  const goQ = async i => { await p.evaluate(i => { test.idx = i; renderTest(); }, i); await p.waitForTimeout(700); };
  await goQ(7);
  await p.click('.choice[data-i="1"]'); await p.waitForTimeout(500); await shot('question');
  await p.click('#calcBtn'); await p.waitForTimeout(1000);
  const ins = p.locator('input:visible');
  console.log('inputs', await ins.count());
  await ins.nth(0).fill('y=6x+1'); await ins.nth(0).press('Enter'); await p.waitForTimeout(300);
  await p.locator('input:visible').nth(1).fill('y=-x/6+1'); await p.locator('input:visible').nth(1).press('Enter'); await p.waitForTimeout(900);
  await shot('calc');
  await p.evaluate(() => toggleCalc(false));
  await p.evaluate(async () => { const m = cur(); m.qs.forEach((q, i) => { m.ans[i] = i === 20 ? (q.t === 'mc' ? (q.a + 1) % 4 : '7') : (q.t === 'mc' ? q.a : String(q.a[0])); m.tm[i] = 80; }); await submitModule(); });
  await p.waitForTimeout(600); await shot('adaptive0');
  await p.waitForFunction(() => { const g = document.querySelector('#m2Go'); return g && !g.disabled; }, null, { timeout: 20000 });
  await p.waitForTimeout(400); await shot('adaptive');
  await b.close();
})();
