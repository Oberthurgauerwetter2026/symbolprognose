/**
 * Web-Push-Anmeldung für Wetterwarnungen.
 * Registriert den Service Worker erst auf Nutzeraktion.
 */

import { useEffect, useState } from "react";
import { BellOff, BellRing, Check, ChevronDown, Circle, Info, Loader2 } from "lucide-react";
import { REGIONS } from "@/lib/warnings-config";
import { SITE_URL } from "@/lib/site-url";
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
  const [hintOpen, setHintOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [regionIds, setRegionIds] = useState<string[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [framed, setFramed] = useState(false);
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window,
    );
    try {
      setFramed(window.top !== window.self);
    } catch {
      setFramed(true);
    }
    setPageUrl(`${SITE_URL}/warnkarte`);
    if (typeof Notification !== "undefined") setBlocked(Notification.permission === "denied");
    navigator.serviceWorker?.getRegistration("/push-sw.js").then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(Boolean(sub));
    });
  }, []);

  // Bewusst keine Vorauswahl: die Nutzerin wählt ihre Gemeinden selbst.
  void defaultRegionId;

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
      if (perm === "denied") {
        setBlocked(true);
        throw new Error(
          framed
            ? "Im eingebetteten Vorschaufenster erlaubt der Browser keine Benachrichtigungen. Bitte die Seite in einem eigenen Browser-Tab öffnen und dort nochmals aktivieren."
            : "Benachrichtigungen sind für diese Seite blockiert. Über das Schloss-Symbol in der Adressleiste unter „Website-Einstellungen“ wieder erlauben und erneut versuchen.",
        );
      }
      if (perm !== "granted") {
        throw new Error(
          "Die Abfrage wurde abgebrochen – bitte nochmals auf „Benachrichtigungen aktivieren“ tippen und im Browser-Dialog „Erlauben“ wählen.",
        );
      }

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
      <p className="mt-3 text-sm text-muted-foreground">
        Dieser Browser unterstützt keine Push-Benachrichtigungen.
      </p>
    );
  }

  const none = regionIds.length === 0;

  if (framed) {
    return (
      <div className="mt-2 rounded-lg border border-border bg-muted/50 p-2">
        <button
          type="button"
          onClick={() => setHintOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Info className="h-4 w-4" />
            Push im Vorschaufenster nicht möglich
          </span>
          <ChevronDown
            className={
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform " +
              (hintOpen ? "rotate-180" : "")
            }
          />
        </button>
        {hintOpen && (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            In einem eingebetteten Vorschaufenster erlauben Browser keine Push-Berechtigungen. Öffne
            die Warnkarte in einem eigenen Browser-Tab, um Benachrichtigungen zu aktivieren.
          </p>
        )}
        {pageUrl && (
          <a
            href={pageUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background hover:bg-foreground/90"
          >
            <BellRing className="h-3.5 w-3.5" />
            In eigenem Tab öffnen
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1.5 space-y-2">
      <p className="text-[13px] leading-relaxed text-foreground">
        Erhalte eine Meldung, sobald für deine Gemeinden eine Warnung ausgegeben wird.
      </p>

      {!subscribed && (
        <div className="rounded-lg border border-border">
          <button
            type="button"
            aria-expanded={pickOpen}
            onClick={() => setPickOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-sm font-semibold text-foreground"
          >
            <span>
              Gemeinden wählen ({regionIds.length} von {REGIONS.length})
            </span>
            <ChevronDown
              className={"h-4 w-4 shrink-0 transition-transform " + (pickOpen ? "rotate-180" : "")}
            />
          </button>
          {pickOpen && (
            <div className="space-y-2 border-t border-border p-2">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRegionIds(REGIONS.map((r) => r.id))}
                  className="rounded border border-border px-2 py-1 text-[13px] font-medium hover:bg-muted"
                >
                  Alle
                </button>
                <button
                  type="button"
                  onClick={() => setRegionIds([])}
                  className="rounded border border-border px-2 py-1 text-[13px] font-medium hover:bg-muted"
                >
                  Keine
                </button>
              </div>
              <div className="max-h-44 overflow-y-auto">
                <div className="flex flex-wrap gap-1.5">
                  {REGIONS.map((r) => {
                    const on = regionIds.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleRegion(r.id)}
                        className={
                          "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[13px] font-medium transition-colors " +
                          (on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:bg-muted")
                        }
                      >
                        {on ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 opacity-40" />
                        )}
                        {r.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              {none && (
                <p className="text-[13px] font-medium text-destructive">
                  Bitte mindestens eine Gemeinde ankreuzen.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {!subscribed && blocked && (
        <p className="rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-[13px] leading-relaxed text-foreground">
          Hinweis: Benachrichtigungen sind für diese Seite im Browser blockiert – bitte über das
          Schloss-Symbol in der Adressleiste wieder erlauben.
        </p>
      )}

      {subscribed && (
        <p className="rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-[13px] text-foreground">
          Aktiv – du erhältst Warnmeldungen für deine gewählten Gemeinden.
        </p>
      )}

      <button
        type="button"
        disabled={busy || (!subscribed && none)}
        onClick={subscribed ? unsubscribe : subscribe}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : subscribed ? (
          <BellOff className="h-4 w-4" />
        ) : (
          <BellRing className="h-4 w-4" />
        )}
        {subscribed ? "Benachrichtigungen ausschalten" : "Benachrichtigungen aktivieren"}
      </button>

      {msg && (
        <p className={"text-sm " + (msgKind === "error" ? "text-destructive" : "text-foreground")}>
          {msg}
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={() => setHowOpen((v) => !v)}
          className="text-[13px] font-medium text-muted-foreground underline underline-offset-2"
        >
          Wie funktioniert das?
        </button>
        {howOpen && (
          <div className="mt-1.5 space-y-1.5">
            <p className="rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-[13px] font-medium leading-relaxed text-foreground">
              iPhone/iPad: Die Seite muss zuerst über „Teilen → Zum Home-Bildschirm“ installiert und
              von dort geöffnet werden – sonst erlaubt iOS gar keine Push-Meldungen.
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-muted-foreground">
              <li>Gemeinden antippen (angefärbt mit Häkchen = ausgewählt).</li>
              <li>„Benachrichtigungen aktivieren“ – der Browser fragt nach Erlaubnis, dort „Erlauben“ wählen.</li>
              <li>
                Sobald für eine deiner Gemeinden eine Warnung ausgegeben wird (manuell oder automatisch
                bei Gewitterzug), erhältst du eine Meldung.
              </li>
              <li>
                Die Meldung zeigt den Warn-Titel (z. B. „Gewitterwarnung (Stufe 2)“), die Beschreibung,
                die betroffenen Gemeinden und den Gültigkeitszeitraum.
              </li>
              <li>Ein Tipp auf die Meldung öffnet die Warnkarte.</li>
              <li>
                Klappt es nicht: Die Seite in einem eigenen Browser-Tab (nicht im eingebetteten
                Vorschaufenster) öffnen und prüfen, ob Benachrichtigungen für die Seite blockiert sind.
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}


