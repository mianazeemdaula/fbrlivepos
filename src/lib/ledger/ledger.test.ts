import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { aggregateLedgerRows, LedgerParseError, withDefaultSro, parseLedgerDate, parseLedgerNumber, parseLedgerWorkbook } from './parser'
import { computeLedgerLine, generateLedgerDrafts, type GeneratorItem } from './generator'

// Mirrors the IRIS "Domestic Invoices" export: every cell is text.
const HEADERS = [
    'Invoice Ref No.', 'Status', 'Source Authority', 'Seller Return Status', 'Invoice No.', 'Invoice Type',
    'Invoice Date', 'Buyer Registration No.', 'Buyer Name', 'Taxpayer Type', 'Seller Registration No.',
    'Seller Name', 'Sale Type', 'Sale Origination Province of Supplier', 'Quantity', 'Product Description',
    'HS Code', 'HSCode Description', 'Rate', 'UoM', 'Value of Sales Excluding Sales Tax', 'Reason',
    'Reason Remarks', 'Sales Tax/ FED in ST Mode', 'Extra Tax', 'ST Withheld at Source',
    'SRO No. / Schedule No.', 'Item Sr. No.', 'Further Tax', 'Fixed / Notified value or Retail Price / Toll Charges',
    'Total Value of Sales',
]

function irisRow(overrides: Partial<Record<string, string>>) {
    const base: Record<string, string> = {
        'Invoice Ref No.': '3552183231', Status: 'Claimed', 'Invoice No.': '3952992DIU9W0PE747604-1',
        'Invoice Type': 'Purchase Invoice', 'Invoice Date': '04-Aug-2026', 'Seller Registration No.': '3952992',
        'Seller Name': 'FATIMA VEGETABLE OIL MILLS', 'Sale Type': ' 3rd Schedule Goods ', Quantity: '928.00',
        'Product Description': '16 kg Tin', 'HS Code': '1518.0000', Rate: '18%', UoM: 'KG',
        'Value of Sales Excluding Sales Tax': '401,012.00', 'Sales Tax/ FED in ST Mode': '74,019.60',
        'Fixed / Notified value or Retail Price / Toll Charges': '411,220.00', 'Total Value of Sales': '0.00',
    }
    const row = { ...base, ...overrides }
    return HEADERS.map((header) => row[header] ?? '')
}

function workbook(rows: string[][]) {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADERS, ...rows]), 'Domestic Invoices')
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

describe('ledger parser', () => {
    it('parses IRIS text cells', () => {
        expect(parseLedgerNumber('2,120,976.00')).toBe(2120976)
        expect(parseLedgerNumber('')).toBe(0)
        expect(parseLedgerDate('21-Aug-2026')?.toISOString()).toBe('2026-08-21T00:00:00.000Z')
    })

    it('reads rows, canonicalises sale type and skips cancelled rows', () => {
        const parsed = parseLedgerWorkbook(workbook([
            irisRow({}),
            irisRow({ 'Invoice Ref No.': '2', Status: 'Cancelled' }),
        ]))
        expect(parsed.rows).toHaveLength(1)
        expect(parsed.rows[0]).toMatchObject({
            saleType: '3rd Schedule Goods',
            hsCode: '1518.0000',
            rate: '18%',
            taxRate: 18,
            uom: 'KG',
            quantity: 928,
            valueExclST: 401012,
            retailValue: 411220,
            sroScheduleNo: '3rd Schedule goods',
            sroItemSerialNo: '51',
        })
        expect(parsed.skipped).toEqual([{ rowNumber: 3, reason: 'Excluded by status "Cancelled"' }])
    })

    it('keeps SRO values from the sheet and only fills unambiguous blanks', () => {
        expect(withDefaultSro('3rd Schedule Goods', '18%', null, null)).toEqual({ sroScheduleNo: '3rd Schedule goods', sroItemSerialNo: '51' })
        expect(withDefaultSro('3rd Schedule Goods', '18%', 'SRO 1/2026', '7')).toEqual({ sroScheduleNo: 'SRO 1/2026', sroItemSerialNo: '7' })
        expect(withDefaultSro('Goods at standard rate (default)', '18%', null, null)).toEqual({ sroScheduleNo: null, sroItemSerialNo: null })
        // Exempt goods has several schedules, so nothing is guessed
        expect(withDefaultSro('Exempt goods', 'Exempt', null, null)).toEqual({ sroScheduleNo: null, sroItemSerialNo: null })
    })

    it('rejects sheets without the IRIS columns', () => {
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['foo', 'bar'], ['1', '2']]), 'Sheet1')
        expect(() => parseLedgerWorkbook(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))).toThrow(LedgerParseError)
    })

    it('pools by HS code but keeps different tax treatments apart', () => {
        const parsed = parseLedgerWorkbook(workbook([
            irisRow({}),
            irisRow({ 'Invoice Ref No.': '2', Quantity: '10.00', 'Product Description': 'Jerry Cane', 'Value of Sales Excluding Sales Tax': '4,290.00', 'Fixed / Notified value or Retail Price / Toll Charges': '4,400.00' }),
            irisRow({ 'Invoice Ref No.': '3', Rate: '5%' }),
        ]))
        const items = aggregateLedgerRows(parsed.rows)
        expect(items).toHaveLength(2)
        const pooled = items.find((item) => item.rate === '18%')!
        expect(pooled.totalQuantity).toBe(938)
        expect(pooled.purchaseValueExclST).toBe(405302)
        expect(pooled.purchaseRetailValue).toBe(415620)
        expect(pooled.productName).toBe('16 kg Tin')
        expect(pooled.sourceDescriptions).toEqual(['16 kg Tin', 'Jerry Cane'])
    })
})

