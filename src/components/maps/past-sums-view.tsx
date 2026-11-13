import { blendStations } from "@/lib/station-blend";
import { downscaleSnow } from "@/lib/snow-downscale";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
  const { data: dem } = useQuery({
    queryKey: ["terrain-dem-420x200"],
    queryFn: async () => new Int16Array(await (await fetch("/terrain-elev-420x200.bin")).arrayBuffer()),
    staleTime: Infinity,
  });
  const [mode, setMode] = useState<"rain" | "snow">("rain");
  const [period, setPeriod] = useState<"past" | "future">("past");
  const [clean, setClean] = useState(false);
  // Direktlinks (z. B. aus dem Ticker): ?p=past|future&m=rain|snow&h=12|24|48|72
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const h = Number(q.get("h"));
    if ((PAST_WINDOWS as readonly number[]).includes(h)) setHours(h as PastWindow);
    if (q.get("m") === "snow" || q.get("m") === "rain") setMode(q.get("m") as "rain" | "snow");
    if (q.get("clean") === "1") setClean(true);
    if (q.get("p") === "future" || q.get("p") === "past") setPeriod(q.get("p") as "past" | "future");
  }, []);
  const fineSnow = useMemo(() => {
    if (mode !== "snow" || !data) return null;
    const f = period === "future" ? data.forecast : data;
    const line = f?.snowLine?.[hours];
    if (!dem || !f || !line || dem.length !== 84000) return null;
    return downscaleSnow(f.rain[hours], line, data.gridLat, data.gridLon, dem);
  }, [data, dem, hours, mode, period]);

  const mapRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  async function savePng() {
    const el = mapRef.current;
    if (!el) return;
    setBusy(true);
    try {
      const opts = {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
        filter: (n: Node) => !(n instanceof HTMLElement && (n.classList.contains("leaflet-control-container") || n.dataset.exportHide === "1")),
      };
      // Safari/WebKit dekodiert Rasterbilder im SVG-Export erst beim ersten Durchlauf:
      // stiller Warm-up, damit die Niederschlagsfläche im finalen Bild enthalten ist.
      await toPng(el, opts);
      await new Promise((r) => setTimeout(r, 250));
      const url = await toPng(el, opts);
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
      {!clean && <>
      <div className="space-y-4 pb-1">
        <div className="grid w-full max-w-sm grid-cols-2 gap-1 rounded-lg bg-card p-1 ring-1 ring-border/50" role="group" aria-label="Zeitrichtung">
          <Button variant="ghost" aria-pressed={period === "past"} className={btn(period === "past")} onClick={() => setPeriod("past")}><History />Gefallen</Button>
          <Button variant="ghost" aria-pressed={period === "future"} className={btn(period === "future")} onClick={() => setPeriod("future")}><ChartNoAxesCombined />Prognose</Button>
        </div>
        <div className="grid w-full max-w-sm grid-cols-2 gap-1 rounded-lg bg-card p-1 ring-1 ring-border/50" role="group" aria-label="Anzeige">
          <Button variant="ghost" aria-pressed={mode === "rain"} className={btn(mode === "rain")} onClick={() => setMode("rain")}><Droplets />Regen <span className="text-xs opacity-75">mm</span></Button>
          <Button variant="ghost" aria-pressed={mode === "snow"} className={btn(mode === "snow")} onClick={() => setMode("snow")}><Snowflake />Neuschnee <span className="text-xs opacity-75">cm</span></Button>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3 border-t border-border/60 pt-3">
        <div className="min-w-0 space-y-2">
          <div className="text-xs font-medium text-muted-foreground"> {period === "future" ? "Nächste Stunden" : "Letzte Stunden"}</div>
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-card p-1 ring-1 ring-border/50" role="group" aria-label="Zeitraum">
            {PAST_WINDOWS.map((h) => (
              <Button variant="ghost" key={h} aria-pressed={hours === h} className={cn(btn(hours === h), "px-2 sm:px-3", period === "future" && "h-11")} onClick={() => setHours(h)}>
                {period === "future" && data ? (
                  <span className="flex flex-col items-center leading-tight">
                    <span>{`${h} h`}</span>
                    <span className="text-[10px] font-medium opacity-75">{forecastEnd(data.generatedAt, h, "short")}</span>
                  </span>
                ) : `${h} h`}
              </Button>
            ))}
          </div>
        </div>
        {!embed && data && (
          <Button variant="ghost" size="icon" className="mb-1 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={busy ? "Grafik wird erstellt" : "Grafik herunterladen"} title="Grafik herunterladen" disabled={busy} onClick={savePng}><Download className={busy ? "animate-pulse" : undefined} /></Button>
        )}
      </div>
      </>}
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
                clean={clean}
                values={mode === "snow" ? fineSnow?.values ?? f.snow[hours] : f.rain[hours]}
                gridLat={mode === "snow" && fineSnow ? fineSnow.gridLat : data.gridLat}
                gridLon={mode === "snow" && fineSnow ? fineSnow.gridLon : data.gridLon}
                stations={[]}
                mode={mode}
                hours={hours}
                sourceLabel={`Prognose nächste ${hours} h`}
                updatedLabel={stand}
                dataLabel={mode === "snow" && fineSnow ? "MeteoSchweiz ICON-CH1/CH2, Schneefallgrenze aufs Gelände übertragen" : "MeteoSchweiz ICON-CH1/CH2"}
                forecast
                endLabel={`bis ${forecastEnd(data.generatedAt, hours, "long")}`}
              />
            </Suspense>
          );
        }
        const r = data.radar;
        const radarSnowOk = !!r?.snow?.[hours] && (r.snowMissingHours?.[hours] ?? hours) <= hours * 0.25;
        const useRadar = !!r && (mode === "rain" ? (r.missingHours[hours] ?? 0) <= hours * 0.25 : radarSnowOk);
        const radar = useRadar ? r : null;
        const grid = radar ?? (mode === "snow" && fineSnow ? fineSnow : data);
        const own = data.stations.filter((s) => s.source === "own" && s.rain[hours] != null).map((s) => ({ lat: s.lat, lon: s.lon, value: s.rain[hours] as number }));
        const values = radar
          ? mode === "snow" ? radar.snow?.[hours] ?? [] : blendStations(radar.rain[hours], radar.gridLat, radar.gridLon, own)
          : mode === "snow" ? fineSnow?.values ?? data.snow[hours] : data.rain[hours];
        const stand = new Date(radar?.t ?? data.generatedAt).toLocaleString("de-CH", { timeZone: "Europe/Zurich", dateStyle: "short", timeStyle: "short" });
        const missing = (mode === "snow" ? radar?.snowMissingHours?.[hours] : radar?.missingHours[hours]) ?? 0;
        const label = [missing ? `${missing} h fehlen` : "", !useRadar ? "Fläche: Modell" : ""].filter(Boolean).join(" · ");
        const stations = data.stations
          .map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, value: (mode === "snow" ? s.snow : s.rain)[hours], own: s.source === "own" || s.id.includes("-") }))
          .filter((s) => s.value !== null) as { id: string; name: string; lat: number; lon: number; value: number; own: boolean }[];
        return (
        <Suspense fallback={<div className="h-[420px] rounded-lg bg-muted" />}>
          <LazyPrecipAccumMap
            clean={clean}
            values={values}
            gridLat={grid.gridLat}
            gridLon={grid.gridLon}
            stations={stations}
            mode={mode}
            hours={hours}
            sourceLabel={label}
            updatedLabel={stand}
            dataLabel={mode === "snow" ? (radar ? "MeteoSchweiz CombiPrecip + Schneefallgrenze aus Gelände, Stationen und ICON-CH1 (Fläche), SMN-Schneehöhen (Stationen)" : fineSnow ? "MeteoSchweiz ICON-CH1/CH2, historische Schneefallgrenze aufs Gelände übertragen (Fläche), SMN-Schneehöhen (Stationen; Säntis: Modell)" : "MeteoSchweiz ICON-CH1/CH2 (Fläche), SMN-Schneehöhen (Stationen; Säntis: Modell)") : "eigene Stationen, MeteoSchweiz"}
          />
        </Suspense>
        );
      })()}
      </div>
      {embed && !clean && (
        <a href="https://oberthurgauer-wetter.lovable.app/karten/niederschlag" target="_blank" rel="noopener" className="block text-xs text-muted-foreground underline">
          Mehr auf Oberthurgauer Wetter
        </a>
      )}
    </div>
  );
}

function forecastEnd(from: string, h: number, style: "short" | "long") {
  const d = new Date(Date.parse(from) + h * 3600_000);
  const tz = "Europe/Zurich";
  if (style === "short") {
    const wd = d.toLocaleDateString("de-CH", { timeZone: tz, weekday: "short" }).replace(".", "");
    const dm = d.toLocaleDateString("de-CH", { timeZone: tz, day: "numeric", month: "numeric" });
    return `${wd} ${dm}`;
  }
  const date = d.toLocaleDateString("de-CH", { timeZone: tz, weekday: "long", day: "numeric", month: "long" });
  const time = d.toLocaleTimeString("de-CH", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time} Uhr`;
}
