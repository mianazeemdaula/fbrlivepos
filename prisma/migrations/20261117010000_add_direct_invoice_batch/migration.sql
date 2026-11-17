-- Direct invoice uploads: sheet rows turned into invoices as written. Additive-only.
CREATE TABLE "DirectInvoiceBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "invoiceIds" TEXT[],
    "invoiceCount" INTEGER NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DirectInvoiceBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DirectInvoiceBatch_tenantId_fileHash_key" ON "DirectInvoiceBatch"("tenantId", "fileHash");
CREATE INDEX "DirectInvoiceBatch_tenantId_createdAt_idx" ON "DirectInvoiceBatch"("tenantId", "createdAt");
