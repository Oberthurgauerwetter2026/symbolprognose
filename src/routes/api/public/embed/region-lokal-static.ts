import { createFileRoute } from "@tanstack/react-router";
import { buildLokalNoscriptData } from "@/lib/embed-noscript.server";
import { fetchOberthurgauStation } from "@/lib/weather-hub.server";

const AMRISWIL = { name: "Amriswil", lat: 47.5469, lon: 9.2986 };

export const Route = createFileRoute("/api/public/embed/region-lokal-static")({
  server: {
    handlers: {
      GET: async () => {
        const [data, station] = await Promise.all([
          buildLokalNoscriptData(AMRISWIL),
          fetchOberthurgauStation(),
        ]);
        if (station && data.current) {
          if (station.temperature != null) data.current.temperature = station.temperature;
          if (station.rain_rate != null) data.current.precipitation = station.rain_rate;
          if (station.measured_at) data.current.time = station.measured_at;
        }
        return new Response(renderStaticForecast(data), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control":
              "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
          },
        });
      },
    },
  },
});

type StaticForecastData = Awaited<ReturnType<typeof buildLokalNoscriptData>>;

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
  return `${wd} ${d.getDate()}.${d.getMonth() + 1}.`;
}

function weatherLabel(code: number): string {
  if (code === 0) return "Klar";
  if (code <= 2) return "Heiter";
  if (code === 3) return "Bewölkt";
  if (code === 45 || code === 48) return "Nebel";
  if (code <= 57) return "Nieselregen";
  if (code <= 67) return "Regen";
  if (code <= 77) return "Schnee";
  if (code <= 82) return "Regenschauer";
  if (code <= 86) return "Schneeschauer";
  return "Gewitter";
}

function windDirectionLabel(deg: number): string {
  const dirs = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
  return dirs[Math.round((deg % 360) / 45) % 8];
}

