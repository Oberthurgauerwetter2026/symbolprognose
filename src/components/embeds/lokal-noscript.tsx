/**
 * JS-freier Fallback für /embed/lokal.
 * Reine Präsentation, keine Hooks, keine Icons. Wird ausschließlich
 * innerhalb eines <noscript>-Blocks gerendert — JS-Browser blenden den
 * gesamten Inhalt aus, sodass dies die Hydration nicht stört.
 */

import { weatherLabel, windDirectionLabel } from "@/lib/weather";

export interface LokalNoscriptData {
  locationName: string;
  generatedAt?: string;
  current?: {
    time: string;
    temperature?: number | null;
    weathercode?: number | null;
    precipitation?: number | null;
    windSpeed?: number | null;
    windDirection?: number | null;
  };
  hourly: Array<{
    time: string;
    temperature?: number | null;
    weathercode?: number | null;
    precipitation?: number | null;
    windSpeed?: number | null;
  }>;
  daily: Array<{
    date: string;
    weathercode?: number | null;
    tMin?: number | null;
    tMax?: number | null;
    precipSum?: number | null;
    windMax?: number | null;
  }>;
}

function fmt(n: number | null | undefined, digits = 0, suffix = ""): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return `${n.toFixed(digits)}${suffix}`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
  return `${wd} ${d.getDate()}.${d.getMonth() + 1}.`;
}

export function LokalNoscript({ data }: { data: LokalNoscriptData }) {
  const c = data.current;
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 font-sans text-sm text-foreground">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Lokalprognose {data.locationName}</h1>
        <p className="text-xs text-muted-foreground">
          Statische Vorschau ohne JavaScript. Für die interaktive Version{" "}
          <a
            href="https://symbolprognose.lovable.app/karten/lokal"
            className="underline"
          >
            hier öffnen
          </a>
          .
        </p>
      </header>

      {c && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-semibold">
            Aktuell · {fmtTime(c.time)}
          </h2>
          <p className="mt-1 text-2xl font-bold">
            {fmt(c.temperature, 1, " °C")}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              {c.weathercode != null ? weatherLabel(c.weathercode) : ""}
            </span>
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Niederschlag</dt>
            <dd>{fmt(c.precipitation, 1, " mm/h")}</dd>
            <dt className="text-muted-foreground">Wind</dt>
            <dd>
              {fmt(c.windSpeed, 0, " km/h")}{" "}
              {c.windDirection != null ? `aus ${windDirectionLabel(c.windDirection)}` : ""}
            </dd>
          </dl>
        </section>
      )}

      {data.hourly.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-semibold">Nächste Stunden</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Zeit</th>
                  <th className="px-2 py-1.5">Wetter</th>
                  <th className="px-2 py-1.5 text-right">Temp</th>
                  <th className="px-2 py-1.5 text-right">Regen</th>
                  <th className="px-2 py-1.5 text-right">Wind</th>
                </tr>
              </thead>
              <tbody>
                {data.hourly.map((h) => (
                  <tr key={h.time} className="border-t border-border">
                    <td className="px-2 py-1.5">{fmtTime(h.time)}</td>
                    <td className="px-2 py-1.5">
                      {h.weathercode != null ? weatherLabel(h.weathercode) : "–"}
                    </td>
                    <td className="px-2 py-1.5 text-right">{fmt(h.temperature, 0, " °C")}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(h.precipitation, 1, " mm")}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(h.windSpeed, 0, " km/h")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.daily.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-semibold">7-Tage-Übersicht</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Tag</th>
                  <th className="px-2 py-1.5">Wetter</th>
                  <th className="px-2 py-1.5 text-right">Min</th>
                  <th className="px-2 py-1.5 text-right">Max</th>
                  <th className="px-2 py-1.5 text-right">Regen</th>
                  <th className="px-2 py-1.5 text-right">Böen</th>
                </tr>
              </thead>
              <tbody>
                {data.daily.map((d) => (
                  <tr key={d.date} className="border-t border-border">
                    <td className="px-2 py-1.5">{fmtDate(d.date)}</td>
                    <td className="px-2 py-1.5">
                      {d.weathercode != null ? weatherLabel(d.weathercode) : "–"}
                    </td>
                    <td className="px-2 py-1.5 text-right">{fmt(d.tMin, 0, " °C")}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(d.tMax, 0, " °C")}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(d.precipSum, 1, " mm")}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(d.windMax, 0, " km/h")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="text-[10px] text-muted-foreground">
        Quelle: MeteoSchweiz ICON-CH1/CH2 &amp; ECMWF IFS via Open-Meteo
        {data.generatedAt ? ` · Stand ${fmtTime(data.generatedAt)}` : ""}
      </footer>
    </div>
  );
}
