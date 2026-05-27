-- Enable scheduling extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any previous version of the job to make this migration idempotent
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'radar-ingest-every-5min') THEN
    PERFORM cron.unschedule('radar-ingest-every-5min');
  END IF;
END $$;

-- Schedule: every 5 minutes call the public radar ingest trigger endpoint.
-- Auth is the project's anon/publishable key in the `apikey` header.
-- The endpoint code will be updated to accept this in addition to x-trigger-secret.
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