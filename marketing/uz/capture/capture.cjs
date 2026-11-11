// Photographs real app screens (phone size, 3x) from the seeded demo state.
const { chromium } = require('playwright');
const dir = process.argv[2], out = process.argv[3];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, storageState: dir + '/state.json' });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 300)));
  await p.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.SAT_CONFIG={supabaseUrl:"",supabaseAnonKey:"",ai:false,turnstileSiteKey:""};' }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(3500);
  const shot = async (name, opts = {}) => { await p.screenshot({ path: `${out}/${name}.png`, ...opts }); console.log('shot', name); };
  const nav = async k => { await p.evaluate(k => document.querySelector(`.nav[data-nav="${k}"]`).click(), k); await p.waitForTimeout(1600); };
  const scrollTo = async y => { await p.evaluate(y => { window.scrollTo(0, y); document.scrollingElement.scrollTop = y; const m = document.querySelector('main'); if (m) m.scrollTop = y; }, y); await p.waitForTimeout(500); };
  const hideNav = async on => { await p.evaluate(on => { const n = document.querySelector('.nav').parentElement; let e = n; while (e && getComputedStyle(e).position !== 'fixed' && getComputedStyle(e).position !== 'sticky') e = e.parentElement; (e || n).style.visibility = on ? 'hidden' : ''; }, on); await p.waitForTimeout(150); };
  console.log('navs', await p.evaluate(() => [...document.querySelectorAll('.nav')].map(n => n.dataset.nav).join(',')));
  // dismiss any celebration overlay
  await p.evaluate(() => { const o = document.querySelector('#ov'); if (o) o.remove(); });
  await shot('home'); await shot('home_full', { fullPage: true });
  for (const k of ['progress', 'words', 'history', 'feedback', 'course', 'quick', 'tests', 'english']) {
    try { await nav(k); await shot(k); await hideNav(true); await shot(k + '_full', { fullPage: true }); await hideNav(false); } catch (e) { console.log('nav fail', k, e.message.slice(0, 120)); }
  }
  // Results page of the latest math test
  await nav('history');
  await p.evaluate(() => { const r = sortedHist().filter(r => r.sub === 'math').pop(); renderResults(r, false); window.scrollTo(0, 0); });
  await p.waitForTimeout(1500); await shot('results'); await hideNav(true); await shot('results_full', { fullPage: true }); await hideNav(false);
  await b.close();
})();
