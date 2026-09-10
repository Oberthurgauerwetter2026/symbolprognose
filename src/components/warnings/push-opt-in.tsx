/**
 * Web-Push-Anmeldung für Wetterwarnungen.
 * Registriert den Service Worker erst auf Nutzeraktion.
 */

import { useEffect, useState } from "react";
import { BellOff, BellRing, Check, ChevronDown, Circle, Info, Loader2 } from "lucide-react";
import { REGIONS } from "@/lib/warnings-config";
import { SITE_URL } from "@/lib/site-url";
import {
  getPushPublicKey,
  savePushSubscription,
  removePushSubscription,
  getPushSubscription,
} from "@/lib/warnings.functions";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Erkennt Gerät und Browser: iOS braucht eine Home-Bildschirm-Web-App. */
type BrowserId = "safari" | "chrome" | "edge" | "firefox" | "opera" | "samsung" | "inapp" | "other";

type PushEnv = {
  isIos: boolean;
  isAndroid: boolean;
  isMacSafari: boolean;
  version: number | null;
  standalone: boolean;
  browser: BrowserId;
};

const BROWSER_LABEL: Record<BrowserId, string> = {
  safari: "Safari",
  chrome: "Chrome",
  edge: "Edge",
  firefox: "Firefox",
  opera: "Opera",
  samsung: "Samsung Internet",
  inapp: "App-Browser",
  other: "Browser",
};

