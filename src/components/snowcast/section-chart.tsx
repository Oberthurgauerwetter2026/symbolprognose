import { useEffect, useMemo, useRef, useState } from "react";
import { analyseColumn, interpAt, wetBulb, type ColumnAnalysis } from "@/lib/snowcast";
import type { SectionHour } from "@/lib/snowcast-data";

export type Layers = { rh: boolean; iso: boolean; wind: boolean; precip: boolean; freezing: boolean; wbz: boolean; snow: boolean };
export type ChartOpts = { layers: Layers; zMax: number; isoStep: number; barbScale: number };
type Mark = { km: number; name: string };

const NX = 260, NY = 160;
const M = { l: 58, r: 14, t: 12, b: 46 };

function lerp(a: number, b: number, f: number) { return a + (b - a) * f; }

/** Feldwerte auf einem regelmässigen km×Höhe-Raster. */
function buildGrid(hour: SectionHour, zMax: number) {
  const cols = hour.columns;
  const kmMax = cols.at(-1)?.sample.km ?? 1;
  const T = new Float32Array(NX * NY).fill(NaN), RH = new Float32Array(NX * NY).fill(NaN);
  for (let ix = 0; ix < NX; ix++) {
    const km = (kmMax * ix) / (NX - 1);
    let i = 0; while (i < cols.length - 2 && cols[i + 1]!.sample.km < km) i++;
    const a = cols[i]!, b = cols[Math.min(i + 1, cols.length - 1)]!;
    const f = b.sample.km > a.sample.km ? (km - a.sample.km) / (b.sample.km - a.sample.km) : 0;
    const ground = lerp(a.ground, b.ground, f);
    for (let iy = 0; iy < NY; iy++) {
      const z = (zMax * iy) / (NY - 1);
      if (z < ground) continue;
      const ta = interpAt(a.levels, Math.max(z, a.ground), "t"), tb = interpAt(b.levels, Math.max(z, b.ground), "t");
      const ra = interpAt(a.levels, Math.max(z, a.ground), "rh"), rb = interpAt(b.levels, Math.max(z, b.ground), "rh");
      const k = iy * NX + ix;
      if (ta != null && tb != null) T[k] = lerp(ta, tb, f); else if (ta != null) T[k] = ta; else if (tb != null) T[k] = tb;
      if (ra != null && rb != null) RH[k] = lerp(ra, rb, f); else if (ra != null) RH[k] = ra; else if (rb != null) RH[k] = rb;
    }
  }
  return { T, RH, kmMax };
}

function rhColor(rh: number): [number, number, number, number] {
  if (!(rh >= 60)) return [0, 0, 0, 0];
  const f = Math.min(1, (rh - 60) / 40);
  // hellgrün → smaragd → blau
  const c = f < 0.5 ? [lerp(200, 90, f * 2), lerp(235, 200, f * 2), lerp(190, 160, f * 2)] : [lerp(90, 40, (f - 0.5) * 2), lerp(200, 110, (f - 0.5) * 2), lerp(160, 210, (f - 0.5) * 2)];
  return [c[0]!, c[1]!, c[2]!, Math.round(lerp(70, 200, f))];
}

function tempColor(t: number) {
  if (t <= -20) return "#6b21a8"; if (t <= -10) return "#2563eb"; if (t < 0) return "#0ea5e9"; if (t === 0) return "#111827";
  if (t <= 5) return "#f59e0b"; if (t <= 10) return "#f97316"; return "#dc2626";
}

/** Marching Squares: Segmente der Isolinie `lev` im Raster. */
function contour(T: Float32Array, lev: number): [number, number, number, number][] {
  const segs: [number, number, number, number][] = [];
  const v = (x: number, y: number) => T[y * NX + x]!;
  for (let y = 0; y < NY - 1; y++) for (let x = 0; x < NX - 1; x++) {
    const a = v(x, y), b = v(x + 1, y), c = v(x + 1, y + 1), d = v(x, y + 1);
    if ([a, b, c, d].some(Number.isNaN)) continue;
    const pts: [number, number][] = [];
    const edge = (p: number, q: number, x1: number, y1: number, x2: number, y2: number) => {
      if ((p - lev) * (q - lev) < 0) { const f = (lev - p) / (q - p); pts.push([x1 + (x2 - x1) * f, y1 + (y2 - y1) * f]); }
    };
    edge(a, b, x, y, x + 1, y); edge(b, c, x + 1, y, x + 1, y + 1); edge(c, d, x + 1, y + 1, x, y + 1); edge(d, a, x, y + 1, x, y);
    if (pts.length >= 2) segs.push([pts[0]![0], pts[0]![1], pts[1]![0], pts[1]![1]]);
    if (pts.length === 4) segs.push([pts[2]![0], pts[2]![1], pts[3]![0], pts[3]![1]]);
  }
  return segs;
}

