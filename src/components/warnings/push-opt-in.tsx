/**
 * Web-Push-Anmeldung für Wetterwarnungen.
 * Registriert den Service Worker erst auf Nutzeraktion.
 */

import { useEffect, useState } from "react";
import { BellOff, BellRing, Loader2 } from "lucide-react";
import { REGIONS } from "@/lib/warnings-config";
import { getPushPublicKey, savePushSubscription, removePushSubscription } from "@/lib/warnings.functions";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToB64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function PushOptIn({ defaultRegionId }: { defaultRegionId?: string | null }) {
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [regionIds, setRegionIds] = useState<string[]>(() => REGIONS.map((r) => r.id));

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window,
    );
    navigator.serviceWorker?.getRegistration("/push-sw.js").then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(Boolean(sub));
    });
  }, []);

  useEffect(() => {
    if (defaultRegionId) setRegionIds([defaultRegionId]);
  }, [defaultRegionId]);

  const toggleRegion = (id: string) =>
    setRegionIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  async function subscribe() {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Benachrichtigungen wurden nicht erlaubt.");
      const { publicKey } = await getPushPublicKey();
      if (!publicKey) throw new Error("Push ist auf dem Server nicht konfiguriert.");
      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));
      await savePushSubscription({
        data: {
          endpoint: sub.endpoint,
          p256dh: bufToB64(sub.getKey("p256dh")),
          auth: bufToB64(sub.getKey("auth")),
          regionIds: regionIds.length ? regionIds : REGIONS.map((r) => r.id),
        },
      });
      setSubscribed(true);
      setMsg("Benachrichtigungen aktiviert.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Aktivierung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMsg("Benachrichtigungen deaktiviert.");
    } catch {
      setMsg("Deaktivierung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Dieser Browser unterstützt keine Push-Benachrichtigungen.
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs text-muted-foreground">
        Erhalte eine Meldung, sobald für deine Gemeinden eine Warnung ausgegeben wird.
      </p>
      {!subscribed && (
        <div className="max-h-32 overflow-y-auto rounded-md border border-border p-2">
          <div className="flex flex-wrap gap-1">
            {REGIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleRegion(r.id)}
                className={
                  "rounded px-1.5 py-0.5 text-[10px] " +
                  (regionIds.includes(r.id)
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground")
                }
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={subscribed ? unsubscribe : subscribe}
        className="flex w-full items-center justify-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : subscribed ? (
          <BellOff className="h-3.5 w-3.5" />
        ) : (
          <BellRing className="h-3.5 w-3.5" />
        )}
        {subscribed ? "Benachrichtigungen ausschalten" : "Benachrichtigungen aktivieren"}
      </button>
      {msg && <p className="text-[11px] text-muted-foreground">{msg}</p>}
    </div>
  );
}
