import { createFileRoute } from "@tanstack/react-router";
import { buildLokalNoscriptData } from "@/lib/embed-noscript.server";

const AMRISWIL = { name: "Amriswil", lat: 47.5469, lon: 9.2986 };

export const Route = createFileRoute("/api/public/embed/region-lokal-static")({
  server: {
    handlers: {
      GET: async () => {
        const data = await buildLokalNoscriptData(AMRISWIL);
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

function renderStaticForecast(data: StaticForecastData): string {
  const current = data.current;
  const hourlyRows = data.hourly
    .map(
      (h) => `<tr><td>${esc(fmtTime(h.time))}</td><td>${esc(h.weathercode != null ? weatherLabel(h.weathercode) : "–")}</td><td class="num">${esc(fmt(h.temperature, 0, " °C"))}</td><td class="num">${esc(fmt(h.precipitation, 1, " mm"))}</td><td class="num">${esc(fmt(h.windSpeed, 0, " km/h"))}</td></tr>`,
    )
    .join("");
  const dailyRows = data.daily
    .map(
      (d) => `<tr><td>${esc(fmtDate(d.date))}</td><td>${esc(d.weathercode != null ? weatherLabel(d.weathercode) : "–")}</td><td class="num">${esc(fmt(d.tMin, 0, " °C"))}</td><td class="num">${esc(fmt(d.tMax, 0, " °C"))}</td><td class="num">${esc(fmt(d.precipSum, 1, " mm"))}</td><td class="num">${esc(fmt(d.windMax, 0, " km/h"))}</td></tr>`,
    )
    .join("");

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Lokalprognose Amriswil</title><style>html,body{margin:0;padding:0;background:#fff;color:#18181b;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:14px;line-height:1.35}*{box-sizing:border-box}body{min-height:480px}.page{width:100%;max-width:760px;margin:0 auto;padding:14px 12px 20px}.head{margin-bottom:14px}.head h1{margin:0;font-size:22px;line-height:1.15}.meta{margin:4px 0 0;color:#71717a;font-size:12px}.card{border:1px solid #e4e4e7;background:#fafafa;border-radius:8px;padding:14px 16px;margin:0 0 18px}.card h2,.section h2{margin:0 0 8px;font-size:17px}.temp{font-size:28px;font-weight:800;margin:2px 0 8px}.desc{font-size:16px;font-weight:500;color:#71717a}.facts{display:grid;grid-template-columns:130px 1fr;gap:4px 14px;font-size:13px}.facts dt{color:#71717a}.facts dd{margin:0}.section{margin:0 0 20px}.table-wrap{border:1px solid #e4e4e7;border-radius:8px;overflow:auto;background:#fff}table{width:100%;border-collapse:collapse;font-size:13px;min-width:520px}th{background:#e4e4e7;color:#71717a;text-align:left;font-weight:700}th,td{padding:7px 8px;border-bottom:1px solid #e4e4e7;white-space:nowrap}tbody tr:last-child td{border-bottom:0}.num{text-align:right}.foot{color:#71717a;font-size:11px;margin-top:20px}@media(max-width:520px){.page{padding:12px 8px}.head h1{font-size:20px}.card{padding:12px}.temp{font-size:25px}table{font-size:12px}th,td{padding:6px}}</style></head><body><main class="page"><header class="head"><h1>Lokalprognose ${esc(data.locationName)}</h1><p class="meta">Statische Monitor-Ansicht · ohne JavaScript</p></header>${
    current
      ? `<section class="card" aria-label="Aktuelle Prognose"><h2>Aktuell · ${esc(fmtTime(current.time))}</h2><div class="temp">${esc(fmt(current.temperature, 1, " °C"))} <span class="desc">${esc(current.weathercode != null ? weatherLabel(current.weathercode) : "")}</span></div><dl class="facts"><dt>Niederschlag</dt><dd>${esc(fmt(current.precipitation, 1, " mm/h"))}</dd><dt>Wind</dt><dd>${esc(fmt(current.windSpeed, 0, " km/h"))}${current.windDirection != null ? ` aus ${esc(windDirectionLabel(current.windDirection))}` : ""}</dd></dl></section>`
      : ""
  }<section class="section"><h2>Nächste Stunden</h2><div class="table-wrap"><table><thead><tr><th>Zeit</th><th>Wetter</th><th class="num">Temp</th><th class="num">Regen</th><th class="num">Wind</th></tr></thead><tbody>${hourlyRows || `<tr><td colspan="5">Keine Daten verfügbar</td></tr>`}</tbody></table></div></section><section class="section"><h2>7-Tage-Übersicht</h2><div class="table-wrap"><table><thead><tr><th>Tag</th><th>Wetter</th><th class="num">Min</th><th class="num">Max</th><th class="num">Regen</th><th class="num">Böen</th></tr></thead><tbody>${dailyRows || `<tr><td colspan="6">Keine Daten verfügbar</td></tr>`}</tbody></table></div></section><footer class="foot">Quelle: Oberthurgauer Wetter · Modelle: MeteoSchweiz ICON-CH1/CH2 &amp; ECMWF IFS via Open-Meteo${data.generatedAt ? ` · Stand ${esc(fmtTime(data.generatedAt))}` : ""}</footer></main></body></html>`;
}