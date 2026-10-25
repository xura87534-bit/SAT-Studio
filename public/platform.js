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
  /* Sign-in screen. Email + password works with Supabase's built-in email limits
     (no email is sent when "Confirm email" is off). Google appears only when the
     provider is actually enabled in Supabase, so students never see a dead button. */
  const GATE_CSS = `
#pfGate{--pf-ink:#14161a;--pf-ink2:#2a2e35;--pf-dim:#677080;--pf-line:rgba(20,22,26,.12);--pf-gold:#f2d34b;--pf-gold-d:#c9a227;--pf-red:#c2412f;
  position:fixed;inset:0;z-index:400;overflow:auto;color:var(--pf-ink);font:15px/1.5 "Geist",ui-sans-serif,system-ui,-apple-system,sans-serif;
  background:radial-gradient(120% 70% at 70% 0%,#f4f6f9 0%,transparent 60%),radial-gradient(90% 60% at 20% 100%,#b8c4d2 0%,transparent 70%),linear-gradient(180deg,#dfe6ee 0%,#d3dbe4 55%,#c9d3de 100%);
  display:grid;place-items:center;padding:max(24px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));-webkit-font-smoothing:antialiased}
#pfGate *{box-sizing:border-box}
#pfGate .pf-cloud{position:fixed;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.9),rgba(255,255,255,0));filter:blur(8px);pointer-events:none;animation:pfDrift 40s linear infinite}
#pfGate .pf-c1{width:80vw;height:30vh;left:-20vw;bottom:-10vh}#pfGate .pf-c2{width:60vw;height:24vh;right:-20vw;top:8vh;animation-direction:reverse}
@keyframes pfDrift{from{transform:translateX(-5vw)}to{transform:translateX(5vw)}}
#pfGate .pf-card{position:relative;width:100%;max-width:420px;background:rgba(255,255,255,.78);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.9);border-radius:24px;padding:30px 28px 24px;box-shadow:0 40px 80px -40px rgba(20,30,50,.45);animation:pfIn .8s cubic-bezier(.16,1,.3,1)}
@keyframes pfIn{from{opacity:0;transform:translateY(14px);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
#pfGate .pf-logo{display:flex;align-items:center;gap:9px;font:500 .78rem "Geist Mono",ui-monospace,monospace;letter-spacing:.22em}
#pfGate .pf-logo svg{width:22px;height:22px}
#pfGate h2{font:400 2.5rem/1 "Instrument Serif",Georgia,serif;letter-spacing:-.02em;margin:22px 0 6px;color:var(--pf-ink)}
#pfGate h2 em{color:#5d6675}
#pfGate .pf-sub{color:var(--pf-dim);margin:0 0 20px;font-size:.92rem}
#pfGate .pf-tabs{display:grid;grid-template-columns:1fr 1fr;background:rgba(20,22,26,.06);border-radius:12px;padding:4px;margin-bottom:18px}
#pfGate .pf-tab{border:0;background:transparent;border-radius:9px;padding:9px;font:500 .88rem inherit;font-family:inherit;color:var(--pf-dim);cursor:pointer;transition:background .25s,color .25s}
#pfGate .pf-tab[aria-selected="true"]{background:#fff;color:var(--pf-ink);box-shadow:0 2px 8px -4px rgba(20,30,50,.3)}
#pfGate label{display:block;font-size:.8rem;font-weight:500;color:var(--pf-ink2);margin:0 0 6px}
#pfGate .pf-field{margin-bottom:14px;position:relative}
#pfGate input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--pf-line);background:#fff;color:var(--pf-ink);font:500 16px/1.2 inherit;font-family:inherit;outline:none;transition:border-color .2s,box-shadow .2s;margin:0}
#pfGate input:focus{border-color:var(--pf-ink);box-shadow:0 0 0 3px rgba(20,22,26,.08)}
#pfGate input[aria-invalid="true"]{border-color:var(--pf-red)}
#pfGate .pf-eye{position:absolute;right:8px;bottom:7px;border:0;background:transparent;font:500 .74rem "Geist Mono",monospace;color:var(--pf-dim);padding:6px 8px;border-radius:8px;cursor:pointer}
#pfGate .pf-eye:hover{color:var(--pf-ink);background:rgba(20,22,26,.05)}
#pfGate .pf-hint{font-size:.76rem;color:var(--pf-dim);margin-top:6px}
#pfGate .pf-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;border:0;border-radius:999px;padding:13px 18px;font:600 .95rem inherit;font-family:inherit;cursor:pointer;transition:transform .3s cubic-bezier(.16,1,.3,1),box-shadow .3s,opacity .2s}
#pfGate .pf-primary{background:var(--pf-gold);color:var(--pf-ink);box-shadow:0 10px 30px -12px rgba(201,162,39,.85);margin-top:6px}
#pfGate .pf-primary:hover{transform:translateY(-1px)}
#pfGate .pf-primary[disabled]{opacity:.6;cursor:progress;transform:none}
#pfGate .pf-google{background:#fff;color:var(--pf-ink);border:1px solid var(--pf-line)}
#pfGate .pf-google:hover{background:#f6f7f9}
#pfGate .pf-google svg{width:18px;height:18px}
#pfGate .pf-or{display:flex;align-items:center;gap:12px;color:var(--pf-dim);font-size:.74rem;margin:16px 0}
#pfGate .pf-or::before,#pfGate .pf-or::after{content:"";flex:1;height:1px;background:var(--pf-line)}
#pfGate .pf-msg{min-height:1.4em;margin:12px 0 0;font-size:.84rem;color:var(--pf-dim)}
#pfGate .pf-msg.err{color:var(--pf-red)}#pfGate .pf-msg.ok{color:#2f7a3d}
#pfGate .pf-off{display:block;margin:14px auto 0;border:0;background:transparent;color:var(--pf-dim);font:500 .82rem inherit;font-family:inherit;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
#pfGate .pf-off:hover{color:var(--pf-ink)}
#pfGate .pf-by{margin:18px 0 0;padding-top:14px;border-top:1px solid var(--pf-line);text-align:center;font-size:.78rem;color:var(--pf-dim)}
#pfGate .pf-by em{font:400 1.15em "Instrument Serif",Georgia,serif;color:var(--pf-ink)}
#pfGate .pf-spin{width:16px;height:16px;border-radius:50%;border:2px solid rgba(20,22,26,.25);border-top-color:var(--pf-ink);animation:pfSpin .7s linear infinite}
@keyframes pfSpin{to{transform:rotate(360deg)}}
#pfGate :focus-visible{outline:2px solid var(--pf-ink);outline-offset:2px}
@media (prefers-reduced-motion:reduce){#pfGate .pf-cloud,#pfGate .pf-card{animation:none}}`;

  function friendly(error) {
    const m = String((error && (error.message || error.msg)) || error || "").toLowerCase();
    if (m.includes("invalid login credentials")) return "That email and password don't match. Check them or create an account.";
    if (m.includes("email not confirmed")) return "This account still needs email confirmation. Ask your teacher to turn off email confirmation, then try again.";
    if (m.includes("already registered") || m.includes("already been registered")) return "An account with this email already exists. Switch to Sign in.";
    if (m.includes("password") && (m.includes("at least") || m.includes("short") || m.includes("weak"))) return "Use a password with at least 6 characters.";
    if (m.includes("valid email") || m.includes("invalid email") || m.includes("unable to validate email")) return "Enter a valid email address, like name@gmail.com.";
    if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a minute and try again.";
    if (m.includes("provider is not enabled")) return "Google sign-in isn't available yet. Use email and password.";
    if (m.includes("failed to fetch") || m.includes("network")) return "Can't reach the server. Check your connection, or use offline mode.";
    return (error && error.message) || "Something went wrong. Try again.";
  }

  function showGate(done) {
    if (!document.getElementById("pfGateCss")) {
      const st = document.createElement("style"); st.id = "pfGateCss"; st.textContent = GATE_CSS; document.head.appendChild(st);
      if (!document.querySelector('link[href*="Instrument+Serif"]')) {
        const fl = document.createElement("link"); fl.rel = "stylesheet";
        fl.href = "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@500&family=Instrument+Serif:ital@0;1&display=swap";
        document.head.appendChild(fl);
      }
    }
    const g = document.createElement("div");
    g.id = "pfGate";
    g.setAttribute("role", "dialog"); g.setAttribute("aria-modal", "true"); g.setAttribute("aria-labelledby", "pfTitle");
    g.innerHTML = `<i class="pf-cloud pf-c1"></i><i class="pf-cloud pf-c2"></i>
      <div class="pf-card">
        <div class="pf-logo"><svg viewBox="0 0 24 24" fill="none" stroke="#14161a" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M2 9.5 12 5l10 4.5-10 4.5L2 9.5Z"/><path d="M6.5 11.6V16c0 1.3 2.5 2.6 5.5 2.6s5.5-1.3 5.5-2.6v-4.4"/><path d="M21 10v5" stroke-linecap="round"/></svg>SAT STUDIO</div>
        <h2 id="pfTitle">Welcome <em>back.</em></h2>
        <p class="pf-sub" id="pfSub">Sign in to keep your scores and progress synced on every device.</p>
        <div class="pf-tabs" role="tablist">
          <button class="pf-tab" type="button" role="tab" id="pfTabIn" aria-selected="true">Sign in</button>
          <button class="pf-tab" type="button" role="tab" id="pfTabUp" aria-selected="false">Create account</button>
        </div>
        <div id="pfGoogleWrap" hidden>
          <button class="pf-btn pf-google" type="button" id="pfGoogle"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.9-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6C6.6 42.6 14.6 48 24 48z"/></svg>Continue with Google</button>
          <div class="pf-or">or</div>
        </div>
        <form id="pfForm" novalidate>
          <div class="pf-field" id="pfNameRow" hidden><label for="pfName">Your name</label><input id="pfName" type="text" autocomplete="name" placeholder="Ali Karimov"></div>
          <div class="pf-field"><label for="pfEmail">Email</label><input id="pfEmail" type="email" autocomplete="email" inputmode="email" placeholder="you@gmail.com" required></div>
          <div class="pf-field"><label for="pfPass">Password</label><input id="pfPass" type="password" autocomplete="current-password" placeholder="At least 6 characters" required minlength="6"><button class="pf-eye" type="button" id="pfEye" aria-label="Show password">Show</button></div>
          <button class="pf-btn pf-primary" type="submit" id="pfSubmit">Sign in</button>
          <p class="pf-msg" id="pfMsg" role="status" aria-live="polite"></p>
        </form>
        <button class="pf-off" type="button" id="pfOff">Use offline on this device instead</button>
        <p class="pf-by">Created by <em>Xurshid Jo’rayev</em></p>
      </div>`;
    document.body.appendChild(g);
    const $ = (id) => g.querySelector("#" + id);
    let mode = "in";
    const msg = (t, kind) => { const m = $("pfMsg"); m.textContent = t || ""; m.className = "pf-msg" + (kind ? " " + kind : ""); };
    function setMode(m) {
      mode = m;
      const up = m === "up";
      $("pfTabIn").setAttribute("aria-selected", String(!up)); $("pfTabUp").setAttribute("aria-selected", String(up));
      $("pfNameRow").hidden = !up;
      $("pfTitle").innerHTML = up ? "Start <em>here.</em>" : "Welcome <em>back.</em>";
      $("pfSub").textContent = up ? "Create a free account. It takes ten seconds and your progress follows you everywhere." : "Sign in to keep your scores and progress synced on every device.";
      $("pfSubmit").textContent = up ? "Create account" : "Sign in";
      $("pfPass").setAttribute("autocomplete", up ? "new-password" : "current-password");
      msg("");
    }
    $("pfTabIn").onclick = () => setMode("in");
    $("pfTabUp").onclick = () => setMode("up");
    $("pfEye").onclick = () => { const p = $("pfPass"), show = p.type === "password"; p.type = show ? "text" : "password"; $("pfEye").textContent = show ? "Hide" : "Show"; $("pfEye").setAttribute("aria-label", show ? "Hide password" : "Show password"); };
    const busy = (on) => { const b = $("pfSubmit"); b.disabled = on; b.innerHTML = on ? '<span class="pf-spin"></span>' + (mode === "up" ? "Creating account" : "Signing in") : (mode === "up" ? "Create account" : "Sign in"); };

    $("pfForm").onsubmit = async (e) => {
      e.preventDefault();
      const email = $("pfEmail").value.trim(), password = $("pfPass").value, name = $("pfName").value.trim();
      $("pfEmail").removeAttribute("aria-invalid"); $("pfPass").removeAttribute("aria-invalid");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $("pfEmail").setAttribute("aria-invalid", "true"); $("pfEmail").focus(); return msg("Enter a valid email address, like name@gmail.com.", "err"); }
      if (password.length < 6) { $("pfPass").setAttribute("aria-invalid", "true"); $("pfPass").focus(); return msg("Use a password with at least 6 characters.", "err"); }
      busy(true); msg("");
      try {
        if (mode === "up") {
          const { data, error } = await sb.auth.signUp({ email, password, options: { data: name ? { full_name: name } : {} } });
          if (error) throw error;
          if (!data.session) {
            // Email confirmation is still on in Supabase, and the built-in mailer only reaches the project team.
            console.warn("[SAT Studio] Sign-up needs email confirmation. Turn off Authentication → Sign In / Providers → Email → Confirm email in Supabase.");
            busy(false);
            return msg("Account created, but it needs email confirmation before you can sign in. Ask your teacher to turn it off, or use offline mode for now.", "err");
          }
          msg("Account created. Opening SAT Studio…", "ok");
        } else {
          const { error } = await sb.auth.signInWithPassword({ email, password });
          if (error) throw error;
          msg("Signed in. Opening SAT Studio…", "ok");
        }
      } catch (er) { busy(false); msg(friendly(er), "err"); }
    };

    $("pfGoogle").onclick = async () => {
      const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
      if (error) msg(friendly(error), "err");
    };
    // Show Google only when it's switched on in Supabase.
    fetch(CFG.supabaseUrl + "/auth/v1/settings", { headers: { apikey: CFG.supabaseAnonKey } })
      .then((r) => r.json()).then((s) => { if (s && s.external && s.external.google) $("pfGoogleWrap").hidden = false; }).catch(() => {});

    $("pfOff").onclick = () => {
      try { localStorage.setItem(OFFLINE_KEY, "1"); } catch (e) {}
      done(null);
    };
    setTimeout(() => { try { $("pfEmail").focus({ preventScroll: true }); } catch (e) {} }, 300);
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
    if (name === "sample") return CFG.ai ? makeSample() : null;
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
  window.SAT_PLATFORM = { signOut, signIn, hasBackend, getSession, ai: !!CFG.ai, signedIn: false };
  if (sb) sb.auth.getSession().then(({ data }) => { window.SAT_PLATFORM.signedIn = !!data.session; }, () => {});

  /* ---------- PWA ---------- */
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
})();
