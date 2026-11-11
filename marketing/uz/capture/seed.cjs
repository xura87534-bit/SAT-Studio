// Fills the app (offline mode) with demo practice data by actually running tests in it,
// then saves the browser storage so capture.cjs can photograph real screens.
const { chromium } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 300)));
  await p.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.SAT_CONFIG={supabaseUrl:"",supabaseAnonKey:"",ai:false,turnstileSiteKey:""};' }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(2000);
  console.log(await p.evaluate(() => JSON.stringify(LIB.filter(l => l.kind === 'full' || l.kind === 'sat').map(l => [l.id, l.sub || 'math', l.kind, l.src]))));

  const runs = [
    ['pt1', 0.50, 0.45, '2026-10-05T14:10:00.000Z', 11],
    ['rw1', 0.55, 0.50, '2026-10-08T15:00:00.000Z', 12],
    ['pt2', 0.64, 0.55, '2026-10-14T14:30:00.000Z', 13],
    ['rw2', 0.74, 0.66, '2026-10-19T16:00:00.000Z', 14],
    ['pt3', 0.78, 0.66, '2026-10-24T13:20:00.000Z', 15],
    ['rw3', 0.84, 0.76, '2026-10-30T15:40:00.000Z', 16],
    ['pt4', 0.84, 0.68, '2026-11-04T14:00:00.000Z', 17],
    ['rw4', 0.93, 0.90, '2026-11-08T15:10:00.000Z', 18],
    ['pt5', 0.99, 0.93, '2026-11-10T14:00:00.000Z', 19],
  ];
  const ids = await p.evaluate(() => Object.keys(LIBID));
  for (const [lib, a1, a2, date, seed] of runs) {
    if (!ids.includes(lib)) { console.log('missing lib', lib); continue; }
    const r = await p.evaluate(async ([lib, a1, a2, date, seed]) => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      let s = seed * 7919; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
      const fill = acc => {
        const m = cur();
        m.qs.forEach((q, i) => {
          const pOk = Math.min(0.99, acc + (2 - q.lv) * 0.12);
          const ok = rnd() < pOk;
          m.ans[i] = q.t === 'mc' ? (ok ? q.a : (q.a + 1 + Math.floor(rnd() * 3)) % 4) : (ok ? String(q.a[0]) : '7');
          m.tm[i] = Math.round(35 + rnd() * 70 + q.lv * 12);
        });
      };
      beginTest(LIBID[lib], true);
      for (let i = 0; i < 50 && !(test && test.modules.length); i++) await sleep(100);
      fill(a1); await submitModule();
      for (let i = 0; i < 100; i++) { const g = document.querySelector('#m2Go'); if (g && !g.disabled) { g.click(); break; } await sleep(100); }
      for (let i = 0; i < 50 && !(test && test.modules.length === 2); i++) await sleep(100);
      fill(a2); await submitModule();
      await sleep(300);
      const rec = HISTORY[HISTORY.length - 1];
      rec.date = date; rec.done = new Date(new Date(date).getTime() + 62 * 60000).toISOString();
      await persist(rec);
      return [rec.title, rec.sub, rec.score, rec.route, rec.m1, rec.m2];
    }, [lib, a1, a2, date, seed]);
    console.log(lib, JSON.stringify(r));
    await p.waitForTimeout(300);
  }
  // Word bank: words a student would mark in Reading & Writing, with Uzbek translations.
  await p.evaluate(async () => {
    const W = [
      ['ambiguous', 'noaniq, ikki maʼnoli', 'adj.', 'open to more than one interpretation', 'The results of the first trial were ambiguous, so the team repeated it.', 'new'],
      ['resilient', 'bardoshli, chidamli', 'adj.', 'able to recover quickly from difficulty', 'Coral reefs proved more resilient than researchers had expected.', 'new'],
      ['undermine', 'putur yetkazmoq, zaiflashtirmoq', 'verb', 'to weaken gradually', 'The new data undermine the claim that the species is declining.', 'ok'],
      ['scrutiny', 'sinchiklab tekshirish', 'noun', 'careful and critical examination', 'The theory did not survive closer scrutiny.', 'new'],
      ['prevalent', 'keng tarqalgan', 'adj.', 'widespread in a particular area or time', 'This style was prevalent among poets of the period.', 'ok'],
      ['advocate', 'tarafdor boʻlmoq, yoqlamoq', 'verb', 'to publicly support', 'Many economists advocate a gradual approach.', 'ok'],
      ['novel', 'yangi, oʻziga xos', 'adj.', 'new and unusual', 'The team proposed a novel method for dating the fossils.', 'new'],
      ['substantiate', 'dalillar bilan isbotlamoq', 'verb', 'to support with evidence', 'No later study could substantiate the finding.', 'ok'],
    ];
    const L = wbList(); L.length = 0;
    W.forEach(([w, uz, pos, def, ctx, st], i) => L.push({ id: 'wdemo' + i, w, ctx, src: 'R&W Practice Test ' + (1 + (i % 4)), date: new Date(Date.UTC(2026, 10, 8 - i)).toISOString(), uz, def, pos, st, n: 1 }));
    await wbSave();
    await new Promise(r => setTimeout(r, 500));
  });
  await ctx.storageState({ path: out + '/state.json' });
  console.log('keys', await p.evaluate(() => Object.keys(localStorage).map(k => k + ':' + localStorage[k].length).join(' ')));
  await b.close();
})();
