// Otterpage offline helper (4-nov-2026, Mario: «el niño juega offline»).
// The game and its icons are kept on the device: it opens without internet. When there is internet, a new version is
// fetched in the background and used the next time the game is opened. The saved game is never touched here
// (it lives in the device's storage, not in this cache). The voices are kept the first time they are played.
const VERSION = '0.187.11';
const CACHE = `otterpage-${VERSION}`;
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = new Set([CACHE, 'otterpage-voices']);
    for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // voices: kept after the first time (big files, not downloaded unless the family turns the voice on)
  if (url.pathname.includes('/voice/')) {
    e.respondWith((async () => {
      const c = await caches.open('otterpage-voices');
      // 6-nov-2026: the small index (.json) is asked for fresh first, so new recordings arrive; it names the audio file,
      // and a new recording has a new file name (the old one is not used any more)
      if (url.pathname.endsWith('.json')) {
        try { const res = await fetch(req, { cache: 'no-store' }); if (res.ok) { c.put(req, res.clone()); return res; } } catch { /* offline */ }
        return (await c.match(req)) || new Response('{}', { status: 503 });
      }
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    })());
    return;
  }
  // the game: from the device first (works offline); the page itself is also refreshed in the background
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await c.match('./index.html') : null);
    const net = fetch(req).then((res) => { if (res.ok && req.mode === 'navigate') c.put('./index.html', res.clone()); return res; }).catch(() => null);
    return hit || (await net) || new Response('Offline', { status: 503 });
  })());
});
