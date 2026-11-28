import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { ChartLine, Sigma } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StationCharts, type ChartState } from '@/components/stations/station-charts';
import { StationSums, type SumMetric, type SumState, type TempStat } from '@/components/stations/station-sums';
import { getStationExtremes } from '@/lib/station-extremes.functions';
import { zurichDay } from '@/lib/station-extremes';
import { SERIES_METRICS, SERIES_RANGES, SUM_PERIODS, type SeriesMetric, type SeriesRange, type SumPeriod } from '@/lib/station-series';
import { APP_MANIFEST_LINK } from '@/lib/pwa-links';
import { initialSumMetric } from '@/lib/station-view';

const stationsQuery = () => queryOptions({ queryKey: ['overview-stations'], queryFn: () => getStationExtremes(), staleTime: 60_000, refetchInterval: 120_000 });

/** Auswahl lebt in der Adresse: so lässt sich eine Grafik oder Summe als Link weitergeben. */
type Search = { tab?: 'grafiken' | 'summen'; st?: string; m?: SeriesMetric; r?: SeriesRange; a?: string; f?: string; t?: string; sm?: SumMetric; sp?: SumPeriod; sa?: string; sf?: string; su?: string; ss?: TempStat; sv?: 'map' | 'table' };
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | undefined => list.find(item => item === v);
function parseSearch(raw: Record<string, unknown>): Search {
  const s: Search = {};
  const tab = oneOf(raw['tab'], ['grafiken', 'summen'] as const); if (tab) s.tab = tab;
  if (typeof raw['st'] === 'string' && /^[0-9a-f-]{36}$/.test(raw['st'])) s.st = raw['st'];
  const m = oneOf(raw['m'], SERIES_METRICS); if (m) s.m = m;
  const r = oneOf(raw['r'], SERIES_RANGES); if (r) s.r = r;
  const sm = oneOf(raw['sm'], ['temperature', 'rain', 'wind'] as const); if (sm) s.sm = sm;
  const sp = oneOf(raw['sp'], SUM_PERIODS); if (sp) s.sp = sp;
  const ss = oneOf(raw['ss'], ['avg', 'min', 'max'] as const); if (ss) s.ss = ss;
  const sv = oneOf(raw['sv'], ['map', 'table'] as const); if (sv) s.sv = sv;
  for (const key of ['a', 'f', 't', 'sa', 'sf', 'su'] as const) { const v = raw[key]; if (isDay(v)) s[key] = v; }
  return s;
}

export const Route = createFileRoute('/karten/stationen')({
  ssr: false,
  validateSearch: parseSearch,
  // Nicht warten: Kopfzeile und Bedienung stehen sofort, die Messwerte füllen nach.
  loader: ({ context }) => { void context.queryClient.prefetchQuery(stationsQuery()); },
  head: () => ({ meta: [
    { title: 'Messwerte: Grafiken und Summen der Stationen · Oberthurgauer Wetter' },
    { name: 'description', content: 'Verlauf von Temperatur, Feuchte, Luftdruck, Niederschlag und Wind jeder Wetterstation im Oberthurgau, dazu Summen und Extreme für Tag, Monat und Jahr.' },
    { property: 'og:title', content: 'Messwerte · Oberthurgauer Wetter' },
    { property: 'og:description', content: 'Grafiken jeder Wetterstation und Summen der Region für Tag, Monat und Jahr.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ], links: [APP_MANIFEST_LINK] }),
  component: StationDataPage,
});

function StationDataPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useQuery(stationsQuery());
  const stations = data ?? [];
  const today = zurichDay(Date.now());
  const set = (patch: Search) => { void navigate({ to: '.', search: prev => ({ ...prev, ...patch }), replace: true, resetScroll: false }); };
  const tab = search.tab ?? 'grafiken';
  const fallback = stations.find(s => s.name === 'Amriswil') ?? stations[0];
  const charts: ChartState = { stationId: stations.some(s => s.id === search.st) ? search.st ?? '' : fallback?.id ?? '', metric: search.m ?? 'temperature', range: search.r ?? 'day', anchor: search.a ?? today, from: search.f ?? today, to: search.t ?? today };
  const sums: SumState = { metric: initialSumMetric(search.sm), period: search.sp ?? 'today', anchor: search.sa ?? today, from: search.sf ?? today, to: search.su ?? today, tempStat: search.ss ?? 'avg', view: search.sv ?? 'map' };
  return <DashboardLayout title="Messwerte">
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-8 sm:py-6">
      <Tabs value={tab} onValueChange={value => set({ tab: value === 'summen' ? 'summen' : 'grafiken' })}>
        <TabsList aria-label="Ansicht" className="mb-4 grid h-12 w-full grid-cols-2 gap-1 bg-accent/10 p-1">
          <TabsTrigger value="grafiken" className="h-10 gap-1.5 text-sm data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><ChartLine className="size-4" />Grafiken</TabsTrigger>
          <TabsTrigger value="summen" className="h-10 gap-1.5 text-sm data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><Sigma className="size-4" />Summen</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'grafiken'
        ? <StationCharts stations={stations} state={charts} today={today} onChange={p => set({ ...(p.stationId ? { st: p.stationId } : {}), ...(p.metric ? { m: p.metric } : {}), ...(p.range ? { r: p.range } : {}), ...(p.anchor ? { a: p.anchor } : {}), ...(p.from ? { f: p.from } : {}), ...(p.to ? { t: p.to } : {}) })} />
        : <StationSums live={stations} state={sums} today={today} onChange={p => set({ ...(p.metric ? { sm: p.metric } : {}), ...(p.period ? { sp: p.period } : {}), ...(p.anchor ? { sa: p.anchor } : {}), ...(p.from ? { sf: p.from } : {}), ...(p.to ? { su: p.to } : {}), ...(p.tempStat ? { ss: p.tempStat } : {}), ...(p.view ? { sv: p.view } : {}) })} />}
    </div>
  </DashboardLayout>;
}
