import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { WeatherIcon } from '@/components/weather-icons';
import { useOverviewForecast } from '@/components/use-overview-forecast';
import { upcomingWeatherSlots } from '@/lib/current-weather-slot';
import { isDayAtIso, weatherLabel } from '@/lib/weather';

export function OverviewHourlyForecast({ location, onOpen, morph }: {
  location: { name: string; lat: number; lon: number } | null;
  onOpen: () => void;
  morph: boolean;
}) {
  const forecast = useOverviewForecast(location);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  if (!location) return null;
  const data = forecast.data;
  const slots = data ? upcomingWeatherSlots(data.hourly.time, data.timezone, now) : [];
  return <Button asChild variant="ghost" className={`weather-dark mt-4 block h-auto w-full overflow-hidden rounded-md border border-border bg-card p-0 text-left text-foreground hover:bg-card hover:text-foreground${morph ? ' morph-card' : ''}`}>
    <Link to="/karten/lokal" search={{ lat: location.lat, lon: location.lon, name: location.name }} viewTransition onClick={onOpen} aria-label={`Ausführliche Lokalprognose für ${location.name} öffnen`}>
      <span className="flex items-center justify-between border-b border-border px-3 py-2 text-sm font-semibold">Nächste Stunden<ArrowUpRight className="size-4 text-accent" /></span>
      {data && slots.length ? <span className="flex touch-auto overflow-x-auto overscroll-x-contain">
        {slots.map(index => {
          const time = data.hourly.time[index];
          if (!time) return null;
          const code = data.hourly.weathercode[index];
          const temp = data.hourly.temperature_2m[index];
          const rain = data.hourly.precipitation[index];
          const mchCode = data.hourly.weathercode_mch?.[index];
          const validCode = typeof code === 'number' && Number.isFinite(code);
          return <span key={time} className="flex min-w-[76px] flex-1 flex-col items-center gap-1 border-r border-border px-2 py-3 text-center last:border-r-0">
            <span className="text-xs font-medium text-muted-foreground">{time.slice(11, 16)}</span>
            <span className="flex h-10 items-center [&_svg]:size-10!" role="img" aria-label={validCode ? weatherLabel(code) : 'Wetter nicht verfügbar'}>
              {validCode ? <WeatherIcon code={code} {...(mchCode !== undefined ? { mchCode } : {})} isDay={isDayAtIso(time, data.daily)} size={40} {...(typeof temp === 'number' && Number.isFinite(temp) ? { temp } : {})} {...(typeof rain === 'number' && Number.isFinite(rain) ? { precip: rain } : {})} /> : '—'}
            </span>
            <span className="text-base font-semibold tabular-nums">{typeof temp === 'number' && Number.isFinite(temp) ? `${Math.round(temp)}°` : '—'}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{typeof rain === 'number' && Number.isFinite(rain) ? rain > 0 ? `${rain.toFixed(1)} mm` : 'trocken' : '—'}</span>
          </span>;
        })}
      </span> : <span role="status" className="block px-3 py-5 text-sm text-muted-foreground">{forecast.isFetching ? 'Lokalprognose lädt …' : 'Stundenprognose momentan nicht verfügbar'}</span>}
    </Link>
  </Button>;
}