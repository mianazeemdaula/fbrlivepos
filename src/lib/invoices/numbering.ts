import { prisma } from '@/lib/db/prisma'

export async function getNextInvoiceNumber(tenantId: string): Promise<string> {
    // Atomic upsert + increment using raw SQL for safety
    await prisma.$executeRaw`
    INSERT INTO "InvoiceCounter" ("tenantId", "currentValue")
    VALUES (${tenantId}, 1)
    ON CONFLICT ("tenantId")
    DO UPDATE SET "currentValue" = "InvoiceCounter"."currentValue" + 1
  `

    const row = await prisma.invoiceCounter.findUniqueOrThrow({
        where: { tenantId },
    })

    const year = new Date().getFullYear()
    const seq = String(row.currentValue).padStart(6, '0')
    return `INV-${year}-${seq}`
}
