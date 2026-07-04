// Give the service worker access to Firebase Messaging.
// Note: 'importScripts' is only available in a service worker context.
importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's FirebaseConfig.
firebase.initializeApp({
  apiKey: "AIzaSyBc25flBicCmC7ps-fs_LKgwBIwh2puHQs",
  authDomain: "gen-lang-client-0836292212.firebaseapp.com",
  projectId: "gen-lang-client-0836292212",
  storageBucket: "gen-lang-client-0836292212.firebasestorage.app",
  messagingSenderId: "389975625261",
  appId: "1:389975625261:web:eab4ca2094c33084fd72a4"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification?.title || 'TS Price Manager';
  const notificationOptions = {
    body: payload.notification?.body || 'New price update or alert is available.',
    icon: payload.notification?.icon || '/logo(TSPb).png',
    badge: '/logo(TSPb).png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
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

