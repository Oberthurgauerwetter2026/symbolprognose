import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { reportDays, reportDraftSaveSchema, reportSchema, type ReportInput, type WeatherReport } from './weather-report';

const COLUMNS = 'title,situation,forecast_title,forecast,outlook_title,days,trend,published_at';

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
    const { data, error } = await sb.from('weather_reports').select(COLUMNS).eq('id', 'current').maybeSingle();
    if (error) throw error;
    return { report: data ? { ...data, days: reportDays(data.days) } : null, unavailable: false };
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
      .select(COLUMNS).single();
    if (error) {
      console.error('weather report publish failed', error.code, error.message);
      throw new Error('Der Wetterbericht konnte nicht gespeichert werden. Bitte erneut versuchen.');
    }
    // Der veröffentlichte Stand ersetzt den Entwurf; ein Rest wäre beim nächsten Öffnen irreführend.
    await supabaseAdmin.from('weather_report_drafts').delete().eq('id', 'current');
    return { ...saved, days: reportDays(saved.days) } satisfies WeatherReport;
  });

const passwordInput = z.object({ password: z.string().max(200) });

/** Entwürfe sind nur mit dem Redaktionspasswort lesbar und nie öffentlich. */
export const getWeatherReportDraft = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => passwordInput.parse(input))
  .handler(async ({ data }): Promise<{ draft: ReportInput | null; saved_at: string | null }> => {
    const { assertAdmin } = await import('./warnings.server');
    assertAdmin(data.password);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: row, error } = await supabaseAdmin.from('weather_report_drafts').select('content,saved_at').eq('id', 'current').maybeSingle();
    if (error) throw new Error('Der Entwurf konnte nicht geladen werden.');
    const parsed = reportDraftSaveSchema.safeParse(row?.content);
    return parsed.success && row ? { draft: parsed.data, saved_at: row.saved_at } : { draft: null, saved_at: null };
  });

export const saveWeatherReportDraft = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => passwordInput.extend(reportDraftSaveSchema.shape).parse(input))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import('./warnings.server');
    assertAdmin(data.password);
    const { password: _password, ...content } = data;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const saved_at = new Date().toISOString();
    const { error } = await supabaseAdmin.from('weather_report_drafts').upsert({ id: 'current', content, saved_at });
    if (error) {
      console.error('weather report draft save failed', error.code, error.message);
      throw new Error('Der Entwurf konnte nicht gespeichert werden. Bitte erneut versuchen.');
    }
    return { saved_at };
  });

export const discardWeatherReportDraft = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => passwordInput.parse(input))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import('./warnings.server');
    assertAdmin(data.password);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.from('weather_report_drafts').delete().eq('id', 'current');
    if (error) throw new Error('Der Entwurf konnte nicht verworfen werden.');
    return { ok: true };
  });

export const weatherReportQuery = () => queryOptions({
  queryKey: ['weather-report'], queryFn: () => getWeatherReport(), staleTime: 0, refetchInterval: 60000,
});