import { useEffect, useState } from "react";
import { BellOff, BellRing, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPushPublicKey } from "@/lib/warnings.functions";
import { getPhotoPushStatus, setPhotoPushDevice, testPhotoPush } from "@/lib/photo-push.functions";
import type { PhotoPushDevice } from "@/lib/photo-push";

function deviceKeys(sub: PushSubscription): PhotoPushDevice {
  const encode = (key: "p256dh" | "auth") => {
    const value = sub.getKey(key);
    if (!value) throw new Error("Geräteanmeldung unvollständig.");
    return btoa(String.fromCharCode(...new Uint8Array(value)));
  };
  return { endpoint: sub.endpoint, p256dh: encode("p256dh"), auth: encode("auth") };
}

export function PhotoPushOptIn({ password }: { password: string }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");
  const [limitation, setLimitation] = useState("");

  useEffect(() => {
    let live = true;
    const check = async () => {
      if (window.self !== window.top) {
        setLimitation("Bitte den Admin-Ticker in einem eigenen Browser-Tab öffnen.");
      } else if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches) {
        setLimitation("Auf dem iPhone zuerst zum Home-Bildschirm hinzufügen und von dort öffnen.");
      } else if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setLimitation("Dieser Browser unterstützt keine Benachrichtigungen. Bitte Safari, Chrome, Edge oder Firefox verwenden.");
      } else {
        try {
          const registration = await navigator.serviceWorker.getRegistration("/push-sw.js");
          const sub = await registration?.pushManager.getSubscription();
          if (sub) {
            const status = await getPhotoPushStatus({ data: { password, device: deviceKeys(sub) } });
            if (live) setEnabled(status.enabled);
          }
        } catch {
          if (live) setMessage("Geräteanmeldung konnte nicht geprüft werden. Bitte erneut versuchen.");
        }
      }
      if (live) setChecking(false);
    };
    void check();
    return () => { live = false; };
  }, [password]);

  const act = async (test = false) => {
    setBusy(true); setMessage("");
    try {
      if (test || enabled) {
        const registration = await navigator.serviceWorker.getRegistration("/push-sw.js");
        const sub = await registration?.pushManager.getSubscription();
        if (!sub) { setEnabled(false); throw new Error("Bitte Benachrichtigungen erneut aktivieren."); }
        const device = deviceKeys(sub);
        if (test) {
          await testPhotoPush({ data: { password, device } });
          setMessage("Testnachricht versendet.");
        } else {
          await setPhotoPushDevice({ data: { password, device, enabled: false } });
          // Do not unsubscribe the shared worker: weather-warning subscriptions stay active.
          setEnabled(false); setMessage("Leserfoto-Benachrichtigungen auf diesem Gerät ausgeschaltet.");
        }
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error(permission === "denied"
        ? "Benachrichtigungen sind blockiert. Bitte in den Website-Einstellungen erlauben."
        : "Bitte die Abfrage für Benachrichtigungen erlauben.");
      const { publicKey } = await getPushPublicKey();
      if (!publicKey) throw new Error("Benachrichtigungen sind noch nicht eingerichtet.");
      const registration = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;
      const raw = atob(publicKey.replace(/-/g, "+").replace(/_/g, "/"));
      const key = Uint8Array.from(raw, (char) => char.charCodeAt(0));
      const sub = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await setPhotoPushDevice({ data: { password, device: deviceKeys(sub), enabled: true } });
      setEnabled(true); setMessage("Neue Leserfotos werden auf diesem Gerät gemeldet.");
    } catch (error) {
      setMessage(error instanceof DOMException
        ? "Der Browser konnte Benachrichtigungen nicht aktivieren. Bitte den veröffentlichten Admin-Ticker öffnen und Benachrichtigungen in den Website-Einstellungen erlauben."
        : error instanceof Error ? error.message : "Aktivierung fehlgeschlagen.");
    } finally { setBusy(false); }
  };

  return (
    <section className="space-y-3 border-y border-border py-4" aria-label="Leserfoto-Benachrichtigungen">
      <div className="flex items-center gap-2 font-semibold"><BellRing className="size-4 text-accent" /> Neue Leserfotos</div>
      {limitation ? <p className="text-sm text-muted-foreground">{limitation}</p> : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={enabled ? "outline" : "default"} disabled={checking || busy} onClick={() => act()}>
            {busy || checking ? <Loader2 className="animate-spin" /> : enabled ? <BellOff /> : <BellRing />}
            {enabled ? "Benachrichtigungen ausschalten" : "Benachrichtigungen aktivieren"}
          </Button>
          {enabled && <Button type="button" variant="outline" disabled={busy} onClick={() => act(true)}><Send /> Test senden</Button>}
        </div>
      )}
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </section>
  );
}