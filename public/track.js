/* SAT Studio visitor counting. Loaded by the app and by /welcome.
   Each browser gets a random id; the app reports a few named events to the database
   (supabase/tracking-2026-11.sql). No names, emails or IP addresses are stored, and
   nothing is sent to any outside company. Failures are silent: counting must never break the app. */
(function () {
"use strict";
const CFG = window.SAT_CONFIG || {};
const on = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
const KEY = "satstudio_vid", DAY = "satstudio_seen_";
function vid() {
  try {
    let v = localStorage.getItem(KEY);
    if (!/^[a-z0-9]{8,32}$/.test(v || "")) { v = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join(""); localStorage.setItem(KEY, v); }
    return v;
  } catch (e) { return ""; }
}
/* Where this visit came from: a ?utm_source= tag wins, then the referring site, then the in-app browser. */
function source() {
  try {
    const q = new URLSearchParams(location.search).get("utm_source"); if (q) return q;
    const ua = navigator.userAgent || "", ref = document.referrer ? new URL(document.referrer).hostname : "";
    if (/instagram/i.test(ref) || /Instagram/.test(ua)) return "instagram";
    if (/(^|\.)t\.me$|telegram/i.test(ref) || /Telegram/i.test(ua)) return "telegram";
    if (/google\./i.test(ref)) return "google";
    if (/youtube|youtu\.be/i.test(ref)) return "youtube";
    if (!ref || ref === location.hostname) return "direct";
    return ref.replace(/^www\./, "");
  } catch (e) { return "direct"; }
}
let SRC = null;
function track(name, extra) {
  if (!on) return;
  const v = vid(); if (!v) return;
  if (SRC === null) { try { SRC = sessionStorage.getItem("satstudio_src") || source(); sessionStorage.setItem("satstudio_src", SRC); } catch (e) { SRC = source(); } }
  let token = CFG.supabaseAnonKey;
  try { const k = Object.keys(localStorage).find(x => /^sb-.*-auth-token$/.test(x)); const s = k && JSON.parse(localStorage.getItem(k)); if (s && s.access_token && s.expires_at * 1000 > Date.now()) token = s.access_token; } catch (e) { }
  try {
    fetch(CFG.supabaseUrl + "/rest/v1/rpc/track", {
      method: "POST", keepalive: true,
      headers: { "content-type": "application/json", apikey: CFG.supabaseAnonKey, authorization: "Bearer " + token },
      body: JSON.stringify({ p_vid: v, p_name: name, p_src: SRC, p_extra: extra == null ? null : String(extra).slice(0, 40) }),
    }).catch(() => { });
  } catch (e) { }
}
/* Events that should count once per browser per day (a visit is a day's visit, not every page load). */
function once(name, extra) {
  const k = DAY + name, today = new Date().toISOString().slice(0, 10);
  try { if (localStorage.getItem(k) === today) return; localStorage.setItem(k, today); } catch (e) { }
  track(name, extra);
}

/* ---------- Admin: Visitors panel on the Students page ---------- */
async function adminPanel(el) {
  const PF = window.SAT_PLATFORM;
  if (!el || !PF || !PF.rpc) return;
  let d;
  try { d = await PF.rpc("admin_stats", { p_days: 14 }); }
  catch (e) { el.innerHTML = `<section class="card" style="margin-bottom:18px"><h2>Visitors</h2><p class="muted" style="margin:0">Not set up yet. Run <b>supabase/tracking-2026-11.sql</b> in the Supabase SQL editor, then refresh.</p></section>`; return; }
  const t = d.total || {}, days = d.days || [], src = d.sources || [];
  const pc = (a, b) => b ? Math.round(100 * a / b) + "%" : "–";
  const dd = s => { try { return new Date(s + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return s; } };
  const step = (n, label, of) => `<div><b>${n || 0}</b><span>${label}${of != null ? ` · ${pc(n || 0, of)}` : ""}</span></div>`;
  el.innerHTML = `<section class="card" style="margin-bottom:18px"><div class="toolbar"><h2 style="margin:0">Visitors</h2><span class="chip">Last 14 days</span></div>
  <div class="sstats">${step(t.visitors, "visitors")}${step(t.opened_app, "opened the app", t.visitors)}${step(t.started, "started practice", t.opened_app)}${step(t.finished, "finished a round or test", t.started)}${step(t.finished_test, "finished a full test or drill", t.opened_app)}${step(t.returned, "came back another day", t.opened_app)}${step(t.signups, "created an account", t.opened_app)}</div>
  ${src.length ? `<p class="fine" style="margin:0 0 12px">Where they came from: ${src.map(s => `<b>${esc(s.src)}</b> ${s.visitors}`).join(" · ")}</p>` : ""}
  ${days.length ? `<div class="tscroll"><table class="stud"><thead><tr><th>Day</th><th>Visitors</th><th>Opened app</th><th>Started</th><th>Finished</th><th>Tests done</th><th>Sign-ups</th><th>Saw pricing</th></tr></thead><tbody>${days.map(r => `<tr><td>${esc(dd(r.day))}</td><td class="n">${r.visitors}</td><td class="n">${r.opened_app}</td><td class="n">${r.started}</td><td class="n">${r.finished}</td><td class="n">${r.tests_done}</td><td class="n">${r.signups}</td><td class="n">${r.saw_pricing}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted" style="margin:0">No visits recorded yet. Numbers appear here as soon as someone opens the site.</p>`}
  <p class="fine" style="margin-top:12px">A visitor is one browser, counted once a day. Guests are included. No names or emails are collected. Your own visits count too.</p></section>`;
}

window.SAT_TRACK = track;
window.SAT_TRACK_ONCE = once;
window.SAT_TRACK_ADMIN = adminPanel;
/* The visit itself: "landing" on /welcome, "visit" in the app. */
once(/welcome/.test(location.pathname) ? "landing" : "visit");
})();