/** Inline-SVG Wettersymbol, abhängig vom Open-Meteo Weathercode. */
function weatherSymbol(code: number | null | undefined, size = 22): string {
  const s = size;
  if (code == null || !Number.isFinite(code)) {
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="#a1a1aa" stroke-width="1.5"/></svg>`;
  }
  const sun = `<circle cx="12" cy="12" r="4.2" fill="#f5b301"/><g stroke="#f5b301" stroke-width="1.7" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/><line x1="2" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/><line x1="4.6" y1="4.6" x2="6.4" y2="6.4"/><line x1="17.6" y1="17.6" x2="19.4" y2="19.4"/><line x1="4.6" y1="19.4" x2="6.4" y2="17.6"/><line x1="17.6" y1="6.4" x2="19.4" y2="4.6"/></g>`;
  const cloud = `<path d="M7 17.5h10.2a3.8 3.8 0 0 0 .3-7.58 5.5 5.5 0 0 0-10.7 1.18A3.7 3.7 0 0 0 7 17.5z" fill="#b8c2cc" stroke="#6b7280" stroke-width="0.8"/>`;
  const cloudDark = `<path d="M7 17.5h10.2a3.8 3.8 0 0 0 .3-7.58 5.5 5.5 0 0 0-10.7 1.18A3.7 3.7 0 0 0 7 17.5z" fill="#8a96a3" stroke="#4b5563" stroke-width="0.8"/>`;
  const sunSmall = `<circle cx="8" cy="8" r="3" fill="#f5b301"/><g stroke="#f5b301" stroke-width="1.3" stroke-linecap="round"><line x1="8" y1="1.5" x2="8" y2="3"/><line x1="1.5" y1="8" x2="3" y2="8"/><line x1="3.4" y1="3.4" x2="4.6" y2="4.6"/><line x1="12.6" y1="3.4" x2="11.4" y2="4.6"/><line x1="3.4" y1="12.6" x2="4.6" y2="11.4"/></g>`;
  const rainDrops = `<g fill="#3b82f6"><path d="M9 19l-1 2.4 1.7 0.4z"/><path d="M13 19l-1 2.4 1.7 0.4z"/><path d="M17 19l-1 2.4 1.7 0.4z"/></g>`;
  const snowFlakes = `<g stroke="#60a5fa" stroke-width="1.3" stroke-linecap="round"><line x1="9" y1="19" x2="9" y2="22"/><line x1="7.5" y1="20.5" x2="10.5" y2="20.5"/><line x1="14" y1="19" x2="14" y2="22"/><line x1="12.5" y1="20.5" x2="15.5" y2="20.5"/></g>`;
  const bolt = `<path d="M12 18l-2 4 4-3-1.5-0.5 2-3.5h-3l1-3-3 4h2z" fill="#facc15" stroke="#a16207" stroke-width="0.6"/>`;
  const fog = `<g stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="14" x2="20" y2="14"/><line x1="6" y1="17.5" x2="18" y2="17.5"/><line x1="5" y1="21" x2="19" y2="21"/></g>`;

  let body = "";
  if (code === 0) body = sun;
  else if (code <= 2) body = `${sunSmall}${cloud}`;
  else if (code === 3) body = cloud;
  else if (code === 45 || code === 48) body = fog;
  else if (code <= 57) body = `${cloud}${rainDrops}`;
  else if (code <= 67) body = `${cloudDark}${rainDrops}`;
  else if (code <= 77) body = `${cloud}${snowFlakes}`;
  else if (code <= 82) body = `${cloudDark}${rainDrops}`;
  else if (code <= 86) body = `${cloud}${snowFlakes}`;
  else body = `${cloudDark}${bolt}`;

  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

function renderStaticForecast(data: StaticForecastData): string {
  const current = data.current;

  const hourlyRows = data.hourly
    .map(
      (h) => `<tr><td>${esc(fmtTime(h.time))}</td><td class="sym">${weatherSymbol(h.weathercode, 28)}</td><td class="num">${esc(fmt(h.temperature, 0, "°"))}</td><td class="num">${esc(fmt(h.precipitation, 1, " mm"))}</td><td class="num">${esc(fmt(h.windSpeed, 0, " km/h"))}</td></tr>`,
    )
    .join("");



  const dailyRows = data.daily
    .map(
      (d) => `<tr><td>${esc(fmtDate(d.date))}</td><td class="sym">${weatherSymbol(d.weathercode, 28)}</td><td class="num">${esc(fmt(d.tMin, 0, "°"))}</td><td class="num">${esc(fmt(d.tMax, 0, "°"))}</td><td class="num">${esc(fmt(d.precipSum, 1, " mm"))}</td></tr>`,
    )
    .join("");

  const currentBlock = current
    ? `<section class="now"><div class="now-sym">${weatherSymbol(current.weathercode ?? null, 56)}</div><div class="now-temp">${esc(fmt(current.temperature, 1, "°C"))}</div><div class="now-meta"><div class="now-desc">${esc(current.weathercode != null ? weatherLabel(current.weathercode) : "")} · ${esc(fmtTime(current.time))}</div><div class="now-sub">${esc(fmt(current.precipitation, 1, " mm/h"))} · ${esc(fmt(current.windSpeed, 0, " km/h"))}${current.windDirection != null ? ` ${esc(windDirectionLabel(current.windDirection))}` : ""}</div></div></section>`
    : "";

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Lokalprognose</title><style>
html,body{margin:0;padding:0;background:#fff;color:#18181b;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:13px;line-height:1.3}
*{box-sizing:border-box}
.page{width:100%;max-width:760px;margin:0 auto;padding:4px 10px 10px}
.now{display:flex;align-items:center;gap:10px;padding:6px 10px;border:1px solid #e4e4e7;background:#fafafa;border-radius:6px;margin:0 0 8px}
.now-sym{flex:0 0 auto;display:flex;align-items:center}
.now-temp{font-size:28px;font-weight:800;line-height:1}
.now-meta{flex:1;min-width:0}
.now-desc{font-size:13px;font-weight:600}
.now-sub{font-size:11px;color:#52525b;margin-top:1px}
h2{margin:6px 0 3px;font-size:12px;font-weight:700;color:#52525b;text-transform:uppercase;letter-spacing:.04em}
.table-wrap{border:1px solid #e4e4e7;border-radius:6px;overflow:hidden;background:#fff}
table{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}
th{background:#f4f4f5;color:#52525b;text-align:left;font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.03em}
th,td{padding:3px 6px;border-bottom:1px solid #ececef;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
tbody tr:last-child td{border-bottom:0}
.sym{width:38px;text-align:center;padding:1px 2px}
.sym svg{display:block;margin:0 auto}
.num{text-align:right}
.foot{color:#a1a1aa;font-size:10px;margin-top:6px;text-align:right}
</style></head><body><main class="page">
${currentBlock}
<h2>Nächste Stunden</h2>
<div class="table-wrap"><table><colgroup><col style="width:48px"><col style="width:38px"><col><col><col></colgroup><thead><tr><th>Zeit</th><th class="sym"></th><th class="num">Temp</th><th class="num">Regen</th><th class="num">Wind</th></tr></thead><tbody>${hourlyRows || `<tr><td colspan="5">Keine Daten verfügbar</td></tr>`}</tbody></table></div>
<h2>7 Tage</h2>
<div class="table-wrap"><table><colgroup><col style="width:70px"><col style="width:38px"><col><col><col></colgroup><thead><tr><th>Tag</th><th class="sym"></th><th class="num">Min</th><th class="num">Max</th><th class="num">Regen</th></tr></thead><tbody>${dailyRows || `<tr><td colspan="5">Keine Daten verfügbar</td></tr>`}</tbody></table></div>
${data.generatedAt ? `<div class="foot">Stand ${esc(fmtTime(data.generatedAt))}</div>` : ""}
</main></body></html>`;
}
