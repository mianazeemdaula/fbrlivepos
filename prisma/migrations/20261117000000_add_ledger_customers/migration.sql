-- Customers (name + CNIC) listed in a ledger upload, used as buyers for generated drafts.
ALTER TABLE "LedgerImport" ADD COLUMN "customers" JSONB NOT NULL DEFAULT '[]';
