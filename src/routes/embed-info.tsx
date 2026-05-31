import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MAPS } from "@/lib/maps-config";

const PUBLISHED_ORIGIN = "https://symbolprognose.lovable.app";

export const Route = createFileRoute("/embed-info")({
  component: EmbedInfo,
  head: () => ({
    meta: [{ title: "Embed-Snippets · WordPress" }],
  }),
});

/**
 * Embed-Snippet mit zweistufigem Fallback:
 *   1. <img> mit serverseitig gerendertem SVG-Snapshot (immer sichtbar — auch
 *      ohne JavaScript, in In-App-Browsern, mit Tracking-Blockern).
 *   2. <iframe> mit der interaktiven Karte: legt sich beim erfolgreichen Laden
 *      über das Bild. Schlägt das Laden fehl, bleibt das Bild sichtbar und
 *      der eingebettete Link öffnet die volle Karte.
 */
function buildSnippet(
  url: string,
  path: string,
  idSuffix: string,
  snapshotId: string | null,
  fullPath: string,
  fallbackHeight = 600,
) {
  const full = `${url}${path}`;
  const fullLink = `${url}${fullPath}`;
  const snapshot = snapshotId ? `${url}/api/public/snapshot/${snapshotId}.svg` : null;
  const fallbackImg = snapshot
    ? `<a href="${fullLink}" target="_blank" rel="noopener" style="display:block;position:absolute;inset:0;text-decoration:none">
    <img src="${snapshot}" alt="Wetterkarte — interaktive Version: ${fullLink}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block"/>
  </a>
  `
    : "";
  const watchdog = snapshot
    ? `
  (function () {
    var wrap = document.getElementById("wx-${idSuffix}-wrap");
    var f = document.getElementById("wx-${idSuffix}");
    if (!wrap || !f) return;
    window.addEventListener("message", function (e) {
      if (e.data && e.data.type === "lovable-weather:height" && e.source === f.contentWindow) {
        wrap.style.height = e.data.height + "px";
      }
    });
    // Wenn das iframe nach 6 s nicht geladen ist (Adblocker, In-App-Browser,
    // alter Browser), iframe entfernen — das Snapshot-Bild bleibt sichtbar.
    setTimeout(function () {
      try {
        var doc = f.contentDocument;
        var ok = (doc && doc.body && doc.body.children.length > 0) || (f.offsetHeight > 80 && f.style.opacity === "1");
        if (!ok) { f.parentNode && f.parentNode.removeChild(f); }
      } catch (_) { /* cross-origin = iframe lädt erfolgreich */ }
    }, 6000);
  })();`
    : `
  (function () {
    var wrap = document.getElementById("wx-${idSuffix}-wrap");
    var f = document.getElementById("wx-${idSuffix}");
    if (!wrap || !f) return;
    window.addEventListener("message", function (e) {
      if (e.data && e.data.type === "lovable-weather:height" && e.source === f.contentWindow) {
        wrap.style.height = e.data.height + "px";
      }
    });
  })();`;
  return `<div id="wx-${idSuffix}-wrap" style="position:relative;width:100%;max-width:100%;min-width:0;height:${fallbackHeight}px;border:0;box-sizing:border-box;background:#eaf2fb;border-radius:8px;overflow:hidden;resize:vertical">
  ${fallbackImg}<iframe
    id="wx-${idSuffix}"
    src="${full}"
    loading="lazy"
    referrerpolicy="no-referrer-when-downgrade"
    allow="geolocation; fullscreen"
    scrolling="no"
    onload="this.style.opacity=1"
    style="position:absolute;inset:0;width:100%;height:100%;border:0;display:block;opacity:0;transition:opacity .2s"
    title="Wetter-Karte"
  ></iframe>
</div>
<script>${watchdog}
</script>`;
}


function buildViewportSnippet(
  url: string,
  path: string,
  idSuffix: string,
  snapshotId: string,
  fullPath: string,
) {
  const full = `${url}${path}`;
  const fullLink = `${url}${fullPath}`;
  const snapshot = `${url}/api/public/snapshot/${snapshotId}.svg`;
  return `<div id="wx-${idSuffix}-wrap" style="position:relative;width:100%;height:100vh;min-height:70vh;max-height:100vh;border:0;box-sizing:border-box;background:#eaf2fb;overflow:hidden">
  <a href="${fullLink}" target="_blank" rel="noopener" style="display:block;position:absolute;inset:0;text-decoration:none">
    <img src="${snapshot}" alt="Wetterkarte — interaktive Version: ${fullLink}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block"/>
  </a>
  <iframe
    id="wx-${idSuffix}"
    src="${full}"
    loading="lazy"
    referrerpolicy="no-referrer-when-downgrade"
    allow="geolocation; fullscreen"
    scrolling="no"
    onload="this.style.opacity=1"
    style="position:absolute;inset:0;width:100%;height:100%;border:0;display:block;opacity:0;transition:opacity .2s"
    title="Wetter-Karte"
  ></iframe>
</div>
<style>@supports (height: 100dvh) { #wx-${idSuffix}-wrap { height: 100dvh !important; max-height: 100dvh !important; } }</style>`;
}

