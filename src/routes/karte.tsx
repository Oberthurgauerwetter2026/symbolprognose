import { createFileRoute, Link } from "@tanstack/react-router";
import { RegionMap } from "@/components/region-map";

export const Route = createFileRoute("/karte")({
  component: KartePage,
  head: () => ({
    meta: [
      { title: "Wetterkarte Region · Symbolprognose" },
      {
        name: "description",
        content:
          "Interaktive Karte mit Symbolprognose, Temperatur und Wind für Horn, Amriswil, Sitterdorf und Münsterlingen. Aktualisiert sich jede Stunde.",
      },
      { property: "og:title", content: "Wetterkarte Region · Symbolprognose" },
      {
        property: "og:description",
        content:
          "Interaktive Karte mit aktueller Symbolprognose an vier Standorten der Region Oberthurgau.",
      },
    ],
  }),
});

function KartePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-foreground">
            Wetterkarte Region
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aktuelle Symbolprognose mit Temperatur und Wind · aktualisiert jede Stunde
          </p>
        </div>
        <Link
          to="/"
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          ← Zur Prognose
        </Link>
      </div>
      <RegionMap />
    </main>
  );
}
