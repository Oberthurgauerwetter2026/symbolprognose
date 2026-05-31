import { Link } from "@tanstack/react-router";
import { MAPS, type MapId } from "@/lib/maps-config";
import { cn } from "@/lib/utils";

const BRAND = "#2561a1";

export function MapTabs({ active }: { active: MapId }) {
  return (
    <div className="no-scrollbar -mx-1 mb-5 flex gap-1 overflow-x-auto rounded-full bg-muted p-1">
      {MAPS.filter((m) => !m.internal).map((m) => {
        const Icon = m.icon;
        const isActive = m.id === active;
        return (
          <Link
            key={m.id}
            to={m.routePath}
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
          </Link>
        );
      })}
    </div>
  );
}
