import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { queryOptions } from '@tanstack/react-query';
import { reportSchema, type ReportInput, type WeatherReport } from './weather-report';

export const getWeatherReport = createServerFn({ method: 'GET' }).handler(async (): Promise<{ report: WeatherReport | null; unavailable: boolean }> => {
  try {
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    const url = process.env['SUPABASE_URL'];
    if (!key || !url) throw new Error('Unavailable');
    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
        headers.set('apikey', key);
        return fetch(input, { ...init, headers, signal: AbortSignal.timeout(8000) });
      } },
    });
    const { data, error } = await sb.from('weather_reports').select('title,symbol,summary,body,published_at').eq('id', 'current').maybeSingle();
    if (error) throw error;
    return { report: data as WeatherReport | null, unavailable: false };
  } catch { return { report: null, unavailable: true }; }
});

export const publishWeatherReport = createServerFn({ method: 'POST' })
  .inputValidator((input: ReportInput & { password: string }) => input)
  .handler(async ({ data }) => {
    const { assertAdmin } = await import('./warnings.server');
    assertAdmin(data.password);
    const report = reportSchema.parse(data);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: saved, error } = await supabaseAdmin.from('weather_reports')
      .upsert({ id: 'current', ...report, published_at: new Date().toISOString() })
      .select('title,symbol,summary,body,published_at').single();
    if (error) throw new Error('Der Wetterbericht konnte nicht gespeichert werden. Bitte erneut versuchen.');
    return saved as WeatherReport;
  });

export const weatherReportQuery = () => queryOptions({
  queryKey: ['weather-report'], queryFn: () => getWeatherReport(), staleTime: 0, refetchInterval: 60000,
});