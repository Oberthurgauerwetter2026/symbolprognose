import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import warnRegions from '@/data/preview-warn-regions.json';
import { satelliteManifestQuery } from '@/lib/map-queries';
import { getPointRadarFrames } from '@/lib/point-nowcast.functions';
import { stationColor, stationTextColor } from '@/lib/station-colors';
import { formatStationValue, type StationExtreme } from '@/lib/station-extremes';
import { PREVIEW_VIEWS, previewPoint, previewWmsBbox, renderRadarStill, renderWindStill, sampleGrid, mercatorLat, mercatorLon, type PreviewView } from '@/lib/tile-preview';
import { LEVELS, slugifyRegion } from '@/lib/warnings-config';
import type { WarningDTO } from '@/lib/warnings.functions';
import { getWindNow } from '@/lib/wind.functions';

/**
 * Leichte Echtzeit-Vorschauen der Startseiten-Kacheln: fotografierte
 * Kartengrundlage der Originalkarte plus aktuelle Daten als Bild/Canvas/SVG.
 * Keine Karten-Instanz und kein iframe – dadurch sofort da und speicherschonend.
 */
function Frame({ view, focus = view.focus, children, note, dark }: { view: PreviewView; focus?: number[] | undefined; children?: ReactNode; note?: string | null; dark?: boolean }) {
  const ratio = view.w / view.h;
  const [fx0 = 0, fy0 = 0, fx1 = 1, fy1 = 1] = focus ?? [];
  const style = {
    '--iw': `max(100cqw, ${ratio * 100}cqh, min(${100 / (fx1 - fx0)}cqw, ${(ratio * 100) / (fy1 - fy0)}cqh))`,
    '--ih': `calc(var(--iw) / ${ratio})`,
    width: 'var(--iw)', height: 'var(--ih)',
    left: `clamp(calc(100cqw - var(--iw)), calc(50cqw - var(--iw) * ${(fx0 + fx1) / 2}), 0px)`,
    top: `clamp(calc(100cqh - var(--ih)), calc(50cqh - var(--ih) * ${(fy0 + fy1) / 2}), 0px)`,
    containerType: 'size',
  } as CSSProperties;
  return <div className={`absolute inset-0 overflow-hidden [container-type:size] ${dark ? 'bg-zinc-800' : 'bg-muted'}`} data-tile-preview>
    <div className="absolute" style={style}>
      {view.base && <img src={view.base} alt="" decoding="async" className="absolute inset-0 size-full" />}
      {children}
      {view.top && <img src={view.top} alt="" decoding="async" className="pointer-events-none absolute inset-0 size-full" />}
    </div>
    {note && <p className="absolute inset-x-0 bottom-0 bg-card/85 px-2 py-1 text-[10px] leading-tight text-muted-foreground">{note}</p>}
  </div>;
}

const LAYER = 'pointer-events-none absolute inset-0 size-full';
const OUT_W = 440;
const outH = (view: PreviewView) => Math.round((OUT_W * view.h) / view.w);

function paint(canvas: HTMLCanvasElement | null, pixels: Uint8ClampedArray, w: number, h: number) {
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;
  canvas.width = w; canvas.height = h;
  const image = ctx.createImageData(w, h);
  image.data.set(pixels);
  ctx.putImageData(image, 0, 0);
}

