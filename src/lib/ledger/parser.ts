import * as XLSX from 'xlsx'
import { SALE_TYPE_LIST } from '@/lib/di/sale-type-config'
import { resolveDIRateDescriptor } from '@/lib/di/rate'
import { round2 } from '@/lib/di/tax'

/**
 * Parser for the "Domestic Invoices" ledger sheet downloaded from FBR IRIS.
 * IRIS exports every cell as text ("401,012.00", "18%", "04-Aug-2026"), but
 * re-saved copies may carry real numbers/dates, so every reader accepts both.
 */

export interface LedgerRow {
    rowNumber: number // 1-based sheet row, for error messages
    rowKey: string
    invoiceRefNo: string | null
    invoiceNo: string | null
    invoiceType: string | null
    invoiceDate: Date | null
    status: string | null
    sellerNTN: string | null
    sellerName: string | null
    saleType: string
    quantity: number
    productDescription: string | null
    hsCode: string
    hsDescription: string | null
    rate: string
    taxRate: number
    uom: string
    valueExclST: number
    salesTax: number
    retailValue: number
    sroScheduleNo: string | null
    sroItemSerialNo: string | null
    raw: Record<string, string | number | null>
}

export interface SkippedLedgerRow {
    rowNumber: number
    reason: string
}

export interface ParsedLedger {
    sheetName: string
    rows: LedgerRow[]
    skipped: SkippedLedgerRow[]
}

export class LedgerParseError extends Error {}

// Normalised header (lowercase, alphanumerics only) → field
const HEADER_MAP: Record<string, string> = {
    invoicerefno: 'invoiceRefNo',
    status: 'status',
    invoiceno: 'invoiceNo',
    invoicetype: 'invoiceType',
    invoicedate: 'invoiceDate',
    sellerregistrationno: 'sellerNTN',
    sellername: 'sellerName',
    saletype: 'saleType',
    quantity: 'quantity',
    productdescription: 'productDescription',
    hscode: 'hsCode',
    hscodedescription: 'hsDescription',
    rate: 'rate',
    uom: 'uom',
    valueofsalesexcludingsalestax: 'valueExclST',
    salestaxfedinstmode: 'salesTax',
    sronoscheduleno: 'sroScheduleNo',
    itemsrno: 'sroItemSerialNo',
    fixednotifiedvalueorretailpricetollcharges: 'retailValue',
}

const REQUIRED_FIELDS = ['hsCode', 'quantity', 'saleType', 'rate', 'valueExclST'] as const

const MONTHS: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

function normalizeHeader(value: unknown): string {
    return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function cleanText(value: unknown): string | null {
    if (value == null) return null
    const text = String(value).replace(/\s+/g, ' ').trim()
    return text.length ? text : null
}

export function parseLedgerNumber(value: unknown): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0
    const text = cleanText(value)
    if (!text) return 0
    // "(1,234.00)" is an accounting negative
    const negative = /^\(.*\)$/.test(text) || text.startsWith('-')
    const numeric = Number(text.replace(/[^0-9.]/g, ''))
    if (!Number.isFinite(numeric)) return 0
    return negative ? -numeric : numeric
}

/** Parses "04-Aug-2026", "2026-08-04", "04/08/2026" (day first), Excel serials and Date cells → UTC midnight. */
export function parseLedgerDate(value: unknown): Date | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime())
            ? null
            : new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        const parsed = XLSX.SSF.parse_date_code(value)
        return parsed ? new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)) : null
    }
    const text = cleanText(value)
    if (!text) return null

    let match = text.match(/^(\d{1,2})[-\s/]([A-Za-z]{3})[A-Za-z]*[-\s/](\d{4})/)
    if (match) {
        const month = MONTHS[match[2].toLowerCase()]
        if (month === undefined) return null
        return new Date(Date.UTC(Number(match[3]), month, Number(match[1])))
    }
    match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/)
    if (match) return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])))
    return null
}

/** Maps the sheet's sale type onto the exact (case-sensitive) PRAL label when we know it. */
export function canonicalSaleType(value: string): string {
    const key = value.trim().toLowerCase()
    return SALE_TYPE_LIST.find((config) => config.label.toLowerCase() === key)?.label ?? value.trim()
}

export function taxRateFromDescriptor(rate: string): number {
    const match = rate.match(/(\d+(?:\.\d+)?)\s*%/)
    if (match) return Number(match[1])
    const numeric = Number(rate)
    return Number.isFinite(numeric) ? numeric : 0
}

/**
 * IRIS often leaves "SRO No. / Schedule No." and "Item Sr. No." blank on purchase rows, but
 * some sale types require them on the sale invoice. When the sale type + rate allow exactly one
 * SRO and one item no. (e.g. 3rd Schedule Goods @ 18% → "3rd Schedule goods" / "51"), fill
 * them in. Values present in the sheet are always kept as-is.
 */