function drawBarb(ctx: CanvasRenderingContext2D, x: number, y: number, kmh: number, dirFrom: number, s: number) {
  const kt = kmh / 1.852;
  const ang = (dirFrom * Math.PI) / 180;
  const dx = Math.sin(ang), dy = -Math.cos(ang);
  const L = 20 * s;
  ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
  if (kt < 2.5) return;
  const ex = x + dx * L, ey = y + dy * L;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
  let rest = Math.round(kt / 5) * 5, pos = 0;
  const px = -dy, py = dx; // senkrecht
  const step = 3.2 * s;
  while (rest >= 50) { const bx = ex - dx * pos, by = ey - dy * pos; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + px * 8 * s, by + py * 8 * s); ctx.lineTo(bx - dx * step * 1.5, by - dy * step * 1.5); ctx.closePath(); ctx.fill(); pos += step * 2; rest -= 50; }
  while (rest >= 10) { const bx = ex - dx * pos, by = ey - dy * pos; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + px * 8 * s + dx * 2 * s, by + py * 8 * s + dy * 2 * s); ctx.stroke(); pos += step; rest -= 10; }
  if (rest >= 5) { if (pos === 0) pos = step; const bx = ex - dx * pos, by = ey - dy * pos; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + px * 4 * s, by + py * 4 * s); ctx.stroke(); }
}

export function useAnalyses(hour: SectionHour | undefined): ColumnAnalysis[] {
  return useMemo(() => hour?.columns.map((c) => analyseColumn(c.levels, c.ground)) ?? [], [hour]);
}

