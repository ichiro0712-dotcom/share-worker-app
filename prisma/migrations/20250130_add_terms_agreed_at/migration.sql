-- Add missing column for facility_admins. Safe to run multiple times.
ALTER TABLE "facility_admins"
ADD COLUMN IF NOT EXISTS "terms_agreed_at" TIMESTAMP(3);
