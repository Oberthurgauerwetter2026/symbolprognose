-- 1. Grants auf cron-schema
GRANT USAGE ON SCHEMA cron TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA cron TO postgres, service_role;

-- 2. Alten Job sicher entfernen
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'radar-ingest-every-5min') THEN
    PERFORM cron.unschedule('radar-ingest-every-5min');
  END IF;
END $$;

-- 3. Job neu schedulen (net.http_post — pg_net-Funktionen bleiben im net-Schema)
SELECT cron.schedule(
  'radar-ingest-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--190ceb62-232f-4af4-9fcc-a0a628f223d4.lovable.app/api/public/radar/ingest-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkbmp5eWZxZmJjeW5ibGZmemNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4OTU3MzIsImV4cCI6MjA5NTQ3MTczMn0.Xl1r3bbXc2EDJ3MLHztdYJ45rw27aowAGqX5SWHbCRY'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);

-- 4. Sofort Test-Call
SELECT net.http_post(
  url := 'https://project--190ceb62-232f-4af4-9fcc-a0a628f223d4.lovable.app/api/public/radar/ingest-trigger',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkbmp5eWZxZmJjeW5ibGZmemNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4OTU3MzIsImV4cCI6MjA5NTQ3MTczMn0.Xl1r3bbXc2EDJ3MLHztdYJ45rw27aowAGqX5SWHbCRY'
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 15000
);

-- 5. Diagnose-View
CREATE OR REPLACE VIEW public.radar_cron_health AS
SELECT
  jrd.start_time,
  jrd.end_time,
  jrd.status,
  jrd.return_message,
  EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time)) AS duration_s
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'radar-ingest-every-5min'
ORDER BY jrd.start_time DESC
LIMIT 20;

GRANT SELECT ON public.radar_cron_health TO anon, authenticated, service_role;