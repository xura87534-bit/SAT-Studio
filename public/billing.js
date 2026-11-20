/* SAT Studio billing: plans, free limits, paywalls, the Billing page and the admin payments panel.
   Prices and limits come from plans.js. Who has Pro comes from the database (supabase/billing-2026-11.sql).
   Uses the app's globals at call time: shell, esc, $, $$, go, view, HISTORY, SESSIONS, LIB, ME, closeSheet.

   Limits on built-in content are checked in the browser, so they keep honest students honest;
   the AI allowance is enforced on the server and can't be skipped. */
(function () {
"use strict";
const CFG = window.SAT_CONFIG || {}, P = window.SAT_PLANS, PF = window.SAT_PLATFORM || {};
if (!P) return;
const F = P.free, PAY = CFG.pay || {};
/* Several cards: put them in PAY_CARD separated by "|" and the holder names in PAY_NAME in the same order. */
const CARDS = (() => { const cs = String(PAY.card || "").split("|").map(x => x.trim()).filter(Boolean), ns = String(PAY.name || "").split("|").map(x => x.trim()); return cs.map((c, i) => ({ card: c, name: ns[i] || ns[0] || "" })); })();
const CACHE = "satstudio_plan";
const S = { until: 0, admin: false, last: null, loaded: false, dbOk: null };
try { const c = JSON.parse(localStorage.getItem(CACHE) || "null"); if (c) { S.until = +c.until || 0; S.admin = !!c.admin; } } catch (e) { }

/* ---------- state ---------- */
const enabled = () => !!CFG.billing;                       // BILLING=on in Vercel: limits and the page go live
const isOwner = () => { try { return !!ME.owner; } catch (e) { return false; } };
const isPro = () => S.admin || isOwner() || S.until > Date.now();
const visible = () => true;                                // prices are always public; limits and payments wait for BILLING=on
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
  full: () => ["This test is part of Pro", F.m2Free ? `Free accounts get Practice Tests 1 and 2 in Math and in Reading & Writing, plus Full SAT 1, with unlimited retakes. Pro opens all ${fullCount()} section tests, ${satCount()} Full SATs, the Challenge Test and Fresh mix.` : `Free accounts can take Module 1 of Practice Tests 1 and 2 in Math and in Reading & Writing, and of Full SAT 1. Pro opens Module 2 and your score, plus all ${fullCount()} section tests, ${satCount()} Full SATs, the Challenge Test and Fresh mix.`],
  ai: () => ["AI-written tests are part of Pro", "AI writes a brand-new test or a drill on your weakest skills every time, so you never run out of fresh questions."],
  drills: () => F.drillsPerDay ? [`That's today's ${F.drillsPerDay} free drills`, "Free drills reset at midnight, and Redo my mistakes is always open. Pro has no daily limit."] : ["Drills are part of Pro", "Redo my mistakes is always open. Pro opens unlimited drills on every skill."],
  course: () => [F.courseWeeks ? "The rest of the course is part of Pro" : "The 90-Day Course is part of Pro", F.courseWeeks ? `Week ${F.courseWeeks} of the 90-Day Course is free. Pro opens all 12 weeks, from the basics to full timed tests.` : "Pro opens all 12 weeks, from the basics to full timed tests."],
  ai_limit: m => F.aiPerDay ? ["You've used today's free AI answers", m || `Free accounts get ${F.aiPerDay} AI answers a day. Pro gets ${P.pro.aiPerDay}.`] : ["The AI tutor is part of Pro", `AI explains every question you miss, up to ${P.pro.aiPerDay} answers a day.`],
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
.blgate{max-width:560px;margin:0 auto;padding:32px 20px 48px;display:grid;gap:14px;justify-items:start;text-align:left}
.blgate h1{margin:0;font-size:clamp(1.7rem,4.6vw,2.3rem);line-height:1.1}
.blgate .bl-route{margin:0;max-width:52ch}
.blgl{list-style:none;padding:0;margin:4px 0 0;display:grid;gap:10px;width:100%}
.blgl li{display:grid;grid-template-columns:40px 1fr;gap:12px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:12px 14px}
.blgl i{width:40px;height:40px;border-radius:12px;background:var(--sel);color:var(--primary);display:grid;place-items:center}
.blgl b{display:block}.blgl span{color:var(--muted);font-size:.92rem}
.blgp{width:100%;margin:0;display:grid;gap:6px}.blgp>div{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline}.blgp p{margin:0}
.blgate a.btn,.blpar a.btn{text-decoration:none}
.blpar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:.92rem;color:var(--muted)}
@property --a{syntax:"<angle>";initial-value:0deg;inherits:false}
@keyframes blspin{to{--a:360deg}}
@keyframes blfloat{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(4%,-6%,0) scale(1.12)}}
@keyframes blshine{0%{transform:translateX(-130%) skewX(-20deg)}60%,100%{transform:translateX(330%) skewX(-20deg)}}
.blhero h1{font-family:"Inter Tight",var(--ui);font-weight:600;letter-spacing:-.02em;line-height:1.02;font-size:clamp(2.3rem,5.6vw,3.7rem);max-width:17ch}
.blstage{--ease:cubic-bezier(.2,.8,.2,1);display:block;position:relative;overflow:hidden;isolation:isolate;border-radius:30px;padding:clamp(22px,4.5vw,56px);color:#E8ECF5;background:radial-gradient(120% 90% at 85% 0%,#15337A 0%,rgba(21,51,122,0) 55%),radial-gradient(90% 70% at 0% 100%,#2A1B57 0%,rgba(42,27,87,0) 60%),#070B16;box-shadow:0 50px 90px -50px rgba(7,11,22,.9)}
.bls-grain{position:absolute;inset:0;z-index:-1;opacity:.07;pointer-events:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.bls-blob{position:absolute;z-index:-1;border-radius:50%;filter:blur(70px);pointer-events:none;animation:blfloat 14s ease-in-out infinite}
.bls-blob.a{width:380px;height:380px;right:-60px;top:20%;background:rgba(59,130,246,.38)}
.bls-blob.b{width:300px;height:300px;left:30%;bottom:-120px;background:rgba(244,201,93,.2);animation-delay:-6s}
.bls-head{display:grid;gap:10px;margin-bottom:clamp(18px,3vw,34px)}
.bls-eyebrow{font:600 .78rem ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:#F4C95D}
.bls-eyebrow::before{content:"(02) \\2014  "}
.blstage h2{margin:0;color:#fff;font-family:"Inter Tight",var(--ui);font-weight:600;font-size:clamp(1.8rem,4.2vw,2.8rem);line-height:1.04;letter-spacing:-.02em;max-width:18ch}
.blvs{position:relative;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) minmax(0,1.3fr);align-items:stretch}
.blvs>*{position:relative;z-index:1}
.blvs-dull,.blvs-glow{position:absolute!important;z-index:0!important;grid-row:1/-1;top:0;right:0;bottom:0;left:0}
.blvs-dull{grid-column:2;border-radius:18px 0 0 18px;background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.12);border-right:0}
.blvs-glow{grid-column:3;margin:-18px -14px -18px 0;border-radius:26px;background:linear-gradient(165deg,rgba(53,106,214,.55),rgba(14,30,72,.82) 70%);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 44px 90px -34px rgba(59,130,246,.75),inset 0 1px 0 rgba(255,255,255,.22)}
.blvs-glow::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:2px;background:conic-gradient(from var(--a),#F4C95D,#3B82F6 30%,#0E1E48 55%,#F4C95D);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:blspin 7s linear infinite}
.blvs-h{padding:14px 18px 14px;display:flex;flex-direction:column;justify-content:flex-end;gap:6px}
.blvs-h.free{font:600 .78rem ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:#5E667A}
.blvs-badge{display:inline-flex;align-items:center;gap:8px;align-self:flex-start;background:linear-gradient(180deg,#FFE08A,#F4C95D);color:#10264D;font:800 .9rem "Inter Tight",var(--ui);letter-spacing:.1em;text-transform:uppercase;padding:7px 15px;border-radius:999px;box-shadow:0 8px 24px -8px rgba(244,201,93,.8)}
.blvs-h.pro small{color:#BFD3FF;font:500 .85rem "Inter Tight",var(--ui)}
.blvs-l{padding:17px 14px 17px 2px;font:600 1rem "Inter Tight",var(--ui);color:#E8ECF5;border-top:1px solid rgba(255,255,255,.1);display:flex;align-items:center}
.blvs-c{padding:17px 18px;display:flex;align-items:flex-start;gap:11px;border-top:1px solid rgba(255,255,255,.08);font-size:.95rem;line-height:1.38}
.blvs-c i{flex:none;display:grid;place-items:center;margin-top:1px}
.blvs-c.free{color:#6C7488;filter:saturate(.2)}
.blvs-c.pro{color:#fff;font-weight:700;border-top-color:rgba(255,255,255,.16)}
.blvs-c.pro i svg{filter:drop-shadow(0 0 8px rgba(244,201,93,.65))}
.blvs-f{padding:18px;display:flex;align-items:center}
.blvs-f.free{color:#5E667A;font-size:.88rem}
.blvs-cta{position:relative;overflow:hidden;width:100%;border:0;cursor:pointer;background:linear-gradient(180deg,#FFE08A,#F4C95D 60%,#E8B53A);color:#10264D;font:800 1rem "Inter Tight",var(--ui);letter-spacing:.01em;padding:15px 20px;border-radius:999px;box-shadow:0 16px 34px -12px rgba(244,201,93,.85);transition:transform .35s var(--ease,ease),box-shadow .35s}
.blvs-cta::after{content:"";position:absolute;top:0;bottom:0;width:36%;left:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent);animation:blshine 3.6s ease-in-out infinite}
.blvs-cta:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 22px 40px -12px rgba(244,201,93,1)}
.blvs-cta:focus-visible{outline:3px solid #fff;outline-offset:3px}
.blstage .rv{opacity:0;transform:translateY(20px);transition:opacity .8s var(--ease),transform .8s var(--ease);transition-delay:var(--d,0ms)}
.blstage.in .rv{opacity:1;transform:none}
.blplan.best{background:linear-gradient(165deg,#0B1530 0%,#173F85 68%,#2459B8 100%);border:0;color:#fff;box-shadow:0 34px 70px -30px rgba(23,63,133,.95),0 0 0 2px #F4C95D;transform:translateY(-8px)}
.blplan.best h3,.blplan.best .pr{color:#fff}
.blplan.best .per,.blplan.best .blurb,.blplan.best .was,.blplan.best .pr small{color:rgba(255,255,255,.74)}
.blplan.best .was em{color:#8EF0B5}.blplan.best .was s{color:rgba(255,255,255,.55)}
.blplan.best .tag{background:linear-gradient(180deg,#FFE08A,#F4C95D);color:#10264D}
.blplan.best .btn{background:linear-gradient(180deg,#FFE08A,#F4C95D 60%,#E8B53A);color:#10264D;border:0;font-weight:800;box-shadow:0 14px 30px -12px rgba(244,201,93,.9)}
@media (prefers-reduced-motion:reduce){.bls-blob,.blvs-glow::before,.blvs-cta::after{animation:none}.blstage .rv{opacity:1;transform:none;transition:none}}
@media (max-width:640px){
.blstage{border-radius:24px}
.blvs{grid-template-columns:1fr 1fr}
.blvs-dull,.blvs-glow{display:none}
.blvs-h.gap,.blvs-f.gap{display:none}
.blvs-h{border-radius:16px 16px 0 0}.blvs-h.free{background:rgba(255,255,255,.04)}.blvs-h.pro{background:linear-gradient(160deg,rgba(53,106,214,.7),rgba(14,30,72,.9));box-shadow:inset 0 0 0 1.5px #F4C95D}
.blvs-l{grid-column:1/-1;padding:16px 2px 7px;border-top:1px solid rgba(255,255,255,.1);font-size:.95rem}
.blvs-c{border-top:0;padding:11px 12px;font-size:.88rem}.blvs-c.free{background:rgba(255,255,255,.04)}.blvs-c.pro{background:linear-gradient(160deg,rgba(40,90,190,.45),rgba(14,30,72,.8))}
.blvs-f.free{background:rgba(255,255,255,.04);border-radius:0 0 0 16px}.blvs-f.pro{background:rgba(14,30,72,.8);border-radius:0 0 16px 0;padding:12px 8px}
.blvs-cta{font-size:.85rem;padding:12px 8px}
.blplan.best{transform:none}}
/* clean pass: quiet, theme colours only */
.blplan,.blplan.best{background:var(--surface);border:1px solid #111;border-radius:14px;box-shadow:none;transform:none;color:var(--ink);padding:26px 24px 22px}
.blplan.best{border:2px solid #111}
.blplan h3,.blplan.best h3{font:600 .8rem "Inter Tight",var(--ui);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.blplan .pr,.blplan.best .pr{font:600 clamp(2rem,3.6vw,2.4rem)/1 "Inter Tight",var(--ui);letter-spacing:-.02em;color:var(--ink);-webkit-text-fill-color:var(--ink);background:none}
.blplan .pr small,.blplan.best .pr small{font:600 .8rem "Inter Tight",var(--ui);color:var(--muted);-webkit-text-fill-color:var(--muted);letter-spacing:.04em}
.blplan .was,.blplan.best .was{color:var(--muted);font-size:.82rem;-webkit-text-fill-color:var(--muted)}
.blplan.best .per,.blplan.best .blurb{color:var(--muted)}
.blplan .blurb{border-top:1px solid #111;padding-top:12px}
.blplan .tag,.blplan.best .tag{background:#111;color:#fff;border-radius:999px;letter-spacing:.06em;font-size:.68rem;box-shadow:none}
.blplan .btn,.blplan.best button.btn[data-buy]{border-radius:10px;font-weight:600;box-shadow:none;letter-spacing:0;text-transform:none;font-size:.95rem}
.blplan.best button.btn[data-buy]{background:#111!important;color:#fff!important;border:0!important}
.blplan button.btn.ghost{background:#fff!important;color:#111!important;border:1px solid #111!important}
.blstage{display:block;border-radius:14px;padding:clamp(18px,3.5vw,40px);color:var(--ink);background:#fff;border:1px solid #111;box-shadow:none}
.bls-blob,.bls-grain{display:none}
.bls-eyebrow{color:var(--muted);font:600 .75rem "Inter Tight",var(--ui);letter-spacing:.14em}
.bls-eyebrow::before{content:""}
.blstage h2{color:var(--ink);font-style:normal}
.blvs-dull{border-radius:0;background:transparent;border:0}
.blvs-glow{margin:0;border-radius:12px;background:#fff;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none}
.blvs-glow::before{padding:2px;background:#111;animation:none}
.blvs-h.free{font:600 .75rem "Inter Tight",var(--ui);letter-spacing:.14em;color:var(--muted)}
.blvs-badge{background:none;box-shadow:none;border-radius:0;padding:0;color:#111;font:600 .75rem "Inter Tight",var(--ui);letter-spacing:.14em}
.blvs-badge svg path{fill:var(--primary)}
.blvs-h.pro small{color:var(--muted);font:500 .85rem var(--ui)}
.blvs-l{color:#111;font-weight:500;border-top-color:#111}
.blvs-c{border-top-color:#D0D0D0}
.blvs-c.free{color:var(--muted);filter:none}
.blvs-c.pro{color:#111;font-weight:600;border-top-color:#D0D0D0}
.blvs-c.pro i svg{filter:none}
.blvs-f.free{color:var(--muted)}
.blvs-cta{background:#111;color:#fff;border-radius:10px;font:600 .95rem "Inter Tight",var(--ui);letter-spacing:0;text-transform:none;box-shadow:none}
.blvs-cta::after{display:none}
.blvs-cta:hover{transform:none;filter:brightness(1.08);box-shadow:none}
@media (max-width:640px){
.blvs-h.free,.blvs-c.free,.blvs-f.free{background:transparent;border-radius:0}
.blvs-h.pro,.blvs-c.pro,.blvs-f.pro{background:#fff;box-shadow:none;border-radius:0;border-left:2px solid #111;border-right:2px solid #111}
.blvs-h.pro{border-top:2px solid #111}.blvs-f.pro{border-bottom:2px solid #111}
.blvs-h{border-radius:0}.blstage{border-radius:12px}}
.navpro{margin-left:auto;font:700 10.5px var(--ui);padding:2px 7px;border-radius:999px;background:var(--sel);color:var(--primary)}
.lockb{margin-left:auto;font:700 11px var(--ui);padding:3px 8px;border-radius:999px;background:var(--sel);color:var(--primary);white-space:nowrap}
@media (max-width:560px){.blcmp th,.blcmp td{padding:10px 6px;font-size:.9rem}.blplan{padding:22px 18px 18px}}`;
  document.head.appendChild(st);
  const fl = document.createElement("link"); fl.rel = "stylesheet"; fl.href = "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap"; document.head.appendChild(fl);
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
  <div class="was">${off ? `Founding price` : ""}</div>
  <div class="per">${p.months > 1 ? `${money(perMonth)} a month · ` : ""}${p.months * 30} days of Pro</div>
  <p class="blurb">${esc(p.blurb || "")}</p>
  <button class="btn${p.best ? "" : " ghost"}" data-buy="${p.code}">${!enabled() ? "Opens soon" : isPro() && !isOwner() ? "Add " + esc(p.name.toLowerCase()) : "Get " + esc(p.name)}</button></article>`;
}
function ownerCard() {
  if (!isOwner()) return "";
  const ok = [[S.dbOk === true, "Database: run supabase/billing-2026-11.sql in the Supabase SQL editor"], [CARDS.length > 0 || !!PAY.link, "Vercel: set PAY_CARD and PAY_NAME (or PAY_LINK) so students know where to pay"], [!!PAY.telegram, "Vercel: set PAY_TELEGRAM so students can send receipts"], [enabled(), "Vercel: set BILLING=on and redeploy to switch limits and payments on for students"]];
  return `<section class="card"><div class="toolbar"><h2 style="margin:0">Launch checklist</h2><span class="chip">${enabled() ? "Billing is live" : "Students see prices, but nothing is locked or sold yet"}</span></div>
  <ul class="blcheck">${ok.map(([y, t]) => `<li class="${y ? "y" : ""}">${esc(t)}</li>`).join("")}</ul>
  <p class="fine" style="margin-top:10px">Payment requests and manual Pro grants are on the Students page.</p></section>`;
}
function renderBilling() {
  css(); view = "billing";
  try { window.SAT_TRACK_ONCE && window.SAT_TRACK_ONCE("pricing_view"); } catch (e) { }
  const g = P.guaranteeDays, n = fullCount();
  const rows = [
    ["Full adaptive tests", F.m2Free ? `Practice Tests 1 and 2 per section, plus Full SAT 1` : `Module 1 of Practice Tests 1 and 2 per section, plus Full SAT 1`, F.m2Free ? `All ${n} section tests and ${satCount()} Full SATs, plus Challenge Test and Fresh mix` : `Module 2 and your score on every test: all ${n} section tests and ${satCount()} Full SATs, plus Challenge Test and Fresh mix`],
    ["Drills", F.drillsPerDay ? `${F.drillsPerDay} a day` : "Not included", "Unlimited"],
    ["AI-written tests and weak-skill drills", "Not included", "Included"],
    ["AI tutor, explanations and score reports", F.aiPerDay ? `${F.aiPerDay} answers a day` : "Not included", `${P.pro.aiPerDay} a day`],
    ["90-Day Course", F.courseWeeks ? `Week ${F.courseWeeks}` : "Not included", "All 12 weeks"],
    ["Quick Practice, calculator, word bank, progress", "Included", "Included"],
  ];
  shell(`<div class="stack">
  <section class="blhero"><span class="chip">SAT Studio Pro</span>
    <h1>Every test, every drill, a tutor on every question.</h1>
    <p class="muted">Sitting the SAT costs about $111 each time. Pro is the practice that makes one sitting enough: ${n} full adaptive section tests, unlimited drills, and AI explaining every question you miss.</p></section>
  ${ownerCard()}${enabled() ? statusCard() : `<section class="card blstat ok"><div class="grow"><b>Free during launch</b><span class="muted">Right now everything in SAT Studio is open to everyone at no cost. These are the prices for when Pro opens; the free plan below stays free after that.</span></div></section>`}
  <section><div class="blplans">${P.plans.map(planCard).join("")}</div>
    <p class="blnote">${P.founding ? esc(P.foundingNote) + ". " : ""}One payment, no auto-renewal, nothing to cancel.${g ? ` Not for you? Tell us within ${g} days and we send the money back.` : ""}</p></section>
  <section class="blstage"><div class="bls-blob a" aria-hidden="true"></div><div class="bls-blob b" aria-hidden="true"></div><div class="bls-grain" aria-hidden="true"></div>
    <div class="bls-head"><span class="bls-eyebrow">SAT Studio Pro</span><h2>Free and Pro, side by side</h2></div>
    <div class="blvs" role="table" style="grid-template-rows:repeat(${rows.length + 2},auto)" aria-label="Free and Pro, side by side">
      <div class="blvs-dull" aria-hidden="true"></div><div class="blvs-glow" aria-hidden="true"></div>
      <div class="blvs-h gap" role="presentation"></div>
      <div class="blvs-h free" role="columnheader">Free</div>
      <div class="blvs-h pro" role="columnheader"><span class="blvs-badge">${CROWN}Pro</span><small>Everything unlocked</small></div>
      ${rows.map((r, n) => `<div class="blvs-l rv" style="--d:${n * 80}ms" role="rowheader">${esc(r[0])}</div><div class="blvs-c free rv" style="--d:${n * 80 + 40}ms" role="cell"><i aria-hidden="true">${r[1] === "Not included" ? NO : DOT}</i><span>${esc(r[1])}</span></div><div class="blvs-c pro rv" style="--d:${n * 80 + 80}ms" role="cell"><i aria-hidden="true">${TICK}</i><span>${esc(r[2])}</span></div>`).join("")}
      <div class="blvs-f gap" role="presentation"></div>
      <div class="blvs-f free" role="cell">Free, no time limit</div>
      <div class="blvs-f pro" role="cell"><button class="blvs-cta" data-buy="${bestPlan().code}">Get ${esc(bestPlan().name)}</button></div>
    </div></section>
  <section class="card blfaq"><h2>Questions</h2>
    <details><summary>How do I pay?</summary><p>Choose a plan, send the amount from Payme, Click, Uzum or any bank app to the card shown, then press "I've paid". We check the transfer and switch Pro on, usually the same day.</p></details>
    <details><summary>Will I be charged again?</summary><p>No. You pay once for a fixed number of days. When they run out you go back to the free plan and keep all your scores and history.</p></details>
    <details><summary>What if I buy again while Pro is still active?</summary><p>The new days are added after the ones you already have, so you never lose time.</p></details>
    ${g ? `<details><summary>Can I get my money back?</summary><p>Yes. If Pro isn't what you expected, message us within ${g} days of paying and we return the full amount to your card.</p></details>` : ""}
    <details><summary>Is the free plan really free?</summary><p>${F.m2Free ? `Yes, with no time limit. You can sit two full tests in each section, a Full SAT, ${F.drillsPerDay ? F.drillsPerDay + " drills a day and " : ""}all of Quick Practice without paying.` : `Yes, with no time limit. You can take Module 1 of the free tests as often as you like, plus ${F.drillsPerDay ? F.drillsPerDay + " drills a day and " : ""}all of Quick Practice, without paying. Module 2 and your score are Pro.`}</p></details>
  </section></div>`);
  $$("[data-buy]").forEach(b => b.onclick = () => buy(b.dataset.buy));
  const stg = $(".blstage");   // the comparison fades in row by row when it scrolls into view
  if (stg) { if (!("IntersectionObserver" in window)) stg.classList.add("in"); else { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { stg.classList.add("in"); io.disconnect(); } }, { threshold: .15 }); io.observe(stg); } }
  const re = $("#blRe"); if (re) re.onclick = async () => { re.disabled = true; await refresh(); const b = $("#blRe"); if (b) { b.disabled = false; b.textContent = "Still checking"; } };
  if (!S.loaded || (S.last && S.last.status === "pending" && Date.now() - lastRefresh > 15000)) refresh();
}

/* ---------- Pay sheet ---------- */
async function buy(code) {
  const p = P.plans.find(x => x.code === code); if (!p) return;
  try { window.SAT_TRACK && window.SAT_TRACK("plan_click", code); } catch (e) { }
  const pr = priceOf(p);
  if (!enabled()) {
    sheet(`<span class="chip">${esc(p.name)} · ${money(pr)}</span><h2 id="shT" style="margin-top:12px">Pro isn't open yet</h2><p class="muted">You don't need it today: every test, drill and lesson is free during launch. When Pro opens, this is the price you'll see here.</p>
    <div class="actions"><button class="btn" id="blNo">Keep practicing</button></div>`);
    $("#blNo").onclick = closeSheet; return;
  }
  if (!signedIn()) {
    sheet(`<h2 id="shT">Create your free account first</h2><p class="muted">Pro is attached to your account, so it follows you to every device. It takes ten seconds.</p>
    <div class="actions"><button class="btn" id="blIn">Sign in or create account</button><button class="btn link" id="blNo">Cancel</button></div>`);
    $("#blIn").onclick = () => PF.signIn && PF.signIn(); $("#blNo").onclick = closeSheet; return;
  }
  if (!CARDS.length && !PAY.link) {
    sheet(`<h2 id="shT">Payments open soon</h2><p class="muted">We're finishing the payment setup. ${PAY.telegram ? "Message us on Telegram and we'll switch Pro on for you by hand." : "Check back in a day or two."}</p>
    <div class="actions">${tgBtn("Message us on Telegram", "", `SAT Studio Pro: ${p.name}, ${money(pr)}`)}<button class="btn link" id="blNo">Close</button></div>`);
    $("#blNo").onclick = closeSheet; return;
  }
  let email = ""; try { const ses = await PF.getSession(); email = (ses && ses.user && ses.user.email) || ""; } catch (e) { }
  const receipt = `SAT Studio Pro: ${p.name}, ${money(pr)}.${email ? " Account: " + email : ""}`;
  sheet(`<span class="chip">${esc(p.name)} · ${p.months * 30} days</span><h2 id="shT" style="margin-top:12px">Pay ${money(pr)}</h2>
  <ol class="blsteps">
    <li><div><b>Send ${money(pr)}</b><span>From Payme, Click, Uzum or any bank app.</span>
      ${CARDS.map((c, i) => `<div class="blcard"><code>${esc(c.card)}</code><button class="btn sm ghost" data-copy="${i}">Copy</button></div>${c.name ? `<span>Card holder: <b style="display:inline;color:var(--ink)">${esc(c.name)}</b>. Check the name before you confirm.</span>` : ""}`).join("")}
      ${PAY.link ? `<div style="margin-top:8px"><a class="btn sm" href="${esc(PAY.link)}" target="_blank" rel="noopener">Open payment page</a></div>` : ""}</div></li>
    ${PAY.telegram ? `<li><div><b>Send us the receipt</b><span>A screenshot on Telegram lets us find your transfer in minutes.</span><div style="margin-top:8px">${tgBtn("Open Telegram", "sm ghost", receipt)}</div></div></li>` : ""}
    <li><div><b>Tell us you've paid</b><span>Name on the card you paid from, so we can match it.</span>
      <input class="blin" id="blNote" maxlength="80" placeholder="For example: Karimov Ali" autocomplete="cc-name"></div></li>
  </ol>
  <p class="blmsg" id="blMsg" role="status" aria-live="polite"></p>
  <div class="actions"><button class="btn" id="blPaid">I've paid</button><button class="btn link" id="blNo">Cancel</button></div>
  <p class="fine" style="margin-top:12px">Pro switches on after we confirm the transfer, usually the same day.${P.guaranteeDays ? ` ${P.guaranteeDays}-day money-back promise.` : ""}</p>
  <div class="blpar"><span>Does a parent pay?</span><a class="btn sm ghost" id="blPar" href="${esc(parentUrl(p, email))}" target="_blank" rel="noopener">Send this to a parent</a></div>`);
  $$("[data-copy]").forEach(cp => cp.onclick = async () => { try { await navigator.clipboard.writeText(CARDS[+cp.dataset.copy].card.replace(/\s+/g, "")); cp.textContent = "Copied"; } catch (e) { cp.textContent = "Select and copy"; } });
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

/* ---------- Module 1 gate: free students finish Module 1, then Module 2 and the score are Pro ---------- */
const completedFull = () => HISTORY.filter(r => r.kind === "full").length;
function gateApplies(t) {
  if (!enabled() || isPro() || !t || t.kind !== "full" || t.mod !== 0) return false;
  const l = LIBID[t.libId]; if (l && (l.book || l.mbook || l.redo)) return false;
  return completedFull() >= (F.m2Free || 0);
}
const bestPlan = () => P.plans.find(p => p.best) || P.plans[0];
const L2 = (uz, en) => (window.UZ ? window.UZ(uz, en) : en);
/* A ready-to-send Telegram message for a parent: what it is, what it costs, where to send it, and which account it is for. */
function parentText(p, email) {
  const pr = money(priceOf(p)), days = p.months * 30;
  const list = sep => CARDS.map(c => c.card + (c.name ? " (" + c.name + ")" : "")).join(sep);
  const pay = CARDS.length ? L2(`To‘lov: ${list(" yoki ")}, Payme, Click yoki Uzum orqali.`, `Pay to card ${list(" or ")} with Payme, Click or Uzum.`) : "";
  const ref = email ? L2(`Izohga yoki chekka ${email} ni yozing.`, `Put ${email} in the note or on the receipt.`) : "";
  const tg = PAY.telegram ? L2(`Chekni @${PAY.telegram} ga yuboring.`, `Send the receipt to @${PAY.telegram}.`) : "";
  return [L2(`Assalomu alaykum! Men SAT Studio ilovasida SAT imtihoniga tayyorlanyapman. Davom etish uchun Pro tarif kerak: ${pr}, ${days} kun, bir martalik to‘lov, o‘zi yechilmaydi.`, `Hi! I'm preparing for the SAT in SAT Studio and need Pro to keep going: ${pr} for ${days} days, one payment, no auto-renewal.`), pay, ref, tg].filter(Boolean).join(" ");
}
const parentUrl = (p, email) => "https://t.me/share/url?url=" + encodeURIComponent(location.origin + "/welcome") + "&text=" + encodeURIComponent(parentText(p, email));

function drawGate(t, cb) {
  css();
  const m1 = t.modules[0], n = m1.qs.length, got = m1.ok.filter(Boolean).length, rw = t.sub === "rw", n2 = rw ? 27 : 22, hard = t.route === "hard";
  const best = bestPlan(), pr = priceOf(best), perMonth = Math.round(pr / best.months / 1000) * 1000;
  try { window.SAT_TRACK && window.SAT_TRACK("pricing_view", "m1gate"); } catch (e) { }
  const pro = isPro();
  app.innerHTML = `<div class="gen blgate"><span class="chip">Module 1 done</span>
    <h1>${got} of ${n} correct in Module 1</h1>
    <p class="muted bl-route">${hard ? "You earned the harder Module 2. That is the route where scores above about 600 are possible." : "Your Module 2 is ready at the easier level. Finish it to see your score and which skills cost you points."}</p>
    <ul class="blgl">
      <li><i aria-hidden="true">${LOCK}</i><div><b>Module 2</b><span>${n2} questions, built from your Module 1</span></div></li>
      <li><i aria-hidden="true">${LOCK}</i><div><b>Your score</b><span>An estimate on the 200 to 800 scale</span></div></li>
      <li><i aria-hidden="true">${LOCK}</i><div><b>Your score report</b><span>Every skill, and every mistake explained</span></div></li>
    </ul>
    <section class="card blgp"><div><b>${esc(best.name)}</b><span class="muted">${money(pr)}${best.months > 1 ? " · " + money(perMonth) + " a month" : ""}</span></div><p class="fine">One payment, no auto-renewal. Pay by Payme, Click or Uzum card transfer.${P.guaranteeDays ? ` ${P.guaranteeDays}-day money-back promise.` : ""}</p></section>
    <div class="actions" style="margin-top:18px">${pro ? `<button class="btn" id="gNext">Continue to Module 2</button>` : `<button class="btn" id="gBuy">Unlock Module 2</button><a class="btn ghost" id="gPar" target="_blank" rel="noopener" href="${esc(parentUrl(best, ""))}">Send to a parent</a>`}<button class="btn link" id="gLater">Not now</button></div>
    <p class="fine" style="margin-top:14px">Your Module 1 answers are saved. Come back any time and Module 2 will be waiting.</p></div>`;
  const b = $("#gNext"); if (b) b.onclick = () => cb.next();
  $("#gLater").onclick = () => cb.later();
  if (pro) return;
  $("#gBuy").onclick = () => {
    try { window.SAT_TRACK && window.SAT_TRACK("plan_click", "m1gate"); } catch (e) { }
    cb.leave(); go("billing"); buy(best.code);
  };
  // The share link carries the student's account email, so a parent can name it on the transfer.
  const par = $("#gPar");
  if (par && PF.getSession) PF.getSession().then(ses => { const em = ses && ses.user && ses.user.email; const a = $("#gPar"); if (em && a) a.href = parentUrl(best, em); }).catch(() => { });
  $("#gBuy").focus();
}
const TICK = '<svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="9.25" fill="none" stroke="#111" stroke-width="1"/><path d="M6 10.3l2.8 2.8 5.2-5.8" fill="none" stroke="#111" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const DOT = '<svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="2" fill="#6F675A"/></svg>';
const NO = '<svg viewBox="0 0 20 20" width="20" height="20"><path d="M6 6l8 8M14 6l-8 8" stroke="#6F675A" stroke-width="1.4" stroke-linecap="round"/></svg>';
const CROWN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5z" fill="#111"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

/* ---------- strips shown inside the app ---------- */
function homeStrip() {
  if (!enabled() || isPro() || !HISTORY.length) return "";
  const left = Math.max(0, F.drillsPerDay - drillsToday());
  return `<section class="resume"><div class="info"><b>Free plan</b><div class="muted" style="font-size:.9rem">${F.drillsPerDay ? `${left} of ${F.drillsPerDay} drills left today · ` : ""}${F.aiPerDay ? `${F.aiPerDay} AI answers a day · ` : ""}Module 1 of the free tests</div></div><div class="actions"><button class="btn sm" data-bill>See Pro</button></div></section>`;
}
function resultStrip(rec) {
  if (!enabled() || isPro() || !rec || !Array.isArray(rec.items)) return "";
  const missed = rec.items.filter(i => !i.ok), skills = new Set(missed.map(i => i.s)).size;
  if (missed.length < 3) return "";
  return `<section class="resume"><div class="info"><b>You missed ${missed.length} questions across ${skills} skill${skills === 1 ? "" : "s"}</b><div class="muted" style="font-size:.9rem">Pro turns that list into practice: unlimited drills on each skill, AI-written questions on your weakest ones, and ${P.pro.aiPerDay} AI explanations a day.</div></div><div class="actions"><button class="btn sm" data-bill>See Pro</button></div></section>`;
}
const lockBadge = l => { const w = lockOf(l); return w === "drills" ? `<span class="lockb">Back tomorrow</span>` : w ? `<span class="lockb">Pro</span>` : ""; };
const navItem = () => { const pro = enabled() && isPro() && !isOwner(), l = !enabled() ? "Pricing" : pro ? "Pro plan" : "Go Pro"; return [["billing", l, ICON_PRO, pro ? "Pro" : l]]; };
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

window.BILL = { enabled, visible, isPro, refresh, lockOf, guard, paywall, gateApplies, drawGate, buy, courseLocked, lockBadge, homeStrip, resultStrip, navItem, render: renderBilling, adminPanel, state: S };
})();
