const DI_SALES_ERRORS: Record<string, string> = {
    '0001': 'Seller NTN is not registered for sales tax. Verify your NTN in your DI credentials.',
    '0002': 'Buyer NTN/CNIC format is invalid. Must be 7-digit NTN or 13-digit CNIC.',
    '0003': 'Invalid invoice type. Use "Sale Invoice" or "Debit Note".',
    '0005': 'Invoice date format incorrect. Use YYYY-MM-DD (e.g. 2025-07-29).',
    '0009': 'Buyer registration number is required for registered buyers.',
    '0010': 'Buyer name is required.',
    '0012': 'Buyer registration type is required. Set "Registered" or "Unregistered".',
    '0013': 'Sale type is invalid or missing.',
    '0018': 'Sales tax amount is required.',
    '0019': 'HS Code is required on all items.',
    '0020': 'Tax rate is required on all items.',
    '0021': 'Sales value excluding ST is required.',
    '0041': 'Invoice number is required.',
    '0044': 'HS Code is missing. Add a valid HS Code to this product.',
    '0046': 'Tax rate is missing. Select a valid rate for the sale type.',
    '0052': 'HS Code does not match the sale type. Check HS Code is valid for this product category.',
    '0053': 'Buyer registration type is invalid.',
    '0057': 'Reference invoice does not exist. For Debit Notes, the original FBR invoice number is required.',
    '0058': 'Self-invoicing not allowed. Buyer and Seller NTN cannot be the same.',
    '0073': 'Seller province is required.',
    '0074': 'Buyer province is required.',
    '0077': 'SRO/Schedule number is required for this sale type.',
    '0078': 'SRO item serial number is required.',
    '0079': 'Sales value over PKR 20,000 — 5% rate is not allowed at this value.',
    '0083': 'Seller registration number does not match your IRIS profile.',
    '0096': 'For this HS Code, only KWH unit of measure is allowed.',
    '0099': 'Unit of measure does not match the HS Code. Check the valid UOM for this product.',
    '0104': 'Sales tax calculation is incorrect. Check: quantity × unit price × rate% = salesTaxApplicable.',
    '0107': 'Buyer NTN does not match FBR records.',
    '0108': 'Seller NTN format is invalid.',
    '0300': 'Decimal value format error. Check quantity, discount, tax, and fee fields.',
    '0401': 'Your PRAL DI token is not authorized for this seller NTN. Re-register on IRIS portal.',
    '0402': 'Your PRAL DI token is not authorized for this buyer NTN.',
}

export function mapDIErrorCodes(validationResponse: {
    errorCode?: string
    error?: string
    invoiceStatuses?: Array<{
        itemSNo: string
        statusCode: string
        status: string
        errorCode: string
        error: string
    }> | null
}): Array<{
    code: string
    message: string
    item?: string
    action: string
}> {
    const errors: Array<{ code: string; message: string; item?: string; action: string }> = []

    // Header-level error
    if (validationResponse.errorCode) {
        errors.push({
            code: validationResponse.errorCode,
            message: DI_SALES_ERRORS[validationResponse.errorCode] ?? validationResponse.error ?? 'Unknown error',
            action: getActionForError(validationResponse.errorCode),
        })
    }

    // Item-level errors
    if (validationResponse.invoiceStatuses) {
        for (const item of validationResponse.invoiceStatuses) {
            if (item.statusCode === '01' && item.errorCode) {
                errors.push({
                    code: item.errorCode,
                    message: DI_SALES_ERRORS[item.errorCode] ?? item.error,
                    item: `Item #${item.itemSNo}`,
                    action: getActionForError(item.errorCode),
                })
            }
        }
    }

    return errors
}

function getActionForError(code: string): string {
    const actions: Record<string, string> = {
        '0001': 'Update your seller NTN in Settings → DI Credentials',
        '0019': 'Assign a valid HS Code to this product in Products catalogue',
        '0044': 'Assign a valid HS Code to this product in Products catalogue',
        '0046': 'Select a tax rate for this item',
        '0052': 'Check the HS Code is valid for the selected sale type',
        '0099': 'Select the correct unit of measure for this HS Code',
        '0401': 'Your DI token may have expired. Go to IRIS portal and generate a new token.',
        '0104': 'Recalculate sales tax: value × rate = tax amount',
    }
    return actions[code] ?? 'Check field and try again'
}
