// Minimal service worker whose only job is showing push notifications sent
// by the reminders cron route. No offline caching — that's a separate
// concern this app doesn't need yet.

self.addEventListener("push", (event) => {
  let payload = { title: "Proudly", body: "Time to check in.", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // fall back to the default payload above
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(self.clients.openWindow(url));
});
