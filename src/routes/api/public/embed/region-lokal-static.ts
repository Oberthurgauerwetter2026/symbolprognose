import { createFileRoute } from "@tanstack/react-router";
import { buildLokalNoscriptData } from "@/lib/embed-noscript.server";
import { fetchAmriswilStation } from "@/lib/weather-hub.server";
import { renderWeatherIconSvg, WX_ICON_CSS_VARS } from "@/lib/weather-icon-svg.server";

const AMRISWIL = { name: "Amriswil", lat: 47.5469, lon: 9.2986 };

export const Route = createFileRoute("/api/public/embed/region-lokal-static")({
  server: {
    handlers: {
      GET: async () => {
        const [data, station] = await Promise.all([
          buildLokalNoscriptData(AMRISWIL),
          fetchAmriswilStation(),
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

function n(v: number | null | undefined): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function renderStaticForecast(data: StaticForecastData): string {
  const current = data.current;

  const hourlyRows = data.hourly
    .map((h) => {
      const code = h.weathercode ?? 0;
      const sym = renderWeatherIconSvg({
        code,
        size: 32,
        scope: "hourly",
        precip: n(h.precipitation),
        precipProb: n(h.precipProb),
        isDay: h.isDay,
        isSnow: h.isSnow,
        cloudLow: n(h.cloudLow),
        cloudMid: n(h.cloudMid),
        cloudHigh: n(h.cloudHigh),
        sunshineRatio: n(h.sunshineRatio),
      });
      return `<tr data-hour="${esc(h.time)}"><td>${esc(fmtTime(h.time))}</td><td class="sym">${sym}</td><td class="num">${esc(fmt(h.temperature, 0, "°"))}</td><td class="num">${esc(fmt(h.precipitation, 1, " mm"))}</td><td class="num">${esc(fmt(h.windSpeed, 0, " km/h"))}</td></tr>`;
    })
    .join("");

  const dailyRows = data.daily
    .map((d) => {
      const code = d.weathercode ?? 0;
      const sym = renderWeatherIconSvg({
        code,
        size: 32,
        scope: "daily",
        precip: n(d.precipSum),
        precipProb: n(d.precipProb),
        precipHours: n(d.precipHours),
        thunderHours: n(d.thunderHours),
        sunshineRatio: n(d.sunshineRatio),
        isSnow: d.isSnow,
        cloudLow: n(d.cloudLow),
        cloudMid: n(d.cloudMid),
        cloudHigh: n(d.cloudHigh),
        isDay: true,
      });
      return `<tr><td>${esc(fmtDate(d.date))}</td><td class="sym">${sym}</td><td class="num">${esc(fmt(d.tMin, 0, "°"))}</td><td class="num">${esc(fmt(d.tMax, 0, "°"))}</td><td class="num">${esc(fmt(d.precipSum, 1, " mm"))}</td></tr>`;
    })
    .join("");

  const currentBlock = current
    ? (() => {
        const sym = renderWeatherIconSvg({
          code: current.weathercode ?? 0,
          size: 64,
          scope: "hourly",
          precip: n(current.precipitation),
          isDay: current.isDay,
          isSnow: current.isSnow,
          cloudLow: n(current.cloudLow),
          cloudMid: n(current.cloudMid),
          cloudHigh: n(current.cloudHigh),
          sunshineRatio: n(current.sunshineRatio),
        });
        return `<section class="now"><div class="now-sym">${sym}</div><div class="now-temp">${esc(fmt(current.temperature, 1, "°C"))}</div><div class="now-meta"><div class="now-desc">${esc(current.weathercode != null ? weatherLabel(current.weathercode) : "")} · ${esc(fmtTime(current.time))}</div><div class="now-sub">${esc(fmt(current.precipitation, 1, " mm/h"))} · ${esc(fmt(current.windSpeed, 0, " km/h"))}${current.windDirection != null ? ` ${esc(windDirectionLabel(current.windDirection))}` : ""}</div></div></section>`;
      })()
    : "";

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Lokalprognose</title><style>
${WX_ICON_CSS_VARS}
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
.sym{width:44px;text-align:center;padding:1px 2px}
.sym svg{display:block;margin:0 auto}
.num{text-align:right}
.foot{color:#a1a1aa;font-size:10px;margin-top:6px;text-align:right}
</style></head><body><main class="page">
${currentBlock}
<h2>Nächste Stunden</h2>
<div class="table-wrap" id="hourly-wrap" data-rendered-at="${esc(new Date().toISOString())}"><table><colgroup><col style="width:48px"><col style="width:44px"><col><col><col></colgroup><thead><tr><th>Zeit</th><th class="sym"></th><th class="num">Temp</th><th class="num">Regen</th><th class="num">Wind</th></tr></thead><tbody id="hourly-body">${hourlyRows || `<tr><td colspan="5">Keine Daten verfügbar</td></tr>`}</tbody></table></div>
<h2>7 Tage</h2>
<div class="table-wrap"><table><colgroup><col style="width:70px"><col style="width:44px"><col><col><col></colgroup><thead><tr><th>Tag</th><th class="sym"></th><th class="num">Min</th><th class="num">Max</th><th class="num">Regen</th></tr></thead><tbody>${dailyRows || `<tr><td colspan="5">Keine Daten verfügbar</td></tr>`}</tbody></table></div>
${data.generatedAt ? `<div class="foot">Stand ${esc(fmtTime(data.generatedAt))}</div>` : ""}
<script>(function(){function p(){var n=Date.now();var rows=document.querySelectorAll('#hourly-body tr[data-hour]');var visible=0;rows.forEach(function(r){var h=r.getAttribute('data-hour');if(!h)return;var t=new Date(h).getTime();if(!isFinite(t))return;if(t+3600000<=n){r.style.display='none';}else{r.style.display='';visible++;}});if(visible<=2){try{location.reload();}catch(e){}}}p();setInterval(p,60000);})();</script>
</main></body></html>`;
}
