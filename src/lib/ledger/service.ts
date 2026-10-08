import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getTenantFromSession } from '@/lib/tenant/context'
import { isFeatureEnabled } from '@/lib/features/flags'
import { isThirdScheduleSaleType, round2 } from '@/lib/di/tax'
import type { LedgerItem } from '@/generated/prisma/client'

/** Feature flag a super admin enables per tenant (TenantFeatureFlag override). */
export const LEDGER_IMPORT_FLAG = 'ledger_import'
export const LEDGER_IMPORT_FLAG_DESCRIPTION = 'Import the FBR IRIS purchase ledger and auto-generate draft sale invoices from it'

type LedgerAccess =
    | { ok: true; tenant: Awaited<ReturnType<typeof getTenantFromSession>>['tenant']; userId: string; role: string }
    | { ok: false; response: NextResponse }

export async function requireLedgerAccess(): Promise<LedgerAccess> {
    let session: Awaited<ReturnType<typeof getTenantFromSession>>
    try {
        session = await getTenantFromSession()
    } catch {
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }
    if (!(await isFeatureEnabled(session.tenant.id, LEDGER_IMPORT_FLAG))) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'Sales ledger import is not enabled for your account. Contact support to enable it.' },
                { status: 403 },
            ),
        }
    }
    return { ok: true, ...session }
}

/** Quantity of each item held by drafts that are still pending or already turned into invoices. */
export async function getReservedQuantities(importId: string): Promise<Map<string, number>> {
    const rows = await prisma.ledgerDraftLine.groupBy({
        by: ['itemId'],
        where: { draft: { importId, status: { in: ['DRAFT', 'CREATED'] } } },
        _sum: { quantity: true },
    })
    return new Map(rows.map((row) => [row.itemId, Number(row._sum.quantity ?? 0)]))
}

/** Reasons an item can't be invoiced as-is; the wizard shows them and generation skips the item. */
export function ledgerItemIssues(item: Pick<LedgerItem, 'saleType' | 'retailUnitPrice' | 'saleUnitPrice' | 'productName'>): string[] {
    const issues: string[] = []
    if (!item.productName.trim()) issues.push('Product description is required')
    if (Number(item.saleUnitPrice) <= 0) issues.push('Sale price must be greater than zero')
    if (isThirdScheduleSaleType(item.saleType) && !(Number(item.retailUnitPrice ?? 0) > 0)) {
        issues.push('3rd Schedule goods need a retail price')
    }
    return issues
}

export function serializeLedgerItem(item: LedgerItem, reserved: number) {
    const totalQuantity = Number(item.totalQuantity)
    return {
        id: item.id,
        hsCode: item.hsCode,
        hsDescription: item.hsDescription,
        productName: item.productName,
        sourceDescriptions: item.sourceDescriptions,
        saleType: item.saleType,
        rate: item.rate,
        taxRate: Number(item.taxRate),
        uom: item.uom,
        sroScheduleNo: item.sroScheduleNo,
        sroItemSerialNo: item.sroItemSerialNo,
        totalQuantity,
        reservedQuantity: reserved,
        availableQuantity: Math.max(0, Math.round((totalQuantity - reserved) * 1000) / 1000),
        purchaseValueExclST: Number(item.purchaseValueExclST),
        purchaseSalesTax: Number(item.purchaseSalesTax),
        purchaseRetailValue: Number(item.purchaseRetailValue),
        saleUnitPrice: Number(item.saleUnitPrice),
        retailUnitPrice: item.retailUnitPrice != null ? Number(item.retailUnitPrice) : null,
        sourceRowCount: item.sourceRowCount,
        issues: ledgerItemIssues(item),
    }
}

export async function loadLedgerImport(tenantId: string, importId: string) {
    const ledger = await prisma.ledgerImport.findFirst({
        where: { id: importId, tenantId },
        include: {
            items: { orderBy: { sortOrder: 'asc' } },
            drafts: {
                where: { status: { in: ['DRAFT', 'CREATED'] } },
                orderBy: [{ status: 'asc' }, { invoiceDate: 'asc' }, { sequence: 'asc' }],
                include: { lines: true },
            },
        },
    })
    if (!ledger) return null

    const reserved = await getReservedQuantities(ledger.id)
    const items = ledger.items.map((item) => serializeLedgerItem(item, reserved.get(item.id) ?? 0))
    const itemById = new Map(items.map((item) => [item.id, item]))

    const invoiceIds = ledger.drafts.map((draft) => draft.invoiceId).filter((id): id is string => Boolean(id))
    const invoices = invoiceIds.length
        ? await prisma.invoice.findMany({
            where: { tenantId, id: { in: invoiceIds } },
            select: { id: true, invoiceNumber: true, status: true, diInvoiceNumber: true },
        })
        : []
    const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]))

    return {
        id: ledger.id,
        fileName: ledger.fileName,
        createdAt: ledger.createdAt,
        sourceRowCount: ledger.sourceRowCount,
        sourceInvoiceCount: ledger.sourceInvoiceCount,
        sellerCount: ledger.sellerCount,
        periodFrom: ledger.periodFrom,
        periodTo: ledger.periodTo,
        totalQuantity: Number(ledger.totalQuantity),
        totalValueExclST: Number(ledger.totalValueExclST),
        totalSalesTax: Number(ledger.totalSalesTax),
        items,
        drafts: ledger.drafts.map((draft) => ({
            id: draft.id,
            sequence: draft.sequence,
            invoiceDate: draft.invoiceDate,
            status: draft.status,
            buyerName: draft.buyerName,
            buyerNTN: draft.buyerNTN,
            buyerRegistrationType: draft.buyerRegistrationType,
            subtotal: Number(draft.subtotal),
            taxAmount: Number(draft.taxAmount),
            totalAmount: Number(draft.totalAmount),
            invoice: draft.invoiceId ? invoiceById.get(draft.invoiceId) ?? null : null,
            lines: draft.lines.map((line) => {
                const item = itemById.get(line.itemId)
                return {
                    itemId: line.itemId,
                    hsCode: item?.hsCode ?? '',
                    productName: item?.productName ?? '',
                    uom: item?.uom ?? '',
                    quantity: Number(line.quantity),
                    unitPrice: Number(line.unitPrice),
                    retailValue: line.retailValue != null ? Number(line.retailValue) : null,
                    valueExclST: Number(line.valueExclST),
                    salesTax: Number(line.salesTax),
                    lineTotal: Number(line.lineTotal),
                }
            }),
        })),
    }
}

export function sumAmounts<T>(rows: T[], pick: (row: T) => number) {
    return round2(rows.reduce((sum, row) => sum + pick(row), 0))
}
