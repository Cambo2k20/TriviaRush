"use strict";

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { body: event.data?.text() || "You have a new Trivia Rush alert." };
  }

  const title = payload.title || "Trivia Rush";
  const url = new URL(payload.url || "./", self.registration.scope).toString();
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || "Open Trivia Rush to view it.",
    icon: "icons/trivia-rush-192.png",
    badge: "icons/trivia-rush-192.png",
    tag: payload.tag || "trivia-rush-notification",
    renotify: Boolean(payload.renotify),
    data: { url }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url
    || new URL("./", self.registration.scope).toString();

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const target = new URL(targetUrl);
    const existing = windows.find((client) => new URL(client.url).origin === target.origin);
    if (existing) {
      await existing.navigate(targetUrl);
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl);
  })());
});
