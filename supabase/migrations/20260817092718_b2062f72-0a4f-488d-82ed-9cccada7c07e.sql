ALTER TABLE public.warnings ADD COLUMN IF NOT EXISTS notified_at timestamp with time zone;
ALTER TABLE public.job_runs ADD COLUMN IF NOT EXISTS notified integer NOT NULL DEFAULT 0;