export function withDefaultSro(saleType: string, rate: string, sroScheduleNo: string | null, sroItemSerialNo: string | null) {
    if (sroScheduleNo && sroItemSerialNo) return { sroScheduleNo, sroItemSerialNo }

    const configs = SALE_TYPE_LIST.filter((config) => config.label.toLowerCase() === saleType.toLowerCase() && config.requiresSRO)
    const sros = configs
        .flatMap((config) => config.fallbackRates)
        .filter((option) => option.desc.toLowerCase() === rate.toLowerCase())
        .flatMap((option) => option.sros)
    const uniqueSros = [...new Map(sros.map((sro) => [sro.desc, sro])).values()]

    let resolvedSro = sroScheduleNo
    if (!resolvedSro && uniqueSros.length === 1) resolvedSro = uniqueSros[0].desc

    let resolvedItem = sroItemSerialNo
    const sro = uniqueSros.find((option) => option.desc === resolvedSro)
    if (!resolvedItem && sro && sro.srItems.length === 1) resolvedItem = sro.srItems[0].desc

    return { sroScheduleNo: resolvedSro, sroItemSerialNo: resolvedItem }
}

function isNonSaleRow(status: string | null, invoiceType: string | null): string | null {
    const s = status?.toLowerCase() ?? ''
    if (/cancel|reject|delete/.test(s)) return `status "${status}"`
    const t = invoiceType?.toLowerCase() ?? ''
    if (/debit|credit/.test(t)) return `invoice type "${invoiceType}" (adjust stock manually)`
    return null
}

export function parseLedgerWorkbook(data: ArrayBuffer | Uint8Array): ParsedLedger {
    let workbook: XLSX.WorkBook
    try {
        workbook = XLSX.read(data, { type: 'array', cellDates: true })
    } catch {
        throw new LedgerParseError('The file could not be read. Upload the .xls/.xlsx ledger exactly as downloaded from IRIS.')
    }

    for (const sheetName of workbook.SheetNames) {
        const table = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
            header: 1,
            raw: true,
            defval: null,
            blankrows: false,
        })

        const headerIndex = table.findIndex((row) =>
            row.some((cell) => normalizeHeader(cell) === 'hscode') &&
            row.some((cell) => normalizeHeader(cell) === 'quantity'),
        )
        if (headerIndex === -1) continue

        const headers = table[headerIndex].map((cell) => String(cell ?? '').trim())
        const columns = new Map<string, number>()
        headers.forEach((header, index) => {
            const field = HEADER_MAP[normalizeHeader(header)]
            if (field && !columns.has(field)) columns.set(field, index)
        })

        const missing = REQUIRED_FIELDS.filter((field) => !columns.has(field))
        if (missing.length) {
            throw new LedgerParseError(`Sheet "${sheetName}" is missing required column(s): ${missing.join(', ')}.`)
        }

        const rows: LedgerRow[] = []
        const skipped: SkippedLedgerRow[] = []

        table.slice(headerIndex + 1).forEach((cells, offset) => {
            const rowNumber = headerIndex + offset + 2
            const get = (field: string) => {
                const index = columns.get(field)
                return index === undefined ? null : (cells[index] as unknown)
            }

            const hsCode = cleanText(get('hsCode'))
            const quantity = parseLedgerNumber(get('quantity'))
            if (!hsCode && quantity === 0) return // trailing/total rows

            const status = cleanText(get('status'))
            const invoiceType = cleanText(get('invoiceType'))
            const excluded = isNonSaleRow(status, invoiceType)
            if (excluded) {
                skipped.push({ rowNumber, reason: `Excluded by ${excluded}` })
                return
            }
            if (!hsCode) {
                skipped.push({ rowNumber, reason: 'HS Code is empty' })
                return
            }
            if (quantity <= 0) {
                skipped.push({ rowNumber, reason: 'Quantity must be greater than zero' })
                return
            }
            const rawSaleType = cleanText(get('saleType'))
            const rawRate = cleanText(get('rate'))
            if (!rawSaleType || !rawRate) {
                skipped.push({ rowNumber, reason: 'Sale Type or Rate is empty' })
                return
            }

            const saleType = canonicalSaleType(rawSaleType)
            const rate = resolveDIRateDescriptor({ diRate: rawRate, diSaleType: saleType }) || rawRate
            const valueExclST = round2(parseLedgerNumber(get('valueExclST')))
            const invoiceRefNo = cleanText(get('invoiceRefNo'))
            const invoiceNo = cleanText(get('invoiceNo'))

            const raw: Record<string, string | number | null> = {}
            headers.forEach((header, index) => {
                if (!header) return
                const cell = cells[index]
                raw[header] = cell instanceof Date ? cell.toISOString() : (cell as string | number | null)
            })

            rows.push({
                rowNumber,
                rowKey: invoiceRefNo ?? `${invoiceNo ?? 'row'}|${hsCode}|${quantity}|${valueExclST}`,
                invoiceRefNo,
                invoiceNo,
                invoiceType,
                invoiceDate: parseLedgerDate(get('invoiceDate')),
                status,
                sellerNTN: cleanText(get('sellerNTN')),
                sellerName: cleanText(get('sellerName')),
                saleType,
                quantity,
                productDescription: cleanText(get('productDescription')),
                hsCode,
                hsDescription: cleanText(get('hsDescription')),
                rate,
                taxRate: taxRateFromDescriptor(rate),
                uom: cleanText(get('uom')) ?? 'Numbers, pieces, units',
                valueExclST,
                salesTax: round2(parseLedgerNumber(get('salesTax'))),
                retailValue: round2(parseLedgerNumber(get('retailValue'))),
                ...withDefaultSro(saleType, rate, cleanText(get('sroScheduleNo')), cleanText(get('sroItemSerialNo'))),
                raw,
            })
        })

        return { sheetName, rows, skipped }
    }

    throw new LedgerParseError('No ledger sheet found. The file must contain the IRIS columns "HS Code" and "Quantity".')
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

