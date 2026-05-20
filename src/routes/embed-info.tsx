import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/embed-info")({
  component: EmbedInfo,
  head: () => ({
    meta: [{ title: "Einbinden in WordPress" }],
  }),
});

function EmbedInfo() {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined" ? window.location.origin : "https://…";

  const snippet = `<iframe
  id="wx-widget"
  src="${url}/"
  style="width:100%;min-height:760px;border:0;display:block"
  loading="lazy"
  title="5-Tage Wetterprognose"
></iframe>
<script>
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "lovable-weather:height") {
      var f = document.getElementById("wx-widget");
      if (f) f.style.height = e.data.height + "px";
    }
  });
</script>`;

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight uppercase">
          In WordPress einbinden
        </h1>
        <p className="text-sm text-zinc-600 leading-relaxed">
          Füge im WordPress-Editor einen <strong>Custom-HTML-Block</strong> ein
          und kopiere das komplette Snippet (inkl. <code>&lt;script&gt;</code>-Block)
          hinein. Die Breite passt sich automatisch dem Beitrags-Container an,
          die Höhe wird per <code>postMessage</code> dynamisch an den Inhalt
          angepasst — auch auf Smartphones.
        </p>

        <div className="relative">
          <pre className="bg-zinc-900 text-zinc-100 text-xs p-4 rounded-sm overflow-x-auto font-mono">
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

        <div className="text-[11px] text-zinc-500 space-y-1">
          <p>
            <strong>Tipp:</strong> Auf Smartphones erscheint im Widget ein
            "Ortung"-Knopf, der den aktuellen Standort verwendet.
          </p>
          <p>
            Datenquelle: MeteoSchweiz ICON-CH2 via Open-Meteo (kostenlos für
            nicht-kommerzielle Nutzung).
          </p>
        </div>
      </div>
    </div>
  );
}
