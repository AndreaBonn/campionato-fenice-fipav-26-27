const VERSION = "dev";
// VERSION is stamped at deploy with a hash of the app files (fenice-stamp-sw), so every
// release changes this file's bytes: that is the only way the browser notices an update.
//
// Network first: FIPAV data must never be served stale while online.
// The cache only answers when the network fails, e.g. no signal inside the gym.
// Cache Storage is per origin, shared by every GitHub Pages repo of the account: activate
// deletes only this app's older caches, never the other apps'.
const CACHE_PREFIX = "fenice-fipav-";
const CACHE = `${CACHE_PREFIX}${VERSION}`;
const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "update.js",
  "update-rules.js",
  "install.js",
  "install-rules.js",
  "nav.js",
  "nav-rules.js",
  "share.js",
  "hero-rules.js",
  "schedule-rules.js",
  "icons.js",
  "view-rules.js",
  "game-rules.js",
  "games-view.js",
  "html.js",
  "calendar-rules.js",
  "standings-rules.js",
  "standings-math.js",
  "standings-notes.js",
  "tables-view.js",
  "team-rules.js",
  "opponent-rules.js",
  "opponent-view.js",
  "fenice-rules.js",
  "analysis-view.js",
  "notices-view.js",
  "logo-fenice.png",
  "manifest.webmanifest",
  "favicon.ico",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  // cache: "reload" bypasses the HTTP cache, which could still hold the previous release
  const requests = SHELL.map((url) => new Request(url, { cache: "reload" }));
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(requests)));
  // no skipWaiting here: a new version waits until the user accepts it from the page
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    // revalidate: the HTTP cache (GitHub Pages sends max-age=600) could mix two releases
    fetch(request, { cache: "no-cache" })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
        }
        return response;
      })
      // offline and never cached: a network error, which the page reports as a connection problem
      .catch(() => caches.match(request).then((cached) => cached || Response.error())),
  );
});
