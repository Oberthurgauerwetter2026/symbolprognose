import { useAnalyses } from "@/components/snowcast/section-chart";
import type { SectionHour } from "@/lib/snowcast-data";

type Mark = { km: number; name: string };
export type Weather = "snow" | "mix" | "rain" | "dry";

/** Was fällt am Boden einer Säule? */
export function groundWeather(ground: number, precip: number | null, snowLine: number | null, snowLow: number | null): Weather {
  if ((precip ?? 0) < 0.1) return "dry";
  if (snowLine == null || ground >= snowLine - 30) return "snow";
  if (snowLow != null && ground >= snowLow) return "mix";
  return "rain";
}
const LABEL: Record<Weather, string> = { snow: "❄️ Schnee", mix: "🌨️ Schneeregen", rain: "🌧️ Regen", dry: "☁️ trocken" };
const fmt = (m: number) => `${Math.round(m / 50) * 50}`.replace(/\B(?=(\d{3})+(?!\d))/g, "'");

export function SimpleProfile({ hour, marks }: { hour: SectionHour; marks: Mark[] }) {
  const an = useAnalyses(hour);
  const cols = hour.columns; const kmMax = cols.at(-1)?.sample.km ?? 1;
  const sl = an.map((a, i) => a.snowLine ?? cols[i]!.ground);
  const top = Math.max(1500, Math.ceil((Math.max(...sl, ...cols.map((c) => c.ground)) + 600) / 500) * 500);
  const W = 1000, H = 420, l = 56, r = 12, t = 10, b = 70;
  const x = (km: number) => l + (km / kmMax) * (W - l - r), y = (z: number) => t + (H - b - t) * (1 - Math.min(z, top) / top);
  const pts = (vals: number[]) => vals.map((z, i) => `${x(cols[i]!.sample.km).toFixed(1)},${y(z).toFixed(1)}`);
  const snowZone = `M${x(0)},${t} ` + pts(sl).map((p) => `L${p}`).join(" ") + ` L${x(kmMax)},${t}Z`;
  const ground = `M${x(0)},${y(0)} ` + pts(cols.map((c) => c.ground)).map((p) => `L${p}`).join(" ") + ` L${x(kmMax)},${y(0)}Z`;
  const minI = sl.indexOf(Math.min(...sl));
  const ticks = Array.from({ length: top / 500 + 1 }, (_, i) => i * 500);
  const near = (km: number) => cols.reduce((best, c, i) => (Math.abs(c.sample.km - km) < Math.abs(cols[best]!.sample.km - km) ? i : best), 0);
  const places = marks.map((m) => { const i = near(m.km); const c = cols[i]!, a = an[i]!; return { m, c, w: groundWeather(c.ground, c.precip, a.snowLine, a.snowLow) }; });
  const anyPrecip = cols.some((c) => (c.precip ?? 0) >= 0.1);

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg" role="img" aria-label="Wo es schneit und wo es regnet">
        <rect x={l} y={t} width={W - l - r} height={H - b - t} fill="#bfdbfe" />
        <path d={snowZone} fill="#f1f5f9" />
        {ticks.map((z) => <g key={z}><line x1={l} x2={W - r} y1={y(z)} y2={y(z)} stroke="#0f172a" strokeOpacity={0.07} /><text x={l - 6} y={y(z) + 4} textAnchor="end" fontSize={12} fill="#475569">{fmt(z)} m</text></g>)}
        <text x={l + 14} y={t + 30} fontSize={22} fontWeight={700} fill="#2561a1">❄️ Hier fällt Schnee</text>
        <polyline points={pts(sl).join(" ")} fill="none" stroke="#2561a1" strokeWidth={4} />
        <path d={ground} fill="#6b8e4e" stroke="#3f5a2c" strokeWidth={1.5} />
        {(() => { const cx = x(cols[minI]!.sample.km); const cy = y(sl[minI]!); const lab = `Schneefallgrenze ≈ ${fmt(sl[minI]!)} m`;
          const tx = Math.min(Math.max(cx, l + 120), W - r - 120);
          return <g><rect x={tx - 118} y={cy - 38} width={236} height={28} rx={14} fill="#2561a1" /><text x={tx} y={cy - 19} textAnchor="middle" fontSize={15} fontWeight={700} fill="#ffffff">{lab}</text></g>; })()}
        {places.map(({ m, c }) => <g key={m.name + m.km}>
          <circle cx={x(c.sample.km)} cy={y(c.ground)} r={5} fill="#0f172a" />
          <text x={x(m.km)} y={H - b + 22} textAnchor={m.km < kmMax * 0.08 ? "start" : m.km > kmMax * 0.92 ? "end" : "middle"} fontSize={14} fontWeight={700} fill="#0f172a">{m.name}</text>
          <text x={x(m.km)} y={H - b + 40} textAnchor={m.km < kmMax * 0.08 ? "start" : m.km > kmMax * 0.92 ? "end" : "middle"} fontSize={12} fill="#475569">{fmt(c.ground)} m</text>
        </g>)}
        <text x={W - r - 12} y={H - b - 12} textAnchor="end" fontSize={18} fontWeight={700} fill="#1e40af" opacity={0.75}>🌧️ darunter Regen</text>
      </svg>
      {!anyPrecip && <p className="text-sm text-muted-foreground">Zu dieser Zeit ist kein Niederschlag berechnet – die Linie zeigt, ab welcher Höhe es schneien würde.</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {places.map(({ m, c, w }) => (
          <div key={m.name + m.km} className="rounded-lg border border-border bg-background p-2">
            <div className="text-sm font-semibold">{m.name}</div>
            <div className="text-base font-semibold">{LABEL[w]}</div>
            <div className="text-xs text-muted-foreground">{c.t2 != null ? `${c.t2.toFixed(0)} °C · ` : ""}{(c.precip ?? 0) >= 0.1 ? `${c.precip!.toFixed(1)} mm/h` : "kein Niederschlag"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
