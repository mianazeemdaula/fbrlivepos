-- Add diEnvironment field to Invoice table
-- Existing invoices default to SANDBOX (safe — they were created during setup/testing)
-- This migration is additive-only; no data is dropped or modified.

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "diEnvironment" "DIEnvironment" NOT NULL DEFAULT 'SANDBOX';
