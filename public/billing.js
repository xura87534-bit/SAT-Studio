/* SAT Studio billing: plans, free limits, paywalls, the Billing page and the admin payments panel.
   Prices and limits come from plans.js. Who has Pro comes from the database (supabase/billing-2026-11.sql).
   Uses the app's globals at call time: shell, esc, $, $$, go, view, HISTORY, SESSIONS, LIB, ME, closeSheet.

   Limits on built-in content are checked in the browser, so they keep honest students honest;
   the Claude allowance is enforced on the server and can't be skipped. */
(function () {
"use strict";
const CFG = window.SAT_CONFIG || {}, P = window.SAT_PLANS, PF = window.SAT_PLATFORM || {};
if (!P) return;
const F = P.free, PAY = CFG.pay || {};
const CACHE = "satstudio_plan";
const S = { until: 0, admin: false, last: null, loaded: false, dbOk: null };
try { const c = JSON.parse(localStorage.getItem(CACHE) || "null"); if (c) { S.until = +c.until || 0; S.admin = !!c.admin; } } catch (e) { }

/* ---------- state ---------- */
const enabled = () => !!CFG.billing;                       // BILLING=on in Vercel: limits and the page go live
const isOwner = () => { try { return !!ME.owner; } catch (e) { return false; } };
const isPro = () => S.admin || isOwner() || S.until > Date.now();
const visible = () => enabled() || isOwner();              // the owner can preview before launch
const signedIn = () => !!PF.signedIn;
const priceOf = p => P.founding ? p.price : p.list;
const money = n => Number(n).toLocaleString("en-US").replace(/,/g, " ") + " " + P.currency;
const dayKey = d => { const x = new Date(d); return x.getFullYear() + "-" + (x.getMonth() + 1) + "-" + x.getDate(); };
const daysLeft = () => Math.max(0, Math.ceil((S.until - Date.now()) / 864e5));

let lastRefresh = 0;
async function refresh() {
  if (!PF.hasBackend || !PF.rpc) return;
  let s = null; try { s = await PF.getSession(); } catch (e) { }
  if (!s) { S.loaded = true; return; }
  const was = isPro(), before = JSON.stringify([S.until, S.last, S.dbOk]);
  lastRefresh = Date.now();
  try {
    const r = await PF.rpc("my_plan");
    S.dbOk = true; S.loaded = true;
    S.until = r && r.paid_until ? Date.parse(r.paid_until) : 0;
    S.admin = !!(r && r.plan === "pro" && !(S.until > Date.now()));
    S.last = (r && r.last) || null;
    try { localStorage.setItem(CACHE, JSON.stringify({ until: S.until, admin: S.admin })); } catch (e) { }
  } catch (e) { S.dbOk = false; S.loaded = true; }
  if (!was && isPro() && enabled() && !isOwner() && !S.admin) toast("Pro is active. Everything is unlocked.");
  // Redraw the page behind the change, but never pull a student out of a test.
  try { if ((was !== isPro() || (view === "billing" && before !== JSON.stringify([S.until, S.last, S.dbOk]))) && screen === view && ["billing", "home", "tests", "english", "course"].includes(view) && !document.querySelector("#ov")) go(view); } catch (e) { }
}

/* ---------- free limits ---------- */
function drillsToday() {
  const t = dayKey(Date.now());
  return HISTORY.filter(r => { if (r.kind !== "drill" || dayKey(r.done || r.date) !== t) return false; const l = LIBID[r.libId]; return !(l && (l.redo || (F.bookFree && l.book))); }).length;
}
/* "" when the student may start this library item, otherwise the reason it is locked. */
function lockOf(l) {
  if (!enabled() || isPro() || !l) return "";
  if (l.kind !== "sat" && SESSIONS[l.id]) return "";       // always let a saved attempt be finished
  if (l.redo || (F.bookFree && l.book)) return "";
  if (l.ai) return "ai";
  if (l.kind === "sat") return F.sat.includes(l.id) ? "" : "full";
  if (l.kind === "full") return F.full.includes(l.id) ? "" : "full";
  return drillsToday() >= F.drillsPerDay ? "drills" : "";
}
const courseLocked = it => enabled() && !isPro() && !(it.m === 1 && it.w <= F.courseWeeks);
// Section tests with their own fixed Module 1. Full SATs pair these up, so they aren't counted twice.
const fullCount = () => LIB.filter(l => l.kind === "full" && l.src === "fixed" && l.id !== "hard").length;
const satCount = () => LIB.filter(l => l.kind === "sat").length;

const WHY = {
  full: () => ["This test is part of Pro", `Free accounts get Practice Tests 1 and 2 in Math and in Reading & Writing, plus Full SAT 1, with unlimited retakes. Pro opens all ${fullCount()} section tests, ${satCount()} Full SATs, the Challenge Test and Fresh mix.`],
  ai: () => ["AI-written tests are part of Pro", "Claude writes a brand-new test or a drill on your weakest skills every time, so you never run out of fresh questions."],
  drills: () => [`That's today's ${F.drillsPerDay} free drills`, "Free drills reset at midnight, and Redo my mistakes is always open. Pro has no daily limit."],
  course: () => ["The rest of the course is part of Pro", `Week ${F.courseWeeks} of the 90-Day Course is free. Pro opens all 12 weeks, from the basics to full timed tests.`],
  ai_limit: m => ["You've used today's free Claude answers", m || `Free accounts get ${F.aiPerDay} Claude answers a day. Pro gets ${P.pro.aiPerDay}.`],
};
function paywall(reason, msg) {
  const [title, body] = (WHY[reason] || WHY.full)(msg);
  const best = P.plans.find(p => p.best) || P.plans[0];
  sheet(`<span class="chip">SAT Studio Pro</span><h2 id="shT" style="margin-top:12px">${esc(title)}</h2><p class="muted">${esc(body)}</p>
  <ul class="specs"><li><span>${esc(best.name)}</span><span>${money(priceOf(best))}</span></li><li><span>That is</span><span>${money(Math.round(priceOf(best) / best.months / 1000) * 1000)} a month</span></li></ul>
  <div class="actions"><button class="btn" id="pwGo">See Pro plans</button><button class="btn link" id="pwNo">Not now</button></div>`);
  $("#pwGo").onclick = () => { closeSheet(); go("billing"); };
  $("#pwNo").onclick = closeSheet;
  $("#pwGo").focus();
}
/* Called before a test's start sheet opens. False = blocked, and the paywall is showing. */
function guard(l) { const why = lockOf(l); if (!why) return true; paywall(why); return false; }

/* ---------- small UI helpers ---------- */
function sheet(html) {
  closeSheet();
  const ov = document.createElement("div"); ov.className = "overlay"; ov.id = "ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="shT">${html}</div>`;
  document.body.appendChild(ov);
  ov.onclick = e => { if (e.target === ov) closeSheet(); };
  return ov;
}
function toast(t) { try { if (typeof wbToast === "function") return wbToast(t); } catch (e) { } }
function css() {
  if (document.getElementById("blCss")) return;
  const st = document.createElement("style"); st.id = "blCss";
  st.textContent = `
.blhero{display:grid;gap:10px;justify-items:start}
.blhero h1{font-size:clamp(1.9rem,4.4vw,2.7rem);line-height:1.08;margin:0;max-width:19ch}
.blhero p{margin:0;max-width:60ch}
.blstat{display:flex;align-items:center;gap:14px;flex-wrap:wrap;border-left:4px solid var(--primary)}
.blstat.ok{border-left-color:var(--ok)}.blstat.wait{border-left-color:var(--dG,#E0861A)}.blstat.bad{border-left-color:var(--bad)}
.blstat b{display:block}.blstat .grow{flex:1;min-width:220px}
.blplans{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;align-items:stretch}
.blplan{position:relative;display:flex;flex-direction:column;gap:6px;background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:24px 22px 22px}
.blplan.best{border:2px solid var(--primary);box-shadow:0 18px 44px -26px rgba(29,63,115,.55)}
.blplan .tag{position:absolute;top:-12px;left:20px;background:var(--primary);color:var(--primary-ink,#fff);font:700 11.5px var(--ui);letter-spacing:.04em;text-transform:uppercase;padding:4px 10px;border-radius:999px}
.blplan h3{margin:0;font-size:1.05rem}
.blplan .pr{font:700 2.05rem/1.05 var(--display,var(--ui));letter-spacing:-.03em;margin-top:8px;font-variant-numeric:tabular-nums}
.blplan .pr small{font:600 .95rem var(--ui);color:var(--muted);letter-spacing:0}
.blplan .was{color:var(--muted);font-size:.9rem;min-height:1.3em}
.blplan .was s{margin-right:8px}.blplan .was em{font-style:normal;font-weight:700;color:var(--ok)}
.blplan .per{color:var(--muted);font-size:.92rem}
.blplan .blurb{color:var(--muted);font-size:.92rem;margin:6px 0 14px;flex:1}
.blplan .btn{width:100%;justify-content:center}
.blnote{font-size:.9rem;color:var(--muted);margin:2px 0 0}
.blcmp{width:100%;border-collapse:collapse;font-size:.95rem}
.blcmp th,.blcmp td{text-align:left;padding:11px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.blcmp thead th{font:700 .78rem var(--ui);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.blcmp td:first-child{font-weight:600}.blcmp td:nth-child(2){color:var(--muted)}
.blcmp td:nth-child(3){font-weight:600;color:var(--primary)}
.blcmp tr:last-child td{border-bottom:0}
.blfaq details{border-bottom:1px solid var(--line);padding:12px 0}.blfaq details:last-child{border-bottom:0}
.blfaq summary{font-weight:600;cursor:pointer}.blfaq p{margin:8px 0 0;color:var(--muted);max-width:68ch}
.blsteps{list-style:none;counter-reset:s;padding:0;margin:16px 0 4px;display:grid;gap:14px}
.blsteps li{counter-increment:s;display:grid;grid-template-columns:28px 1fr;gap:12px}
.blsteps li::before{content:counter(s);width:28px;height:28px;border-radius:50%;background:var(--sel);color:var(--primary);display:grid;place-items:center;font:700 .85rem var(--ui)}
.blsteps b{display:block}.blsteps span{color:var(--muted);font-size:.92rem}
.blcard{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--surface2);border-radius:12px;padding:10px 12px;margin-top:8px}
.blcard code{font:600 1.05rem ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;flex:1;min-width:0;overflow-wrap:anywhere;user-select:all}
.blin{width:100%;padding:11px 12px;border-radius:12px;border:1px solid var(--line2);background:var(--surface);color:var(--ink);font:500 16px var(--ui);margin-top:8px}
.blmsg{min-height:1.3em;font-size:.88rem;color:var(--bad);margin:8px 0 0}
.bladm td .btn{margin-right:6px}.bladm .pend td{background:var(--sel)}
.bladm form{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}.bladm form .blin{width:auto;flex:1;min-width:150px;margin:0}
.blcheck{list-style:none;padding:0;margin:10px 0 0;display:grid;gap:6px;font-size:.93rem}
.blcheck li::before{content:"○";margin-right:8px;color:var(--muted)}.blcheck li.y::before{content:"●";color:var(--ok)}
.navpro{margin-left:auto;font:700 10.5px var(--ui);padding:2px 7px;border-radius:999px;background:var(--sel);color:var(--primary)}
.lockb{margin-left:auto;font:700 11px var(--ui);padding:3px 8px;border-radius:999px;background:var(--sel);color:var(--primary);white-space:nowrap}
@media (max-width:560px){.blcmp th,.blcmp td{padding:10px 6px;font-size:.9rem}.blplan{padding:22px 18px 18px}}`;
  document.head.appendChild(st);
}

/* ---------- Billing page ---------- */
function statusCard() {
  const L = S.last;
  if (isOwner() || S.admin) return `<section class="card blstat ok"><div class="grow"><b>Admin account: everything is unlocked</b><span class="muted">You see the page the way a free student does, so you can check it.</span></div></section>`;
  if (S.until > Date.now()) {
    const d = daysLeft();
    return `<section class="card blstat ok"><div class="grow"><b>You're on Pro</b><span class="muted">Active until ${esc(fmtDate(new Date(S.until).toISOString()))}, ${d} day${d === 1 ? "" : "s"} left. Buying again adds time on top.</span></div></section>`;
  }
  if (L && L.status === "pending") return `<section class="card blstat wait"><div class="grow"><b>We're checking your payment</b><span class="muted">${money(L.amount)}, sent ${esc(fmtDate(L.created_at))}. Pro switches on as soon as we see it, usually the same day. Nothing to do but keep practicing.</span></div><button class="btn sm ghost" id="blRe">Check now</button>${tgBtn("Message us", "sm ghost")}</section>`;
  if (L && L.status === "rejected") return `<section class="card blstat bad"><div class="grow"><b>We couldn't find your last payment</b><span class="muted">Nothing was activated. Send us the receipt on Telegram and we'll sort it out, or try again below.</span></div>${tgBtn("Message us", "sm")}</section>`;
  if (S.until) return `<section class="card blstat"><div class="grow"><b>Your Pro ended on ${esc(fmtDate(new Date(S.until).toISOString()))}</b><span class="muted">Your scores and history are safe. Renew to open everything again.</span></div></section>`;
  return "";
}
const tgUrl = text => PAY.telegram ? `https://t.me/${encodeURIComponent(PAY.telegram)}${text ? "?text=" + encodeURIComponent(text) : ""}` : "";
const tgBtn = (label, cls, text) => PAY.telegram ? `<a class="btn ${cls || ""}" href="${esc(tgUrl(text))}" target="_blank" rel="noopener">${esc(label)}</a>` : "";

function planCard(p) {
  const pr = priceOf(p), off = P.founding && p.list > p.price ? Math.round(100 * (1 - p.price / p.list)) : 0;
  const perMonth = Math.round(pr / p.months / 1000) * 1000;
  return `<article class="blplan${p.best ? " best" : ""}">${p.best ? `<span class="tag">Most popular</span>` : ""}
  <h3>${esc(p.name)}</h3>
  <div class="pr">${money(pr).replace(" " + P.currency, "")} <small>${esc(P.currency)}</small></div>
  <div class="was">${off ? `<s>${money(p.list)}</s><em>Save ${off}%</em>` : ""}</div>
  <div class="per">${p.months > 1 ? `${money(perMonth)} a month · ` : ""}${p.months * 30} days of Pro</div>
  <p class="blurb">${esc(p.blurb || "")}</p>
  <button class="btn${p.best ? "" : " ghost"}" data-buy="${p.code}">${isPro() && !isOwner() ? "Add " + esc(p.name.toLowerCase()) : "Get " + esc(p.name)}</button></article>`;
}
function ownerCard() {
  if (!isOwner()) return "";
  const ok = [[S.dbOk === true, "Database: run supabase/billing-2026-11.sql in the Supabase SQL editor"], [!!PAY.card || !!PAY.link, "Vercel: set PAY_CARD and PAY_NAME (or PAY_LINK) so students know where to pay"], [!!PAY.telegram, "Vercel: set PAY_TELEGRAM so students can send receipts"], [enabled(), "Vercel: set BILLING=on and redeploy to switch limits on for students"]];
  return `<section class="card"><div class="toolbar"><h2 style="margin:0">Launch checklist</h2><span class="chip">${enabled() ? "Billing is live" : "Billing is off: only you see this page"}</span></div>
  <ul class="blcheck">${ok.map(([y, t]) => `<li class="${y ? "y" : ""}">${esc(t)}</li>`).join("")}</ul>
  <p class="fine" style="margin-top:10px">Payment requests and manual Pro grants are on the Students page.</p></section>`;
}
function renderBilling() {
  css(); view = "billing";
  const g = P.guaranteeDays, n = fullCount();
  const rows = [
    ["Full adaptive tests", `Practice Tests 1 and 2 per section, plus Full SAT 1`, `All ${n} section tests and ${satCount()} Full SATs, plus Challenge Test and Fresh mix`],
    ["Drills", `${F.drillsPerDay} a day`, "Unlimited"],
    ["AI-written tests and weak-skill drills", "Not included", "Included"],
    ["Claude tutor, explanations and score reports", `${F.aiPerDay} answers a day`, `${P.pro.aiPerDay} a day`],
    ["90-Day Course", `Week ${F.courseWeeks}`, "All 12 weeks"],
    ["Quick Practice, calculator, word bank, progress", "Included", "Included"],
  ];
  shell(`<div class="stack">
  <section class="blhero"><span class="chip">SAT Studio Pro</span>
    <h1>Every test, every drill, a tutor on every question.</h1>
    <p class="muted">Sitting the SAT costs about $111 each time. Pro is the practice that makes one sitting enough: ${n} full adaptive section tests, unlimited drills, and Claude explaining every question you miss.</p></section>
  ${ownerCard()}${statusCard()}
  <section><div class="blplans">${P.plans.map(planCard).join("")}</div>
    <p class="blnote">${P.founding ? esc(P.foundingNote) + ". " : ""}One payment, no auto-renewal, nothing to cancel.${g ? ` Not for you? Tell us within ${g} days and we send the money back.` : ""}</p></section>
  <section class="card"><h2>Free and Pro, side by side</h2>
    <table class="blcmp"><thead><tr><th></th><th>Free</th><th>Pro</th></tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></section>
  <section class="card blfaq"><h2>Questions</h2>
    <details><summary>How do I pay?</summary><p>Choose a plan, send the amount from Payme, Click, Uzum or any bank app to the card shown, then press "I've paid". We check the transfer and switch Pro on, usually the same day.</p></details>
    <details><summary>Will I be charged again?</summary><p>No. You pay once for a fixed number of days. When they run out you go back to the free plan and keep all your scores and history.</p></details>
    <details><summary>What if I buy again while Pro is still active?</summary><p>The new days are added after the ones you already have, so you never lose time.</p></details>
    ${g ? `<details><summary>Can I get my money back?</summary><p>Yes. If Pro isn't what you expected, message us within ${g} days of paying and we return the full amount to your card.</p></details>` : ""}
    <details><summary>Is the free plan really free?</summary><p>Yes, with no time limit. You can sit two full tests in each section, a Full SAT, ${F.drillsPerDay} drills a day and all of Quick Practice without paying.</p></details>
  </section></div>`);
  $$("[data-buy]").forEach(b => b.onclick = () => buy(b.dataset.buy));
  const re = $("#blRe"); if (re) re.onclick = async () => { re.disabled = true; await refresh(); const b = $("#blRe"); if (b) { b.disabled = false; b.textContent = "Still checking"; } };
  if (!S.loaded || (S.last && S.last.status === "pending" && Date.now() - lastRefresh > 15000)) refresh();
}

/* ---------- Pay sheet ---------- */
async function buy(code) {
  const p = P.plans.find(x => x.code === code); if (!p) return;
  const pr = priceOf(p);
  if (!signedIn()) {
    sheet(`<h2 id="shT">Create your free account first</h2><p class="muted">Pro is attached to your account, so it follows you to every device. It takes ten seconds.</p>
    <div class="actions"><button class="btn" id="blIn">Sign in or create account</button><button class="btn link" id="blNo">Cancel</button></div>`);
    $("#blIn").onclick = () => PF.signIn && PF.signIn(); $("#blNo").onclick = closeSheet; return;
  }
  if (!PAY.card && !PAY.link) {
    sheet(`<h2 id="shT">Payments open soon</h2><p class="muted">We're finishing the payment setup. ${PAY.telegram ? "Message us on Telegram and we'll switch Pro on for you by hand." : "Check back in a day or two."}</p>
    <div class="actions">${tgBtn("Message us on Telegram", "", `SAT Studio Pro: ${p.name}, ${money(pr)}`)}<button class="btn link" id="blNo">Close</button></div>`);
    $("#blNo").onclick = closeSheet; return;
  }
  let email = ""; try { const ses = await PF.getSession(); email = (ses && ses.user && ses.user.email) || ""; } catch (e) { }
  const receipt = `SAT Studio Pro: ${p.name}, ${money(pr)}.${email ? " Account: " + email : ""}`;
  sheet(`<span class="chip">${esc(p.name)} · ${p.months * 30} days</span><h2 id="shT" style="margin-top:12px">Pay ${money(pr)}</h2>
  <ol class="blsteps">
    <li><div><b>Send ${money(pr)}</b><span>From Payme, Click, Uzum or any bank app.</span>
      ${PAY.card ? `<div class="blcard"><code id="blNum">${esc(PAY.card)}</code><button class="btn sm ghost" id="blCopy">Copy</button></div>${PAY.name ? `<span>Card holder: <b style="display:inline;color:var(--ink)">${esc(PAY.name)}</b>. Check the name before you confirm.</span>` : ""}` : ""}
      ${PAY.link ? `<div style="margin-top:8px"><a class="btn sm" href="${esc(PAY.link)}" target="_blank" rel="noopener">Open payment page</a></div>` : ""}</div></li>
    ${PAY.telegram ? `<li><div><b>Send us the receipt</b><span>A screenshot on Telegram lets us find your transfer in minutes.</span><div style="margin-top:8px">${tgBtn("Open Telegram", "sm ghost", receipt)}</div></div></li>` : ""}
    <li><div><b>Tell us you've paid</b><span>Name on the card you paid from, so we can match it.</span>
      <input class="blin" id="blNote" maxlength="80" placeholder="For example: Karimov Ali" autocomplete="cc-name"></div></li>
  </ol>
  <p class="blmsg" id="blMsg" role="status" aria-live="polite"></p>
  <div class="actions"><button class="btn" id="blPaid">I've paid</button><button class="btn link" id="blNo">Cancel</button></div>
  <p class="fine" style="margin-top:12px">Pro switches on after we confirm the transfer, usually the same day.${P.guaranteeDays ? ` ${P.guaranteeDays}-day money-back promise.` : ""}</p>`);
  const cp = $("#blCopy"); if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(PAY.card.replace(/\s+/g, "")); cp.textContent = "Copied"; } catch (e) { cp.textContent = "Select and copy"; } };
  $("#blNo").onclick = closeSheet;
  $("#blPaid").onclick = async () => {
    const b = $("#blPaid"), m = $("#blMsg"); b.disabled = true; m.textContent = "";
    try {
      await PF.rpc("request_payment", { p_plan: p.code, p_amount: pr, p_note: $("#blNote").value.trim() });
      S.last = { plan: p.code, amount: pr, status: "pending", created_at: new Date().toISOString() };
      closeSheet(); renderBilling(); window.scrollTo(0, 0);
    } catch (e) {
      b.disabled = false;
      m.textContent = /Too many/.test(e && e.message || "") ? e.message : S.dbOk === false || /request_payment|PGRST202/.test((e && (e.code + e.message)) || "") ? "Payments aren't switched on yet. Message us on Telegram." : "That didn't go through. Check your connection and try again.";
    }
  };
}

/* ---------- strips shown inside the app ---------- */
function homeStrip() {
  if (!enabled() || isPro() || !HISTORY.length) return "";
  const left = Math.max(0, F.drillsPerDay - drillsToday());
  return `<section class="resume"><div class="info"><b>Free plan</b><div class="muted" style="font-size:.9rem">${left} of ${F.drillsPerDay} drills left today · ${F.aiPerDay} Claude answers a day · 2 full tests per section</div></div><div class="actions"><button class="btn sm" data-bill>See Pro</button></div></section>`;
}
function resultStrip(rec) {
  if (!enabled() || isPro() || !rec || !Array.isArray(rec.items)) return "";
  const missed = rec.items.filter(i => !i.ok), skills = new Set(missed.map(i => i.s)).size;
  if (missed.length < 3) return "";
  return `<section class="resume"><div class="info"><b>You missed ${missed.length} questions across ${skills} skill${skills === 1 ? "" : "s"}</b><div class="muted" style="font-size:.9rem">Pro turns that list into practice: unlimited drills on each skill, AI-written questions on your weakest ones, and ${P.pro.aiPerDay} Claude explanations a day.</div></div><div class="actions"><button class="btn sm" data-bill>See Pro</button></div></section>`;
}
const lockBadge = l => { const w = lockOf(l); return w === "drills" ? `<span class="lockb">Back tomorrow</span>` : w ? `<span class="lockb">Pro</span>` : ""; };
const navItem = () => visible() ? [["billing", isPro() && !isOwner() ? "Pro plan" : "Go Pro", ICON_PRO, isPro() && !isOwner() ? "Pro" : "Go Pro"]] : [];
const ICON_PRO = '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z"/></svg>';

/* ---------- Admin: payments on the Students page ---------- */
async function adminPanel(el) {
  if (!el || !isOwner() || !PF.rpc) return;
  css();
  let d;
  try { d = await PF.rpc("admin_payments"); }
  catch (e) { el.innerHTML = `<section class="card" style="margin-bottom:18px"><h2>Payments</h2><p class="muted" style="margin:0">Not set up yet. Run <b>supabase/billing-2026-11.sql</b> in the Supabase SQL editor, then refresh.</p></section>`; return; }
  const rows = d.rows || [], pend = rows.filter(r => r.status === "pending");
  const name = c => (P.plans.find(p => p.code === c) || {}).name || c;
  el.innerHTML = `<section class="card bladm" style="margin-bottom:18px"><div class="toolbar"><h2 style="margin:0">Payments</h2><span class="chip">${pend.length} waiting</span></div>
  <div class="sstats"><div><b>${d.active_pro || 0}</b><span>students on Pro</span></div><div><b>${money(d.revenue_30d || 0)}</b><span>approved, last 30 days</span></div><div><b>${money(d.revenue_all || 0)}</b><span>approved, all time</span></div></div>
  ${rows.length ? `<div class="tscroll"><table class="stud"><thead><tr><th>Student</th><th>Plan</th><th>Amount</th><th>Paid from</th><th>Sent</th><th>Status</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.status === "pending" ? "pend" : ""}"><td>${esc(r.email || "")}</td><td>${esc(name(r.plan))}</td><td class="n">${money(r.amount)}</td><td>${esc(r.note || "–")}</td><td>${esc(fmtDate(r.created_at))}</td><td>${r.status === "pending" ? `<button class="btn sm" data-ok="${esc(r.id)}">Approve</button><button class="btn sm ghost" data-rej="${esc(r.id)}">Reject</button>` : esc(r.status) + (r.status === "approved" && r.paid_until ? `, Pro until ${esc(fmtDate(r.paid_until))}` : "")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">No payment requests yet. They appear here when a student presses "I've paid".</p>`}
  <p class="fine" style="margin-top:12px">Approve only after you see the money in your bank app. Approving adds the plan's days on top of any Pro time the student still has.</p>
  <form id="blGrant"><input class="blin" id="blGE" type="email" placeholder="student@email.com" required><input class="blin" id="blGD" type="number" value="30" min="-3660" max="3660" style="max-width:110px" aria-label="Days" required><button class="btn sm ghost">Give Pro days</button></form>
  <p class="blmsg" id="blGM" role="status" aria-live="polite"></p></section>`;
  const decide = async (id, ok, b) => {
    if (!ok && !(await askConfirm("Reject this payment?", "The student sees that the payment wasn't found and can send the receipt again.", "Reject"))) return;
    b.disabled = true;
    try { await PF.rpc("admin_decide_payment", { p_id: id, p_approve: ok }); adminPanel(el); }
    catch (e) { b.disabled = false; $("#blGM").textContent = (e && e.message) || "That didn't save."; }
  };
  el.querySelectorAll("[data-ok]").forEach(b => b.onclick = () => decide(b.dataset.ok, true, b));
  el.querySelectorAll("[data-rej]").forEach(b => b.onclick = () => decide(b.dataset.rej, false, b));
  $("#blGrant").onsubmit = async e => {
    e.preventDefault(); const m = $("#blGM");
    try { const r = await PF.rpc("admin_grant_pro", { p_email: $("#blGE").value.trim(), p_days: +$("#blGD").value }); m.style.color = "var(--ok)"; m.textContent = `Done. Pro until ${fmtDate(r.paid_until)}.`; }
    catch (er) { m.style.color = ""; m.textContent = (er && er.message) || "That didn't save."; }
  };
}

/* ---------- wiring ---------- */
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-bill]"); if (b) { e.preventDefault(); go("billing"); } });
let lastLimit = 0;
addEventListener("sat:ailimit", e => {
  const d = e.detail || {};
  if (!enabled() || d.plan !== "free") return;
  if (Date.now() - lastLimit < 6e5 || document.querySelector("#ov")) return toast(d.message);   // one prompt, then quiet reminders
  let inTest = false; try { inTest = screen === "test" || screen === "gen"; } catch (er) { }
  if (inTest) return toast(d.message);                                                           // never interrupt a timed test
  lastLimit = Date.now(); paywall("ai_limit", d.message);
});
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.last && S.last.status === "pending") refresh(); });
css();
setTimeout(refresh, 0);

window.BILL = { enabled, visible, isPro, refresh, lockOf, guard, paywall, courseLocked, lockBadge, homeStrip, resultStrip, navItem, render: renderBilling, adminPanel, state: S };
})();
