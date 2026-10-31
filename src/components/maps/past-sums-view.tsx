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

  const btn = (active: boolean) =>
    cn(
      "px-3 py-1.5 text-sm font-medium rounded-full transition-colors tabular-nums",
      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="Zeitraum">
          {PAST_WINDOWS.map((h) => (
            <button key={h} type="button" className={btn(hours === h)} onClick={() => setHours(h)}>
              {h} h
            </button>
          ))}
        </div>
        <div className="flex gap-1 sm:ml-auto" role="group" aria-label="Anzeige">
          <button type="button" className={btn(mode === "rain")} onClick={() => setMode("rain")}>Niederschlag (mm)</button>
          <button type="button" className={btn(mode === "snow")} onClick={() => setMode("snow")}>Neuschnee (cm)</button>
        </div>
      </div>
      {isLoading && <div className="h-[420px] rounded-lg bg-muted animate-pulse" />}
      {error && <div className="text-sm text-destructive">Summen konnten nicht geladen werden.</div>}
      {data && (() => {
        const useRadar = mode === "rain" && !!data.radar;
        const grid = useRadar ? data.radar! : data;
        const values = useRadar ? data.radar!.rain[hours] : (mode === "snow" ? data.snow : data.rain)[hours];
        const stand = new Date(useRadar ? data.radar!.t : data.generatedAt).toLocaleString("de-CH", { timeZone: "Europe/Zurich", dateStyle: "short", timeStyle: "short" });
        const missing = useRadar ? data.radar!.missingHours[hours] ?? 0 : 0;
        const label = useRadar
          ? `Fläche: ${data.radar!.source}${missing ? ` (${missing} h fehlen)` : ""} · Punkte: MeteoSchweiz-Stationen · Stand ${stand}`
          : `Fläche: ${data.source} · Punkte: MeteoSchweiz-Stationen · Stand ${stand}`;
        const stations = data.stations
          .map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, value: (mode === "snow" ? s.snow : s.rain)[hours] }))
          .filter((s) => s.value !== null) as { id: string; name: string; lat: number; lon: number; value: number }[];
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
