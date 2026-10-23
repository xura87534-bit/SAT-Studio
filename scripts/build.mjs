// Vercel build step: writes public/config.js from environment variables and
// copies the Supabase browser bundle so the app needs no third-party CDN.
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";

const cfg = {
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
};
if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) console.warn("SUPABASE_URL / SUPABASE_ANON_KEY not set: the app will run in offline-only mode.");
writeFileSync("public/config.js", `window.SAT_CONFIG=${JSON.stringify(cfg)};\n`);
mkdirSync("public/vendor", { recursive: true });
copyFileSync("node_modules/@supabase/supabase-js/dist/umd/supabase.js", "public/vendor/supabase.js");
console.log("Built config.js and vendor/supabase.js");
