import { queryOptions } from '@tanstack/react-query';
import { listTickerPosts } from '@/lib/ticker.functions';

/** Gleicher Schlüssel wie die Ticker-Einbettung, damit beide denselben Zwischenspeicher teilen. */
export const tickerQuery = () => queryOptions({ queryKey: ['ticker'], queryFn: () => listTickerPosts(), refetchInterval: 60000, staleTime: 30000 });
