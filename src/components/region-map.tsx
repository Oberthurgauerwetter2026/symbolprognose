import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  MapContainer,
  GeoJSON,
  Marker,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";

function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  });
  return null;
}

function BoundsFitter({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [4, 4] });
    };
    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    const ro = new ResizeObserver(fit);
    ro.observe(map.getContainer());
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
      ro.disconnect();
    };
  }, [map, bounds]);
  return null;
}
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { renderToStaticMarkup } from "react-dom/server";
import type { Feature, FeatureCollection, Polygon } from "geojson";

import regionData from "@/data/region.json";
import lakeData from "@/data/lake.json";
import thurgauData from "@/data/thurgau.json";
import switzerlandData from "@/data/switzerland.json";
import { fetchForecast } from "@/lib/weather";
import { WeatherIcon } from "@/components/weather-icons";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

import { SPOTS, type Spot } from "@/data/spots";

const BRAND = "#2561a1";


const REGION = regionData as unknown as FeatureCollection;
const LAKE = lakeData as unknown as FeatureCollection;
const THURGAU = thurgauData as unknown as FeatureCollection;
const SWITZERLAND = switzerlandData as unknown as FeatureCollection;

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

const OUTSIDE_CH_MASK: FeatureCollection = (() => {
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
  collect(SWITZERLAND);
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
  mode,
  tMin,
  tMax,
  tNow,
  code,
  isDay,
}: {
  name: string;
  mode: "hourly" | "daily";
  tMin: number;
  tMax: number;
  tNow: number;
  code: number;
  isDay: boolean;
}) {
  return (
    <div
      className={MARKER_PILL_CLASS}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px 8px 10px",
        borderRadius: 999,
        background: BRAND,
        border: "1px solid rgba(255,255,255,0.25)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.10)",
        fontFamily: '"Figtree", system-ui, sans-serif',
        color: "#fff",
        lineHeight: 1.15,
        cursor: "pointer",
        transition: "transform 120ms ease, box-shadow 150ms ease",
        whiteSpace: "nowrap",
      }}
    >
      <WeatherIcon code={code} isDay={isDay} size={40} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
            letterSpacing: "0.04em",
            lineHeight: 1,
            textTransform: "uppercase",
          }}
        >
          {name}
        </span>
        <div style={{ display: "flex", gap: 4, alignItems: "baseline" }}>
          {mode === "daily" ? (
            <>
              <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>
                {Math.round(tMin)}°
              </span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>/</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
                {Math.round(tMax)}°
              </span>
            </>
          ) : (
            <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
              {Math.round(tNow)}°
            </span>
          )}
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
              padding: "6px 14px",
              borderRadius: 999,
              background: BRAND,
              border: "1px solid rgba(255,255,255,0.25)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              color: "rgba(255,255,255,0.85)",
              fontFamily: '"Figtree", system-ui, sans-serif',
              fontSize: 12,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {spot.name}
          </div>,
        ),
        className: "region-map-marker",
        iconSize: [160, 32],
        iconAnchor: [80, 16],
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
    const tNow = data.hourly.temperature_2m[absoluteHour] ?? tMax;
    const effectiveIsDay = mode === "daily" ? true : isDay;
    const html = renderToStaticMarkup(
      <MarkerPill name={spot.name} mode={mode} tMin={tMin} tMax={tMax} tNow={tNow} code={code} isDay={effectiveIsDay} />,
    );
    return L.divIcon({
      html,
      className: "region-map-marker",
      iconSize: [170, 52],
      iconAnchor: [85, 26],
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

function DayTabs({
  days,
  viewMode,
  selectedDayIdx,
  onSelectHourly,
  onSelectDay,
}: {
  days: Date[];
  viewMode: "hourly" | "daily";
  selectedDayIdx: number;
  onSelectHourly: () => void;
  onSelectDay: (i: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const activeIndex = viewMode === "hourly" ? 0 : selectedDayIdx + 1;

  useLayoutEffect(() => {
    const measure = () => {
      const btn = btnRefs.current[activeIndex];
      const container = containerRef.current;
      if (!btn || !container) return;
      setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeIndex, days.length]);

  return (
    <div
      ref={containerRef}
      className="no-scrollbar relative flex w-full gap-1 overflow-x-auto rounded-full bg-muted p-1"
    >
      {indicator && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 rounded-full shadow"
          style={{
            left: indicator.left,
            width: indicator.width,
            background: BRAND,
            transition:
              "left 260ms cubic-bezier(0.22, 1, 0.36, 1), width 260ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      )}
      <button
        ref={(el) => {
          btnRefs.current[0] = el;
        }}
        type="button"
        onClick={onSelectHourly}
        className={cn(
          "relative z-10 flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors duration-200 sm:px-4 sm:text-sm",
          viewMode === "hourly" ? "text-white" : "text-foreground hover:bg-foreground/5",
        )}
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
            ref={(el) => {
              btnRefs.current[i + 1] = el;
            }}
            type="button"
            onClick={() => onSelectDay(i)}
            className={cn(
              "relative z-10 flex shrink-0 flex-1 flex-col items-center justify-center rounded-full px-2 py-2 text-xs font-medium transition-colors duration-200 sm:px-3 sm:text-sm",
              active ? "text-white" : "text-foreground hover:bg-foreground/5",
            )}
          >
            <span className="font-semibold leading-tight">{top}</span>
            <span
              className={cn(
                "text-[10px] leading-tight transition-colors duration-200 sm:text-xs",
                active ? "text-white/80" : "text-muted-foreground",
              )}
            >
              {sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function RegionMap({ bare = false, fill = false }: { bare?: boolean; fill?: boolean } = {}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const router = useRouter();

  // baseHour = absolute Stunde "jetzt" (gerundet auf 3-h-Slot), gemessen ab heute 00:00.
  const [baseHour, setBaseHour] = useState(() => currentBaseHour());
  const [stepOffset, setStepOffset] = useState(0);
  const [viewMode, setViewMode] = useState<"hourly" | "daily">("daily");
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [zoom, setZoom] = useState(11);

  // Nachrücken: jede Minute prüfen, ob eine neue Stunde begonnen hat.
  useEffect(() => {
    const tick = () => {
      const next = currentBaseHour();
      if (next !== baseHour) {
        const absolute = baseHour + stepOffset;
        const newOffset = absolute - next;
        setBaseHour(next);
        setStepOffset(newOffset >= 0 && newOffset <= MAX_STEPS ? newOffset : 0);
      }
    };
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [baseHour, stepOffset]);

  const absoluteHour = baseHour + stepOffset;
  const hourlyDayIndex = Math.floor(absoluteHour / 24);
  const dayIndex = viewMode === "daily" ? selectedDayIdx : hourlyDayIndex;
  const hourOfDay = absoluteHour % 24;
  const isDay = hourOfDay >= 6 && hourOfDay < 20;


  // Datenstand vom ersten Spot (Cache wird mit den Markern geteilt).
  const firstSpot = SPOTS[0];
  const { dataUpdatedAt } = useQuery({
    queryKey: ["map-weather", firstSpot.id],
    queryFn: () => fetchForecast(firstSpot.lat, firstSpot.lon),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });

  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const { center, maxBounds, regionBounds } = useMemo(() => {
    const layer = L.geoJSON(REGION);
    const b = layer.getBounds();
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    const extended = L.latLngBounds(
      [sw.lat - 0.001, sw.lng - 0.001],
      [ne.lat + 0.001, ne.lng + 0.001],
    );
    const c = b.getCenter();
    // Etwas Puffer, damit Marker-Pills komplett ins Bild passen
    const fit = L.latLngBounds(
      [sw.lat - 0.002, sw.lng - 0.002],
      [ne.lat + 0.002, ne.lng + 0.002],
    );
    return {
      center: [c.lat, c.lng] as [number, number],
      maxBounds: extended.pad(0.3),
      regionBounds: fit,
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

  // Datum/Zeit am aktuellen Slider-Punkt
  const sliderDate = (() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(baseHour + stepOffset);
    return d;
  })();
  const sliderWeekday = new Intl.DateTimeFormat("de-CH", { weekday: "long" }).format(sliderDate);
  const sliderWeekdayCap = sliderWeekday.charAt(0).toUpperCase() + sliderWeekday.slice(1);
  const sliderDateStr = new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(sliderDate);
  const sliderTimeStr = `${String(sliderDate.getHours()).padStart(2, "0")}:00`;
  const thumbPct = MAX_STEPS > 0 ? (stepOffset / MAX_STEPS) * 100 : 0;
  const HOUR_LABELS = Array.from({ length: 25 }, (_, i) => i);

  const goToLokal = (spot: Spot) => {
    router
      .navigate({
        to: "/karten/lokal",
        search: { lat: spot.lat, lon: spot.lon, name: spot.name },
      })
      .catch(() => {
        if (typeof window !== "undefined") {
          const qs = new URLSearchParams({
            lat: String(spot.lat),
            lon: String(spot.lon),
            name: spot.name,
          });
          window.location.assign(`/karten/lokal?${qs.toString()}`);
        }
      });
  };

  return (
    <div className={cn("@container", fill ? "flex h-full w-full flex-col" : "space-y-4")}>
      {/* Karte */}
      <div
        className={cn(
          "relative overflow-hidden shadow-lg",
          fill
            ? "h-full w-full min-h-0 flex-1"
            : bare
              ? "w-full rounded-lg @[420px]:rounded-xl @[640px]:rounded-2xl aspect-square @[360px]:aspect-[5/4] @[480px]:aspect-[4/3] @[640px]:aspect-[16/11] @[820px]:aspect-[16/10] min-h-[200px] max-h-[640px]"
              : "-mx-3 h-[560px] w-auto sm:mx-0 sm:h-[600px] sm:w-full sm:rounded-2xl",
        )}
      >
        <MapContainer
          center={center}
          zoom={11}
          zoomSnap={0.25}
          maxBounds={maxBounds}
          maxBoundsViscosity={1.0}
          minZoom={8}
          maxZoom={17}
          scrollWheelZoom
          zoomControl={false}
          attributionControl={true}
          style={{ height: "100%", width: "100%", background: "#ebefeb" }}
        >
          <BoundsFitter bounds={regionBounds} />
          {/* Swisstopo Relief-Basiskarte (nur Reliefschattierung, keine Labels/Strassen) */}
          <TileLayer
            url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.leichte-basiskarte_reliefschattierung/default/current/3857/{z}/{x}/{y}.png"
            maxZoom={18}
            opacity={0.55}
            attribution='© <a href="https://www.swisstopo.admin.ch/">swisstopo</a>'
          />
          {/* Aussen-CH-Maske: deutlich dunkler, gilt nur ausserhalb der Schweizer Landesgrenze */}
          <GeoJSON
            data={OUTSIDE_CH_MASK}
            style={() => ({
              stroke: false,
              fillColor: "#3a4148",
              fillOpacity: 0.55,
            })}
            interactive={false}
          />
          {/* Feine weisse Linie an der CH-Landesgrenze */}
          <GeoJSON
            data={SWITZERLAND}
            style={() => ({
              color: "#ffffff",
              weight: 1.2,
              opacity: 0.95,
              fill: false,
            })}
            interactive={false}
          />
          {/* Aussen-Maske: mittleres Grau (See + Region ausgestanzt) — wirkt innerhalb CH ausserhalb Oberthurgau */}
          <GeoJSON
            data={OUTSIDE_MASK}
            style={() => ({
              stroke: false,
              fillColor: "#5a6670",
              fillOpacity: 0.35,
            })}
            interactive={false}
          />
          {/* Kanton Thurgau: deutliche Outline ohne Füllung */}
          <GeoJSON
            data={THURGAU}
            style={() => ({
              color: "#1f4d80",
              weight: 2,
              opacity: 0.85,
              fill: false,
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
              fillOpacity: 1,
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
              fillOpacity: 0.28,
            })}
            interactive={false}
          />
          <ZoomWatcher onZoom={setZoom} />
          {SPOTS.filter((s) => !s.minZoom || zoom >= s.minZoom).map((s) => (
            <SpotMarker
              key={s.id}
              spot={s}
              mode={viewMode}
              dayIdx={dayIndex}
              absoluteHour={absoluteHour}
              isDay={isDay}
              onClick={() => goToLokal(s)}
            />
          ))}
          <ZoomControl position="topright" />
        </MapContainer>
      </div>

      {!bare && (
        <>
          {/* Stündlich-Toggle + Wochentage */}
          <DayTabs
            days={days}
            viewMode={viewMode}
            selectedDayIdx={selectedDayIdx}
            onSelectHourly={() => {
              setStepOffset(0);
              setViewMode("hourly");
            }}
            onSelectDay={(i) => {
              setSelectedDayIdx(i);
              setViewMode("daily");
            }}
          />

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
                "region-slider relative px-1 pt-10",
                viewMode === "daily" && "pointer-events-none opacity-40",
              )}
            >
              {/* Tooltip über dem Thumb */}
              {viewMode === "hourly" && (
                <div
                  className="pointer-events-none absolute top-0 z-10"
                  style={{
                    left: `calc(${thumbPct}% + 4px)`,
                    transform: "translateX(-50%)",
                    transition: "left 0ms",
                  }}
                >
                  <div
                    className="whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-md"
                    style={{ background: BRAND }}
                  >
                    Prognose: {sliderWeekdayCap}, {sliderTimeStr}
                  </div>
                  <div
                    className="mx-auto h-0 w-0"
                    style={{
                      borderLeft: "5px solid transparent",
                      borderRight: "5px solid transparent",
                      borderTop: `5px solid ${BRAND}`,
                    }}
                  />
                </div>
              )}

              {/* Vertikale Marker-Linie am Thumb */}
              {viewMode === "hourly" && (
                <div
                  className="pointer-events-none absolute z-0"
                  style={{
                    left: `calc(${thumbPct}% + 4px)`,
                    top: "1.25rem",
                    bottom: "-1.25rem",
                    width: 1,
                    background: BRAND,
                    opacity: 0.5,
                    transition: "left 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                />
              )}

              <Slider
                size="touch"
                aria-label="Prognosezeit"
                min={0}
                max={MAX_STEPS}
                step={1}
                value={[stepOffset]}
                onValueChange={(v) => setStepOffset(v[0] ?? 0)}
                disabled={viewMode === "daily"}
              />
            </div>

            {/* Stundenlegende: jede Stunde */}
            <div className={cn("mt-1 px-1", viewMode === "daily" && "opacity-40")}>
              <div className="relative h-1.5">
                {HOUR_LABELS.map((h) => (
                  <span
                    key={`tick-${h}`}
                    className="absolute top-0 w-px bg-border"
                    style={{
                      left: `${(h / MAX_STEPS) * 100}%`,
                      height: h % 3 === 0 ? "0.4rem" : "0.2rem",
                    }}
                  />
                ))}
              </div>
              <div className="relative mt-0.5 h-3">
                {HOUR_LABELS.map((h) => {
                  const realHour = (baseHour + h) % 24;
                  const display = `${String(realHour).padStart(2, "0")}:00`;
                  const active = h === stepOffset;
                  const showOnMobile = h % 3 === 0;
                  return (
                    <span
                      key={`label-${h}`}
                      className={cn(
                        "absolute top-0 -translate-x-1/2 text-[10px] tabular-nums transition-colors duration-200",
                        active ? "font-bold" : "font-medium text-muted-foreground",
                        !showOnMobile && "hidden sm:inline",
                      )}
                      style={{
                        left: `${(h / MAX_STEPS) * 100}%`,
                        color: active ? BRAND : undefined,
                      }}
                    >
                      {display}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="mt-1.5 text-[11px] font-medium text-muted-foreground">
              {sliderWeekdayCap}, {sliderDateStr}
            </div>

          </div>

          {dataUpdatedAt > 0 && (
            <p
              className="text-center text-[11px] text-muted-foreground"
              title="Wettermodelle (ICON-CH1/CH2, ECMWF IFS, DWD-MOSMIX) werden ca. alle 6 Stunden (00/06/12/18 UTC) neu gerechnet. Im Browser werden Daten 30 Min. zwischengespeichert."
            >
              Datenstand:{" "}
              {new Intl.DateTimeFormat("de-CH", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(dataUpdatedAt))}{" "}
              · Quellen: ICON-CH1/CH2, ECMWF IFS, DWD-MOSMIX
            </p>
          )}
        </>
      )}
    </div>
  );
}
