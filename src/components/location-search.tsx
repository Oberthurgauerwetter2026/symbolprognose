/**
 * Gemeinsames Ortssuchfeld für Regionskarte (Overlay) und Lokalprognose (Inline).
 * Teilt den Verlauf der letzten 3 Suchen über localStorage.
 */

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { searchLocations, type GeoLocation } from "@/lib/weather";
import { SITE_URL } from "@/lib/site-url";
import { cn } from "@/lib/utils";

const RECENT_KEY = "otw:lokal-recent";

export interface RecentPlace {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
}

export function readRecentPlaces(): RecentPlace[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as RecentPlace[]) : [];
    return Array.isArray(arr) ? arr.filter((p) => p && p.name).slice(0, 3) : [];
  } catch {
    return [];
  }
}

function pushRecent(p: RecentPlace): RecentPlace[] {
  const next = [
    p,
    ...readRecentPlaces().filter(
      (r) =>
        r.name !== p.name ||
        Math.abs(r.latitude - p.latitude) > 1e-4 ||
        Math.abs(r.longitude - p.longitude) > 1e-4,
    ),
  ].slice(0, 3);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* Speicher nicht verfügbar – Verlauf ist optional */
  }
  return next;
}

export function LocationSearch({
  variant = "inline",
  bare = false,
  onSelect,
  placeholder = "Ort, PLZ suchen",
  className,
}: {
  /** overlay = schwebendes Band über der Karte, inline = Formularfeld im Header. */
  variant?: "overlay" | "inline";
  /** Embed-Modus: Navigation öffnet einen neuen Tab (nur ohne onSelect). */
  bare?: boolean;
  /** Wenn gesetzt, wird der Ort direkt übernommen statt navigiert. */
  onSelect?: (loc: GeoLocation) => void;
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  const [recent, setRecent] = useState<RecentPlace[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setRecent(readRecentPlaces()), []);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), 300);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const results = useQuery({
    queryKey: ["geo-search", debounced],
    queryFn: () => searchLocations(debounced),
    enabled: debounced.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const go = (p: RecentPlace) => {
    setRecent(pushRecent(p));
    setQuery("");
    setDebounced("");
    setOpen(false);

    if (onSelect) {
      onSelect({
        id: Math.round((p.latitude + p.longitude) * 1e5),
        name: p.name,
        latitude: p.latitude,
        longitude: p.longitude,
        admin1: p.admin1,
      });
      return;
    }

    const qs = new URLSearchParams({
      lat: String(p.latitude),
      lon: String(p.longitude),
      name: p.name,
    });
    if (bare) {
      window.open(`${SITE_URL}/karten/lokal?${qs.toString()}`, "_blank", "noopener");
      return;
    }
    router
      .navigate({
        to: "/karten/lokal",
        search: { lat: p.latitude, lon: p.longitude, name: p.name },
      })
      .catch(() => window.location.assign(`/karten/lokal?${qs.toString()}`));
  };

  const list =
    debounced.trim().length >= 2
      ? (results.data ?? []).map((r) => ({
          key: String(r.id),
          name: r.name,
          admin1: r.admin1,
          latitude: r.latitude,
          longitude: r.longitude,
        }))
      : recent.map((r, i) => ({
          key: `recent-${i}-${r.name}`,
          name: r.name,
          admin1: r.admin1,
          latitude: r.latitude,
          longitude: r.longitude,
        }));

  const showList = open && list.length > 0;
  const overlay = variant === "overlay";

  return (
    <div
      ref={boxRef}
      className={cn(
        overlay
          ? "pointer-events-auto absolute left-2 right-2 top-2 z-[900] rounded-lg"
          : "relative w-full",
        className,
      )}
      onWheel={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "relative rounded-lg",
          overlay
            ? "bg-primary/30 px-3 py-2 shadow-sm backdrop-blur-sm"
            : "border border-zinc-200 bg-zinc-50 px-3 focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/30",
        )}
      >
        <div className="flex items-center gap-2">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            className={cn(
              "shrink-0",
              overlay ? "text-primary-foreground/90" : "text-zinc-500",
            )}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" && list.length > 0) go(list[0]);
            }}
            placeholder={placeholder}
            aria-label="Ort für Lokalprognose suchen"
            className={cn(
              "w-full min-w-0 border-0 bg-transparent text-sm font-medium focus:outline-none",
              overlay
                ? "h-8 text-primary-foreground placeholder:text-primary-foreground/70"
                : "h-10 text-zinc-900 placeholder:text-zinc-500",
            )}
          />
        </div>

        {showList && (
          <ul
            className={cn(
              "absolute max-h-64 overflow-y-auto border border-border/60 bg-card shadow-xl",
              overlay
                ? "inset-x-2 top-[calc(100%-2px)] rounded-b-lg"
                : "inset-x-0 top-[calc(100%+4px)] z-20 rounded-md",
            )}
          >
            {debounced.trim().length < 2 && (
              <li className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Zuletzt gesucht
              </li>
            )}
            {list.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => go(r)}
                  className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="font-semibold text-foreground">{r.name}</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {r.admin1 ?? "CH"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
