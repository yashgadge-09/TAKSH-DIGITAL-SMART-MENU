self.addEventListener("push", (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = {};
    }
  }

  const title = data.title || "Taksh Pure Veg \ud83c\udf7d\ufe0f";
  const options = {
    body:
      data.body ||
      "How was your meal today? Tell us about your favourite dish!",
    icon: data.icon || "/logo.png",
    badge: data.badge || "/badge.png",
    data: {
      url: data.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  const targetUrl = event.notification?.data?.url || "/";
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.endsWith(targetUrl)) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
