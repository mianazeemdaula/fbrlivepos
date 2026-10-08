export interface LedgerItem {
    id: string
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
    reservedQuantity: number
    availableQuantity: number
    purchaseValueExclST: number
    purchaseSalesTax: number
    purchaseRetailValue: number
    saleUnitPrice: number
    retailUnitPrice: number | null
    sourceRowCount: number
    issues: string[]
}

export interface LedgerDraftLine {
    itemId: string
    hsCode: string
    productName: string
    uom: string
    quantity: number
    unitPrice: number
    retailValue: number | null
    valueExclST: number
    salesTax: number
    lineTotal: number
}

export interface LedgerDraft {
    id: string
    sequence: number
    invoiceDate: string
    status: 'DRAFT' | 'CREATED'
    buyerName: string | null
    buyerNTN: string | null
    buyerRegistrationType: string | null
    subtotal: number
    taxAmount: number
    totalAmount: number
    invoice: { id: string; invoiceNumber: string; status: string; diInvoiceNumber: string | null } | null
    lines: LedgerDraftLine[]
}

export interface LedgerImportDetail {
    id: string
    fileName: string
    createdAt: string
    sourceRowCount: number
    sourceInvoiceCount: number
    sellerCount: number
    periodFrom: string | null
    periodTo: string | null
    totalQuantity: number
    totalValueExclST: number
    totalSalesTax: number
    items: LedgerItem[]
    drafts: LedgerDraft[]
}

export interface LedgerImportSummary {
    id: string
    fileName: string
    createdAt: string
    periodFrom: string | null
    periodTo: string | null
    sourceRowCount: number
    itemCount: number
    totalQuantity: number
    remainingQuantity: number
    totalValueExclST: number
    createdInvoiceCount: number
}

export function formatAmount(value: number) {
    return value.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatQty(value: number) {
    return value.toLocaleString('en-PK', { maximumFractionDigits: 3 })
}

export function formatDay(value: string | null) {
    if (!value) return '—'
    // Ledger dates are stored at UTC midnight; format the calendar day as-is.
    return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export async function readError(res: Response, fallback: string) {
    const data = await res.json().catch(() => null)
    return (data && typeof data.error === 'string' && data.error) || fallback
}

export const inputClass =
    'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-primary disabled:bg-surface disabled:text-muted'
export const primaryButton =
    'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60'
export const secondaryButton =
    'inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60'
