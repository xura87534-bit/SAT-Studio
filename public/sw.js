// Offline support: the app shell is cached; pages load network-first so updates arrive right away.
const CACHE = "sat-studio-v2";
const SHELL = ["/", "/platform.js", "/config.js", "/vendor/supabase.js", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  if (sameOrigin && url.pathname.startsWith("/api/")) return;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !isFont) return; // Supabase and other APIs go straight to the network
  // Only navigations to the app itself share the "/" cache entry; other pages (like /welcome) cache under their own URL.
  const navKey = req.mode === "navigate" && (url.pathname === "/" || url.pathname === "/index.html") ? "/" : req;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok || res.type === "opaque") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(navKey, copy));
        }
        return res;
      })
      .catch(() => caches.match(navKey).then((r) => r || Response.error())),
  );
});
