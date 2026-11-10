import { blendStations } from "@/lib/station-blend";
import { Suspense, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LazyPrecipAccumMap } from "@/components/maps/lazy-maps";
import { pastPrecipQuery } from "@/lib/map-queries";
import { PAST_WINDOWS, type PastWindow } from "@/lib/precip-past";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { History, ChartNoAxesCombined, Droplets, Snowflake, Download } from "lucide-react";
import { toPng } from "html-to-image";

export function PastSumsView({ embed = false }: { embed?: boolean }) {
  const { data, isLoading, error } = useQuery({ ...pastPrecipQuery(), refetchInterval: 30 * 60_000 });
  const [hours, setHours] = useState<PastWindow>(12);
  const [mode, setMode] = useState<"rain" | "snow">("rain");
  const [period, setPeriod] = useState<"past" | "future">("past");

  const mapRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  async function savePng() {
    const el = mapRef.current;
    if (!el) return;
    setBusy(true);
    try {
      const url = await toPng(el, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
        filter: (n) => !(n instanceof HTMLElement && (n.classList.contains("leaflet-control-container") || n.dataset.exportHide === "1")),
      });
      const day = new Date().toISOString().slice(0, 10);
      const name = `oberthurgau-${mode === "snow" ? "neuschnee" : "niederschlag"}-${period === "future" ? "prognose" : "gefallen"}-${hours}h-${day}.png`;
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "Oberthurgauer Wetter" }); } catch { /* abgebrochen */ }
        return;
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = `oberthurgau-${mode === "snow" ? "neuschnee" : "niederschlag"}-${period === "future" ? "prognose" : "gefallen"}-${hours}h-${day}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.warn("[export] PNG fehlgeschlagen", e);
    } finally {
      setBusy(false);
    }
  }

  const btn = (active: boolean) =>
    cn(
      "h-9 px-3 text-sm font-semibold rounded-md transition-colors tabular-nums",
      active ? "bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm" : "text-foreground hover:bg-muted hover:text-foreground",
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-card p-1 ring-1 ring-border/50" role="group" aria-label="Zeitrichtung">
          <Button variant="ghost" aria-pressed={period === "past"} className={btn(period === "past")} onClick={() => setPeriod("past")}><History />Gefallen</Button>
          <Button variant="ghost" aria-pressed={period === "future"} className={btn(period === "future")} onClick={() => setPeriod("future")}><ChartNoAxesCombined />Prognose</Button>
        </div>
        <div className="flex gap-1 rounded-lg bg-card p-1 ring-1 ring-border/50" role="group" aria-label="Zeitraum">
          {PAST_WINDOWS.map((h) => (
            <Button variant="ghost" key={h} aria-pressed={hours === h} className={btn(hours === h)} onClick={() => setHours(h)}>
              {period === "future" ? `+${h} h` : `${h} h`}
            </Button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg bg-card p-1 ring-1 ring-border/50 sm:ml-auto" role="group" aria-label="Anzeige">
          <Button variant="ghost" aria-pressed={mode === "rain"} className={btn(mode === "rain")} onClick={() => setMode("rain")}><Droplets />Niederschlag <span className="text-xs opacity-75">mm</span></Button>
          <Button variant="ghost" aria-pressed={mode === "snow"} className={btn(mode === "snow")} onClick={() => setMode("snow")}><Snowflake />Neuschnee <span className="text-xs opacity-75">cm</span></Button>
        </div>
        {!embed && data && (
          <div className="flex gap-1 rounded-lg bg-card p-1 ring-1 ring-border/50" role="group" aria-label="Download">
            <Button variant="ghost" className={btn(false)} disabled={busy} onClick={savePng}><Download />{busy ? "…" : "Grafik"}</Button>
          </div>
        )}
      </div>
      {isLoading && <div className="h-[420px] rounded-lg bg-muted animate-pulse" />}
      {error && <div className="text-sm text-destructive">Summen konnten nicht geladen werden.</div>}
      <div ref={mapRef}>
      {data && (() => {
        if (period === "future") {
          const f = data.forecast;
          if (!f) return <div className="text-sm text-muted-foreground">Prognose derzeit nicht verfügbar.</div>;
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
                forecast
              />
            </Suspense>
          );
        }
        const r = data.radar;
        const radarSnowOk = !!r?.snow?.[hours] && (r.snowMissingHours?.[hours] ?? hours) <= hours * 0.25;
        const useRadar = !!r && (mode === "rain" ? (r.missingHours[hours] ?? 0) <= hours * 0.25 : radarSnowOk);
        const radar = useRadar ? r : null;
        const grid = radar ?? data;
        const own = data.stations.filter((s) => s.source === "own" && s.rain[hours] != null).map((s) => ({ lat: s.lat, lon: s.lon, value: s.rain[hours] as number }));
        const values = radar
          ? mode === "snow" ? radar.snow![hours] : blendStations(radar.rain[hours], radar.gridLat, radar.gridLon, own)
          : (mode === "snow" ? data.snow : data.rain)[hours];
        const stand = new Date(radar?.t ?? data.generatedAt).toLocaleString("de-CH", { timeZone: "Europe/Zurich", dateStyle: "short", timeStyle: "short" });
        const missing = (mode === "snow" ? radar?.snowMissingHours?.[hours] : radar?.missingHours[hours]) ?? 0;
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
            dataLabel={mode === "snow" ? (radar ? "MeteoSchweiz CombiPrecip + Schneefallgrenze aus Gelände, Stationen und ICON-CH1 (Fläche), SMN-Schneehöhen (Stationen)" : "MeteoSchweiz ICON-CH1/CH2 (Fläche), SMN-Schneehöhen (Stationen; Säntis: Modell)") : "eigene Stationen, MeteoSchweiz"}
          />
        </Suspense>
        );
      })()}
      </div>
      {embed && (
        <a href="https://oberthurgauer-wetter.lovable.app/karten/niederschlag" target="_blank" rel="noopener" className="block text-xs text-muted-foreground underline">
          Mehr auf Oberthurgauer Wetter
        </a>
      )}
    </div>
  );
}
