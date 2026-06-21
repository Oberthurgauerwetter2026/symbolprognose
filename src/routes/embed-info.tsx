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
 * Einfaches iframe-Snippet ohne JS-Fallback. Für alle Karten ausser
 * Lokalprognose Amriswil, die weiter das postMessage-Höhen-Skript braucht.
 */
function buildSimpleSnippet(url: string, path: string, height = 600) {
  const full = `${url}${path}`;
  const origin = new URL(url).origin;
  return `<link rel="preconnect" href="${origin}" crossorigin>
<link rel="dns-prefetch" href="${origin}">
<iframe
  src="${full}"
  loading="eager"
  fetchpriority="high"
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
          Füge im WordPress-Editor einen <strong>Custom-HTML-Block</strong> (oder iframe-Block) ein und kopiere das Snippet hinein.
        </p>
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Die Snippets zeigen immer auf die publizierte URL <code>{PUBLISHED_ORIGIN}</code>. Nach Code-Änderungen zuerst publishen, damit sie in WordPress sichtbar werden.
        </p>

        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            Komplett-Widget (alle Karten mit Tabs)
          </h2>
          <p className="text-sm text-muted-foreground">
            Region, Lokalprognose, Wind und Radar in einer einzigen Einbettung. Besucher wechseln im iframe selbst.
          </p>
          <SnippetBlock snippet={buildSimpleSnippet(url, "/embed/all", 760)} />
        </section>

        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            Lokalprognose Amriswil
          </h2>
          <p className="text-sm text-muted-foreground">
            Kompakte Monitor-Version mit Wettersymbolen: reine HTML-Prognose ohne JavaScript, passt neben die TWINT-Spalte. Der Wert <code>height:640px</code> kann bei Bedarf angepasst werden.
          </p>
          <SnippetBlock snippet={buildAmriswilSnippet(url, "/api/public/embed/region-lokal-static", 640)} />
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

          {MAPS.filter((m) => !m.internal && m.embedPath).map((m) => {
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
                <SnippetBlock snippet={buildSimpleSnippet(url, m.embedPath!, 600)} />
              </div>
            );
          })}
        </section>
      </div>
    </DashboardLayout>
  );
}
