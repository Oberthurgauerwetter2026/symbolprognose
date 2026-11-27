import { createFileRoute, Link } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { getMorphCard, setMorphCard } from '@/lib/card-morph';
import { ArrowUpRight, MapPin, Search, Thermometer, Wind, Droplets, Play, ShieldCheck, TriangleAlert, Satellite, Snowflake } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { WeatherReportView } from '@/components/weather-report-view';
import { OverviewWeatherSymbol } from '@/components/overview-weather-symbol';
import { LocationSearch } from '@/components/location-search';
import { reverseGeocode } from '@/lib/weather';
import { weatherReportQuery } from '@/lib/weather-report.functions';
import { getStationExtremes } from '@/lib/station-extremes.functions';
import { nearestLiveStation } from '@/lib/weather-overview';
import { listWarnings } from '@/lib/warnings.functions';
import { SPOTS } from '@/data/spots';
import { HAZARDS } from '@/lib/warnings-config';
import { APP_MANIFEST_LINK } from '@/lib/pwa-links';
import radarAsset from '@/assets/overview-radar.asset.json';
import windAsset from '@/assets/overview-wind.asset.json';

const stationsQuery = () => queryOptions({ queryKey: ['overview-stations'], queryFn: () => getStationExtremes(), staleTime: 60000, refetchInterval: 120000 });
const warningsQuery = () => queryOptions({ queryKey: ['overview-warnings'], queryFn: () => listWarnings(), staleTime: 30000, refetchInterval: 60000 });

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(stationsQuery()),
      context.queryClient.ensureQueryData(warningsQuery()),
      context.queryClient.ensureQueryData(weatherReportQuery()),
    ]);
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
    locate();
    return () => { locationRequest.current++; };
  }, []);
  const warningCount = warnings.warnings.length;
  return <DashboardLayout title="Oberthurgauer Wetter" subtitle="Wetter für deine Region" headerAction={<Button size="icon" variant="ghost" className="size-11 [&_svg]:size-7" title="Weiteren Ort suchen" aria-label="Weiteren Ort suchen" aria-expanded={searchOpen} onClick={() => setSearchOpen(open => !open)}><Search /></Button>}>
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-5 sm:px-8 sm:pt-8">
      <section aria-label="Wetter an deinem Ort" className="pb-6 sm:pb-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><MapPin className="size-4 shrink-0" /><h1 className="min-w-0 break-words font-display text-2xl font-semibold sm:text-4xl">{location?.name ?? (locating ? 'Standort wird ermittelt …' : 'Ort wählen')}</h1></div>
          </div>
          <OverviewWeatherSymbol location={location} />
        </div>
        {searchOpen && <div className="weather-surface relative z-30 mt-3 rounded-md bg-card p-3"><LocationSearch onSelect={place => { locationRequest.current++; setLocation({ name: place.name, lat: place.latitude, lon: place.longitude }); setLocating(false); setLocationError(''); setSearchOpen(false); }} /><div className="mt-3 flex flex-wrap gap-1">{SPOTS.map(spot => <Button key={spot.id} size="sm" variant="ghost" onClick={() => { locationRequest.current++; setLocation({ name: spot.name, lat: spot.lat, lon: spot.lon }); setLocating(false); setLocationError(''); setSearchOpen(false); }}>{spot.name}</Button>)}</div></div>}
        <div className="mt-5">
          <div className="min-w-0">
            <div className="mt-3 flex items-baseline gap-3"><span className="font-display text-6xl font-semibold tabular-nums">{station?.current != null ? `${station.current.toFixed(1)}°` : '—'}</span></div>
            <p className="mt-2 text-xs text-muted-foreground">{station && nearest ? `Messstation ${station.name} · ${nearest.distance.toFixed(1)} km entfernt` : 'Momentan keine aktuelle Messung verfügbar.'}</p>
            {locationError && <p role="status" className="mt-2 text-xs text-destructive">{locationError}</p>}
          </div>
        </div>
        {location && <Button asChild variant="link" className="mt-3 h-auto px-0 text-accent"><Link to="/karten/lokal" search={{ lat: location.lat, lon: location.lon, name: location.name }}>Prognose für {location.name}<ArrowUpRight /></Link></Button>}
      </section>

      <section aria-label="Wetterprodukte" className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Link to="/karten/radar" viewTransition onClick={() => openCard('/karten/radar')} className={`weather-product group${morph === '/karten/radar' ? ' morph-card' : ''}`} aria-label="Radar und Nowcast öffnen">
          <div className="weather-product-image"><img src={radarAsset.url} alt="Kartenausschnitt Bodensee und Alpstein" /><div className="weather-play"><Play className="size-5" /></div></div>
          <div className="p-3 sm:p-4"><h2 className="flex items-center justify-between gap-1 font-semibold">Radar<ArrowUpRight className="size-4 shrink-0 text-accent" /></h2><p className="mt-1 text-xs text-muted-foreground">Messung & Nowcast</p></div>
        </Link>
        <Link to="/karten/wind" viewTransition onClick={() => openCard('/karten/wind')} className={`weather-product group${morph === '/karten/wind' ? ' morph-card' : ''}`} aria-label="Windanimation öffnen">
          <div className="weather-product-image"><img src={windAsset.url} alt="Vorschau der regionalen Windkarte" /><div className="weather-play"><Wind className="size-5" /></div></div>
          <div className="p-3 sm:p-4"><h2 className="flex items-center justify-between gap-1 font-semibold">Windanimation<ArrowUpRight className="size-4 shrink-0 text-accent" /></h2><p className="mt-1 text-xs text-muted-foreground">Wind & Böen</p></div>
        </Link>
        <Link to="/karten/warnungen" viewTransition onClick={() => openCard('/karten/warnungen')} className={`weather-product${morph === '/karten/warnungen' ? ' morph-card' : ''}`}>
          <div className="weather-warning-preview"><div className="flex items-center gap-2 text-accent">{warningCount ? <TriangleAlert className="size-8" /> : <ShieldCheck className="size-8" />}<span className="text-3xl font-semibold">{warnings.warning ? '—' : warningCount}</span></div><div className="mt-3 flex flex-wrap gap-1.5">{HAZARDS.slice(0,4).map(h => <h.icon key={h.id} className="size-5 text-accent/70" />)}</div></div>
          <div className="p-3 sm:p-4"><h2 className="flex items-center justify-between gap-1 font-semibold">Warnungen<ArrowUpRight className="size-4 shrink-0 text-accent" /></h2><p className="mt-1 text-xs text-muted-foreground">{warnings.warning ? 'Momentan nicht verfügbar' : warningCount ? `${warningCount} aktive Meldungen` : 'Keine aktiven Warnungen'}</p></div>
        </Link>
        <Link to="/karten/messwerte" viewTransition onClick={() => openCard('/karten/messwerte')} className={`weather-product${morph === '/karten/messwerte' ? ' morph-card' : ''}`} aria-label="Live-Messwerte öffnen">
          <div className="weather-station-preview"><Thermometer className="size-7 text-accent" /><div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm tabular-nums">{stations.filter(s => s.current != null).slice(0,4).map(s => <span key={s.id} className="truncate">{s.name} <strong>{s.current?.toFixed(1)}°</strong></span>)}</div></div>
          <div className="p-3 sm:p-4"><h2 className="flex items-center justify-between gap-1 font-semibold">Live-Messwerte<ArrowUpRight className="size-4 shrink-0 text-accent" /></h2><p className="mt-1 text-xs text-muted-foreground">Temperatur · Wind · Regen</p></div>
        </Link>
      </section>

      <WeatherReportView {...report} />
      <section className="py-6"><h2 className="mb-4 text-lg font-semibold">Mehr Wetter</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Button asChild variant="outline" className="weather-surface h-14 justify-between px-3"><Link to="/karten/satellit"><span className="flex items-center gap-2"><Satellite />Satellit</span><ArrowUpRight /></Link></Button>
        <Button asChild variant="outline" className="weather-surface h-14 justify-between px-3"><Link to="/karten/niederschlag"><span className="flex items-center gap-2"><Droplets />Regen & Schnee</span><ArrowUpRight /></Link></Button>
        <Button asChild variant="outline" className="weather-surface h-14 justify-between px-3"><Link to="/karten/region"><span className="flex items-center gap-2"><MapPin />Regionsprognose</span><ArrowUpRight /></Link></Button>
        <Button asChild variant="outline" className="weather-surface h-14 justify-between px-3"><Link to="/vertikalschnitt"><span className="flex items-center gap-2"><Snowflake />SnowCast</span><ArrowUpRight /></Link></Button>
      </div></section>
      <footer className="flex flex-wrap justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground"><span>Oberthurgauer Wetter · Messwerte: WeatherHub, MeteoSchweiz · Karten: swisstopo</span><Link to="/admin/bericht" className="text-accent">Wetterredaktion</Link></footer>
    </div>
  </DashboardLayout>;
}
