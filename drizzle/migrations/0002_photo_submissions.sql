CREATE TABLE public.photo_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  image_path text NOT NULL,
  place text NOT NULL DEFAULT '',
  author text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT ''
);
GRANT ALL ON public.photo_submissions TO service_role;
ALTER TABLE public.photo_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leserfotos nicht oeffentlich" ON public.photo_submissions AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);