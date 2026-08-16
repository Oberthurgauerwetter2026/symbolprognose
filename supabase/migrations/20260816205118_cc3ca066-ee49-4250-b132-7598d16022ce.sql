CREATE TABLE public.client_errors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  message text NOT NULL,
  stack text,
  route text,
  detail text,
  user_agent text,
  memory_mb numeric
);

CREATE INDEX client_errors_created_at_idx ON public.client_errors (created_at DESC);

GRANT ALL ON public.client_errors TO service_role;

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;