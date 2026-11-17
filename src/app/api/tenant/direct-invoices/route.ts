import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@/generated/prisma/client'
import { checkPlanLimit } from '@/lib/features/flags'
import { getSubscriptionBlockReason } from '@/lib/billing/subscription'
import { requireDirectInvoicesAccess } from '@/lib/ledger/service'
import { createDirectInvoices, loadDirectBatch } from '@/lib/direct/service'
import { readDirectUpload } from './shared'

const MAX_INVOICES_PER_FILE = 500

export async function GET() {
    const access = await requireDirectInvoicesAccess()
    if (!access.ok) return access.response

    const batches = await prisma.directInvoiceBatch.findMany({
        where: { tenantId: access.tenant.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
    })
    const allIds = batches.flatMap((batch) => batch.invoiceIds)
    const confirmedIds = new Set(allIds.length
        ? (await prisma.invoice.findMany({
            where: { tenantId: access.tenant.id, id: { in: allIds }, status: 'CONFIRMED' },
            select: { id: true },
        })).map((invoice) => invoice.id)
        : [])

    return NextResponse.json({
        batches: batches.map((batch) => ({
            id: batch.id,
            fileName: batch.fileName,
            createdAt: batch.createdAt,
            invoiceCount: batch.invoiceCount,
            confirmedCount: batch.invoiceIds.filter((id) => confirmedIds.has(id)).length,
            totalAmount: Number(batch.totalAmount),
        })),
    })
}

// POST /api/tenant/direct-invoices  (multipart: file)
// Creates one DRAFT invoice per sheet invoice, exactly as written. The browser then
// validates/submits them one by one through /api/invoices/[id]/action.
export async function POST(req: NextRequest) {
    const access = await requireDirectInvoicesAccess()
    if (!access.ok) return access.response
    const { tenant, userId } = access

    const subscriptionBlock = await getSubscriptionBlockReason(tenant.id)
    if (subscriptionBlock) {
        return NextResponse.json({ error: subscriptionBlock, subscriptionRequired: true }, { status: 402 })
    }

    const upload = await readDirectUpload(req)
    if (!upload.ok) return upload.response
    const { file, preview } = upload

    // Same sheet uploaded again: resume the earlier batch instead of creating duplicates.
    const existing = await prisma.directInvoiceBatch.findUnique({
        where: { tenantId_fileHash: { tenantId: tenant.id, fileHash: preview.fileHash } },
    })
    if (existing) {
        return NextResponse.json({ batch: await loadDirectBatch(tenant.id, existing.id), resumed: true })
    }

    if (preview.errors.length) {
        return NextResponse.json({ error: 'Fix the errors in the sheet and upload it again.', errors: preview.errors }, { status: 422 })
    }
    if (preview.invoices.length > MAX_INVOICES_PER_FILE) {
        return NextResponse.json({ error: `A file can hold at most ${MAX_INVOICES_PER_FILE} invoices. Split it into smaller files.` }, { status: 422 })
    }

    const limit = await checkPlanLimit(tenant.id, 'maxInvoicesMonth')
    if (limit.max !== null && limit.current + preview.invoices.length > limit.max) {
        const left = Math.max(0, limit.max - limit.current)
        return NextResponse.json(
            { error: `Your plan allows ${limit.max} invoices per month and ${left} remain; this file has ${preview.invoices.length}.`, upgradeRequired: true },
            { status: 403 },
        )
    }

    try {
        const batch = await createDirectInvoices({
            tenantId: tenant.id,
            userId,
            fileName: file.name,
            fileHash: preview.fileHash,
            invoices: preview.invoices,
        })
        return NextResponse.json({ batch: await loadDirectBatch(tenant.id, batch.id), resumed: false }, { status: 201 })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return NextResponse.json({ error: 'This file was just uploaded by another request. Refresh the page.' }, { status: 409 })
        }
        throw error
    }
}
