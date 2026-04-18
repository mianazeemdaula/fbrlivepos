export interface DIInvoicePayload {
    invoiceType: 'Sale Invoice' | 'Debit Note'
    invoiceDate: string // "YYYY-MM-DD" format ONLY

    sellerNTNCNIC: string // 7-digit NTN or 13-digit CNIC
    sellerBusinessName: string
    sellerProvince: string // Use exact description from Reference API 5.1
    sellerAddress: string

    buyerNTNCNIC?: string // Optional ONLY if buyerRegistrationType = "Unregistered"
    buyerBusinessName: string
    buyerProvince: string
    buyerAddress: string
    buyerRegistrationType: 'Registered' | 'Unregistered'

    invoiceRefNo?: string // REQUIRED for Debit Note (22 or 28 digit FBR invoice number)
    scenarioId?: string // REQUIRED for Sandbox ONLY (e.g. "SN001")

    items: DIInvoiceItem[]
}

export interface DIInvoiceItem {
    hsCode: string // Format: "XXXX.XXXX" e.g. "0101.2100"
    productDescription: string
    rate: string // Exact value from Reference API 5.8 ratE_DESC e.g. "18%"
    uoM: string // Exact value from Reference API 5.6 description
    quantity: number // Decimal, 4 decimal places e.g. 1.0000
    totalValues: number // Total including tax (0.00 if not 3rd schedule)
    valueSalesExcludingST: number // Sale value EXCLUDING sales tax
    fixedNotifiedValueOrRetailPrice: number // 0.00 unless fixed price item
    salesTaxApplicable: number // GST amount (NOT including further/extra tax)
    salesTaxWithheldAtSource: number // Usually 0.00
    extraTax: number // 0.00 if not applicable
    furtherTax: number // 0.00 if not applicable
    sroScheduleNo?: string // Required if saleType uses SRO
    fedPayable: number // 0.00 if no FED
    discount: number // 0.00 if no discount
    saleType: string // Exact value from Reference API 5.8 ratE_DESC
    sroItemSerialNo?: string // Required for some SRO-based items
}

export interface DIResponse {
    invoiceNumber?: string // FBR-issued (22 or 28 digits)
    dated?: string // "YYYY-MM-DD HH:mm:ss"
    validationResponse: {
        statusCode: string // "00" = Valid, "01" = Invalid
        status: string // "Valid" or "Invalid" or "invalid" (note: lowercase possible)
        error?: string
        errorCode?: string
        invoiceStatuses: DIItemStatus[] | null
    }
}

export interface DIItemStatus {
    itemSNo: string
    statusCode: string // "00" = Valid, "01" = Invalid
    status: string
    invoiceNo: string | null // Item-level FBR invoice number
    errorCode: string
    error: string
}

export type DIValidationResponse = Omit<DIResponse, 'invoiceNumber'>
