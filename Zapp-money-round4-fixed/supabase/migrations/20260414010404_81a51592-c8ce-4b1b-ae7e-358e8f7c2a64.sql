
-- Create storage bucket for KYC documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload to their own folder
CREATE POLICY "Users can upload own KYC docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can view their own KYC docs
CREATE POLICY "Users can view own KYC docs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins can view all KYC docs
CREATE POLICY "Admins can view all KYC docs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'admin'));
