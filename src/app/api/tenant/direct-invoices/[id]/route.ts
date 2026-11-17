import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { round2 } from '@/lib/di/tax'
import { requireDirectInvoicesAccess } from '@/lib/ledger/service'
import { loadDirectBatch } from '@/lib/direct/service'

type Params = { params: Promise<{ id: string }> }

// Never reported to FBR, so safe to delete. CONFIRMED invoices are locked (use a Debit Note).
const DELETABLE_STATUSES = ['DRAFT', 'FAILED', 'VALIDATED'] as const

export async function GET(_req: Request, { params }: Params) {
    const access = await requireDirectInvoicesAccess()
    if (!access.ok) return access.response
    const { id } = await params

    const batch = await loadDirectBatch(access.tenant.id, id)
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    return NextResponse.json({ batch })
}

const DeleteSchema = z.object({
    // Omit to delete every deletable invoice in the upload
    invoiceIds: z.array(z.string()).min(1).max(500).optional(),
})

// DELETE /api/tenant/direct-invoices/[id]  { invoiceIds? }
// Bulk-deletes the upload's invoices that were not submitted to FBR, with their backing products.
export async function DELETE(req: NextRequest, { params }: Params) {
    const access = await requireDirectInvoicesAccess()
    if (!access.ok) return access.response
    const tenantId = access.tenant.id
    const { id } = await params

    const parsed = DeleteSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid selection.' }, { status: 400 })

    const batch = await prisma.directInvoiceBatch.findFirst({ where: { id, tenantId } })
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

    const requested = parsed.data.invoiceIds
        ? parsed.data.invoiceIds.filter((invoiceId) => batch.invoiceIds.includes(invoiceId))
        : batch.invoiceIds

    const deletable = await prisma.invoice.findMany({
        where: { tenantId, id: { in: requested }, status: { in: [...DELETABLE_STATUSES] } },
        select: { id: true, items: { select: { productId: true } } },
    })
    const deleteIds = deletable.map((invoice) => invoice.id)
    const productIds = [...new Set(deletable.flatMap((invoice) => invoice.items.map((item) => item.productId)))]
    const skipped = requested.length - deleteIds.length
    let batchRemoved = false

    if (deleteIds.length) {
        await prisma.$transaction(async (tx) => {
            await tx.fBRSubmissionLog.deleteMany({ where: { tenantId, invoiceId: { in: deleteIds } } })
            await tx.invoiceItem.deleteMany({ where: { invoiceId: { in: deleteIds } } })
            await tx.invoice.deleteMany({ where: { tenantId, id: { in: deleteIds } } })
            // Inactive products created only to back these lines
            await tx.product.deleteMany({
                where: { tenantId, id: { in: productIds }, isActive: false, sku: { startsWith: 'DIRECT-' }, invoiceItems: { none: {} } },
            })

            const remaining = batch.invoiceIds.filter((invoiceId) => !deleteIds.includes(invoiceId))
            if (!remaining.length) {
                // Nothing left: drop the upload so the same file can be uploaded again from scratch.
                await tx.directInvoiceBatch.delete({ where: { id: batch.id } })
                batchRemoved = true
                return
            }
            const totals = await tx.invoice.aggregate({ where: { tenantId, id: { in: remaining } }, _sum: { totalAmount: true } })
            await tx.directInvoiceBatch.update({
                where: { id: batch.id },
                data: { invoiceIds: remaining, invoiceCount: remaining.length, totalAmount: round2(Number(totals._sum.totalAmount ?? 0)) },
            })
        })
    }

    return NextResponse.json({
        deleted: deleteIds.length,
        skipped,
        batch: batchRemoved ? null : await loadDirectBatch(tenantId, batch.id),
    })
}
