import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MAPS } from "@/lib/maps-config";

const PUBLISHED_ORIGIN = "https://oberthurgauer-wetter.lovable.app";

export const Route = createFileRoute("/embed-info")({
  component: EmbedInfo,
  head: () => ({
    meta: [{ title: "Embed-Snippets · WordPress" }],
  }),
});

/**
 * Einfaches iframe-Snippet ohne JS-Fallback. Für alle Karten ausser
 * Lokalprognose Amriswil, die weiter das postMessage-Höhen-Skript braucht.
 */
function buildSimpleSnippet(url: string, path: string, height = 600, lazy = false) {
  const full = `${url}${path}`;
  const origin = new URL(url).origin;
  return `<link rel="preconnect" href="${origin}" crossorigin>
<link rel="dns-prefetch" href="${origin}">
<iframe
  src="${full}"
  loading="${lazy ? "lazy" : "eager"}"
  fetchpriority="${lazy ? "low" : "high"}"
  referrerpolicy="no-referrer-when-downgrade"
  allow="geolocation; fullscreen"
  style="width:100%;height:${height}px;border:0;display:block"
  title="Wetter-Karte"
></iframe>`;
}


/**
 * Monitor-stabiles Snippet für Lokalprognose Amriswil: statische HTML-Route,
 * kein postMessage, keine Client-Hydration, keine blauen Ladeflächen.
 */
function buildAmriswilSnippet(url: string, path: string, height = 520) {
  const full = `${url}${path}`;
  const origin = new URL(url).origin;
  return `<link rel="preconnect" href="${origin}" crossorigin>
<link rel="dns-prefetch" href="${origin}">
<iframe
  src="${full}"
  loading="eager"
  fetchpriority="high"
  referrerpolicy="no-referrer-when-downgrade"
  scrolling="no"
  style="width:100%;height:${height}px;border:0;display:block;background:#ffffff;border-radius:8px"
  title="Lokalprognose Amriswil"
></iframe>`;
}

/**
 * Snippet mit automatischer Höhenanpassung: das Widget meldet seine Höhe per
 * postMessage, das iframe wächst weich mit, sobald ein Ort gewählt wurde.
 */
function buildAutoHeightSnippet(url: string, path: string, startHeight = 260) {
  const full = `${url}${path}`;
  const origin = new URL(url).origin;
  return `<link rel="preconnect" href="${origin}" crossorigin>
<link rel="dns-prefetch" href="${origin}">
<iframe
  id="otw-lokal-suche"
  src="${full}"
  loading="eager"
  fetchpriority="high"
  referrerpolicy="no-referrer-when-downgrade"
  scrolling="no"
  allow="geolocation"
  style="width:100%;height:${startHeight}px;border:0;display:block;background:#f4f4f5;border-radius:8px;transition:height .25s ease"
  title="Lokalprognose mit Ortssuche"
></iframe>
<script>
(function () {
  var frame = document.getElementById('otw-lokal-suche');
  window.addEventListener('message', function (e) {
    if (e.origin !== '${origin}') return;
    var d = e.data;
    if (!d || d.type !== 'lovable-weather:height') return;
    var h = Number(d.height);
    if (!isFinite(h) || h < 120 || h > 4000) return;
    frame.style.height = Math.ceil(h) + 'px';
  });
})();
</script>`;
}
/**
 * Standbild-Snippet: reines verlinktes <img>, kein iframe, kein JavaScript.
 * Der Cache-Buster wechselt pro 5-Minuten-Fenster, damit WordPress-Besucher
 * ein aktuelles Bild sehen, ohne den Edge-Cache zu umgehen.
 */
