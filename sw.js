const APP_CACHE = "railradar-app-v1";
const TILE_CACHE = "railradar-tiles-v1";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/network.js",
  "./js/sim.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./vendor/leaflet/leaflet.js",
  "./vendor/leaflet/leaflet.css",
  "./vendor/leaflet/images/layers.png",
  "./vendor/leaflet/images/layers-2x.png",
  "./vendor/leaflet/images/marker-icon.png",
  "./vendor/leaflet/images/marker-icon-2x.png",
  "./vendor/leaflet/images/marker-shadow.png"
];
const TILE_HOSTS = [
  "tile.openstreetmap.org",
  "tile.openrailwaymap.org",
  "server.arcgisonline.com"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(APP_CACHE).then((c) => c.addAll(APP_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== APP_CACHE && k !== TILE_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

const TILE_LIMIT = 400;

async function tileCacheFirst(request) {
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res.ok) {
      cache.put(request, res.clone());
      const keys = await cache.keys();
      if (keys.length > TILE_LIMIT) {
        for (const k of keys.slice(0, keys.length - TILE_LIMIT)) cache.delete(k);
      }
    }
    return res;
  } catch (err) {
    return new Response("", { status: 504, statusText: "Offline" });
  }
}

async function appCacheFirst(request) {
  const cache = await caches.open(APP_CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const home = await cache.match("./index.html");
    if (home) return home;
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    if (TILE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith("." + h))) {
      e.respondWith(tileCacheFirst(req));
    }
    return;
  }
  e.respondWith(appCacheFirst(req));
});
