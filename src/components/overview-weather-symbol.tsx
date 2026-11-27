import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getAggregatedForecast } from '@/lib/forecast-aggregated.functions';
import { currentWeatherSlot } from '@/lib/current-weather-slot';
import { isDayAtIso, weatherLabel } from '@/lib/weather';
import { WeatherIcon } from '@/components/weather-icons';

export function OverviewWeatherSymbol({ location }: { location: { lat: number; lon: number } | null }) {
  const getForecast = useServerFn(getAggregatedForecast);
  const forecast = useQuery({
    queryKey: ['forecast', 'v13', location?.lat ?? 0, location?.lon ?? 0],
    queryFn: () => {
      if (!location) throw new Error('Kein Standort');
      return getForecast({ data: { lat: location.lat, lon: location.lon, v: 'v13' } });
    },
    enabled: location !== null,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
  const data = forecast.data;
  const index = data ? currentWeatherSlot(data.hourly.time, data.timezone) : null;
  const code = index !== null ? data?.hourly.weathercode[index] : undefined;
  const available = typeof code === 'number' && Number.isFinite(code) && data && index !== null;
  return <div className="flex w-24 shrink-0 flex-col items-center gap-1 text-foreground sm:w-28" role="img" aria-label={available ? `Wetter zur aktuellen Stunde: ${weatherLabel(code)}` : 'Wettersymbol nicht verfügbar'} title="Wetter zur aktuellen Stunde · Lokalprognose MeteoSchweiz / DWD, keine Radar- oder Satellitenauswertung">
    {available ? <WeatherIcon code={code} {...(data.hourly.weathercode_mch?.[index] !== undefined ? { mchCode: data.hourly.weathercode_mch[index] } : {})} isDay={isDayAtIso(data.hourly.time[index], data.daily)} size={72} /> : <span className="flex h-[72px] items-center text-2xl text-muted-foreground">—</span>}
    <span className="text-center text-xs text-muted-foreground">{available ? weatherLabel(code) : forecast.isFetching ? 'Wetter lädt …' : 'Nicht verfügbar'}</span>
  </div>;
}