import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { generateLedgerDrafts, quantityStepFor } from '@/lib/ledger/generator'
import { getReservedQuantities, ledgerItemIssues, loadLedgerImport, requireLedgerAccess } from '@/lib/ledger/service'

type Params = { params: Promise<{ id: string }> }

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must be in YYYY-MM-DD format')

const GenerateSchema = z.object({
    from: DATE,
    to: DATE,
    count: z.number().int().min(1).max(500),
    minAmount: z.number().positive(),
    maxAmount: z.number().positive(),
    maxItemsPerInvoice: z.number().int().min(1).max(10).default(3),
    itemIds: z.array(z.string()).optional(),
    customerId: z.string().nullish(),
    replaceExisting: z.boolean().default(true),
}).refine((value) => value.maxAmount >= value.minAmount, { message: 'Maximum amount must be at least the minimum amount', path: ['maxAmount'] })
    .refine((value) => value.to >= value.from, { message: '"To" date must be on or after the "From" date', path: ['to'] })

// Pakistan Standard Time (UTC+5) calendar day — FBR rejects invoices dated in the future.
function todayPKT() {
    return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export async function POST(req: NextRequest, { params }: Params) {
    const access = await requireLedgerAccess()
    if (!access.ok) return access.response
    const { tenant } = access
    const { id } = await params

    const parsed = GenerateSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const body = parsed.data
    if (body.to > todayPKT()) {
        return NextResponse.json({ error: 'Invoice dates cannot be in the future.' }, { status: 400 })
    }

    const ledger = await prisma.ledgerImport.findFirst({
        where: { id, tenantId: tenant.id },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!ledger) return NextResponse.json({ error: 'Import not found' }, { status: 404 })

    // Buyer applied to every generated invoice: a saved customer, or an unregistered walk-in buyer.
    let buyer: {
        customerId: string | null
        buyerName: string
        buyerNTN: string | null
        buyerProvince: string | null
        buyerAddress: string | null
        buyerRegistrationType: string
    }
    if (body.customerId) {
        const customer = await prisma.customer.findFirst({ where: { id: body.customerId, tenantId: tenant.id, isActive: true } })
        if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
        buyer = {
            customerId: customer.id,
            buyerName: customer.name,
            buyerNTN: customer.ntnCnic,
            buyerProvince: customer.province,
            buyerAddress: customer.address,
            buyerRegistrationType: customer.registrationType ?? (customer.ntnCnic ? 'Registered' : 'Unregistered'),
        }
    } else {
        const creds = await prisma.dICredentials.findUnique({ where: { tenantId: tenant.id }, select: { sellerProvince: true } })
        buyer = {
            customerId: null,
            buyerName: 'Walk-in Customer',
            buyerNTN: null,
            buyerProvince: creds?.sellerProvince ?? null,
            buyerAddress: null,
            buyerRegistrationType: 'Unregistered',
        }
    }

    if (body.replaceExisting) {
        await prisma.ledgerDraft.updateMany({
            where: { importId: id, tenantId: tenant.id, status: 'DRAFT' },
            data: { status: 'DISCARDED' },
        })
    }
    const reserved = await getReservedQuantities(id)

    const selected = ledger.items.filter((item) => !body.itemIds || body.itemIds.includes(item.id))
    const usable = selected.filter((item) => ledgerItemIssues(item).length === 0)
    const notUsable = selected.length - usable.length

    const result = generateLedgerDrafts(
        usable.map((item) => ({
            id: item.id,
            label: `${item.hsCode} · ${item.productName}`,
            availableQty: Math.max(0, Math.round((Number(item.totalQuantity) - (reserved.get(item.id) ?? 0)) * 1000) / 1000),
            quantityStep: quantityStepFor(Number(item.totalQuantity)),
            unitPrice: Number(item.saleUnitPrice),
            retailUnitPrice: item.retailUnitPrice != null ? Number(item.retailUnitPrice) : null,
            taxRate: Number(item.taxRate),
            saleType: item.saleType,
        })),
        {
            from: new Date(`${body.from}T00:00:00.000Z`),
            to: new Date(`${body.to}T00:00:00.000Z`),
            count: body.count,
            minAmount: body.minAmount,
            maxAmount: body.maxAmount,
            maxItemsPerInvoice: body.maxItemsPerInvoice,
            seed: Math.floor(Math.random() * 2 ** 31),
        },
    )
    if (notUsable) {
        result.warnings.unshift(`${notUsable} product(s) were skipped because they need a price or retail price first.`)
    }

    const last = await prisma.ledgerDraft.aggregate({
        where: { importId: id, status: { in: ['DRAFT', 'CREATED'] } },
        _max: { sequence: true },
    })
    const offset = last._max.sequence ?? 0

    await prisma.$transaction(result.drafts.map((draft) => prisma.ledgerDraft.create({
        data: {
            importId: id,
            tenantId: tenant.id,
            sequence: offset + draft.sequence,
            invoiceDate: draft.invoiceDate,
            ...buyer,
            subtotal: draft.subtotal,
            taxAmount: draft.taxAmount,
            totalAmount: draft.totalAmount,
            lines: {
                create: draft.lines.map((line) => ({
                    itemId: line.itemId,
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                    retailValue: line.retailValue,
                    valueExclST: line.valueExclST,
                    salesTax: line.salesTax,
                    lineTotal: line.lineTotal,
                })),
            },
        },
    })))

    return NextResponse.json({
        import: await loadLedgerImport(tenant.id, id),
        generated: result.drafts.length,
        stockValue: result.stockValue,
        allocatedValue: result.allocatedValue,
        warnings: result.warnings,
    })
}

const DiscardSchema = z.object({ draftIds: z.array(z.string()).optional() })

export async function DELETE(req: NextRequest, { params }: Params) {
    const access = await requireLedgerAccess()
    if (!access.ok) return access.response
    const { id } = await params

    const parsed = DiscardSchema.safeParse(await req.json().catch(() => ({})))
    const draftIds = parsed.success ? parsed.data.draftIds : undefined

    const { count } = await prisma.ledgerDraft.updateMany({
        where: {
            importId: id,
            tenantId: access.tenant.id,
            status: 'DRAFT',
            ...(draftIds ? { id: { in: draftIds } } : {}),
        },
        data: { status: 'DISCARDED' },
    })

    return NextResponse.json({ import: await loadLedgerImport(access.tenant.id, id), discarded: count })
}
