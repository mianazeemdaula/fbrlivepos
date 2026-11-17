import * as XLSX from 'xlsx'

/**
 * Sample ledger with only the columns the importer needs. A full IRIS "Domestic Invoices"
 * export also imports unchanged; its extra columns are ignored.
 *
 * Stock columns (Product Description … Item Sr. No.) and customer columns are independent:
 * a row can carry a purchase line, a customer, or both.
 */
export const LEDGER_TEMPLATE_HEADERS = [
    'Invoice No.', 'Invoice Date', 'Product Description', 'HS Code', 'Sale Type', 'Rate', 'UoM', 'Quantity',
    'Value of Sales Excluding Sales Tax', 'Retail Value',
    'SRO No. / Schedule No.', 'Item Sr. No.',
    'Customer Name', 'Customer CNIC',
] as const

const SAMPLE_ROWS: string[][] = [
    ['INV-1', '04-Aug-2026', '16 kg Tin', '1518.0000', '3rd Schedule Goods', '18%', 'KG', '928', '401012', '411220', '', '', 'Ali Traders', '35202-1234567-1'],
    ['INV-1', '04-Aug-2026', 'Jerry Cane', '1518.0000', '3rd Schedule Goods', '18%', 'KG', '10', '4290', '4400', '', '', 'Ali Traders', '35202-1234567-1'],
    ['INV-2', '05-Aug-2026', 'Steel Bucket 10L', '7323.9400', 'Goods at standard rate (default)', '18%', 'Numbers, pieces, units', '200', '90000', '', '', '', 'Bilal Store', '42101-1122334-5'],
    ['', '', '', '', '', '', '', '', '', '', '', '', 'Hamza Khan', '61101-9988776-7'],
]

const INSTRUCTIONS: string[][] = [
    ['How to use this template'],
    [''],
    ['Invoice No. / Invoice Date (used by Direct Invoices)'],
    ['  Rows with the same Invoice No. become one invoice; a row without an Invoice No. is an invoice on its own.'],
    ['  Invoice Date: 04-Aug-2026 or 2026-08-04; today when blank. Dates in the future are rejected.'],
    ['  Ledger Import ignores these two columns for stock.'],
    [''],
    ['Items (one row per line)'],
    ['  Required: Product Description, HS Code, Sale Type, Rate, Quantity, Value of Sales Excluding Sales Tax.'],
    ['  UoM: defaults to "Numbers, pieces, units" when blank.'],
    ['  Retail Value: required for 3rd Schedule Goods — retail price per unit × quantity for the line.'],
    ['  SRO No. / Schedule No. + Item Sr. No.: needed for exempt, reduced-rate and other SRO sale types. Leave blank'],
    ['    when the sale type + rate allow only one (e.g. 3rd Schedule Goods @ 18% → "3rd Schedule goods" / 51); it is filled in.'],
    ['  Stock is pooled by Product Description + HS Code (plus sale type, rate and UoM). Use the same name for the same item.'],
    [''],
    ['Customers (optional)'],
    ['  Customer Name + Customer CNIC (13 digits, dashes optional). Leave both empty for a walk-in (unregistered) buyer.'],
    ['  Direct Invoices: the buyer of that row\'s invoice; every row of one Invoice No. must name the same customer.'],
    ['  Ledger Import: generated invoices are spread across these customers; customer-only rows are allowed.'],
    [''],
    ['General'],
    ['  Delete the sample rows first. Numbers may include thousands separators.'],
    ['  A full "Domestic Invoices" (purchases) export from FBR IRIS can also be uploaded unchanged.'],
]

export function buildLedgerTemplate(): Buffer {
    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([[...LEDGER_TEMPLATE_HEADERS], ...SAMPLE_ROWS])
    sheet['!cols'] = LEDGER_TEMPLATE_HEADERS.map((header) => ({ wch: Math.max(16, header.length + 2) }))
    XLSX.utils.book_append_sheet(wb, sheet, 'Ledger')

    const help = XLSX.utils.aoa_to_sheet(INSTRUCTIONS)
    help['!cols'] = [{ wch: 120 }]
    XLSX.utils.book_append_sheet(wb, help, 'Instructions')

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
