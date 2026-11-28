import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { CloudRain, Map as MapIcon, Table2, Thermometer, Wind, type LucideIcon } from 'lucide-react';
import { SourceFooter } from '@/components/source-footer';
import { sumsQuery } from '@/lib/station-series-query';
import { formatStationValue, type ExtremeStat, type StationExtreme } from '@/lib/station-extremes';
import { FIRST_YEAR, shiftAnchor, spanDays, sumRange, type SumPeriod } from '@/lib/station-series';
import { anchorLabel, Choice, DateRange, Stepper } from './controls';

const ExtremesMap = lazy(() => import('@/components/maps/extremes-map').then(m => ({ default: m.ExtremesMap })));
export type SumMetric = 'temperature' | 'rain' | 'wind';
export type TempStat = 'avg' | 'min' | 'max';
export interface SumState { metric: SumMetric; period: SumPeriod; anchor: string; from: string; to: string; tempStat: TempStat; view: 'map' | 'table' }

const METRICS: { id: SumMetric; label: string; icon: LucideIcon }[] = [{ id: 'temperature', label: 'Temperatur', icon: Thermometer }, { id: 'rain', label: 'Niederschlag', icon: CloudRain }, { id: 'wind', label: 'Wind', icon: Wind }];
const PERIODS: { id: SumPeriod; label: string }[] = [{ id: 'now', label: 'Aktuell' }, { id: 'today', label: 'Heute' }, { id: 'yesterday', label: 'Gestern' }, { id: 'month', label: 'Monat' }, { id: 'year', label: 'Jahr' }, { id: 'custom', label: 'Frei' }];
const TEMP_STATS: { id: TempStat; label: string }[] = [{ id: 'avg', label: 'Mittel' }, { id: 'min', label: 'Minimum' }, { id: 'max', label: 'Maximum' }];
const DAY = new Intl.DateTimeFormat('de-CH', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' });
const dayLabel = (day: string) => DAY.format(Date.parse(`${day}T12:00:00Z`));
const cell = (v: number | null | undefined, stat: ExtremeStat) => typeof v === 'number' && Number.isFinite(v) ? formatStationValue(v, stat) : '–';

/** Summen aller Stationen: Karte oder Tabelle; «Aktuell» zeigt die Livewerte, alle anderen Zeiträume Tagessummen. */
export function StationSums({ live, state, today, onChange }: { live: StationExtreme[]; state: SumState; today: string; onChange: (patch: Partial<SumState>) => void }) {
  const { metric, period, anchor, from, to, tempStat, view } = state;
  const now = period === 'now';
  const range = now ? { from: today, to: today } : sumRange(period, today, anchor, from, to);
  const sums = useQuery({ ...sumsQuery(range.from, range.to), enabled: !now, placeholderData: keepPreviousData });
  // Dieselbe Kartenform wie die Live-Messwerte: Mittel, Minimum und Maximum belegen die Temperaturfelder, Summe und Böe ihre eigenen.
  const rows: StationExtreme[] = now ? live : (sums.data?.stations ?? []).map(s => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, source: s.source, current: s.tempAvg, min: s.tempMin, max: s.tempMax, rain: s.rain, gust: s.gust }));
  const stat: ExtremeStat = metric === 'rain' ? (now ? 'rainRate' : 'rain') : metric === 'wind' ? (now ? 'wind' : 'gust') : now || tempStat === 'avg' ? 'current' : tempStat;
  const shown = rows.filter(r => typeof r[stat] === 'number' && Number.isFinite(r[stat])).sort((a, b) => (stat === 'min' ? 1 : -1) * ((b[stat] ?? 0) - (a[stat] ?? 0)));
  const step = period === 'month' || period === 'year' ? period : null;
  const first = `${FIRST_YEAR}-01-01`, cut = step === 'month' ? 7 : 4;
  const what = metric === 'rain' ? (now ? 'Niederschlag aktuell' : 'Niederschlagssumme') : metric === 'wind' ? (now ? 'Wind aktuell' : 'Stärkste Böe') : now ? 'Temperatur aktuell' : tempStat === 'avg' ? 'Mittlere Temperatur' : tempStat === 'min' ? 'Tiefste Temperatur' : 'Höchste Temperatur';
  const when = now ? '' : step ? anchorLabel(step, anchor) : range.from === range.to ? dayLabel(range.from) : `${dayLabel(range.from)} bis ${dayLabel(range.to)}`;
  const pending = !now && sums.isPending, failed = !now && sums.data?.failed === true;
  const note = pending ? 'Messwerte werden geladen …' : failed ? 'Die Messwerte sind momentan nicht erreichbar.' : shown.length ? '' : 'Für diesen Zeitraum liegen keine Messwerte vor.';
  const columns: { stat: ExtremeStat; label: string }[] = now
    ? [{ stat: 'current', label: 'Temperatur' }, { stat: 'wind', label: 'Wind' }, { stat: 'rainRate', label: 'Niederschlag' }]
    : [{ stat: 'current', label: 'Mittel' }, { stat: 'min', label: 'Min' }, { stat: 'max', label: 'Max' }, { stat: 'rain', label: 'Regen' }, { stat: 'gust', label: 'Böe' }];
  return <section aria-label="Summen">
    <div className="rounded-md bg-card p-3 shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div role="group" aria-label="Messgrösse" className="flex gap-1">{METRICS.map(m => <Choice key={m.id} active={m.id === metric} label={m.label} onClick={() => onChange({ metric: m.id })}><m.icon className="size-4" /><span className={m.id === metric ? '' : 'hidden sm:inline'}>{m.label}</span></Choice>)}</div>
        <div role="group" aria-label="Ansicht" className="flex gap-1">
          <Choice active={view === 'map'} label="Karte" onClick={() => onChange({ view: 'map' })}><MapIcon className="size-4" /><span className="hidden sm:inline">Karte</span></Choice>
          <Choice active={view === 'table'} label="Tabelle" onClick={() => onChange({ view: 'table' })}><Table2 className="size-4" /><span className="hidden sm:inline">Tabelle</span></Choice>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3">
        <div role="group" aria-label="Zeitraum" className="flex gap-1 overflow-x-auto">{PERIODS.map(p => <Choice key={p.id} active={p.id === period} onClick={() => onChange({ period: p.id })}>{p.label}</Choice>)}</div>
        {step && <Stepper label={anchorLabel(step, anchor)} canPrev={anchor.slice(0, cut) > first.slice(0, cut)} canNext={anchor.slice(0, cut) < today.slice(0, cut)}
          onPrev={() => onChange({ anchor: shiftAnchor(step, anchor, -1, today) })} onNext={() => onChange({ anchor: shiftAnchor(step, anchor, 1, today) })} />}
        {period === 'custom' && <DateRange from={from} to={to} max={today} onChange={(f, t) => onChange({ from: f, to: t })} />}
        {metric === 'temperature' && !now && view === 'map' && <div role="group" aria-label="Temperaturwert" className="flex gap-1">{TEMP_STATS.map(t => <Choice key={t.id} active={t.id === tempStat} onClick={() => onChange({ tempStat: t.id })}>{t.label}</Choice>)}</div>}
      </div>
    </div>
    <h2 className="px-1 py-3 text-sm font-semibold" data-testid="sums-heading">{what}{when ? <span className="font-normal text-muted-foreground"> · {when}</span> : null}</h2>
    {view === 'map' ? <div className="relative h-[min(65svh,640px)] min-h-80 overflow-hidden rounded-md border border-border bg-muted shadow-md">
      <Suspense fallback={<div role="status" className="grid h-full place-items-center text-sm text-muted-foreground">Karte wird geladen …</div>}>
        <ExtremesMap stations={shown} stat={stat} generousPadding regionStyle rainColorScale={Math.max(1, spanDays(range.from, range.to) / 4)} />
      </Suspense>
      {note && <p role="status" className="absolute inset-x-3 top-3 z-[500] rounded-md bg-card/95 p-3 text-center text-sm">{note}</p>}
    </div> : <div className="overflow-x-auto rounded-md bg-card shadow-md">
      <table className="w-full min-w-[26rem] text-sm tabular-nums">
        <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th scope="col" className="px-3 py-2.5 font-medium">Station</th>{columns.map(c => <th key={c.stat} scope="col" className={`px-3 py-2.5 text-right font-medium ${c.stat === stat ? 'text-accent' : ''}`}>{c.label}</th>)}</tr></thead>
        <tbody>{(shown.length ? [...shown, ...rows.filter(r => !shown.includes(r))] : rows).map(r => <tr key={r.id} className="border-b border-border/60 last:border-0">
          <th scope="row" className="px-3 py-2.5 text-left font-semibold">{r.name}<span className="ml-1.5 text-[10px] font-normal text-muted-foreground">{r.source === 'meteoswiss' ? 'MCH' : 'OWT'}</span></th>
          {columns.map(c => <td key={c.stat} className={`px-3 py-2.5 text-right ${c.stat === stat ? 'font-semibold' : ''}`}>{cell(r[c.stat], c.stat)}</td>)}
        </tr>)}</tbody>
      </table>
      {note && <p role="status" className="p-4 text-center text-sm text-muted-foreground">{note}</p>}
    </div>}
    <SourceFooter data="eigene Stationen, MeteoSchweiz" {...(view === 'map' ? { map: true } : {})} className="mt-2" />
  </section>;
}
