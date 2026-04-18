const DI_SALES_ERRORS: Record<string, string> = {
    '0001': 'Seller NTN is not registered for sales tax',
    '0401': 'PRAL DI token is not authorized',
    '0402': 'PRAL DI token is not authorized for buyer NTN',
    '0083': 'Seller registration number does not match IRIS profile',
}

// Helper to generate pre-filled CRM case information for tenants
export function generateSupportCaseInfo(
    tenantNTN: string,
    errorCode: string,
    errorDetail: string,
    invoiceId: string,
): string {
    return `
PRAL DI Support Case Information
──────────────────────────────────
CRM Portal: https://dicrm.pral.com.pk
Login Type: DI-Support (use your registered CRM email)

Query Type: ${errorCode.startsWith('04') ? 'Integration' : 'Post Integration'}
Priority: ${['0401', '0402', '0083'].includes(errorCode) ? 'High' : 'Normal'}

Title: Error ${errorCode} - ${DI_SALES_ERRORS[errorCode] ?? 'Invoice submission failure'}

Description:
- Seller NTN: ${tenantNTN}
- Invoice ID: ${invoiceId}
- Error Code: ${errorCode}
- Error Detail: ${errorDetail}
- Platform: FBR SaaS POS Platform
- Licensed Integrator: FBR SaaS POS Platform

Please attach: Screenshot of error response (PDF, max 5MB)
  `.trim()
}
