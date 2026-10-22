const CACHE = 'hotem-v4';
const SHARE = 'hotem-share';
const SHELL = ['./', 'index.html', 'pdf.worker.min.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== SHARE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

// Files shared from another app (e.g. WhatsApp) arrive here as a POST; keep them and open the app on them.
async function receiveShare(request) {
  const scope = self.registration.scope;
  try {
    const form = await request.formData();
    const c = await caches.open(SHARE);
    for (const k of await c.keys()) await c.delete(k);
    let i = 0;
    for (const f of form.getAll('file')) {
      if (!f || typeof f === 'string') continue;
      await c.put(new URL(`shared/${i++}`, scope).href, new Response(f, { headers: { 'content-type': f.type || 'application/octet-stream', 'x-name': encodeURIComponent(f.name || 'מסמך') } }));
    }
  } catch (e) {}
  return Response.redirect(new URL('./?shared=1', scope).href, 303);
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) { e.respondWith(receiveShare(e.request)); return; }
  if (e.request.method !== 'GET') return;
  const isPage = e.request.mode === 'navigate';
  if (isPage) {
    // the app page: network first so updates arrive, cache when offline
    e.respondWith(fetch(e.request).then(res => { const copy = res.clone(); if (res.ok) caches.open(CACHE).then(c => c.put('index.html', copy)); return res; })
      .catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: isPage }).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && (url.origin === self.location.origin || /fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(url.host))) {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy));
    }
    return res;
  }).catch(() => caches.match('index.html'))));
});
