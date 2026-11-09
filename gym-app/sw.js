// Service worker: guarda la app para que funcione sin conexión.
// Estrategia: primero red (para tener siempre la última versión) y, si no hay
// conexión o tarda más de 3 s, la copia guardada.
// Si añades archivos nuevos, inclúyelos en FILES y sube la versión de CACHE.
const CACHE = 'gymlog-v4'
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'lib/dexie.js', 'lib/chart.umd.min.js',
  'js/app.js', 'js/ui.js', 'js/config.js',
  'js/data/db.js', 'js/data/repo.js', 'js/data/seed.js', 'js/data/stats.js', 'js/data/cloud.js',
  'js/views/train.js', 'js/views/history.js', 'js/views/progress.js', 'js/views/stats.js',
  'js/views/records.js', 'js/views/ranking.js', 'js/views/profile.js', 'js/views/friends.js',
  'js/views/exercises.js', 'js/views/bodyweight.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Librerías de Firebase (versión fija): primero caché, para que la app arranque sin conexión
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req)
      if (hit) return hit
      const res = await fetch(req)
      if (res.ok) cache.put(req, res.clone())
      return res
    }))
    return
  }
  if (url.origin !== location.origin) return
  e.respondWith((async () => {
    const cache = await caches.open(CACHE)
    try {
      const res = await Promise.race([
        fetch(req),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ])
      if (res.ok) cache.put(req, res.clone())
      return res
    } catch {
      return (await cache.match(req, { ignoreSearch: true })) || Response.error()
    }
  })())
})