describe('ledger draft generator', () => {
    const ghee: GeneratorItem = {
        id: 'ghee',
        label: '1518.0000 · Ghee',
        availableQty: 4944,
        quantityStep: 1,
        unitPrice: 429,
        retailUnitPrice: 440,
        taxRate: 18,
        saleType: '3rd Schedule Goods',
    }
    const options = {
        from: new Date('2026-09-01T00:00:00.000Z'),
        to: new Date('2026-09-30T00:00:00.000Z'),
        count: 40,
        minAmount: 50_000,
        maxAmount: 80_000,
        maxItemsPerInvoice: 3,
        seed: 42,
    }

    it('taxes 3rd Schedule lines on the retail price', () => {
        expect(computeLedgerLine(ghee, 10)).toEqual({
            quantity: 10, unitPrice: 429, retailValue: 4400, valueExclST: 4290, salesTax: 792, lineTotal: 5082,
        })
    })

    it('respects stock, amount bounds and the date range', () => {
        const oil: GeneratorItem = { ...ghee, id: 'oil', label: 'oil', availableQty: 215, unitPrice: 429, retailUnitPrice: 440 }
        const result = generateLedgerDrafts([ghee, oil], options)

        expect(result.drafts).toHaveLength(40)
        for (const draft of result.drafts) {
            expect(draft.totalAmount).toBeGreaterThanOrEqual(options.minAmount)
            expect(draft.totalAmount).toBeLessThanOrEqual(options.maxAmount)
            expect(draft.invoiceDate.getTime()).toBeGreaterThanOrEqual(options.from.getTime())
            expect(draft.invoiceDate.getTime()).toBeLessThanOrEqual(options.to.getTime())
            expect(draft.lines.length).toBeLessThanOrEqual(3)
            for (const line of draft.lines) expect(Number.isInteger(line.quantity)).toBe(true)
        }
        const used = (id: string) => result.drafts.flatMap((d) => d.lines).filter((l) => l.itemId === id).reduce((s, l) => s + l.quantity, 0)
        expect(used('ghee')).toBeLessThanOrEqual(4944)
        expect(used('oil')).toBeLessThanOrEqual(215)

        const dates = result.drafts.map((d) => d.invoiceDate.getTime())
        expect(dates).toEqual([...dates].sort((a, b) => a - b))
    })

    it('sells all stock when the requested invoices have room for it', () => {
        const result = generateLedgerDrafts([{ ...ghee, availableQty: 500 }], { ...options, count: 5, minAmount: 10_000, maxAmount: 200_000 })
        const used = result.drafts.flatMap((d) => d.lines).reduce((s, l) => s + l.quantity, 0)
        expect(used).toBe(500)
        expect(result.warnings).toEqual([])
    })

    it('reduces the invoice count when stock cannot cover the minimum', () => {
        const result = generateLedgerDrafts([{ ...ghee, availableQty: 100 }], { ...options, count: 10, minAmount: 20_000 })
        expect(result.drafts.length).toBeLessThanOrEqual(2)
        expect(result.warnings[0]).toMatch(/only covers 2 invoice/)
    })

    it('is reproducible for a given seed', () => {
        const a = generateLedgerDrafts([ghee], options)
        const b = generateLedgerDrafts([ghee], options)
        expect(a.drafts.map((d) => d.totalAmount)).toEqual(b.drafts.map((d) => d.totalAmount))
    })
})
