import QRCode from 'qrcode'

export async function generateDIQRCode(fbrInvoiceNumber: string): Promise<string> {
    // Version 2 = 25×25 modules
    return QRCode.toDataURL(fbrInvoiceNumber, {
        version: 2, // Forces 25×25 module grid
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 96, // 96px ≈ 1 inch at 96dpi
        color: { dark: '#000000', light: '#FFFFFF' },
    })
}

// For PDF receipts — generate as SVG for crisp printing
export async function generateDIQRCodeSVG(fbrInvoiceNumber: string): Promise<string> {
    return QRCode.toString(fbrInvoiceNumber, {
        type: 'svg',
        version: 2,
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 96,
    })
}
