import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getAggregatedForecast } from '@/lib/forecast-aggregated.functions';

export function useOverviewForecast(location: { lat: number; lon: number } | null) {
  const getForecast = useServerFn(getAggregatedForecast);
  return useQuery({
    queryKey: ['forecast', 'v13', location?.lat ?? 0, location?.lon ?? 0],
    queryFn: () => {
      if (!location) throw new Error('Kein Standort');
      return getForecast({ data: { lat: location.lat, lon: location.lon, v: 'v13' } });
    },
    enabled: location !== null,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}