CREATE TABLE public.admin_photo_push_subscriptions (
 endpoint text PRIMARY KEY,
 p256dh text NOT NULL,
 auth text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_photo_push_subscriptions TO service_role;
ALTER TABLE public.admin_photo_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin photo devices are private" ON public.admin_photo_push_subscriptions AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);