-- Admins can insert notifications for any user
CREATE POLICY "Admins can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update any profile (for KYC status changes)
CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can view all profiles (for KYC management)
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));