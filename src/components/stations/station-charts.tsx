import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CloudRain, Droplets, Gauge, MapPin, Thermometer, Wind, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SourceFooter } from '@/components/source-footer';
import { seriesQuery } from '@/lib/station-series-query';
import { compass } from '@/lib/station-extremes';
import { FIRST_YEAR, frostOffset, rainBuckets, seriesStats, shiftAnchor, spanDays, timeTicks, type SeriesMetric, type SeriesPoint, type SeriesRange, type SeriesWindow } from '@/lib/station-series';
import { anchorLabel, Choice, DateRange, Stepper } from './controls';

export interface ChartStation { id: string; name: string; source?: 'own' | 'meteoswiss' | undefined }
export interface ChartState { stationId: string; metric: SeriesMetric; range: SeriesRange; anchor: string; from: string; to: string }

const METRICS: { id: SeriesMetric; label: string; icon: LucideIcon }[] = [
  { id: 'temperature', label: 'Temperatur', icon: Thermometer },
  { id: 'dew', label: 'Taupunkt & Feuchte', icon: Droplets },
  { id: 'pressure', label: 'Luftdruck', icon: Gauge },
  { id: 'rain', label: 'Niederschlag', icon: CloudRain },
  { id: 'wind', label: 'Wind', icon: Wind },
];
const RANGES: { id: SeriesRange; label: string }[] = [{ id: 'day', label: 'Tag' }, { id: 'month', label: 'Monat' }, { id: 'year', label: 'Jahr' }, { id: 'custom', label: 'Frei' }];
// Kurvenfarben für den nachtblauen Grund; Bedeutung wie in den Stationsgrafiken des Weather Hub.
const C = { temp: '#ff7d73', frost: '#6fb8ff', tmin: '#8ecbff', tmax: '#ffc4be', dew: '#7cc4ff', hum: '#6fdc9c', pres: '#ffffff', wind: '#6fc7ee', gust: '#ffa45c', rainBar: '#7db3e8', rainSum: '#ffffff' };
const FILLS = ['temp', 'dew', 'pres', 'wind'] as const;
const GRID = 'rgba(255,255,255,0.14)', TICK = { fill: 'rgba(255,255,255,0.82)', fontSize: 11 };
const NAMES: Record<string, string> = { temp: 'Temperatur', tmin: 'Minimum', tmax: 'Maximum', dew: 'Taupunkt', hum: 'Feuchte', pres: 'Luftdruck', wind: 'Mittelwind', gust: 'Böe', rain: 'Niederschlag', sum: 'Summe' };
const UNITS: Record<string, string> = { temp: '°C', tmin: '°C', tmax: '°C', dew: '°C', hum: '%', pres: 'hPa', wind: 'km/h', gust: 'km/h', rain: 'mm', sum: 'mm' };
const TIP = { contentStyle: { background: 'var(--tile-dark)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '6px 10px', fontSize: 13, color: '#fff' }, labelStyle: { fontWeight: 700, marginBottom: 2, color: '#fff' }, itemStyle: { padding: 0, fontVariantNumeric: 'tabular-nums' as const }, cursor: { stroke: 'rgba(255,255,255,0.5)' } };

const zurich = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', ...options });
const HOUR = zurich({ hour: '2-digit' }), DAY = zurich({ day: 'numeric', month: 'numeric' }), MONTH = zurich({ month: 'short' }), MONTH_YEAR = zurich({ month: 'short', year: '2-digit' });
const MOMENT = zurich({ weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }), FULL_DAY = zurich({ weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' }), CLOCK = zurich({ hour: '2-digit', minute: '2-digit' });
const fixed = (v: number | null, digits: number, unit: string) => v === null ? '–' : `${v.toFixed(digits)} ${unit}`;

function statCells(points: SeriesPoint[], metric: SeriesMetric, now: number, buckets: { label: string; rain: number | null }[]) {
  const s = seriesStats(points, metric);
  const live = s.last !== null && s.lastAt !== null && now - s.lastAt <= 30 * 60_000 && now >= s.lastAt;
  const current = (digits: number, unit: string) => live && s.lastAt !== null ? [{ label: `Aktuell · ${CLOCK.format(s.lastAt)} Uhr`, value: fixed(s.last, digits, unit) }] : [];
  if (metric === 'temperature') return [...current(1, '°C'), { label: 'Mittel', value: fixed(s.avg, 1, '°C') }, { label: 'Minimum', value: fixed(s.min, 1, '°C') }, { label: 'Maximum', value: fixed(s.max, 1, '°C') }];
  if (metric === 'dew') { const h = seriesStats(points, 'hum'); return [...current(1, '°C'), { label: 'Taupunkt Mittel', value: fixed(s.avg, 1, '°C') }, { label: 'Feuchte Mittel', value: fixed(h.avg, 0, '%') }, { label: 'Feuchte Minimum', value: fixed(h.min, 0, '%') }]; }
  if (metric === 'pressure') return [...current(1, 'hPa'), { label: 'Mittel', value: fixed(s.avg, 1, 'hPa') }, { label: 'Minimum', value: fixed(s.min, 1, 'hPa') }, { label: 'Maximum', value: fixed(s.max, 1, 'hPa') }];
  if (metric === 'wind') return [...current(0, 'km/h'), { label: 'Mittelwind', value: fixed(s.avg, 0, 'km/h') }, { label: 'Stärkste Böe', value: fixed(s.max, 0, 'km/h') }];
  const top = buckets.reduce<{ label: string; rain: number } | null>((best, b) => b.rain !== null && b.rain > 0 && (!best || b.rain > best.rain) ? { label: b.label, rain: b.rain } : best, null);
  return [{ label: 'Summe', value: fixed(s.sum, 1, 'mm') }, { label: top ? `Höchster Wert · ${top.label}` : 'Höchster Wert', value: top ? fixed(top.rain, 1, 'mm') : s.sum === null ? '–' : '0.0 mm' }];
}

function Chart({ points, win, metric, buckets }: { points: SeriesPoint[]; win: SeriesWindow; metric: SeriesMetric; buckets: ReturnType<typeof rainBuckets> }) {
  const days = spanDays(win.fromDay, win.toDay), raw = win.resolution === 'raw';
  const tick = (t: number) => days <= 2 ? `${HOUR.format(t).replace(/\D/g, '')} Uhr` : days <= 62 ? DAY.format(t) : days > 400 ? MONTH_YEAR.format(t) : MONTH.format(t);
  // Beim Wechsel der Messgrösse kann noch die Beschriftung der Regenbalken anliegen: dann ohne Zeitangabe.
  const label = (t: number) => !Number.isFinite(t) ? '' : win.resolution === 'daily' ? FULL_DAY.format(t) : `${MOMENT.format(t)} Uhr`;
  const value = (v: number | string, key: string, item: { payload?: SeriesPoint }): [string, string] => {
    const n = typeof v === 'number' ? v : Number(v), unit = UNITS[key] ?? '';
    const dir = key === 'wind' && typeof item.payload?.dir === 'number' ? ` aus ${compass(item.payload.dir)}` : '';
    return [`${n.toFixed(unit === 'km/h' || unit === '%' ? 0 : 1)} ${unit}${dir}`, NAMES[key] ?? key];
  };
  const margin = { top: 8, right: 6, left: -14, bottom: 0 };
  // «auto» liefert runde Achsenwerte; ohne Regen bräuchte die Achse sonst eine Spanne von null.
  const wet = buckets.some(b => (b.rain ?? 0) > 0), windy = points.some(p => (p.gust ?? p.wind ?? 0) > 0);
  if (metric === 'rain') return <ResponsiveContainer width="100%" height="100%">
    <ComposedChart data={buckets} margin={{ top: 8, right: -6, left: 0, bottom: 0 }}>
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis dataKey="label" tick={TICK} stroke={GRID} tickLine={false} minTickGap={14} interval="preserveStartEnd" />
      <YAxis yAxisId="bar" tick={TICK} stroke={GRID} tickLine={false} width={64} domain={wet ? [0, 'auto'] : [0, 1]} unit=" mm" />
      <YAxis yAxisId="sum" orientation="right" tick={TICK} stroke={GRID} tickLine={false} width={48} domain={wet ? [0, 'auto'] : [0, 1]} />
      <Tooltip {...TIP} cursor={{ fill: 'rgba(255,255,255,0.08)' }} formatter={value} />
      <Bar yAxisId="bar" dataKey="rain" fill={C.rainBar} radius={[2, 2, 0, 0]} isAnimationActive={false} />
      <Line yAxisId="sum" dataKey="sum" stroke={C.rainSum} strokeWidth={2} dot={false} isAnimationActive={false} />
    </ComposedChart>
  </ResponsiveContainer>;
  const line = (key: keyof typeof C, width = 2, axis = 'main') => <Line key={key} yAxisId={axis} dataKey={key} stroke={C[key]} strokeWidth={width} dot={false} connectNulls={false} isAnimationActive={false} />;
  // Bei Frost füllt die Fläche zwischen Kurve und Nullgradlinie: darüber rötlich, darunter bläulich.
  const frost = metric === 'temperature' ? frostOffset(points.map(p => p.temp)) : null;
  // Farbfläche unter der Hauptkurve, wie in den Stationsgrafiken des Weather Hub.
  const area = (key: (typeof FILLS)[number]) => <Area key={key} yAxisId="main" dataKey={key} stroke={C[key]} strokeWidth={2} fill={`url(#${key}-fill)`} baseValue={key === 'temp' && frost !== null ? 0 : 'dataMin'} dot={false} connectNulls={false} isAnimationActive={false} />;
  return <ResponsiveContainer width="100%" height="100%">
    <ComposedChart data={points} margin={metric === 'dew' ? { ...margin, right: 0 } : margin}>
      <defs>{FILLS.map(key => <linearGradient key={key} id={`${key}-fill`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={C[key]} stopOpacity={0.32} />
        {key === 'temp' && frost !== null ? <>
          <stop offset={frost} stopColor={C.temp} stopOpacity={0.04} />
          <stop offset={frost} stopColor={C.frost} stopOpacity={0.3} />
          <stop offset="100%" stopColor={C.frost} stopOpacity={0.55} />
        </> : <stop offset="100%" stopColor={C[key]} stopOpacity={0.02} />}
      </linearGradient>)}</defs>
      <CartesianGrid stroke={GRID} />
      <XAxis dataKey="t" type="number" scale="time" domain={[win.from, win.to]} ticks={timeTicks(win)} tickFormatter={tick} tick={TICK} stroke={GRID} tickLine={false} minTickGap={12} />
      <YAxis yAxisId="main" tick={TICK} stroke={GRID} tickLine={false} width={52} allowDecimals={false}
        domain={metric === 'wind' ? (windy ? [0, 'auto'] : [0, 10]) : ['auto', 'auto']} unit={metric === 'pressure' ? '' : metric === 'wind' ? '' : '°'} />
      {metric === 'dew' && <YAxis yAxisId="hum" orientation="right" tick={TICK} stroke={GRID} tickLine={false} width={48} domain={[0, 100]} unit="%" />}
      <Tooltip {...TIP} labelFormatter={(t) => label(Number(t))} formatter={value} />
      {(metric === 'temperature' || metric === 'dew') && <ReferenceLine yAxisId="main" y={0} stroke="rgba(255,255,255,0.6)" strokeDasharray="5 4" ifOverflow="hidden" />}
      {metric === 'temperature' && area('temp')}
      {metric === 'temperature' && !raw && [line('tmin', 1), line('tmax', 1)]}
      {metric === 'dew' && [area('dew'), line('hum', 1.5, 'hum')]}
      {metric === 'pressure' && area('pres')}
      {metric === 'wind' && [area('wind'), line('gust', 1.5)]}
    </ComposedChart>
  </ResponsiveContainer>;
}

const LEGEND: Record<SeriesMetric, (keyof typeof C)[]> = { temperature: ['temp', 'tmin', 'tmax'], dew: ['dew', 'hum'], pressure: ['pres'], rain: ['rainBar', 'rainSum'], wind: ['wind', 'gust'] };
const LEGEND_NAMES: Partial<Record<keyof typeof C, string>> = { temp: 'Mittel', rainBar: 'Niederschlag', rainSum: 'Laufende Summe' };

/** Grafiken einer Station: Messgrösse, Zeitraum und Station frei wählbar; die Zahlen stehen über der Kurve. */
export function StationCharts({ stations, state, today, onChange }: { stations: ChartStation[]; state: ChartState; today: string; onChange: (patch: Partial<ChartState>) => void }) {
  const { stationId, metric, range, anchor, from, to } = state;
  const input = range === 'custom' ? { stationId, range, from, to } : { stationId, range, anchor };
  const series = useQuery({ ...seriesQuery(input), enabled: stationId !== '', placeholderData: keepPreviousData });
  const data = series.data, win = data?.window, points = data?.points ?? [];
  const buckets = win ? rainBuckets(points, win) : [];
  const empty = metric === 'rain' ? buckets.every(b => b.rain === null) : !points.some(p => (metric === 'temperature' ? p.temp : metric === 'dew' ? p.dew ?? p.hum : metric === 'pressure' ? p.pres : p.wind ?? p.gust) !== null);
  const step = range === 'custom' ? null : range;
  const first = `${FIRST_YEAR}-01-01`;
  const atEnd = step === 'day' ? anchor >= today : step === 'month' ? anchor.slice(0, 7) >= today.slice(0, 7) : anchor.slice(0, 4) >= today.slice(0, 4);
  const atStart = step === 'day' ? anchor <= first : step === 'month' ? anchor.slice(0, 7) <= first.slice(0, 7) : anchor.slice(0, 4) <= first.slice(0, 4);
  const active = METRICS.find(m => m.id === metric) ?? METRICS[0];
  const legend = LEGEND[metric].filter(key => !(metric === 'temperature' && win?.resolution === 'raw' && key !== 'temp'));
  return <section aria-label="Grafiken">
    <div className="rounded-md bg-card p-3 shadow-md">
      <Select value={stationId} onValueChange={id => onChange({ stationId: id })}>
        <SelectTrigger aria-label="Station" className="h-11 w-full gap-2 text-base font-semibold sm:w-80 [&>span]:flex-1 [&>span]:text-left"><MapPin className="size-4 shrink-0 text-accent" /><SelectValue placeholder="Station wählen" /></SelectTrigger>
        <SelectContent className="weather-menu border-border">{stations.map(s => <SelectItem key={s.id} value={s.id} className="focus:bg-secondary focus:text-secondary-foreground">{s.name} <span className="ml-1 text-xs font-normal text-muted-foreground">{s.source === 'meteoswiss' ? 'MCH' : 'OWT'}</span></SelectItem>)}</SelectContent>
      </Select>
      <div role="group" aria-label="Messgrösse" className="mt-3 flex gap-1 overflow-x-auto">
        {METRICS.map(m => <Choice key={m.id} active={m.id === metric} label={m.label} onClick={() => onChange({ metric: m.id })}><m.icon className="size-4" /><span className={m.id === metric ? '' : 'hidden md:inline'}>{m.label}</span></Choice>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3">
        <div role="group" aria-label="Zeitraum" className="flex gap-1">{RANGES.map(r => <Choice key={r.id} active={r.id === range} onClick={() => onChange({ range: r.id })}>{r.label}</Choice>)}</div>
        {step ? <>
          <Stepper label={anchorLabel(step, anchor)} canPrev={!atStart} canNext={!atEnd} onPrev={() => onChange({ anchor: shiftAnchor(step, anchor, -1, today) })} onNext={() => onChange({ anchor: shiftAnchor(step, anchor, 1, today) })} />
          {!atEnd && <Button size="sm" variant="outline" className="h-9 bg-transparent" onClick={() => onChange({ anchor: today })}>Jetzt</Button>}
        </> : <DateRange from={from} to={to} max={today} onChange={(f, t) => onChange({ from: f, to: t })} />}
      </div>
    </div>
    <div className="mt-3 rounded-md bg-card p-3 shadow-md sm:p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><active.icon className="size-4 text-accent" />{active.label}</h2>
      <dl data-testid="series-stats" className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:flex sm:flex-wrap sm:gap-x-8">
        {statCells(points, metric, Date.now(), buckets).map(cell => <div key={cell.label} className="min-w-0"><dt className="truncate text-xs text-muted-foreground">{cell.label}</dt><dd className="font-display text-xl font-semibold tabular-nums">{cell.value}</dd></div>)}
      </dl>
      <div className="relative mt-3 h-[min(52svh,420px)] min-h-64" data-testid="series-chart">
        {win && <Chart key={metric} points={points} win={win} metric={metric} buckets={buckets} />}
        {(series.isPending || data?.failed || empty) && <p role="status" className="absolute inset-x-6 top-1/3 text-center text-sm text-muted-foreground">
          {series.isPending ? 'Messwerte werden geladen …' : data?.failed ? 'Die Messwerte sind momentan nicht erreichbar.' : 'Für diesen Zeitraum liegen keine Messwerte vor.'}</p>}
      </div>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {legend.map(key => <li key={key} className="flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: C[key] }} />{LEGEND_NAMES[key] ?? NAMES[key]}</li>)}
      </ul>
    </div>
    <SourceFooter data="eigene Stationen, MeteoSchweiz" className="mt-2" />
  </section>;
}
