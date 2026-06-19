import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  formatDateShort,
  formatTimeHHMM,
  reverseGeocode,
  searchLocations,
  
  weatherLabel,
  weekdayLong,
  
  windDirectionLabel,
  type GeoLocation,
} from "@/lib/weather";
import { getAggregatedForecast } from "@/lib/forecast-aggregated.functions";

import { WeatherIcon } from "@/components/weather-icons";
import { Switch } from "@/components/ui/switch";
import { Sun, Snowflake, Droplet, Sunrise, Sunset, Map as MapIcon } from "lucide-react";

/* Inline windsock icon — Lucide-style stroke. */
function WindsockIcon({ className, "aria-label": ariaLabel }: { className?: string; "aria-label"?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
    >
      <line x1="4" y1="3" x2="4" y2="21" />
      <path d="M4 6 L20 8 L17 13 L4 14 Z" />
      <line x1="9" y1="6.6" x2="9" y2="13.7" />
      <line x1="14" y1="7.3" x2="14" y2="13.4" />
    </svg>
  );
}
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface StoredLocation {
  name: string;
  latitude: number;
  longitude: number;
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function WeatherWidget({
  initialDayIdx,
  initialLocation,
  detailOnly = false,
  lockedLocation,
  compact = false,
}: {
  initialDayIdx?: number;
  initialLocation?: { name: string; latitude: number; longitude: number };
  detailOnly?: boolean;
  lockedLocation?: { name: string; latitude: number; longitude: number };
  compact?: boolean;
} = {}) {
  const [location, setLocation] = useState<StoredLocation | null>(() => {
    if (lockedLocation) return lockedLocation;
    if (initialLocation) return initialLocation;
    return null;
  });
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (lockedLocation || initialLocation) {
      setHydrated(true);
      return;
    }
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("weather:location");
      if (raw) setLocation(JSON.parse(raw) as StoredLocation);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);
  const didAutoLocate = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    if (detailOnly || lockedLocation || initialLocation) return;
    if (location) return;
    if (didAutoLocate.current) return;
    if (typeof window === "undefined" || !navigator.geolocation) return;
    didAutoLocate.current = true;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const name = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          setLocation({
            name,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          setSelectedDayIdx(0);
        } catch {
          /* ignore */
        }
      },
      () => {
        /* permission denied / error – user can choose manually */
      },
      { timeout: 8000, maximumAge: 5 * 60_000 },
    );
  }, [hydrated, location, detailOnly, lockedLocation, initialLocation]);

  const [embedMinimal, setEmbedMinimal] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("embed") === "minimal") setEmbedMinimal(true);
  }, []);
  const [extended, setExtended] = useState(false);
  const [snow, setSnow] = useState(false);
  const [selectedDayIdx, setSelectedDayIdx] = useState(initialDayIdx ?? 0);
  const [panelTarget, setPanelTarget] = useState<{ idx: number; tick: number }>({ idx: initialDayIdx ?? 0, tick: 0 });
  useEffect(() => {
    if (initialDayIdx != null && initialDayIdx >= 0 && initialDayIdx < 7) {
      setSelectedDayIdx(initialDayIdx);
    }
  }, [initialDayIdx]);
  useEffect(() => {
    if (detailOnly || !initialLocation) return;
    setLocation((prev) =>
      prev &&
      prev.name === initialLocation.name &&
      prev.latitude === initialLocation.latitude &&
      prev.longitude === initialLocation.longitude
        ? prev
        : initialLocation,
    );
    setSelectedDayIdx(0);
  }, [detailOnly, initialLocation?.name, initialLocation?.latitude, initialLocation?.longitude]);
  const now = useNow();

  useEffect(() => {
    if (detailOnly || !location) return;
    try {
      localStorage.setItem("weather:location", JSON.stringify(location));
    } catch {
      /* ignore */
    }
  }, [location, detailOnly]);

  // Post height to parent (for iframe embed auto-resize)
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.parent === window) return; // not embedded
    const el = rootRef.current;
    if (!el) return;
    const post = () => {
      window.parent.postMessage(
        { type: "lovable-weather:height", height: el.scrollHeight },
        "*",
      );
    };
    post();
    const ro = new ResizeObserver(post);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const getForecast = useServerFn(getAggregatedForecast);
  const FORECAST_VERSION = "v11";
  const forecast = useQuery({
    queryKey: ["forecast", FORECAST_VERSION, location?.latitude ?? 0, location?.longitude ?? 0],
    queryFn: () =>
      getForecast({
        data: { lat: location!.latitude, lon: location!.longitude, v: FORECAST_VERSION },
      }),
    enabled: !!location,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });


  const days = useMemo(() => {
    if (!forecast.data) return [];
    return forecast.data.daily.time.slice(0, 7).map((iso, i) => ({
      iso,
      date: new Date(iso + "T12:00:00"),
      idx: i,
    }));
  }, [forecast.data]);

  // Continuous slot list: 1h cadence for next 12h, then 3h cadence onward.
  const allHourly = useMemo<{ idx: number; cadence: "1h" | "3h" }[]>(() => {
    if (!forecast.data) return [];
    const h = forecast.data.hourly;
    const curHourMs = (() => {
      const d = new Date(now);
      d.setMinutes(0, 0, 0);
      return d.getTime();
    })();
    const cutoffMs = curHourMs + 12 * 3600_000;
    const out: { idx: number; cadence: "1h" | "3h" }[] = [];
    const safeLen = Math.min(
      h.time.length,
      h.temperature_2m?.length ?? 0,
      h.winddirection_10m?.length ?? 0,
      h.weathercode?.length ?? 0,
    );
    for (let i = 0; i < safeLen; i++) {
      const tMs = new Date(h.time[i]).getTime();
      if (tMs < curHourMs) continue;
      if (tMs < cutoffMs) {
        out.push({ idx: i, cadence: "1h" });
      } else {
        const hr = new Date(h.time[i]).getHours();
        if (hr % 3 !== 0) continue;
        out.push({ idx: i, cadence: "3h" });
      }
    }
    return out;
  }, [forecast.data, now]);


  if (detailOnly) {
    const wrapperPad = compact
      ? "py-1 px-1"
      : "py-2 px-1 @[420px]:py-3 @[420px]:px-2 @[640px]:py-6 @[640px]:px-5 @[900px]:py-8 @[900px]:px-6";
    return (
      <div ref={rootRef} className={`@container bg-zinc-100 text-zinc-900 antialiased font-medium ${wrapperPad}`}>
        <div className="max-w-5xl mx-auto">
          {location && forecast.isLoading && <SkeletonWidget />}
          {location && forecast.isError && (
            <div className="p-6 bg-zinc-50 border border-zinc-200 rounded-sm text-sm text-zinc-600">
              Wetterdaten konnten nicht geladen werden. Bitte später erneut versuchen.
            </div>
          )}
          {forecast.data && (
            <DetailPanel
              forecast={forecast.data}
              hourlyIndices={allHourly}
              days={days}
              selectedDayIdx={selectedDayIdx}
              onVisibleDayChange={setSelectedDayIdx}
              targetDayIdx={panelTarget.idx}
              targetTick={panelTarget.tick}
              now={now}
              extended={false}
              snow={false}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="@container bg-zinc-100 text-zinc-900 antialiased font-medium py-4 px-3 @[640px]:py-6 @[640px]:px-5 @[900px]:py-10 @[900px]:px-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <Header
          locationName={location?.name ?? null}
          hideSearch={embedMinimal}
          onSelectLocation={(loc) => {
            setLocation({
              name: loc.name,
              latitude: loc.latitude,
              longitude: loc.longitude,
            });
            setSelectedDayIdx(0);
          }}
          onGeolocate={async () => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(async (pos) => {
              const name = await reverseGeocode(
                pos.coords.latitude,
                pos.coords.longitude,
              );
              setLocation({
                name,
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              });
              setSelectedDayIdx(0);
            });
          }}
          extended={extended}
          onToggleExtended={setExtended}
          snow={snow}
          onToggleSnow={setSnow}
        />

        {!location && (
          <div className="p-8 bg-[var(--accent-soft)] border border-accent/20 rounded-md text-center space-y-2">
            <div className="text-2xl" aria-hidden>↑</div>
            <p className="text-sm font-semibold text-zinc-900">
              Gemeinde suchen oder „Ortung" verwenden,
            </p>
            <p className="text-sm text-zinc-700">
              um die 5-Tage-Prognose anzuzeigen.
            </p>
          </div>
        )}
        {location && forecast.isLoading && <SkeletonWidget />}
        {location && forecast.isError && (
          <div className="p-6 bg-zinc-50 border border-zinc-200 rounded-sm text-sm text-zinc-600">
            Wetterdaten konnten nicht geladen werden. Bitte später erneut
            versuchen.
          </div>
        )}

        {forecast.data && (
          <>
            <DayStrip
              forecast={forecast.data}
              days={days}
              selectedIdx={selectedDayIdx}
              onSelect={(i) => {
                setSelectedDayIdx(i);
                setPanelTarget((p) => ({ idx: i, tick: p.tick + 1 }));
              }}
              extended={extended}
            />

            <DaySummaryBar
              forecast={forecast.data}
              selectedDayIdx={selectedDayIdx}
            />

            <DetailPanel
              forecast={forecast.data}
              hourlyIndices={allHourly}
              days={days}
              selectedDayIdx={selectedDayIdx}
              onVisibleDayChange={setSelectedDayIdx}
              targetDayIdx={panelTarget.idx}
              targetTick={panelTarget.tick}
              now={now}
              extended={extended}
              snow={snow}
            />

            <Footer
              forecast={forecast.data}
              selectedDayIdx={selectedDayIdx}
              extended={extended}
            />

            <DataStamp updatedAt={forecast.dataUpdatedAt} />
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- DataStamp ---------------- */

function DataStamp({ updatedAt }: { updatedAt: number }) {
  if (!updatedAt) return null;
  const fmt = new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(updatedAt));
  const tip =
    "Wettermodelle (ICON-seamless, DWD-MOSMIX) werden ca. alle 6 Stunden " +
    "(00/06/12/18 UTC) neu gerechnet. Im Browser werden Daten 15–30 Min. zwischengespeichert.";
  return (
    <p className="text-[11px] text-zinc-500 text-center pt-1" title={tip}>
      Datenstand: {fmt} · Quelle: Oberthurgauer Wetter · Modelle: ICON-seamless, DWD-MOSMIX
    </p>
  );
}



/* ---------------- Header ---------------- */

function Header({
  locationName,
  hideSearch,
  onSelectLocation,
  onGeolocate,
  extended,
  onToggleExtended,
  snow,
  onToggleSnow,
}: {
  locationName: string | null;
  hideSearch: boolean;
  onSelectLocation: (loc: GeoLocation) => void;
  onGeolocate: () => void;
  extended: boolean;
  onToggleExtended: (v: boolean) => void;
  snow: boolean;
  onToggleSnow: (v: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useQuery({
    queryKey: ["geo", debounced],
    queryFn: () => searchLocations(debounced),
    enabled: !hideSearch && debounced.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="flex flex-col @[640px]:flex-row @[640px]:items-end justify-between gap-4 @[640px]:gap-6 pb-5 border-b border-zinc-200">
      <div className="space-y-2 w-full @[640px]:max-w-[56ch]">
        <div className="flex items-center gap-2" ref={containerRef}>
          {!hideSearch && (
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                placeholder="Gemeinde suchen…"
                className="w-full h-10 bg-zinc-50 border border-zinc-200 rounded-md px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
              />
              {open && search.data && search.data.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 top-11 bg-zinc-50 border border-zinc-200 rounded-md shadow-lg max-h-72 overflow-y-auto">
                  {search.data.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectLocation(r);
                          setQuery("");
                          setOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 flex items-baseline justify-between gap-3"
                      >
                        <span className="font-bold text-zinc-900">
                          {r.name}
                        </span>
                        <span className="text-xs text-zinc-700 font-semibold">
                          {r.admin1 ?? "CH"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onGeolocate}
            title="Aktueller Standort"
            className="h-10 px-3 flex items-center gap-1.5 bg-accent text-accent-foreground text-sm font-semibold rounded-md transition-colors hover:bg-[var(--accent-strong)]"
          >
            <span className="shrink-0 opacity-90" aria-hidden>
              ⌖
            </span>
            <span className="hidden sm:inline">Ortung</span>
          </button>
        </div>
        {locationName && (
          <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
            <span className="text-accent" aria-hidden>
              ⌖
            </span>
            <span>{locationName}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 self-start @[640px]:self-auto">
        <a
          href="/karte"
          className="h-10 px-3 inline-flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-900 text-sm font-semibold rounded-md shadow-sm transition-all hover:bg-zinc-50 hover:border-zinc-300 hover:shadow"
          title="Wetterkarte der Region"
        >
          <MapIcon className="w-4 h-4 text-accent" aria-hidden />
          <span>Karte</span>
        </a>
        <label className="flex items-center gap-2 cursor-pointer" title="Sonnenschein">
          <Switch
            checked={extended}
            onCheckedChange={onToggleExtended}
            aria-label="Sonnenschein"
          />
          <Sun className="w-5 h-5 text-zinc-900" aria-hidden />
        </label>
        <label className="flex items-center gap-2 cursor-pointer" title="Schnee">
          <Switch
            checked={snow}
            onCheckedChange={onToggleSnow}
            aria-label="Schnee"
          />
          <Snowflake className="w-5 h-5 text-zinc-900" aria-hidden />
        </label>
      </div>
    </header>
  );
}

/* ---------------- 5-Day Strip (7-day forecast, 5 visible, auto-roll) ---------------- */

function DayStrip({
  forecast,
  days,
  selectedIdx,
  onSelect,
  extended,
}: {
  forecast: import("@/lib/weather").ForecastResponse;
  days: { iso: string; date: Date; idx: number }[];
  selectedIdx: number;
  onSelect: (i: number) => void;
  extended: boolean;
}) {
  const d = forecast.daily;

  const h = forecast.hourly;
  return (
    <div className="space-y-2">
      <div className="flex gap-px bg-zinc-200 border border-zinc-200 rounded-md overflow-x-auto snap-x snap-mandatory no-scrollbar">
        {days.map((day, i) => {
          const selected = i === selectedIdx;
          const prob = d.precipitation_probability_max?.[i] ?? 0;
          const probLabel = prob === 0 ? "0 %" : prob < 5 ? "<5 %" : `${prob} %`;
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onSelect(i)}
              className={`relative text-left p-2 @[640px]:p-4 @[1000px]:p-3 space-y-2 @[640px]:space-y-3 snap-start shrink-0 basis-[70%] @[420px]:basis-[45%] @[640px]:basis-[calc(100%/4-1px)] @[820px]:basis-[calc(100%/5-1px)] @[1000px]:basis-[calc(100%/7-1px)] transition-colors ${
                selected
                  ? "bg-[var(--accent-soft)]"
                  : "bg-zinc-50 hover:bg-zinc-100"
              }`}
            >
              {selected && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-accent" />
              )}
              <div className="flex flex-col items-center text-center">
                <span
                  className={`text-base font-bold font-[family-name:var(--font-display)] ${
                    selected ? "text-accent" : "text-zinc-900"
                  }`}
                >
                  {i === 0 ? "Heute" : i === 1 ? "Morgen" : weekdayLong(day.date)}
                </span>
                <span className="text-xs text-zinc-700 font-semibold">
                  {formatDateShort(day.date)}
                </span>
              </div>
              <div
                className="py-1 select-none text-zinc-900 flex justify-center [&_svg]:h-14 [&_svg]:w-14 @[640px]:[&_svg]:h-20 @[640px]:[&_svg]:w-20"
                aria-label={weatherLabel(d.weathercode[i])}
                title={weatherLabel(d.weathercode[i])}
              >
                <WeatherIcon
                  code={d.weathercode[i]}
                  size={80}
                  scope="daily"
                  precip={d.precipitation_sum[i]}
                  precipProb={d.precipitation_probability_max?.[i]}
                  precipHours={d.precipitation_hours?.[i]}
                  thunderHours={d.thunderstorm_hours?.[i]}
                  isSnow={(d.snowfall_sum?.[i] ?? 0) > 0.1}
                  sunshineRatio={(d.sunshine_duration?.[i] ?? 0) / (15 * 3600)}
                  cloudLow={d.cloud_cover_low_mean?.[i]}
                  cloudMid={d.cloud_cover_mid_mean?.[i]}
                  cloudHigh={d.cloud_cover_high_mean?.[i]}
                />
              </div>
              <div className="flex items-baseline justify-center gap-2 tabular-nums font-[family-name:var(--font-display)]">
                <span className="text-base @[640px]:text-lg font-semibold text-zinc-700">
                  {Number.isFinite(d.temperature_2m_min[i]) ? `${Math.round(d.temperature_2m_min[i])}°` : "–"}
                </span>
                <span className="text-zinc-400 font-normal">|</span>
                <span className="text-lg @[640px]:text-xl @[1100px]:text-2xl font-bold text-zinc-900">
                  {Number.isFinite(d.temperature_2m_max[i]) ? `${Math.round(d.temperature_2m_max[i])}°` : "–"}
                </span>
              </div>
              <div className="pt-2 border-t border-zinc-200/70 space-y-1">
                <div className="flex items-baseline justify-between tabular-nums">
                  <span className="text-sm font-bold text-zinc-900">
                    {Number.isFinite(d.precipitation_sum[i]) ? `${d.precipitation_sum[i].toFixed(1)} mm` : "– mm"}
                  </span>
                  <span className="text-xs font-semibold text-zinc-700">{probLabel}</span>
                </div>
                <DayRainSparkline hourly={h} dayIso={day.iso} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Per-day rain sparkline ---------------- */

function DayRainSparkline({
  hourly,
  dayIso,
}: {
  hourly: import("@/lib/weather").HourlyData;
  dayIso: string;
}) {
  // 8 vertikale Säulen à 3 Stunden (00–03, 03–06, …, 21–24).
  const buckets: { mm: number; prob: number }[] = Array.from({ length: 8 }, () => ({ mm: 0, prob: 0 }));
  for (let i = 0; i < hourly.time.length; i++) {
    const iso = hourly.time[i];
    if (iso.slice(0, 10) !== dayIso) continue;
    const hr = Number(iso.slice(11, 13));
    if (!Number.isFinite(hr) || hr < 0 || hr > 23) continue;
    const b = Math.floor(hr / 3);
    buckets[b].mm += hourly.precipitation?.[i] ?? 0;
    buckets[b].prob = Math.max(buckets[b].prob, hourly.precipitation_probability?.[i] ?? 0);
  }
  const maxMm = buckets.reduce((m, b) => Math.max(m, b.mm), 0);
  const scale = Math.max(2, maxMm * 1.1);
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-8 w-full items-end gap-px">
        {buckets.map((b, k) => {
          const hasMm = b.mm > 0;
          const mmHeight = hasMm ? Math.max(6, Math.min(100, (b.mm / scale) * 100)) : 0;
          const probVisible = b.prob >= 5;
          const probTop = probVisible ? Math.max(mmHeight, Math.min(100, b.prob)) : mmHeight;
          const probExtra = Math.max(0, probTop - mmHeight);
          const from = String(k * 3).padStart(2, "0");
          const to = String(k * 3 + 3).padStart(2, "0");
          return (
            <Tooltip key={k}>
              <TooltipTrigger asChild>
                <span
                  className="flex-1 h-full flex flex-col justify-end bg-zinc-300/40 rounded-sm overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {probExtra > 0 && (
                    <div
                      className="w-full bg-[var(--wx-rain)]"
                      style={{ height: `${probExtra}%`, opacity: 0.25 }}
                    />
                  )}
                  {hasMm && (
                    <div
                      className="w-full bg-[var(--wx-rain)] rounded-sm"
                      style={{ height: `${mmHeight}%`, minHeight: 2 }}
                    />
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div className="font-semibold">{from}–{to} Uhr</div>
                <div>{b.mm.toFixed(1)} mm · {b.prob}% Regenrisiko</div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}


/* ---------------- DaySummaryBar ---------------- */

function DaySummaryBar({
  forecast,
  selectedDayIdx,
}: {
  forecast: import("@/lib/weather").ForecastResponse;
  selectedDayIdx: number;
}) {
  const d = forecast.daily;
  const i = selectedDayIdx;
  if (i < 0 || i >= d.time.length) return null;
  const date = new Date(d.time[i] + "T12:00:00");
  const sunRaw = d.sunshine_duration?.[i];
  const sunH = sunRaw == null || !Number.isFinite(sunRaw) ? null : Math.round(sunRaw / 3600);
  const wind = Math.round(d.windspeed_10m_max?.[i] ?? 0);
  const rawGust = d.windgusts_10m_max?.[i] ?? 0;
  const gust = Math.round(rawGust > 0 ? rawGust : wind > 0 ? wind * 1.4 : 0);
  const mm = d.precipitation_sum?.[i];
  const prob = d.precipitation_probability_max?.[i] ?? 0;
  const probLabel = prob === 0 ? "0 %" : prob < 5 ? "<5 %" : `${prob} %`;
  const riseStr = formatTimeHHMM(d.sunrise?.[i] ?? "") || "–";
  const setStr = formatTimeHHMM(d.sunset?.[i] ?? "") || "–";
  return (
    <div className="rounded-md border border-accent/20 bg-[color-mix(in_oklab,var(--accent)_18%,white)] px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
      <span className="font-bold text-zinc-900 font-[family-name:var(--font-display)]">
        {weekdayLong(date)} <span className="text-zinc-700 font-semibold">{formatDateShort(date)}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 tabular-nums font-semibold text-zinc-900">
        <CloudRain className="w-4 h-4 text-zinc-700" aria-label="Niederschlag" />
        {Number.isFinite(mm) ? `${mm.toFixed(1)} mm` : "– mm"}
        <span className="text-zinc-500">/</span>
        <span className="text-zinc-800">{probLabel}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 tabular-nums font-semibold text-zinc-900">
        <Sun className="w-4 h-4 text-zinc-700" aria-label="Sonnenschein" />
        {sunH == null ? "–" : `${sunH} h`}
      </span>
      <span className="inline-flex items-center gap-1.5 tabular-nums font-semibold text-zinc-900">
        <Wind className="w-4 h-4 text-zinc-700" aria-label="Wind" />
        <WindArrow deg={d.winddirection_10m_dominant?.[i] ?? 0} size="md" />
        <span className="font-medium text-zinc-700">{wind}</span>
        <span className="text-zinc-500">|</span>
        <span className="font-bold">{gust}</span>
        <span className="font-medium text-zinc-700">km/h</span>
      </span>
      <span className="inline-flex items-center gap-1.5 tabular-nums font-semibold text-zinc-900">
        <Sunrise className="w-4 h-4 text-amber-700" aria-label="Sonnenaufgang" />
        {riseStr}
      </span>
      <span className="inline-flex items-center gap-1.5 tabular-nums font-semibold text-zinc-900">
        <Sunset className="w-4 h-4 text-amber-700" aria-label="Sonnenuntergang" />
        {setStr}
      </span>
    </div>
  );
}

/* ---------------- Detail Panel ---------------- */

function DetailPanel({
  forecast,
  hourlyIndices,
  days,
  selectedDayIdx,
  onVisibleDayChange,
  targetDayIdx,
  targetTick,
  now,
  extended,
  snow,
}: {
  forecast: import("@/lib/weather").ForecastResponse;
  hourlyIndices: { idx: number; cadence: "1h" | "3h" }[];
  days: { iso: string; date: Date; idx: number }[];
  selectedDayIdx: number;
  onVisibleDayChange: (i: number) => void;
  targetDayIdx?: number;
  targetTick?: number;
  now: Date;
  extended: boolean;
  snow: boolean;
}) {
  const h = forecast.hourly;
  const dDaily = forecast.daily;
  const sunMap = useMemo(() => {
    const m = new Map<string, { rise?: number; set?: number; riseStr?: string; setStr?: string }>();
    const toDec = (iso: string): number | undefined => {
      if (!iso) return undefined;
      const dt = new Date(iso);
      if (Number.isNaN(dt.getTime())) return undefined;
      return dt.getHours() + dt.getMinutes() / 60;
    };
    dDaily.time.forEach((day, i) => {
      const rise = toDec(dDaily.sunrise[i]);
      const set = toDec(dDaily.sunset[i]);
      m.set(day, {
        rise,
        set,
        riseStr: formatTimeHHMM(dDaily.sunrise[i]),
        setStr: formatTimeHHMM(dDaily.sunset[i]),
      });
    });
    return m;
  }, [dDaily]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const userScrolling = useRef(false);

  const selectedDay = days[selectedDayIdx];

  // Initial mount: scroll once to the current hour. Do NOT auto-scroll on
  // subsequent selectedDayIdx changes — the user navigates the strip and the
  // panel independently.
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (didInitialScroll.current) return;
    if (!hourlyIndices.length) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const nowMs = now.getTime();
    // Find slot whose start is closest to (but <=) now.
    let targetIso: string | null = null;
    for (const s of hourlyIndices) {
      const iso = h.time[s.idx];
      if (new Date(iso).getTime() <= nowMs) targetIso = iso;
      else break;
    }
    if (!targetIso) targetIso = h.time[hourlyIndices[0].idx];
    const el = slotRefs.current.get(targetIso);
    if (!el) return;
    userScrolling.current = false;
    scroller.scrollTo({ left: el.offsetLeft - scroller.offsetLeft, behavior: "auto" });
    didInitialScroll.current = true;
    const t = window.setTimeout(() => {
      userScrolling.current = true;
    }, 200);
    return () => window.clearTimeout(t);
  }, [hourlyIndices, h.time, now]);

  // Explicit day-tile click → smooth scroll to first slot of target day.
  // Skipped on first render (targetTick === 0) so initial-mount logic owns it.
  useEffect(() => {
    if (!targetTick) return;
    if (targetDayIdx == null) return;
    const day = days[targetDayIdx];
    if (!day) return;
    const firstIso = hourlyIndices
      .map((s) => h.time[s.idx])
      .find((iso) => iso.slice(0, 10) === day.iso);
    if (!firstIso) return;
    const el = slotRefs.current.get(firstIso);
    const scroller = scrollerRef.current;
    if (!el || !scroller) return;
    userScrolling.current = false;
    scroller.scrollTo({ left: el.offsetLeft - scroller.offsetLeft, behavior: "smooth" });
    const t = window.setTimeout(() => {
      userScrolling.current = true;
    }, 700);
    return () => window.clearTimeout(t);
  }, [targetTick, targetDayIdx, days, hourlyIndices, h.time]);

  // Track which day is currently visible on scroll and reflect it in the day strip.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const markUser = () => {
      userScrolling.current = true;
    };
    const onScroll = () => {
      // Ignore scroll events from programmatic smooth-scrolling (tab click).
      if (!userScrolling.current) return;
      const left = scroller.scrollLeft + 16;
      let visibleIso: string | null = null;
      for (const s of hourlyIndices) {
        const iso = h.time[s.idx];
        const el = slotRefs.current.get(iso);
        if (!el) continue;
        if (el.offsetLeft - scroller.offsetLeft <= left) {
          visibleIso = iso;
        } else {
          break;
        }
      }
      if (!visibleIso) return;
      const dateStr = visibleIso.slice(0, 10);
      const dayIdx = days.findIndex((d) => d.iso === dateStr);
      if (dayIdx >= 0 && dayIdx !== selectedDayIdx) {
        onVisibleDayChange(dayIdx);
      }
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("wheel", markUser, { passive: true });
    scroller.addEventListener("touchstart", markUser, { passive: true });
    scroller.addEventListener("pointerdown", markUser, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("wheel", markUser);
      scroller.removeEventListener("touchstart", markUser);
      scroller.removeEventListener("pointerdown", markUser);
    };
  }, [hourlyIndices, h.time, days, selectedDayIdx, onVisibleDayChange]);

  if (!selectedDay) return null;
  const nowMs = now.getTime();
  const slotWidthClass = (cadence: "1h" | "3h") =>
    cadence === "1h"
      ? "w-[62px] @[640px]:w-[72px]"
      : "w-[108px] @[640px]:w-[124px]";

  return (
    <section className="bg-[var(--accent-soft)] rounded-md border border-accent/20 overflow-hidden">
      <div className="px-4 py-3 bg-[color-mix(in_oklab,var(--accent)_18%,white)] border-b border-accent/20 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-base font-bold text-zinc-900 font-[family-name:var(--font-display)]">
          {selectedDayIdx === 0
            ? "Heute"
            : selectedDayIdx === 1
              ? "Morgen"
              : weekdayLong(selectedDay.date)}
        </span>
      </div>
      <div className="flex items-stretch">
        {/* Y-axes for charts */}
        <div className="w-10 shrink-0 border-r border-zinc-200 bg-[color-mix(in_oklab,var(--accent)_10%,white)] flex flex-col justify-end">
          <div className="flex-1" />
          {/* Precipitation axis */}
          <div className="relative h-[72px] text-[10px] text-zinc-900 font-bold tabular-nums">
            {[5, 2.5, 0].map((v) => (
              <div
                key={v}
                className="absolute left-0 right-1 text-right leading-none"
                style={{
                  top: `${(1 - v / 5) * 100}%`,
                  transform:
                    v === 0
                      ? "translateY(-100%)"
                      : v === 5
                        ? "translateY(0)"
                        : "translateY(-50%)",
                }}
              >
                {v}
              </div>
            ))}
          </div>
          <div className="text-[10px] text-zinc-900 font-bold text-right pr-1 pb-1 leading-tight flex items-center justify-end gap-1">
            <CloudRain className="w-3.5 h-3.5" aria-label="Regen" /> mm/3h
          </div>
          {extended && (
            <>
              <div className="relative h-[72px] text-[10px] text-zinc-900 font-bold tabular-nums border-t border-zinc-200">
                {[60, 30, 0].map((v) => (
                  <div
                    key={v}
                    className="absolute left-0 right-1 text-right leading-none"
                    style={{
                      top: `${(1 - v / 60) * 100}%`,
                      transform:
                        v === 0
                          ? "translateY(-100%)"
                          : v === 60
                            ? "translateY(0)"
                            : "translateY(-50%)",
                    }}
                  >
                    {v}
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-zinc-900 font-bold text-right pr-1 pb-1 leading-tight flex items-center justify-end gap-1">
                <Sun className="w-3.5 h-3.5" aria-label="Sonne" /> min/h
              </div>
            </>
          )}
          {snow && (
            <>
              <div className="relative h-[72px] text-[10px] text-zinc-900 font-bold tabular-nums border-t border-zinc-200">
                {[2, 1, 0].map((v) => (
                  <div
                    key={v}
                    className="absolute left-0 right-1 text-right leading-none"
                    style={{
                      top: `${(1 - v / 2) * 100}%`,
                      transform:
                        v === 0
                          ? "translateY(-100%)"
                          : v === 2
                            ? "translateY(0)"
                            : "translateY(-50%)",
                    }}
                  >
                    {v}
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-zinc-900 font-bold text-right pr-1 pb-1 leading-tight flex items-center justify-end gap-1">
                <Snowflake className="w-3.5 h-3.5" aria-label="Schnee" /> cm/3h
              </div>
            </>
          )}
        </div>
        {/* Scroll area: slots on top, precipitation bars below */}
        <div
          ref={scrollerRef}
          className="flex-1 overflow-x-auto no-scrollbar scroll-smooth snap-x"
        >
          <div className="inline-flex flex-col min-w-full">
            {/* Hour slots */}
            <div className="flex">
              {hourlyIndices.map((s, i) => {
                const { idx, cadence } = s;
                const iso = h.time[idx];
                const prev = i > 0 ? hourlyIndices[i - 1] : null;
                const prevIso = prev ? h.time[prev.idx] : null;
                const isDayStart =
                  !!prevIso && prevIso.slice(0, 10) !== iso.slice(0, 10);
                const isCadenceBreak =
                  !!prev && prev.cadence === "1h" && cadence === "3h";
                const t = new Date(iso);
                const slotMs = t.getTime();
                const slotDur = cadence === "1h" ? 3600_000 : 3 * 3600_000;
                const isCurrent = nowMs >= slotMs && nowMs < slotMs + slotDur;
                const wind = h.windspeed_10m?.[idx] ?? 0;
                const rawGust = h.windgusts_10m?.[idx] ?? 0;
                const gust =
                  rawGust > 0
                    ? rawGust
                    : wind > 0
                      ? Math.round(wind * 1.4)
                      : 0;
                return (
                  <div
                    key={iso}
                    ref={(el) => {
                      if (el) slotRefs.current.set(iso, el);
                      else slotRefs.current.delete(iso);
                    }}
                    className={`relative flex-shrink-0 ${slotWidthClass(cadence)} p-2 @[640px]:p-4 space-y-2 @[640px]:space-y-3 snap-start ${
                      isCadenceBreak
                        ? "border-l-2 border-zinc-400"
                        : isDayStart
                          ? "border-l border-zinc-300"
                          : ""
                    } ${isCurrent ? "bg-[color-mix(in_oklab,var(--accent)_22%,white)]" : ""}`}
                  >
                    {isCadenceBreak && (
                      <div className="absolute -top-px left-0 right-0 -translate-y-full px-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500 whitespace-nowrap">
                        3-h-Takt
                      </div>
                    )}
                    <div
                      className={`text-sm font-bold tabular-nums ${
                        isCurrent ? "text-accent" : "text-zinc-900"
                      }`}
                    >
                      {String(t.getHours()).padStart(2, "0")}:00
                    </div>
                    <div
                      className="flex items-center justify-center"
                      title={weatherLabel(h.weathercode?.[idx] ?? 0)}
                    >
                      <WeatherIcon
                        code={h.weathercode?.[idx] ?? 0}
                        mchCode={h.weathercode_mch?.[idx]}
                        isDay={t.getHours() >= 6 && t.getHours() < 20}
                        size={cadence === "1h" ? 48 : 64}
                        precip={h.precipitation?.[idx]}
                        precipProb={h.precipitation_probability?.[idx]}
                        isSnow={(h.snowfall?.[idx] ?? 0) > 0.05}
                        sunshineRatio={(h.sunshine_duration?.[idx] ?? 0) / (cadence === "1h" ? 3600 : 3 * 3600)}
                        cloudLow={h.cloud_cover_low?.[idx]}
                        cloudMid={h.cloud_cover_mid?.[idx]}
                        cloudHigh={h.cloud_cover_high?.[idx]}
                      />


                    </div>
                    <div className={`${cadence === "1h" ? "text-base" : "text-xl"} font-bold tabular-nums text-zinc-900`}>
                      {Number.isFinite(h.temperature_2m?.[idx])
                        ? `${h.temperature_2m[idx].toFixed(1)}°`
                        : "–"}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        <WindArrow deg={h.winddirection_10m?.[idx] ?? 0} size="lg" />
                        <span className="tabular-nums">
                          <span className="font-medium text-zinc-700">
                            {Math.round(wind)}
                          </span>
                          <span className="text-zinc-700 font-medium">/</span>
                          <span className="font-bold text-zinc-900">
                            {Math.round(gust)}
                          </span>
                        </span>
                        {cadence === "3h" && (
                          <span className="text-zinc-800 font-semibold">
                            {windDirectionLabel(h.winddirection_10m?.[idx] ?? 0)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Precipitation bar chart */}
            <div className="flex border-t border-zinc-200 bg-transparent">
              {hourlyIndices.map((s, i) => {
                const { idx, cadence } = s;
                const iso = h.time[idx];
                const prev = i > 0 ? hourlyIndices[i - 1] : null;
                const prevIso = prev ? h.time[prev.idx] : null;
                const isDayStart =
                  !prevIso || prevIso.slice(0, 10) !== iso.slice(0, 10);
                const isCadenceBreak =
                  !!prev && prev.cadence === "1h" && cadence === "3h";
                const startHour = Number(iso.slice(11, 13));
                const nHrs = cadence === "1h" ? 1 : 3;
                const perHour = Array.from({ length: nHrs }, (_, k) => ({
                  mm: h.precipitation[idx + k] ?? 0,
                  prob: h.precipitation_probability[idx + k] ?? 0,
                }));
                return (
                  <div
                    key={iso}
                    className={`flex-shrink-0 ${slotWidthClass(cadence)} flex flex-col`}
                  >
                    <div className="relative h-[72px] w-full">
                      {[0, 2.5, 5].map((v) => (
                        <div
                          key={v}
                          className="absolute left-0 right-0 border-t border-zinc-200/80"
                          style={{ top: `${(1 - v / 5) * 100}%` }}
                        />
                      ))}
                      {(isCadenceBreak || (isDayStart && i > 0)) && (
                        <div className={`absolute top-0 bottom-0 left-0 ${isCadenceBreak ? "w-0.5 bg-zinc-400" : "w-px bg-zinc-300"}`} />
                      )}
                      <div className="absolute inset-0 flex items-end justify-around px-1">
                        <TooltipProvider delayDuration={150}>
                          {perHour.map(({ mm, prob }, k) => {
                            const pct = Math.min(mm / 5, 1) * 100;
                            const opacity = mm > 0 ? 0.35 + (prob / 100) * 0.65 : 0;
                            const hh = (startHour + k) % 24;
                            const hh2 = (hh + 1) % 24;
                            return (
                              <Tooltip key={k}>
                                <TooltipTrigger asChild>
                                  <span
                                    className={`${cadence === "1h" ? "w-3 @[640px]:w-3.5" : "w-2 @[640px]:w-2.5"} rounded-t-sm bg-[var(--wx-rain)] cursor-help`}
                                    style={{ height: `${pct}%`, opacity }}
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  <div className="font-semibold">{String(hh).padStart(2, "0")}–{String(hh2).padStart(2, "0")} Uhr</div>
                                  <div>{mm.toFixed(1)} mm · {prob}% Regenrisiko</div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </TooltipProvider>
                      </div>

                    </div>
                    <div className="text-[10px] text-center text-zinc-900 tabular-nums py-1 leading-tight">
                      <div className="font-bold flex justify-around px-1">
                        {perHour.map(({ mm }, k) => (
                          <span key={k} className={cadence === "1h" ? "w-full" : "w-1/3"}>
                            {mm > 0 ? mm.toFixed(1) : "–"}
                          </span>
                        ))}
                      </div>
                      <div className="text-zinc-700 font-semibold flex justify-around px-1">
                        {perHour.map(({ prob }, k) => (
                          <span key={k} className={cadence === "1h" ? "w-full" : "w-1/3"}>
                            {prob}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Sunshine bar chart (extended only) */}
            {extended && (
              <div className="flex border-t border-zinc-200 bg-transparent">
                {hourlyIndices.map((s, i) => {
                  const { idx, cadence } = s;
                  const iso = h.time[idx];
                  const prev = i > 0 ? hourlyIndices[i - 1] : null;
                  const prevIso = prev ? h.time[prev.idx] : null;
                  const isDayStart =
                    !prevIso || prevIso.slice(0, 10) !== iso.slice(0, 10);
                  const isCadenceBreak =
                    !!prev && prev.cadence === "1h" && cadence === "3h";
                  const startHour = Number(iso.slice(11, 13));
                  const nHrs = cadence === "1h" ? 1 : 3;
                  const perHour = Array.from({ length: nHrs }, (_, k) =>
                    Math.round((h.sunshine_duration[idx + k] ?? 0) / 60)
                  );
                  const sun = sunMap.get(iso.slice(0, 10));
                  const slotEnd = startHour + nHrs;
                  const inSlot = (v: number | undefined) =>
                    v !== undefined && v >= startHour && v < slotEnd;
                  const riseInSlot = inSlot(sun?.rise);
                  const setInSlot = inSlot(sun?.set);
                  return (
                    <div
                      key={iso}
                      className={`flex-shrink-0 ${slotWidthClass(cadence)} flex flex-col`}
                    >
                      <div className="relative h-[72px] w-full">
                        {[0, 30, 60].map((v) => (
                          <div
                            key={v}
                            className="absolute left-0 right-0 border-t border-zinc-200/80"
                            style={{ top: `${(1 - v / 60) * 100}%` }}
                          />
                        ))}
                        {(isCadenceBreak || (isDayStart && i > 0)) && (
                          <div className={`absolute top-0 bottom-0 left-0 ${isCadenceBreak ? "w-0.5 bg-zinc-400" : "w-px bg-zinc-300"}`} />
                        )}
                        <div className="absolute inset-0 flex items-end justify-around px-1">
                          {perHour.map((m, k) => {
                            const pct = Math.min(m / 60, 1) * 100;
                            const hh = (startHour + k) % 24;
                            const hh2 = (hh + 1) % 24;
                            return (
                              <div
                                key={k}
                                className={`${cadence === "1h" ? "w-3 @[640px]:w-3.5" : "w-2 @[640px]:w-2.5"} rounded-t-sm bg-[var(--wx-sun)]`}
                                style={{ height: `${pct}%` }}
                                title={`${String(hh).padStart(2, "0")}–${String(hh2).padStart(2, "0")} Uhr · ${m} min Sonne`}
                              />
                            );
                          })}
                        </div>
                        {riseInSlot && sun?.rise !== undefined && (
                          <div
                            className="absolute top-0 bottom-0 w-px bg-amber-500/80 pointer-events-none"
                            style={{ left: `${((sun.rise - startHour) / nHrs) * 100}%` }}
                            title={`Sonnenaufgang ${sun.riseStr}`}
                          >
                            <div className="absolute -top-0.5 left-1 text-[9px] font-semibold text-amber-700 whitespace-nowrap leading-none">
                              ↑{sun.riseStr}
                            </div>
                          </div>
                        )}
                        {setInSlot && sun?.set !== undefined && (
                          <div
                            className="absolute top-0 bottom-0 w-px bg-amber-600/80 pointer-events-none"
                            style={{ left: `${((sun.set - startHour) / nHrs) * 100}%` }}
                            title={`Sonnenuntergang ${sun.setStr}`}
                          >
                            <div className="absolute -top-0.5 right-1 text-[9px] font-semibold text-amber-700 whitespace-nowrap leading-none">
                              ↓{sun.setStr}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-center text-zinc-900 tabular-nums py-1 leading-tight">
                        <div className="font-bold flex justify-around px-1">
                          {perHour.map((m, k) => (
                            <span key={k} className={cadence === "1h" ? "w-full" : "w-1/3"}>
                              {m > 0 ? m : "–"}
                            </span>
                          ))}
                        </div>
                        <div className="text-zinc-700 font-semibold">min</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Snowfall bar chart (snow only) */}
            {snow && (
              <div className="flex border-t border-zinc-200 bg-transparent">
                {hourlyIndices.map((s, i) => {
                  const { idx, cadence } = s;
                  const iso = h.time[idx];
                  const prev = i > 0 ? hourlyIndices[i - 1] : null;
                  const prevIso = prev ? h.time[prev.idx] : null;
                  const isDayStart =
                    !prevIso || prevIso.slice(0, 10) !== iso.slice(0, 10);
                  const isCadenceBreak =
                    !!prev && prev.cadence === "1h" && cadence === "3h";
                  const nHrs = cadence === "1h" ? 1 : 3;
                  let cm = 0;
                  for (let k = 0; k < nHrs; k++) cm += h.snowfall[idx + k] ?? 0;
                  const pct = Math.min(cm / 2, 1) * 100;
                  return (
                    <div
                      key={iso}
                      className={`flex-shrink-0 ${slotWidthClass(cadence)} flex flex-col`}
                    >
                      <div className="relative h-[72px] w-full">
                        {[0, 1, 2].map((v) => (
                          <div
                            key={v}
                            className="absolute left-0 right-0 border-t border-zinc-200/80"
                            style={{ top: `${(1 - v / 2) * 100}%` }}
                          />
                        ))}
                        {(isCadenceBreak || (isDayStart && i > 0)) && (
                          <div className={`absolute top-0 bottom-0 left-0 ${isCadenceBreak ? "w-0.5 bg-zinc-400" : "w-px bg-zinc-300"}`} />
                        )}
                        <div
                          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2.5 @[640px]:w-3 rounded-t-sm bg-[var(--wx-snow-bar)] border border-sky-300"
                          style={{ height: `${pct}%` }}
                          title={`${cm.toFixed(1)} cm Neuschnee`}
                        />
                      </div>
                      <div className="text-[10px] text-center text-zinc-900 tabular-nums py-1 leading-tight">
                        <div className="font-bold">
                          {cm > 0 ? cm.toFixed(1) : "–"}
                        </div>
                        <div className="text-zinc-700 font-semibold">cm</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="px-4 py-2 border-t border-zinc-200 bg-[color-mix(in_oklab,var(--accent)_10%,white)] text-[11px] text-zinc-800 font-bold flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5"><span className="inline-flex items-end w-2.5 h-3 align-middle overflow-hidden rounded-sm"><span className="w-full bg-[var(--wx-rain)]" style={{ height: "40%", opacity: 0.25 }} /></span><span className="inline-block w-2.5 h-3 align-middle rounded-sm overflow-hidden flex items-end"><span className="block w-full bg-[var(--wx-rain)]" style={{ height: "70%" }} /></span><CloudRain className="w-3.5 h-3.5" aria-label="Regen" /> mm (sicher) · % (Risiko)</span>
        <span className="inline-flex items-center gap-1.5"><Wind className="w-3.5 h-3.5" aria-label="Wind" /> km/h (Wind / Böen)</span>
        {extended && (
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm bg-[var(--wx-sun)] align-middle" /><Sun className="w-3.5 h-3.5" aria-label="Sonne" /> min/h · <Sunrise className="w-3.5 h-3.5 text-amber-700" aria-label="Sonnenaufgang" /> · <Sunset className="w-3.5 h-3.5 text-amber-700" aria-label="Sonnenuntergang" /></span>
        )}
        {snow && (
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm bg-[var(--wx-snow-bar)] border border-sky-300 align-middle" /><Snowflake className="w-3.5 h-3.5" aria-label="Neuschnee" /> cm</span>
        )}
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */

function Footer({
  forecast: _forecast,
  selectedDayIdx: _selectedDayIdx,
  extended: _extended,
}: {
  forecast: import("@/lib/weather").ForecastResponse;
  selectedDayIdx: number;
  extended: boolean;
}) {
  const updated = new Date();
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 pt-3">
      <div className="text-xs text-zinc-700 font-medium">
        MeteoSchweiz local_forecast (OGD) · Tag 6–10: DWD-MOSMIX · aktualisiert{" "}
        {String(updated.getHours()).padStart(2, "0")}:
        {String(updated.getMinutes()).padStart(2, "0")}
      </div>
      <div className="text-xs text-zinc-700 font-medium">
        Grafik ©{" "}
        <a
          href="https://oberthurgauerwetter.ch"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          oberthurgauerwetter.ch
        </a>
      </div>
    </footer>
  );
}

/* ---------------- Helpers ---------------- */

function WindArrow({ deg, size = "md" }: { deg: number; size?: "sm" | "md" | "lg" }) {
  // Meteorological wind direction = where wind comes FROM.
  // Arrow points in the direction the wind is blowing TO, so rotate by deg+180.
  const sizeClass =
    size === "lg" ? "text-lg w-5" : size === "sm" ? "text-sm w-4" : "text-base w-4";
  return (
    <span
      className={`inline-flex items-center justify-center font-bold text-zinc-700 ${sizeClass}`}
      style={{
        transform: `rotate(${deg + 180}deg)`,
        transformOrigin: "center",
        lineHeight: 1,
      }}
      aria-hidden
    >
      ↑
    </span>
  );
}

function SkeletonWidget() {
  return (
    <div className="space-y-5">
      <div className="flex @[900px]:grid @[900px]:grid-cols-5 gap-px bg-zinc-200 border border-zinc-200 rounded-md overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-zinc-50 p-4 h-48 animate-pulse min-w-[55%] @[420px]:min-w-[40%] @[640px]:min-w-[28%] @[900px]:min-w-0"
          />
        ))}
      </div>
      <div className="h-56 bg-zinc-50 border border-zinc-200 rounded-md animate-pulse" />
    </div>
  );
}
