// Otterpage offline helper (4-nov-2026, Mario: «el niño juega offline»).
// The game and its icons are kept on the device: it opens without internet. With internet, the newest version opens
// straight away; without it, the saved copy. The saved game is never touched here
// (it lives in the device's storage, not in this cache). The voices are kept the first time they are played.
const VERSION = '0.187.87';
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
  // the game page: 6-nov-2026 (Mario: «el artefacto funciona, pero el GitHub… parece que no está arreglado») — with
  // internet the newest version is opened straight away (it used to open the saved copy and update only the next time).
  // If the internet is slow or missing, the saved copy opens after 3 seconds, so the game still works offline.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const net = fetch(req, { cache: 'no-store' }).then((res) => { if (res.ok) c.put('./index.html', res.clone()); return res.ok ? res : null; }).catch(() => null);
      const late = new Promise((ok) => setTimeout(() => ok('late'), 3000));
      const first = await Promise.race([net, late]);
      if (first && first !== 'late') return first;
      return (await c.match('./index.html')) || (await net) || new Response('Offline', { status: 503 });
    })());
    return;
  }
  // icons and the rest: from the device first
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; } catch { return new Response('Offline', { status: 503 }); }
  })());
});
