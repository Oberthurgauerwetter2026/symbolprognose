import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MAPS } from "@/lib/maps-config";

export const Route = createFileRoute("/embed-info")({
  component: EmbedInfo,
  head: () => ({
    meta: [{ title: "Embed-Snippets · WordPress" }],
  }),
});

function buildSnippet(url: string, path: string, idSuffix: string, minHeight = 760) {
  return `<iframe
  id="wx-${idSuffix}"
  src="${url}${path}"
  style="width:100%;min-height:${minHeight}px;border:0;display:block"
  loading="lazy"
  title="Wetter-Karte"
></iframe>
<script>
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "lovable-weather:height") {
      var f = document.getElementById("wx-${idSuffix}");
      if (f) f.style.height = e.data.height + "px";
    }
  });
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

function EmbedInfo() {
  const url =
    typeof window !== "undefined" ? window.location.origin : "https://…";

  return (
    <DashboardLayout
      title="Embed-Snippets"
      subtitle="iframe-Code für WordPress, pro Karte oder Komplett-Widget"
    >
      <div className="mx-auto w-full max-w-3xl space-y-10 px-4 py-8">
        <p className="text-sm text-muted-foreground">
          Füge im WordPress-Editor einen <strong>Custom-HTML-Block</strong> ein und kopiere das Snippet (inkl. <code>&lt;script&gt;</code>) hinein. Die Breite passt sich dem Container an, die Höhe wird per <code>postMessage</code> automatisch nachgeführt.
        </p>

        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            Komplett-Widget (alle Karten mit Tabs)
          </h2>
          <p className="text-sm text-muted-foreground">
            Region, Lokalprognose, Wind, Radar und Pollen in einer einzigen Einbettung. Besucher wechseln im iframe selbst.
          </p>
          <SnippetBlock snippet={buildSnippet(url, "/embed/all", "all")} />
        </section>

        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            Karte + Lokalprognose Amriswil
          </h2>
          <p className="text-sm text-muted-foreground">
            Wetterkarte (nur Karte, ohne Tabs/Slider) und direkt darunter die Detailprognose für Amriswil – ohne Suche, Ortsname oder Tagesleiste.
          </p>
          <SnippetBlock snippet={buildSnippet(url, "/embed/region-lokal", "region-lokal", 1100)} />
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
                <SnippetBlock snippet={buildSnippet(url, m.embedPath, m.id)} />
              </div>
            );
          })}
        </section>

        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p>
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
