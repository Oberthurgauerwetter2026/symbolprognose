DROP POLICY IF EXISTS "Ticker public read" ON public.ticker_posts;
CREATE POLICY "Ticker public read published" ON public.ticker_posts FOR SELECT TO anon, authenticated USING (created_at <= now());