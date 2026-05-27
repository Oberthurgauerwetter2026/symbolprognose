-- 1. Dedicated schema
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- 2. Recreate pg_net inside the extensions schema (no SET SCHEMA support)
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net SCHEMA extensions;

-- 3. Recreate pg_cron (not relocatable; default install puts it in pg_catalog, not public)
DROP EXTENSION IF EXISTS pg_cron;
CREATE EXTENSION pg_cron;

-- 4. Re-schedule the radar ingest job
SELECT cron.schedule(
  'radar-ingest-every-5min',
  '*/5 * * * *',
  $$
  SELECT extensions.http_post(
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