import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/embed-info")({
  component: EmbedInfo,
  head: () => ({
    meta: [{ title: "Einbinden in WordPress" }],
  }),
});

function buildSnippet(url: string, minimal: boolean) {
  const src = minimal ? `${url}/?embed=minimal` : `${url}/`;
  return `<iframe
  id="wx-widget${minimal ? "-min" : ""}"
  src="${src}"
  style="width:100%;min-height:760px;border:0;display:block"
  loading="lazy"
  title="5-Tage Wetterprognose"
></iframe>
<script>
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "lovable-weather:height") {
      var f = document.getElementById("wx-widget${minimal ? "-min" : ""}");
      if (f) f.style.height = e.data.height + "px";
    }
  });
</script>`;
}

function SnippetBlock({ snippet, id }: { snippet: string; id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre
        id={id}
        className="bg-zinc-900 text-zinc-100 text-xs p-4 rounded-sm overflow-x-auto font-mono"
      >
        {snippet}
      </pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(snippet);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute top-2 right-2 h-7 px-3 bg-accent text-accent-foreground text-[10px] font-semibold uppercase tracking-widest rounded-sm"
      >
        {copied ? "Kopiert" : "Kopieren"}
      </button>
    </div>
  );
}

function EmbedInfo() {
  const url =
    typeof window !== "undefined" ? window.location.origin : "https://…";

  const fullSnippet = buildSnippet(url, false);
  const minimalSnippet = buildSnippet(url, true);

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight uppercase font-[family-name:var(--font-display)]">
            In WordPress einbinden
          </h1>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Füge im WordPress-Editor einen <strong>Custom-HTML-Block</strong>{" "}
            ein und kopiere das komplette Snippet (inkl.{" "}
            <code>&lt;script&gt;</code>-Block) hinein. Die Breite passt sich
            automatisch dem Beitrags-Container an, die Höhe wird per{" "}
            <code>postMessage</code> dynamisch angepasst — auch auf Smartphones.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Standard-Variante (mit Gemeindesuche)
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Besucher können den Ort selbst wählen oder per "Ortung" den eigenen
            Standort verwenden.
          </p>
          <SnippetBlock snippet={fullSnippet} id="snippet-full" />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Minimal-Variante (ohne Gemeindesuche)
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Zeigt nur die Prognose und den "Ortung"-Knopf — kein Suchfeld.
            Ideal für Seiten, die einen festen Ort anzeigen oder die Auswahl
            allein der Geolokalisierung überlassen wollen.
          </p>
          <SnippetBlock snippet={minimalSnippet} id="snippet-min" />
        </section>

        <div className="text-[11px] text-zinc-500 space-y-1">
          <p>
            <strong>Tipp:</strong> Auf Smartphones erscheint im Widget ein
            "Ortung"-Knopf, der den aktuellen Standort verwendet.
          </p>
          <p>
            Datenquelle: MeteoSchweiz ICON-CH1/CH2 &amp; ECMWF IFS via
            Open-Meteo (kostenlos für nicht-kommerzielle Nutzung).
          </p>
        </div>
      </div>
    </div>
  );
}
