-- Allow system-generated audit entries (e.g. automated KYC webhook) to have no admin_id.
ALTER TABLE admin_audit_log ALTER COLUMN admin_id DROP NOT NULL;
