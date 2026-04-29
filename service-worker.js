const CACHE_NAME = "ledermair-fahrer-info-v14";
const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.json", "./icon.svg", "./logo.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("fetch", event => {
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
