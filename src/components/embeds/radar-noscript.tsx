/**
 * JS-freier Fallback für /embed/radar.
 * Zeigt das jüngste echte Radarbild als <img> plus einen
 * Niederschlagsverlauf für Amriswil. Reine Präsentation.
 */

export interface RadarNoscriptData {
  latestImageUrl?: string;
  latestImageTime?: string;
  bbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  precipNext: Array<{ time: string; mmh: number | null }>;
  precipDaily: Array<{ date: string; mm: number | null }>;
}

function fmt(n: number | null | undefined, digits = 1, suffix = ""): string {
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

export function RadarNoscript({ data }: { data: RadarNoscriptData }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 font-sans text-sm text-foreground">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Niederschlagsradar Oberthurgau</h1>
        <p className="text-xs text-muted-foreground">
          Statische Vorschau ohne JavaScript. Für die animierte Karte mit Vorhersage{" "}
          <a
            href="https://symbolprognose.lovable.app/karten/radar"
            className="underline"
          >
            hier öffnen
          </a>
          .
        </p>
      </header>

      {data.latestImageUrl ? (
        <figure className="rounded-lg border border-border bg-card p-2">
          <img
            src={data.latestImageUrl}
            alt={`Radarmessung Oberthurgau${data.latestImageTime ? ` um ${fmtTime(data.latestImageTime)}` : ""}`}
            width={800}
            height={480}
            className="block h-auto w-full rounded"
          />
          <figcaption className="mt-1 text-xs text-muted-foreground">
            Letzte Messung
            {data.latestImageTime ? ` · ${fmtTime(data.latestImageTime)}` : ""}
            {" · "}MeteoSchweiz CPC
          </figcaption>
        </figure>
      ) : (
        <p className="rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
          Aktuell kein Radarbild verfügbar.
        </p>
      )}

      {data.precipNext.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-semibold">
            Niederschlagsverlauf Amriswil (nächste Stunden)
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Zeit</th>
                  <th className="px-2 py-1.5 text-right">Niederschlag</th>
                </tr>
              </thead>
              <tbody>
                {data.precipNext.map((h) => (
                  <tr key={h.time} className="border-t border-border">
                    <td className="px-2 py-1.5">{fmtTime(h.time)}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(h.mmh, 1, " mm/h")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.precipDaily.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-semibold">Tagesniederschlag</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Tag</th>
                  <th className="px-2 py-1.5 text-right">Summe</th>
                </tr>
              </thead>
              <tbody>
                {data.precipDaily.map((d) => (
                  <tr key={d.date} className="border-t border-border">
                    <td className="px-2 py-1.5">{fmtDate(d.date)}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(d.mm, 1, " mm")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="text-[10px] text-muted-foreground">
        Quelle: Oberthurgauer Wetter · MeteoSchweiz Radar (CPC) &amp; ICON-CH1/CH2 via Open-Meteo
      </footer>
    </div>
  );
}
