import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  MapContainer,
  GeoJSON,
  Marker,
  TileLayer,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { renderToStaticMarkup } from "react-dom/server";
import type { Feature, FeatureCollection, Polygon } from "geojson";

import regionData from "@/data/region.json";
import lakeData from "@/data/lake.json";
import { fetchForecast } from "@/lib/weather";
import { WeatherIcon } from "@/components/weather-icons";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type Spot = { id: string; name: string; lat: number; lon: number };

const BRAND = "#2561a1";

const SPOTS: Spot[] = [
  { id: "horn", name: "Horn", lat: 47.4986, lon: 9.4470 },
  { id: "amriswil", name: "Amriswil", lat: 47.5469, lon: 9.2986 },
  { id: "sitterdorf", name: "Sitterdorf", lat: 47.5028, lon: 9.2336 },
  { id: "muensterlingen", name: "Münsterlingen", lat: 47.6306, lon: 9.2378 },
  { id: "uttwil", name: "Uttwil", lat: 47.5944, lon: 9.3408 },
];

const REGION = regionData as unknown as FeatureCollection;
const LAKE = lakeData as unknown as FeatureCollection;

const OUTSIDE_MASK: FeatureCollection = (() => {
  const holes: number[][][] = [];
  const collect = (fc: FeatureCollection) => {
    for (const f of fc.features) {
      const g = f.geometry;
      if (!g) continue;
      if (g.type === "Polygon") {
        if (g.coordinates[0]) holes.push(g.coordinates[0]);
      } else if (g.type === "MultiPolygon") {
        for (const poly of g.coordinates) {
          if (poly[0]) holes.push(poly[0]);
        }
      }
    }
  };
  collect(REGION);
  collect(LAKE);
  const world: number[][] = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  const feat: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [world, ...holes] },
  };
  return { type: "FeatureCollection", features: [feat] };
})();

function formatDayLabel(d: Date, offset: number): { top: string; sub: string } {
  if (offset === 0) return { top: "Heute", sub: dateSub(d) };
  if (offset === 1) return { top: "Morgen", sub: dateSub(d) };
  const wd = new Intl.DateTimeFormat("de-CH", { weekday: "short" }).format(d);
  return { top: wd.replace(".", ""), sub: dateSub(d) };
}

