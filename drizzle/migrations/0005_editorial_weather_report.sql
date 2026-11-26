CREATE TABLE public.weather_reports (
 id text PRIMARY KEY DEFAULT 'current' CHECK (id = 'current'),
 title text NOT NULL DEFAULT '',
 symbol integer NOT NULL DEFAULT 2,
 summary text NOT NULL DEFAULT '',
 body text NOT NULL DEFAULT '',
 published_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT report_title_length CHECK (char_length(title) BETWEEN 1 AND 160),
 CONSTRAINT report_summary_length CHECK (char_length(summary) BETWEEN 1 AND 600),
 CONSTRAINT report_body_length CHECK (char_length(body) BETWEEN 1 AND 20000)
);
GRANT SELECT ON public.weather_reports TO anon, authenticated;
GRANT ALL ON public.weather_reports TO service_role;
ALTER TABLE public.weather_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read published weather report" ON public.weather_reports FOR SELECT TO anon, authenticated USING (published_at <= now());