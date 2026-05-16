importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// Paste your Firebase config values here
firebase.initializeApp({
  apiKey: "AIzaSyAdlNzP5mFxBah5dFc6obMKnnsZS2ZSMiE",
  authDomain: "tastefynotification.firebaseapp.com",
  projectId: "tastefynotification",
  storageBucket: "tastefynotification.firebasestorage.app",
  messagingSenderId: "359263653084",
  appId: "1:359263653084:web:6f8f1f3b35c4d27b76f819"
});

const messaging = firebase.messaging();

// This handles background notifications
messaging.onBackgroundMessage(function (payload) {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});