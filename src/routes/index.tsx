import { createFileRoute, Link, useHydrated } from '@tanstack/react-router';
import { queryOptions, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { getMorphCard, setMorphCard } from '@/lib/card-morph';
import { describeHomeClick, rememberHomeAnchor, restoreHomePosition, takeHomeReturn, type HomeAnchor } from '@/lib/home-return';
import { ArrowUpRight, MapPin, Search, Droplets, Satellite, Snowflake } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { WeatherReportView } from '@/components/weather-report-view';
import { OverviewWeatherSymbol } from '@/components/overview-weather-symbol';
import { OverviewHourlyForecast } from '@/components/overview-hourly-forecast';
import { LocationSearch } from '@/components/location-search';
import { TickerWidget } from '@/components/ticker/ticker-view';
import { LazyRegionMap } from '@/components/maps/lazy-maps';
import { MapSkeleton } from '@/components/maps/map-skeleton';
import { useIsDesktop } from '@/hooks/use-desktop';
import { listTickerPosts } from '@/lib/ticker.functions';
import { visiblePosts } from '@/lib/ticker';
import { reverseGeocode } from '@/lib/weather';
import { weatherReportQuery } from '@/lib/weather-report.functions';
import { getStationExtremes } from '@/lib/station-extremes.functions';
import { nearestLiveStation } from '@/lib/weather-overview';
import { listWarnings } from '@/lib/warnings.functions';
import { SPOTS } from '@/data/spots';
import { APP_MANIFEST_LINK } from '@/lib/pwa-links';
import { LivePreview } from '@/components/live-preview';
import { RadarPreview, SatellitePreview, StationPreview, WarningPreview, WindPreview } from '@/components/tile-previews';

const stationsQuery = () => queryOptions({ queryKey: ['overview-stations'], queryFn: () => getStationExtremes(), staleTime: 60000, refetchInterval: 120000 });
const warningsQuery = () => queryOptions({ queryKey: ['overview-warnings'], queryFn: () => listWarnings(), staleTime: 30000, refetchInterval: 60000 });

const tickerQuery = () => queryOptions({ queryKey: ['ticker'], queryFn: () => listTickerPosts(), refetchInterval: 60000, staleTime: 30000 });

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    const [ticker] = await Promise.all([
      // Ticker reist als Loader-Daten mit, damit er schon in der ersten Auslieferung steht; ein Ausfall blockiert die Startseite nicht.
      context.queryClient.fetchQuery(tickerQuery()).catch(() => null),
      context.queryClient.ensureQueryData(stationsQuery()),
      context.queryClient.ensureQueryData(warningsQuery()),
      context.queryClient.ensureQueryData(weatherReportQuery()),
    ]);
    return { ticker };
  },
  head: () => ({ meta: [
    { title: 'Oberthurgauer Wetter · Wetter für deine Region' },
    { name: 'description', content: 'Aktuelle Temperaturen in deiner Nähe, Radar, Wind, Warnungen und der aktuelle Wetterbericht für den Oberthurgau.' },
    { property: 'og:title', content: 'Oberthurgauer Wetter · Wetter für deine Region' },
    { property: 'og:description', content: 'Lokale Messwerte, Wetterwarnungen, Animationen und Wetterbericht auf einen Blick.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ], links: [APP_MANIFEST_LINK] }),
  component: WeatherOverview,
});

function WeatherOverview() {
  const { data: stations } = useSuspenseQuery(stationsQuery());
  const { data: warnings } = useSuspenseQuery(warningsQuery());
  const { data: report } = useSuspenseQuery(weatherReportQuery());
  const [location, setLocation] = useState<{ name: string; lat: number; lon: number } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const locationRequest = useRef(0);
  const [morph, setMorph] = useState<string | null>(() => getMorphCard());
  const openCard = (path: string) => { setMorphCard(path); flushSync(() => setMorph(path)); };
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const nearest = location ? nearestLiveStation(stations, location.lat, location.lon) : null;
  const station = nearest?.station;
  function locate() {
    const request = ++locationRequest.current;
    setLocationError('');
    if (!navigator.geolocation) { setLocationError('Standort nicht verfügbar. Bitte einen Ort wählen.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async p => {
      if (request !== locationRequest.current) return;
      const next = { name: 'Aktueller Standort', lat: p.coords.latitude, lon: p.coords.longitude };
      setLocation(next); setLocating(false);
      const name = await reverseGeocode(next.lat, next.lon);
      if (request === locationRequest.current) setLocation({ ...next, name });
    }, () => { if (request !== locationRequest.current) return; setLocating(false); setLocationError('Standort nicht freigegeben. Bitte einen Ort suchen.'); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('embed')) { window.location.replace(`/embed/lokal${window.location.search}`); return; }
    // Desktop zeigt keinen Standortblock mehr – dort keine Standortabfrage auslösen.
    if (!window.matchMedia('(min-width: 1024px)').matches) locate();
    return () => { locationRequest.current++; };
  }, []);
  // Nach dem Schliessen einer Kachel wieder an die Stelle, an der sie geöffnet wurde.
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingReturn = useRef<HomeAnchor | null>(null);
  useLayoutEffect(() => {
    const target = takeHomeReturn() ?? pendingReturn.current;
    const root = rootRef.current;
    if (!target || !root) return;
    pendingReturn.current = target;
    return restoreHomePosition(root, target, () => { pendingReturn.current = null; });
  }, []);
  const warningCount = warnings.warnings.length;
  const desktop = useIsDesktop();
  // Die Karte braucht den Browser, ihr Rahmen und der Ticker stehen schon in der ersten Auslieferung.
  const hydrated = useHydrated();
  const loaded = Route.useLoaderData();
  const ticker = useQuery({ ...tickerQuery(), ...(loaded.ticker ? { initialData: loaded.ticker } : {}) });
  const tickerWidget = ticker.data && <div className="weather-surface" style={{ '--accent': 'var(--tile-dark)', '--accent-strong': 'color-mix(in srgb, #ffffff 16%, var(--tile-dark))' } as CSSProperties}><TickerWidget posts={visiblePosts(ticker.data, Date.now())} /></div>;
  const tile = (path: string, extra = '') => `weather-product group${extra}${morph === path ? ' morph-card' : ''}`;
  const title = (text: string, hint: string) => <div className="p-3 sm:p-4"><h2 className="flex items-center justify-between gap-1 font-semibold">{text}<ArrowUpRight className="size-4 shrink-0 text-accent" /></h2><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div>;
  const image = (preview: ReactNode) => <div className="weather-product-image">{preview}</div>;
  const iconPreview = (icon: ReactNode) => <div className="grid aspect-[1.45] place-items-center bg-(--overview-station) text-accent [&_svg]:size-10">{icon}</div>;
  const radarTile = (extra = '') => <Link to="/karten/radar" viewTransition onClick={() => openCard('/karten/radar')} className={tile('/karten/radar', extra)} aria-label="Radar und Nowcast öffnen">
    {image(<RadarPreview />)}
    {title('Radar', 'Messung & Nowcast')}
  </Link>;
  const windTile = <Link to="/karten/wind" viewTransition onClick={() => openCard('/karten/wind')} className={tile('/karten/wind')} aria-label="Windanimation öffnen">
    {image(<WindPreview />)}
    {title('Windanimation', 'Wind & Böen')}
  </Link>;
  const warnTile = <Link to="/karten/warnungen" viewTransition onClick={() => openCard('/karten/warnungen')} className={tile('/karten/warnungen')}>
    {image(<WarningPreview warnings={warnings.warnings} />)}
    {title('Warnungen', warnings.warning ? 'Momentan nicht verfügbar' : warningCount ? `${warningCount} aktive Meldungen` : 'Keine aktiven Warnungen')}
  </Link>;
  const stationTile = <Link to="/karten/messwerte" viewTransition onClick={() => openCard('/karten/messwerte')} className={tile('/karten/messwerte')} aria-label="Live-Messwerte öffnen">
    {image(<StationPreview stations={stations} />)}
    {title('Live-Messwerte', 'Temperatur · Wind · Regen')}
  </Link>;
  return <DashboardLayout title="Oberthurgauer Wetter" subtitle="Wetter für deine Region" headerAction={<Button size="icon" variant="ghost" className="size-11 lg:hidden [&_svg]:size-7" title="Weiteren Ort suchen" aria-label="Weiteren Ort suchen" aria-expanded={searchOpen} onClick={() => setSearchOpen(open => !open)}><Search /></Button>}>
    <div ref={rootRef} onClickCapture={event => rememberHomeAnchor(describeHomeClick(event.currentTarget, event.target))} className="mx-auto max-w-6xl px-4 pb-8 pt-5 sm:px-8 sm:pt-8 lg:max-w-7xl">
     <div className="lg:grid lg:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)] lg:items-stretch lg:gap-6">
      <div className="min-w-0 lg:flex lg:flex-col lg:pb-6">
      <section aria-label="Wetter an deinem Ort" className="pb-6 sm:pb-8 lg:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><MapPin className="size-4 shrink-0" /><h1 className="min-w-0 break-words font-display text-2xl font-semibold sm:text-4xl">{location?.name ?? (locating ? 'Standort wird ermittelt …' : 'Ort wählen')}</h1></div>
            <div className="mt-1 flex items-baseline"><span className="font-display text-4xl font-semibold tabular-nums">{station?.current != null ? `${station.current.toFixed(1)}°` : '—'}</span></div>
            <p className="mt-2 text-xs text-muted-foreground">{station && nearest ? `Messstation ${station.name} · ${nearest.distance.toFixed(1)} km entfernt` : 'Momentan keine aktuelle Messung verfügbar.'}</p>
            {locationError && <p role="status" className="mt-2 text-xs text-destructive">{locationError}</p>}
          </div>
          <OverviewWeatherSymbol location={location} />
        </div>
        {searchOpen && <div className="weather-surface relative z-30 mt-3 rounded-md bg-card p-3"><LocationSearch onSelect={place => { locationRequest.current++; setLocation({ name: place.name, lat: place.latitude, lon: place.longitude }); setLocating(false); setLocationError(''); setSearchOpen(false); }} /><div className="mt-3 flex flex-wrap gap-1">{SPOTS.map(spot => <Button key={spot.id} size="sm" variant="ghost" onClick={() => { locationRequest.current++; setLocation({ name: spot.name, lat: spot.lat, lon: spot.lon }); setLocating(false); setLocationError(''); setSearchOpen(false); }}>{spot.name}</Button>)}</div></div>}
        <OverviewHourlyForecast location={location} onOpen={() => openCard('/karten/lokal')} morph={morph === '/karten/lokal'} />
      </section>

      <section aria-label="Symbolprognose der Region" className="weather-surface mb-6 flex-1 rounded-lg border border-border bg-card p-2 shadow-(--tile-dark-shadow) sm:p-4 lg:mb-0">
        {hydrated ? <Suspense fallback={<MapSkeleton regionHeight />}><LazyRegionMap search={desktop} /></Suspense> : <MapSkeleton regionHeight />}
      </section>
      </div>
      <aside aria-label="Aktuell" className="hidden min-w-0 flex-col gap-4 pb-6 lg:flex">
        {radarTile(' flex flex-1 flex-col [&_.weather-product-image]:aspect-auto! [&_.weather-product-image]:min-h-44 [&_.weather-product-image]:flex-1')}
        <WeatherReportView {...report} />
        {(!hydrated || desktop) && tickerWidget}
      </aside>
     </div>

      <section aria-label="Wetterprodukte" className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:hidden">
        {radarTile()}{windTile}{warnTile}{stationTile}
      </section>
      <div className="lg:hidden"><WeatherReportView {...report} />{(!hydrated || !desktop) && tickerWidget && <div className="mt-6">{tickerWidget}</div>}</div>

      <section aria-label="Weitere Wetterprodukte" className="hidden pb-6 lg:block"><h2 className="mb-4 text-lg font-semibold">Weitere Wetterprodukte</h2><div className="grid grid-cols-3 gap-4 [&>a>div:first-child]:aspect-[1.5]!">
        {stationTile}{windTile}{warnTile}
        <Link to="/karten/satellit" viewTransition onClick={() => openCard('/karten/satellit')} className={tile('/karten/satellit')}>{image(<SatellitePreview />)}{title('Satellit', 'Wolken über der Schweiz')}</Link>
        <Link to="/karten/niederschlag" viewTransition onClick={() => openCard('/karten/niederschlag')} className={tile('/karten/niederschlag')}>{image(desktop && <LivePreview src="/embed/niederschlag?clean=1" title="Niederschlagssummen" />)}{title('Regen & Schnee', 'Summen: gefallen und erwartet')}</Link>
        <Link to="/vertikalschnitt" viewTransition onClick={() => openCard('/vertikalschnitt')} className={tile('/vertikalschnitt')}>{iconPreview(<Snowflake />)}{title('SnowCast', 'Schneefallgrenze im Schnitt')}</Link>
      </div></section>
      <section className="py-6 lg:hidden"><h2 className="mb-4 text-lg font-semibold">Mehr Wetter</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Button asChild variant="outline" className="weather-dark h-14 justify-between px-3"><Link to="/karten/satellit"><span className="flex items-center gap-2"><Satellite />Satellit</span><ArrowUpRight /></Link></Button>
        <Button asChild variant="outline" className="weather-dark h-14 justify-between px-3"><Link to="/karten/niederschlag"><span className="flex items-center gap-2"><Droplets />Regen & Schnee</span><ArrowUpRight /></Link></Button>
        <Button asChild variant="outline" className="weather-dark h-14 justify-between px-3"><Link to="/karten/region"><span className="flex items-center gap-2"><MapPin />Regionsprognose</span><ArrowUpRight /></Link></Button>
        <Button asChild variant="outline" className="weather-dark h-14 justify-between px-3"><Link to="/vertikalschnitt"><span className="flex items-center gap-2"><Snowflake />SnowCast</span><ArrowUpRight /></Link></Button>
      </div></section>
      <footer className="flex flex-wrap justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground"><span>Oberthurgauer Wetter · Messwerte: WeatherHub, MeteoSchweiz · Karten: swisstopo</span><Link to="/admin/bericht" className="text-accent">Wetterredaktion</Link></footer>
    </div>
  </DashboardLayout>;
}
