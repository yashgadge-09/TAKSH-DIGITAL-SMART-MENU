// v2
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

self.addEventListener('fetch', function (event) { });

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

firebase.initializeApp({
  apiKey: "AIzaSyAdlNzP5mFxBah5dFc6obMKnnsZS2ZSMiE",
  authDomain: "tastefynotification.firebaseapp.com",
  projectId: "tastefynotification",
  storageBucket: "tastefynotification.firebasestorage.app",
  messagingSenderId: "359263653084",
  appId: "1:359263653084:web:6f8f1f3b35c4d27b76f819"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const notificationTitle = payload.notification?.title || 'Taksh Restaurant';
  const notificationOptions = {
    body: payload.notification?.body || 'Tap to leave a review!',
    icon: '/apple-icon.png',
    badge: '/apple-icon.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: payload.data || {}
  };
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url;
  if (url) {
    event.waitUntil(clients.openWindow(url));
  }
});