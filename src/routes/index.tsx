import { createFileRoute, Link } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ArrowUpRight, LocateFixed, MapPin, Thermometer, Wind, Droplets, Play, ShieldCheck, TriangleAlert, Satellite, Snowflake } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { WeatherReportView } from '@/components/weather-report-view';
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
    { title: 'Oberthurgauer Wetter · Dein Wetter am Bodensee' },
    { name: 'description', content: 'Aktuelle Temperaturen in deiner Nähe, Radar, Wind, Warnungen und der aktuelle Wetterbericht für den Oberthurgau.' },
    { property: 'og:title', content: 'Oberthurgauer Wetter · Dein Wetter am Bodensee' },
    { property: 'og:description', content: 'Lokale Messwerte, Wetterwarnungen, Animationen und Wetterbericht auf einen Blick.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ], links: [APP_MANIFEST_LINK] }),
  component: WeatherOverview,
});

function WeatherOverview() {
  const { data: stations } = useSuspenseQuery(stationsQuery());
  const { data: warnings } = useSuspenseQuery(warningsQuery());
  const { data: report } = useSuspenseQuery(weatherReportQuery());
  const [location, setLocation] = useState({ name: 'Amriswil', lat: 47.5428, lon: 9.2871 });
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const nearest = nearestLiveStation(stations, location.lat, location.lon);
  const station = nearest?.station;
  function locate() {
    setLocationError('');
    if (!navigator.geolocation) { setLocationError('Standort nicht verfügbar. Bitte einen Ort wählen.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(p => {
      const next = { name: 'Mein Standort', lat: p.coords.latitude, lon: p.coords.longitude };
      setLocation(next); setLocating(false);
      try { localStorage.setItem('owt-overview-location', JSON.stringify(next)); } catch { /* optional */ }
    }, () => { setLocating(false); setLocationError('Standort nicht freigegeben. Bitte einen Ort wählen.'); }, { timeout: 10000, maximumAge: 300000 });
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('embed')) { window.location.replace(`/embed/lokal${window.location.search}`); return; }
    try {
      const saved = JSON.parse(localStorage.getItem('owt-overview-location') ?? 'null');
      if (saved && typeof saved.name === 'string' && Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) setLocation(saved);
    } catch { /* default regional place */ }
    navigator.permissions?.query({ name: 'geolocation' }).then(p => { if (p.state === 'granted') locate(); }).catch(() => {});
  }, []);
  const warningCount = warnings.warnings.length;
  return <DashboardLayout title="Oberthurgauer Wetter" subtitle="Oberthurgau · Bodensee · Alpstein">
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-5 sm:px-8 sm:pt-8">
      <section aria-label="Wetter an deinem Ort" className="pb-6 sm:pb-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0"><p className="text-xs font-semibold text-accent">Jetzt in deiner Nähe</p><h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Dein Wetter am Bodensee</h1></div>
          <Thermometer className="mt-2 size-7 shrink-0 text-accent" />
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><MapPin className="size-4 shrink-0 text-accent" /><label className="sr-only" htmlFor="overview-place">Ort wählen</label><select id="overview-place" aria-label="Ort wählen" value={location.name} onChange={e => {
              const spot = SPOTS.find(s => s.name === e.target.value);
              if (!spot) return;
              const next = { name: spot.name, lat: spot.lat, lon: spot.lon }; setLocation(next);
              try { localStorage.setItem('owt-overview-location', JSON.stringify(next)); } catch { /* optional */ }
            }} className="min-w-0 max-w-full rounded-md border border-border bg-card px-2 py-2 text-base font-medium">
              {!SPOTS.some(s => s.name === location.name) && <option>{location.name}</option>}{SPOTS.map(s => <option key={s.id}>{s.name}</option>)}
            </select><Button size="icon" variant="outline" title="Meinen Standort verwenden" aria-label="Meinen Standort verwenden" disabled={locating} onClick={locate}><LocateFixed className={locating ? 'animate-pulse' : ''} /></Button></div>
            <div className="mt-3 flex items-baseline gap-3"><span className="font-display text-6xl font-semibold tabular-nums">{station?.current != null ? `${station.current.toFixed(1)}°` : '—'}</span><span className="text-sm text-muted-foreground">Aktuelle Temperatur</span></div>
            <p className="mt-2 text-xs text-muted-foreground">{station ? `Messstation ${station.name} · ${nearest.distance.toFixed(1)} km entfernt` : 'Momentan keine aktuelle Messung verfügbar.'}</p>
            {locationError && <p role="status" className="mt-2 text-xs text-destructive">{locationError}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:border-t-0 sm:pt-0">
            <div><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wind className="size-4" />Stärkste Böe heute</p><p className="mt-1 text-xl font-semibold tabular-nums">{station?.gust != null ? Math.round(station.gust) : '—'} <span className="text-xs font-normal">km/h</span></p></div>
            <div><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Droplets className="size-4" />Regen heute</p><p className="mt-1 text-xl font-semibold tabular-nums">{station?.rain != null ? station.rain.toFixed(1) : '—'} <span className="text-xs font-normal">mm</span></p></div>
          </div>
        </div>
        <Button asChild variant="link" className="mt-3 h-auto px-0 text-accent"><Link to="/karten/lokal" search={{ lat: location.lat, lon: location.lon, name: location.name }}>Prognose für {location.name}<ArrowUpRight /></Link></Button>
      </section>

      <section aria-label="Wetterprodukte" className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Link to="/karten/radar" className="weather-product group" aria-label="Radar und Nowcast öffnen">
          <div className="weather-product-image"><img src={radarAsset.url} alt="Kartenausschnitt Bodensee und Alpstein" /><div className="weather-play"><Play className="size-5" /></div></div>
          <div className="p-3 sm:p-4"><h2 className="flex items-center justify-between gap-1 font-semibold">Radar<ArrowUpRight className="size-4 shrink-0 text-accent" /></h2><p className="mt-1 text-xs text-muted-foreground">Messung & Nowcast</p></div>
        </Link>
        <Link to="/karten/wind" className="weather-product group" aria-label="Windanimation öffnen">
          <div className="weather-product-image"><img src={windAsset.url} alt="Vorschau der regionalen Windkarte" /><div className="weather-play"><Wind className="size-5" /></div></div>
          <div className="p-3 sm:p-4"><h2 className="flex items-center justify-between gap-1 font-semibold">Windanimation<ArrowUpRight className="size-4 shrink-0 text-accent" /></h2><p className="mt-1 text-xs text-muted-foreground">Wind & Böen</p></div>
        </Link>
        <Link to="/karten/warnungen" className="weather-product">
          <div className="weather-warning-preview"><div className="flex items-center gap-2 text-accent">{warningCount ? <TriangleAlert className="size-8" /> : <ShieldCheck className="size-8" />}<span className="text-3xl font-semibold">{warnings.warning ? '—' : warningCount}</span></div><div className="mt-3 flex flex-wrap gap-1.5">{HAZARDS.slice(0,4).map(h => <h.icon key={h.id} className="size-5 text-accent/70" />)}</div></div>
          <div className="p-3 sm:p-4"><h2 className="flex items-center justify-between gap-1 font-semibold">Warnungen<ArrowUpRight className="size-4 shrink-0 text-accent" /></h2><p className="mt-1 text-xs text-muted-foreground">{warnings.warning ? 'Momentan nicht verfügbar' : warningCount ? `${warningCount} aktive Meldungen` : 'Keine aktiven Warnungen'}</p></div>
        </Link>
        <a href="https://live-wetterkarte.lovable.app" className="weather-product">
          <div className="weather-station-preview"><Thermometer className="size-7 text-accent" /><div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm tabular-nums">{stations.filter(s => s.current != null).slice(0,4).map(s => <span key={s.id} className="truncate">{s.name} <strong>{s.current?.toFixed(1)}°</strong></span>)}</div></div>
          <div className="p-3 sm:p-4"><h2 className="flex items-center justify-between gap-1 font-semibold">WeatherHub<ArrowUpRight className="size-4 shrink-0 text-accent" /></h2><p className="mt-1 text-xs text-muted-foreground">Live-Messwerte</p></div>
        </a>
      </section>

      <WeatherReportView {...report} />
      <section className="py-6"><h2 className="mb-4 text-lg font-semibold">Mehr Wetter</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Button asChild variant="outline" className="h-14 justify-between px-3"><Link to="/karten/satellit"><span className="flex items-center gap-2"><Satellite />Satellit</span><ArrowUpRight /></Link></Button>
        <Button asChild variant="outline" className="h-14 justify-between px-3"><Link to="/karten/niederschlag"><span className="flex items-center gap-2"><Droplets />Regen & Schnee</span><ArrowUpRight /></Link></Button>
        <Button asChild variant="outline" className="h-14 justify-between px-3"><Link to="/karten/region"><span className="flex items-center gap-2"><MapPin />Regionsprognose</span><ArrowUpRight /></Link></Button>
        <Button asChild variant="outline" className="h-14 justify-between px-3"><Link to="/vertikalschnitt"><span className="flex items-center gap-2"><Snowflake />SnowCast</span><ArrowUpRight /></Link></Button>
      </div></section>
      <footer className="flex flex-wrap justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground"><span>Oberthurgauer Wetter · Messwerte: WeatherHub, MeteoSchweiz · Karten: swisstopo</span><Link to="/admin/bericht" className="text-accent">Wetterredaktion</Link></footer>
    </div>
  </DashboardLayout>;
}
