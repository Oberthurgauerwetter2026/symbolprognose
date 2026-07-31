REVOKE ALL ON public.job_runs FROM anon, authenticated;
GRANT ALL ON public.job_runs TO service_role;

ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Job-Laeufe sind nicht oeffentlich zugaenglich" ON public.job_runs;
CREATE POLICY "Job-Laeufe sind nicht oeffentlich zugaenglich"
ON public.job_runs
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);