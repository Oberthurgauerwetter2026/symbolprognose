CREATE TABLE public.warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard text NOT NULL CHECK (hazard IN ('gewitter','regen','schnee','glaette','wind','frost')),
  level int NOT NULL CHECK (level BETWEEN 1 AND 3),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz NOT NULL,
  title text,
  description text NOT NULL DEFAULT '',
  impact text NOT NULL DEFAULT '',
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','auto')),
  auto_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.warning_regions (
  warning_id uuid NOT NULL REFERENCES public.warnings(id) ON DELETE CASCADE,
  region_id text NOT NULL,
  PRIMARY KEY (warning_id, region_id)
);

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  region_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX warnings_active_idx ON public.warnings (active, valid_to);
CREATE INDEX warning_regions_region_idx ON public.warning_regions (region_id);
CREATE UNIQUE INDEX warnings_auto_key_idx ON public.warnings (auto_key) WHERE auto_key IS NOT NULL;

GRANT SELECT ON public.warnings TO anon, authenticated;
GRANT ALL ON public.warnings TO service_role;
GRANT SELECT ON public.warning_regions TO anon, authenticated;
GRANT ALL ON public.warning_regions TO service_role;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warning_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aktive Warnungen sind oeffentlich lesbar"
  ON public.warnings FOR SELECT TO anon, authenticated
  USING (active = true AND valid_to > now());

CREATE POLICY "Regionen aktiver Warnungen sind oeffentlich lesbar"
  ON public.warning_regions FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.warnings w
    WHERE w.id = warning_id AND w.active = true AND w.valid_to > now()
  ));

CREATE OR REPLACE FUNCTION public.warnings_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER warnings_updated_at BEFORE UPDATE ON public.warnings
  FOR EACH ROW EXECUTE FUNCTION public.warnings_touch_updated_at();
CREATE TRIGGER push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.warnings_touch_updated_at();