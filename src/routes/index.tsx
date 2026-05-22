import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MAPS } from "@/lib/maps-config";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Wetter-Board · Übersicht" },
      {
        name: "description",
        content:
          "Karten-Board für Region, Lokalprognose, Wind, Radar und Pollen. Jede Karte einzeln in WordPress einbettbar.",
      },
    ],
  }),
});

function Dashboard() {
  // Legacy: /?embed=... → alte Lokalprognose-Embeds umleiten
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.has("embed")) {
      const target = `/embed/lokal${window.location.search}`;
      window.location.replace(target);
    }
  }

  return (
    <DashboardLayout
      title="Wetter-Board"
      subtitle="Karten für Region Oberthurgau · jede Karte einzeln einbettbar"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground sm:text-3xl">
            Übersicht
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alle Karten auf einen Blick. Klicke eine Kachel, um die Karte zu öffnen — oder hole dir das Embed-Snippet aus dem Werkzeug-Menü.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MAPS.map((m, i) => {
            const Icon = m.icon;
            const featured = i === 0;
            return (
              <Link
                key={m.id}
                to={m.routePath}
                className={`group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  featured ? "sm:col-span-2 lg:col-span-2 lg:row-span-2" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow"
                    style={{ background: "#2561a1" }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      m.status === "live"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {m.status === "live" ? "Live" : "Bald"}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
                    {m.label}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                </div>
                <div className="mt-2 flex items-center gap-1 text-sm font-semibold text-foreground/80 transition-colors group-hover:text-foreground">
                  Öffnen <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/50 p-5">
          <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground">
            In WordPress einbinden
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Jede Karte hat eine eigene Embed-URL. Zusätzlich gibt es ein Komplett-Widget mit Tab-Leiste über alle Karten.
          </p>
          <Link
            to="/embed-info"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:underline"
          >
            Snippets ansehen <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
