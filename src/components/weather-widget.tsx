import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchForecast,
  formatDateShort,
  formatTimeHHMM,
  reverseGeocode,
  searchLocations,
  secondsToHours,
  weatherLabel,
  weekdayLong,
  weekdayShort,
  windDirectionLabel,
  type GeoLocation,
} from "@/lib/weather";
import { WeatherIcon } from "@/components/weather-icons";

const DEFAULT_LOCATION = {
  name: "Amriswil",
  latitude: 47.5504,
  longitude: 9.3021,
};

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

export function WeatherWidget() {
  const [location, setLocation] = useState<StoredLocation>(() => {
    if (typeof window === "undefined") return DEFAULT_LOCATION;
    try {
      const raw = localStorage.getItem("weather:location");
      if (raw) return JSON.parse(raw) as StoredLocation;
    } catch {
      /* ignore */
    }
    return DEFAULT_LOCATION;
  });
  const [extended, setExtended] = useState(true);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const now = useNow();

  useEffect(() => {
    try {
      localStorage.setItem("weather:location", JSON.stringify(location));
    } catch {
      /* ignore */
    }
  }, [location]);

  const forecast = useQuery({
    queryKey: ["forecast", location.latitude, location.longitude],
    queryFn: () => fetchForecast(location.latitude, location.longitude),
    staleTime: 15 * 60 * 1000,
  });

  const days = useMemo(() => {
    if (!forecast.data) return [];
    return forecast.data.daily.time.slice(0, 5).map((iso, i) => ({
      iso,
      date: new Date(iso + "T12:00:00"),
      idx: i,
    }));
  }, [forecast.data]);

  // Continuous hourly list across all days, 3h cadence, starting at current 3h block.
  const allHourly = useMemo(() => {
    if (!forecast.data) return [];
    const h = forecast.data.hourly;
    const curBlockMs = (() => {
      const d = new Date(now);
      d.setMinutes(0, 0, 0);
      d.setHours(Math.floor(d.getHours() / 3) * 3);
      return d.getTime();
    })();
    const out: number[] = [];
    for (let i = 0; i < h.time.length; i++) {
      const t = new Date(h.time[i]);
      if (t.getHours() % 3 !== 0) continue;
      if (t.getTime() < curBlockMs) continue;
      out.push(i);
    }
    return out;
  }, [forecast.data, now]);

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 antialiased py-6 px-3 md:py-10 md:px-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <Header
          locationName={location.name}
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
        />

        {forecast.isLoading && <SkeletonWidget />}
        {forecast.isError && (
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
              onSelect={setSelectedDayIdx}
              extended={extended}
            />

            <DetailPanel
              forecast={forecast.data}
              hourlyIndices={allHourly}
              days={days}
              selectedDayIdx={selectedDayIdx}
              onVisibleDayChange={setSelectedDayIdx}
              now={now}
            />

            <Footer
              forecast={forecast.data}
              selectedDayIdx={selectedDayIdx}
              extended={extended}
            />
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Header ---------------- */

function Header({
  locationName,
  onSelectLocation,
  onGeolocate,
  extended,
  onToggleExtended,
}: {
  locationName: string;
  onSelectLocation: (loc: GeoLocation) => void;
  onGeolocate: () => void;
  extended: boolean;
  onToggleExtended: (v: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useQuery({
    queryKey: ["geo", debounced],
    queryFn: () => searchLocations(debounced),
    enabled: debounced.trim().length >= 2,
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
    <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 pb-5 border-b border-zinc-200">
      <div className="space-y-3 w-full md:max-w-[56ch]">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight uppercase text-zinc-900">
          Lokalprognose {locationName}
        </h1>
        <div className="flex items-center gap-2" ref={containerRef}>
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
              className="w-full h-9 bg-zinc-50 border border-zinc-200 rounded-sm px-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/40"
            />
            {open && search.data && search.data.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 top-10 bg-zinc-50 border border-zinc-200 rounded-sm shadow-lg max-h-72 overflow-y-auto">
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
                      <span className="font-medium text-zinc-900">
                        {r.name}
                      </span>
                      <span className="text-[11px] text-zinc-500 uppercase tracking-wider">
                        {r.admin1 ?? "CH"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={onGeolocate}
            title="Aktueller Standort"
            className="h-9 px-3 flex items-center gap-1.5 bg-zinc-900 text-zinc-50 text-sm font-medium rounded-sm transition-colors hover:bg-zinc-800"
          >
            <span className="shrink-0 opacity-80" aria-hidden>
              ⌖
            </span>
            <span className="hidden sm:inline">Ortung</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-zinc-200/50 p-1 rounded-sm border border-zinc-200 self-start md:self-auto">
        <span className="text-[11px] font-medium uppercase tracking-wider pl-2 text-zinc-500 hidden sm:inline">
          Erweiterte Anzeige
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wider pl-2 text-zinc-500 sm:hidden">
          Erweitert
        </span>
        <div className="flex">
          <button
            type="button"
            onClick={() => onToggleExtended(true)}
            className={`h-6 px-3 text-[10px] font-semibold uppercase tracking-widest rounded-[1px] transition-colors ${
              extended
                ? "bg-accent text-zinc-50 shadow-sm shadow-accent/20"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            Ein
          </button>
          <button
            type="button"
            onClick={() => onToggleExtended(false)}
            className={`h-6 px-3 text-[10px] font-semibold uppercase tracking-widest rounded-[1px] transition-colors ${
              !extended
                ? "bg-accent text-zinc-50 shadow-sm shadow-accent/20"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            Aus
          </button>
        </div>
      </div>
    </header>
  );
}

/* ---------------- 5-Day Strip ---------------- */

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
  return (
    <div className="flex md:grid md:grid-cols-5 gap-px bg-zinc-200 border border-zinc-200 rounded-sm overflow-x-auto snap-x snap-mandatory no-scrollbar">
      {days.map((day, i) => {
        const selected = i === selectedIdx;
        const dim = !selected;
        return (
          <button
            key={day.iso}
            type="button"
            onClick={() => onSelect(i)}
            className={`relative text-left p-4 space-y-3 snap-start min-w-[60%] sm:min-w-[40%] md:min-w-0 transition-colors ${
              selected
                ? "bg-zinc-50 ring-1 ring-inset ring-accent/30"
                : "bg-zinc-50/80 hover:bg-zinc-50"
            } ${dim ? "opacity-90" : ""}`}
          >
            {selected && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-accent" />
            )}
            <div className="flex flex-col">
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider ${
                  selected ? "text-accent" : "text-zinc-900"
                }`}
              >
                {i === 0 ? "Heute" : i === 1 ? "Morgen" : weekdayLong(day.date)}
              </span>
              <span className="text-sm text-zinc-500">
                {weekdayShort(day.date)} {formatDateShort(day.date)}
              </span>
            </div>
            <div
              className={`py-1 select-none ${selected ? "text-zinc-900" : "text-zinc-700"}`}
              aria-label={weatherLabel(d.weathercode[i])}
              title={weatherLabel(d.weathercode[i])}
            >
              <WeatherIcon code={d.weathercode[i]} size={72} />
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold tabular-nums">
                  {Math.round(d.temperature_2m_max[i])}°
                </span>
                <span className="text-sm text-zinc-400 font-medium tabular-nums">
                  {Math.round(d.temperature_2m_min[i])}°
                </span>
              </div>
              <div className="text-[11px] uppercase tracking-tight text-zinc-500 flex justify-between tabular-nums">
                <span>{d.precipitation_sum[i].toFixed(1)} mm</span>
                <span>{d.precipitation_probability_max[i] ?? 0}%</span>
              </div>
            </div>
            <div className="pt-3 border-t border-zinc-100 space-y-2">
              <div className="flex items-center justify-between text-[10px] uppercase font-medium text-zinc-400">
                <span>Wind</span>
                <span className="text-zinc-900 tabular-nums flex items-center gap-1">
                  <WindArrow deg={d.winddirection_10m_dominant[i]} />
                  {Math.round(d.windspeed_10m_max[i])}
                  <span className="text-zinc-400">
                    /{Math.round(d.windgusts_10m_max[i])}
                  </span>{" "}
                  km/h
                </span>
              </div>
              {extended && (
                <>
                  <div className="flex items-center justify-between text-[10px] uppercase font-medium text-zinc-400">
                    <span>Sonne</span>
                    <span className="text-zinc-900 tabular-nums">
                      {secondsToHours(d.sunshine_duration[i])} h
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] uppercase font-medium text-zinc-400 tabular-nums">
                    <span>↑ {formatTimeHHMM(d.sunrise[i])}</span>
                    <span>↓ {formatTimeHHMM(d.sunset[i])}</span>
                  </div>
                </>
              )}
            </div>
          </button>
        );
      })}
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
  now,
}: {
  forecast: import("@/lib/weather").ForecastResponse;
  hourlyIndices: number[];
  days: { iso: string; date: Date; idx: number }[];
  selectedDayIdx: number;
  onVisibleDayChange: (i: number) => void;
  now: Date;
}) {
  const h = forecast.hourly;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const userScrolling = useRef(false);

  const selectedDay = days[selectedDayIdx];

  // Scroll to first slot of the selected day when user picks a day in the strip.
  useEffect(() => {
    if (!selectedDay) return;
    const firstIso = hourlyIndices
      .map((idx) => h.time[idx])
      .find((iso) => iso.slice(0, 10) === selectedDay.iso);
    if (!firstIso) return;
    const el = slotRefs.current.get(firstIso);
    const scroller = scrollerRef.current;
    if (!el || !scroller) return;
    // Mark as programmatic scroll so onScroll doesn't override the selection.
    userScrolling.current = false;
    scroller.scrollTo({
      left: el.offsetLeft - scroller.offsetLeft,
      behavior: "smooth",
    });
    const t = window.setTimeout(() => {
      userScrolling.current = true;
    }, 700);
    return () => window.clearTimeout(t);
  }, [selectedDayIdx, selectedDay, hourlyIndices, h.time]);

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
      for (const idx of hourlyIndices) {
        const iso = h.time[idx];
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
  const currentBlockMs = (() => {
    const d = new Date(now);
    d.setMinutes(0, 0, 0);
    d.setHours(Math.floor(d.getHours() / 3) * 3);
    return d.getTime();
  })();

  return (
    <section className="bg-zinc-50 rounded-sm border border-zinc-200 overflow-hidden">
      <div className="p-3 bg-zinc-100 border-b border-zinc-200 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold uppercase tracking-widest text-zinc-700">
          Detailansicht •{" "}
          {selectedDayIdx === 0 ? "Heute" : weekdayLong(selectedDay.date)}{" "}
          {formatDateShort(selectedDay.date)}
        </span>
        <span className="text-xs text-zinc-500 font-medium uppercase hidden sm:inline">
          3-Stunden-Takt • °C / mm / km/h
        </span>
      </div>
      <div
        ref={scrollerRef}
        className="overflow-x-auto no-scrollbar scroll-smooth snap-x"
      >
        <div className="flex">
          {hourlyIndices.map((idx, i) => {
            const iso = h.time[idx];
            const t = new Date(iso);
            const isCurrent = t.getTime() === currentBlockMs;
            const prevIso = i > 0 ? h.time[hourlyIndices[i - 1]] : null;
            const isDayStart =
              !prevIso || prevIso.slice(0, 10) !== iso.slice(0, 10);
            return (
              <div
                key={iso}
                ref={(el) => {
                  if (el) slotRefs.current.set(iso, el);
                  else slotRefs.current.delete(iso);
                }}
                className={`flex-shrink-0 w-[124px] p-4 space-y-3 snap-start ${
                  isCurrent ? "bg-accent/5" : ""
                } ${
                  isDayStart
                    ? "border-l-2 border-accent/40"
                    : "border-l border-zinc-200"
                }`}
              >
                {isDayStart && (
                  <div className="text-xs font-bold uppercase tracking-wider text-accent">
                    {weekdayShort(t)} {formatDateShort(t)}
                  </div>
                )}
                <div
                  className={`text-sm font-semibold tabular-nums ${
                    isCurrent ? "text-accent" : "text-zinc-600"
                  }`}
                >
                  {String(t.getHours()).padStart(2, "0")}:00
                </div>
                <div
                  className="flex items-center justify-center"
                  title={weatherLabel(h.weathercode[idx])}
                >
                  <WeatherIcon
                    code={h.weathercode[idx]}
                    isDay={t.getHours() >= 6 && t.getHours() < 20}
                    size={56}
                  />
                </div>
                <div className="text-xl font-semibold tabular-nums text-zinc-900">
                  {h.temperature_2m[idx].toFixed(1)}°
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium tabular-nums flex justify-between">
                    <span className="text-zinc-700">
                      {h.precipitation[idx].toFixed(1)} mm
                    </span>
                    <span className="text-zinc-500">
                      {h.precipitation_probability[idx] ?? 0}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <WindArrow deg={h.winddirection_10m[idx]} />
                    <span className="font-semibold tabular-nums text-zinc-800">
                      {Math.round(h.windspeed_10m[idx])}
                      <span className="font-normal text-zinc-500">
                        /{Math.round(h.windgusts_10m[idx])}
                      </span>
                    </span>
                    <span className="text-zinc-500 uppercase">
                      {windDirectionLabel(h.winddirection_10m[idx])}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 uppercase tracking-wider flex justify-between">
                    <span>Schnee</span>
                    <span className="text-zinc-800 tabular-nums">
                      {h.snowfall[idx].toFixed(1)} cm
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */

function Footer({
  forecast,
  selectedDayIdx,
  extended,
}: {
  forecast: import("@/lib/weather").ForecastResponse;
  selectedDayIdx: number;
  extended: boolean;
}) {
  const d = forecast.daily;
  const updated = new Date();
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 pt-3">
      <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest">
        MeteoSchweiz ICON-CH1-EPS / ICON-CH2-EPS • Aktualisiert{" "}
        {String(updated.getHours()).padStart(2, "0")}:
        {String(updated.getMinutes()).padStart(2, "0")}
      </div>
      {extended && (
        <div className="flex gap-5 tabular-nums">
          <div className="flex items-center gap-2">
            <span className="text-base text-zinc-400">↑</span>
            <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-tight">
              {formatTimeHHMM(d.sunrise[selectedDayIdx])}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base text-zinc-400">↓</span>
            <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-tight">
              {formatTimeHHMM(d.sunset[selectedDayIdx])}
            </span>
          </div>
        </div>
      )}
    </footer>
  );
}

/* ---------------- Helpers ---------------- */

function WindArrow({ deg }: { deg: number }) {
  // Meteorological wind direction = where wind comes FROM.
  // Arrow points in the direction the wind is blowing TO, so rotate by deg+180.
  return (
    <span
      className="inline-block text-zinc-500"
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-zinc-200 border border-zinc-200 rounded-sm overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-zinc-50 p-4 h-48 animate-pulse" />
        ))}
      </div>
      <div className="h-56 bg-zinc-50 border border-zinc-200 rounded-sm animate-pulse" />
    </div>
  );
}
