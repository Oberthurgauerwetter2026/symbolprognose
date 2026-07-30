CREATE TABLE public.job_runs (
  job TEXT PRIMARY KEY,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  detected INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL DEFAULT 0,
  closed INTEGER NOT NULL DEFAULT 0,
  note TEXT
);
GRANT ALL ON public.job_runs TO service_role;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;