-- Sales ledger import: IRIS purchase ledger uploads pooled into stock that
-- generated draft sale invoices consume. Additive-only; no existing data touched.

CREATE TYPE "LedgerDraftStatus" AS ENUM ('DRAFT', 'CREATED', 'DISCARDED');

CREATE TABLE "LedgerImport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "sourceRowCount" INTEGER NOT NULL,
    "sourceInvoiceCount" INTEGER NOT NULL,
    "sellerCount" INTEGER NOT NULL,
    "periodFrom" TIMESTAMP(3),
    "periodTo" TIMESTAMP(3),
    "totalQuantity" DECIMAL(14,3) NOT NULL,
    "totalValueExclST" DECIMAL(14,2) NOT NULL,
    "totalSalesTax" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LedgerImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerSourceRow" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rowKey" TEXT NOT NULL,
    "invoiceNo" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "sellerNTN" TEXT,
    "sellerName" TEXT,
    "hsCode" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "valueExclST" DECIMAL(14,2) NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "LedgerSourceRow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerItem" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "hsCode" TEXT NOT NULL,
    "hsDescription" TEXT,
    "productName" TEXT NOT NULL,
    "sourceDescriptions" TEXT[],
    "saleType" TEXT NOT NULL,
    "rate" TEXT NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "uom" TEXT NOT NULL,
    "sroScheduleNo" TEXT,
    "sroItemSerialNo" TEXT,
    "totalQuantity" DECIMAL(14,3) NOT NULL,
    "purchaseValueExclST" DECIMAL(14,2) NOT NULL,
    "purchaseSalesTax" DECIMAL(14,2) NOT NULL,
    "purchaseRetailValue" DECIMAL(14,2) NOT NULL,
    "saleUnitPrice" DECIMAL(12,2) NOT NULL,
    "retailUnitPrice" DECIMAL(12,2),
    "sourceRowCount" INTEGER NOT NULL,
    "productId" TEXT,
    CONSTRAINT "LedgerItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerDraft" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "status" "LedgerDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT,
    "buyerName" TEXT,
    "buyerNTN" TEXT,
    "buyerProvince" TEXT,
    "buyerAddress" TEXT,
    "buyerRegistrationType" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerDraftLine" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "retailValue" DECIMAL(14,2),
    "valueExclST" DECIMAL(14,2) NOT NULL,
    "salesTax" DECIMAL(14,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    CONSTRAINT "LedgerDraftLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LedgerImport_tenantId_idx" ON "LedgerImport"("tenantId");
CREATE UNIQUE INDEX "LedgerSourceRow_tenantId_rowKey_key" ON "LedgerSourceRow"("tenantId", "rowKey");
CREATE INDEX "LedgerSourceRow_importId_idx" ON "LedgerSourceRow"("importId");
CREATE INDEX "LedgerItem_importId_idx" ON "LedgerItem"("importId");
CREATE UNIQUE INDEX "LedgerDraft_invoiceId_key" ON "LedgerDraft"("invoiceId");
CREATE INDEX "LedgerDraft_importId_status_idx" ON "LedgerDraft"("importId", "status");
CREATE INDEX "LedgerDraftLine_draftId_idx" ON "LedgerDraftLine"("draftId");
CREATE INDEX "LedgerDraftLine_itemId_idx" ON "LedgerDraftLine"("itemId");

ALTER TABLE "LedgerImport" ADD CONSTRAINT "LedgerImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerSourceRow" ADD CONSTRAINT "LedgerSourceRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "LedgerImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerItem" ADD CONSTRAINT "LedgerItem_importId_fkey" FOREIGN KEY ("importId") REFERENCES "LedgerImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerDraft" ADD CONSTRAINT "LedgerDraft_importId_fkey" FOREIGN KEY ("importId") REFERENCES "LedgerImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerDraftLine" ADD CONSTRAINT "LedgerDraftLine_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "LedgerDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerDraftLine" ADD CONSTRAINT "LedgerDraftLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LedgerItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
