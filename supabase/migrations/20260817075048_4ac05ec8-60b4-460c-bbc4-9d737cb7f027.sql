REVOKE ALL ON public.client_errors FROM anon, authenticated;
ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_errors deny all client access" ON public.client_errors;
CREATE POLICY "client_errors deny all client access"
ON public.client_errors
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);