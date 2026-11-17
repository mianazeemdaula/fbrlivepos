import * as XLSX from 'xlsx'

/**
 * Sample ledger in the IRIS "Domestic Invoices" layout. Only the columns the parser
 * reads are included; extra IRIS columns in a real export are ignored on import.
 */
export const LEDGER_TEMPLATE_HEADERS = [
    'Invoice Ref No.', 'Status', 'Invoice No.', 'Invoice Type', 'Invoice Date',
    'Seller Registration No.', 'Seller Name', 'Sale Type', 'Quantity', 'Product Description',
    'HS Code', 'HSCode Description', 'Rate', 'UoM', 'Value of Sales Excluding Sales Tax',
    'Sales Tax/ FED in ST Mode', 'SRO No. / Schedule No.', 'Item Sr. No.',
    'Fixed / Notified value or Retail Price / Toll Charges',
] as const

const SAMPLE_ROWS: string[][] = [
    ['1000000001', 'Claimed', '1234567DI0000000001-1', 'Purchase Invoice', '04-Aug-2026', '1234567', 'SAMPLE SUPPLIER (PVT) LTD', '3rd Schedule Goods', '928.00', '16 kg Tin', '1518.0000', 'Animal or vegetable fats and oils', '18%', 'KG', '401,012.00', '74,019.60', '3rd Schedule goods', '51', '411,220.00'],
    ['1000000002', 'Claimed', '1234567DI0000000001-2', 'Purchase Invoice', '04-Aug-2026', '1234567', 'SAMPLE SUPPLIER (PVT) LTD', '3rd Schedule Goods', '10.00', 'Jerry Cane', '1518.0000', 'Animal or vegetable fats and oils', '18%', 'KG', '4,290.00', '792.00', '3rd Schedule goods', '51', '4,400.00'],
    ['1000000003', 'Claimed', '7654321DI0000000002-1', 'Purchase Invoice', '12-Aug-2026', '7654321', 'SAMPLE TRADERS', 'Goods at standard rate (default)', '200.00', 'Steel Bucket 10L', '7323.9400', 'Table, kitchen or other household articles', '18%', 'Numbers, pieces, units', '90,000.00', '16,200.00', '', '', '0.00'],
]

const INSTRUCTIONS: string[][] = [
    ['How to use this template'],
    [''],
    ['1. Easiest: download "Domestic Invoices" (purchases) from FBR IRIS and upload it unchanged.'],
    ['2. Or fill the "Domestic Invoices" sheet of this file, one row per invoice line. Delete the sample rows first.'],
    ['3. Required columns: HS Code, Quantity, Sale Type, Rate, Value of Sales Excluding Sales Tax.'],
    ['4. Stock is pooled by Product Description + HS Code (plus sale type, rate, UoM and SRO). Use the same item name for the same item.'],
    ['5. Invoice Ref No. must be unique per row; it stops the same row being imported twice.'],
    ['6. Rows with status Cancelled/Rejected/Deleted and Debit/Credit notes are skipped.'],
    ['7. 3rd Schedule Goods need the retail price column (Fixed / Notified value or Retail Price).'],
    ['8. Dates: 04-Aug-2026 or 2026-08-04. Numbers may include thousands separators.'],
]

export function buildLedgerTemplate(): Buffer {
    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([[...LEDGER_TEMPLATE_HEADERS], ...SAMPLE_ROWS])
    sheet['!cols'] = LEDGER_TEMPLATE_HEADERS.map((header) => ({ wch: Math.max(14, header.length + 2) }))
    XLSX.utils.book_append_sheet(wb, sheet, 'Domestic Invoices')

    const help = XLSX.utils.aoa_to_sheet(INSTRUCTIONS)
    help['!cols'] = [{ wch: 120 }]
    XLSX.utils.book_append_sheet(wb, help, 'Instructions')

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
