import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getNextInvoiceNumber } from '@/lib/invoices/numbering'
import { checkPlanLimit } from '@/lib/features/flags'
import { getSubscriptionBlockReason } from '@/lib/billing/subscription'
import { requireLedgerAccess } from '@/lib/ledger/service'

type Params = { params: Promise<{ id: string }> }

const CreateSchema = z.object({
    draftIds: z.array(z.string()).min(1).max(100),
})

class DraftAlreadyProcessed extends Error {}

// POST /api/tenant/ledger-imports/[id]/drafts/create  { draftIds }
// Turns selected drafts into regular DRAFT invoices, which then follow the normal
// validate → confirm (FBR submission) flow from the invoices page or this wizard.
export async function POST(req: NextRequest, { params }: Params) {
    const access = await requireLedgerAccess()
    if (!access.ok) return access.response
    const { tenant, userId } = access
    const { id } = await params

    const subscriptionBlock = await getSubscriptionBlockReason(tenant.id)
    if (subscriptionBlock) {
        return NextResponse.json({ error: subscriptionBlock, subscriptionRequired: true }, { status: 402 })
    }

    const parsed = CreateSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
        return NextResponse.json({ error: 'Select at least one draft invoice (max 100 per request).' }, { status: 400 })
    }

    const drafts = await prisma.ledgerDraft.findMany({
        where: { id: { in: parsed.data.draftIds }, importId: id, tenantId: tenant.id, status: 'DRAFT' },
        include: { lines: { include: { item: true } } },
        orderBy: [{ invoiceDate: 'asc' }, { sequence: 'asc' }],
    })
    if (!drafts.length) {
        return NextResponse.json({ error: 'The selected drafts were already processed or discarded.' }, { status: 409 })
    }

    const limit = await checkPlanLimit(tenant.id, 'maxInvoicesMonth')
    if (limit.max !== null && limit.current + drafts.length > limit.max) {
        const left = Math.max(0, limit.max - limit.current)
        return NextResponse.json(
            {
                error: `Your plan allows ${limit.max} invoices per month and ${left} remain. Select ${left} or fewer drafts, or upgrade your plan.`,
                upgradeRequired: true,
            },
            { status: 403 },
        )
    }

    // Every pooled item is backed by an inactive catalogue product (InvoiceItem needs a productId),
    // kept out of the POS catalogue and plan product counts like POS direct items.
    const items = new Map(drafts.flatMap((draft) => draft.lines.map((line) => [line.item.id, line.item] as const)))
    const productIdByItem = new Map<string, string>()
    for (const item of items.values()) {
        if (item.productId) {
            productIdByItem.set(item.id, item.productId)
            continue
        }
        const product = await prisma.product.create({
            data: {
                tenantId: tenant.id,
                name: item.productName,
                sku: `LEDGER-${item.id}`,
                hsCode: item.hsCode,
                price: item.saleUnitPrice,
                taxRate: item.taxRate,
                unit: item.uom,
                diUOM: item.uom,
                diRate: item.rate,
                diSaleType: item.saleType,
                diFixedNotifiedValueOrRetailPrice: item.retailUnitPrice,
                sroScheduleNo: item.sroScheduleNo,
                sroItemSerialNo: item.sroItemSerialNo,
                isActive: false,
            },
        })
        await prisma.ledgerItem.update({ where: { id: item.id }, data: { productId: product.id } })
        productIdByItem.set(item.id, product.id)
    }

    const creds = await prisma.dICredentials.findUnique({ where: { tenantId: tenant.id }, select: { environment: true } })
    const diEnvironment = creds?.environment ?? 'SANDBOX'

    const created: Array<{ draftId: string; invoiceId: string; invoiceNumber: string }> = []
    const failed: Array<{ draftId: string; error: string }> = []

    for (const draft of drafts) {
        try {
            const invoiceNumber = await getNextInvoiceNumber(tenant.id)
            const invoice = await prisma.$transaction(async (tx) => {
                // Claim the draft first so a double click can't create two invoices from it.
                const claimed = await tx.ledgerDraft.updateMany({
                    where: { id: draft.id, status: 'DRAFT' },
                    data: { status: 'CREATED' },
                })
                if (claimed.count === 0) throw new DraftAlreadyProcessed()

                const invoice = await tx.invoice.create({
                    data: {
                        tenantId: tenant.id,
                        userId,
                        invoiceNumber,
                        invoiceDate: draft.invoiceDate,
                        customerId: draft.customerId,
                        buyerName: draft.buyerName,
                        buyerNTN: draft.buyerNTN,
                        buyerProvince: draft.buyerProvince,
                        buyerAddress: draft.buyerAddress,
                        buyerRegistrationType: draft.buyerRegistrationType,
                        subtotal: draft.subtotal,
                        taxAmount: draft.taxAmount,
                        discountAmount: 0,
                        totalAmount: draft.totalAmount,
                        paymentMethod: 'CASH',
                        status: 'DRAFT',
                        invoiceType: 'Sale Invoice',
                        diEnvironment,
                        items: {
                            create: draft.lines.map((line) => ({
                                productId: productIdByItem.get(line.item.id)!,
                                hsCode: line.item.hsCode,
                                name: line.item.productName,
                                quantity: line.quantity,
                                unit: line.item.uom,
                                unitPrice: line.unitPrice,
                                taxRate: line.item.taxRate,
                                taxAmount: line.salesTax,
                                lineTotal: line.lineTotal,
                                diRate: line.item.rate,
                                diUOM: line.item.uom,
                                diSaleType: line.item.saleType,
                                // Line-level (per-unit retail × qty), as the payload builder expects
                                diFixedNotifiedValueOrRetailPrice: line.retailValue,
                                sroScheduleNo: line.item.sroScheduleNo,
                                sroItemSerialNo: line.item.sroItemSerialNo,
                                discount: 0,
                            })),
                        },
                    },
                })

                await tx.ledgerDraft.update({ where: { id: draft.id }, data: { invoiceId: invoice.id } })
                return invoice
            })
            created.push({ draftId: draft.id, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber })
        } catch (error) {
            failed.push({
                draftId: draft.id,
                error: error instanceof DraftAlreadyProcessed
                    ? 'Already processed'
                    : error instanceof Error ? error.message : 'Failed to create invoice',
            })
        }
    }

    return NextResponse.json({ created, failed }, { status: created.length ? 201 : 409 })
}