export function SectionChart({ hour, opts, marks }: { hour: SectionHour; opts: ChartOpts; marks: Mark[] }) {
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(900);
  const [hover, setHover] = useState<{ x: number; y: number; text: string[] } | null>(null);
  const H = Math.max(360, Math.min(560, w * 0.55));
  const grid = useMemo(() => buildGrid(hour, opts.zMax), [hour, opts.zMax]);
  const an = useAnalyses(hour);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const pw = w - M.l - M.r, ph = H - M.t - M.b;
  const X = (km: number) => M.l + (km / grid.kmMax) * pw;
  const Y = (z: number) => M.t + ph - (z / opts.zMax) * ph;

  useEffect(() => {
    const c = cv.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = H * dpr; c.style.width = `${w}px`; c.style.height = `${H}px`;
    const ctx = c.getContext("2d")!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, H);
    ctx.fillStyle = "#f8fafc"; ctx.fillRect(M.l, M.t, pw, ph);
    const { layers } = opts;
    const gx = (ix: number) => M.l + (ix / (NX - 1)) * pw, gy = (iy: number) => M.t + ph - (iy / (NY - 1)) * ph;

    if (layers.rh) {
      const off = document.createElement("canvas"); off.width = NX; off.height = NY;
      const o = off.getContext("2d")!; const img = o.createImageData(NX, NY);
      for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) {
        const [r, g, b, a] = rhColor(grid.RH[iy * NX + ix]!); const p = ((NY - 1 - iy) * NX + ix) * 4;
        img.data[p] = r; img.data[p + 1] = g; img.data[p + 2] = b; img.data[p + 3] = a;
      }
      o.putImageData(img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(off, M.l, M.t, pw, ph);
    }
    // Höhenraster
    ctx.strokeStyle = "rgba(15,23,42,0.08)"; ctx.lineWidth = 1; ctx.fillStyle = "#475569"; ctx.font = "11px -apple-system, system-ui, sans-serif"; ctx.textAlign = "right";
    const zStep = opts.zMax > 6000 ? 1000 : 500;
    for (let z = 0; z <= opts.zMax; z += zStep) { ctx.beginPath(); ctx.moveTo(M.l, Y(z)); ctx.lineTo(M.l + pw, Y(z)); ctx.stroke(); ctx.fillText(`${z}`, M.l - 6, Y(z) + 4); }

    if (layers.iso) {
      for (let t = -40; t <= 30; t += opts.isoStep) {
        const segs = contour(grid.T, t); if (!segs.length) continue;
        ctx.strokeStyle = tempColor(t); ctx.lineWidth = t === 0 ? 2.4 : 1.1; ctx.setLineDash(t < 0 ? [4, 3] : []);
        ctx.beginPath(); for (const [x1, y1, x2, y2] of segs) { ctx.moveTo(gx(x1), gy(y1)); ctx.lineTo(gx(x2), gy(y2)); } ctx.stroke();
        const mid = segs[Math.floor(segs.length / 2)]!; ctx.setLineDash([]);
        ctx.fillStyle = tempColor(t); ctx.textAlign = "center"; ctx.font = "bold 10px -apple-system, system-ui, sans-serif";
        ctx.fillText(`${t}°`, gx(mid[0]), gy(mid[1]) - 3);
      }
      ctx.setLineDash([]);
    }
    const cols = hour.columns;
    const line = (vals: (number | null)[], color: string, width: number, dash: number[] = []) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.beginPath();
      vals.forEach((z, i) => { if (z == null) return; const x = X(cols[i]!.sample.km), y = Y(z); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke(); ctx.setLineDash([]);
    };
    if (layers.snow) {
      ctx.fillStyle = "rgba(37,97,161,0.14)"; ctx.beginPath();
      an.forEach((a, i) => { const x = X(cols[i]!.sample.km), y = Y(a.snowHigh ?? 0); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      for (let i = an.length - 1; i >= 0; i--) ctx.lineTo(X(cols[i]!.sample.km), Y(an[i]!.snowLow ?? 0));
      ctx.closePath(); ctx.fill();
    }
    if (layers.freezing) line(an.map((a) => a.freezing), "#111827", 1.6, [7, 4]);
    if (layers.wbz) line(an.map((a) => a.wetBulbZero), "#7c3aed", 1.6, [2, 3]);
    if (layers.snow) line(an.map((a) => a.snowLine), "#2561a1", 3.2);

    // Gelände
    ctx.fillStyle = "#57534e"; ctx.beginPath(); ctx.moveTo(X(0), Y(0));
    cols.forEach((c) => ctx.lineTo(X(c.sample.km), Y(c.ground))); ctx.lineTo(X(grid.kmMax), Y(0)); ctx.closePath(); ctx.fill();

    if (layers.wind) {
      ctx.strokeStyle = "#0f172a"; ctx.fillStyle = "#0f172a"; ctx.lineWidth = 1.1;
      const every = Math.max(1, Math.round(cols.length / Math.max(4, pw / 70)));
      cols.forEach((c, i) => { if (i % every) return; for (const l of c.levels) if (l.z <= opts.zMax && l.z > c.ground + 80) drawBarb(ctx, X(c.sample.km), Y(l.z), l.ws, l.wd, opts.barbScale); });
    }
    if (layers.precip) {
      cols.forEach((c, i) => {
        const p = c.precip ?? 0; if (p < 0.05) return;
        const snowFrac = c.snow != null && p > 0 ? Math.min(1, (c.snow / 0.7) / p) : 0;
        const x0 = X(c.sample.km) - Math.max(2, pw / cols.length / 2 - 1), bw = Math.max(4, pw / cols.length - 2);
        const hgt = Math.min(18, 3 + p * 4);
        ctx.fillStyle = snowFrac > 0.7 ? "#e0f2fe" : snowFrac > 0.2 ? "#94a3b8" : "#38bdf8";
        ctx.strokeStyle = "#0369a1"; ctx.lineWidth = 0.6;
        ctx.fillRect(x0, Y(c.ground) - hgt, bw, hgt); ctx.strokeRect(x0, Y(c.ground) - hgt, bw, hgt);
        void i;
      });
    }
    // Achsen & Orte
    ctx.strokeStyle = "#334155"; ctx.lineWidth = 1; ctx.strokeRect(M.l, M.t, pw, ph);
    ctx.fillStyle = "#334155"; ctx.textAlign = "center"; ctx.font = "11px -apple-system, system-ui, sans-serif";
    const kmStep = grid.kmMax > 150 ? 50 : grid.kmMax > 60 ? 10 : 5;
    for (let k = 0; k <= grid.kmMax; k += kmStep) ctx.fillText(`${k}`, X(k), M.t + ph + 14);
    ctx.font = "600 11px -apple-system, system-ui, sans-serif";
    for (const m of marks) { ctx.fillText(m.name, X(m.km), M.t + ph + 30); ctx.strokeStyle = "rgba(51,65,85,0.35)"; ctx.beginPath(); ctx.moveTo(X(m.km), M.t + ph); ctx.lineTo(X(m.km), M.t + ph + 18); ctx.stroke(); }
    ctx.save(); ctx.translate(14, M.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.font = "11px -apple-system, system-ui, sans-serif"; ctx.fillText("Höhe m ü. M.", 0, 0); ctx.restore();
    ctx.textAlign = "right"; ctx.fillText("km", M.l + pw, M.t + ph + 42);
  }, [grid, an, hour, opts, w, H, pw, ph, marks]);

  const onMove = (e: React.MouseEvent) => {
    const r = cv.current!.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < M.l || x > M.l + pw || y < M.t || y > M.t + ph) { setHover(null); return; }
    const ix = Math.round(((x - M.l) / pw) * (NX - 1)), iy = Math.round(((M.t + ph - y) / ph) * (NY - 1));
    const km = (grid.kmMax * ix) / (NX - 1), z = (opts.zMax * iy) / (NY - 1);
    const t = grid.T[iy * NX + ix]!, rh = grid.RH[iy * NX + ix]!;
    const ci = hour.columns.reduce((best, c, i) => Math.abs(c.sample.km - km) < Math.abs(hour.columns[best]!.sample.km - km) ? i : best, 0);
    const a = an[ci];
    const text = [`${km.toFixed(1)} km · ${Math.round(z)} m`];
    if (Number.isNaN(t)) text.push("Gelände"); else text.push(`${t.toFixed(1)} °C · rF ${Math.round(rh)} % · Tw ${wetBulb(t, rh).toFixed(1)} °C`);
    if (a) text.push(`Schneefallgrenze ≈ ${Math.round(a.snowLine ?? 0)} m (${Math.round(a.snowLow ?? 0)}–${Math.round(a.snowHigh ?? 0)})`);
    setHover({ x, y, text });
  };

  return (
    <div ref={wrap} className="relative w-full">
      <canvas ref={cv} onMouseMove={onMove} onMouseLeave={() => setHover(null)} className="block" />
      {hover && (
        <div className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-2 py-1 text-[11px] leading-snug text-popover-foreground shadow" style={{ left: Math.min(hover.x + 12, w - 230), top: Math.max(0, hover.y - 50) }}>
          {hover.text.map((t) => <div key={t}>{t}</div>)}
        </div>
      )}
    </div>
  );
}

/** Untere Grafik: geschätzte Schneefallgrenze entlang der Strecke. */
export function SnowLineStrip({ hour, marks }: { hour: SectionHour; marks: Mark[] }) {
  const an = useAnalyses(hour);
  const cols = hour.columns; const kmMax = cols.at(-1)?.sample.km ?? 1;
  const zs = [...an.map((a) => a.snowHigh ?? 0), ...cols.map((c) => c.ground)];
  const top = Math.ceil((Math.max(...zs) + 200) / 500) * 500;
  const W = 1000, H = 170, l = 50, b = 26;
  const x = (km: number) => l + (km / kmMax) * (W - l - 10), y = (z: number) => 8 + (H - b - 8) * (1 - z / top);
  const path = (vals: number[]) => vals.map((z, i) => `${i ? "L" : "M"}${x(cols[i]!.sample.km).toFixed(1)},${y(z).toFixed(1)}`).join("");
  const band = path(an.map((a) => a.snowHigh ?? 0)) + an.map((a, i) => ({ a, i })).reverse().map(({ a, i }) => `L${x(cols[i]!.sample.km).toFixed(1)},${y(a.snowLow ?? 0).toFixed(1)}`).join("") + "Z";
  const ground = `M${x(0)},${y(0)}` + cols.map((c) => `L${x(c.sample.km).toFixed(1)},${y(c.ground).toFixed(1)}`).join("") + `L${x(kmMax)},${y(0)}Z`;
  const ticks = [0, top / 2, top];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Geschätzte Schneefallgrenze entlang der Strecke">
      {ticks.map((t) => <g key={t}><line x1={l} x2={W - 10} y1={y(t)} y2={y(t)} className="stroke-border" /><text x={l - 6} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">{Math.round(t)}</text></g>)}
      <path d={band} className="fill-primary/15" />
      <path d={ground} fill="#78716c" />
      <path d={path(an.map((a) => a.snowLine ?? 0))} className="stroke-primary" strokeWidth={3} fill="none" />
      {an.map((a, i) => a.snowLine != null && a.snowLine <= cols[i]!.ground + 30 ? <circle key={i} cx={x(cols[i]!.sample.km)} cy={y(cols[i]!.ground) - 6} r={3} className="fill-primary" /> : null)}
      {marks.map((m) => <text key={m.name + m.km} x={x(m.km)} y={H - 8} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">{m.name}</text>)}
    </svg>
  );
}
