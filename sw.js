
const CACHE_NAME = 'miaaula-v15.20.10-offline';

// Files to cache immediately on install.
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './index.css',
  './manifest.json',
  './vite.svg',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
  'https://aistudiocdn.com/react@^19.2.0',
  'https://aistudiocdn.com/react-dom@^19.2.0',
  'https://aistudiocdn.com/use-strict@^1.0.1',
  'https://aistudiocdn.com/@google/genai@^0.15.0',
  './index.tsx',
  './App.tsx',
  './types.ts',
  './contexts/QuestionContext.tsx',
  './contexts/SettingsContext.tsx',
  './contexts/FlashcardContext.tsx',
  './contexts/TopicContext.tsx',
  './contexts/LiteralnessContext.tsx',
  './contexts/TrailContext.tsx',
  './contexts/sample-data.ts',
  './contexts/flashcard-sample-data.ts',
  './services/srsService.ts',
  './services/queueBuilder.ts',
  './services/pairMatchService.ts',
  './components/icons.tsx',
  './components/Header.tsx',
  './components/SideBar.tsx',
  './components/LoadingState.tsx',
  './components/ConfirmationModal.tsx',
  './components/MasteryBadge.tsx',
  './components/InfoTooltip.tsx',
  './components/Pagination.tsx',
  './views/TodayView.tsx',
  './views/StudyView.tsx',
  './views/FlashcardsView.tsx',
  './views/SettingsView.tsx',
  './views/ProfileView.tsx',
  './views/AddQuestionView.tsx'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching assets...');
      return Promise.all(
        PRECACHE_ASSETS.map(url => 
            cache.add(url).catch(e => console.warn(`[SW] Failed to cache ${url}:`, e))
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

const isApiCall = (url) => {
    return url.href.includes('googleapis.com') || 
           url.href.includes('google-analytics.com');
};

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!req || !req.url) return;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }

  if (isApiCall(url)) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, networkRes.clone());
            return networkRes;
          });
        })
        .catch(() => {
          return caches.match('./index.html');
        })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      let cachedResponse = await cache.match(req);
      if (!cachedResponse && url.origin === self.location.origin && !url.pathname.includes('.')) {
          cachedResponse = await cache.match(req.url + '.tsx') || await cache.match(req.url + '.ts');
      }
      if (cachedResponse) return cachedResponse;
      try {
          const networkResponse = await fetch(req);
          if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
              cache.put(req, networkResponse.clone());
          }
          return networkResponse;
      } catch (error) {
          throw error;
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL(self.location.origin).href;

  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      if (client.url === urlToOpen && 'focus' in client) {
        return client.focus();
      }
    }
    if (clients.openWindow) return clients.openWindow(urlToOpen);
  });

  event.waitUntil(promiseChain);
});
