// TS Price Manager Service Worker
const CACHE_NAME = 'ts-price-manager-v6';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo(TSPb).png'
];

// Give the service worker access to Firebase Messaging
importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyBc25flBicCmC7ps-fs_LKgwBIwh2puHQs",
  authDomain: "gen-lang-client-0836292212.firebaseapp.com",
  projectId: "gen-lang-client-0836292212",
  storageBucket: "gen-lang-client-0836292212.firebasestorage.app",
  messagingSenderId: "389975625261",
  appId: "1:389975625261:web:eab4ca2094c33084fd72a4"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'TS Price Manager';
  const notificationOptions = {
    body: payload.notification?.body || 'New price update or alert is available.',
    icon: payload.notification?.icon || '/logo(TSPb).png',
    badge: '/logo(TSPb).png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Install event - caching static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event - cleaning old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event with safe-routing to skip API & Firebase requests
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // CRITICAL: NEVER intercept or cache external Google API, Firebase, FCM, or local server API endpoints
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebase')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached resource immediately, and asynchronously refresh the cache in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Ignore background fetch errors (e.g. offline)
          });
        return cachedResponse;
      }

      // If not in cache, fetch from network
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((error) => {
          // If offline and requesting a page navigation, fallback to /index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          throw error;
        });
    })
  );
});

// Handle notification click event to open or focus the app window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Extract target URL from notification data
  let targetUrl = self.location.origin;
  if (event.notification.data) {
    // Standard FCM payload format or custom data object
    if (event.notification.data.url) {
      targetUrl = event.notification.data.url;
    } else if (event.notification.data.link) {
      targetUrl = event.notification.data.link;
    } else if (event.notification.data.FCM_MSG && event.notification.data.FCM_MSG.notification && event.notification.data.FCM_MSG.notification.click_action) {
      targetUrl = event.notification.data.FCM_MSG.notification.click_action;
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Find an existing client window/tab
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if (client.navigate) {
            client.navigate(targetUrl).catch(err => console.error('Failed to navigate client:', err));
          }
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

