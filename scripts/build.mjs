// Vercel build step: writes public/config.js from environment variables, copies the
// Supabase browser bundle (no third-party CDN), and stamps a strict Content-Security-Policy
// into each HTML page with SHA-256 hashes of its inline scripts.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const cfg = {
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  ai: !!process.env.ANTHROPIC_API_KEY, // Claude features stay hidden until a key is added
  turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || "", // optional CAPTCHA on sign-in / sign-up
};
if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) console.warn("SUPABASE_URL / SUPABASE_ANON_KEY not set: the app will run in offline-only mode.");
writeFileSync("public/config.js", `window.SAT_CONFIG=${JSON.stringify(cfg)};\n`);
mkdirSync("public/vendor", { recursive: true });
copyFileSync("node_modules/@supabase/supabase-js/dist/umd/supabase.js", "public/vendor/supabase.js");

// ---- Content-Security-Policy ----
const supa = cfg.supabaseUrl ? new URL(cfg.supabaseUrl).origin : "";
const captcha = cfg.turnstileSiteKey ? "https://challenges.cloudflare.com" : "";
const CSP_RE = /<meta http-equiv="Content-Security-Policy"[^>]*>\n?/;
function stamp(file) {
  let html = readFileSync(file, "utf8").replace(CSP_RE, "");
  const hashes = [];
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/application\/ld\+json/.test(m[1]) || !m[2]) continue; // data blocks aren't executed
    hashes.push(`'sha256-${createHash("sha256").update(m[2], "utf8").digest("base64")}'`);
  }
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(" ")} ${captcha}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    `connect-src 'self' ${supa} ${supa.replace("https://", "wss://")} https://fonts.googleapis.com https://fonts.gstatic.com`.replace(/\s+/g, " ").trim(),
    `frame-src ${captcha || "'none'"}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  html = html.replace(/<head>\n?/, (h) => `${h}<meta http-equiv="Content-Security-Policy" content="${csp}">\n`);
  writeFileSync(file, html);
  return hashes.length;
}
for (const f of ["public/index.html", "public/welcome.html"]) console.log(`CSP: ${f} (${stamp(f)} inline scripts hashed)`);
console.log("Built config.js and vendor/supabase.js");