function SnippetBlock({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md bg-zinc-900 p-4 font-mono text-xs text-zinc-100">
        {snippet}
      </pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(snippet);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 h-7 rounded-sm bg-accent px-3 text-[10px] font-semibold uppercase tracking-widest text-accent-foreground"
      >
        {copied ? "Kopiert" : "Kopieren"}
      </button>
    </div>
  );
}

function EmbedInfo() {
  const url = PUBLISHED_ORIGIN;

  return (
    <DashboardLayout
      title="Embed-Snippets"
      subtitle="iframe-Code für WordPress, pro Karte oder Komplett-Widget"
    >
      <div className="mx-auto w-full max-w-3xl space-y-10 px-4 py-8">
        <p className="text-sm text-muted-foreground">
          Füge im WordPress-Editor einen <strong>Custom-HTML-Block</strong> ein und kopiere das Snippet (inkl. <code>&lt;script&gt;</code>) hinein. Die Breite passt sich dem Container an, die Höhe wird per <code>postMessage</code> automatisch nachgeführt.
        </p>
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Die Snippets zeigen immer auf die publizierte URL <code>{PUBLISHED_ORIGIN}</code>. Nach Code-Änderungen zuerst publishen, damit sie in WordPress sichtbar werden.
        </p>


        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            Komplett-Widget (alle Karten mit Tabs)
          </h2>
          <p className="text-sm text-muted-foreground">
            Region, Lokalprognose, Wind, Radar und Pollen in einer einzigen Einbettung. Besucher wechseln im iframe selbst.
          </p>
          <SnippetBlock snippet={buildSnippet(url, "/embed/all", "all", "all", "/karten/region", 760)} />
        </section>

        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            Lokalprognose Amriswil
          </h2>
          <p className="text-sm text-muted-foreground">
            Nur der detaillierte Prognose-Bereich für Amriswil – ohne Karte, Suche, Ortsname oder Tagesleiste. Ohne Vorschaubild: beim Laden ist nur ein dezenter blauer Hintergrund sichtbar, bis die Prognose erscheint. Die Höhe passt sich automatisch dem Inhalt an (per <code>postMessage</code>). Der Wert <code>height:480px</code> im Snippet ist nur ein Fallback und kann beliebig verändert werden; zusätzlich lässt sich der Rahmen über die untere rechte Ecke per Maus vergrößern (<code>resize:vertical</code>).
          </p>
          <SnippetBlock snippet={buildSnippet(url, "/embed/region-lokal", "region-lokal", null, "/karten/region", 480)} />
        </section>

        <section className="space-y-6">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Einzelne Karten
            </h2>
            <p className="text-sm text-muted-foreground">
              Jede Karte kann separat eingebunden werden.
            </p>
          </div>

          {MAPS.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.id} className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                    style={{ background: "#2561a1" }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{m.label}</h3>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  </div>
                  {m.status === "coming-soon" && (
                    <span className="ml-auto rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      bald verfügbar
                    </span>
                  )}
                </div>
                <SnippetBlock snippet={buildSnippet(url, m.embedPath, m.id, m.id, m.routePath)} />
              </div>
            );
          })}
        </section>

        <div className="space-y-1 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-[11px] text-emerald-900">
          <p>
            <strong>Neu: garantierter Fallback.</strong> Jedes Snippet zeigt sofort ein statisches Karten-Vorschau-Bild (SVG, vom Server gerendert, alle 5 min aktualisiert). Wenn das interaktive iframe geladen wird, legt es sich darüber. Wird es blockiert (Adblocker, In-App-Browser, fehlendes JS), bleibt das Bild sichtbar — ein Klick öffnet die volle Karte in einem neuen Tab.
          </p>
        </div>
        <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground">
          <p>
            <strong>Bleibt die Karte bei einzelnen Besuchern leer?</strong>
          </p>
          <ul className="ml-4 list-disc space-y-0.5">
            <li>Im WordPress-Editor den Block <strong>„Custom HTML"</strong> verwenden (nicht den Visual-Editor – sonst wird <code>&lt;script&gt;</code> entfernt und das iframe legt sich nie über das Fallback-Bild).</li>
            <li>Tracking-/Werbeblocker (Brave, Firefox Strict, iOS-Content-Blocker, uBlock) können <code>lovable.app</code> blockieren. In dem Fall bleibt das Snapshot-Bild sichtbar — ein Klick öffnet die Karte in einem neuen Tab.</li>
            <li>In-App-Browser von Facebook/Instagram zeigen das iframe gelegentlich leer – auch hier öffnet ein Tipp auf das Bild die Karte im richtigen Browser.</li>
          </ul>

          <p className="pt-1">
            <strong>Tipp:</strong> Auf Smartphones bietet die Lokalprognose einen „Ortung"-Knopf für den eigenen Standort.
          </p>
          <p>
            Datenquellen: MeteoSchweiz ICON-CH1/CH2 & ECMWF IFS via Open-Meteo (kostenlos für nicht-kommerzielle Nutzung).
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
