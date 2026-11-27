import { useOverviewForecast } from '@/components/use-overview-forecast';
import { currentWeatherSlot } from '@/lib/current-weather-slot';
import { isDayAtIso, weatherLabel } from '@/lib/weather';
import { WeatherIcon } from '@/components/weather-icons';
import { useEffect, useState } from 'react';
import { overviewPrecipTrend } from '@/lib/overview-precip-trend';

export function OverviewWeatherSymbol({ location }: { location: { lat: number; lon: number } | null }) {
  const forecast = useOverviewForecast(location);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const data = forecast.data;
  const index = data ? currentWeatherSlot(data.hourly.time, data.timezone, now) : null;
  const code = index !== null ? data?.hourly.weathercode[index] : undefined;
  const available = typeof code === 'number' && Number.isFinite(code) && data && index !== null;
  const trend = data ? overviewPrecipTrend(data.hourly, data.timezone, now) : null;
  const phaseLabels = { rain: 'Regen', snow: 'Schnee', sleet: 'Schneeregen', 'freezing-rain': 'Gefrierender Regen' };
  const trendLabel = trend ? trend.phase === 'dry' ? 'Voraussichtlich trocken' : `${phaseLabels[trend.phase]} ${trend.time ? `ab ca. ${trend.time}` : 'erwartet'}` : forecast.isFetching ? 'Prognose lädt …' : 'Prognose nicht verfügbar';
  return <div className="flex w-28 shrink-0 flex-col items-center gap-1 text-foreground sm:w-40 [&_svg]:size-24 sm:[&_svg]:size-32" title="Aktuelles Wettersymbol und Ausblick · Lokalprognose MeteoSchweiz / DWD, keine Radar- oder Satellitenauswertung">
    <div role="img" aria-label={available ? `Wetter zur aktuellen Stunde: ${weatherLabel(code)}` : 'Wettersymbol nicht verfügbar'}>
    {available ? <WeatherIcon code={code} {...(data.hourly.weathercode_mch?.[index] !== undefined ? { mchCode: data.hourly.weathercode_mch[index] } : {})} isDay={isDayAtIso(data.hourly.time[index], data.daily)} size={96} /> : <span className="flex h-24 items-center text-2xl text-muted-foreground sm:h-32">—</span>}
    </div>
    <span className="text-center text-xs text-muted-foreground">{available ? weatherLabel(code) : forecast.isFetching ? 'Wetter lädt …' : 'Nicht verfügbar'}</span>
    <p role="status" className="mt-1 text-center text-xs font-medium leading-snug">{trendLabel}</p>
    {trend && <span className="text-center text-xs text-muted-foreground">Nächste 3 Stunden</span>}
  </div>;
}