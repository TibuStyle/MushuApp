const CACHE_NAME = 'mushu-cache-v12';
const DYNAMIC_CACHE = 'mushuapp-dynamic-v4.0'; 
const STATIC_CACHE = 'mushuapp-static-v4.0';   
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './mushu_logo.png',
  './icon-192.png',
  './icon-512.png',
  './boxicons.min.css'
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
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Manejo de peticiones
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Dominios de Firebase que NO se deben cachear
  const FIREBASE_DOMAINS = [
    'firebaseio.com',
    'googleapis.com',
    'gstatic.com',
    'identitytoolkit.googleapis.com',
    'firebaseapp.com',
    'firebase.googleapis.com'
  ];
  
  // Si la petición es a Firebase, NO cachear
  if (FIREBASE_DOMAINS.some(domain => url.href.includes(domain))) {
    event.respondWith(fetch(request));
    return;
  }
  
  // NO cachear peticiones POST, PUT, DELETE, PATCH
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }
  
  // Estrategia Network First para peticiones GET
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Si la respuesta es válida, clonar y guardar en caché
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseClone).catch((err) => {
              console.log('No se pudo cachear:', request.url, err);
            });
          });
        }
        
        return response;
      })
      .catch(() => {
        // Si falla la red, buscar en caché
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Si no hay caché, devolver página offline básica
          return new Response('Sin conexión', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
  );
});
