import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireLedgerAccess } from '@/lib/ledger/service'
import { readDirectUpload } from '../shared'

// POST /api/tenant/direct-invoices/preview  (multipart: file)
// Parses the sheet and returns the invoices it would create, without saving anything.
export async function POST(req: NextRequest) {
    const access = await requireLedgerAccess()
    if (!access.ok) return access.response

    const upload = await readDirectUpload(req)
    if (!upload.ok) return upload.response
    const { preview } = upload

    const existing = await prisma.directInvoiceBatch.findUnique({
        where: { tenantId_fileHash: { tenantId: access.tenant.id, fileHash: preview.fileHash } },
        select: { id: true },
    })

    return NextResponse.json({
        invoices: preview.invoices,
        errors: preview.errors,
        existingBatchId: existing?.id ?? null,
    })
}
