const CACHE_NAME = 'mushu-cache-v7';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './mushu_logo.png',
  './icon-192.png',
  './icon-512.png'
];

const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap',
  'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).then(() => {
        return Promise.allSettled(
          EXTERNAL_ASSETS.map(url =>
            cache.add(url).catch(() => console.log('No se pudo cachear:', url))
          )
        );
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((fetchResponse) => {
          const responseClone = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return fetchResponse;
        }).catch(() => {
          return new Response('', { status: 408 });
        });
      })
    );
  }
});
