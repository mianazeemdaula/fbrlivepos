import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { round2 } from '@/lib/di/tax'
import { loadLedgerImport, requireLedgerAccess } from '@/lib/ledger/service'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
    const access = await requireLedgerAccess()
    if (!access.ok) return access.response
    const { id } = await params

    const ledger = await loadLedgerImport(access.tenant.id, id)
    if (!ledger) return NextResponse.json({ error: 'Import not found' }, { status: 404 })
    return NextResponse.json({ import: ledger })
}

// Only the description and prices are editable. HS code, sale type, rate, UoM,
// SRO schedule and SRO item no. always stay exactly as they came from IRIS.
const UpdateItemsSchema = z.object({
    items: z.array(z.object({
        id: z.string(),
        productName: z.string().trim().min(1, 'Product description is required').max(200).optional(),
        saleUnitPrice: z.number().positive('Sale price must be greater than zero').max(99_999_999).optional(),
        retailUnitPrice: z.number().min(0).max(99_999_999).nullable().optional(),
    })).min(1),
})

export async function PATCH(req: NextRequest, { params }: Params) {
    const access = await requireLedgerAccess()
    if (!access.ok) return access.response
    const { id } = await params

    const parsed = UpdateItemsSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
        const issue = parsed.error.issues[0]
        return NextResponse.json({ error: issue?.message ?? 'Invalid input' }, { status: 400 })
    }

    const existing = await prisma.ledgerItem.findMany({
        where: { importId: id, tenantId: access.tenant.id, id: { in: parsed.data.items.map((item) => item.id) } },
    })
    if (existing.length !== parsed.data.items.length) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }
    const byId = new Map(existing.map((item) => [item.id, item]))

    let pricesChanged = false
    const updates = parsed.data.items.map((input) => {
        const current = byId.get(input.id)!
        const data: { productName?: string; saleUnitPrice?: number; retailUnitPrice?: number | null } = {}
        if (input.productName !== undefined) data.productName = input.productName
        if (input.saleUnitPrice !== undefined && round2(input.saleUnitPrice) !== Number(current.saleUnitPrice)) {
            data.saleUnitPrice = round2(input.saleUnitPrice)
            pricesChanged = true
        }
        if (input.retailUnitPrice !== undefined) {
            const next = input.retailUnitPrice ? round2(input.retailUnitPrice) : null
            const prev = current.retailUnitPrice != null ? Number(current.retailUnitPrice) : null
            if (next !== prev) {
                data.retailUnitPrice = next
                pricesChanged = true
            }
        }
        return prisma.ledgerItem.update({ where: { id: input.id }, data })
    })

    // Pending drafts were priced with the old values, so they are discarded and must be regenerated.
    const discard = pricesChanged
        ? [prisma.ledgerDraft.updateMany({ where: { importId: id, tenantId: access.tenant.id, status: 'DRAFT' }, data: { status: 'DISCARDED' } })]
        : []
    const results = await prisma.$transaction([...updates, ...discard])
    const discardedDrafts = pricesChanged ? (results[results.length - 1] as { count: number }).count : 0

    return NextResponse.json({ import: await loadLedgerImport(access.tenant.id, id), discardedDrafts })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    const access = await requireLedgerAccess()
    if (!access.ok) return access.response
    const { id } = await params

    const ledger = await prisma.ledgerImport.findFirst({
        where: { id, tenantId: access.tenant.id },
        include: { _count: { select: { drafts: { where: { status: 'CREATED' } } } } },
    })
    if (!ledger) return NextResponse.json({ error: 'Import not found' }, { status: 404 })
    if (ledger._count.drafts > 0) {
        return NextResponse.json(
            { error: `${ledger._count.drafts} invoice(s) were already created from this import, so it can't be deleted.` },
            { status: 409 },
        )
    }

    await prisma.ledgerImport.delete({ where: { id } })
    return NextResponse.json({ success: true })
}
