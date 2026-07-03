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
    icon: payload.notification?.icon || '/logo.png',
    badge: '/logo.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
