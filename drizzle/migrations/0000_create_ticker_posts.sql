CREATE TABLE public.ticker_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  body text NOT NULL,
  product text,
  product_value text,
  image_url text
);
GRANT SELECT ON public.ticker_posts TO anon, authenticated;
GRANT ALL ON public.ticker_posts TO service_role;
ALTER TABLE public.ticker_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ticker public read" ON public.ticker_posts FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX ticker_posts_created_idx ON public.ticker_posts (created_at DESC);