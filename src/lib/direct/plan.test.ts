import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { parseLedgerWorkbook } from '@/lib/ledger/parser'
import { buildLedgerTemplate, LEDGER_TEMPLATE_HEADERS } from '@/lib/ledger/template'
import { planDirectInvoices, WALK_IN_BUYER } from './plan'

function sheet(rows: string[][]) {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[...LEDGER_TEMPLATE_HEADERS], ...rows]), 'Ledger')
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

const bucket = (invoiceNo: string, overrides: Partial<Record<number, string>> = {}) => {
    const row = [invoiceNo, '10-Sep-2026', 'Steel Bucket 10L', '7323.9400', 'Goods at standard rate (default)', '18%', 'Numbers, pieces, units', '10', '4500', '', 'Ali Traders', '35202-1234567-1']
    for (const [index, value] of Object.entries(overrides)) row[Number(index)] = value!
    return row
}

describe('direct invoice plan', () => {
    it('turns the template into invoices exactly as written', () => {
        const plans = planDirectInvoices(parseLedgerWorkbook(buildLedgerTemplate()).rows, '2026-11-17')
        expect(plans).toHaveLength(2)
        const [first, second] = plans
        expect(first).toMatchObject({ sheetInvoiceNo: 'INV-1', invoiceDate: '2026-08-04', buyerName: 'Ali Traders', buyerCnic: '3520212345671', issues: [] })
        expect(first.lines.map((line) => [line.productName, line.quantity, line.valueExclST])).toEqual([['16 kg Tin', 928, 401012], ['Jerry Cane', 10, 4290]])
        // 3rd Schedule tax is on the retail value
        expect(first.lines[0].salesTax).toBe(74019.6)
        expect(second).toMatchObject({ sheetInvoiceNo: 'INV-2', subtotal: 90000, taxAmount: 16200, totalAmount: 106200, issues: [] })
    })

    it('makes one invoice per row without an Invoice No. and uses walk-in when no customer', () => {
        const plans = planDirectInvoices(parseLedgerWorkbook(sheet([
            bucket('', { 10: '', 11: '' }),
            bucket(''),
        ])).rows, '2026-11-17')
        expect(plans).toHaveLength(2)
        expect(plans[0]).toMatchObject({ buyerName: WALK_IN_BUYER, buyerCnic: null })
        expect(plans[1]).toMatchObject({ buyerName: 'Ali Traders', buyerCnic: '3520212345671' })
    })

    it('defaults the date to today and flags future dates, mixed customers and missing retail values', () => {
        const plans = planDirectInvoices(parseLedgerWorkbook(sheet([
            bucket('A', { 1: '' }),
            bucket('B', { 1: '01-Dec-2026' }),
            bucket('C'),
            bucket('C', { 11: '35202-1234567-9' }),
            bucket('D', { 4: '3rd Schedule Goods' }),
            bucket('E', { 11: '123' }),
        ])).rows, '2026-11-17')
        const byNo = new Map(plans.map((plan) => [plan.sheetInvoiceNo, plan]))
        expect(byNo.get('A')).toMatchObject({ invoiceDate: '2026-11-17', issues: [] })
        expect(byNo.get('B')!.issues).toEqual(['Invoice B: Invoice Date 2026-12-01 is in the future'])
        expect(byNo.get('C')!.issues).toEqual(['Invoice C: rows name different customers'])
        expect(byNo.get('D')!.issues).toEqual(['Row 6: 3rd Schedule Goods need a Retail Value'])
        expect(byNo.get('E')!.issues).toEqual(['Row 7: Customer "Ali Traders" needs a 13-digit CNIC'])
    })
})
