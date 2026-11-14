/* 美术生的倒计时 · Service Worker
   策略：页面走「网络优先」，拿不到网就回落到缓存 —— 既能离线用，又能每次联网拿到最新版。 */
const VERSION = 'sc-v4';
const SHELL = './index.html';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(c => c.addAll([SHELL, './manifest.webmanifest', './icon-180.png'])).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  /* 配置、集控指令、识别码配置都必须走网络，
     否则后台发布/下发后，设备永远拿到的都是第一次的缓存 */
  const u = new URL(req.url);
  const dynamic = /(config|control)\.json$/i.test(u.pathname) ||
                  u.pathname.indexOf('/codes/') >= 0;
  if (dynamic) {
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req)));
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(SHELL, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(SHELL))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => hit))
  );
});
