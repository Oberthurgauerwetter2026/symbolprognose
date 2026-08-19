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
  return `${warmupLinks(origin, path)}
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
 * Verbindungen vorwärmen: eigener Origin plus die Hosts der Kartenkacheln,
 * damit DNS/TLS nicht erst nach dem Laden des Widgets aufgebaut wird.
 */
function warmupLinks(origin: string, path: string) {
  const hosts = [origin];
  const isMap = /^\/embed\/(region|radar|wind|warnungen|satellit|all|widget-)/.test(path);
  if (isMap) hosts.push("https://wmts.geo.admin.ch");
  if (path.startsWith("/embed/satellit")) hosts.push("https://view.eumetsat.int");
  return hosts
    .map(
      (h) =>
        `<link rel="preconnect" href="${h}" crossorigin>\n<link rel="dns-prefetch" href="${h}">`,
    )
    .join("\n");
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
function buildAutoHeightSnippet(
  url: string,
  path: string,
  startHeight = 260,
  frameId = "otw-lokal-suche",
  title = "Lokalprognose mit Ortssuche",
  minHeight = 200,
) {
  const full = `${url}${path}`;
  const origin = new URL(url).origin;
  return `${warmupLinks(origin, path)}
<iframe
  id="${frameId}"
  src="${full}"
  loading="eager"
  fetchpriority="high"
  referrerpolicy="no-referrer-when-downgrade"
  scrolling="no"
  allow="geolocation"
  style="width:100%;height:${startHeight}px;border:0;display:block;background:transparent;border-radius:8px;transition:height .25s ease"
  title="${title}"
></iframe>
<script>
(function () {
  var frame = document.getElementById('${frameId}');
  var MIN = ${minHeight};
  var current = ${startHeight};
  var shrinkTimer = null;
  function apply(h) {
    current = h;
    frame.style.height = h + 'px';
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== '${origin}') return;
    if (e.source !== frame.contentWindow) return;
    var d = e.data;
    if (!d || d.type !== 'lovable-weather:height') return;
    var h = Math.ceil(Number(d.height));
    if (!isFinite(h) || h < MIN || h > 4000) return;
    if (h > current) {
      if (shrinkTimer) { clearTimeout(shrinkTimer); shrinkTimer = null; }
      apply(h);
      return;
    }
    if (current - h <= 40) return;
    // Verkleinerung erst übernehmen, wenn sie stabil bleibt
    if (shrinkTimer) clearTimeout(shrinkTimer);
    shrinkTimer = setTimeout(function () {
      shrinkTimer = null;
      apply(h);
    }, 500);
  });
})();
</script>`;
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
  variant?: "amriswil" | "auto-height";
  frameId?: string;
  note?: string;
}

/** Ein Eintrag pro Produkt des Wetterboards — jedes bekommt sein eigenes Snippet. */
const PRODUCTS: Product[] = [
  {
    id: "widget-warnungen",
    label: "Widget: Warnungen aktuell",
    path: "/embed/widget-warnungen",
    height: 560,
    description:
      "Kompaktes Widget mit der Warnkarte und einer Liste der derzeit aktiven Warnungen — ohne Gefahrenfilter und ohne Push-Bereich.",
  },
  {
    id: "widget-radar",
    label: "Widget: Radar aktuell (Messung)",
    path: "/embed/widget-radar",
    height: 460,
    description:
      "Zeigt nur die letzte Radarmessung mit Zeitangabe — ohne Filmstrip, Play-Funktion und Prognose.",
  },
  {
    id: "widget-wind",
    label: "Widget: Windprognose aktuell",
    path: "/embed/widget-wind",
    height: 460,
    description:
      "Zeigt nur die Windprognose für die aktuelle bzw. kommende Stunde — ohne Filmstrip und Zeitsteuerung.",
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
    id: "lokalprognose",
    label: "Lokalprognose (wie Original)",
    path: "/embed/lokalprognose",
    height: 230,
    variant: "auto-height",
    description:
      "Die Lokalprognose genau wie auf der Website — Ortssuche, Tageskacheln mit „7 Tage“-Umschalter, Tagesbalken, Stundenverlauf und Fussleiste — nur ohne Wetterboard-Rahmen. Startet schlank mit dem Suchfeld, nach der Ortswahl klappt die volle Prognose auf.",
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
    label: "Windprognose (wie Original)",
    path: "/embed/wind",
    height: 600,
    description:
      "Die vollständige Windprognose wie auf der Website — animierte Windströmung, Böen, Zeitsteuerung und Quellenzeile — nur ohne Wetterboard-Rahmen.",
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
              p.variant === "amriswil"
                ? buildAmriswilSnippet(url, p.path, p.height)
                : p.variant === "auto-height"
                  ? buildAutoHeightSnippet(
                      url,
                      p.path,
                      p.height,
                      p.frameId ?? `otw-${p.id}`,
                      p.label,
                      p.id === "region" ? 520 : 120,
                    )
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
