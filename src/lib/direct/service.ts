import { createHash } from 'node:crypto'
import { prisma } from '@/lib/db/prisma'
import { parseLedgerWorkbook } from '@/lib/ledger/parser'
import { getNextInvoiceNumber } from '@/lib/invoices/numbering'
import { round2 } from '@/lib/di/tax'
import { planDirectInvoices, type DirectInvoicePlan } from './plan'

export interface DirectFilePreview {
    fileHash: string
    invoices: DirectInvoicePlan[]
    /** Problems that block creating the batch: rows the parser dropped + per-invoice issues. */
    errors: string[]
}

/** Parses the template sheet into invoices. Throws LedgerParseError for unreadable files. */
export function previewDirectFile(bytes: Uint8Array): DirectFilePreview {
    const parsed = parseLedgerWorkbook(bytes)
    const invoices = planDirectInvoices(parsed.rows)
    const rowNumbers = new Set(parsed.rows.map((row) => row.rowNumber))
    const errors = [
        // Customer problems on item rows are already reported per invoice.
        ...parsed.skipped.filter((s) => !rowNumbers.has(s.rowNumber)).map((s) => `Row ${s.rowNumber}: ${s.reason}`),
        ...invoices.flatMap((invoice) => invoice.issues),
    ]
    if (!invoices.length) errors.push('The sheet has no item rows.')
    return {
        fileHash: createHash('sha256').update(bytes).digest('hex'),
        invoices,
        errors,
    }
}

/** Creates DRAFT invoices for every planned invoice, in sheet order. Caller checks limits first. */
export async function createDirectInvoices(params: {
    tenantId: string
    userId: string
    fileName: string
    fileHash: string
    invoices: DirectInvoicePlan[]
}) {
    const { tenantId, userId, invoices } = params
    const creds = await prisma.dICredentials.findUnique({
        where: { tenantId },
        select: { environment: true, sellerProvince: true },
    })
    const diEnvironment = creds?.environment ?? 'SANDBOX'

    const invoiceIds: string[] = []
    for (const plan of invoices) {
        const invoiceNumber = await getNextInvoiceNumber(tenantId)
        const invoice = await prisma.$transaction(async (tx) => {
            // InvoiceItem needs a productId: back each line with an inactive product,
            // kept out of the POS catalogue like POS direct items.
            const productIds: string[] = []
            for (const line of plan.lines) {
                const product = await tx.product.create({
                    data: {
                        tenantId,
                        name: line.productName.slice(0, 200),
                        sku: `DIRECT-${invoiceNumber}-${line.rowNumber}`,
                        hsCode: line.hsCode,
                        price: line.unitPrice,
                        taxRate: line.taxRate,
                        unit: line.uom,
                        diUOM: line.uom,
                        diRate: line.rate,
                        diSaleType: line.saleType,
                        diFixedNotifiedValueOrRetailPrice: line.retailValue != null ? round2(line.retailValue / line.quantity) : null,
                        sroScheduleNo: line.sroScheduleNo,
                        sroItemSerialNo: line.sroItemSerialNo,
                        isActive: false,
                    },
                })
                productIds.push(product.id)
            }

            return tx.invoice.create({
                data: {
                    tenantId,
                    userId,
                    invoiceNumber,
                    invoiceDate: new Date(`${plan.invoiceDate}T00:00:00.000Z`),
                    buyerName: plan.buyerName,
                    buyerNTN: plan.buyerCnic,
                    buyerProvince: creds?.sellerProvince ?? null,
                    buyerRegistrationType: 'Unregistered',
                    subtotal: plan.subtotal,
                    taxAmount: plan.taxAmount,
                    discountAmount: 0,
                    totalAmount: plan.totalAmount,
                    paymentMethod: 'CASH',
                    status: 'DRAFT',
                    invoiceType: 'Sale Invoice',
                    diEnvironment,
                    items: {
                        create: plan.lines.map((line, index) => ({
                            productId: productIds[index],
                            hsCode: line.hsCode,
                            name: line.productName,
                            quantity: line.quantity,
                            unit: line.uom,
                            unitPrice: line.unitPrice,
                            taxRate: line.taxRate,
                            taxAmount: line.salesTax,
                            // The payload derives valueSalesExcludingST as lineTotal − taxAmount, so the
                            // sheet value is sent exactly (unitPrice is display-only and may be rounded).
                            lineTotal: line.lineTotal,
                            diRate: line.rate,
                            diUOM: line.uom,
                            diSaleType: line.saleType,
                            diFixedNotifiedValueOrRetailPrice: line.retailValue,
                            sroScheduleNo: line.sroScheduleNo,
                            sroItemSerialNo: line.sroItemSerialNo,
                            discount: 0,
                        })),
                    },
                },
            })
        })
        invoiceIds.push(invoice.id)
    }

    return prisma.directInvoiceBatch.create({
        data: {
            tenantId,
            fileName: params.fileName.slice(0, 200),
            fileHash: params.fileHash,
            createdById: userId,
            invoiceIds,
            invoiceCount: invoiceIds.length,
            totalAmount: round2(invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0)),
        },
    })
}

export async function loadDirectBatch(tenantId: string, batchId: string) {
    const batch = await prisma.directInvoiceBatch.findFirst({ where: { id: batchId, tenantId } })
    if (!batch) return null
    const invoices = await prisma.invoice.findMany({
        where: { tenantId, id: { in: batch.invoiceIds } },
        select: {
            id: true, invoiceNumber: true, invoiceDate: true, buyerName: true, buyerNTN: true,
            totalAmount: true, status: true, diInvoiceNumber: true, diErrorMessage: true, submissionError: true,
            _count: { select: { items: true } },
        },
    })
    const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]))
    return {
        id: batch.id,
        fileName: batch.fileName,
        createdAt: batch.createdAt,
        totalAmount: Number(batch.totalAmount),
        invoices: batch.invoiceIds.flatMap((id) => {
            const invoice = byId.get(id)
            if (!invoice) return []
            return [{
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                invoiceDate: invoice.invoiceDate,
                buyerName: invoice.buyerName,
                buyerNTN: invoice.buyerNTN,
                lineCount: invoice._count.items,
                totalAmount: Number(invoice.totalAmount),
                status: invoice.status,
                diInvoiceNumber: invoice.diInvoiceNumber,
                error: invoice.diErrorMessage ?? invoice.submissionError ?? null,
            }]
        }),
    }
}
