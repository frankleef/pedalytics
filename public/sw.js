// Service Worker — Kesto
const CACHE_NAME = "pedalytics-v2";
const STATIC_ASSETS = ["/", "/manifest.json"];

// Installeren — cache statische assets
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activeren — oude caches verwijderen
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, cache fallback
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notificatie ontvangen
self.addEventListener("push", event => {
  const data = event.data?.json() ?? {};
  const title = data.title || "Kesto";
  const options = {
    body: data.body || "Je hebt een nieuwe melding",
    icon: "/icons/kesto-icon-192.png",
    badge: "/icons/kesto-icon-192.png",
    tag: data.tag || "pedalytics",
    data: { url: data.url || "/" },
    actions: data.actions || [],
    vibrate: [100, 50, 100],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notificatie klik — open of focus de app op de deep link URL
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.focus();
          client.postMessage({ type: "NAVIGATE", url });
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