function detectBrowser(ua: string): BrowserId {
  if (/FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp|Snapchat|GSA\/|Threads|Pinterest|TikTok/.test(ua))
    return "inapp";
  if (/EdgiOS|Edg\//.test(ua)) return "edge";
  if (/OPiOS|OPT\/|OPR\//.test(ua)) return "opera";
  if (/CriOS/.test(ua)) return "chrome";
  if (/FxiOS|Firefox/.test(ua)) return "firefox";
  if (/SamsungBrowser/.test(ua)) return "samsung";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}

function detectPushEnv(): PushEnv {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const hasAppleTouch =
    /MacIntel|Macintosh/.test(platform + ua) && (navigator.maxTouchPoints ?? 0) > 1;
  const isIpadOs =
    /Macintosh/.test(ua) &&
    (hasAppleTouch || (typeof document !== "undefined" && "ontouchend" in document));
  const isIos = /iPad|iPhone|iPod/.test(ua) || isIpadOs;
  const isAndroid = /Android/.test(ua);
  const m = /OS (\d+)[._](\d+)/.exec(ua);
  const version = m ? Number(`${m[1]}.${m[2]}`) : null;
  const standalone =
    (typeof navigator !== "undefined" &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true) ||
    (typeof window !== "undefined" &&
      window.matchMedia?.("(display-mode: standalone)").matches === true);
  const browser = detectBrowser(ua);
  const isMacSafari = !isIos && !isAndroid && /Macintosh/.test(ua) && browser === "safari";
  return { isIos, isAndroid, isMacSafari, version, standalone, browser };
}


function bufToB64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function PushOptIn({ defaultRegionId }: { defaultRegionId?: string | null }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgKind, setMsgKind] = useState<"ok" | "error">("ok");
  const [howOpen, setHowOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [whereOpen, setWhereOpen] = useState(false);

  const [pickOpen, setPickOpen] = useState(false);
  const [regionIds, setRegionIds] = useState<string[]>([]);
  const [savedRegionIds, setSavedRegionIds] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [framed, setFramed] = useState(false);
  const [pageUrl, setPageUrl] = useState("");
  const [env, setEnv] = useState<PushEnv | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window,
    );
    try {
      setFramed(window.top !== window.self);
    } catch {
      setFramed(true);
    }
    setEnv(detectPushEnv());
    setPageUrl(`${SITE_URL}/warnkarte`);
    if (typeof Notification !== "undefined") setBlocked(Notification.permission === "denied");
    navigator.serviceWorker?.getRegistration("/push-sw.js").then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(Boolean(sub));
      if (!sub) return;
      try {
        const info = await getPushSubscription({ data: { endpoint: sub.endpoint } });
        setMissing(!info.found);
        setSavedRegionIds(info.regionIds);
        setRegionIds(info.regionIds);
        setSavedAt(info.updatedAt);
      } catch {
        /* Abo-Details nicht abrufbar – Anzeige bleibt ohne Gemeindeliste */
      }
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
      setMissing(false);
      setSavedRegionIds(regionIds);
      setSavedAt(new Date().toISOString());
      setPickOpen(false);
      note(`Benachrichtigungen aktiviert für ${regionIds.length} Gemeinde${regionIds.length === 1 ? "" : "n"}.`);
    } catch (e) {
      note(e instanceof Error ? e.message : "Aktivierung fehlgeschlagen.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveRegions() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) throw new Error("Kein aktives Abo gefunden – bitte neu aktivieren.");
      await savePushSubscription({
        data: {
          endpoint: sub.endpoint,
          p256dh: bufToB64(sub.getKey("p256dh")),
          auth: bufToB64(sub.getKey("auth")),
          regionIds,
        },
      });
      setSavedRegionIds(regionIds);
      setSavedAt(new Date().toISOString());
      setMissing(false);
      setEditing(false);
      note(`Gespeichert – ${regionIds.length} Gemeinde${regionIds.length === 1 ? "" : "n"} abonniert.`);
    } catch (e) {
      note(e instanceof Error ? e.message : "Speichern fehlgeschlagen.", "error");
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
      setEditing(false);
      setSavedRegionIds([]);
      setSavedAt(null);
      setMissing(false);
      note("Benachrichtigungen deaktiviert.");
    } catch {
      note("Deaktivierung fehlgeschlagen.", "error");
    } finally {
      setBusy(false);
    }
  }


  async function copyPageUrl() {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      note("Adresse konnte nicht kopiert werden – bitte manuell aus der Adressleiste kopieren.", "error");
    }
  }

  function HelpPanel({ title, children }: { title: string; children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    return (
      <div className="mt-2 rounded-lg border border-border bg-muted/50 p-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Info className="h-4 w-4 shrink-0" />
            {title}
          </span>
          <ChevronDown
            className={
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform " +
              (open ? "rotate-180" : "")
            }
          />
        </button>
        {open && (
          <div className="mt-1.5 space-y-1 text-xs leading-relaxed text-muted-foreground">
            {children}
          </div>
        )}
      </div>
    );
  }


  /** Schritte, um die Warnkarte auf dem iPhone als Web-App zu speichern. */
  function IosSteps() {
    return (
      <>
        <ol className="list-decimal space-y-0.5 pl-4">
          <li>Unten in Safari auf das Teilen-Symbol tippen.</li>
          <li>„Zum Home-Bildschirm“ wählen.</li>
          <li>
            Oben <strong className="text-foreground">„Web-App“</strong> wählen (nicht
            „Lesezeichen“), dann „Hinzufügen“.
          </li>
          <li>Die neue App vom Home-Bildschirm öffnen.</li>
          <li>Dort Gemeinden wählen und „Benachrichtigungen aktivieren“ antippen.</li>
        </ol>
        <p>
          Fehlt die Zeile „Web-App“, die Seite einmal neu laden (Safari muss die App-Angaben frisch
          laden) und den Vorgang wiederholen. Ein bereits gespeichertes Lesezeichen bitte löschen
          und neu als Web-App hinzufügen.
        </p>
      </>
    );
  }

  /** Übersicht, wo Warn-Meldungen möglich sind – für alle Geräte und Browser. */

  function WhereList() {
    return (
      <div>
        <button
          type="button"
          onClick={() => setWhereOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 pt-1 text-left text-xs font-medium text-foreground underline underline-offset-2"
        >
          Wo funktionieren Warn-Meldungen?
          <ChevronDown
            className={"h-4 w-4 shrink-0 transition-transform " + (whereOpen ? "rotate-180" : "")}
          />
        </button>
        {whereOpen && (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-muted-foreground">
            <li>
              iPhone/iPad (ab iOS 16.4): in Safari, Chrome, Edge oder Firefox – aber erst, nachdem
              die Warnkarte auf dem Home-Bildschirm gespeichert und von dort geöffnet wurde.
            </li>
            <li>Android (Chrome, Edge, Samsung Internet, Firefox): direkt, ohne Installation.</li>
            <li>Computer mit Chrome, Edge oder Firefox: direkt, ohne Installation.</li>
            <li>Mac mit Safari: einmal über „Teilen → Zum Dock hinzufügen“ speichern.</li>
            <li>
              App-Browser (Facebook, Instagram, LinkedIn und ähnliche) und eingebettete Karten:
              nicht möglich – dort die Warnkarte im normalen Browser öffnen.
            </li>
          </ul>
        )}
      </div>
    );
  }

  function OpenElsewhere() {
    return (
      <div className="flex flex-wrap gap-1.5 pt-1">
        <button
          type="button"
          onClick={copyPageUrl}
          className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background hover:bg-foreground/90"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : null}
          {copied ? "Adresse kopiert" : "Adresse kopieren"}
        </button>
        <a
          href={pageUrl}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
        >
          Warnkarte öffnen
        </a>
      </div>
    );
  }

  // iOS: Push braucht immer eine Web-App auf dem Home-Bildschirm.
  if (env?.isIos && !framed && !env.standalone) {
    if (env.version != null && env.version < 16.4) {
      return (
        <HelpPanel title="Benachrichtigungen brauchen iOS 16.4 oder neuer">
          <p>
            Auf diesem Gerät ist iOS {env.version} installiert. Bitte iOS aktualisieren
            (Einstellungen → Allgemein → Softwareupdate), danach ist der Warn-Push möglich.
          </p>
          <WhereList />
        </HelpPanel>
      );
    }
    if (env.browser === "inapp") {
      return (
        <HelpPanel title="Bitte im normalen Browser öffnen">
          <p>
            In App-Browsern (z. B. Facebook, Instagram, LinkedIn) sind Warn-Meldungen nicht möglich.
            Adresse kopieren, in Safari, Chrome, Edge oder Firefox öffnen und die Warnkarte dort auf
            den Home-Bildschirm legen.
          </p>
          <OpenElsewhere />
          <WhereList />
        </HelpPanel>
      );
    }
    if (env.browser !== "safari") {
      const label = BROWSER_LABEL[env.browser];
      return (
        <HelpPanel title={`Erst zum Home-Bildschirm hinzufügen (${label})`}>
          <ol className="list-decimal space-y-0.5 pl-4">
            <li>In {label} das Menü öffnen (die drei Punkte).</li>
            <li>„Teilen" und danach „Zum Home-Bildschirm" wählen.</li>
            <li>Mit „Hinzufügen" bestätigen.</li>
            <li>Die neue App vom Home-Bildschirm öffnen.</li>
            <li>Dort Gemeinden wählen und „Benachrichtigungen aktivieren" antippen.</li>
          </ol>
          <p>
            Findet sich der Punkt „Zum Home-Bildschirm" nicht, die Warnkarte einmal in Safari öffnen
            und dort über das Teilen-Symbol als{" "}
            <strong className="text-foreground">Web-App</strong> speichern.
          </p>
          <OpenElsewhere />
          <WhereList />
        </HelpPanel>
      );
    }
    return (
      <HelpPanel title="Erst zum Home-Bildschirm hinzufügen">
        <IosSteps />
        <WhereList />
      </HelpPanel>
    );
  }



  if (env?.browser === "inapp" && !framed) {
    return (
      <HelpPanel title="Bitte im normalen Browser öffnen">
        <p>
          In App-Browsern (z. B. Facebook, Instagram, LinkedIn) lassen sich keine Warn-Meldungen
          aktivieren. Adresse kopieren und die Warnkarte in Chrome, Edge, Firefox oder Safari öffnen.
        </p>
        <OpenElsewhere />
        <WhereList />
      </HelpPanel>
    );
  }



  // Erst nach der Geräteprüfung rendern. So erscheint während der Hydrierung
  // nicht kurz fälschlich der Hinweis für nicht unterstützte Browser.
  if (supported == null || env == null) return null;

  if (!supported) {
    return (
      <HelpPanel
        title={env.isIos ? "Erst als Web-App öffnen" : "Warn-Meldungen hier nicht verfügbar"}
      >
        {env.isIos ? (
          <IosSteps />
        ) : framed ? (
          <p>
            In dieser eingebetteten Ansicht sind Warn-Meldungen nicht möglich. Bitte die Warnkarte
            in einem eigenen Browser-Tab öffnen.
          </p>
        ) : (
          <p>
            Dieser Browser stellt die benötigte Benachrichtigungsfunktion nicht bereit. Bitte die
            Warnkarte in einer aktuellen Version von Chrome, Edge, Firefox oder Safari öffnen.
          </p>
        )}
        {framed && <OpenElsewhere />}
        <WhereList />
      </HelpPanel>
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
        <HelpPanel title="Anleitung für dein Gerät">
          {env?.isIos && <IosSteps />}
          <WhereList />
        </HelpPanel>
      </div>

    );
  }


  return (
    <div className="mt-1 space-y-1.5">
      <p className="text-xs leading-snug text-foreground">
        Erhalte eine Meldung, sobald für deine Gemeinden eine Warnung ausgegeben wird.
      </p>

      {(!subscribed || editing) && (
        <div className="rounded-lg border border-border">
          <button
            type="button"
            aria-expanded={pickOpen}
            onClick={() => setPickOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-xs font-semibold text-foreground"
          >
            <span>
              Gemeinden wählen ({regionIds.length} von {REGIONS.length})
            </span>
            <ChevronDown
              className={"h-4 w-4 shrink-0 transition-transform " + (pickOpen ? "rotate-180" : "")}
            />
          </button>
          {pickOpen && (
            <div className="space-y-1.5 border-t border-border p-1.5">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRegionIds(REGIONS.map((r) => r.id))}
                  className="rounded border border-border px-1.5 py-0.5 text-xs font-medium hover:bg-muted"
                >
                  Alle
                </button>
                <button
                  type="button"
                  onClick={() => setRegionIds([])}
                  className="rounded border border-border px-1.5 py-0.5 text-xs font-medium hover:bg-muted"
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
                          "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium transition-colors " +
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
                <p className="text-xs font-medium text-destructive">
                  Bitte mindestens eine Gemeinde ankreuzen.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {!subscribed && blocked && (
        <p className="rounded-lg border border-border bg-muted/50 px-2 py-1 text-xs leading-snug text-foreground">
          Hinweis: Benachrichtigungen sind für diese Seite im Browser blockiert – bitte über das
          Schloss-Symbol in der Adressleiste wieder erlauben.
        </p>
      )}

      {subscribed && !editing && (
        <div className="rounded-lg border border-border bg-muted/50 px-2 py-1.5 text-xs text-foreground">
          {missing ? (
            <p className="leading-snug">
              Dieses Gerät ist beim Server nicht mehr registriert – bitte die Benachrichtigungen neu
              aktivieren.
            </p>
          ) : (
            <>
              <button
                type="button"
                aria-expanded={subsOpen}
                onClick={() => setSubsOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 text-left font-semibold"
              >
                <span>
                  Abonniert: {savedRegionIds.length} von {REGIONS.length} Gemeinden
                </span>
                <ChevronDown
                  className={
                    "h-4 w-4 shrink-0 transition-transform " + (subsOpen ? "rotate-180" : "")
                  }
                />
              </button>
              {subsOpen && (
                <>
                  {savedRegionIds.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {REGIONS.filter((r) => savedRegionIds.includes(r.id)).map((r) => (
                        <span
                          key={r.id}
                          className="rounded border border-primary/50 bg-primary/15 px-1.5 py-0.5 text-xs font-medium"
                        >
                          {r.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {savedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Zuletzt geändert:{" "}
                      {new Date(savedAt).toLocaleString("de-CH", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRegionIds(savedRegionIds);
                      setEditing(true);
                      setPickOpen(true);
                      setMsg(null);
                    }}
                    className="mt-1.5 rounded border border-border bg-background px-1.5 py-0.5 text-xs font-semibold hover:bg-muted"
                  >
                    Gemeinden ändern
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}


      {editing ? (
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={busy || none}
            onClick={saveRegions}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Speichern
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setRegionIds(savedRegionIds);
              setEditing(false);
              setPickOpen(false);
            }}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
          >
            Abbrechen
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy || (!subscribed && none)}
          onClick={subscribed ? unsubscribe : subscribe}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
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
      )}


      {msg && (
        <p className={"text-xs " + (msgKind === "error" ? "text-destructive" : "text-foreground")}>
          {msg}
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={() => setHowOpen((v) => !v)}
          className="text-xs font-medium text-muted-foreground underline underline-offset-2"
        >
          Wie funktioniert das?
        </button>
        {howOpen && (
          <div className="mt-1 space-y-1">
            <p className="rounded-lg border border-border bg-muted/50 px-2 py-1 text-xs font-medium leading-relaxed text-foreground">
              {env?.isMacSafari
                ? "Mac mit Safari: die Warnkarte einmal über „Teilen → Zum Dock hinzufügen“ speichern und von dort öffnen, danach sind Warn-Meldungen möglich."
                : "iPhone/iPad: die Warnkarte zuerst über „Teilen → Zum Home-Bildschirm“ speichern (in Safari als Web-App, nicht als Lesezeichen) und die App von dort öffnen. Auf Android und am Computer geht es direkt."}
            </p>

            <ol className="list-decimal space-y-0.5 pl-5 text-xs leading-relaxed text-muted-foreground">
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
            <WhereList />
          </div>

        )}
      </div>
    </div>
  );
}


