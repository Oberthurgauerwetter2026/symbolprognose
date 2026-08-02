ALTER TABLE public.warnings REPLICA IDENTITY FULL;
ALTER TABLE public.warning_regions REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.warnings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.warning_regions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;