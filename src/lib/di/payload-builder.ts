import type { Invoice, InvoiceItem, DICredentials } from '@/generated/prisma/client'
import type { DIInvoicePayload } from './types'

type InvoiceWithItems = Invoice & { items: InvoiceItem[] }

export function buildDIPayload(
    invoice: InvoiceWithItems,
    creds: DICredentials,
    options?: {
        scenarioId?: string // Required for sandbox
        isSandbox?: boolean
    },
): DIInvoicePayload {
    return {
        invoiceType: (invoice.invoiceType as 'Sale Invoice' | 'Debit Note') ?? 'Sale Invoice',
        invoiceDate: invoice.invoiceDate.toISOString().split('T')[0], // "YYYY-MM-DD"

        // Seller details come from the tenant's DI credentials (registered with IRIS)
        sellerNTNCNIC: creds.sellerNTN,
        sellerBusinessName: creds.sellerBusinessName,
        sellerProvince: creds.sellerProvince,
        sellerAddress: creds.sellerAddress,

        // Buyer details from the invoice
        buyerNTNCNIC: invoice.buyerNTN ?? undefined,
        buyerBusinessName: invoice.buyerName ?? 'Walk-in Customer',
        buyerProvince: invoice.buyerProvince ?? creds.sellerProvince,
        buyerAddress: invoice.buyerAddress ?? invoice.buyerName ?? 'N/A',
        buyerRegistrationType: (invoice.buyerRegistrationType as 'Registered' | 'Unregistered') ?? 'Unregistered',

        // For debit notes only
        invoiceRefNo: invoice.diReferenceInvoiceNo ?? undefined,

        // Sandbox testing scenario (omit in production)
        scenarioId: options?.isSandbox ? options.scenarioId : undefined,

        items: invoice.items.map((item) => {
            const lineDiscount = Number(item.discount ?? 0)
            const lineValue = Number(item.unitPrice) * Number(item.quantity) - lineDiscount
            return {
                hsCode: item.hsCode, // e.g. "8471.3000"
                productDescription: item.name,
                rate: item.diRate ?? '18%', // Must be exact string from Reference API 5.8
                uoM: item.diUOM ?? item.unit, // Must be exact string from Reference API 5.6
                quantity: Number(Number(item.quantity).toFixed(4)),
                totalValues: 0.0, // Only non-zero for 3rd schedule items
                valueSalesExcludingST: Number(lineValue.toFixed(2)),
                fixedNotifiedValueOrRetailPrice: 0.0,
                salesTaxApplicable: Number(Number(item.taxAmount).toFixed(2)),
                salesTaxWithheldAtSource: 0.0,
                extraTax: Number(Number(item.extraTax ?? 0).toFixed(2)),
                furtherTax: Number(Number(item.furtherTax ?? 0).toFixed(2)),
                sroScheduleNo: item.sroScheduleNo ?? '',
                fedPayable: Number(Number(item.fedPayable ?? 0).toFixed(2)),
                discount: Number(lineDiscount.toFixed(2)),
                saleType: item.diSaleType ?? 'Goods at Standard Rate (default)', // Exact string from Ref API
                sroItemSerialNo: item.sroItemSerialNo ?? '',
            }
        }),
    }
}
