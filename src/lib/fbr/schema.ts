import { z } from 'zod'

// ─── FBR Invoice Payload Schema ───────────────────────────────────────────────

export const FBRInvoiceItemSchema = z.object({
    ItemCode: z.string(),
    ItemName: z.string(),
    Quantity: z.number(),
    PCTCode: z.string(), // HS Code
    TaxRate: z.number(),
    SaleValue: z.number(),
    TotalAmount: z.number(),
    TaxCharged: z.number(),
    InvoiceType: z.number().default(1),
    RefUSIN: z.string().optional(),
})

export const FBRInvoicePayloadSchema = z.object({
    InvoiceNumber: z.string(),
    POSID: z.number(),
    USIN: z.string(),
    DateTime: z.string(),
    BuyerNTN: z.string().optional(),
    BuyerCNIC: z.string().optional(),
    BuyerName: z.string().optional(),
    BuyerPhoneNumber: z.string().optional(),
    TotalBillAmount: z.number(),
    TotalQuantity: z.number(),
    TotalSaleValue: z.number(),
    TotalTaxCharged: z.number(),
    Discount: z.number().default(0),
    FurtherTax: z.number().default(0),
    PaymentMode: z.number(),
    RefUSIN: z.string().optional(),
    InvoiceType: z.number().default(1),
    Items: z.array(FBRInvoiceItemSchema),
})

export type FBRInvoicePayload = z.infer<typeof FBRInvoicePayloadSchema>
export type FBRInvoiceItem = z.infer<typeof FBRInvoiceItemSchema>

export interface FBRResponse {
    InvoiceNumber: string
    Code: string
    Response: string
    Errors: string | null
    invoiceNumber?: string
    qrCode?: string
}
