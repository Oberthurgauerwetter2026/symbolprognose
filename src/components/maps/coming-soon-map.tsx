import type { LucideIcon } from "lucide-react";

export function ComingSoonMap({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-4">
      <div className="relative h-[420px] w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-muted/50 to-muted shadow-lg sm:h-[600px]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex max-w-md flex-col items-center gap-4 px-6 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg"
              style={{ background: "#2561a1" }}
            >
              <Icon className="h-8 w-8" />
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
                {title}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </div>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Bald verfügbar
            </span>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground">
        Diese Karte ist in Vorbereitung. Sobald die Datenquelle angebunden ist, erscheint hier die interaktive Ansicht mit Zeitslider — analog zur Wetterkarte Region.
      </div>
    </div>
  );
}
