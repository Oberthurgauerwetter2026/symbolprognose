import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pause, Play, Download, Save } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAnalyses, type ChartOpts } from "@/components/snowcast/section-chart";
import { SimpleProfile } from "@/components/snowcast/simple-profile";
import { PRESET_ROUTES, haversineKm, sampleRoute, type LatLon } from "@/lib/snowcast";
import { loadSection } from "@/lib/snowcast-data";

const RouteMap = lazy(() => import("@/components/snowcast/route-map"));

export const Route = createFileRoute("/vertikalschnitt")({
  ssr: false,
  component: SnowcastPage,
  head: () => ({
    meta: [
      { title: "Bodensee SnowCast · Vertikalschnitt Thurgau · Oberthurgauer Wetter" },
      { name: "description", content: "Meteorologischer Vertikalschnitt durch die Atmosphäre über Thurgau und Bodensee: Temperatur, Feuchte, Wind und geschätzte Schneefallgrenze." },
      { property: "og:title", content: "Bodensee SnowCast · Vertikalschnitt" },
      { property: "og:description", content: "Wie tief sinkt die Schneefallgrenze im Thurgau? Vertikalschnitt mit ICON-Modelldaten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STORE = "snowcast-settings-v1";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("de-CH", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function SnowcastPage() {
  const [points, setPoints] = useState<LatLon[]>(PRESET_ROUTES[0]!.points);
  const [presetId, setPresetId] = useState("fwr");
  const [fitKey, setFitKey] = useState("fwr");
  const [hourIdx, setHourIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [opts, setOpts] = useState<ChartOpts>({ layers: { rh: true, iso: true, wind: true, precip: true, freezing: true, wbz: true, snow: true }, zMax: 5000, isoStep: 2, barbScale: 1 });
  const [saved, setSaved] = useState<{ name: string; points: LatLon[] }[]>([]);

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(STORE) ?? "null"); if (s?.opts) setOpts(s.opts); if (s?.saved) setSaved(s.saved); } catch { /* ignore */ }
  }, []);
  const persist = (next: { opts?: ChartOpts; saved?: typeof saved }) =>
    localStorage.setItem(STORE, JSON.stringify({ opts: next.opts ?? opts, saved: next.saved ?? saved }));

  const samples = useMemo(() => sampleRoute(points, points.length > 3 || haversineKm(points[0]!, points.at(-1)!) > 100 ? 8 : 3), [points]);
  const marks = useMemo(() => {
    let acc = 0; return points.map((p, i) => { if (i) acc += haversineKm(points[i - 1]!, p); return { km: acc, name: p.name ?? `P${i + 1}` }; });
  }, [points]);
  const key = samples.map((s) => `${s.lat.toFixed(3)},${s.lon.toFixed(3)}`).join(";");
  const q = useQuery({ queryKey: ["snowcast", key], queryFn: () => loadSection(samples), staleTime: 15 * 60_000 });
  const hours = q.data?.hours ?? [];
  const nowIdx = useMemo(() => { const n = Date.now(); const i = hours.findIndex((h) => new Date(h.time).getTime() > n); return Math.max(0, i - 1); }, [hours]);
  useEffect(() => { setHourIdx(nowIdx); }, [nowIdx]);
  useEffect(() => {
    if (!playing || !hours.length) return;
    const t = setInterval(() => setHourIdx((i) => (i + 1) % hours.length), 700); return () => clearInterval(t);
  }, [playing, hours.length]);
  const hour = hours[Math.min(hourIdx, hours.length - 1)];
  const an = useAnalyses(hour);
  const minSnow = an.length ? Math.min(...an.map((a) => a.snowLine ?? 9999)) : null;
  const lowCols = hour ? an.filter((a, i) => (a.snowLine ?? 9999) <= hour.columns[i]!.ground + 30).length : 0;


  const exportPng = () => {
    const svg = document.querySelector<SVGSVGElement>("#snowcast-chart svg"); if (!svg) return;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" })); a.download = `schneefallgrenze-${hour?.time ?? ""}.svg`; a.click();
  };

  return (
    <DashboardLayout title="Bodensee SnowCast" subtitle="Vertikalschnitt & Schneefallgrenze · Expertenrubrik">
      <div className="mx-auto w-full max-w-[1500px] space-y-4 px-4 py-5">
        {/* Kopf: Modell & Zeit */}
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Modell</div>
            <div className="font-semibold">{q.data ? `${q.data.upperModel} · Boden ${q.data.surfaceModel}` : "ICON-D2 / ICON-CH1"}</div>
          </div>
          <button onClick={() => setPlaying((p) => !p)} className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-label={playing ? "Pause" : "Abspielen"} disabled={!hours.length}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <input type="range" min={0} max={Math.max(0, hours.length - 1)} value={hourIdx} onChange={(e) => { setPlaying(false); setHourIdx(+e.target.value); }} className="w-full max-w-md accent-primary" aria-label="Prognosezeit" />
          <div className="w-40 text-right">
            <div className="font-semibold">{hour ? fmtTime(hour.time) : "–"}</div>
            <div className="text-xs text-muted-foreground">{hour ? `+${hourIdx - nowIdx} h ab jetzt` : ""}</div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Links: Karte */}
          <aside className="space-y-3">
            <select className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm" value={presetId} onChange={(e) => {
              const id = e.target.value; setPresetId(id);
              const p = PRESET_ROUTES.find((r) => r.id === id)?.points ?? saved.find((s) => `s:${s.name}` === id)?.points;
              if (p) { setPoints(p); setFitKey(id + Date.now()); }
            }}>
              {PRESET_ROUTES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              {saved.map((s) => <option key={s.name} value={`s:${s.name}`}>★ {s.name}</option>)}
              {presetId === "custom" && <option value="custom">Eigene Strecke</option>}
            </select>
            <div className="h-[320px] overflow-hidden rounded-xl border border-border">
              <Suspense fallback={<div className="h-full animate-pulse bg-muted" />}>
                <RouteMap points={points} samples={samples} fitKey={fitKey} editable onChange={(p) => { setPoints(p); setPresetId("custom"); }} />
              </Suspense>
            </div>
            <p className="text-xs text-muted-foreground">Klick in die Karte fügt einen Punkt hinzu, Punkte lassen sich ziehen, Doppelklick entfernt einen Punkt.</p>
            <div className="flex gap-2">
              <button className="flex-1 rounded-md border border-border px-2 py-1.5 text-xs" onClick={() => { setPoints(points.slice(0, 2)); setPresetId("custom"); }}>Nur Start/Ende</button>
              <button className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs" onClick={() => {
                const name = prompt("Name der Strecke?"); if (!name) return;
                const n = [...saved.filter((s) => s.name !== name), { name, points }]; setSaved(n); persist({ saved: n }); setPresetId(`s:${name}`);
              }}><Save className="h-3 w-3" />Speichern</button>
            </div>
          </aside>

          <section className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <div className="text-lg font-semibold">{minSnow == null || minSnow >= 9999 ? "–" : lowCols > 0 ? `Schnee bis in tiefe Lagen möglich (ab ≈ ${Math.round(minSnow / 50) * 50} m)` : `Schnee erst ab ≈ ${Math.round(minSnow / 50) * 50} m – darunter Regen`}</div>
              <div className="ml-auto flex gap-2">
                <button onClick={exportPng} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"><Download className="h-3 w-3" />Bild</button>
              </div>
            </div>
            <div id="snowcast-chart">
              {q.isLoading && <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">Modelldaten werden geladen …</div>}
              {q.error && <div className="flex h-[320px] items-center justify-center text-sm text-destructive">{(q.error as Error).message}</div>}
              {hour && <SimpleProfile hour={hour} marks={marks} />}
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Weiss = Schnee, Blau = Regen, grün = Gelände entlang der Strecke. Die Schneefallgrenze ist eine Modellschätzung (berücksichtigt Verdunstungskühlung). Höhen: ICON-D2 (DWD), Boden: ICON-CH1 (MeteoSchweiz). Daten: Open-Meteo, Karte © swisstopo.
            </p>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
