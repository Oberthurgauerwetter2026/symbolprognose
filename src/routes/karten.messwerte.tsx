import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { Thermometer, Wind, Droplets } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { SourceFooter } from '@/components/source-footer';
import { getStationExtremes } from '@/lib/station-extremes.functions';
import { rankExtremes, STATION_STAT_LABELS, type ExtremeStat } from '@/lib/station-extremes';
import { APP_MANIFEST_LINK } from '@/lib/pwa-links';

const ExtremesMap = lazy(() => import('@/components/maps/extremes-map').then(m => ({ default: m.ExtremesMap })));
const readingsQuery = () => queryOptions({ queryKey: ['overview-stations'], queryFn: () => getStationExtremes(), staleTime: 60_000, refetchInterval: 120_000 });

export const Route = createFileRoute('/karten/messwerte')({
  ssr: false,
  loader: ({ context }) => context.queryClient.ensureQueryData(readingsQuery()),
  head: () => ({ meta: [
    { title: 'Live-Messwerte: Temperatur, Wind und Regen · Oberthurgauer Wetter' },
    { name: 'description', content: 'Aktuelle Temperaturen, stärkste Tagesböen und Tagesniederschlag der regionalen Wetterstationen im Oberthurgau.' },
    { property: 'og:title', content: 'Live-Messwerte · Oberthurgauer Wetter' },
    { property: 'og:description', content: 'Temperatur, Wind und Niederschlag der regionalen Wetterstationen auf einer Karte.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ], links: [APP_MANIFEST_LINK] }),
  component: StationReadingsPage,
});

function StationReadingsPage() {
  const { data: stations } = useSuspenseQuery(readingsQuery());
  const [metric, setMetric] = useState('temperature');
  const [temperatureStat, setTemperatureStat] = useState<ExtremeStat>('current');
  const stat = metric === 'wind' ? 'gust' : metric === 'rain' ? 'rain' : temperatureStat;
  const ranked = rankExtremes(stations, stat);
  return <DashboardLayout title="Live-Messwerte">
    <section aria-label="Messwertekarte" className="mx-auto max-w-6xl px-3 py-4 sm:px-8 sm:py-6">
      <Tabs value={metric} onValueChange={setMetric}>
        <TabsList aria-label="Messgrösse" className="grid h-12 w-full grid-cols-3 gap-1 bg-accent/10 p-1">
          <TabsTrigger value="temperature" className="h-10 gap-1.5 px-1 text-xs data-[state=active]:bg-accent data-[state=active]:text-accent-foreground sm:text-sm"><Thermometer className="size-4" />Temperatur</TabsTrigger>
          <TabsTrigger value="wind" className="h-10 gap-1.5 px-1 text-xs data-[state=active]:bg-accent data-[state=active]:text-accent-foreground sm:text-sm"><Wind className="size-4" />Wind</TabsTrigger>
          <TabsTrigger value="rain" className="h-10 gap-1.5 px-1 text-xs data-[state=active]:bg-accent data-[state=active]:text-accent-foreground sm:text-sm"><Droplets className="size-4" />Niederschlag</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 py-3">
        <h2 className="text-sm font-semibold">{STATION_STAT_LABELS[stat]}</h2>
        {metric === 'temperature' && <div role="group" aria-label="Temperaturzeitraum" className="flex gap-1">
          {([{ stat: 'current', label: 'Jetzt' }, { stat: 'min', label: 'Minimum' }, { stat: 'max', label: 'Maximum' }] as const).map(option => <Button key={option.stat} size="sm" variant="ghost" aria-pressed={temperatureStat === option.stat} onClick={() => setTemperatureStat(option.stat)} className={temperatureStat === option.stat ? 'bg-accent/10 text-accent' : 'text-muted-foreground'}>{option.label}</Button>)}
        </div>}
      </div>
      <div className="relative h-[min(65svh,640px)] min-h-80 overflow-hidden rounded-md border border-border bg-muted">
        <Suspense fallback={<div role="status" className="grid h-full place-items-center text-sm text-muted-foreground">Karte wird geladen …</div>}><ExtremesMap stations={ranked} stat={stat} generousPadding /></Suspense>
        {!ranked.length && <p role="status" className="absolute inset-x-3 top-3 z-[500] rounded-md bg-card/95 p-3 text-center text-sm">Momentan keine Messwerte verfügbar.</p>}
      </div>
      <SourceFooter data="eigene Stationen, MeteoSchweiz" className="mt-2">{' · Karte: © '}<a href="https://www.swisstopo.admin.ch/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">swisstopo</a></SourceFooter>
    </section>
  </DashboardLayout>;
}