REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Push-Abos sind nicht oeffentlich zugaenglich" ON public.push_subscriptions;
CREATE POLICY "Push-Abos sind nicht oeffentlich zugaenglich"
  ON public.push_subscriptions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);