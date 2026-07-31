import type { Invoice, InvoiceItem, DICredentials } from '@/generated/prisma/client'
import type { DIInvoicePayload } from './types'
import { getSellerIdentity } from './seller'
import { resolveDIRateDescriptor } from './rate'
import { calculateDILineValues, round2 } from './tax'

const DEFAULT_FALLBACK_UOM = 'Numbers, pieces, units'

type PreferredIdType = 'NTN' | 'CNIC'

type InvoiceWithItems = Invoice & { items: InvoiceItem[] }

export function buildDIPayload(
    invoice: InvoiceWithItems,
    creds: DICredentials,
    options?: {
        scenarioId?: string // Required for sandbox
        isSandbox?: boolean
        preferredIdType?: PreferredIdType
    },
): DIInvoicePayload {
    const seller = getSellerIdentity(creds, {
        preferredIdType: options?.preferredIdType,
    })

    return {
        invoiceType: (invoice.invoiceType as 'Sale Invoice' | 'Debit Note') ?? 'Sale Invoice',
        invoiceDate: invoice.invoiceDate.toISOString().split('T')[0], // "YYYY-MM-DD"

        // Seller details come from the tenant's DI credentials (registered with IRIS)
        sellerNTNCNIC: seller.sellerNTNCNIC,
        sellerBusinessName: seller.sellerBusinessName,
        sellerProvince: seller.sellerProvince,
        sellerAddress: seller.sellerAddress,

        // Buyer details from the invoice
        buyerNTNCNIC: invoice.buyerNTN ?? '',
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
            // The stored fixed/notified price is already line-level (per-unit × qty).
            const fixedNotifiedValueOrRetailPrice = round2(Number(item.diFixedNotifiedValueOrRetailPrice ?? 0))
            const valueSalesExcludingST = round2(Number(item.lineTotal ?? 0) - Number(item.taxAmount ?? 0))
            const { salesTaxApplicable, totalValues } = calculateDILineValues({
                saleType: item.diSaleType,
                taxRate: Number(item.taxRate),
                valueSalesExcludingST,
                fixedNotifiedValueOrRetailPrice,
            })

            return {
                hsCode: item.hsCode,
                productDescription: item.name,
                rate: item.diRate ?? resolveDIRateDescriptor({
                    diRate: item.diRate,
                    taxRate: Number(item.taxRate),
                    diSaleType: item.diSaleType,
                }),
                uoM: item.diUOM ?? item.unit ?? DEFAULT_FALLBACK_UOM,
                quantity: Number(item.quantity),
                totalValues,
                valueSalesExcludingST,
                fixedNotifiedValueOrRetailPrice,
                salesTaxApplicable,
                salesTaxWithheldAtSource: Number(item.diSalesTaxWithheldAtSource ?? 0),
                extraTax: Number(item.extraTax ?? 0),
                furtherTax: Number(item.furtherTax ?? 0),
                sroScheduleNo: item.sroScheduleNo ?? '',
                fedPayable: Number(item.fedPayable ?? 0),
                discount: Number(item.discount ?? 0),
                saleType: item.diSaleType ?? 'Goods at standard rate (default)',
                sroItemSerialNo: item.sroItemSerialNo ?? '',
            }
        }),
    }
}
