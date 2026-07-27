/**
 * Web-Push-Anmeldung für Wetterwarnungen.
 * Registriert den Service Worker erst auf Nutzeraktion.
 */

import { useEffect, useState } from "react";
import { BellOff, BellRing, Check, Circle, Loader2 } from "lucide-react";
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
  const [msgKind, setMsgKind] = useState<"ok" | "error">("ok");
  const [howOpen, setHowOpen] = useState(false);
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

  function note(text: string, kind: "ok" | "error" = "ok") {
    setMsg(text);
    setMsgKind(kind);
  }

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
          regionIds,
        },
      });
      setSubscribed(true);
      note(`Benachrichtigungen aktiviert für ${regionIds.length} Gemeinde${regionIds.length === 1 ? "" : "n"}.`);
    } catch (e) {
      note(e instanceof Error ? e.message : "Aktivierung fehlgeschlagen.", "error");
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
      note("Benachrichtigungen deaktiviert.");
    } catch {
      note("Deaktivierung fehlgeschlagen.", "error");
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

  const none = regionIds.length === 0;

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs text-muted-foreground">
        Erhalte eine Meldung, sobald für deine Gemeinden eine Warnung ausgegeben wird.
      </p>

      {!subscribed && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium">
              Gewählte Gemeinden: {regionIds.length} von {REGIONS.length}
            </span>
            <span className="flex gap-1">
              <button
                type="button"
                onClick={() => setRegionIds(REGIONS.map((r) => r.id))}
                className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted"
              >
                Alle
              </button>
              <button
                type="button"
                onClick={() => setRegionIds([])}
                className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted"
              >
                Keine
              </button>
            </span>
          </div>
          <div className="max-h-32 overflow-y-auto rounded-md border border-border p-2">
            <div className="flex flex-wrap gap-1">
              {REGIONS.map((r) => {
                const on = regionIds.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleRegion(r.id)}
                    className={
                      "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors " +
                      (on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted")
                    }
                  >
                    {on ? (
                      <Check className="h-2.5 w-2.5" />
                    ) : (
                      <Circle className="h-2.5 w-2.5 opacity-50" />
                    )}
                    {r.name}
                  </button>
                );
              })}
            </div>
          </div>
          {none && (
            <p className="text-[11px] text-destructive">Mindestens eine Gemeinde wählen.</p>
          )}
        </div>
      )}

      {subscribed && (
        <p className="rounded-md border border-border bg-muted/50 px-2 py-1 text-[11px]">
          Aktiv – du erhältst Warnmeldungen für deine gewählten Gemeinden.
        </p>
      )}

      <button
        type="button"
        disabled={busy || (!subscribed && none)}
        onClick={subscribed ? unsubscribe : subscribe}
        className="flex w-full items-center justify-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
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

      {msg && (
        <p className={"text-[11px] " + (msgKind === "error" ? "text-destructive" : "text-muted-foreground")}>
          {msg}
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={() => setHowOpen((v) => !v)}
          className="text-[11px] underline text-muted-foreground"
        >
          Wie funktioniert das?
        </button>
        {howOpen && (
          <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-[11px] text-muted-foreground">
            <li>Gemeinden antippen (angefärbt mit Häkchen = ausgewählt).</li>
            <li>„Benachrichtigungen aktivieren“ – der Browser fragt nach Erlaubnis.</li>
            <li>
              Sobald für eine deiner Gemeinden eine Warnung ausgegeben wird (manuell oder automatisch
              bei Gewitterzug), erhältst du eine Meldung.
            </li>
            <li>Ein Tipp auf die Meldung öffnet die Warnkarte.</li>
            <li>
              Hinweis iPhone/iPad: Die Seite muss zuerst über „Teilen → Zum Home-Bildschirm“ installiert
              werden, sonst erlaubt iOS keine Push-Meldungen.
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}
