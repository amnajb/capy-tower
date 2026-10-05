// Capy Tower service worker: makes the game installable and lets solo climbs
// run offline. Network-first for the game's own files, so a deploy shows up on
// the next launch; the cache is only the fallback when there's no signal.
// The race server (ws) and anything cross-origin except fonts pass straight through.
const CACHE = 'capy-tower-v3';  // bump when the SHELL list changes
const SHELL = [
  './', 'index.html', 'style.css', 'manifest.json',
  'js/main.js', 'js/game.js', 'js/world.js', 'js/characters.js', 'js/hud.js',
  'js/audio.js', 'js/net.js', 'js/tower.js', 'js/mobile.js', 'js/maps.js',
  'music/tracks.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !fonts) return;
  if (url.origin === location.origin && !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (url.pathname.endsWith('/ws') || /\.(mp4|webm)$/.test(url.pathname)) return;   // race server, ending videos

  if (fonts) {
    // fonts never change: cache first
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    })));
    return;
  }
  e.respondWith((async () => {
    try {
      const res = await Promise.race([fetch(req), timeout(4000)]);
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('index.html');
      throw err;
    }
  })());
});
