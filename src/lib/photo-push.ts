export interface PhotoPushDevice { endpoint: string; p256dh: string; auth: string }

/** Only browser push services may be contacted; never arbitrary admin-provided URLs. */
export function validatePhotoPushDevice(device: PhotoPushDevice): PhotoPushDevice {
  const url = new URL(device.endpoint);
  const hosts = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
  const allowed = hosts.includes(url.hostname) || url.hostname.endsWith(".notify.windows.com");
  if (url.protocol !== "https:" || !allowed || url.port || url.username || url.password || device.endpoint.length > 1000) {
    throw new Error("Ungültiger Benachrichtigungsdienst.");
  }
  const decode = (key: string) => {
    if (typeof key !== "string" || !/^[A-Za-z0-9_-]+={0,2}$/.test(key)) throw new Error("Ungültige Geräteanmeldung.");
    return atob(key.replace(/-/g, "+").replace(/_/g, "/"));
  };
  const publicKey = decode(device.p256dh);
  if (publicKey.length !== 65 || publicKey.charCodeAt(0) !== 4 || decode(device.auth).length !== 16) {
    throw new Error("Ungültige Geräteanmeldung.");
  }
  return { endpoint: url.href, p256dh: device.p256dh, auth: device.auth };
}

export function photoPushPayload(photo: { id: string; author: string; place: string; note: string }) {
  return {
    title: "📸 Neues Leserfoto eingegangen",
    body: [`Von ${photo.author}${photo.place ? ` aus ${photo.place}` : ""}`, photo.note].filter(Boolean).join(" · ").slice(0, 200),
    url: "/admin-ticker",
    tag: `leserfoto-${photo.id}`,
  };
}