function dateSub(d: Date) {
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

const MARKER_PILL_CLASS = "region-map-pill";

function MarkerPill({
  name,
  tMin,
  tMax,
  code,
  isDay,
}: {
  name: string;
  tMin: number;
  tMax: number;
  code: number;
  isDay: boolean;
}) {
  return (
    <div
      className={MARKER_PILL_CLASS}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px 6px 6px",
        borderRadius: 999,
        background: BRAND,
        boxShadow: "0 6px 20px rgba(0,0,0,0.32)",
        fontFamily: '"Figtree", system-ui, sans-serif',
        color: "#fff",
        lineHeight: 1.05,
        cursor: "pointer",
        transition: "transform 120ms ease",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <WeatherIcon code={code} isDay={isDay} size={30} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.015em" }}>
          {name}
        </span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span
            style={{
              background: "#cfe1f2",
              color: BRAND,
              padding: "2px 7px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {Math.round(tMin)}°
          </span>
          <span
            style={{
              background: "#0d3563",
              color: "#fff",
              padding: "2px 7px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {Math.round(tMax)}°
          </span>
        </div>
      </div>
    </div>
  );

}

function SpotMarker({
  spot,
  mode,
  dayIdx,
  absoluteHour,
  isDay,
  onClick,
}: {
  spot: Spot;
  mode: "hourly" | "daily";
  dayIdx: number;
  absoluteHour: number;
  isDay: boolean;
  onClick: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["map-weather", spot.id],
    queryFn: () => fetchForecast(spot.lat, spot.lon),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });

  const icon = useMemo(() => {
    if (!data) {
      return L.divIcon({
        html: renderToStaticMarkup(
          <div
            style={{
              padding: "4px 9px",
              borderRadius: 999,
              background: BRAND,
              color: "#fff",
              fontFamily: '"Figtree", system-ui, sans-serif',
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {spot.name}
          </div>,
        ),
        className: "region-map-marker",
        iconSize: [120, 24],
        iconAnchor: [60, 12],
      });
    }
    const code =
      mode === "daily"
        ? data.daily.weathercode[dayIdx] ?? 0
        : data.hourly.weathercode[absoluteHour] ??
          data.daily.weathercode[dayIdx] ??
          0;
    const tMin = data.daily.temperature_2m_min[dayIdx] ?? 0;
    const tMax = data.daily.temperature_2m_max[dayIdx] ?? 0;
    const effectiveIsDay = mode === "daily" ? true : isDay;
    const html = renderToStaticMarkup(
      <MarkerPill name={spot.name} tMin={tMin} tMax={tMax} code={code} isDay={effectiveIsDay} />,
    );
    return L.divIcon({
      html,
      className: "region-map-marker",
      iconSize: [190, 60],
      iconAnchor: [95, 30],
    });
  }, [data, mode, dayIdx, absoluteHour, isDay, spot]);

  return (
    <Marker
      position={[spot.lat, spot.lon]}
      icon={icon}
      eventHandlers={{ click: onClick }}
    />
  );
}


// (Bodensee-Label entfernt)

function currentBaseHour(): number {
  // aktuelle volle Stunde (zuletzt abgelaufene Stunde)
  return new Date().getHours();
}

const MAX_STEPS = 24; // 24 × 1-h-Schritte (rollierendes 24-h-Fenster)
const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

function longWeekday(d: Date): string {
  const wd = new Intl.DateTimeFormat("de-CH", { weekday: "long" }).format(d);
  return wd.charAt(0).toUpperCase() + wd.slice(1);
}

export function RegionMap() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const router = useRouter();

  // baseHour = absolute Stunde "jetzt" (gerundet auf 3-h-Slot), gemessen ab heute 00:00.
  const [baseHour, setBaseHour] = useState(() => currentBaseHour());
  const [stepOffset, setStepOffset] = useState(0);
  const [viewMode, setViewMode] = useState<"hourly" | "daily">("hourly");
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  // Nachrücken: jede Minute prüfen, ob ein neuer 3-h-Slot begonnen hat.
  useEffect(() => {
    const tick = () => {
      const next = currentBaseHour();
      if (next !== baseHour) {
        const absolute = baseHour + stepOffset * 3;
        const newOffset = Math.round((absolute - next) / 3);
        setBaseHour(next);
        setStepOffset(newOffset >= 0 && newOffset <= MAX_STEPS ? newOffset : 0);
      }
    };
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [baseHour, stepOffset]);

  const absoluteHour = baseHour + stepOffset * 3;
  const hourlyDayIndex = Math.floor(absoluteHour / 24);
  const dayIndex = viewMode === "daily" ? selectedDayIdx : hourlyDayIndex;
  const hourOfDay = absoluteHour % 24;
  const isDay = hourOfDay >= 6 && hourOfDay < 20;


  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const { center, maxBounds } = useMemo(() => {
    const layer = L.geoJSON(REGION);
    const b = layer.getBounds();
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    const extended = L.latLngBounds(
      [sw.lat - 0.001, sw.lng - 0.001],
      [ne.lat + 0.001, ne.lng + 0.001],
    );
    const c = b.getCenter();
    return {
      center: [c.lat, c.lng] as [number, number],
      maxBounds: extended.pad(0.3),
    };
  }, []);


  if (!mounted) {
    return (
      <div className="flex h-[500px] w-full items-center justify-center rounded-2xl bg-muted/30 text-sm text-muted-foreground shadow-lg">
        Karte wird geladen …
      </div>
    );
  }

  const hourLabel = `${String(hourOfDay).padStart(2, "0")}:00`;
  const activeDayLabel = formatDayLabel(
    days[Math.min(dayIndex, days.length - 1)],
    dayIndex,
  );

  const goHome = () => {
    router.navigate({ to: "/" }).catch(() => {
      if (typeof window !== "undefined") window.location.assign("/");
    });
  };

  return (
    <div className="space-y-4">
      {/* Karte */}
      <div className="relative h-[420px] w-full overflow-hidden rounded-2xl shadow-lg sm:h-[600px]">
        <MapContainer
          center={center}
          zoom={11}
          maxBounds={maxBounds}
          maxBoundsViscosity={1.0}
          minZoom={9}
          maxZoom={17}
          scrollWheelZoom
          zoomControl={false}
          attributionControl={true}
          style={{ height: "100%", width: "100%", background: "#e8edef" }}
        >
          <TileLayer
            url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.leichte-basiskarte/default/current/3857/{z}/{x}/{y}.png"
            maxZoom={18}
            attribution='© <a href="https://www.swisstopo.admin.ch/">swisstopo</a>, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {/* Relief-Schummerung (swissALTI3D) — stärker */}
          <TileLayer
            url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissalti3d-reliefschattierung/default/current/3857/{z}/{x}/{y}.png"
            maxZoom={18}
            opacity={0.65}
          />
          {/* Aussen-Maske: Grau (See + Region ausgestanzt) */}
          <GeoJSON
            data={OUTSIDE_MASK}
            style={() => ({
              stroke: false,
              fillColor: "#5a6670",
              fillOpacity: 0.6,
            })}
            interactive={false}
          />
          {/* See unter der Region zeichnen */}
          <GeoJSON
            data={LAKE}
            style={() => ({
              color: "#6bb6d6",
              weight: 0.6,
              fillColor: "#7ec8e3",
              fillOpacity: 0.9,
            })}
            interactive={false}
          />
          {/* Region innen: rein visuell, kein Klick (Klick geschieht über Marker) */}
          <GeoJSON
            data={REGION}
            style={() => ({
              color: BRAND,
              weight: 2,
              opacity: 0.9,
              fillColor: "#7ebd5a",
              fillOpacity: 0.55,
            })}
            interactive={false}
          />
          {SPOTS.map((s) => (
            <SpotMarker
              key={s.id}
              spot={s}
              mode={viewMode}
              dayIdx={dayIndex}
              absoluteHour={absoluteHour}
              isDay={isDay}
              onClick={goHome}
            />
          ))}
          <ZoomControl position="topright" />
        </MapContainer>
      </div>

      {/* Stündlich-Toggle + Wochentage */}
      <div className="no-scrollbar flex w-full gap-1 overflow-x-auto rounded-full bg-muted p-1">
        <button
          type="button"
          onClick={() => {
            setStepOffset(0);
            setViewMode("hourly");
          }}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm",
            viewMode === "hourly"
              ? "text-white shadow"
              : "text-foreground hover:bg-foreground/5",
          )}
          style={viewMode === "hourly" ? { background: BRAND } : undefined}
          aria-label="Stündliche Ansicht"
          title="Stündliche Ansicht"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 15 14" />
          </svg>
          <span className="hidden leading-tight sm:inline">Stündlich</span>
        </button>
        {days.map((d, i) => {
          const { top, sub } = formatDayLabel(d, i);
          const active = viewMode === "daily" && i === selectedDayIdx;
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                setSelectedDayIdx(i);
                setViewMode("daily");
              }}
              className={cn(
                "flex shrink-0 flex-1 flex-col items-center justify-center rounded-full px-2 py-2 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
                active
                  ? "text-white shadow"
                  : "text-foreground hover:bg-foreground/5",
              )}
              style={active ? { background: BRAND } : undefined}
            >
              <span className="font-semibold leading-tight">{top}</span>
              <span
                className={cn(
                  "text-[10px] leading-tight sm:text-xs",
                  active ? "text-white/80" : "text-muted-foreground",
                )}
              >
                {sub}
              </span>
            </button>
          );
        })}
      </div>



      {/* Moderner 3-Stunden-Zeitstrahl mit Stundenlegende */}
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="mb-2 flex items-end justify-between">
          <div className="flex flex-col">
            <span className="font-[family-name:var(--font-display)] text-lg font-semibold leading-tight text-foreground">
              {longWeekday(days[Math.min(dayIndex, days.length - 1)])}
            </span>
            <span className="text-xs text-muted-foreground">
              {viewMode === "daily" ? "Tagesübersicht" : activeDayLabel.sub}
            </span>
          </div>
          {viewMode === "daily" ? (
            <span className="rounded-lg border border-border bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">
              Tagesübersicht
            </span>
          ) : (
            <span
              className="rounded-lg px-3 py-1 text-base font-bold text-white shadow-sm"
              style={{ background: BRAND }}
            >
              {hourLabel}
            </span>
          )}
        </div>


        <div
          className={cn(
            "region-slider px-1",
            viewMode === "daily" && "pointer-events-none opacity-40",
          )}
        >
          <Slider
            min={0}
            max={MAX_STEPS}
            step={1}
            value={[stepOffset]}
            onValueChange={(v) => setStepOffset(v[0] ?? 0)}
            disabled={viewMode === "daily"}
          />
        </div>


        {/* Stundenlegende: 00, 03, 06, … 21, 00 */}
        <div className={cn("mt-2 px-1", viewMode === "daily" && "opacity-40")}>
          <div className="relative h-1.5">
            {HOUR_TICKS.map((h) => (
              <span
                key={`tick-${h}`}
                className="absolute top-0 h-1.5 w-px bg-border"
                style={{ left: `${(h / 24) * 100}%` }}
              />
            ))}
          </div>
          <div className="relative mt-0.5 h-3">
            {HOUR_TICKS.map((h) => {
              const display = h === 24 ? 0 : h;
              const active = h !== 24 && h === Math.floor(hourOfDay / 3) * 3;
              return (
                <span
                  key={`label-${h}`}
                  className={cn(
                    "absolute top-0 -translate-x-1/2 text-[10px] tabular-nums",
                    active ? "font-bold" : "font-medium text-muted-foreground",
                  )}
                  style={{
                    left: `${(h / 24) * 100}%`,
                    color: active ? BRAND : undefined,
                  }}
                >
                  {String(display).padStart(2, "0")}
                </span>
              );
            })}
          </div>
        </div>

        <div className="mt-1.5 flex justify-between text-[11px] font-medium text-muted-foreground">
          <span>jetzt</span>
          <span>+24 Std</span>
        </div>
      </div>
    </div>
  );
}
