
-- Allow authenticated users to see all profiles for feed display
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
