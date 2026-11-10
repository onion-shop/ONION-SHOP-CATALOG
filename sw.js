/* sw.js: кэш браузера, чтобы при повторном заходе сайт и фото открывались мгновенно.
   Страница, каталог и настройки: сначала сеть (всегда свежие), без сети берутся из кэша.
   Фото и картинки: сразу из кэша, а свежая копия тихо докачивается для следующего раза.
   Скрипты и стили с отпечатком ?v=: из кэша (при новой сборке отпечаток меняется). Запросы к серверу заказов не трогаем. */
var V = 'onion-92';
var IMG = 'onion-img';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('onion-') === 0 && k !== V && k !== IMG; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function put(name, req, res) {
  if (!res || !res.ok || res.type === 'opaque') return;
  var copy = res.clone();
  caches.open(name).then(function (c) { c.put(req, copy); }).catch(function () { });
}
function networkFirst(req) {
  return fetch(req).then(function (res) { put(V, req, res); return res; })
    .catch(function () { return caches.match(req).then(function (hit) { return hit || Response.error(); }); });
}
function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) { put(V, req, res); return res; });
  });
}
function staleWhileRevalidate(req) {
  return caches.open(IMG).then(function (c) {
    return c.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res && res.ok) c.put(req, res.clone()).catch(function () { }); return res; });
      if (hit) { net.catch(function () { }); return hit; }
      return net;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var u = new URL(req.url);
  if (u.origin !== self.location.origin) return;
  var p = u.pathname;
  if (/\/img\/(thumb|full)\//.test(p) || /\/assets\/.*\.(png|jpe?g|svg|webp)$/.test(p)) { e.respondWith(staleWhileRevalidate(req)); return; }
  if (/\/assets\/.*\.(js|css)$/.test(p) && /[?&]v=/.test(u.search) && !/config(\.demo)?\.js$/.test(p)) { e.respondWith(cacheFirst(req)); return; }
  if (req.mode === 'navigate' || /\.(html|js|css|json|webmanifest)$/.test(p) || p.slice(-1) === '/') { e.respondWith(networkFirst(req)); return; }
});