function buildImageSnippet(url: string, path: string, link: string, title: string) {
  const origin = new URL(url).origin;
  return `<a href="${origin}${link}" target="_blank" rel="noopener" style="display:block">
  <img
    src="${origin}${path}?v=${Math.floor(Date.now() / 300000)}"
    alt="${title}"
    loading="lazy"
    decoding="async"
    style="width:100%;height:auto;display:block;border:0;border-radius:8px"
  >
</a>`;
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

interface Product {
  id: string;
  label: string;
  path: string;
  height: number;
  description: string;
  variant?: "amriswil" | "auto-height" | "image";
  /** Ziel des Klicks bei Standbildern (interaktive Karte). */
  link?: string;
  note?: string;
}

/** Ein Eintrag pro Produkt des Wetterboards — jedes bekommt sein eigenes Snippet. */
const PRODUCTS: Product[] = [
  {
    id: "standbild-radar",
    label: "Standbild Niederschlagsradar",
    path: "/api/public/snapshot/radar.svg",
    link: "/karten/radar",
    height: 0,
    variant: "image",
    description:
      "Aktuelles Radar-Messbild als Bild — kein iframe, kein JavaScript. Skaliert auf die Widget-Breite und lädt bei jedem Seitenaufruf das jeweils neueste Bild.",
    note: "Ein Klick auf das Bild öffnet die interaktive Radarkarte in einem neuen Tab. Das Bild wird alle 5 Minuten erneuert.",
  },
  {
    id: "standbild-wind",
    label: "Standbild Wind & Böen",
    path: "/api/public/snapshot/wind.svg",
    link: "/karten/wind",
    height: 0,
    variant: "image",
    description:
      "Windrichtung als Pfeil und Böenspitze in km/h für die Orte im Oberthurgau und die Referenzstädte — als reines Bild fürs Widget.",
    note: "Ein Klick öffnet die interaktive Windkarte. Aktualisierung alle 5 Minuten.",
  },
  {
    id: "standbild-warnungen",
    label: "Standbild Wetterwarnungen",
    path: "/api/public/snapshot/warnungen.svg",
    link: "/warnkarte",
    height: 0,
    variant: "image",
    description:
      "Gemeindekarte mit der aktuellen Warnlage (Keine Gefahr, Vorinformation schraffiert, Stufe 1–3) inklusive Anzahl aktiver Warnungen und Zeitstempel.",
    note: "Ein Klick öffnet die vollständige Warnkarte, dort ist auch das Push-Abo möglich.",
  },

  {
    id: "warnungen",
    label: "Wetterwarnungen",
    path: "/embed/warnungen",
    height: 760,
    description:
      "Warnkarte für alle Gemeinden im Oberthurgau: Gewitter, Regen, Schnee, Strassenglätte, Wind und Frost in vier Gefahrenstufen.",
    note: "Push-Benachrichtigungen lassen sich im iframe nicht aktivieren — im Widget führt ein Button in einen eigenen Tab, dort funktioniert das Abo.",
  },
  {
    id: "lokal-amriswil",
    label: "Lokalprognose Amriswil (Monitor-Version)",
    path: "/api/public/embed/region-lokal-static",
    height: 520,
    variant: "amriswil",
    description:
      "Kompakte HTML-Prognose mit Wettersymbolen, ohne JavaScript. Passt neben die TWINT-Spalte; die Höhe 520px ist auf die Unterkante des TWINT-Labels abgestimmt.",
  },
  {
    id: "region",
    label: "Wetterkarte Region",
    path: "/embed/region",
    height: 600,
    variant: "auto-height",
    description:
      "Symbolprognose, Temperatur und Wind für die Region Oberthurgau. Ein Klick auf eine Gemeinde öffnet die Lokalprognose direkt im gleichen Widget — ohne Wetterboard-Rahmen, mit „Zurück zur Karte“-Button.",
    note: "Das Snippet enthält ein kleines Skript für die Höhenanpassung, damit die aufklappende Lokalprognose vollständig sichtbar ist; in WordPress in einen Custom-HTML-Block einfügen.",
  },

  {
    id: "lokal-suche",
    label: "Lokalprognose mit Ortssuche (Auto-Höhe)",
    path: "/embed/lokal-suche",
    height: 260,
    variant: "auto-height",
    description:
      "Startet schlank mit Suchfeld und Ortung. Sobald ein Ort gewählt ist, klappen Tagesleiste, Stundenverlauf und 7-Tage-Prognose auf — das iframe wächst automatisch mit.",
    note: "Das Snippet enthält ein kleines Skript für die Höhenanpassung; in WordPress in einen Custom-HTML-Block einfügen (nicht in einen reinen iframe-Block).",
  },
  {
    id: "lokal",
    label: "Lokalprognose (Karte)",
    path: "/embed/lokal",
    height: 600,
    description: "5-Tage-Prognose im 3-Stunden-Takt für jeden Ort der Region.",
  },

  {
    id: "wind",
    label: "Wind",
    path: "/embed/wind",
    height: 600,
    description: "Windrichtung, Windgeschwindigkeit und Böen auf der Regionskarte.",
  },
  {
    id: "radar",
    label: "Niederschlagsradar",
    path: "/embed/radar",
    height: 600,
    description: "Radarmessung und Kurzfristprognose des Niederschlags.",
  },
  {
    id: "satellit",
    label: "Satellit (mit Bedienleiste)",
    path: "/embed/satellit",
    height: 600,
    description: "MTG-Satellitenbilder mit Regionsauswahl und Zeitleiste.",
  },
  {
    id: "satellit-loop",
    label: "Satellit Loop (Schweiz & Alpen)",
    path: "/embed/satellit-loop",
    height: 520,
    description:
      "Automatischer Loop der MTG-Satellitenbilder — ohne Regions-Umschaltung und ohne Zeitleiste, als reines Widget.",
  },
  {
    id: "all",
    label: "Komplett-Board (alle Karten mit Tabs)",
    path: "/embed/all",
    height: 760,
    description:
      "Region, Lokalprognose, Wind und Radar in einer einzigen Einbettung. Besucher wechseln im iframe selbst.",
  },
];

function EmbedInfo() {
  const url = PUBLISHED_ORIGIN;

  return (
    <DashboardLayout
      title="Embed-Snippets"
      subtitle="iframe-Code für WordPress — ein Snippet pro Produkt"
    >
      <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
        <p className="text-sm text-muted-foreground">
          Füge im WordPress-Editor einen <strong>Custom-HTML-Block</strong> (oder iframe-Block) ein und kopiere das
          gewünschte Snippet hinein. Empfehlung: pro Produkt eine eigene Seite bzw. einen eigenen Block, damit jedes
          Produkt einzeln benannt und verlinkt werden kann.
        </p>
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Die Snippets zeigen immer auf die publizierte URL <code>{PUBLISHED_ORIGIN}</code>. Nach Code-Änderungen zuerst
          publishen, damit sie in WordPress sichtbar werden.
        </p>

        <section className="space-y-6">
          {PRODUCTS.map((p) => {
            const map = MAPS.find((m) => m.embedPath === p.path);
            const Icon = map?.icon;
            const snippet =
              p.variant === "image"
                ? buildImageSnippet(url, p.path, p.link ?? "/", p.label)
                : p.variant === "amriswil"
                  ? buildAmriswilSnippet(url, p.path, p.height)
                  : p.variant === "auto-height"
                    ? buildAutoHeightSnippet(url, p.path, p.height)
                    : buildSimpleSnippet(url, p.path, p.height, p.path.startsWith("/embed/satellit"));


            return (
              <div key={p.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ background: "#2561a1" }}
                  >
                    {Icon ? <Icon className="h-4 w-4" /> : <span className="text-xs font-bold">OT</span>}
                  </div>
                  <div className="space-y-1">
                    <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground">
                      {p.label}
                    </h2>
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Pfad <code>{p.path}</code> · empfohlene Höhe <code>{p.height}px</code>
                    </p>
                    {p.note && <p className="text-xs text-amber-800">{p.note}</p>}
                  </div>
                </div>
                <SnippetBlock snippet={snippet} />
              </div>
            );
          })}
        </section>
      </div>
    </DashboardLayout>
  );
}
