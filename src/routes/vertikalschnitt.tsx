import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pause, Play, Download, Save } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { SectionChart, SnowLineStrip, useAnalyses, type ChartOpts, type Layers } from "@/components/snowcast/section-chart";
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

const LAYER_LABELS: [keyof Layers, string][] = [
  ["rh", "Relative Feuchte"], ["iso", "Isothermen"], ["wind", "Windfiedern"], ["precip", "Niederschlag"],
  ["freezing", "Nullgradgrenze"], ["wbz", "Feuchtkugel-0°-Grenze"], ["snow", "Schneefallgrenze (Schätzung)"],
];
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

  const setLayer = (k: keyof Layers, v: boolean) => { const n = { ...opts, layers: { ...opts.layers, [k]: v } }; setOpts(n); persist({ opts: n }); };
  const setOpt = <K extends keyof ChartOpts>(k: K, v: ChartOpts[K]) => { const n = { ...opts, [k]: v }; setOpts(n); persist({ opts: n }); };

  const exportPng = () => {
    const c = document.querySelector<HTMLCanvasElement>("#snowcast-chart canvas"); if (!c) return;
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = `vertikalschnitt-${hour?.time ?? ""}.png`; a.click();
  };
  const exportPdf = () => {
    const c = document.querySelector<HTMLCanvasElement>("#snowcast-chart canvas"); if (!c) return;
    const w = window.open(""); if (!w) return;
    w.document.write(`<title>Vertikalschnitt</title><h3 style="font-family:sans-serif">Vertikalschnitt ${points.map((p) => p.name ?? "").join(" – ")} · ${hour ? fmtTime(hour.time) : ""}</h3><img src="${c.toDataURL("image/png")}" style="width:100%"/><script>setTimeout(()=>print(),300)</script>`);
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

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_240px]">
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

          {/* Mitte: Diagramm */}
          <section className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <div><span className="text-xs text-muted-foreground">Tiefste Schneefallgrenze (Schätzung) </span><span className="text-lg font-semibold text-primary">{minSnow != null && minSnow < 9999 ? `≈ ${Math.round(minSnow / 50) * 50} m` : "–"}</span></div>
              {lowCols > 0 && <div className="text-sm font-medium">Schnee bis ins Flachland möglich ({lowCols} von {an.length} Punkten)</div>}
              {an.some((a) => a.inversion) && <div className="text-sm text-muted-foreground">Warmschicht / Inversion erkannt</div>}
              <div className="ml-auto flex gap-2">
                <button onClick={exportPng} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"><Download className="h-3 w-3" />PNG</button>
                <button onClick={exportPdf} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"><Download className="h-3 w-3" />PDF</button>
              </div>
            </div>
            <div id="snowcast-chart">
              {q.isLoading && <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">Modelldaten werden geladen …</div>}
              {q.error && <div className="flex h-[420px] items-center justify-center text-sm text-destructive">{(q.error as Error).message}</div>}
              {hour && <SectionChart hour={hour} opts={opts} marks={marks} />}
            </div>
            {hour && (
              <div>
                <div className="mb-1 text-xs font-semibold text-muted-foreground">Geschätzte Schneefallgrenze entlang der Strecke (Band = Unsicherheit, Punkt = Schnee bis zum Boden)</div>
                <SnowLineStrip hour={hour} marks={marks} />
              </div>
            )}
            <p className="text-[11px] leading-snug text-muted-foreground">
              Schneefallgrenze geschätzt aus der Feuchtkugeltemperatur (≈ +1 °C-Niveau, Band 0 bis +1,5 °C) – berücksichtigt Verdunstungskühlung und Warmschichten, ist aber kein Messwert. Höhenprofil: ICON-D2 (DWD) auf Druckflächen, Boden: ICON-CH1 (MeteoSchweiz). Daten: Open-Meteo, Karte © swisstopo.
            </p>
          </section>

          {/* Rechts: Steuerung */}
          <aside className="space-y-4 rounded-xl border border-border bg-card p-3 text-sm">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ebenen</div>
              {LAYER_LABELS.map(([k, label]) => (
                <label key={k} className="flex items-center gap-2"><input type="checkbox" className="accent-primary" checked={opts.layers[k]} onChange={(e) => setLayer(k, e.target.checked)} />{label}</label>
              ))}
            </div>
            <label className="block space-y-1"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Höhe bis {opts.zMax} m</span>
              <input type="range" min={2000} max={10000} step={500} value={opts.zMax} onChange={(e) => setOpt("zMax", +e.target.value)} className="w-full accent-primary" /></label>
            <label className="block space-y-1"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Isothermen alle</span>
              <select value={opts.isoStep} onChange={(e) => setOpt("isoStep", +e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-1">
                {[1, 2, 5].map((s) => <option key={s} value={s}>{s} °C</option>)}
              </select></label>
            <label className="block space-y-1"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Windfiedern-Grösse</span>
              <input type="range" min={0.6} max={1.8} step={0.1} value={opts.barbScale} onChange={(e) => setOpt("barbScale", +e.target.value)} className="w-full accent-primary" /></label>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div><span className="inline-block h-0.5 w-5 bg-primary align-middle" /> Schneefallgrenze</div>
              <div><span className="inline-block w-5 border-t-2 border-dashed border-foreground align-middle" /> Nullgradgrenze</div>
              <div><span className="inline-block w-5 border-t-2 border-dotted border-violet-600 align-middle" /> Feuchtkugel 0 °C</div>
              <div>Grün → Blau: relative Feuchte 60–100 %</div>
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
