/* Service Worker nur für Wetterwarn-Push (kein App-Caching). */
/* Versionskennung: bei Änderung erneuert sich der Worker sofort. */
const SW_VERSION = "2026-09-10-2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      console.info("[push-sw] aktiv", SW_VERSION);
    })(),
  ),
);

const FALLBACK_URL = "https://www.oberthurgauerwetter.ch/warnkarte/";

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Wetterwarnung", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "Wetterwarnung Oberthurgau";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      tag: payload.tag || "wetterwarnung",
      data: { url: payload.url || FALLBACK_URL },
      icon: payload.icon || "/icon-192.png",
      badge: "/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || FALLBACK_URL;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
