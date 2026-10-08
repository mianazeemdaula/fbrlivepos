import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@/generated/prisma/client'
import { round2 } from '@/lib/di/tax'
import { aggregateLedgerRows, LedgerParseError, parseLedgerWorkbook } from '@/lib/ledger/parser'
import { loadLedgerImport, requireLedgerAccess } from '@/lib/ledger/service'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = /\.(xls|xlsx|csv)$/i

export async function GET() {
    const access = await requireLedgerAccess()
    if (!access.ok) return access.response

    const imports = await prisma.ledgerImport.findMany({
        where: { tenantId: access.tenant.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
            items: { select: { totalQuantity: true } },
            _count: { select: { drafts: { where: { status: 'CREATED' } } } },
        },
    })

    // Remaining stock per import = pooled quantity − quantity held by pending/created drafts
    const reservedRows = imports.length
        ? await prisma.ledgerDraftLine.groupBy({
            by: ['itemId'],
            where: { draft: { importId: { in: imports.map((i) => i.id) }, status: { in: ['DRAFT', 'CREATED'] } } },
            _sum: { quantity: true },
        })
        : []
    const reservedItems = reservedRows.length
        ? await prisma.ledgerItem.findMany({
            where: { id: { in: reservedRows.map((r) => r.itemId) } },
            select: { id: true, importId: true },
        })
        : []
    const importOfItem = new Map(reservedItems.map((item) => [item.id, item.importId]))
    const reservedByImport = new Map<string, number>()
    for (const row of reservedRows) {
        const importId = importOfItem.get(row.itemId)
        if (importId) reservedByImport.set(importId, (reservedByImport.get(importId) ?? 0) + Number(row._sum.quantity ?? 0))
    }

    return NextResponse.json({
        imports: imports.map((ledger) => {
            const totalQuantity = Number(ledger.totalQuantity)
            return {
                id: ledger.id,
                fileName: ledger.fileName,
                createdAt: ledger.createdAt,
                periodFrom: ledger.periodFrom,
                periodTo: ledger.periodTo,
                sourceRowCount: ledger.sourceRowCount,
                itemCount: ledger.items.length,
                totalQuantity,
                remainingQuantity: Math.max(0, totalQuantity - (reservedByImport.get(ledger.id) ?? 0)),
                totalValueExclST: Number(ledger.totalValueExclST),
                createdInvoiceCount: ledger._count.drafts,
            }
        }),
    })
}

export async function POST(req: NextRequest) {
    const access = await requireLedgerAccess()
    if (!access.ok) return access.response
    const { tenant, userId } = access

    const formData = await req.formData().catch(() => null)
    const file = formData?.get('file')
    if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Choose the ledger file to upload.' }, { status: 400 })
    }
    if (!ALLOWED_EXTENSIONS.test(file.name)) {
        return NextResponse.json({ error: 'Upload the ledger as .xls, .xlsx or .csv.' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'The file is larger than 10 MB.' }, { status: 400 })
    }

    let parsed: ReturnType<typeof parseLedgerWorkbook>
    try {
        parsed = parseLedgerWorkbook(new Uint8Array(await file.arrayBuffer()))
    } catch (error) {
        if (error instanceof LedgerParseError) {
            return NextResponse.json({ error: error.message }, { status: 422 })
        }
        throw error
    }

    // Drop rows already imported earlier (same IRIS "Invoice Ref No."), and repeats within this file.
    const existing = await prisma.ledgerSourceRow.findMany({
        where: { tenantId: tenant.id, rowKey: { in: parsed.rows.map((row) => row.rowKey) } },
        select: { rowKey: true },
    })
    const seen = new Set(existing.map((row) => row.rowKey))
    const duplicates: number[] = []
    const rows = parsed.rows.filter((row) => {
        if (seen.has(row.rowKey)) {
            duplicates.push(row.rowNumber)
            return false
        }
        seen.add(row.rowKey)
        return true
    })

    if (!rows.length) {
        return NextResponse.json(
            {
                error: duplicates.length
                    ? 'Every row in this file has already been imported.'
                    : 'No importable rows were found in the file.',
                skipped: parsed.skipped,
                duplicateRows: duplicates,
            },
            { status: 422 },
        )
    }

    const items = aggregateLedgerRows(rows)
    const dates = rows.map((row) => row.invoiceDate?.getTime()).filter((t): t is number => t != null)

    const ledger = await prisma.$transaction(async (tx) => {
        const created = await tx.ledgerImport.create({
            data: {
                tenantId: tenant.id,
                fileName: file.name.slice(0, 200),
                createdById: userId,
                sourceRowCount: rows.length,
                sourceInvoiceCount: new Set(rows.map((row) => row.invoiceNo?.replace(/-\d+$/, '') ?? row.rowKey)).size,
                sellerCount: new Set(rows.map((row) => row.sellerNTN ?? row.sellerName ?? '')).size,
                periodFrom: dates.length ? new Date(Math.min(...dates)) : null,
                periodTo: dates.length ? new Date(Math.max(...dates)) : null,
                totalQuantity: Math.round(rows.reduce((sum, row) => sum + row.quantity, 0) * 1000) / 1000,
                totalValueExclST: round2(rows.reduce((sum, row) => sum + row.valueExclST, 0)),
                totalSalesTax: round2(rows.reduce((sum, row) => sum + row.salesTax, 0)),
            },
        })

        await tx.ledgerSourceRow.createMany({
            data: rows.map((row) => ({
                importId: created.id,
                tenantId: tenant.id,
                rowKey: row.rowKey,
                invoiceNo: row.invoiceNo,
                invoiceDate: row.invoiceDate,
                sellerNTN: row.sellerNTN,
                sellerName: row.sellerName,
                hsCode: row.hsCode,
                quantity: row.quantity,
                valueExclST: row.valueExclST,
                data: row.raw,
            })),
        })

        await tx.ledgerItem.createMany({
            data: items.map((item, index) => ({
                importId: created.id,
                tenantId: tenant.id,
                sortOrder: index,
                hsCode: item.hsCode,
                hsDescription: item.hsDescription,
                productName: item.productName.slice(0, 200),
                sourceDescriptions: item.sourceDescriptions.slice(0, 50),
                saleType: item.saleType,
                rate: item.rate,
                taxRate: item.taxRate,
                uom: item.uom,
                sroScheduleNo: item.sroScheduleNo,
                sroItemSerialNo: item.sroItemSerialNo,
                totalQuantity: item.totalQuantity,
                purchaseValueExclST: item.purchaseValueExclST,
                purchaseSalesTax: item.purchaseSalesTax,
                purchaseRetailValue: item.purchaseRetailValue,
                saleUnitPrice: item.saleUnitPrice,
                retailUnitPrice: item.retailUnitPrice,
                sourceRowCount: item.sourceRowCount,
            })),
        })

        return created
    }).catch((error: unknown) => {
        // Unique (tenantId, rowKey): the same rows were imported concurrently.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null
        throw error
    })
    if (!ledger) {
        return NextResponse.json({ error: 'These rows were just imported by another upload. Refresh the page.' }, { status: 409 })
    }

    return NextResponse.json(
        {
            import: await loadLedgerImport(tenant.id, ledger.id),
            skipped: parsed.skipped,
            duplicateRows: duplicates,
        },
        { status: 201 },
    )
}