export interface LedgerItemDraft {
    key: string
    hsCode: string
    hsDescription: string | null
    productName: string
    sourceDescriptions: string[]
    saleType: string
    rate: string
    taxRate: number
    uom: string
    sroScheduleNo: string | null
    sroItemSerialNo: string | null
    totalQuantity: number
    purchaseValueExclST: number
    purchaseSalesTax: number
    purchaseRetailValue: number
    saleUnitPrice: number
    retailUnitPrice: number | null
    sourceRowCount: number
}

function round3(value: number) {
    return Math.round(value * 1000) / 1000
}

/**
 * Pools rows by HS code plus every field that decides how the line is taxed
 * (sale type, rate, UoM, SRO schedule, SRO item no). Rows that differ in any of
 * those stay in separate pools so generated sale lines never mix tax treatments.
 */
export function aggregateLedgerRows(rows: LedgerRow[]): LedgerItemDraft[] {
    const groups = new Map<string, { item: LedgerItemDraft; descriptionQty: Map<string, number> }>()

    for (const row of rows) {
        const key = [row.hsCode, row.saleType, row.rate, row.uom, row.sroScheduleNo ?? '', row.sroItemSerialNo ?? '']
            .map((part) => part.toLowerCase())
            .join('|')

        let group = groups.get(key)
        if (!group) {
            group = {
                item: {
                    key,
                    hsCode: row.hsCode,
                    hsDescription: row.hsDescription,
                    productName: '',
                    sourceDescriptions: [],
                    saleType: row.saleType,
                    rate: row.rate,
                    taxRate: row.taxRate,
                    uom: row.uom,
                    sroScheduleNo: row.sroScheduleNo,
                    sroItemSerialNo: row.sroItemSerialNo,
                    totalQuantity: 0,
                    purchaseValueExclST: 0,
                    purchaseSalesTax: 0,
                    purchaseRetailValue: 0,
                    saleUnitPrice: 0,
                    retailUnitPrice: null,
                    sourceRowCount: 0,
                },
                descriptionQty: new Map(),
            }
            groups.set(key, group)
        }

        const { item, descriptionQty } = group
        item.totalQuantity = round3(item.totalQuantity + row.quantity)
        item.purchaseValueExclST = round2(item.purchaseValueExclST + row.valueExclST)
        item.purchaseSalesTax = round2(item.purchaseSalesTax + row.salesTax)
        item.purchaseRetailValue = round2(item.purchaseRetailValue + row.retailValue)
        item.sourceRowCount += 1
        if (row.productDescription) {
            descriptionQty.set(row.productDescription, (descriptionQty.get(row.productDescription) ?? 0) + row.quantity)
        }
    }

    return [...groups.values()].map(({ item, descriptionQty }) => {
        const descriptions = [...descriptionQty.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
        return {
            ...item,
            sourceDescriptions: descriptions,
            // The highest-volume description is the most representative default; editable in the wizard.
            productName: descriptions[0] ?? item.hsDescription?.slice(0, 120) ?? item.hsCode,
            saleUnitPrice: round2(item.purchaseValueExclST / item.totalQuantity),
            retailUnitPrice: item.purchaseRetailValue > 0 ? round2(item.purchaseRetailValue / item.totalQuantity) : null,
        }
    })
}
