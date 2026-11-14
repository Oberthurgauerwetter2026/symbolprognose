export interface PhotoPushDevice { endpoint: string; p256dh: string; auth: string }

/** Only browser push services may be contacted; never arbitrary admin-provided URLs. */
export function validatePhotoPushDevice(device: PhotoPushDevice): PhotoPushDevice {
  const url = new URL(device.endpoint);
  const hosts = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
  const allowed = hosts.includes(url.hostname) || url.hostname.endsWith(".push.apple.com") || url.hostname.endsWith(".notify.windows.com");
  if (url.protocol !== "https:" || !allowed || url.port || url.username || url.password || device.endpoint.length > 1000) {
    throw new Error("Ungültiger Benachrichtigungsdienst.");
  }
  const decode = (key: string) => {
    if (typeof key !== "string" || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(key)) throw new Error("Ungültige Geräteanmeldung.");
    const b64 = key.replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/");
    try { return atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)); } catch { throw new Error("Ungültige Geräteanmeldung."); }
  };
  const urlSafe = (key: string) => key.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const publicKey = decode(device.p256dh);
  if (publicKey.length !== 65 || publicKey.charCodeAt(0) !== 4 || decode(device.auth).length !== 16) {
    throw new Error("Ungültige Geräteanmeldung.");
  }
  return { endpoint: url.href, p256dh: urlSafe(device.p256dh), auth: urlSafe(device.auth) };
}

export function photoPushPayload(photo: { id: string; author: string; place: string; note: string }) {
  return {
    title: "📸 Neues Leserfoto eingegangen",
    body: [`Von ${photo.author}${photo.place ? ` aus ${photo.place}` : ""}`, photo.note].filter(Boolean).join(" · ").slice(0, 200),
    url: "/admin-ticker",
    tag: `leserfoto-${photo.id}`,
  };
}