import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchForecast,
  formatDateShort,
  formatTimeHHMM,
  reverseGeocode,
  searchLocations,
  
  weatherLabel,
  weekdayLong,
  weekdayShort,
  windDirectionLabel,
  type GeoLocation,
} from "@/lib/weather";
import { WeatherIcon } from "@/components/weather-icons";
import { Switch } from "@/components/ui/switch";

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
  const [extended, setExtended] = useState(false);
  const [snow, setSnow] = useState(false);
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
    return forecast.data.daily.time.slice(0, 7).map((iso, i) => ({
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
    <div className="@container bg-zinc-100 text-zinc-900 antialiased font-medium py-4 px-3 @[640px]:py-6 @[640px]:px-5 @[900px]:py-10 @[900px]:px-6">
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
          snow={snow}
          onToggleSnow={setSnow}
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
              extended={extended}
              snow={snow}
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
  snow,
  onToggleSnow,
}: {
  locationName: string;
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
    <header className="flex flex-col @[640px]:flex-row @[640px]:items-end justify-between gap-4 @[640px]:gap-6 pb-5 border-b border-zinc-200">
      <div className="space-y-3 w-full @[640px]:max-w-[56ch]">
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
              placeholder={`Gemeinde suchen… (aktuell: ${locationName})`}
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
      </div>

      <div className="flex flex-wrap items-center gap-4 self-start @[640px]:self-auto">
        <label className="flex items-center gap-3 cursor-pointer">
          <Switch
            checked={extended}
            onCheckedChange={onToggleExtended}
            aria-label="Sonnenschein"
          />
          <span className="text-sm font-medium text-zinc-700 select-none">
            Sonnenschein
          </span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <Switch
            checked={snow}
            onCheckedChange={onToggleSnow}
            aria-label="Schnee"
          />
          <span className="text-sm font-medium text-zinc-700 select-none">
            Schnee
          </span>
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

  return (
    <div className="space-y-2">
      <div className="flex gap-px bg-zinc-200 border border-zinc-200 rounded-md overflow-x-auto snap-x snap-mandatory no-scrollbar">
        {days.map((day, i) => {
          const selected = i === selectedIdx;
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onSelect(i)}
              className={`relative text-left p-3 @[640px]:p-4 space-y-3 snap-start shrink-0 basis-[55%] @[420px]:basis-[40%] @[640px]:basis-[28%] @[900px]:basis-[calc(20%-1px)] transition-colors ${
                selected
                  ? "bg-[var(--accent-soft)]"
                  : "bg-zinc-50 hover:bg-zinc-50/80"
              }`}
            >
              {selected && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-accent" />
              )}
              <div className="flex flex-col">
                <span
                  className={`text-base font-semibold ${
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
                className="py-1 select-none text-zinc-900"
                aria-label={weatherLabel(d.weathercode[i])}
                title={weatherLabel(d.weathercode[i])}
              >
                <WeatherIcon code={d.weathercode[i]} size={72} />
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-semibold tabular-nums text-zinc-900">
                    {Math.round(d.temperature_2m_max[i])}°
                  </span>
                  <span className="text-base text-zinc-500 font-medium tabular-nums">
                    {Math.round(d.temperature_2m_min[i])}°
                  </span>
                </div>
                <div className="text-xs text-zinc-500 flex justify-between tabular-nums">
                  <span>{d.precipitation_sum[i].toFixed(1)} mm</span>
                  <span>{d.precipitation_probability_max[i] ?? 0}%</span>
                </div>
              </div>
              <div className="pt-3 border-t border-zinc-200/70 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Wind</span>
                  <span className="text-zinc-800 font-medium tabular-nums flex items-center gap-1">
                    <WindArrow deg={d.winddirection_10m_dominant[i]} />
                    {Math.round(d.windspeed_10m_max[i])}
                    <span className="text-zinc-400">
                      /{Math.round(d.windgusts_10m_max[i])}
                    </span>{" "}
                    km/h
                  </span>
                </div>
                {extended && (
                  <div className="flex items-center justify-between text-xs text-zinc-500 tabular-nums">
                    <span>↑ {formatTimeHHMM(d.sunrise[i])}</span>
                    <span>↓ {formatTimeHHMM(d.sunset[i])}</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
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
  extended,
  snow,
}: {
  forecast: import("@/lib/weather").ForecastResponse;
  hourlyIndices: number[];
  days: { iso: string; date: Date; idx: number }[];
  selectedDayIdx: number;
  onVisibleDayChange: (i: number) => void;
  now: Date;
  extended: boolean;
  snow: boolean;
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
    <section className="bg-zinc-50 rounded-md border border-zinc-200 overflow-hidden">
      <div className="px-4 py-3 bg-zinc-100/70 border-b border-zinc-200 flex items-center justify-between gap-3">
        <span className="text-base font-semibold text-zinc-800">
          {selectedDayIdx === 0
            ? "Heute"
            : selectedDayIdx === 1
              ? "Morgen"
              : weekdayLong(selectedDay.date)}
        </span>
        <span className="text-xs text-zinc-500 hidden sm:inline">
          3h · Temperatur °C · Wind / Böenspitzen km/h
        </span>
      </div>
      <div className="flex items-stretch">
        {/* Y-axes for charts */}
        <div className="w-10 shrink-0 border-r border-zinc-200 bg-zinc-100/50 flex flex-col justify-end">
          <div className="flex-1" />
          {/* Precipitation axis */}
          <div className="relative h-[72px] text-[10px] text-zinc-500 tabular-nums">
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
          <div className="text-[10px] text-zinc-500 text-right pr-1 pb-1 leading-tight">
            Regen<br />mm/3h
          </div>
          {extended && (
            <>
              <div className="relative h-[72px] text-[10px] text-zinc-500 tabular-nums border-t border-zinc-200">
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
              <div className="text-[10px] text-zinc-500 text-right pr-1 pb-1 leading-tight">
                Sonne<br />min/h
              </div>
            </>
          )}
          {snow && (
            <>
              <div className="relative h-[72px] text-[10px] text-zinc-500 tabular-nums border-t border-zinc-200">
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
              <div className="text-[10px] text-zinc-500 text-right pr-1 pb-1 leading-tight">
                Schnee<br />cm/3h
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
              {hourlyIndices.map((idx, i) => {
                const iso = h.time[idx];
                const prevIso = i > 0 ? h.time[hourlyIndices[i - 1]] : null;
                const isDayStart =
                  !!prevIso && prevIso.slice(0, 10) !== iso.slice(0, 10);
                const t = new Date(iso);
                const isCurrent = t.getTime() === currentBlockMs;
                const wind = h.windspeed_10m[idx];
                const rawGust = h.windgusts_10m[idx];
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
                    className={`flex-shrink-0 w-[108px] @[640px]:w-[124px] p-3 @[640px]:p-4 space-y-3 snap-start ${
                      isDayStart ? "border-l border-zinc-300" : ""
                    } ${isCurrent ? "bg-[var(--accent-soft)]" : ""}`}
                  >
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
                      <div className="flex items-center gap-1.5 text-xs">
                        <WindArrow deg={h.winddirection_10m[idx]} />
                        <span className="font-semibold tabular-nums text-zinc-800">
                          {Math.round(wind)}
                          <span className="font-normal text-zinc-500">
                            /{Math.round(gust)}
                          </span>
                        </span>
                        <span className="text-zinc-500">
                          {windDirectionLabel(h.winddirection_10m[idx])}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Precipitation bar chart */}
            <div className="flex border-t border-zinc-200 bg-zinc-50/60">
              {hourlyIndices.map((idx, i) => {
                const iso = h.time[idx];
                const prevIso = i > 0 ? h.time[hourlyIndices[i - 1]] : null;
                const isDayStart =
                  !prevIso || prevIso.slice(0, 10) !== iso.slice(0, 10);
                const precip = h.precipitation[idx] ?? 0;
                const precipProb = h.precipitation_probability[idx] ?? 0;
                const precipPct = Math.min(precip / 5, 1) * 100;
                const barOpacity =
                  precip > 0 ? 0.35 + (precipProb / 100) * 0.65 : 0;
                return (
                  <div
                    key={iso}
                    className="flex-shrink-0 w-[108px] @[640px]:w-[124px] flex flex-col"
                  >
                    <div className="relative h-[72px] w-full">
                      {[0, 2.5, 5].map((v) => (
                        <div
                          key={v}
                          className="absolute left-0 right-0 border-t border-zinc-200/80"
                          style={{ top: `${(1 - v / 5) * 100}%` }}
                        />
                      ))}
                      {isDayStart && i > 0 && (
                        <div className="absolute top-0 bottom-0 left-0 w-px bg-zinc-300" />
                      )}
                      <div
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2.5 @[640px]:w-3 rounded-t-sm bg-[var(--wx-rain)]"
                        style={{
                          height: `${precipPct}%`,
                          opacity: barOpacity,
                        }}
                        title={`${precip.toFixed(1)} mm · ${precipProb}%`}
                      />
                    </div>
                    <div className="text-[10px] text-center text-zinc-600 tabular-nums py-1 leading-tight">
                      <div className="font-medium">
                        {precip > 0 ? precip.toFixed(1) : "–"}
                      </div>
                      <div className="text-zinc-400">{precipProb}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Sunshine bar chart (extended only) */}
            {extended && (
              <div className="flex border-t border-zinc-200 bg-zinc-50/60">
                {hourlyIndices.map((idx, i) => {
                  const iso = h.time[idx];
                  const prevIso = i > 0 ? h.time[hourlyIndices[i - 1]] : null;
                  const isDayStart =
                    !prevIso || prevIso.slice(0, 10) !== iso.slice(0, 10);
                  // Sum sunshine over the 3-hour block (in seconds).
                  const sec =
                    (h.sunshine_duration[idx] ?? 0) +
                    (h.sunshine_duration[idx + 1] ?? 0) +
                    (h.sunshine_duration[idx + 2] ?? 0);
                  const minPerHour = Math.round(sec / 3 / 60); // 0..60
                  const pct = Math.min(minPerHour / 60, 1) * 100;
                  return (
                    <div
                      key={iso}
                      className="flex-shrink-0 w-[108px] @[640px]:w-[124px] flex flex-col"
                    >
                      <div className="relative h-[72px] w-full">
                        {[0, 30, 60].map((v) => (
                          <div
                            key={v}
                            className="absolute left-0 right-0 border-t border-zinc-200/80"
                            style={{ top: `${(1 - v / 60) * 100}%` }}
                          />
                        ))}
                        {isDayStart && i > 0 && (
                          <div className="absolute top-0 bottom-0 left-0 w-px bg-zinc-300" />
                        )}
                        <div
                          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2.5 @[640px]:w-3 rounded-t-sm bg-[var(--wx-sun)]"
                          style={{ height: `${pct}%` }}
                          title={`${minPerHour} min/h Sonne`}
                        />
                      </div>
                      <div className="text-[10px] text-center text-zinc-600 tabular-nums py-1 leading-tight">
                        <div className="font-medium">
                          {minPerHour > 0 ? `${minPerHour}` : "–"}
                        </div>
                        <div className="text-zinc-400">min</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Snowfall bar chart (snow only) */}
            {snow && (
              <div className="flex border-t border-zinc-200 bg-zinc-50/60">
                {hourlyIndices.map((idx, i) => {
                  const iso = h.time[idx];
                  const prevIso = i > 0 ? h.time[hourlyIndices[i - 1]] : null;
                  const isDayStart =
                    !prevIso || prevIso.slice(0, 10) !== iso.slice(0, 10);
                  const cm =
                    (h.snowfall[idx] ?? 0) +
                    (h.snowfall[idx + 1] ?? 0) +
                    (h.snowfall[idx + 2] ?? 0);
                  const pct = Math.min(cm / 2, 1) * 100;
                  return (
                    <div
                      key={iso}
                      className="flex-shrink-0 w-[108px] @[640px]:w-[124px] flex flex-col"
                    >
                      <div className="relative h-[72px] w-full">
                        {[0, 1, 2].map((v) => (
                          <div
                            key={v}
                            className="absolute left-0 right-0 border-t border-zinc-200/80"
                            style={{ top: `${(1 - v / 2) * 100}%` }}
                          />
                        ))}
                        {isDayStart && i > 0 && (
                          <div className="absolute top-0 bottom-0 left-0 w-px bg-zinc-300" />
                        )}
                        <div
                          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2.5 @[640px]:w-3 rounded-t-sm bg-[var(--wx-snow-bar)] border border-sky-300"
                          style={{ height: `${pct}%` }}
                          title={`${cm.toFixed(1)} cm Neuschnee`}
                        />
                      </div>
                      <div className="text-[10px] text-center text-zinc-600 tabular-nums py-1 leading-tight">
                        <div className="font-medium">
                          {cm > 0 ? cm.toFixed(1) : "–"}
                        </div>
                        <div className="text-zinc-400">cm</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="px-4 py-2 border-t border-zinc-200 bg-zinc-100/50 text-[10px] text-zinc-500 flex flex-wrap gap-x-4 gap-y-1">
        <span><span className="inline-block w-2 h-2 rounded-sm bg-[var(--wx-rain)] mr-1.5 align-middle" />Regenmenge in mm · Regenwahrscheinlichkeit in %</span>
        <span>Wind / Böenspitzen in km/h</span>
        {extended && (
          <span><span className="inline-block w-2 h-2 rounded-sm bg-[var(--wx-sun)] mr-1.5 align-middle" />Sonnenscheindauer in min/h</span>
        )}
        {snow && (
          <span><span className="inline-block w-2 h-2 rounded-sm bg-[var(--wx-snow-bar)] border border-sky-300 mr-1.5 align-middle" />Neuschnee in cm</span>
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
      <div className="text-xs text-zinc-500">
        MeteoSchweiz ICON-CH1-EPS/ICON-CH2-EPS · Tag 6–7: ECMWF IFS Ensemble · Rest: Open-Meteo best_match · aktualisiert{" "}
        {String(updated.getHours()).padStart(2, "0")}:
        {String(updated.getMinutes()).padStart(2, "0")}
      </div>
      <div className="text-xs text-zinc-500">
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
