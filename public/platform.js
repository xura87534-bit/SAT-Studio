/* SAT Studio platform layer.
   The app was built for the claude.ai runtime and asks for features through
   window.claude.use(name). This file provides the same interface on our own stack:
     user   -> Supabase Auth (Google or email magic link)
     db     -> Supabase Postgres tables "docs" and "students" (row-level security)
     sample -> /api/claude, a Vercel function that calls the Claude API
   Anything that fails (offline, signed out) resolves to null and the app falls
   back to saving in this browser, which it already supports. */
(function () {
  "use strict";
  const CFG = window.SAT_CONFIG || {};
  const hasBackend = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
  const sb = hasBackend
    ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
      })
    : null;
  const OFFLINE_KEY = "satstudio_offline_mode";
  const err = (code, message) => Object.assign(new Error(message || code), { code });

  /* ---------- Sign-in gate ---------- */
  let sessionP = null;
  function getSession() {
    if (!sb) return Promise.resolve(null);
    if (!sessionP) sessionP = waitForSession();
    return sessionP;
  }
  async function waitForSession() {
    let s = null;
    try { s = (await sb.auth.getSession()).data.session; } catch (e) {}
    if (s) return s;
    try { if (localStorage.getItem(OFFLINE_KEY) === "1") return null; } catch (e) {}
    if (!navigator.onLine) return null;
    return new Promise((resolve) => {
      const done = (v) => { gate && gate.remove(); resolve(v); };
      const gate = showGate(done);
      sb.auth.onAuthStateChange((_ev, sess) => { if (sess) done(sess); });
    });
  }
  function showGate(done) {
    const g = document.createElement("div");
    g.id = "gate";
    g.innerHTML = `<div class="gbox">
      <h2>Welcome to SAT Studio</h2>
      <p>Sign in so your progress syncs across devices and your teacher can follow along.</p>
      <button class="btn" id="pfGoogle" style="width:100%;justify-content:center;margin-bottom:14px">Continue with Google</button>
      <form id="pfMail"><input id="pfEmail" type="email" required placeholder="you@example.com" autocomplete="email">
      <button class="btn ghost" style="width:100%;justify-content:center">Email me a sign-in link</button></form>
      <p class="fine" id="pfMsg" role="status" style="margin:12px auto 0"></p>
      <button class="btn link" id="pfOff">Use offline on this device instead</button></div>`;
    document.body.appendChild(g);
    const msg = (t) => { g.querySelector("#pfMsg").textContent = t; };
    const redirectTo = location.origin + location.pathname;
    g.querySelector("#pfGoogle").onclick = async () => {
      const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
      if (error) msg(error.message);
    };
    g.querySelector("#pfMail").onsubmit = async (e) => {
      e.preventDefault();
      const email = g.querySelector("#pfEmail").value.trim();
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
      msg(error ? error.message : "Check your inbox for the sign-in link. You can close this tab after clicking it.");
    };
    g.querySelector("#pfOff").onclick = () => {
      try { localStorage.setItem(OFFLINE_KEY, "1"); } catch (e) {}
      done(null);
    };
    return g;
  }

  /* ---------- user ---------- */
  function makeUser(session) {
    const u = session.user;
    const name = (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || "";
    let ownerP = null;
    return {
      async id() { return u.id; },
      async me() { return { id: u.id, name, email: u.email }; },
      async isOwner() {
        if (!ownerP) ownerP = sb.rpc("is_admin").then(({ data }) => !!data, () => false);
        return ownerP;
      },
      async profiles() { return {}; }, // names come from the students table
    };
  }

  /* ---------- db: Firestore-like surface over two tables ---------- */
  function snap(rows) {
    return { docs: rows.map((r) => ({ id: r.id, exists: true, data: () => r.data })) };
  }
  function check({ error }) { if (error) throw err("db_error", error.message); }
  function makeDb(session) {
    const uid = session.user.id;
    function collection(path) {
      if (path === "data/users/" + uid) {
        return {
          async get() {
            const res = await sb.from("docs").select("id,data").eq("user_id", uid);
            check(res);
            return snap(res.data);
          },
          doc: (id) => ({
            async set(data) {
              check(await sb.from("docs").upsert({ user_id: uid, id, data, updated_at: new Date().toISOString() }));
            },
            async delete() { check(await sb.from("docs").delete().eq("user_id", uid).eq("id", id)); },
          }),
        };
      }
      if (path === "students") {
        return {
          async get() { // admins see every row, students only their own (enforced by RLS)
            const res = await sb.from("students").select("user_id,data");
            check(res);
            return snap(res.data.map((r) => ({ id: r.user_id, data: r.data })));
          },
          doc: (id) => ({
            async set(data) {
              if (id !== uid) throw err("forbidden");
              check(await sb.from("students").upsert({ user_id: uid, data, updated_at: new Date().toISOString() }));
            },
            async delete() { throw err("forbidden"); },
          }),
        };
      }
      throw err("unknown_collection", path);
    }
    return { collection };
  }

  /* ---------- sample: Claude through our server ---------- */
  async function callClaude(prompt, opts, json) {
    const { data } = await sb.auth.getSession();
    const token = data.session && data.session.access_token;
    if (!token) throw err("not_granted", "Sign in to use Claude.");
    let res;
    try {
      res = await fetch("/api/claude", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + token },
        body: JSON.stringify({ prompt: String(prompt), json }),
        signal: opts && opts.signal,
      });
    } catch (e) {
      if (e && e.name === "AbortError") throw e;
      throw err("network", "Can't reach the server. Check your connection.");
    }
    if (res.status === 429) throw err("rate_limited", (await res.text()) || "Daily Claude limit reached.");
    if (res.status === 401) throw err("not_granted", "Sign in again to use Claude.");
    if (!res.ok || !res.body) throw err("server", (await res.text().catch(() => "")) || "Claude request failed.");
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let text = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += value;
      if (opts && opts.onText) { try { opts.onText({ text }); } catch (e) {} }
    }
    if (text.includes("\u0000ERR:")) throw err("server", text.split("\u0000ERR:")[1]);
    return text;
  }
  function parseJson(text) {
    const t = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    try { return JSON.parse(t); } catch (e) {}
    const a = t.search(/[\[{]/), b = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
    throw err("bad", "Claude returned something that isn't valid JSON.");
  }
  function makeSample() {
    const AI = (prompt, opts) => callClaude(prompt, opts, false);
    AI.json = async (prompt, opts) => parseJson(await callClaude(prompt, opts, true));
    return AI;
  }

  /* ---------- window.claude.use ---------- */
  async function use(name) {
    const s = await getSession();
    if (!s) return null;
    if (name === "user") return makeUser(s);
    if (name === "db") return makeDb(s);
    if (name === "sample") return makeSample();
    return null; // downloads/permissions: the app has browser fallbacks
  }
  async function signOut() {
    if (sb) await sb.auth.signOut();
    // Clear this browser's copy so the next person to sign in doesn't inherit (and upload) it.
    try {
      Object.keys(localStorage).filter((k) => /^(satmath_|satstudio_)/.test(k)).forEach((k) => localStorage.removeItem(k));
    } catch (e) {}
    location.reload();
  }
  function signIn() {
    try { localStorage.removeItem(OFFLINE_KEY); } catch (e) {}
    location.reload();
  }

  if (hasBackend) window.claude = { use };
  window.SAT_PLATFORM = { signOut, signIn, hasBackend, getSession };

  /* ---------- PWA ---------- */
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
})();
