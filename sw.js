const CACHE_NAME = 'general-app-v4.3.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/hazmat-db.js?v=4.3.0',
  './js/state.js?v=4.3.0',
  './js/risk-engine.js?v=4.3.0',
  './js/logistics-planner.js?v=4.3.0',
  './js/ai-predictive.js?v=4.3.0',
  './js/ai-copilot.js?v=4.3.0',
  './js/map.js?v=4.3.0',
  './js/notifications.js?v=4.3.0',
  './js/transshipment.js?v=4.3.0',
  './js/rca-investigation.js?v=4.3.0',
  './js/report-pdf.js?v=4.3.0',
  './js/app.js?v=4.3.0',
  './js/pwa.js?v=4.3.0',
  './js/hazmat-db.js',
  './js/state.js',
  './js/risk-engine.js',
  './js/logistics-planner.js',
  './js/ai-predictive.js',
  './js/ai-copilot.js',
  './js/map.js',
  './js/notifications.js',
  './js/transshipment.js',
  './js/rca-investigation.js',
  './js/report-pdf.js',
  './js/app.js',
  './js/pwa.js',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          ASSETS_TO_CACHE.map(url => 
            cache.add(url).catch(err => console.warn(`Falha ao cachear ${url}:`, err))
          )
        );
      })
  );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia de requisições (Network with Cache Fallback)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Atualiza em segundo plano se houver conexão
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, networkResponse.clone());
                });
              }
            })
            .catch(() => {/* silencia falhas de rede se offline */});
          return cachedResponse;
        }

        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            return response;
          })
          .catch(() => {
            // Se for navegação principal e falhar a rede, retorna index.html cacheado
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html') || caches.match('./');
            }
          });
      })
  );
});