/** Aktuelle Temperaturen der Stationen als Pillen wie auf der Live-Stationskarte. */
export function StationPreview({ stations }: { stations: StationExtreme[] }) {
  const view = PREVIEW_VIEWS.stations;
  const points = stations.flatMap(s => typeof s.current === 'number' && Number.isFinite(s.current) ? [{ s, value: s.current, ...previewPoint(view, s.lat, s.lon) }] : []).filter(p => p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1);
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const focus = points.length ? [Math.max(0, Math.min(...xs) - 0.07), Math.max(0, Math.min(...ys) - 0.1), Math.min(1, Math.max(...xs) + 0.07), Math.min(1, Math.max(...ys) + 0.16)] : undefined;
  return <Frame view={view} focus={focus} note={points.length ? null : 'Momentan keine aktuellen Messwerte'}>
    {points.map(({ s, value, x, y }) => {
      const bg = stationColor(value, 'current');
      return <div key={s.id} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${x * 100}%`, top: `${y * 100}%`, fontSize: '1.9cqw' }}>
        <span className="flex items-center justify-center rounded-full font-bold tabular-nums shadow-sm" style={{ background: bg, color: stationTextColor(bg), border: '0.14em solid white', width: '4.4em', height: '2.7em', lineHeight: 1 }}>{formatStationValue(value, 'current')}</span>
        <span className="absolute top-full whitespace-nowrap font-semibold text-zinc-800 [text-shadow:0_0_3px_#fff,0_0_3px_#fff,0_0_2px_#fff]" style={{ fontSize: '0.78em', marginTop: '0.15em' }}>{s.name}</span>
      </div>;
    })}
  </Frame>;
}

/** Letztes Radar-Messbild, gefärbt wie die Radarkarte. Fehlt das Bild, steht das da – nie «trocken». */
export function RadarPreview() {
  const view = PREVIEW_VIEWS.radar;
  const getFrames = useServerFn(getPointRadarFrames);
  const manifest = useQuery({ queryKey: ['overview-radar-manifest'], queryFn: () => getFrames(), staleTime: 60_000, refetchInterval: 60_000 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const url = manifest.data?.frames[0]?.url, box = manifest.data?.bbox;
  useEffect(() => {
    if (!url || !box) return;
    const abort = new AbortController();
    let timer = 0;
    const load = async (attempt: number) => {
      try {
        const response = await fetch(url, { signal: abort.signal });
        if (!response.ok) throw new Error('radar image');
        const bitmap = await createImageBitmap(await response.blob());
        const scratch = document.createElement('canvas');
        scratch.width = bitmap.width; scratch.height = bitmap.height;
        const ctx = scratch.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('canvas');
        ctx.drawImage(bitmap, 0, 0);
        const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
        const w = bitmap.width, h = bitmap.height;
        bitmap.close();
        if (abort.signal.aborted) return;
        paint(canvas.current, renderRadarStill({ w, h, data }, box, view, OUT_W, outH(view)), OUT_W, outH(view));
        setFailed(false);
      } catch {
        if (abort.signal.aborted) return;
        if (attempt < 2) timer = window.setTimeout(() => void load(attempt + 1), 3000);
        else setFailed(true);
      }
    };
    void load(0);
    return () => { abort.abort(); window.clearTimeout(timer); };
  }, [url, box?.minLat, box?.maxLat, box?.minLon, box?.maxLon]);
  const missing = failed || manifest.isError || (manifest.isSuccess && !url);
  return <Frame view={view} note={missing ? 'Radarbild momentan nicht verfügbar' : null}>
    <canvas ref={canvas} className={LAYER} style={{ opacity: missing ? 0 : 0.8 }} />
  </Frame>;
}

/** Böen-Farbfläche und Windpfeile der aktuellen Stunde. */
export function WindPreview() {
  const view = PREVIEW_VIEWS.wind;
  const getNow = useServerFn(getWindNow);
  const wind = useQuery({ queryKey: ['wind-now'], queryFn: () => getNow(), staleTime: 5 * 60_000, refetchInterval: 10 * 60_000 });
  const field = useRef<HTMLCanvasElement>(null);
  const arrows = useRef<HTMLCanvasElement>(null);
  const data = wind.data;
  useEffect(() => {
    if (!data) return;
    paint(field.current, renderWindStill(data, view, OUT_W, outH(view)), OUT_W, outH(view));
    const cv = arrows.current, ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    cv.width = view.w; cv.height = view.h;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(20,30,50,0.85)';
    const STEP = 116;
    for (let py = STEP / 2; py < view.h; py += STEP) for (let px = STEP / 2; px < view.w; px += STEP) {
      const lat = mercatorLat(view.y0 + (py / view.h) * (view.y1 - view.y0)), lon = mercatorLon(view.x0 + (px / view.w) * (view.x1 - view.x0));
      const speed = sampleGrid(data.speed, data.gridLat, data.gridLon, lat, lon);
      const dir = sampleGrid(data.dir, data.gridLat, data.gridLon, lat, lon, true);
      if (speed === null || dir === null || speed < 1) continue;
      const rad = ((dir + 180) * Math.PI) / 180, len = Math.max(24, Math.min(STEP * 0.9, speed * 1.1));
      const dx = Math.sin(rad) * len, dy = -Math.cos(rad) * len, x1 = px + dx / 2, y1 = py + dy / 2, head = Math.max(5, Math.min(14, len * 0.28)), angle = Math.atan2(dy, dx);
      ctx.lineWidth = Math.max(2, Math.min(4, 2 + speed * 0.03));
      ctx.beginPath();
      ctx.moveTo(px - dx / 2, py - dy / 2); ctx.lineTo(x1, y1);
      ctx.moveTo(x1, y1); ctx.lineTo(x1 - head * Math.cos(angle - 0.5), y1 - head * Math.sin(angle - 0.5));
      ctx.moveTo(x1, y1); ctx.lineTo(x1 - head * Math.cos(angle + 0.5), y1 - head * Math.sin(angle + 0.5));
      ctx.stroke();
    }
  }, [data]);
  const missing = wind.isError || (wind.isSuccess && !data);
  return <Frame view={view} note={missing ? 'Winddaten momentan nicht verfügbar' : null}>
    <canvas ref={field} className={LAYER} style={{ opacity: 0.55 }} />
    <canvas ref={arrows} className={LAYER} />
  </Frame>;
}

/** Warnkarte: Gemeinden mit aktiver Warnung in der Stufenfarbe, Vorinformationen schraffiert. */
export function WarningPreview({ warnings }: { warnings: WarningDTO[] }) {
  const view = PREVIEW_VIEWS.warn;
  const hatch = useId().replace(/[^a-zA-Z0-9]/g, '');
  const level = new Map<string, number>(), advisory = new Map<string, number>();
  for (const w of warnings) for (const id of w.regionIds) {
    const target = w.advisory ? advisory : level;
    target.set(id, Math.max(target.get(id) ?? 0, w.level));
  }
  return <Frame view={view}>
    <svg viewBox={`0 0 ${view.w} ${view.h}`} className={LAYER} aria-hidden="true">
      <defs>{([1, 2, 3] as const).map(l => <pattern key={l} id={`${hatch}-${l}`} width="16" height="16" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <rect width="16" height="16" fill={LEVELS[l].color} opacity="0.18" /><line x1="0" y1="0" x2="0" y2="16" stroke={LEVELS[l].color} strokeWidth="8" opacity="0.95" />
      </pattern>)}</defs>
      {warnRegions.map(region => {
        const id = slugifyRegion(region.name);
        const lvl = Math.max(0, Math.min(3, level.get(id) ?? 0)) as 0 | 1 | 2 | 3;
        const adv = lvl > 0 ? 0 : Math.max(0, Math.min(3, advisory.get(id) ?? 0));
        if (!lvl && !adv) return null;
        return <g key={region.name}>
          <path d={region.d} fill="#f4f5f2" />
          <path d={region.d} fill={adv ? `url(#${hatch}-${adv})` : LEVELS[lvl].color} fillOpacity={adv ? 1 : LEVELS[lvl].fillOpacity} stroke="#4b5563" strokeWidth="2" strokeOpacity="0.75" />
        </g>;
      })}
    </svg>
  </Frame>;
}

/** Neustes Satellitenbild als ein einziges Bild; ist es noch nicht bereit, das vorherige. */
export function SatellitePreview() {
  const view = PREVIEW_VIEWS.satellite;
  const manifest = useQuery({ ...satelliteManifestQuery('alpen-ch'), refetchInterval: 5 * 60_000 });
  const [back, setBack] = useState(0);
  const frames = manifest.data?.frames ?? [];
  const frame = frames[frames.length - 1 - back];
  useEffect(() => setBack(0), [frames[frames.length - 1]?.time]);
  const src = manifest.data?.provider === 'eumetsat-wms' && frame
    ? `https://view.eumetsat.int/geoserver/wms?service=WMS&request=GetMap&version=1.3.0&layers=${encodeURIComponent(manifest.data.layer)}&styles=&format=image%2Fjpeg&crs=EPSG%3A3857&width=${view.w}&height=${view.h}&bbox=${previewWmsBbox(view)}&time=${encodeURIComponent(frame.time)}&format_options=${encodeURIComponent('antialias:full;interpolation:bicubic')}`
    : null;
  const missing = manifest.isError || (manifest.isSuccess && !src);
  return <Frame view={view} dark note={missing ? 'Satellitenbild momentan nicht verfügbar' : null}>
    {src && <img key={src} src={src} alt="" decoding="async" className={LAYER} onError={() => setBack(n => Math.min(n + 1, Math.max(0, frames.length - 1)))} />}
  </Frame>;
}
