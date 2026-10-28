/* Timesheet app: offline support.
   Online: always loads the newest version from GitHub and keeps a copy.
   Offline (or very slow signal): opens the saved copy. */
var CACHE = "timesheet-offline-v1";

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(["./", "./index.html"]);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(new Promise(function (resolve) {
    var settled = false;
    function fromCache() {
      return caches.match(req, { ignoreSearch: true }).then(function (m) {
        return m || caches.match("./index.html");
      });
    }
    // If the network is slow (4 seconds), use the saved copy instead of waiting.
    var timer = setTimeout(function () {
      fromCache().then(function (m) { if (m && !settled) { settled = true; resolve(m); } });
    }, 4000);

    fetch(req).then(function (resp) {
      clearTimeout(timer);
      var copy = resp.clone();
      if (resp && resp.status === 200) {
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      if (!settled) { settled = true; resolve(resp); }
    }).catch(function () {
      clearTimeout(timer);
      if (settled) return;
      fromCache().then(function (m) {
        settled = true;
        resolve(m || new Response("You are offline and the app has not been saved yet. Open it once with internet.", { status: 503, headers: { "Content-Type": "text/plain" } }));
      });
    });
  }));
});
