// DWTP service worker: shows push notifications and opens the right screen when tapped.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "DWTP", body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || "DWTP", {
    body: data.body || "", icon: "/brand/icon-192.png", badge: "/brand/icon-192.png", data: { url: data.url || "/today" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/today";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if ("focus" in c) { await c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  })());
});
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
