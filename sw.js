// Rompimentos — service worker: deixa o app abrir e funcionar sem sinal.
const APP = 'romp-app-v3';
const TILES = 'romp-tiles-v1';
const MAX_TILES = 2500;
// Arquivos do app guardados no aparelho para abrir sem sinal. Se criar um arquivo novo em css/ ou js/, coloque aqui também.
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
  './css/estilo.css',
  './js/municipios.js', './js/base.js', './js/kml.js', './js/rede.js', './js/mapa.js', './js/marcar.js',
  './js/pesquisa.js', './js/geral.js', './js/dados.js', './js/firebase.js', './js/inicio.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== APP && k !== TILES).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

let trimming = false;
async function trimTiles(cache) {
  if (trimming) return; trimming = true;
  try {
    const keys = await cache.keys();
    if (keys.length > MAX_TILES) for (const k of keys.slice(0, keys.length - MAX_TILES)) await cache.delete(k);
  } finally { trimming = false; }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Login e banco (Google/Firebase): não interferir. O Firestore tem o próprio modo offline.
  if (url.hostname.endsWith('firebaseapp.com') ||
      (url.hostname.endsWith('googleapis.com') && url.hostname !== 'fonts.googleapis.com') ||
      url.hostname.endsWith('google.com')) return;

  // Páginas e arquivos do próprio site: tenta a rede primeiro (pega atualizações), cai no cache sem sinal.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(APP).then(c => c.put(req, copy)); }
        return r;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Fundo do mapa (ruas/satélite): cache primeiro, guarda o que já foi visto.
  if (url.hostname.endsWith('arcgisonline.com')) {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const r = await fetch(req);
        if (r.ok) { c.put(req, r.clone()); trimTiles(c); }
        return r;
      } catch (_) { return Response.error(); }
    }));
    return;
  }

  // Bibliotecas e fontes (Leaflet, JSZip, Firebase, Google Fonts): cache primeiro.
  if (/(^|\.)cdnjs\.cloudflare\.com$|(^|\.)gstatic\.com$|^fonts\.googleapis\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(APP).then(c => c.put(req, copy)); }
      return r;
    })));
  }
});
