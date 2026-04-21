import type { Invoice, InvoiceItem, DICredentials } from '@/generated/prisma/client'
import type { DIInvoicePayload } from './types'
import { getSellerIdentity } from './seller'

type InvoiceWithItems = Invoice & { items: InvoiceItem[] }

function normalize(value: string | null | undefined) {
    return value?.trim().toLowerCase() ?? ''
}

function normalizeExtraTax(
    saleType: string | null | undefined,
    extraTax: number | { toString(): string } | null | undefined,
): number | '' {
    if (normalize(saleType) === 'goods at reduced rate' && Number(extraTax ?? 0) === 0) {
        return ''
    }

    return Number(Number(extraTax ?? 0).toFixed(2))
}

function resolveTotalValues(item: InvoiceItem, lineValue: number, salesTaxApplicable: number) {
    if (normalize(item.diSaleType) === '3rd schedule goods') {
        return Number((lineValue + salesTaxApplicable).toFixed(2))
    }

    return 0
}

export function buildDIPayload(
    invoice: InvoiceWithItems,
    creds: DICredentials,
    options?: {
        scenarioId?: string // Required for sandbox
        isSandbox?: boolean
    },
): DIInvoicePayload {
    const seller = getSellerIdentity(creds)

    return {
        invoiceType: (invoice.invoiceType as 'Sale Invoice' | 'Debit Note') ?? 'Sale Invoice',
        invoiceDate: invoice.invoiceDate.toISOString().split('T')[0], // "YYYY-MM-DD"

        // Seller details come from the tenant's DI credentials (registered with IRIS)
        sellerNTNCNIC: seller.sellerNTNCNIC,
        sellerBusinessName: seller.sellerBusinessName,
        sellerProvince: seller.sellerProvince,
        sellerAddress: seller.sellerAddress,

        // Buyer details from the invoice
        buyerNTNCNIC: invoice.buyerNTN ?? undefined,
        buyerBusinessName: invoice.buyerName ?? 'Walk-in Customer',
        buyerProvince: invoice.buyerProvince ?? creds.sellerProvince,
        buyerAddress: invoice.buyerAddress ?? invoice.buyerName ?? 'N/A',
        buyerRegistrationType: (invoice.buyerRegistrationType as 'Registered' | 'Unregistered') ?? 'Unregistered',

        // Required for Debit Notes (must be the FBR-issued invoice number of the original invoice)
        // Sale Invoices should send empty string
        invoiceRefNo: invoice.invoiceType === 'Debit Note'
            ? (invoice.diReferenceInvoiceNo ?? '')
            : '',

        // Sandbox testing scenario (omit in production)
        scenarioId: options?.isSandbox ? options.scenarioId : undefined,

        items: invoice.items.map((item) => {
            const lineDiscount = Number(item.discount ?? 0)
            const lineValue = Number(item.unitPrice) * Number(item.quantity) - lineDiscount
            const salesTaxApplicable = Number(Number(item.taxAmount).toFixed(2))
            return {
                hsCode: item.hsCode, // e.g. "8471.3000"
                productDescription: item.name,
                rate: item.diRate ?? '18%', // Must be exact string from Reference API 5.8
                uoM: item.diUOM ?? item.unit, // Must be exact string from Reference API 5.6
                quantity: Number(Number(item.quantity).toFixed(4)),
                totalValues: resolveTotalValues(item, lineValue, salesTaxApplicable),
                valueSalesExcludingST: Number(lineValue.toFixed(2)),
                fixedNotifiedValueOrRetailPrice: Number(Number(item.diFixedNotifiedValueOrRetailPrice ?? 0).toFixed(2)),
                salesTaxApplicable,
                salesTaxWithheldAtSource: Number(Number(item.diSalesTaxWithheldAtSource ?? 0).toFixed(2)),
                extraTax: normalizeExtraTax(item.diSaleType, item.extraTax),
                furtherTax: Number(Number(item.furtherTax ?? 0).toFixed(2)),
                sroScheduleNo: item.sroScheduleNo ?? '',
                fedPayable: Number(Number(item.fedPayable ?? 0).toFixed(2)),
                discount: Number(lineDiscount.toFixed(2)),
                saleType: item.diSaleType ?? 'Goods at standard rate (default)', // Exact string from Ref API (FBR docs: lowercase)
                sroItemSerialNo: item.sroItemSerialNo ?? '',
            }
        }),
    }
}
