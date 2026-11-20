import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getStationView } from "@/lib/station-view.functions";
import type { Ext, StationView } from "@/lib/station-view";

const viewQuery = (slug: string) => queryOptions({
  queryKey: ["station-view", slug],
  queryFn: () => getStationView({ data: { slug } }),
  refetchInterval: 60_000,
  staleTime: 30_000,
});

export const Route = createFileRoute("/station/$slug")({
  loader: async ({ context, params }) => {
    const v = await context.queryClient.ensureQueryData(viewQuery(params.slug));
    if (!v) throw notFound();
    return { name: v.name };
  },
  head: ({ loaderData }) => {
    const n = loaderData?.name ?? "Station";
    const title = `Wetterstation ${n} – Live | Oberthurgauer Wetter`;
    const desc = `Aktuelle Temperatur, Wind, Luftdruck und Niederschlag der Wetterstation ${n}, live aktualisiert.`;
    return { meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#000000" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: n },
    ] };
  },
  notFoundComponent: () => <div className="min-h-screen bg-oled-bg p-6 text-oled-fg">Station nicht gefunden.</div>,
  component: StationPage,
});

const tf = new Intl.DateTimeFormat("de-CH", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit" });
const time = (iso: string | null | undefined) => (iso ? tf.format(new Date(iso)) : "–");
const num = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? "–" : v.toFixed(d));

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><div className="text-[11px] uppercase tracking-wide text-oled-muted">{label}</div><div className="mt-0.5">{children}</div></div>;
}
function Pair({ max, min, d = 1, maxCls = "text-oled-hot", minCls = "text-oled-cold" }: { max: Ext; min: Ext; d?: number; maxCls?: string; minCls?: string }) {
  return (
    <div className="space-y-0.5 text-sm tabular-nums">
      <div><span className={maxCls}>▲ {num(max?.v, d)}</span> <span className="text-oled-muted text-xs">{time(max?.at)}</span></div>
      <div><span className={minCls}>▼ {num(min?.v, d)}</span> <span className="text-oled-muted text-xs">{time(min?.at)}</span></div>
    </div>
  );
}
function Block({ title, unit, children }: { title: string; unit: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-oled-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-oled-fg">{title} <span className="font-normal text-oled-muted">[{unit}]</span></h2>
      <div className="grid grid-cols-3 gap-3">{children}</div>
    </section>
  );
}

function StationPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(viewQuery(slug));
  const v = data as StationView;
  const { now, today: t, yesterday: y } = v;
  return (
    <main className="min-h-screen bg-oled-bg px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] text-oled-fg">
      <div className="mx-auto max-w-md space-y-3">
        <header className="flex items-end justify-between pb-1">
          <div>
            <h1 className="text-2xl font-semibold">{v.name}</h1>
            <p className="text-xs text-oled-muted">Heute {time(v.measuredAt)} Uhr</p>
          </div>
          <span className={`flex items-center gap-1.5 text-xs ${v.stale ? "text-oled-warn" : "text-oled-good"}`}>
            <span className={`size-2 rounded-full ${v.stale ? "bg-oled-warn" : "bg-oled-good"}`} />{v.stale ? "Verzögert" : "Live"}
          </span>
        </header>

        <Block title="Temperatur" unit="°C">
          <Cell label="Aktuell"><div className="text-4xl font-semibold tabular-nums">{num(now.temp)}</div></Cell>
          <Cell label="Heute"><Pair max={t.tMax} min={t.tMin} /></Cell>
          <Cell label="Gestern"><Pair max={y.tMax} min={y.tMin} /></Cell>
        </Block>

        <Block title="Luftfeuchtigkeit" unit="%">
          <Cell label="Aktuell"><div className="text-2xl font-semibold tabular-nums text-oled-good">{num(now.hum, 0)}</div></Cell>
          <Cell label="Heute"><Pair max={t.hMax} min={t.hMin} d={0} /></Cell>
          <Cell label="Gestern"><Pair max={y.hMax} min={y.hMin} d={0} /></Cell>
        </Block>

        <Block title="Luftdruck" unit="hPa">
          <Cell label="Aktuell"><div className="text-2xl font-semibold tabular-nums text-oled-warn">{num(now.press, 0)}</div></Cell>
          <Cell label="Heute"><Pair max={t.pMax} min={t.pMin} d={0} /></Cell>
          <Cell label="Gestern"><Pair max={y.pMax} min={y.pMin} d={0} /></Cell>
        </Block>

        <Block title="Wind" unit="km/h">
          <Cell label="Aktuell"><div className="text-2xl font-semibold tabular-nums">{num(now.wind, 0)} <span className="text-base text-oled-muted">{now.dir ?? ""}</span></div><div className="text-xs text-oled-muted">Böe {num(now.gust, 0)}</div></Cell>
          <Cell label="Böe heute"><div className="text-lg tabular-nums text-oled-hot">{num(t.gust?.v, 0)}</div><div className="text-xs text-oled-muted">{time(t.gust?.at)}</div></Cell>
          <Cell label="Böe gestern"><div className="text-lg tabular-nums text-oled-hot">{num(y.gust?.v, 0)}</div><div className="text-xs text-oled-muted">{time(y.gust?.at)}</div></Cell>
        </Block>

        <Block title="Gefühlte Werte" unit="°C">
          <Cell label="Taupunkt"><div className="text-lg tabular-nums text-oled-cold">{num(now.dew)}</div></Cell>
          <Cell label="Windchill"><div className="text-lg tabular-nums text-oled-cold">{num(now.chill)}</div></Cell>
          <Cell label="Hitzeindex"><div className="text-lg tabular-nums text-oled-hot">{num(now.heat)}</div></Cell>
        </Block>

        <Block title="Niederschlag" unit="mm">
          <Cell label="Rate mm/h"><div className="text-lg tabular-nums">{num(now.rainRate)}</div></Cell>
          <Cell label="Heute"><div className="text-lg tabular-nums text-oled-cold">{num(t.rain)}</div></Cell>
          <Cell label="Gestern"><div className="text-lg tabular-nums text-oled-cold">{num(y.rain)}</div></Cell>
        </Block>

        <p className="pt-2 text-center text-[11px] text-oled-muted">Oberthurgauer Wetter · Daten: eigene Station · aktualisiert jede Minute</p>
      </div>
    </main>
  );
}
