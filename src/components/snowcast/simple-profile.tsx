import { useAnalyses } from "@/components/snowcast/section-chart";
import { interpAt, type Level } from "@/lib/snowcast";
import type { SectionHour } from "@/lib/snowcast-data";

type Mark = { km: number; name: string };
const fmt = (m: number) => `${Math.round(m / 50) * 50}`.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
const DIRS = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
const dirName = (d: number) => DIRS[Math.round((((d % 360) + 360) % 360) / 45) % 8]!;

/** Ruhige Temperaturskala: kalt Blau, um 0 °C fast Weiss, warm Sand/Orange. */
function tempColor(t: number): string {
  const c = Math.max(-20, Math.min(20, t));
  if (c < 0) { const f = -c / 20; return `hsl(${210 + f * 15} ${45 + f * 30}% ${94 - f * 34}%)`; }
  const f = c / 20; return `hsl(${42 - f * 22} ${55 + f * 25}% ${93 - f * 28}%)`;
}
/** Tiefste Höhe, auf der die Temperatur den Wert t0 kreuzt (für Isothermen). */
function isoHeight(levels: Level[], t0: number, ground: number): number | null {
  for (let i = 1; i < levels.length; i++) {
    const a = levels[i - 1]!, b = levels[i]!;
    if (b.z < ground) continue;
    if ((a.t - t0) * (b.t - t0) <= 0 && a.t !== b.t) return Math.max(ground, a.z + ((t0 - a.t) / (b.t - a.t)) * (b.z - a.z));
  }
  return null;
}
// Radar-Symbole 1:1 aus radar-map.tsx (isFlakePixel arm 2 / isDropPixel), gleiche Phasenfarben.
const FLAKE_PX: [number, number][] = [];
for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) FLAKE_PX.push([dx, dy]);
const DROP_PX: [number, number][] = [[0, -2], [0, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [0, 2]];
const PHASE_RGB = { snow: "rgb(164,134,214)", sleet: "rgb(112,134,166)", rain: "rgb(66,111,200)" } as const;
function Glyph({ cx, cy, kind, px = 2.2 }: { cx: number; cy: number; kind: "flake" | "drop"; px?: number }) {
  const pts = kind === "flake" ? FLAKE_PX : DROP_PX;
  return <>{pts.map(([dx, dy]) => <rect key={`${dx},${dy}`} x={cx + (dx - 0.5) * px} y={cy + (dy - 0.5) * px} width={px + 0.1} height={px + 0.1} fill="#ffffff" />)}</>;
}
function PhaseMark({ cx, cy, phase }: { cx: number; cy: number; phase: "snow" | "sleet" | "rain" }) {
  return <g>
    <rect x={cx - 9} y={cy - 9} width={18} height={18} rx={5} fill={PHASE_RGB[phase]} fillOpacity={0.92} />
    {phase === "sleet" ? <><Glyph cx={cx - 3.5} cy={cy} kind="flake" px={1.3} /><Glyph cx={cx + 4} cy={cy} kind="drop" px={1.5} /></> : <Glyph cx={cx} cy={cy} kind={phase === "snow" ? "flake" : "drop"} />}
  </g>;
}
function windAt(levels: Level[], z: number) {
  let best: Level | null = null;
  for (const l of levels) if (!best || Math.abs(l.z - z) < Math.abs(best.z - z)) best = l;
  return best && Math.abs(best.z - z) < 400 ? best : null;
}

export function SimpleProfile({ hour, marks }: { hour: SectionHour; marks: Mark[] }) {
  const an = useAnalyses(hour);
  const cols = hour.columns; const kmMax = cols.at(-1)?.sample.km ?? 1;
  const top = 4000;
  const W = 1000, H = 480, l = 62, r = 54, t = 14, b = 58;
  const x = (km: number) => l + (km / kmMax) * (W - l - r), y = (z: number) => t + (H - b - t) * (1 - Math.min(z, top) / top);
  const ptsOf = (vals: (number | null)[]) => {
    const segs: string[][] = [[]];
    vals.forEach((z, i) => { if (z == null) { if (segs.at(-1)!.length) segs.push([]); return; } segs.at(-1)!.push(`${x(cols[i]!.sample.km).toFixed(1)},${y(z).toFixed(1)}`); });
    return segs.filter((s) => s.length > 1);
  };
  // Temperaturfeld
  const cells: { x0: number; x1: number; y0: number; y1: number; c: string }[] = [];
  cols.forEach((c, i) => {
    const xm0 = i ? (x(cols[i - 1]!.sample.km) + x(c.sample.km)) / 2 : l;
    const xm1 = i < cols.length - 1 ? (x(cols[i + 1]!.sample.km) + x(c.sample.km)) / 2 : W - r;
    for (let z = 0; z < top; z += 100) {
      const tv = interpAt(c.levels, z + 50, "t") ?? (z + 50 < (c.levels[0]?.z ?? 0) ? c.levels[0]?.t ?? null : null);
      if (tv != null) cells.push({ x0: xm0, x1: xm1, y0: y(z + 100), y1: y(z), c: tempColor(tv) });
    }
  });
  const isos = [-15, -10, -5, 5, 10, 15].map((v) => ({ v, segs: ptsOf(cols.map((c) => isoHeight(c.levels, v, c.ground))) }));
  const freezing = ptsOf(an.map((a) => a.freezing));
  const snow = ptsOf(an.map((a) => a.snowLine));
  const bandHi = an.map((a) => a.snowHigh ?? a.snowLine), bandLo = an.map((a) => a.snowLow ?? a.snowLine);
  const band = `M${cols.map((c, i) => `${x(c.sample.km)},${y(bandHi[i] ?? c.ground)}`).join(" L")} L${[...cols].reverse().map((c, j) => { const i = cols.length - 1 - j; return `${x(c.sample.km)},${y(bandLo[i] ?? c.ground)}`; }).join(" L")}Z`;
  const ground = `M${x(0)},${y(0)} L` + cols.map((c) => `${x(c.sample.km).toFixed(1)},${y(c.ground).toFixed(1)}`).join(" L") + ` L${x(kmMax)},${y(0)}Z`;
  const ticks = Array.from({ length: top / 500 + 1 }, (_, i) => i * 500);
  const windStep = Math.max(1, Math.round(cols.length / 7));
  const windCols = cols.map((c, i) => ({ c, i })).filter(({ i }) => i % windStep === Math.floor(windStep / 2));
  const anchor = (km: number) => (km < kmMax * 0.08 ? "start" : km > kmMax * 0.92 ? "end" : "middle");
  const near = (km: number) => cols.reduce((best, c, i) => (Math.abs(c.sample.km - km) < Math.abs(cols[best]!.sample.km - km) ? i : best), 0);
  const last = cols.length - 1;
  // Niederschlagsphase in der Luftsäule (nur wo es nass ist)
  const marksPh: { cx: number; cy: number; phase: "snow" | "sleet" | "rain"; k: string }[] = [];
  windCols.forEach(({ c, i }) => {
    if ((c.precip ?? 0) < 0.1) return;
    const a = an[i]; if (!a) return;
    const lo = a.snowLow ?? a.snowLine ?? 0, hi = a.snowHigh ?? a.snowLine ?? 0;
    const cx = x(c.sample.km) + 22;
    for (let z = Math.ceil((c.ground + 150) / 300) * 300; z <= Math.min(top - 200, hi + 900); z += 300) {
      const phase = z > hi ? "snow" : z >= lo ? "sleet" : "rain";
      marksPh.push({ cx, cy: y(z), phase, k: `${i}-${z}` });
    }
  });
  // Höhenzahlen direkt auf der Schneefallgrenze (an den Orten)
  const pills = marks.map((m) => { const i = near(m.km); const z = an[i]?.snowLine; return z == null ? null : { cx: x(cols[i]!.sample.km), cy: y(Math.max(z, cols[i]!.ground)), z: Math.max(z, cols[i]!.ground), k: m.name + m.km }; }).filter((p): p is NonNullable<typeof p> => p != null);
  const rightLabel = (z: number | null | undefined, text: string, color: string) => z == null ? null :
    <text x={W - r + 4} y={y(z) + 4} fontSize={11} fontWeight={700} fill={color}>{text}</text>;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="weather-light w-full rounded-lg bg-background" role="img" aria-label="Vertikalschnitt mit Temperatur, Wind, Nullgradgrenze und Schneefallgrenze" fontFamily="SF Pro Text, -apple-system, system-ui, sans-serif">
      {cells.map((k, i) => <rect key={i} x={k.x0} y={k.y0} width={k.x1 - k.x0 + 0.5} height={k.y1 - k.y0 + 0.5} fill={k.c} />)}
      {ticks.map((z) => <g key={z}><line x1={l} x2={W - r} y1={y(z)} y2={y(z)} stroke="#0f172a" strokeOpacity={0.08} /><text x={l - 6} y={y(z) + 4} textAnchor="end" fontSize={11} fill="#475569">{fmt(z)} m</text></g>)}
      {isos.map(({ v, segs }) => segs.map((s, j) => <g key={`${v}-${j}`}>
        <polyline points={s.join(" ")} fill="none" stroke={v < 0 ? "#3b6fa8" : "#b4652a"} strokeOpacity={0.55} strokeWidth={1} />
        {j === 0 && (() => { const p = s[Math.floor(s.length * 0.3)]!.split(","); return <text x={+p[0]!} y={+p[1]! - 3} fontSize={10} fontWeight={600} fill={v < 0 ? "#2b5582" : "#8a4a1c"} textAnchor="middle" paintOrder="stroke" stroke="#ffffff" strokeWidth={3}>{v > 0 ? "+" : ""}{v}°</text>; })()}
      </g>))}
      <path d={band} fill="#2561a1" fillOpacity={0.14} />
      {freezing.map((s, j) => <polyline key={`f${j}`} points={s.join(" ")} fill="none" stroke="#c2410c" strokeWidth={2} strokeDasharray="7 5" />)}
      {snow.map((s, j) => <polyline key={`s${j}`} points={s.join(" ")} fill="none" stroke="#2561a1" strokeWidth={3} />)}
      {rightLabel(an[last]?.freezing, "0 °C", "#c2410c")}
      {rightLabel(an[last]?.snowLine, "Schnee", "#2561a1")}
      {windCols.map(({ c }) => [1000, 2000, 3000].map((z) => {
        const w = windAt(c.levels, z); if (!w || z < c.ground + 150) return null;
        const cx = x(c.sample.km), cy = y(z), len = 10 + Math.min(w.ws, 100) / 100 * 16;
        return <g key={`${c.sample.km}-${z}`} transform={`translate(${cx},${cy})`}>
          <g transform={`rotate(${w.wd + 180})`}><line x1={0} y1={len / 2} x2={0} y2={-len / 2} stroke="#0f172a" strokeWidth={1.6} /><path d={`M0,${-len / 2 - 4} L-4,${-len / 2 + 3} L4,${-len / 2 + 3}Z`} fill="#0f172a" /></g>
          <text x={0} y={22} fontSize={10} textAnchor="middle" fill="#0f172a" paintOrder="stroke" stroke="#ffffff" strokeWidth={3}>{dirName(w.wd)} {Math.round(w.ws)}</text>
          <text x={0} y={-16} fontSize={10} fontWeight={600} textAnchor="middle" fill="#0f172a" paintOrder="stroke" stroke="#ffffff" strokeWidth={3}>{w.t > 0 ? "+" : ""}{w.t.toFixed(0)}°</text>
        </g>;
      }))}
      {marksPh.map((p) => <PhaseMark key={p.k} cx={p.cx} cy={p.cy} phase={p.phase} />)}
      <path d={ground} fill="#8a8f7a" stroke="#4b4f3f" strokeWidth={1.2} />
      {marks.map((m) => { const c = cols[near(m.km)]!; return <g key={m.name + m.km}>
        <line x1={x(c.sample.km)} x2={x(c.sample.km)} y1={y(c.ground)} y2={H - b} stroke="#ffffff" strokeOpacity={0.5} />
        <circle cx={x(c.sample.km)} cy={y(c.ground)} r={3.5} fill="#0f172a" />
        <text x={x(m.km)} y={H - b + 18} textAnchor={anchor(m.km)} fontSize={12} fontWeight={700} fill="#0f172a">{m.name}</text>
        <text x={x(m.km)} y={H - b + 33} textAnchor={anchor(m.km)} fontSize={11} fill="#475569">{fmt(c.ground)} m{c.t2 != null ? ` · ${c.t2.toFixed(0)} °C` : ""}</text>
      </g>; })}
      {pills.map((p) => { const label = `${fmt(p.z)} m`; const wd = label.length * 6.4 + 24; const px = Math.min(Math.max(p.cx, l + wd / 2 + 2), W - r - wd / 2 - 2);
        return <g key={p.k}><rect x={px - wd / 2} y={p.cy - 22} width={wd} height={17} rx={8.5} fill="#2561a1" />
          <g transform={`translate(${px - wd / 2 + 10},${p.cy - 13.5})`}><Glyph cx={0} cy={0} kind="flake" px={1.4} /></g>
          <text x={px - wd / 2 + 19} y={p.cy - 9.5} fontSize={11} fontWeight={700} fill="#ffffff">{label}</text></g>; })}
      <g transform={`translate(${l + 8},${t + 8})`} fontSize={11} fill="#0f172a">
        <rect width={600} height={22} rx={6} fill="#ffffff" fillOpacity={0.85} />
        <line x1={10} x2={34} y1={11} y2={11} stroke="#2561a1" strokeWidth={3} /><text x={40} y={15}>Schneefallgrenze</text>
        <line x1={150} x2={174} y1={11} y2={11} stroke="#c2410c" strokeWidth={2} strokeDasharray="7 5" /><text x={180} y={15}>Nullgradgrenze</text>
        <path d="M290,15 L302,7" stroke="#0f172a" strokeWidth={1.6} /><text x={308} y={15}>Wind km/h</text>
        <PhaseMark cx={392} cy={11} phase="snow" /><text x={405} y={15}>Schnee</text>
        <PhaseMark cx={462} cy={11} phase="sleet" /><text x={475} y={15}>Schneeregen</text>
        <PhaseMark cx={556} cy={11} phase="rain" /><text x={569} y={15}>Regen</text>
      </g>
    </svg>
  );
}
