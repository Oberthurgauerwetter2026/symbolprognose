ALTER TABLE public.weather_reports
  DROP CONSTRAINT IF EXISTS report_summary_length,
  DROP CONSTRAINT IF EXISTS report_body_length;
COMMENT ON COLUMN public.weather_reports.summary IS 'DEPRECATED: replaced by title and forecast';
COMMENT ON COLUMN public.weather_reports.body IS 'DEPRECATED: replaced by forecast';
COMMENT ON COLUMN public.weather_reports.symbol IS 'DEPRECATED: no longer shown';

CREATE TABLE public.weather_report_drafts (
  id text PRIMARY KEY DEFAULT 'current' CHECK (id = 'current'),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.weather_report_drafts TO service_role;
ALTER TABLE public.weather_report_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Report drafts are private" ON public.weather_report_drafts AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);