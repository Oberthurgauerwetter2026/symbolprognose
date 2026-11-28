ALTER TABLE public.weather_reports
  ADD COLUMN IF NOT EXISTS situation text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS forecast_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS forecast text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS outlook_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS days jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS trend text NOT NULL DEFAULT '';

UPDATE public.weather_reports SET forecast = body WHERE forecast = '' AND body <> '';