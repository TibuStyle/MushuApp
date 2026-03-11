const CACHE_NAME = 'mushu-cache-v5';
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

// Fuentes externas para cachear
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap',
  'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css'
];

// Install: cachear archivos locales y externos
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Primero los locales (obligatorios)
      return cache.addAll(ASSETS).then(() => {
        // Luego los externos (opcionales, no falla si no hay internet)
        return Promise.allSettled(
          EXTERNAL_ASSETS.map(url => cache.add(url).catch(() => console.log('No se pudo cachear:', url)))
        );
      });
    })
  );
});

// Activate: limpiar cachés antiguos
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

// Fetch: Network First para archivos propios, Cache First para externos
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Para archivos propios: intentar red primero, si falla usar caché
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Si la red responde, actualizar el caché
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Sin red, usar caché
          return caches.match(event.request);
        })
    );
  } else {
    // Para recursos externos (fonts, boxicons): caché primero
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((fetchResponse) => {
          const responseClone = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return fetchResponse;
        }).catch(() => {
          // Sin caché ni red, no hay nada que hacer
          return new Response('', { status: 408 });
        });
      })
    );
  }
});
