import { calculateDILineValues, isThirdScheduleSaleType, round2 } from '@/lib/di/tax'
import type { LedgerRow } from '@/lib/ledger/parser'

/**
 * Direct invoices: every sheet row is a sale line exactly as written — no pooling, no
 * random split. Rows sharing an "Invoice No." form one invoice; a row without one is an
 * invoice on its own. The buyer is the row's customer (CNIC) or a walk-in buyer.
 */

export interface DirectLine {
    rowNumber: number
    productName: string
    hsCode: string
    saleType: string
    rate: string
    taxRate: number
    uom: string
    quantity: number
    unitPrice: number
    valueExclST: number
    retailValue: number | null // line-level (per-unit retail × qty)
    salesTax: number
    lineTotal: number
    sroScheduleNo: string | null
    sroItemSerialNo: string | null
}

export interface DirectInvoicePlan {
    key: string
    sheetInvoiceNo: string | null
    invoiceDate: string // YYYY-MM-DD
    buyerName: string
    buyerCnic: string | null
    lines: DirectLine[]
    subtotal: number
    taxAmount: number
    totalAmount: number
    issues: string[]
}

export const WALK_IN_BUYER = 'Walk-in Customer'

/** Pakistan Standard Time (UTC+5) calendar day — FBR rejects invoices dated in the future. */
export function todayPKT(now = Date.now()) {
    return new Date(now + 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function buildLine(row: LedgerRow): { line: DirectLine; issues: string[] } {
    const issues: string[] = []
    const where = `Row ${row.rowNumber}`
    if (!row.productDescription) issues.push(`${where}: Product Description is empty`)
    if (!(row.valueExclST > 0)) issues.push(`${where}: Value of Sales Excluding Sales Tax must be greater than zero`)
    const retailValue = row.retailValue > 0 ? row.retailValue : null
    if (isThirdScheduleSaleType(row.saleType) && !retailValue) issues.push(`${where}: 3rd Schedule Goods need a Retail Value`)
    if (row.customerError) issues.push(`${where}: ${row.customerError}`)

    const { salesTaxApplicable } = calculateDILineValues({
        saleType: row.saleType,
        taxRate: row.taxRate,
        valueSalesExcludingST: row.valueExclST,
        fixedNotifiedValueOrRetailPrice: retailValue,
    })
    return {
        issues,
        line: {
            rowNumber: row.rowNumber,
            productName: row.productDescription ?? '',
            hsCode: row.hsCode,
            saleType: row.saleType,
            rate: row.rate,
            taxRate: row.taxRate,
            uom: row.uom,
            quantity: row.quantity,
            unitPrice: round2(row.valueExclST / row.quantity),
            valueExclST: row.valueExclST,
            retailValue,
            salesTax: salesTaxApplicable,
            lineTotal: round2(row.valueExclST + salesTaxApplicable),
            sroScheduleNo: row.sroScheduleNo,
            sroItemSerialNo: row.sroItemSerialNo,
        },
    }
}

export function planDirectInvoices(rows: LedgerRow[], today = todayPKT()): DirectInvoicePlan[] {
    const groups = new Map<string, LedgerRow[]>()
    for (const row of rows) {
        const key = row.invoiceNo ? `no:${row.invoiceNo.toLowerCase()}` : `row:${row.rowNumber}`
        const group = groups.get(key)
        if (group) group.push(row)
        else groups.set(key, [row])
    }

    return [...groups.entries()].map(([key, group]) => {
        const first = group[0]
        const label = first.invoiceNo ? `Invoice ${first.invoiceNo}` : `Row ${first.rowNumber}`
        const issues: string[] = []
        const lines = group.map((row) => {
            const built = buildLine(row)
            issues.push(...built.issues)
            return built.line
        })

        const dates = new Set(group.map((row) => row.invoiceDate?.toISOString().slice(0, 10) ?? today))
        if (dates.size > 1) issues.push(`${label}: rows have different Invoice Dates`)
        const invoiceDate = [...dates][0]
        if (invoiceDate > today) issues.push(`${label}: Invoice Date ${invoiceDate} is in the future`)

        const buyers = new Set(group.map((row) => row.customerCnic ?? ''))
        if (buyers.size > 1) issues.push(`${label}: rows name different customers`)

        if (group.length > 100) issues.push(`${label}: more than 100 lines`)

        const subtotal = round2(lines.reduce((sum, line) => sum + line.valueExclST, 0))
        const taxAmount = round2(lines.reduce((sum, line) => sum + line.salesTax, 0))
        return {
            key,
            sheetInvoiceNo: first.invoiceNo,
            invoiceDate,
            buyerName: first.customerCnic && first.customerName ? first.customerName : WALK_IN_BUYER,
            buyerCnic: first.customerCnic,
            lines,
            subtotal,
            taxAmount,
            totalAmount: round2(subtotal + taxAmount),
            issues,
        }
    })
}
