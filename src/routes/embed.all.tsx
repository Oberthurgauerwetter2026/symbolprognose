import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { EmbedShell } from "@/components/embed-shell";

import { MAPS, type MapId } from "@/lib/maps-config";
import { WeatherWidget } from "@/components/weather-widget";
import { ComingSoonMap } from "@/components/maps/coming-soon-map";
import { cn } from "@/lib/utils";

const BRAND = "#2561a1";
const RegionMap = lazy(() =>
  import("@/components/region-map").then((module) => ({ default: module.RegionMap })),
);

export const Route = createFileRoute("/embed/all")({
  ssr: false,
  component: EmbedAll,
  head: () => ({
    meta: [
      { title: "Wetter-Karten (Embed, alle)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedAll() {
  const [active, setActive] = useState<MapId>("region");

  return (
    <EmbedShell>
      <div className="no-scrollbar -mx-1 mb-4 flex gap-1 overflow-x-auto rounded-full bg-muted p-1">
        {MAPS.filter((m) => !m.internal).map((m) => {
          const Icon = m.icon;
          const isActive = m.id === active;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActive(m.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm",
                isActive
                  ? "text-white shadow"
                  : "text-foreground hover:bg-foreground/5",
              )}
              style={isActive ? { background: BRAND } : undefined}
            >
              <Icon className="h-4 w-4" />
              <span>{m.shortLabel}</span>
              {m.status === "coming-soon" && (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                    isActive ? "bg-white/20 text-white" : "bg-background text-muted-foreground",
                  )}
                >
                  bald
                </span>
              )}
            </button>
          );
        })}
      </div>

      {active === "region" && (
        <Suspense fallback={<div className="h-[620px] rounded-lg bg-muted" />}>
          <RegionMap />
        </Suspense>
      )}
      {active === "lokal" && <WeatherWidget />}
      {(active === "wind" || active === "radar" || active === "pollen") && (
        <ComingSoonMap
          icon={MAPS.find((m) => m.id === active)!.icon}
          title={MAPS.find((m) => m.id === active)!.label}
          description={MAPS.find((m) => m.id === active)!.description}
        />
      )}
    </EmbedShell>
  );
}
