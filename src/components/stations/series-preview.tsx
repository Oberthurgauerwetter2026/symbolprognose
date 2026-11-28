import { useQuery } from '@tanstack/react-query';
import { seriesQuery } from '@/lib/station-series-query';
import { zurichDay, type StationExtreme } from '@/lib/station-extremes';

/** Kachelvorschau: der heutige Temperaturverlauf der Station Amriswil als leichte Kurve, ohne Diagramm-Bibliothek. */
export function SeriesPreview({ stations }: { stations: StationExtreme[] }) {
  const station = stations.find(s => s.name === 'Amriswil') ?? stations[0];
  const series = useQuery({ ...seriesQuery({ stationId: station?.id ?? '', range: 'day', anchor: zurichDay(Date.now()) }), enabled: Boolean(station) });
  const win = series.data?.window;
  const points = (series.data?.points ?? []).flatMap(p => p.temp === null ? [] : [{ t: p.t, v: p.temp }]);
  const W = 400, H = 120, values = points.map(p => p.v);
  const lo = Math.floor(Math.min(0, ...values) - 0.5), hi = Math.ceil(Math.max(1, ...values) + 0.5);
  const x = (t: number) => win ? ((t - win.from) / (win.to - win.from)) * W : 0, y = (v: number) => H - 6 - ((v - lo) / (hi - lo)) * (H - 14);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const last = points[points.length - 1], first = points[0];
  return <div className="absolute inset-0 bg-(--overview-station)" data-tile-preview>
    {path && last && first ? <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
      {[0.25, 0.5, 0.75].map(f => <line key={f} x1={f * W} x2={f * W} y1={0} y2={H} stroke="#ffffff" strokeOpacity={0.1} vectorEffect="non-scaling-stroke" />)}
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#ffffff" strokeOpacity={0.45} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
      <path d={`${path}L${x(last.t).toFixed(1)},${H}L${x(first.t).toFixed(1)},${H}Z`} fill="#ff7d73" fillOpacity={0.16} />
      <path d={path} fill="none" stroke="#ff7d73" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg> : <p className="absolute inset-0 grid place-items-center px-3 text-center text-xs text-muted-foreground">{series.isPending && station ? 'Verlauf wird geladen …' : 'Momentan kein Verlauf verfügbar'}</p>}
    {station && last && <p className="absolute left-2 top-2 rounded-sm bg-(--tile-dark)/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums">{station.name} · {last.v.toFixed(1)}° · heute</p>}
  </div>;
}
