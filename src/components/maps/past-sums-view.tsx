import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LazyPrecipAccumMap } from "@/components/maps/lazy-maps";
import { pastPrecipQuery } from "@/lib/map-queries";
import { PAST_WINDOWS, type PastWindow } from "@/lib/precip-past";
import { cn } from "@/lib/utils";

export function PastSumsView({ embed = false }: { embed?: boolean }) {
  const { data, isLoading, error } = useQuery({ ...pastPrecipQuery(), refetchInterval: 30 * 60_000 });
  const [hours, setHours] = useState<PastWindow>(24);
  const [mode, setMode] = useState<"rain" | "snow">("rain");
  const [period, setPeriod] = useState<"past" | "future">("past");

  const btn = (active: boolean) =>
    cn(
      "px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors tabular-nums",
      active ? "bg-[#2561a1] text-white shadow-sm" : "text-foreground hover:bg-muted",
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl bg-card p-1 shadow-md ring-1 ring-border/50" role="group" aria-label="Zeitrichtung">
          <button type="button" className={btn(period === "past")} onClick={() => setPeriod("past")}>Gefallen</button>
          <button type="button" className={btn(period === "future")} onClick={() => setPeriod("future")}>Prognose</button>
        </div>
        <div className="flex gap-1 rounded-xl bg-card p-1 shadow-md ring-1 ring-border/50" role="group" aria-label="Zeitraum">
          {PAST_WINDOWS.map((h) => (
            <button key={h} type="button" className={btn(hours === h)} onClick={() => setHours(h)}>
              {period === "future" ? `+${h} h` : `${h} h`}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-xl bg-card p-1 shadow-md ring-1 ring-border/50 sm:ml-auto" role="group" aria-label="Anzeige">
          <button type="button" className={btn(mode === "rain")} onClick={() => setMode("rain")}>Niederschlag (mm)</button>
          <button type="button" className={btn(mode === "snow")} onClick={() => setMode("snow")}>Neuschnee (cm)</button>
        </div>
      </div>
      {isLoading && <div className="h-[420px] rounded-lg bg-muted animate-pulse" />}
      {error && <div className="text-sm text-destructive">Summen konnten nicht geladen werden.</div>}
      {data && (() => {
        if (period === "future") {
          const f = data.forecast;
          if (!f) return <div className="text-sm text-muted-foreground">Prognose wird geladen …</div>;
          const stand = new Date(data.generatedAt).toLocaleString("de-CH", { timeZone: "Europe/Zurich", dateStyle: "short", timeStyle: "short" });
          return (
            <Suspense fallback={<div className="h-[420px] rounded-lg bg-muted" />}>
              <LazyPrecipAccumMap
                values={(mode === "snow" ? f.snow : f.rain)[hours]}
                gridLat={data.gridLat}
                gridLon={data.gridLon}
                stations={[]}
                mode={mode}
                hours={hours}
                sourceLabel={`Prognose nächste ${hours} h`}
                updatedLabel={stand}
                dataLabel="MeteoSchweiz ICON-CH1/CH2"
              />
            </Suspense>
          );
        }
        const useRadar = mode === "rain" && !!data.radar;
        const grid = useRadar ? data.radar! : data;
        const values = useRadar ? data.radar!.rain[hours] : (mode === "snow" ? data.snow : data.rain)[hours];
        const stand = new Date(useRadar ? data.radar!.t : data.generatedAt).toLocaleString("de-CH", { timeZone: "Europe/Zurich", dateStyle: "short", timeStyle: "short" });
        const missing = useRadar ? data.radar!.missingHours[hours] ?? 0 : 0;
        const label = [missing ? `${missing} h fehlen` : "", !useRadar ? "Fläche: Modell" : ""].filter(Boolean).join(" · ");
        const stations = data.stations
          .map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, value: (mode === "snow" ? s.snow : s.rain)[hours], own: s.source === "own" || s.id.includes("-") }))
          .filter((s) => s.value !== null) as { id: string; name: string; lat: number; lon: number; value: number; own: boolean }[];
        return (
        <Suspense fallback={<div className="h-[420px] rounded-lg bg-muted" />}>
          <LazyPrecipAccumMap
            values={values}
            gridLat={grid.gridLat}
            gridLon={grid.gridLon}
            stations={stations}
            mode={mode}
            hours={hours}
            sourceLabel={label}
            updatedLabel={stand}
          />
        </Suspense>
        );
      })()}
      {embed && (
        <a href="https://oberthurgauer-wetter.lovable.app/karten/niederschlag" target="_blank" rel="noopener" className="block text-xs text-muted-foreground underline">
          Mehr auf Oberthurgauer Wetter
        </a>
      )}
    </div>
  );
}
